"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getFtTokens } from "@/lib/api";
import { getNearBalances, getNearStakedBalances } from "@/lib/rpc";
import { sha256 } from "js-sha256";
import Big from "big.js";
import { Near } from "@/lib/near";
import { formatNearAmount } from "@/lib/common";
const DaoContext = createContext(null);

export const useDao = () => {
  const context = useContext(DaoContext);
  if (!context) {
    throw new Error("useDao must be used within a DaoProvider");
  }
  return context;
};

function aggregateStakedBalances(stakedBalances) {
  let stakedBalance = 0;
  let unstakedBalance = 0;
  let totalBalance = 0;
  let availableToWithdraw = 0;
  stakedBalances.forEach((pool) => {
    stakedBalance = Big(stakedBalance).plus(pool.staked);
    unstakedBalance = Big(unstakedBalance).plus(pool.unstaked);
    totalBalance = Big(totalBalance).plus(pool.total);
    availableToWithdraw = Big(availableToWithdraw).plus(
      pool.availableToWithdraw
    );
  });
  return {
    staked: stakedBalance.toFixed(),
    unstaked: unstakedBalance.toFixed(),
    total: totalBalance.toFixed(),
    availableToWithdraw: availableToWithdraw.toFixed(),
  };
}

export const DaoProvider = ({ children }) => {
  const params = useParams();
  const [daoId, setDaoId] = useState(null);
  const [lockupContract, setLockupContract] = useState(null);
  const [ftLockups, setFtLockups] = useState(null);
  const [daoNearBalances, setDaoNearBalances] = useState(null);
  const [daoFtBalances, setDaoFtBalances] = useState(null);
  const [daoStakedBalances, setDaoStakedBalances] = useState(null);
  const [lockupNearBalances, setLockupNearBalances] = useState(null);
  const [lockupStakedBalances, setLockupStakedBalances] = useState(null);
  const [lockupContractState, setLockupContractState] = useState(null);

  async function accountToLockup() {
    const lockupAccount = `${sha256(Buffer.from(daoId))
      .toString("hex")
      .slice(0, 40)}.lockup.near`;
    const account = await getNearBalances(lockupAccount);
    if (account) {
      setLockupContract(lockupAccount);
      getLockupBalances(lockupAccount);
    }
  }

  // Validate DAO ID format
  const isValidDaoId = (id) => {
    if (!id) return false;
    // Basic validation for NEAR account ID format
    return /^[a-z0-9._-]+\.near$/.test(id) || /^[a-f0-9]{64}$/.test(id);
  };

  // Extract daoId from URL params
  useEffect(() => {
    if (params?.daoId) {
      if (isValidDaoId(params.daoId)) {
        setDaoId(params.daoId);
      }
    }
  }, [params]);

  function getDaoBalances() {
    getFtTokens(daoId).then((tokens) => {
      setDaoFtBalances(tokens);
    });
    getNearBalances(daoId).then((balances) => {
      setDaoNearBalances(balances);
    });
    getNearStakedBalances(daoId).then((pools) => {
      setDaoStakedBalances(aggregateStakedBalances(pools));
    });
  }

  function getLockupBalances(lockupContract) {
    Promise.all([
      getNearStakedBalances(lockupContract),
      getNearBalances(lockupContract),
      Near.view(lockupContract, "get_locked_amount"),
    ]).then(([stakedPools, lockupBalances, contractLocked]) => {
      const contractLockedParsed = formatNearAmount(contractLocked);
      const lockupStakedBalances = aggregateStakedBalances(stakedPools);
      const stakedTokensYoctoNear = Big(lockupStakedBalances.total)
        .mul(Big(10).pow(24))
        .toFixed();
      const allLockedStaked = Big(lockupStakedBalances.total).gte(
        contractLockedParsed
      );
      let locked = allLockedStaked
        ? 0
        : Big(lockupStakedBalances.total)
            .minus(lockupBalances.contractLockedParsed)
            .abs()
            .mul(Big(10).pow(24))
            .toFixed();
      let total = Big(lockupBalances.total)
        .plus(stakedTokensYoctoNear)
        .toFixed();
      let available = Big(total)
        .minus(stakedTokensYoctoNear)
        .minus(locked)
        .minus(lockupBalances.storage)
        .toFixed();
      if (available < 0) {
        available = 0;
      }
      let storage = lockupBalances.storage;
      const sumTotal = Big(locked)
        .plus(available)
        .plus(stakedTokensYoctoNear)
        .plus(storage);
      if (Big(total).lt(sumTotal)) {
        storage = Big(storage).minus(sumTotal.minus(total)).toFixed();
      }
      setLockupStakedBalances(lockupStakedBalances);
      setLockupNearBalances({
        storage,
        contractLocked: contractLocked,
        storageParsed: formatNearAmount(storage),
        available: available,
        availableParsed: formatNearAmount(available),
        total: total,
        totalParsed: formatNearAmount(total),
        locked,
        lockedParsed: formatNearAmount(locked),
      });
    });
    Near.viewState(lockupContract).then((res) => {
      setLockupContractState(atob(res?.[0]?.value));
    });
  }

  function fetchFtLockups() {
    Near.view("ft-lockup.near", "get_instances").then((instances) => {
      if (instances.length === 0) {
        return;
      } else {
        const instanceIds = instances.map((instance) => instance?.[1] || "");
        if (instanceIds.length > 0) {
          Promise.all(
            instanceIds.map((instanceId) => {
              return Near.view(instanceId, "get_account", {
                account_id: daoId,
              })
                .then((res) => {
                  if (typeof res === "object" && res !== null) {
                    return {
                      ...res,
                      contractId: instanceId,
                    };
                  }
                  return null;
                })
                .catch((err) => {
                  console.error("Error fetching ft lockups:", err);
                  return null;
                });
            })
          )
            .then((results) => {
              // Filter out null values to get only instances where DAO is present
              const instancesWithDao = results.filter(
                (instance) => instance !== null
              );

              // Call setFtLockups with the array of instances where DAO is present
              if (instancesWithDao.length > 0) {
                // Categorize FT lockups based on claim status
                const fullyClaimed = [];
                const partiallyClaimed = [];

                instancesWithDao.forEach((ftLockup) => {
                  const claimedAmount = Big(ftLockup.claimed_amount).toFixed();

                  if (Big(claimedAmount).gte(Big(ftLockup.deposited_amount))) {
                    fullyClaimed.push(ftLockup);
                  } else {
                    partiallyClaimed.push(ftLockup);
                  }
                });
                setFtLockups({ fullyClaimed, partiallyClaimed });
              }
            })
            .catch((err) => {
              console.error("Error fetching ft lockups:", err);
            });
        }
      }
    });
  }

  useEffect(() => {
    if (daoId) {
      accountToLockup();
      getDaoBalances();
      fetchFtLockups();
    }
  }, [daoId]);

  const value = {
    daoId,
    lockupContract,
    ftLockups,
    daoNearBalances,
    daoFtBalances,
    daoStakedBalances,
    lockupStakedBalances,
    lockupNearBalances,
    lockupContractState,
    refreshDaoBalances: getDaoBalances,
    refreshLockupBalances: getLockupBalances,
    refreshFtLockups: fetchFtLockups,
  };

  return <DaoContext.Provider value={value}>{children}</DaoContext.Provider>;
};

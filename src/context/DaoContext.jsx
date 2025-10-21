"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getFtTokens } from "@/api/backend";
import {
  getNearBalances,
  getNearStakedBalances,
  getIntentsBalances,
} from "@/api/rpc";
import Big from "big.js";
import { Near } from "@/api/near";
import { formatNearAmount, accountToLockup } from "@/helpers/nearHelpers";
import { useNearWallet } from "@/context/NearWalletContext";
import { getDaoConfig } from "@/config";
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
  (stakedBalances || []).forEach((pool) => {
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
  const [daoStakedPools, setDaoStakedPools] = useState(null);
  const [lockupNearBalances, setLockupNearBalances] = useState(null);
  const [lockupStakedBalances, setLockupStakedBalances] = useState(null);
  const [lockupStakedPools, setLockupStakedPools] = useState(null);
  const [lockupContractState, setLockupContractState] = useState(null);
  const [lastProposalId, setLastProposalId] = useState(null);
  const [daoPolicy, setDaoPolicy] = useState(null);
  const [intentsBalances, setIntentsBalances] = useState(null);
  const [daoConfig, setDaoConfig] = useState(null);
  const [customConfig, setCustomConfig] = useState(getDaoConfig(null));
  const [lockupStakedPoolId, setLockupStakedPoolId] = useState(null);

  async function checkAndSetLockupContract() {
    const lockupAccount = await accountToLockup(daoId);
    if (lockupAccount) {
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

  // Extract daoId from URL params and set app config
  useEffect(() => {
    if (params?.daoId) {
      if (isValidDaoId(params.daoId)) {
        setDaoId(params.daoId);
        setCustomConfig(getDaoConfig(params.daoId));
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
      setDaoStakedPools(pools);
      setDaoStakedBalances(aggregateStakedBalances(pools));
    });
  }

  function getLockupBalances(lockupContract) {
    Promise.all([
      getNearStakedBalances(lockupContract),
      getNearBalances(lockupContract),
      Near.view(lockupContract, "get_locked_amount"),
      Near.view(lockupContract, "get_staking_pool_account_id"),
    ]).then(([stakedPools, lockupBalances, contractLocked, stakingPoolId]) => {
      setLockupStakedPoolId(stakingPoolId);
      setLockupStakedPools(stakedPools);
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
                  if (Big(ftLockup.deposited_amount).lte(0)) {
                    return;
                  }

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

  function getLastProposalId() {
    return Near.view(daoId, "get_last_proposal_id", {})
      .then((id) => {
        setLastProposalId(id);
        return id;
      })
      .catch((err) => {
        console.error("Error fetching last proposal ID:", err);
        return null;
      });
  }

  function getDaoPolicy() {
    return Near.view(daoId, "get_policy", {})
      .then((policy) => {
        setDaoPolicy(policy);
        return policy;
      })
      .catch((err) => {
        console.error("Error fetching DAO policy:", err);
        return null;
      });
  }

  function fetchIntentsBalances() {
    return getIntentsBalances(daoId)
      .then((balances) => {
        setIntentsBalances(balances);
        return balances;
      })
      .catch((err) => {
        console.error("Error fetching intents balances:", err);
        return [];
      });
  }

  function getDaoMetadata() {
    return Near.view(daoId, "get_config", {})
      .then((config) => {
        const metadata = config?.metadata
          ? JSON.parse(atob(config?.metadata))
          : null;
        setDaoConfig({
          ...config,
          metadata,
        });
        return { ...config, metadata };
      })
      .catch((err) => {
        console.error("Error fetching DAO config:", err);
        return null;
      });
  }

  function hasPermission(kindName, actionType) {
    const { accountId } = useNearWallet();
    if (!accountId) {
      return false;
    }

    if (!daoPolicy || !Array.isArray(daoPolicy.roles)) {
      return false;
    }

    const kindNames = Array.isArray(kindName) ? kindName : [kindName];
    const actionTypes = Array.isArray(actionType) ? actionType : [actionType];

    // if the role is all and has everyone, we need to check for it
    for (const role of daoPolicy.roles) {
      if (
        role.kind !== "Everyone" &&
        Array.isArray(role.kind.Group) &&
        !role.kind.Group.includes(accountId)
      ) {
        continue;
      }

      for (const kind of kindNames) {
        for (const action of actionTypes) {
          const permissionVariants = [
            `${kind}:${action}`,
            `${kind}:*`,
            `*:${action}`,
            "*:*",
          ];

          if (
            permissionVariants.some((perm) => role.permissions.includes(perm))
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function getApproversAndThreshold(kind, isDeleteCheck) {
    const { accountId } = useNearWallet();
    const groupWithPermission = (daoPolicy?.roles ?? []).filter((role) => {
      const permissions = isDeleteCheck
        ? ["*:*", `${kind}:*`, `${kind}:VoteRemove`, "*:VoteRemove"]
        : [
            "*:*",
            `${kind}:*`,
            `${kind}:VoteApprove`,
            `${kind}:VoteReject`,
            "*:VoteApprove",
            "*:VoteReject",
          ];
      return (role?.permissions ?? []).some((i) => permissions.includes(i));
    });

    let approversGroup = [];
    let ratios = [];
    let requiredVotes = null;
    let everyoneHasAccess = false;
    // if group kind is everyone, current user will have access
    groupWithPermission.map((i) => {
      approversGroup = approversGroup.concat(i?.kind?.Group ?? []);
      everyoneHasAccess = i.kind === "Everyone";
      const votePolicy =
        Object.values(i?.vote_policy?.[kind] ?? {}).length > 0
          ? i.vote_policy[kind]
          : daoPolicy.default_vote_policy;
      if (votePolicy.weight_kind === "RoleWeight") {
        if (Array.isArray(votePolicy.threshold)) {
          ratios = ratios.concat(votePolicy.threshold);
          ratios = ratios.concat(votePolicy.threshold);
        } else {
          requiredVotes = parseFloat(votePolicy.threshold);
        }
      }
    });

    let numerator = 0;
    let denominator = 0;

    if (ratios.length > 0) {
      ratios.forEach((value, index) => {
        if (index == 0 || index % 2 === 0) {
          // Even index -> numerator
          numerator += value;
        } else {
          // Odd index -> denominator
          denominator += value;
        }
      });
    }
    const approverAccounts = Array.from(new Set(approversGroup));

    return {
      // if everyoneHasAccess, current account doesn't change the requiredVotes
      approverAccounts:
        everyoneHasAccess && accountId
          ? [...approverAccounts, accountId]
          : approverAccounts,
      requiredVotes:
        typeof requiredVotes === "number"
          ? requiredVotes
          : Math.floor((numerator / denominator) * approverAccounts.length) + 1,
    };
  }

  useEffect(() => {
    if (daoId) {
      checkAndSetLockupContract();
      getDaoBalances();
      fetchFtLockups();
      getLastProposalId();
      getDaoPolicy();
      fetchIntentsBalances();
      getDaoMetadata();
    }
  }, [daoId]);

  const value = {
    daoId,
    lockupContract,
    ftLockups,
    daoNearBalances,
    daoFtBalances,
    daoStakedBalances,
    daoStakedPools,
    lockupStakedBalances,
    lockupStakedPools,
    lockupNearBalances,
    lockupContractState,
    lastProposalId,
    daoPolicy,
    intentsBalances,
    daoConfig,
    customConfig,
    refreshDaoBalances: getDaoBalances,
    refreshLockupBalances: getLockupBalances,
    refreshFtLockups: fetchFtLockups,
    refetchLastProposalId: getLastProposalId,
    refetchDaoPolicy: getDaoPolicy,
    refetchIntentsBalances: fetchIntentsBalances,
    refetchDaoConfig: getDaoConfig,
    hasPermission,
    getApproversAndThreshold,
    lockupStakedPoolId,
  };

  return <DaoContext.Provider value={value}>{children}</DaoContext.Provider>;
};

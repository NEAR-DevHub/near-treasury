"use client";

import { useState, useEffect } from "react";
import Skeleton from "@/components/ui/Skeleton";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";
import NearToken from "@/components/icons/NearToken";
import Profile from "@/components/ui/Profile";
import Copy from "@/components/ui/Copy";
import { accountToLockup } from "@/helpers/nearHelpers";
import { Near } from "@/api/near";
import { getTransactionTransferHistory } from "@/api/backend";
import Big from "big.js";

const TransactionHistory = ({ treasuryDaoID, lockupContract }) => {
  const [error, setError] = useState(null);
  const [transactionWithBalances, setTransactionWithBalance] = useState([]);
  const [page, setPage] = useState(1);
  const [showMoreLoading, setShowMoreLoading] = useState(false);
  const [hideViewMore, setHideViewMore] = useState(false);
  const [contractMetadataCache, setContractMetadataCache] = useState({});

  const totalTxnsPerPage = 15;

  function setAPIError() {
    setShowMoreLoading(false);
    setError(
      "Failed to fetch the transaction history, please try again later."
    );
  }

  useEffect(() => {
    if (!showMoreLoading && treasuryDaoID) {
      setShowMoreLoading(true);
      getTransactionTransferHistory(treasuryDaoID, lockupContract, page)
        .then(async (res) => {
          if (!res || !res.data) {
            setAPIError();
          } else {
            if (res.data.length < page * totalTxnsPerPage) {
              setHideViewMore(true);
            }
            setError(null);
            setTransactionWithBalance(res.data);

            // Fetch contract metadata for all transactions with contracts
            const contractsToFetch = [
              ...new Set(
                res.data
                  .filter((txn) => txn.contract)
                  .map((txn) => txn.contract)
              ),
            ];

            // Fetch metadata for all unique contracts
            await Promise.all(
              contractsToFetch.map((contractId) =>
                fetchContractMetadata(contractId)
              )
            );

            setShowMoreLoading(false);
          }
        })
        .catch((error) => {
          console.error("Error fetching transaction history:", error);
          setAPIError();
        });
    }
  }, [page, lockupContract, treasuryDaoID]);

  function convertBalanceToReadableFormat(amount) {
    return Big(amount ?? "0").toFixed(2);
  }

  function formatCurrency(amount) {
    return Number(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getImage(actionKind) {
    switch (actionKind) {
      case "Staked":
        return "https://ipfs.near.social/ipfs/bafkreica3gyix6i4pqt7nfolcmdpsi2hfgqnj6iwp2jkwixdhm3zl4if6u";
      case "Deposit":
        return "https://ipfs.near.social/ipfs/bafkreiazt7rdkgmz2rpvloo3gjoahgxe6dtgicrgzujarf3rbmwuyk2iby";
      default:
        return "https://ipfs.near.social/ipfs/bafkreigty6dicbjdlbm6ezepuzl63tkdqebyf2rclzbwxfnd2yvkqmllda";
    }
  }

  const loader = (
    <div className="d-flex flex-column gap-2 p-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton
          className="rounded-2"
          key={i}
          style={{ height: "60px", width: "100%" }}
        />
      ))}
    </div>
  );

  const fetchContractMetadata = async (contractId) => {
    if (contractMetadataCache[contractId]) {
      return contractMetadataCache[contractId];
    }

    try {
      const metadata = await Near.view(contractId, "ft_metadata", {});
      setContractMetadataCache((prev) => ({
        ...prev,
        [contractId]: metadata,
      }));
      return metadata;
    } catch (error) {
      console.error(
        `Error fetching metadata for contract ${contractId}:`,
        error
      );
      return null;
    }
  };

  return (
    <div className="card flex-1 w-100">
      <div className="h5 p-3 mb-0">Transaction History</div>
      <div className="">
        {error ? (
          <div className="alert alert-danger mb-2 mx-3" role="alert">
            {error}
          </div>
        ) : transactionWithBalances === null ? (
          <div className="mb-3 p-2"> {loader}</div>
        ) : (
          <div className="d-flex flex-column gap-2 overflow-auto">
            {Array.isArray(transactionWithBalances) && (
              <table className="table">
                <thead>
                  <tr className="text-secondary px-3 py-3 border-top">
                    <td>Type</td>
                    <td>From</td>
                    <td>To</td>
                    <td className="text-end">Transaction</td>
                    <td className="text-end">Amount</td>
                  </tr>
                </thead>
                <tbody style={{ overflowX: "auto" }}>
                  {transactionWithBalances.map((txn, index) => {
                    let balanceDiff = "";
                    let token = "NEAR";
                    let iconSrc = "";
                    const isDeposit = txn.deposit;
                    const isStaked =
                      isDeposit &&
                      (txn.receiver.includes("poolv1.near") ||
                        txn.receiver.includes("pool.near"));

                    const isReceived =
                      txn.receiver === treasuryDaoID ||
                      txn.receiver === lockupContract;
                    if (txn.contract) {
                      const contractMetadata =
                        contractMetadataCache[txn.contract];
                      token = contractMetadata?.symbol || "FT";
                      iconSrc = contractMetadata?.icon;
                      balanceDiff = convertBalanceToReadableFormat(txn.amount);
                    } else {
                      balanceDiff = convertBalanceToReadableFormat(txn.amount);
                    }
                    const txnType = isStaked
                      ? "Staked"
                      : isDeposit
                      ? "Deposit"
                      : "Transfer";
                    const txnLink = `https://nearblocks.io/txns/${txn.transaction_id}`;
                    return (
                      <tr key={index} className="px-3 py-3">
                        <td style={{ minWidth: 250 }}>
                          <div className="d-flex gap-2 align-items-center">
                            <img
                              src={getImage(txnType)}
                              height="40"
                              alt={txnType}
                              className="rounded-circle"
                            />
                            <div className="text-sm">
                              <div className="text-md mb-0">{txnType}</div>
                              <DateTimeDisplay
                                timestamp={txn.timestamp / 1000000}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ minWidth: 180, maxWidth: 180 }}>
                          <Profile
                            accountId={txn.sender}
                            showKYC={false}
                            displayImage={false}
                            displayName={false}
                            imageSize={{ width: 20, height: 20 }}
                          />
                        </td>
                        <td style={{ minWidth: 180, maxWidth: 180 }}>
                          <Profile
                            accountId={txn.receiver}
                            showKYC={false}
                            displayImage={false}
                            displayName={false}
                            imageSize={{ width: 20, height: 20 }}
                          />
                        </td>
                        <td className="text-end" style={{ minWidth: 100 }}>
                          <div className="d-flex gap-2 align-items-center justify-content-end">
                            <a
                              target="_blank"
                              rel="noopener noreferrer"
                              href={txnLink}
                              className="text-decoration-underline"
                            >
                              {txn.transaction_id?.substring(0, 4)}...
                              {txn.transaction_id?.substring(
                                txn.transaction_id.length - 4
                              )}
                            </a>
                            <Copy
                              label=""
                              clipboardText={txnLink}
                              showLogo={true}
                              checkLogoClass="h5"
                            />
                            <a
                              target="_blank"
                              rel="noopener noreferrer"
                              href={txnLink}
                              className="text-decoration-underline"
                              style={{ color: "var(--text-color)" }}
                            >
                              <i className="bi bi-box-arrow-up-right h5 mb-0"></i>
                            </a>
                          </div>
                        </td>
                        <td>
                          <div
                            className="text-end"
                            style={{ minWidth: "130px" }}
                          >
                            <div className="fw-bold d-flex gap-1 align-items-center justify-content-end">
                              {isReceived ? "+" : "-"}
                              {formatCurrency(balanceDiff)}{" "}
                              {iconSrc ? (
                                <img
                                  src={iconSrc}
                                  height={20}
                                  width={20}
                                  alt={token}
                                />
                              ) : (
                                <NearToken width={20} height={20} />
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div>
              {showMoreLoading ? (
                loader
              ) : (
                <div className="w-100 h-100 mb-3 px-3">
                  {!hideViewMore && (
                    <button
                      onClick={() => {
                        setPage(page + 1);
                      }}
                      className="btn btn-outline-secondary w-100"
                    >
                      Show More
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;

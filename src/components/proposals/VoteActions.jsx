"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";
import ProposalStatus from "@/components/proposals/ProposalStatus";
import TokenAmount from "@/components/proposals/TokenAmount";
import Tooltip from "@/components/ui/Tooltip";
import Skeleton from "@/components/ui/Skeleton";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import { Near } from "@/api/near";
import Big from "big.js";
import { formatDateTimeWithTimezone } from "@/components/ui/DateTimeDisplay";
import { REFRESH_DELAY } from "@/constants/ui";

const VoteActions = ({
  votes = {},
  proposalId,
  currentAmount = "0",
  currentContract = "",
  avoidCheckForBalance = false,
  hasDeletePermission = false,
  hasVotingPermission = false,
  proposalCreator,
  isWithdrawRequest = false,
  validatorAccount,
  treasuryWallet,
  isHumanReadableCurrentAmount = false,
  isProposalDetailsPage = false,
  hasOneDeleteIcon = false,
  isIntentsRequest = false,
  proposal,
  isQuoteExpired = false,
  quoteDeadline,
  context = "request", // Default context for toast messages
  isLockupRequest = false,
}) => {
  const { accountId, signAndSendTransactions } = useNearWallet();
  const {
    daoId: treasuryDaoID,
    daoNearBalances,
    daoFtBalances,
    intentsBalances,
    lockupNearBalances,
    refreshDaoBalances,
    refreshLockupBalances,
    refetchDaoPolicy,
    refetchIntentsBalances,
    refetchDaoConfig,
  } = useDao();
  const { showToast } = useProposalToastContext();

  const alreadyVoted = Object.keys(votes).includes(accountId);
  const userVote = votes[accountId];

  const isNEAR =
    currentContract === "" || currentContract?.toLowerCase() === "near";

  const actions = {
    APPROVE: "VoteApprove",
    REJECT: "VoteReject",
    REMOVE: "VoteRemove",
  };

  const [isTxnCreated, setTxnCreated] = useState(false);
  const [vote, setVote] = useState(null);
  const [isInsufficientBalance, setInsufficientBal] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [isReadyToBeWithdrawn, setIsReadyToBeWithdrawn] = useState(true);
  const [showConfirmModal, setConfirmModal] = useState(false);
  const [userBalance, setUserBalance] = useState("0");

  // Universal loading state - tracks all async checks
  const [loadingStates, setLoadingStates] = useState({
    withdrawCheck: isWithdrawRequest, // Only check if it's a withdraw request
    balanceCheck: !avoidCheckForBalance, // Only check if balance check is needed
  });

  // Computed loading state - true if any check is pending
  const isLoading = loadingStates.withdrawCheck || loadingStates.balanceCheck;

  // Get user balance from DAO context
  useEffect(() => {
    if (isNEAR) {
      // Use lockup balance if it's a lockup request, otherwise use DAO balance
      const balances = isLockupRequest ? lockupNearBalances : daoNearBalances;
      setUserBalance(
        isHumanReadableCurrentAmount
          ? balances?.availableParsed || "0"
          : balances?.available || "0"
      );
    } else if (isIntentsRequest && intentsBalances) {
      // Find the balance for the current contract in intents balances
      // Match by either contract_id or symbol (for backward compatibility)
      const contractBalance = intentsBalances.find(
        (balance) =>
          balance.contract_id === currentContract ||
          balance.ft_meta?.symbol?.toLowerCase() ===
            currentContract?.toLowerCase()
      );
      setUserBalance(
        isHumanReadableCurrentAmount
          ? Big(contractBalance?.amount || "0")
              .div(Big(10).pow(contractBalance?.ft_meta?.decimals || 0))
              .toFixed()
          : contractBalance?.amount || "0"
      );
    } else if (currentContract && daoFtBalances?.fts) {
      // Find the balance for the current contract in FT balances
      const contractBalance = daoFtBalances.fts.find(
        (balance) => balance.contract === currentContract
      );
      setUserBalance(
        isHumanReadableCurrentAmount
          ? Big(contractBalance?.amount || "0")
              .div(Big(10).pow(contractBalance?.ft_meta?.decimals || 0))
              .toFixed()
          : contractBalance?.amount || "0"
      );
    }

    // Mark balance check as complete after balance is set
    if (!avoidCheckForBalance) {
      setLoadingStates((prev) => ({ ...prev, balanceCheck: false }));
    }
  }, [
    isNEAR,
    isHumanReadableCurrentAmount,
    daoNearBalances,
    lockupNearBalances,
    isLockupRequest,
    isIntentsRequest,
    currentContract,
    daoFtBalances,
    intentsBalances,
    avoidCheckForBalance,
  ]);

  // Check if user has sufficient balance
  useEffect(() => {
    if (avoidCheckForBalance || !userBalance) return;
    setInsufficientBal(
      Big(userBalance ?? "0").lt(Big(currentAmount ?? "0").toFixed())
    );
  }, [
    userBalance,
    currentAmount,
    currentContract,
    avoidCheckForBalance,
    isHumanReadableCurrentAmount,
  ]);

  // Check if withdraw request is ready to be withdrawn
  useEffect(() => {
    const checkWithdrawReady = async () => {
      if (isWithdrawRequest && validatorAccount && treasuryWallet) {
        try {
          const res = await Near.view(
            validatorAccount,
            "is_account_unstaked_balance_available",
            {
              account_id: treasuryWallet,
            }
          );
          setIsReadyToBeWithdrawn(res);
        } catch (error) {
          console.error("Error checking withdraw status:", error);
        } finally {
          // Mark withdraw check as complete
          setLoadingStates((prev) => ({ ...prev, withdrawCheck: false }));
        }
      } else if (!isWithdrawRequest) {
        // Not a withdraw request, mark as complete immediately
        setLoadingStates((prev) => ({ ...prev, withdrawCheck: false }));
      }
    };

    checkWithdrawReady();
  }, [isWithdrawRequest, validatorAccount, treasuryWallet]);

  const actProposal = async () => {
    if (!accountId || !signAndSendTransactions) return;

    setTxnCreated(true);
    try {
      const result = await signAndSendTransactions({
        transactions: [
          {
            signerId: accountId,
            receiverId: treasuryDaoID,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "act_proposal",
                  args: {
                    id: proposalId,
                    action: vote,
                    proposal: proposal?.kind,
                  },
                  gas: "300000000000000",
                  deposit: "0",
                },
              },
            ],
          },
        ],
      });
      console.log("Result:", result);
      if (
        result &&
        result.length > 0 &&
        typeof result[0]?.status?.SuccessValue === "string"
      ) {
        // Delay cache invalidation to give the indexer time to process the transaction
        // This prevents a race condition where the refetch happens before indexing completes
        setTimeout(async () => {
          try {
            const proposalResult = await Near.view(
              treasuryDaoID,
              "get_proposal",
              {
                id: proposalId,
              }
            );
            showToast(proposalResult.status, proposalId, context);
          } catch {
            // deleted request (thus proposal won't exist)
            showToast("Removed", proposalId, context);
          }
          setTxnCreated(false);
          refreshDaoBalances();
          refreshLockupBalances();
          refetchDaoPolicy();
          refetchIntentsBalances();
          refetchDaoConfig();
        }, REFRESH_DELAY);
      }
    } catch (error) {
      console.error("Error acting on proposal:", error);
      showToast("ErrorVoting", proposalId, context);
      setTxnCreated(false);
    }
  };

  const InsufficientBalanceWarning = () => {
    if (!showWarning) return null;

    return (
      <Modal
        isOpen={showWarning}
        heading={
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="d-flex align-items-center gap-3">
              <i className="bi bi-exclamation-triangle text-warning text-xl mb-0"></i>
              Insufficient Balance
            </div>
          </div>
        }
        onClose={(e) => {
          e?.stopPropagation();
          setShowWarning(false);
        }}
        footer={
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary shadow-none"
              onClick={(e) => {
                e.stopPropagation();
                setShowWarning(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn theme-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowWarning(false);
                setConfirmModal(true);
              }}
            >
              Proceed Anyway
            </button>
          </div>
        }
      >
        <div className="text-color text-left">
          Your current balance is not enough to complete this transaction.
          <div className="d-flex pb-1 mt-2 gap-1 align-items-center">
            • Transaction amount:
            <TokenAmount
              {...(isHumanReadableCurrentAmount
                ? { amountWithDecimals: currentAmount }
                : { amountWithoutDecimals: currentAmount })}
              address={currentContract}
              displayAllDecimals={true}
            />
          </div>
          <div className="d-flex gap-1 align-items-center">
            • Your current balance:
            <TokenAmount
              {...(isHumanReadableCurrentAmount
                ? { amountWithDecimals: userBalance }
                : { amountWithoutDecimals: userBalance })}
              address={currentContract}
              displayAllDecimals={true}
            />
          </div>
        </div>
      </Modal>
    );
  };

  const containerClass = isProposalDetailsPage
    ? "d-flex gap-2 align-items-center"
    : "d-flex gap-2 align-items-center justify-content-end";

  return (
    <div>
      <TransactionLoader showInProgress={isTxnCreated} />

      <InsufficientBalanceWarning />

      <Modal
        isOpen={showConfirmModal}
        heading="Confirm your vote"
        onClose={(e) => {
          e?.stopPropagation();
          setConfirmModal(false);
        }}
        footer={
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmModal(false);
              }}
            >
              Cancel
            </button>
            <button
              className="btn theme-btn"
              onClick={(e) => {
                e.stopPropagation();
                actProposal();
                setConfirmModal(false);
              }}
            >
              Confirm
            </button>
          </div>
        }
      >
        <div className="text-color text-left">
          {vote === actions.REMOVE
            ? "Do you really want to delete this request? This process cannot be undone."
            : `Are you sure you want to vote to ${
                vote === actions.APPROVE ? "approve" : "reject"
              } this request? You cannot change this vote later.`}
        </div>
      </Modal>

      {/* Show skeleton while loading */}
      {isLoading ? (
        <div className={containerClass}>
          <Skeleton
            className="rounded-3"
            style={{
              width: isProposalDetailsPage ? "250px" : "150px",
              height: "38px",
            }}
          />
          <Skeleton
            className="rounded-3"
            style={{
              width: isProposalDetailsPage ? "250px" : "150px",
              height: "38px",
            }}
          />
        </div>
      ) : alreadyVoted ? (
        <div className={containerClass}>
          <ProposalStatus
            isVoteStatus={true}
            status={userVote}
            hasOneDeleteIcon={hasOneDeleteIcon}
            hasFullWidth={isProposalDetailsPage}
          />
        </div>
      ) : (
        <div>
          {/* Determine if voting should be disabled */}
          {(() => {
            const isVotingDisabled = isQuoteExpired || !isReadyToBeWithdrawn;

            const renderInfoText = () => {
              if (isQuoteExpired) {
                return isProposalDetailsPage ? (
                  <div className="d-flex align-items-center gap-3 flex-grow-1 info-box mb-2">
                    <i className="bi bi-info-circle h6 mb-0"></i>
                    <span>
                      Voting is not available due to expired swap quote. The
                      1Click API quote for this request expired on{" "}
                      {formatDateTimeWithTimezone(quoteDeadline)}.
                      <Tooltip
                        tooltip={
                          <div>
                            The exchange rate quoted by 1Click API has expired.
                            Executing the swap at an outdated rate could result
                            in loss of funds.
                          </div>
                        }
                      >
                        <span className="text-decoration-underline ms-1 cursor-pointer">
                          Learn more
                        </span>
                      </Tooltip>
                    </span>
                  </div>
                ) : (
                  <div className="d-inline-block">
                    <Tooltip
                      tooltip={
                        <div>
                          Voting is not available due to expired swap quote. The
                          1Click API quote for this request expired on{" "}
                          {formatDateTimeWithTimezone(quoteDeadline)}. Executing
                          the swap at an outdated rate could result in loss of
                          funds.
                        </div>
                      }
                    >
                      <span className="text-secondary">
                        <i className="bi bi-info-circle"></i> Voting not
                        available due to expired swap quote
                      </span>
                    </Tooltip>
                  </div>
                );
              } else if (!isReadyToBeWithdrawn) {
                return isProposalDetailsPage ? (
                  <div className="d-flex align-items-center gap-3 flex-grow-1 info-box mb-2">
                    <i className="bi bi-info-circle h6 mb-0"></i>
                    <span>
                      Voting is not available before unstaking release.{" "}
                      <Tooltip
                        tooltip={
                          <div>
                            These tokens were unstaked, but are not yet ready
                            for withdrawal. Tokens are ready for withdrawal
                            52-65 hours after unstaking.
                          </div>
                        }
                      >
                        <span className="text-decoration-underline ms-1 cursor-pointer">
                          Learn more
                        </span>
                      </Tooltip>
                    </span>
                  </div>
                ) : (
                  <div className="text-secondary">
                    <i className="bi bi-info-circle"></i> Voting is not
                    available before unstaking release
                  </div>
                );
              } else {
                return null;
              }
            };

            return (
              <div
                className={
                  isProposalDetailsPage ? "d-flex flex-column gap-2" : ""
                }
              >
                {/* Show info text above buttons only on proposal details page */}
                {isProposalDetailsPage && isVotingDisabled && renderInfoText()}

                <div className={containerClass}>
                  {!isProposalDetailsPage &&
                    isVotingDisabled &&
                    renderInfoText()}

                  {/* Show voting buttons only if: 
                      - Has voting permission AND
                      - (Either on proposal details page OR voting is not disabled) */}
                  {hasVotingPermission &&
                    (isProposalDetailsPage || !isVotingDisabled) && (
                      <div className="d-flex gap-2 align-items-center w-100 justify-content-end">
                        <InsufficientBannerModal
                          ActionButton={() => (
                            <button
                              className="btn btn-success w-100 text-center"
                              disabled={isTxnCreated || isVotingDisabled}
                            >
                              Approve
                            </button>
                          )}
                          checkForDeposit={false}
                          treasuryDaoID={treasuryDaoID}
                          disabled={isTxnCreated || isVotingDisabled}
                          callbackAction={(e) => {
                            e.stopPropagation();
                            setVote(actions.APPROVE);
                            if (isInsufficientBalance) {
                              setShowWarning(true);
                            } else {
                              setConfirmModal(true);
                            }
                          }}
                          className={isProposalDetailsPage ? "w-100" : ""}
                        />
                        <InsufficientBannerModal
                          ActionButton={() => (
                            <button
                              className="btn btn-danger w-100 text-center"
                              disabled={isTxnCreated || isVotingDisabled}
                            >
                              Reject
                            </button>
                          )}
                          disabled={isTxnCreated || isVotingDisabled}
                          checkForDeposit={false}
                          treasuryDaoID={treasuryDaoID}
                          callbackAction={(e) => {
                            e.stopPropagation();
                            setVote(actions.REJECT);
                            setConfirmModal(true);
                          }}
                          className={isProposalDetailsPage ? "w-100" : ""}
                        />
                      </div>
                    )}
                  {/* currently showing delete btn only for proposal creator */}
                  {hasDeletePermission && proposalCreator === accountId ? (
                    <div style={{ width: "fit-content" }}>
                      <InsufficientBannerModal
                        ActionButton={() => (
                          <div data-testid="delete-btn" disabled={isTxnCreated}>
                            <i
                              className="bi bi-trash text-red mb-0"
                              style={{ fontSize: "1.3rem" }}
                            ></i>
                          </div>
                        )}
                        checkForDeposit={false}
                        treasuryDaoID={treasuryDaoID}
                        disabled={isTxnCreated}
                        callbackAction={(e) => {
                          e.stopPropagation();
                          setVote(actions.REMOVE);
                          setConfirmModal(true);
                        }}
                        className={isProposalDetailsPage ? "w-full" : ""}
                      />
                    </div>
                  ) : hasOneDeleteIcon ? (
                    <div style={{ minWidth: 20 }}></div>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default VoteActions;

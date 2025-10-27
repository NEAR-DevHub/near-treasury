"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { getProposalsFromIndexer } from "@/api/indexer";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import Modal from "@/components/ui/Modal";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import InsufficientBannerModal from "@/components/proposals/InsufficientBannerModal";
import Skeleton from "@/components/ui/Skeleton";
import WarningTable from "./WarningTable";
import { logger } from "@/helpers/logger";

const VotingDurationPage = () => {
  const router = useRouter();
  const {
    daoId: treasuryDaoID,
    hasPermission,
    daoPolicy,
    lastProposalId,
    refetchLastProposalId,
  } = useDao();
  const { accountId, signAndSendTransactions } = useNearWallet();

  const {
    watch,
    setValue,
    reset,
    formState: { isDirty },
  } = useForm({
    mode: "onChange",
    defaultValues: {
      durationDays: 0,
    },
  });

  const durationDays = watch("durationDays");

  const [currentDurationDays, setCurrentDurationDays] = useState(0);
  const [proposalsThatWillExpire, setProposalsThatWillExpire] = useState([]);
  const [proposalsThatWillBeActive, setProposalsThatWillBeActive] = useState(
    []
  );
  const [otherPendingRequests, setOtherPendingRequests] = useState([]);
  const [showToastStatus, setShowToastStatus] = useState("");
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [showAffectedProposalsModal, setShowAffectedProposalsModal] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingAffectedProposals, setLoadingAffectedProposals] =
    useState(false);

  const hasCreatePermission = hasPermission?.(
    "policy_update_parameters",
    "AddProposal"
  );
  const deposit = daoPolicy?.proposal_bond || 0;

  // Initialize duration from daoPolicy
  useEffect(() => {
    if (daoPolicy?.proposal_period) {
      const days =
        Number(
          daoPolicy.proposal_period.substr(
            0,
            daoPolicy.proposal_period.length - "000000000".length
          )
        ) /
        (60 * 60 * 24);

      setCurrentDurationDays(days);
      reset({ durationDays: days });
      setLoading(false);
    }
  }, [daoPolicy, reset]);

  const changeDurationDays = (newDurationDays) => {
    setValue("durationDays", parseFloat(newDurationDays) || 0, {
      shouldDirty: true,
    });
  };

  const cancelChangeRequest = () => {
    setShowAffectedProposalsModal(false);
    reset({ durationDays: currentDurationDays });
  };

  const findAffectedProposals = (callback) => {
    setProposalsThatWillExpire([]);
    setProposalsThatWillBeActive([]);
    setOtherPendingRequests([]);
    setLoadingAffectedProposals(true);

    const fetchProposals = async () => {
      try {
        const now = Date.now();
        let fromDate;

        if (durationDays < currentDurationDays) {
          // User is decreasing duration - fetch proposals from (today - new duration days)
          fromDate = now - durationDays * 24 * 60 * 60 * 1000;
        } else if (durationDays > currentDurationDays) {
          // User is increasing duration - fetch proposals from (today - current duration days)
          fromDate = now - currentDurationDays * 24 * 60 * 60 * 1000;
        } else {
          callback(false);
          return;
        }

        // Fetch proposals using indexer
        const result = await getProposalsFromIndexer({
          daoId: treasuryDaoID,
          page: 0,
          pageSize: 100,
          statuses: ["InProgress"],
          sortDirection: "desc",
          filters: {
            created_date: {
              values: [fromDate, null],
              include: true,
            },
          },
        });

        const proposals = result.proposals || [];
        const newExpire = [];
        const newActive = [];
        const newOther = [];

        for (const proposal of proposals) {
          const submissionTimeMillis = Number(
            proposal.submission_time?.substr(
              0,
              proposal.submission_time.length - 6
            ) || 0
          );

          if (!submissionTimeMillis) continue;

          const currentExpiryTime =
            submissionTimeMillis + 24 * 60 * 60 * 1000 * currentDurationDays;
          const newExpiryTime =
            submissionTimeMillis + 24 * 60 * 60 * 1000 * durationDays;

          if (durationDays < currentDurationDays) {
            // Proposals that will expire
            if (currentExpiryTime >= now && newExpiryTime < now) {
              newExpire.push({
                currentExpiryTime,
                newExpiryTime,
                submissionTimeMillis,
                ...proposal,
              });
            } else if (newExpiryTime > now) {
              newOther.push({
                currentExpiryTime,
                newExpiryTime,
                submissionTimeMillis,
                ...proposal,
              });
            }
          } else {
            // Proposals that will be active
            if (currentExpiryTime <= now && newExpiryTime > now) {
              newActive.push({
                currentExpiryTime,
                newExpiryTime,
                submissionTimeMillis,
                ...proposal,
              });
            } else if (newExpiryTime > now) {
              newOther.push({
                currentExpiryTime,
                newExpiryTime,
                submissionTimeMillis,
                ...proposal,
              });
            }
          }
        }

        setProposalsThatWillExpire(newExpire);
        setProposalsThatWillBeActive(newActive);
        setOtherPendingRequests(newOther);
        callback(
          newExpire.length > 0 || newActive.length > 0 || newOther.length > 0
        );
      } catch (error) {
        logger.error("Error finding affected proposals:", error);
        callback(false);
      } finally {
        setLoadingAffectedProposals(false);
      }
    };

    fetchProposals();
  };

  const submitVotePolicyChangeTxn = async () => {
    setShowAffectedProposalsModal(false);
    setTxnCreated(true);

    const description = {
      title: "Update policy - Voting Duration",
      summary: `${accountId} requested to change voting duration from ${currentDurationDays} to ${durationDays}.`,
    };

    try {
      const result = await signAndSendTransactions({
        transactions: [
          {
            receiverId: treasuryDaoID,
            signerId: accountId,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "add_proposal",
                  args: {
                    proposal: {
                      description: encodeToMarkdown(description),
                      kind: {
                        ChangePolicyUpdateParameters: {
                          parameters: {
                            proposal_period:
                              (60 * 60 * 24 * durationDays).toString() +
                              "000000000",
                          },
                        },
                      },
                    },
                  },
                  gas: 200000000000000,
                  deposit,
                },
              },
            ],
          },
        ],
      });

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        refetchLastProposalId().then((id) => {
          setTxnCreated(false);
          setShowToastStatus("ProposalAdded");
          reset({ durationDays: currentDurationDays });
        });
      }
    } catch (error) {
      logger.error("Error submitting proposal:", error);
      setTxnCreated(false);
      setShowToastStatus("ErrorAddingProposal");
    }
  };

  const submitChangeRequest = () => {
    findAffectedProposals((shouldShowAffectedProposalsModal) => {
      if (shouldShowAffectedProposalsModal) {
        setShowAffectedProposalsModal(true);
        return;
      }
      submitVotePolicyChangeTxn();
    });
  };

  const isInitialValues = () => {
    return durationDays === currentDurationDays;
  };

  const showImpactedRequests =
    proposalsThatWillExpire.length > 0 || proposalsThatWillBeActive.length > 0;

  if (loading || !daoPolicy) {
    return (
      <div className="card rounded-4 py-3" style={{ maxWidth: "50rem" }}>
        <div className="card-title px-3 pb-3">Voting Duration</div>
        <div className="px-3 py-1">
          <Skeleton className="w-100 rounded-3" style={{ height: "200px" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="text-color" style={{ maxWidth: "50rem" }}>
      <TransactionLoader
        showInProgress={isTxnCreated}
        cancelTxn={() => setTxnCreated(false)}
      />
      {showToastStatus && (
        <div className="toast-container position-fixed bottom-0 end-0 p-3">
          <div className="toast show">
            <div className="toast-header px-2">
              <strong className="me-auto">Just Now</strong>
              <i
                className="bi bi-x-lg h6 mb-0 cursor-pointer"
                onClick={() => setShowToastStatus("")}
              ></i>
            </div>
            <div className="toast-body">
              {showToastStatus === "ProposalAdded" ? (
                <div className="d-flex align-items-center gap-3">
                  <i className="bi bi-check2 h3 mb-0 success-icon"></i>
                  <div>
                    <div>Voting duration change request submitted.</div>
                    {lastProposalId && (
                      <a
                        href="#"
                        className="text-underline cursor-pointer"
                        onClick={() => {
                          const daoIdPart = treasuryDaoID.split(".")[0];
                          router.push(
                            `/${daoIdPart}/settings?id=${lastProposalId}`
                          );
                        }}
                      >
                        View it
                      </a>
                    )}
                  </div>
                </div>
              ) : showToastStatus === "ErrorAddingProposal" ? (
                <div className="d-flex align-items-center gap-3">
                  <i className="bi bi-exclamation-triangle h3 mb-0 text-danger"></i>
                  <div>Failed to submit proposal. Please try again.</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showAffectedProposalsModal && (
        <Modal
          heading="Impact of changing voting duration"
          isOpen={showAffectedProposalsModal}
          onClose={cancelChangeRequest}
          size="lg"
        >
          <div>
            <p className="mb-3">
              You are about to update the voting duration. This will affect the
              following existing requests.
            </p>

            {loadingAffectedProposals ? (
              <Skeleton width="100%" height="200px" borderRadius="12px" />
            ) : (
              <WarningTable
                warningText={
                  <ul className="mb-0">
                    {otherPendingRequests.length > 0 && (
                      <li>
                        <b>{otherPendingRequests.length} pending requests</b>{" "}
                        will now follow the new voting duration policy.
                      </li>
                    )}
                    {proposalsThatWillExpire.length > 0 && (
                      <li>
                        <b>{proposalsThatWillExpire.length} active requests</b>{" "}
                        under the old voting duration will move to the
                        "Archived" tab and close for voting. These requests were
                        created outside the new voting period and are no longer
                        considered active.
                      </li>
                    )}
                    {proposalsThatWillBeActive.length > 0 && (
                      <li>
                        <b>
                          {proposalsThatWillBeActive.length} expired requests
                        </b>{" "}
                        under the old voting duration will move back to the
                        "Pending Requests" tab and reopen for voting. These
                        requests were created within the new voting period and
                        are no longer considered expired.
                      </li>
                    )}
                    {proposalsThatWillBeActive.length > 0 && (
                      <li className="mt-2">
                        If you do not want expired proposals to be open for
                        voting again, you may need to delete them.
                      </li>
                    )}
                  </ul>
                }
                tableProps={
                  showImpactedRequests
                    ? [
                        {
                          proposals: proposalsThatWillExpire,
                          title: "Proposals that will expire",
                          testId: "proposals-that-will-expire",
                        },
                        {
                          proposals: proposalsThatWillBeActive,
                          title: "Proposals that will be active",
                          testId: "proposals-that-will-be-active",
                        },
                      ]
                    : []
                }
                includeExpiryDate={true}
              />
            )}

            <div className="d-flex gap-2 justify-content-end mt-3">
              <button
                className="btn btn-outline-secondary"
                onClick={cancelChangeRequest}
              >
                Cancel
              </button>
              <button
                className="btn theme-btn"
                onClick={() => {
                  submitVotePolicyChangeTxn();
                }}
              >
                Yes, proceed
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="card rounded-4 py-3">
        <div className="card-title px-3 pb-3">Voting Duration</div>
        <div className="px-3 py-1 d-flex flex-column gap-2">
          <div className="fw-semi-bold text-color">
            Set the number of days a vote is active. A decision expires if
            voting is not completed within this period.
          </div>
          <div>
            <label htmlFor="votingDuration" className="form-label">
              Number of days
            </label>
            <input
              id="votingDuration"
              type="number"
              className="form-control"
              placeholder="Enter voting duration days"
              value={durationDays}
              onChange={(e) => changeDurationDays(e.target.value)}
              disabled={!hasCreatePermission}
            />
          </div>

          {hasCreatePermission && (
            <div className="d-flex mt-2 gap-3 justify-content-end">
              <button
                className="btn btn-outline-secondary shadow-none"
                onClick={cancelChangeRequest}
                disabled={isInitialValues() || isTxnCreated}
              >
                Cancel
              </button>
              <InsufficientBannerModal
                ActionButton={() => (
                  <button
                    className="btn theme-btn"
                    disabled={
                      isInitialValues() ||
                      loadingAffectedProposals ||
                      !hasCreatePermission ||
                      isTxnCreated
                    }
                  >
                    Submit Request
                  </button>
                )}
                checkForDeposit={true}
                callbackAction={submitChangeRequest}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VotingDurationPage;

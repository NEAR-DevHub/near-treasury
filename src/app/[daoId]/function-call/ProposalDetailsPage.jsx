"use client";

import { useState, useEffect } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { useProposals } from "@/hooks/useProposals";
import { Near } from "@/api/near";
import { formatBase64ArgsPretty } from "@/helpers/daoHelpers";
import Big from "big.js";
import ProposalDetails from "@/components/proposals/ProposalDetails";
import VoteActions from "@/components/proposals/VoteActions";
import Profile from "@/components/ui/Profile";

const ProposalDetailsPage = ({
  id,
  isCompactVersion,
  onClose,
  setVoteProposalId,
  setToastStatus,
  currentTab,
}) => {
  const { accountId } = useNearWallet();
  const {
    daoId: treasuryDaoID,
    daoPolicy,
    getApproversAndThreshold,
  } = useDao();
  const { invalidateCategory } = useProposals({
    daoId: treasuryDaoID,
    proposalType: ["FunctionCall"],
    enabled: false,
  });

  const [proposalData, setProposalData] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);

  const callApproversGroup = getApproversAndThreshold("call");
  const deleteGroup = getApproversAndThreshold("call", true);

  const hasVotingPermission = (
    callApproversGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  const requiredVotes = callApproversGroup?.threshold || 0;
  const proposalPeriod = daoPolicy?.proposal_period || 0;

  useEffect(() => {
    const fetchProposalData = async () => {
      if (proposalPeriod && !proposalData) {
        try {
          const item = await Near.view(treasuryDaoID, "get_proposal", {
            id: parseInt(id),
          });

          let status = item.status;
          if (status === "InProgress") {
            const endTime = Big(item.submission_time ?? "0")
              .plus(proposalPeriod ?? "0")
              .toFixed();
            const timestampInMilliseconds = Big(endTime).div(Big(1_000_000));
            const currentTimeInMilliseconds = Date.now();
            if (Big(timestampInMilliseconds).lt(currentTimeInMilliseconds)) {
              status = "Expired";
            }
          }

          setProposalData({
            id: item.id,
            proposer: item.proposer,
            votes: item.votes,
            submissionTime: item.submission_time,
            notes: item.description,
            status,
            kind: item.kind,
            proposal: item,
          });
        } catch (error) {
          console.error("Error fetching proposal:", error);
          setIsDeleted(true);
        }
      }
    };

    fetchProposalData();
  }, [id, proposalPeriod, proposalData, treasuryDaoID]);

  // Clear proposal data when id changes
  useEffect(() => {
    if (proposalData && proposalData.id !== id) {
      setProposalData(null);
      setIsDeleted(false);
    }
  }, [id, proposalData]);

  function refreshData() {
    setProposalData(null);
    // Invalidate proposals cache
    invalidateCategory();
  }

  function updateVoteSuccess(status, proposalId) {
    setVoteProposalId?.(proposalId);
    setToastStatus?.(status);
    refreshData();
  }

  async function checkProposalStatus(proposalId) {
    try {
      const result = await Near.view(treasuryDaoID, "get_proposal", {
        id: proposalId,
      });
      if (result) {
        setProposalData(result);
        if (result.status !== "InProgress") {
          updateVoteSuccess(result.status, proposalId);
        }
      }
    } catch (error) {
      console.error("Error checking proposal status:", error);
    }
  }

  // Convert gas units to Tgas
  function formatGas(gasUnits) {
    if (!gasUnits) return "0";
    try {
      // Convert from gas units to Tgas (divide by 10^12)
      const tgas = Big(gasUnits).div(Big(10).pow(12));
      return tgas.toFixed();
    } catch (e) {
      return gasUnits;
    }
  }

  // Convert yoctoNEAR to NEAR
  function formatDeposit(yoctoNEAR) {
    if (!yoctoNEAR || yoctoNEAR === "0") return "0";
    try {
      // Convert from yoctoNEAR to NEAR (divide by 10^24)
      const near = Big(yoctoNEAR).div(Big(10).pow(24));
      const result = near.toFixed();
      // If the result is 0 but we had a non-zero input (very small amounts like 1 yoctoNEAR)
      if (result === "0" && yoctoNEAR !== "0") {
        // For very small amounts, show in yoctoNEAR
        return `${yoctoNEAR} yoctoNEAR`;
      }
      return `${result} NEAR`;
    } catch (e) {
      return `${yoctoNEAR} yoctoNEAR`;
    }
  }

  return (
    <ProposalDetails
      currentTab={currentTab}
      proposalPeriod={proposalPeriod}
      page="function-call"
      VoteActions={
        (hasVotingPermission || hasDeletePermission) &&
        proposalData?.status === "InProgress" ? (
          <VoteActions
            votes={proposalData?.votes}
            proposalId={proposalData?.id}
            hasDeletePermission={hasDeletePermission}
            hasVotingPermission={hasVotingPermission}
            proposalCreator={proposalData?.proposer}
            checkProposalStatus={() => checkProposalStatus(proposalData?.id)}
            isProposalDetailsPage={true}
            proposal={proposalData?.proposal}
          />
        ) : null
      }
      ProposalContent={
        <div className="card card-body d-flex flex-column gap-2">
          <div className="d-flex flex-column gap-3">
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="proposal-label">Contract ID</label>
              <div className="text-secondary text-md">
                <Profile
                  accountId={proposalData?.kind?.FunctionCall?.receiver_id}
                />
              </div>
            </div>

            {proposalData?.kind?.FunctionCall?.actions &&
              proposalData.kind.FunctionCall.actions.length > 0 && (
                <div className="d-flex flex-column gap-3">
                  {proposalData.kind.FunctionCall.actions.map(
                    (action, index) => (
                      <div
                        key={index}
                        className="border rounded-3 overflow-hidden"
                      >
                        <div
                          className="d-flex justify-content-between align-items-center px-3 py-2"
                          style={{ backgroundColor: "var(--bg-system-color)" }}
                        >
                          <h6 className="mb-0">Action {index + 1}</h6>
                        </div>
                        <div className="d-flex flex-column gap-2 p-2">
                          <div className="d-flex flex-column gap-2 mt-1">
                            <label className="proposal-label">
                              Method Name
                            </label>
                            <div>{action.method_name}</div>
                          </div>

                          <div className="d-flex flex-column gap-2 mt-1">
                            {" "}
                            <label className="border-top proposal-label">
                              Arguments
                            </label>
                            {action.args ? (
                              <pre className="mt-1 p-2 rounded small code-block mb-1">
                                {formatBase64ArgsPretty(action.args)}
                              </pre>
                            ) : (
                              <div>-</div>
                            )}
                          </div>

                          <div className="border-top pt-2">
                            <div className="row">
                              <div className="col-md-6">
                                <div className="d-flex flex-column gap-2">
                                  <label className="proposal-label">Gas</label>
                                  <div>{formatGas(action.gas)} Tgas</div>
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="d-flex flex-column gap-2">
                                  <label className="proposal-label">
                                    Deposit
                                  </label>
                                  <div>{formatDeposit(action.deposit)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
          </div>
        </div>
      }
      proposalData={proposalData}
      isDeleted={isDeleted}
      isCompactVersion={isCompactVersion}
      approversGroup={callApproversGroup}
      proposalStatusLabel={{
        approved: "Function Call Request Approved",
        rejected: "Function Call Request Rejected",
        deleted: "Function Call Request Deleted",
        failed: "Function Call Request Failed",
        expired: "Function Call Request Expired",
      }}
      onClose={onClose}
    />
  );
};

export default ProposalDetailsPage;

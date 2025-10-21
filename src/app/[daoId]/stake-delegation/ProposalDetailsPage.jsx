"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { Near } from "@/api/near";
import { decodeBase64, decodeProposalDescription } from "@/helpers/daoHelpers";
import Big from "big.js";
import ProposalDetails from "@/components/proposals/ProposalDetails";
import VoteActions from "@/components/proposals/VoteActions";
import Profile from "@/components/ui/Profile";
import TokenAmount from "@/components/proposals/TokenAmount";
import Type from "./Type";
import Validator from "./Validator";

const RequestType = {
  STAKE: "Stake",
  UNSTAKE: "Unstake",
  WITHDRAW: "Withdraw",
  WHITELIST: "Whitelist",
};

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
    lockupContract,
    daoPolicy,
    lockupStakedPoolId,
    getApproversAndThreshold,
  } = useDao();
  const queryClient = useQueryClient();

  const [proposalData, setProposalData] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);

  const functionCallApproversGroup = getApproversAndThreshold("call");
  const deleteGroup = getApproversAndThreshold("call", true);

  const hasVotingPermission = (
    functionCallApproversGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  const proposalPeriod = daoPolicy?.proposal_period;

  useEffect(() => {
    const fetchProposalData = async () => {
      if (proposalPeriod && !proposalData) {
        try {
          const item = await Near.view(treasuryDaoID, "get_proposal", {
            id: parseInt(id),
          });

          const notes = decodeProposalDescription("notes", item.description);
          const withdrawAmount = decodeProposalDescription(
            "amount",
            item.description
          );
          const customNotes = decodeProposalDescription(
            "customNotes",
            item.description
          );
          const args = item?.kind?.FunctionCall;
          const action = args?.actions?.[0];
          const isStakeRequest = action?.method_name === "deposit_and_stake";
          const receiverAccount = args?.receiver_id;

          let validatorAccount = receiverAccount;
          if (validatorAccount === lockupContract) {
            const stakingPoolId = decodeBase64(
              action?.args
            )?.staking_pool_account_id;
            validatorAccount = stakingPoolId || lockupStakedPoolId || "";
          }

          let amount = action?.deposit;
          if (!isStakeRequest || receiverAccount?.includes("lockup.near")) {
            let value = decodeBase64(action?.args);
            amount = value?.amount;
          }

          const isWithdrawRequest =
            action?.method_name === "withdraw_all_from_staking_pool" ||
            action?.method_name === "withdraw_all";

          if (isWithdrawRequest) {
            amount = withdrawAmount || 0;
          }

          const isLockup = receiverAccount === lockupContract;
          const treasuryWallet = isLockup ? lockupContract : treasuryDaoID;

          // Check if proposal is expired
          let status = item.status;
          if (status === "InProgress") {
            const endTime = Big(item.submission_time ?? "0")
              .plus(proposalPeriod ?? "0")
              .toFixed();
            const timestampInMilliseconds = Big(endTime) / Big(1_000_000);
            const currentTimeInMilliseconds = Date.now();
            if (Big(timestampInMilliseconds).lt(currentTimeInMilliseconds)) {
              status = "Expired";
            }
          }

          // Determine request type
          let requestType;
          if (isStakeRequest) {
            requestType = RequestType.STAKE;
          } else if (isWithdrawRequest) {
            requestType = RequestType.WITHDRAW;
          } else if (action?.method_name === "select_staking_pool") {
            requestType = RequestType.WHITELIST;
          } else {
            requestType = RequestType.UNSTAKE;
          }

          setProposalData({
            id: item.id,
            proposer: item.proposer,
            votes: item.votes,
            amount,
            submissionTime: item.submission_time,
            validatorAccount,
            action,
            notes: customNotes || notes || "-",
            requestType,
            treasuryWallet,
            status,
            proposal: item,
          });
        } catch (error) {
          console.error("Error fetching proposal:", error);
          setIsDeleted(true);
        }
      }
    };

    fetchProposalData();
  }, [
    id,
    proposalPeriod,
    proposalData,
    treasuryDaoID,
    lockupContract,
    lockupStakedPoolId,
  ]);

  // Reset proposal data when ID changes
  useEffect(() => {
    if (proposalData && proposalData.id !== id) {
      setProposalData(null);
    }
  }, [id, proposalData]);

  function refreshData() {
    setProposalData(null);
    // Invalidate all proposal-related queries
    queryClient.invalidateQueries({
      queryKey: ["proposals", treasuryDaoID, "stake-delegation"],
    });
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
      updateVoteSuccess(result.status, proposalId);
    } catch (error) {
      // deleted request (thus proposal won't exist)
      updateVoteSuccess("Removed", proposalId);
    }
  }

  const requiredVotes = functionCallApproversGroup?.requiredVotes || 0;

  return (
    <ProposalDetails
      {...{
        id,
        isCompactVersion,
        proposalPeriod,
        page: "stake-delegation",
        VoteActions:
          (hasVotingPermission || hasDeletePermission) &&
          proposalData?.status === "InProgress" ? (
            <VoteActions
              votes={proposalData?.votes}
              proposalId={proposalData?.id}
              hasDeletePermission={hasDeletePermission}
              hasVotingPermission={hasVotingPermission}
              proposalCreator={proposalData?.proposer}
              proposal={proposalData?.proposal}
              checkProposalStatus={() => checkProposalStatus(proposalData?.id)}
              avoidCheckForBalance={true}
              isProposalDetailsPage={true}
            />
          ) : null,
        ProposalContent: proposalData && (
          <div className="card card-body d-flex flex-column gap-2">
            {/* Request Type */}
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="proposal-label">Request Type</label>
              <div style={{ width: "fit-content" }}>
                <Type type={proposalData?.action?.method_name} />
              </div>
            </div>

            {/* Amount */}
            {proposalData.amount && proposalData.amount !== 0 && (
              <div className="d-flex flex-column gap-2 mt-1">
                <label className="border-top proposal-label">Amount</label>
                <h5 className="mb-0" style={{ width: "fit-content" }}>
                  <TokenAmount
                    amountWithoutDecimals={proposalData.amount}
                    address=""
                    showUSDValue={false}
                  />
                </h5>
              </div>
            )}

            {/* Validator */}
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">Validator</label>
              <Validator validatorId={proposalData?.validatorAccount} />
            </div>

            {/* Treasury Wallet */}
            {lockupContract && (
              <div className="d-flex flex-column gap-2 mt-1">
                <label className="border-top proposal-label">
                  Treasury Wallet
                </label>
                <Profile
                  accountId={proposalData?.treasuryWallet}
                  showKYC={false}
                  displayImage={false}
                  displayName={false}
                />
              </div>
            )}
          </div>
        ),
      }}
      proposalData={proposalData}
      isDeleted={isDeleted}
      isCompactVersion={isCompactVersion}
      approversGroup={functionCallApproversGroup}
      deleteGroup={deleteGroup}
      proposalStatusLabel={{
        approved: `${proposalData?.requestType} Request Executed`,
        rejected: `${proposalData?.requestType} Request Rejected`,
        deleted: `${proposalData?.requestType} Request Deleted`,
        failed: `${proposalData?.requestType} Request Failed`,
        expired: `${proposalData?.requestType} Request Expired`,
      }}
      checkProposalStatus={checkProposalStatus}
      onClose={onClose}
    />
  );
};

export default ProposalDetailsPage;

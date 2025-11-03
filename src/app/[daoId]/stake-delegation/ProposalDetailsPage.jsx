"use client";

import { useState, useEffect } from "react";
import { useProposal } from "@/hooks/useProposal";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
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

const ProposalDetailsPage = ({ id, isCompactVersion, onClose, currentTab }) => {
  const { accountId } = useNearWallet();
  const {
    daoId: treasuryDaoID,
    lockupContract,
    daoPolicy,
    lockupStakedPoolId,
    getApproversAndThreshold,
  } = useDao();

  const { proposal: rawProposal, isError: isDeleted } = useProposal(id);

  const [proposalData, setProposalData] = useState(null);

  const functionCallApproversGroup = getApproversAndThreshold("call");
  const deleteGroup = getApproversAndThreshold("call", true);

  const hasVotingPermission = (
    functionCallApproversGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  const proposalPeriod = daoPolicy?.proposal_period;

  // Process raw proposal data when it changes
  useEffect(() => {
    const processProposalData = async () => {
      if (!rawProposal || !proposalPeriod) return;

      try {
        const item = rawProposal;

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
          notes: customNotes || notes,
          requestType,
          treasuryWallet,
          status,
          proposal: item,
        });
      } catch (error) {
        console.error("Error processing proposal data:", error);
      }
    };

    processProposalData();
  }, [
    rawProposal,
    proposalPeriod,
    lockupContract,
    lockupStakedPoolId,
    treasuryDaoID,
  ]);

  return (
    <ProposalDetails
      proposalData={proposalData}
      isDeleted={isDeleted}
      currentTab={currentTab}
      proposalPeriod={proposalPeriod}
      page="stake-delegation"
      isCompactVersion={isCompactVersion}
      approversGroup={functionCallApproversGroup}
      proposalStatusLabel={{
        approved: `${proposalData?.requestType} Request Executed`,
        rejected: `${proposalData?.requestType} Request Rejected`,
        deleted: `${proposalData?.requestType} Request Deleted`,
        failed: `${proposalData?.requestType} Request Failed`,
        expired: `${proposalData?.requestType} Request Expired`,
      }}
      onClose={onClose}
      VoteActions={
        (hasVotingPermission || hasDeletePermission) &&
        proposalData?.status === "InProgress" ? (
          <VoteActions
            votes={proposalData?.votes}
            proposalId={proposalData?.id}
            hasDeletePermission={hasDeletePermission}
            hasVotingPermission={hasVotingPermission}
            proposalCreator={proposalData?.proposer}
            proposal={proposalData?.proposal}
            context="stake"
            avoidCheckForBalance={true}
            isProposalDetailsPage={true}
          />
        ) : null
      }
      ProposalContent={
        proposalData && (
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
                <TokenAmount
                  amountWithoutDecimals={proposalData.amount}
                  address=""
                  showUSDValue={false}
                  isProposalDetails={true}
                />
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
        )
      }
    />
  );
};

export default ProposalDetailsPage;

"use client";

import { useState, useEffect } from "react";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import { Near } from "@/api/near";
import {
  decodeBase64,
  decodeProposalDescription,
  formatSubmissionTimeStamp,
} from "@/helpers/daoHelpers";
import VoteActions from "@/components/proposals/VoteActions";
import HistoryStatus from "@/components/proposals/HistoryStatus";
import TokenAmount from "@/components/proposals/TokenAmount";
import Profile from "@/components/ui/Profile";
import Approvers from "@/components/proposals/Approvers";
import Votes from "@/components/proposals/Votes";
import Skeleton from "@/components/ui/Skeleton";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";
import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";
import Validator from "./Validator";
import Type from "./Type";

const StakeDelegationTable = ({
  proposals = [],
  loading = false,
  isPendingRequests = false,
  highlightProposalId = null,
  selectedProposalDetailsId = null,
  onSelectRequest = () => {},
  refreshTableData = () => {},
  setToastStatus = () => {},
  setVoteProposalId = () => {},
  handleSortClick = () => {},
  sortDirection = "desc",
}) => {
  const {
    daoId: treasuryDaoID,
    daoPolicy,
    lockupContract,
    lockupStakedPoolId,
    getApproversAndThreshold,
  } = useDao();
  const { accountId } = useNearWallet();

  // Get approvers and threshold from context
  const functionCallApproversGroup = getApproversAndThreshold("call");
  const deleteGroup = getApproversAndThreshold("call", true);

  const hasVotingPermission = (
    functionCallApproversGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  // Filter proposals based on showAfterProposalIdApproved for pending requests
  const visibleProposals = isPendingRequests
    ? proposals.filter((proposal) => {
        const showAfterProposalIdApproved = decodeProposalDescription(
          "showAfterProposalIdApproved",
          proposal.description
        );

        if (showAfterProposalIdApproved) {
          return !proposals.some(
            (p) => p.id === parseInt(showAfterProposalIdApproved)
          );
        }
        return true;
      })
    : proposals;

  // Get column visibility from localStorage (same pattern as payments table)
  const getColumnsVisibility = () => {
    try {
      const stored = localStorage.getItem(
        LOCAL_STORAGE_KEYS.COLUMNS_VISIBILITY
      );
      if (!stored) return [];
      const allSettings = JSON.parse(stored);
      return allSettings["stake-delegation"] || [];
    } catch (error) {
      return [];
    }
  };

  const [columnsVisibility, setColumnsVisibility] = useState(
    getColumnsVisibility()
  );

  // Listen for settings changes
  useEffect(() => {
    setColumnsVisibility(getColumnsVisibility());

    // Listen for custom event for same-tab updates
    const handleCustomEvent = () => {
      setColumnsVisibility(getColumnsVisibility());
    };

    window.addEventListener("columnsVisibilityChanged", handleCustomEvent);

    return () => {
      window.removeEventListener("columnsVisibilityChanged", handleCustomEvent);
    };
  }, []);

  function isVisible(column) {
    const found = columnsVisibility.find((i) => i.title === column);
    return found && found.show === false ? "d-none" : "";
  }

  function updateVoteSuccess(status, proposalId) {
    setToastStatus(status);
    setVoteProposalId(proposalId);
    onSelectRequest(null);
    refreshTableData();
  }

  function checkProposalStatus(proposalId) {
    Near.view(treasuryDaoID, "get_proposal", {
      id: proposalId,
    })
      .then((result) => {
        updateVoteSuccess(result.status, proposalId);
      })
      .catch(() => {
        // deleted request (thus proposal won't exist)
        updateVoteSuccess("Removed", proposalId);
      });
  }

  const RowsSkeleton = ({ numberOfCols, numberOfRows, numberOfHiddenRows }) => {
    const Row = ({ hidden }) => (
      <tr>
        {[...Array(numberOfCols)].map((_, i) => (
          <td key={i}>
            {hidden ? (
              <div style={{ height: "30px", width: "100%" }} />
            ) : (
              <Skeleton
                style={{ height: "30px", width: "100%" }}
                className="rounded-3"
              />
            )}
          </td>
        ))}
      </tr>
    );
    return (
      <>
        {[...Array(numberOfRows)].map((_, i) => (
          <Row key={"row-" + i} />
        ))}
        {[...Array(numberOfHiddenRows)].map((_, i) => (
          <Row key={"hidden-" + i} hidden />
        ))}
      </>
    );
  };

  const requiredVotes = functionCallApproversGroup?.requiredVotes || 0;
  const hideApproversCol = isPendingRequests && requiredVotes === 1;
  const proposalPeriod = daoPolicy?.proposal_period;

  const hasOneDeleteIcon =
    isPendingRequests &&
    hasDeletePermission &&
    (proposals ?? []).find(
      (i) =>
        i.proposer === accountId &&
        !Object.keys(i.votes ?? {}).includes(accountId)
    );

  const ProposalsComponent = () => {
    return (
      <tbody style={{ overflowX: "auto" }}>
        {visibleProposals?.map((item) => {
          const notes = decodeProposalDescription("notes", item.description);
          const withdrawAmount = decodeProposalDescription(
            "amount",
            item.description
          );
          const args = item?.kind?.FunctionCall;
          const action = args?.actions?.[0];
          const isStakeRequest = action?.method_name === "deposit_and_stake";
          const customNotes = decodeProposalDescription(
            "customNotes",
            item.description
          );
          const receiverAccount = args?.receiver_id;
          let validatorAccount = receiverAccount;

          if (validatorAccount === lockupContract) {
            validatorAccount =
              lockupStakedPoolId ??
              decodeBase64(action?.args)?.staking_pool_account_id ??
              "";
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

          // Ensure amount is valid
          amount = amount || "0";

          const isLockup = receiverAccount === lockupContract;
          const treasuryWallet = isLockup ? lockupContract : treasuryDaoID;
          return (
            <tr
              key={item.id}
              data-testid={"proposal-request-#" + item.id}
              className={`cursor-pointer proposal-row ${
                highlightProposalId === item.id ||
                selectedProposalDetailsId === item.id
                  ? "bg-highlight"
                  : ""
              }`}
              onClick={() => onSelectRequest(item.id)}
              style={{ cursor: "pointer" }}
            >
              <td className="fw-semi-bold px-3">{item.id}</td>
              <td className={isVisible("Created Date")}>
                <DateTimeDisplay
                  timestamp={item.submission_time / 1e6}
                  format="date-time"
                />
              </td>
              {!isPendingRequests && (
                <td>
                  <HistoryStatus status={item.status} isVoteStatus={false} />
                </td>
              )}
              <td className={`${isVisible("Type")} text-center`}>
                <Type type={action?.method_name} />
              </td>
              <td className={`${isVisible("Amount")} text-end`}>
                <TokenAmount
                  amountWithoutDecimals={amount}
                  address=""
                  showUSDValue={false}
                />
              </td>
              {lockupContract && (
                <td className="text-start">
                  <div className="text-secondary">
                    {isLockup ? "Lockup" : "Sputnik DAO"}
                  </div>
                </td>
              )}
              <td className={isVisible("Validator")}>
                <Validator validatorId={validatorAccount} />
              </td>
              <td className={`text-center ${isVisible("Creator")}`}>
                <div className="d-inline-block">
                  <Profile
                    accountId={item.proposer}
                    showKYC={false}
                    displayImage={false}
                    displayName={false}
                  />
                </div>
              </td>
              <td
                className={`text-sm text-start ${isVisible("Notes")} ${
                  customNotes ? "text-warning" : ""
                }`}
              >
                {notes || customNotes ? (
                  <div className="markdown-content">{customNotes || notes}</div>
                ) : (
                  "-"
                )}
              </td>
              {isPendingRequests && (
                <td className={`${isVisible("Required Votes")} text-center`}>
                  {requiredVotes}
                </td>
              )}
              {isPendingRequests && (
                <td className={`${isVisible("Votes")} text-center`}>
                  <Votes
                    votes={item.votes}
                    requiredVotes={requiredVotes}
                    isInProgress={true}
                  />
                </td>
              )}
              <td
                className={`${isVisible("Approvers")} text-center ${
                  hideApproversCol ? "d-none" : ""
                }`}
                style={{ minWidth: 100 }}
              >
                <Approvers
                  votes={item.votes}
                  approversGroup={functionCallApproversGroup?.approverAccounts}
                />
              </td>
              {isPendingRequests && (
                <td
                  className={`${isVisible("Expiring Date")} text-start`}
                  style={{ minWidth: 150 }}
                >
                  {formatSubmissionTimeStamp(
                    item.submission_time,
                    proposalPeriod
                  )}
                </td>
              )}
              {isPendingRequests &&
                (hasVotingPermission || hasDeletePermission) && (
                  <td className="text-end" onClick={(e) => e.stopPropagation()}>
                    <VoteActions
                      votes={item.votes}
                      proposalId={item.id}
                      proposal={item}
                      proposalCreator={item.proposer}
                      hasVotingPermission={hasVotingPermission}
                      hasDeletePermission={hasDeletePermission}
                      checkProposalStatus={() => checkProposalStatus(item.id)}
                      avoidCheckForBalance={true}
                      isWithdrawRequest={isWithdrawRequest}
                      validatorAccount={validatorAccount}
                      treasuryWallet={treasuryWallet}
                      hasOneDeleteIcon={hasOneDeleteIcon}
                    />
                  </td>
                )}
            </tr>
          );
        })}
      </tbody>
    );
  };

  return (
    <div
      className="h-100 w-100"
      style={{ overflowX: "auto", fontSize: 13, minHeight: "60vh" }}
    >
      <table className="table">
        <thead>
          <tr className="text-secondary">
            <td className="px-3">#</td>
            <td
              className={`${isVisible("Created Date")} cursor-pointer`}
              onClick={handleSortClick}
              style={{ color: "var(--text-color)" }}
            >
              Created Date
              <span style={{ marginLeft: 4 }}>
                {sortDirection === "desc" ? (
                  <i className="bi bi-arrow-down"></i>
                ) : (
                  <i className="bi bi-arrow-up"></i>
                )}
              </span>
            </td>
            {!isPendingRequests && <td className="text-center">Status</td>}
            <td className={`${isVisible("Type")} text-center`}>Type</td>
            <td className={`${isVisible("Amount")} text-end`}>Amount</td>
            {lockupContract && <td className="text-start">Treasury Wallet</td>}
            <td className={isVisible("Validator")}>Validator</td>
            <td className={`text-center ${isVisible("Creator")}`}>
              Created by
            </td>
            <td className={`${isVisible("Notes")} text-start`}>Notes</td>
            {isPendingRequests && (
              <td className={`${isVisible("Required Votes")} text-center`}>
                Required Votes
              </td>
            )}
            {isPendingRequests && (
              <td className={`${isVisible("Votes")} text-center`}>Votes</td>
            )}
            <td
              className={`${isVisible("Approvers")} text-center ${
                hideApproversCol ? "d-none" : ""
              }`}
            >
              Approvers
            </td>
            {isPendingRequests && (
              <td className={`${isVisible("Expiring Date")} text-start`}>
                Expiring Date
              </td>
            )}
            {isPendingRequests &&
              (hasVotingPermission || hasDeletePermission) && (
                <td className="text-end">Actions</td>
              )}
          </tr>
        </thead>

        {loading === true ||
        proposals === null ||
        functionCallApproversGroup === null ||
        daoPolicy === null ||
        !Array.isArray(proposals) ? (
          <tbody>
            <RowsSkeleton
              numberOfCols={isPendingRequests ? 11 : 9}
              numberOfRows={3}
              numberOfHiddenRows={4}
            />
          </tbody>
        ) : !Array.isArray(visibleProposals) ||
          visibleProposals.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={14}
                rowSpan={10}
                className="text-center align-middle"
              >
                {isPendingRequests ? (
                  <>
                    <h4>No Stake Delegation Requests Found</h4>
                    <h6>There are currently no stake delegation requests</h6>
                  </>
                ) : (
                  <>
                    <h4>No History Requests Found</h4>
                    <h6>There are currently no history requests</h6>
                  </>
                )}
              </td>
            </tr>
            {[...Array(8)].map((_, index) => (
              <tr key={index}></tr>
            ))}
          </tbody>
        ) : (
          <ProposalsComponent />
        )}
      </table>
    </div>
  );
};

export default StakeDelegationTable;

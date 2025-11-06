"use client";

import { useState, useEffect } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";
import {
  decodeProposalDescription,
  formatSubmissionTimeStamp,
} from "@/helpers/daoHelpers";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";
import HistoryStatus from "@/components/proposals/HistoryStatus";
import Profile from "@/components/ui/Profile";
import Votes from "@/components/proposals/Votes";
import Approvers from "@/components/proposals/Approvers";
import VoteActions from "@/components/proposals/VoteActions";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { logger } from "@/helpers/logger";

const SettingsFeedTable = ({
  proposals,
  loading,
  isPendingRequests,
  selectedProposalDetailsId,
  onSelectRequest,
  handleSortClick,
  sortDirection,
}) => {
  const { accountId } = useNearWallet();
  const { daoPolicy, getApproversAndThreshold } = useDao();

  const [columnsVisibility, setColumnsVisibility] = useState([]);

  const settingsApproverGroup = getApproversAndThreshold("policy");
  const deleteGroup = getApproversAndThreshold("policy", true);

  const hasVotingPermission = (
    settingsApproverGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  // Load columns visibility
  useEffect(() => {
    const loadColumnsVisibility = () => {
      if (typeof window === "undefined") return [];
      try {
        const stored = localStorage.getItem(
          LOCAL_STORAGE_KEYS.COLUMNS_VISIBILITY
        );
        if (!stored) return [];
        const allSettings = JSON.parse(stored);
        return allSettings["settings"] || [];
      } catch (error) {
        logger.error("Error loading columns visibility:", error);
        return [];
      }
    };

    setColumnsVisibility(loadColumnsVisibility());

    const handleCustomEvent = () => {
      setColumnsVisibility(loadColumnsVisibility());
    };

    window.addEventListener("columnsVisibilityChanged", handleCustomEvent);

    return () => {
      window.removeEventListener("columnsVisibilityChanged", handleCustomEvent);
    };
  }, []);

  function isVisible(column) {
    return columnsVisibility.find((i) => i.title === column)?.show !== false
      ? ""
      : "d-none";
  }

  const requiredVotes = settingsApproverGroup?.requiredVotes;
  const hideApproversCol = isPendingRequests && requiredVotes === 1;
  const hideVotesCol = isPendingRequests && requiredVotes === 1;

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
        {proposals?.map((item, index) => {
          const title = decodeProposalDescription("title", item.description);

          return (
            <tr
              data-testid={"proposal-request-#" + item.id}
              onClick={() => {
                onSelectRequest(item.id);
              }}
              key={index}
              className={`cursor-pointer proposal-row ${
                selectedProposalDetailsId === item.id ? "bg-highlight" : ""
              }`}
            >
              <td className="fw-semi-bold">{item.id}</td>
              <td className={isVisible("Created Date")}>
                <DateTimeDisplay
                  timestamp={item.submission_time / 1e6}
                  format="date-time"
                />
              </td>
              {!isPendingRequests && (
                <td>
                  <HistoryStatus isVoteStatus={false} status={item.status} />
                </td>
              )}

              <td className={isVisible("Title")}>
                <div
                  className="custom-truncate fw-semi-bold"
                  style={{ width: 180 }}
                >
                  {title ?? item.description}
                </div>
              </td>

              <td
                className={`fw-semi-bold text-center ${isVisible("Creator")}`}
              >
                <div className="d-inline-block">
                  <Profile
                    accountId={item.proposer}
                    showKYC={false}
                    displayImage={false}
                    displayName={false}
                  />
                </div>
              </td>

              {isPendingRequests && (
                <td className={`${isVisible("Required Votes")} text-center`}>
                  {requiredVotes}
                </td>
              )}
              {isPendingRequests && !hideVotesCol && (
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
                  approversGroup={settingsApproverGroup?.approverAccounts}
                />
              </td>

              {isPendingRequests && (
                <td
                  className={`${isVisible("Expiring Date")} text-left`}
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
                  <td
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <VoteActions
                      votes={item.votes}
                      proposalId={item.id}
                      hasVotingPermission={hasVotingPermission}
                      proposalCreator={item.proposer}
                      hasDeletePermission={hasDeletePermission}
                      avoidCheckForBalance={true}
                      requiredVotes={requiredVotes}
                      context="settings"
                      hasOneDeleteIcon={hasOneDeleteIcon}
                      proposal={item}
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
    <div style={{ fontSize: "13px", minHeight: "60vh", overflowX: "auto" }}>
      <div className="w-100">
        <table className="table">
          <thead>
            <tr className="text-secondary">
              <td>#</td>
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

              <td className={isVisible("Title")}>Title</td>

              <td className={`${isVisible("Creator")} text-center`}>
                Created by
              </td>
              {isPendingRequests && (
                <td className={`${isVisible("Required Votes")} text-center`}>
                  Required Votes
                </td>
              )}
              {isPendingRequests && !hideVotesCol && (
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
                <td className={`${isVisible("Expiring Date")} text-left`}>
                  Expiring Date
                </td>
              )}
              {isPendingRequests &&
                (hasVotingPermission || hasDeletePermission) && (
                  <td className="text-right">Actions</td>
                )}
            </tr>
          </thead>

          {loading === true ||
          proposals === null ||
          !Array.isArray(proposals) ? (
            <tbody>
              <TableSkeleton
                numberOfCols={isPendingRequests ? 8 : 6}
                numberOfRows={3}
                numberOfHiddenRows={4}
              />
            </tbody>
          ) : proposals.length === 0 ? (
            <tbody>
              <tr>
                <td
                  colSpan={14}
                  rowSpan={10}
                  className="text-center align-middle"
                >
                  {isPendingRequests ? (
                    <>
                      <h4>No Settings Requests Found</h4>
                      <h6>There are currently no settings requests</h6>
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
    </div>
  );
};

export default SettingsFeedTable;

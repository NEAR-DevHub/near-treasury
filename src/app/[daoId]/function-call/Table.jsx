"use client";

import { useState, useEffect } from "react";
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
import TableSkeleton from "@/components/ui/TableSkeleton";
import Markdown from "@/components/ui/Markdown";

const Table = ({
  proposals,
  loading,
  isPendingRequests,
  highlightProposalId,
  selectedProposalDetailsId,
  onSelectRequest,
  handleSortClick,
  sortDirection,
}) => {
  const { daoPolicy, getApproversAndThreshold } = useDao();

  const [columnsVisibility, setColumnsVisibility] = useState([]);

  const callApproversGroup = getApproversAndThreshold("call");

  const requiredVotes = callApproversGroup?.requiredVotes;
  const hideApproversCol = isPendingRequests && requiredVotes === 1;

  const proposalPeriod = daoPolicy?.proposal_period;

  function isVisible(column) {
    return columnsVisibility.find((i) => i.title === column)?.show !== false
      ? ""
      : "display-none";
  }

  useEffect(() => {
    const loadColumnsVisibility = () => {
      if (typeof window === "undefined") return [];
      try {
        const stored = localStorage.getItem(
          LOCAL_STORAGE_KEYS.COLUMNS_VISIBILITY
        );
        if (!stored) return [];
        const allSettings = JSON.parse(stored);
        return allSettings["function-call"] || [];
      } catch (error) {
        console.error("Error loading columns visibility:", error);
        return [];
      }
    };

    setColumnsVisibility(loadColumnsVisibility());

    // Listen for custom event for same-tab updates
    const handleCustomEvent = () => {
      setColumnsVisibility(loadColumnsVisibility());
    };

    window.addEventListener("columnsVisibilityChanged", handleCustomEvent);

    return () => {
      window.removeEventListener("columnsVisibilityChanged", handleCustomEvent);
    };
  }, []);

  const ProposalsComponent = () => {
    return (
      <tbody style={{ overflowX: "auto" }}>
        {proposals?.map((item, index) => {
          const description = item.description;
          const notes = decodeProposalDescription("notes", item.description);
          const title = decodeProposalDescription("title", item.description);
          return (
            <tr
              data-testid={"proposal-request-#" + item.id}
              onClick={() => {
                onSelectRequest && onSelectRequest(item.id);
              }}
              key={index}
              className={
                "cursor-pointer proposal-row " +
                (highlightProposalId === item.id ||
                selectedProposalDetailsId === item.id
                  ? "bg-highlight"
                  : "")
              }
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
                  <HistoryStatus isVoteStatus={false} status={item.status} />
                </td>
              )}
              <td className={"text-sm text-left " + isVisible("Notes")}>
                <div
                  className="custom-truncate fw-semi-bold"
                  style={{ width: 180 }}
                >
                  {title || notes || description ? (
                    <Markdown>{title || notes || description}</Markdown>
                  ) : (
                    "-"
                  )}
                </div>
              </td>

              <td
                className={"fw-semi-bold text-center " + isVisible("Creator")}
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
                <td className={isVisible("Required Votes") + " text-center"}>
                  {requiredVotes}
                </td>
              )}
              {isPendingRequests && (
                <td className={isVisible("Votes") + " text-center"}>
                  <Votes
                    votes={item.votes}
                    requiredVotes={requiredVotes}
                    isInProgress={true}
                  />
                </td>
              )}
              <td
                className={
                  isVisible("Approvers") +
                  " text-center " +
                  (hideApproversCol && " display-none")
                }
                style={{ minWidth: 100 }}
              >
                <Approvers
                  votes={item.votes}
                  approversGroup={callApproversGroup?.approverAccounts}
                />
              </td>

              {isPendingRequests && (
                <td
                  className={isVisible("Expiring Date") + " text-left"}
                  style={{ minWidth: 150 }}
                >
                  {formatSubmissionTimeStamp(
                    item.submission_time,
                    proposalPeriod
                  )}
                </td>
              )}
              <td className="text-right">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  style={{ minWidth: "130px" }}
                >
                  Review Request
                </button>
              </td>
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
              className={isVisible("Created Date") + " cursor-pointer"}
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
            <td className={isVisible("Notes")}>Notes</td>
            <td className={isVisible("Creator") + " text-center"}>
              Created by
            </td>
            {isPendingRequests && (
              <td className={isVisible("Required Votes") + " text-center"}>
                Required Votes
              </td>
            )}
            {isPendingRequests && (
              <td className={isVisible("Votes") + " text-center"}>Votes</td>
            )}
            <td
              className={
                isVisible("Approvers") +
                " text-center " +
                (hideApproversCol && " display-none")
              }
            >
              Approvers
            </td>
            {isPendingRequests && (
              <td className={isVisible("Expiring Date") + " text-left "}>
                Expiring Date
              </td>
            )}
            <td className="text-right">Actions</td>
          </tr>
        </thead>

        {loading === true || !Array.isArray(proposals) ? (
          <tbody>
            <TableSkeleton
              numberOfCols={isPendingRequests ? 8 : 7}
              numberOfRows={3}
              numberOfHiddenRows={4}
            />
          </tbody>
        ) : proposals.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={isPendingRequests ? 8 : 7}
                rowSpan={10}
                className="text-center align-middle"
              >
                {isPendingRequests ? (
                  <>
                    <h4>No Function Call Requests Found</h4>
                    <h6>There are currently no function call requests</h6>
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

export default Table;

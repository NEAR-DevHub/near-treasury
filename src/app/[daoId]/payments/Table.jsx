"use client";

import { useState, useEffect } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { Near } from "@/api/near";
import { LOCAL_STORAGE_KEYS } from "@/constants/localStorage";
import {
  decodeBase64,
  decodeProposalDescription,
  formatSubmissionTimeStamp,
} from "@/helpers/daoHelpers";
import { fetchTokenMetadataByDefuseAssetId } from "@/api/backend";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";
import HistoryStatus from "@/components/proposals/HistoryStatus";
import Profile from "@/components/ui/Profile";
import TokenIcon from "@/components/proposals/TokenIcon";
import TokenAmount from "@/components/proposals/TokenAmount";
import Votes from "@/components/proposals/Votes";
import Approvers from "@/components/proposals/Approvers";
import VoteActions from "@/components/proposals/VoteActions";
import Tooltip from "@/components/ui/Tooltip";
import TableSkeleton from "@/components/ui/TableSkeleton";

const Table = ({
  proposals,
  loading,
  isPendingRequests,
  selectedProposalDetailsId,
  onSelectRequest,
  handleSortClick,
  sortDirection,
}) => {
  const { accountId } = useNearWallet();
  const {
    daoId: treasuryDaoID,
    daoPolicy,
    getApproversAndThreshold,
    customConfig,
  } = useDao();

  const [intentsTokensData, setIntentsTokensData] = useState([]);
  const [oneClickPrices, setOneClickPrices] = useState({});
  const [columnsVisibility, setColumnsVisibility] = useState([]);

  const transferApproversGroup = getApproversAndThreshold("transfer");
  const deleteGroup = getApproversAndThreshold("transfer", true);

  const hasVotingPermission = (
    transferApproversGroup?.approverAccounts ?? []
  ).includes(accountId);

  const hasDeletePermission = (deleteGroup?.approverAccounts ?? []).includes(
    accountId
  );

  // Load columns visibility for payments page
  useEffect(() => {
    const loadColumnsVisibility = () => {
      if (typeof window === "undefined") return [];
      try {
        const stored = localStorage.getItem(
          LOCAL_STORAGE_KEYS.COLUMNS_VISIBILITY
        );
        if (!stored) return [];
        const allSettings = JSON.parse(stored);
        return allSettings["payments"] || [];
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

  const requiredVotes = transferApproversGroup?.requiredVotes;
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

  // Fetch intents tokens data
  useEffect(() => {
    const fetchIntentsTokens = async () => {
      try {
        // Get unique token addresses from proposals
        const uniqueTokens = [
          ...new Set(
            (proposals ?? [])
              .filter((p) => {
                const isFunctionType =
                  Object.values(p?.kind?.FunctionCall ?? {})?.length > 0;
                return (
                  isFunctionType &&
                  p.kind.FunctionCall?.actions[0]?.method_name === "ft_withdraw"
                );
              })
              .map((p) => {
                const args = decodeBase64(
                  p.kind.FunctionCall?.actions[0]?.args
                );
                return args?.token;
              })
              .filter(Boolean)
          ),
        ];

        if (uniqueTokens.length > 0) {
          const tokensData = await Promise.all(
            uniqueTokens.map((token) =>
              fetchTokenMetadataByDefuseAssetId(token)
            )
          );
          const flattenedData = tokensData
            .flat()
            .filter(Boolean)
            .map((token) => ({
              ...token,
              near_token_id: token.contract || token.near_token_id,
            }));
          setIntentsTokensData(flattenedData);
        }
      } catch (error) {
        console.error("Failed to fetch intents tokens:", error);
      }
    };

    if (proposals && proposals.length > 0) {
      fetchIntentsTokens();
    }
  }, [proposals]);

  const TooltipContent = ({ title, summary }) => {
    return (
      <div className="p-1 text-color">
        {title && <h6>{title}</h6>}
        <div>{summary}</div>
      </div>
    );
  };

  function isVisible(column) {
    return columnsVisibility.find((i) => i.title === column)?.show !== false
      ? ""
      : "display-none";
  }

  const ProposalsComponent = () => {
    return (
      <tbody style={{ overflowX: "auto" }}>
        {proposals?.map((item, index) => {
          const notes = decodeProposalDescription("notes", item.description);
          const title = decodeProposalDescription("title", item.description);
          const summary = decodeProposalDescription(
            "summary",
            item.description
          );
          const description = !title && !summary && item.description;
          const id = decodeProposalDescription("proposalId", item.description);
          let proposalUrl = decodeProposalDescription("url", item.description);
          proposalUrl = (proposalUrl || "").replace(/\.+$/, "");

          const proposalId = id ? parseInt(id, 10) : null;
          const isFunctionType =
            Object.values(item?.kind?.FunctionCall ?? {})?.length > 0;
          const isIntentWithdraw =
            isFunctionType &&
            item.kind.FunctionCall?.actions[0]?.method_name === "ft_withdraw";
          let decodedArgs = null;
          if (isFunctionType) {
            const actions = item.kind.FunctionCall?.actions || [];
            const receiverId = item.kind.FunctionCall?.receiver_id;

            // Requests from NEARN
            if (
              actions.length >= 2 &&
              actions[0]?.method_name === "storage_deposit" &&
              actions[1]?.method_name === "ft_transfer"
            ) {
              decodedArgs = {
                ...decodeBase64(actions[1].args),
                token_id: receiverId,
              };
            } else if (actions[0]?.method_name === "ft_transfer") {
              decodedArgs = {
                ...decodeBase64(actions[0].args),
                token_id: receiverId,
              };
            } else {
              decodedArgs = decodeBase64(actions[0]?.args);
            }
          }

          const args = isIntentWithdraw
            ? {
                token_id: decodedArgs?.token,
                receiver_id:
                  (decodedArgs?.memo &&
                    decodedArgs.memo.replace(/^WITHDRAW_TO:/, "")) ||
                  decodedArgs?.receiver_id,
                amount: decodedArgs?.amount,
              }
            : isFunctionType
            ? {
                token_id: decodedArgs?.token_id || "",
                receiver_id: decodedArgs?.receiver_id,
                amount: decodedArgs?.amount,
              }
            : item.kind.Transfer;

          const sourceWallet = isIntentWithdraw
            ? "Intents"
            : isFunctionType &&
              item.kind.FunctionCall?.actions[0]?.method_name === "transfer"
            ? "Lockup"
            : "SputnikDAO";
          const intentsToken =
            isIntentWithdraw &&
            (intentsTokensData || []).find(
              (token) => token.near_token_id === args.token_id
            );
          const blockchain = isIntentWithdraw
            ? intentsToken
              ? intentsToken.defuse_asset_identifier
                  ?.split(":")[0]
                  ?.toUpperCase()
              : "NEAR Protocol"
            : null;

          return (
            <tr
              key={item.id}
              data-testid={"proposal-request-#" + item.id}
              onClick={() => {
                onSelectRequest?.(item.id);
              }}
              className={
                "cursor-pointer proposal-row " +
                (selectedProposalDetailsId === item.id ? "bg-highlight" : "")
              }
            >
              <td className="fw-semi-bold px-3">{item.id}</td>
              <td className={isVisible("Created Date")}>
                <DateTimeDisplay
                  timestamp={item.submission_time / 1e6}
                  format={"date-time"}
                />
              </td>
              {!isPendingRequests && (
                <td>
                  <HistoryStatus
                    isVoteStatus={false}
                    status={item.status}
                    isPaymentsPage={true}
                  />
                </td>
              )}

              <td className="text-left" style={{ minWidth: 150 }}>
                <div className="fw-semi-bold">
                  {sourceWallet}
                  {blockchain && (
                    <div className="text-secondary">{blockchain}</div>
                  )}
                </div>
              </td>

              {customConfig?.showReferenceProposal && (
                <td className={isVisible("Reference")}>
                  {typeof proposalId === "number" ? (
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={proposalUrl}
                    >
                      <div className="d-flex gap-2 align-items-center text-underline fw-semi-bold">
                        #{proposalId}{" "}
                        <i className="bi bi-box-arrow-up-right"></i>
                      </div>
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              )}

              <td className={isVisible("Title")} style={{ minWidth: 200 }}>
                {description ? (
                  description
                ) : (
                  <Tooltip
                    tooltip={<TooltipContent title={title} summary={summary} />}
                  >
                    <div
                      className="custom-truncate fw-semi-bold"
                      style={{ width: 180 }}
                    >
                      {title}
                    </div>
                  </Tooltip>
                )}
              </td>
              <td className={isVisible("Summary")}>
                <Tooltip
                  tooltip={<TooltipContent title={title} summary={summary} />}
                >
                  <div
                    className="custom-truncate"
                    style={{ width: summary ? 180 : 10 }}
                  >
                    {summary ? summary : "-"}
                  </div>
                </Tooltip>
              </td>
              <td className={"fw-semi-bold " + isVisible("Recipient")}>
                <Profile accountId={args.receiver_id} />
              </td>
              <td className={isVisible("Requested Token") + " text-center"}>
                <TokenIcon address={args.token_id} />
              </td>
              <td className={isVisible("Funding Ask") + " text-right"}>
                <TokenAmount
                  amountWithoutDecimals={args.amount}
                  address={args.token_id}
                  price={oneClickPrices[args.token_id] || undefined}
                  showUSDValue={false}
                />
              </td>
              <td
                className={"fw-semi-bold text-center " + isVisible("Creator")}
              >
                <div className="d-inline-block">
                  <Profile
                    accountId={item.proposer}
                    displayImage={false}
                    displayName={false}
                  />
                </div>
              </td>
              <td className={"text-sm text-left " + isVisible("Notes")}>
                {notes ? (
                  <Tooltip tooltip={notes}>
                    <div className="custom-truncate" style={{ width: 180 }}>
                      {notes}
                    </div>
                  </Tooltip>
                ) : (
                  "-"
                )}
              </td>
              {isPendingRequests && (
                <td className={isVisible("Required Votes") + " text-center"}>
                  {requiredVotes}
                </td>
              )}
              {isPendingRequests && !hideVotesCol && (
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
                  (hideApproversCol ? " display-none" : "")
                }
                style={{ minWidth: 100 }}
              >
                <Approvers
                  votes={item.votes}
                  approversGroup={transferApproversGroup?.approverAccounts}
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
              {isPendingRequests &&
                (hasVotingPermission || hasDeletePermission) && (
                  <td
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <VoteActions
                      votes={item.votes}
                      proposalId={item.id}
                      hasDeletePermission={hasDeletePermission}
                      hasVotingPermission={hasVotingPermission}
                      proposalCreator={item.proposer}
                      hasOneDeleteIcon={hasOneDeleteIcon}
                      isIntentsRequest={isIntentWithdraw}
                      currentAmount={args.amount}
                      currentContract={args.token_id}
                      proposal={item}
                      context="payment"
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
            <td className="text-left">Source Wallet</td>
            {customConfig?.showReferenceProposal && (
              <td className={isVisible("Reference")}>Reference</td>
            )}
            <td className={isVisible("Title")}>Title</td>
            <td className={isVisible("Summary")}>Summary</td>
            <td className={isVisible("Recipient")}>Recipient</td>
            <td className={isVisible("Requested Token") + " text-center"}>
              Requested Token
            </td>
            <td className={isVisible("Funding Ask") + " text-right"}>
              Funding Ask
            </td>
            <td className={isVisible("Creator") + " text-center"}>
              Created by
            </td>
            <td className={isVisible("Notes") + " text-left"}>Notes</td>
            {isPendingRequests && (
              <td className={isVisible("Required Votes") + " text-center"}>
                Required Votes
              </td>
            )}
            {isPendingRequests && !hideVotesCol && (
              <td className={isVisible("Votes") + " text-center"}>Votes</td>
            )}
            <td
              className={
                isVisible("Approvers") +
                " text-center " +
                (hideApproversCol ? " display-none" : "")
              }
            >
              Approvers
            </td>
            {isPendingRequests && (
              <td className={isVisible("Expiring Date") + " text-left "}>
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
        transferApproversGroup === null ||
        daoPolicy === null ||
        !Array.isArray(proposals) ? (
          <tbody>
            <TableSkeleton
              numberOfCols={isPendingRequests ? 14 : 13}
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
                    <h4>No Payment Requests Found</h4>
                    <h6>There are currently no payment requests</h6>
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

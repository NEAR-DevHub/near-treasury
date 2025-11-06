"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { Near } from "@/api/near";
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
import TokenAmount from "@/components/proposals/TokenAmount";
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
  } = useDao();

  const functionCallApproversGroup = getApproversAndThreshold("call");

  const deleteGroup = getApproversAndThreshold("call", true);

  const hasVotingPermission = useMemo(
    () =>
      (functionCallApproversGroup?.approverAccounts ?? []).includes(accountId),
    [functionCallApproversGroup, accountId]
  );
  const hasDeletePermission = useMemo(
    () => (deleteGroup?.approverAccounts ?? []).includes(accountId),
    [deleteGroup, accountId]
  );

  const hasOneDeleteIcon =
    isPendingRequests &&
    hasDeletePermission &&
    (proposals ?? []).find(
      (i) =>
        i.proposer === accountId &&
        !Object.keys(i.votes ?? {}).includes(accountId)
    );

  // Columns visibility
  const [columnsVisibility, setColumnsVisibility] = useState([]);
  useEffect(() => {
    const load = () => {
      try {
        const stored = localStorage.getItem(
          LOCAL_STORAGE_KEYS.COLUMNS_VISIBILITY
        );
        if (!stored) return [];
        const all = JSON.parse(stored);
        return all["asset-exchange"] || [];
      } catch {
        return [];
      }
    };
    setColumnsVisibility(load());
    const onChange = () => setColumnsVisibility(load());
    window.addEventListener("columnsVisibilityChanged", onChange);
    return () =>
      window.removeEventListener("columnsVisibilityChanged", onChange);
  }, []);

  // 1Click tokens cache (mapping and prices)
  const [oneClickPrices, setOneClickPrices] = useState({});
  const [symbolByAddress, setSymbolByAddress] = useState({});
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch("https://1click.chaindefuser.com/v0/tokens");
        const body = await res.json();
        if (Array.isArray(body)) {
          const mapping = {};
          const prices = {};
          for (const token of body) {
            if (token.assetId?.startsWith("nep141:")) {
              const contractAddress = token.assetId.replace("nep141:", "");
              mapping[contractAddress.toLowerCase()] = token.symbol;
            }
            if (token.symbol && token.price) {
              prices[token.symbol] = token.price;
            }
          }
          setSymbolByAddress(mapping);
          setOneClickPrices(prices);
        }
      } catch {}
    };
    fetchTokens();
  }, []);

  const isVisible = (column) =>
    columnsVisibility.find((i) => i.title === column)?.show !== false
      ? ""
      : "display-none";

  const requiredVotes = functionCallApproversGroup?.requiredVotes || 0;
  const hideApproversCol = isPendingRequests && requiredVotes === 1;
  const hideVotesCol = isPendingRequests && requiredVotes === 1;
  const proposalPeriod = daoPolicy?.proposal_period;

  const ProposalsComponent = () => (
    <tbody style={{ overflowX: "auto" }}>
      {proposals?.map((item) => {
        const amountIn = decodeProposalDescription(
          "amountIn",
          item.description
        );
        const tokenIn = decodeProposalDescription("tokenIn", item.description);
        const tokenOut = decodeProposalDescription(
          "tokenOut",
          item.description
        );
        const slippage = decodeProposalDescription(
          "slippage",
          item.description
        );
        const amountOut = decodeProposalDescription(
          "amountOut",
          item.description
        );

        const outEstimate = parseFloat(amountOut) || 0;
        const slippageValue = parseFloat(slippage) || 0;
        const minAmountReceive = Number(
          outEstimate * (1 - slippageValue / 100)
        );

        const quoteDeadlineStr = decodeProposalDescription(
          "quoteDeadline",
          item.description
        );
        let quoteDeadline = null;
        let isQuoteExpired = false;
        if (quoteDeadlineStr) {
          quoteDeadline = new Date(quoteDeadlineStr);
          isQuoteExpired = quoteDeadline.getTime() < Date.now();
        }

        const sourceWallet = quoteDeadlineStr ? "NEAR Intents" : "SputnikDAO";

        const tokenInLower = (tokenIn || "").toLowerCase();
        const displaySymbolIn = symbolByAddress[tokenInLower] || tokenIn;
        const priceIn = oneClickPrices[displaySymbolIn] || undefined;

        return (
          <tr
            key={item.id}
            data-testid={"proposal-request-#" + item.id}
            onClick={() => onSelectRequest?.(item.id)}
            className={
              "cursor-pointer proposal-row " +
              (selectedProposalDetailsId === item.id ? "bg-highlight" : "")
            }
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

            <td className={"text-left"} style={{ minWidth: 150 }}>
              <div className="fw-semi-bold">{sourceWallet}</div>
            </td>

            <td className={"text-right " + isVisible("Send")}>
              {quoteDeadlineStr ? (
                <TokenAmount
                  amountWithDecimals={amountIn}
                  symbol={displaySymbolIn}
                  showUSDValue={true}
                  price={priceIn}
                />
              ) : (
                <TokenAmount
                  amountWithDecimals={amountIn}
                  address={tokenIn}
                  showUSDValue={true}
                />
              )}
            </td>
            <td className={isVisible("Receive") + " text-right"}>
              {quoteDeadlineStr ? (
                <TokenAmount
                  amountWithDecimals={amountOut}
                  symbol={tokenOut}
                  showUSDValue={true}
                  price={oneClickPrices[tokenOut] || undefined}
                />
              ) : (
                <TokenAmount
                  amountWithDecimals={amountOut}
                  address={tokenOut}
                  showUSDValue={true}
                />
              )}
            </td>
            <td className={isVisible("Minimum received") + " text-right"}>
              {quoteDeadlineStr ? (
                <TokenAmount
                  amountWithDecimals={minAmountReceive}
                  symbol={tokenOut}
                  showUSDValue={true}
                  price={oneClickPrices[tokenOut] || undefined}
                />
              ) : (
                <TokenAmount
                  amountWithDecimals={minAmountReceive}
                  address={tokenOut}
                  showUSDValue={true}
                />
              )}
            </td>

            <td className={"fw-semi-bold text-center " + isVisible("Creator")}>
              <div className="d-inline-block">
                <Profile
                  accountId={item.proposer}
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
                approversGroup={functionCallApproversGroup?.approverAccounts}
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
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <VoteActions
                    votes={item.votes}
                    proposalId={item.id}
                    hasDeletePermission={hasDeletePermission}
                    hasVotingPermission={hasVotingPermission}
                    proposalCreator={item.proposer}
                    currentAmount={amountIn}
                    currentContract={tokenIn}
                    requiredVotes={requiredVotes}
                    isHumanReadableCurrentAmount={true}
                    context="exchange"
                    hasOneDeleteIcon={hasOneDeleteIcon}
                    proposal={item}
                    isIntentsRequest={!!quoteDeadlineStr}
                    isQuoteExpired={isQuoteExpired}
                    quoteDeadline={quoteDeadline}
                  />
                </td>
              )}
          </tr>
        );
      })}
    </tbody>
  );

  return (
    <div
      className="h-100 w-100"
      style={{ overflowX: "auto", fontSize: 13, minHeight: "60vh" }}
    >
      <table className="table">
        <thead>
          <tr className="text-secondary">
            <td>#</td>
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
            {!isPendingRequests && <td className={"text-center"}>Status</td>}
            <td className={"text-left"}>Source Wallet</td>
            <td className={isVisible("Send") + " text-right"}>Send</td>
            <td className={isVisible("Receive") + " text-right"}>Receive</td>
            <td className={isVisible("Minimum received") + " text-right"}>
              Minimum received
            </td>
            <td className={isVisible("Creator") + " text-center"}>
              Created by
            </td>
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
        functionCallApproversGroup === null ||
        daoPolicy === null ||
        !Array.isArray(proposals) ? (
          <tbody>
            <TableSkeleton
              numberOfCols={isPendingRequests ? 12 : 10}
              numberOfRows={4}
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
                  <div>
                    <h4>No Asset Exchange Requests Found</h4>
                    <h6>There are currently no asset exchange requests</h6>
                  </div>
                ) : (
                  <div>
                    <h4>No History Exchange Requests Found</h4>
                    <h6>There are currently no history exchange requests</h6>
                  </div>
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

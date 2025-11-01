"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useProposals } from "@/hooks/useProposals";
import { useNearWallet } from "@/context/NearWalletContext";
import { useDao } from "@/context/DaoContext";
import { Near } from "@/api/near";
import { decodeBase64, decodeProposalDescription } from "@/helpers/daoHelpers";
import Big from "big.js";
import ProposalDetails from "@/components/proposals/ProposalDetails";
import VoteActions from "@/components/proposals/VoteActions";
import DateTimeDisplay from "@/components/ui/DateTimeDisplay";
import IntentsTokenDisplay from "@/components/proposals/IntentsTokenDisplay";
import Tooltip from "@/components/ui/Tooltip";
import { getAggregatedIntentsAssets } from "@/helpers/treasuryHelpers";
import TokenAmount from "@/components/proposals/TokenAmount";

const ProposalDetailsPage = ({
  id,
  isCompactVersion,
  onClose,
  setVoteProposalId,
  setToastStatus,
  currentTab,
}) => {
  const { accountId } = useNearWallet();
  const { daoId, daoPolicy, getApproversAndThreshold } = useDao();
  const { invalidateCategory } = useProposals({
    daoId,
    category: "asset-exchange",
    enabled: false,
  });

  const [proposalData, setProposalData] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [intentsAssets, setIntentsAssets] = useState([]);

  const proposalPeriod = daoPolicy?.proposal_period;

  const networkInfo = useMemo(() => {
    if (
      !proposalData ||
      intentsAssets.length === 0 ||
      !proposalData?.quoteDeadline
    ) {
      return {};
    }

    const info = {};
    intentsAssets.forEach((asset) => {
      if (
        asset.symbol?.toLowerCase() === proposalData?.tokenIn?.toLowerCase() ||
        asset.name?.toLowerCase() === proposalData?.tokenIn?.toLowerCase()
      ) {
        info[proposalData?.tokenIn] = {
          ...asset,
          networkInfo: asset.networks?.find(
            (network) =>
              network.id?.replace("nep141:", "") ===
              proposalData?.intentsTokenContractId
          ),
        };
      } else if (
        asset.symbol?.toLowerCase() === proposalData?.tokenOut?.toLowerCase() ||
        asset.name?.toLowerCase() === proposalData?.tokenOut?.toLowerCase()
      ) {
        info[proposalData?.tokenOut] = {
          ...asset,
          networkInfo: asset.networks?.find(
            (network) => network.chainId === proposalData?.destinationNetwork
          ),
        };
      }
    });
    return info;
  }, [proposalData, intentsAssets]);

  useEffect(() => {
    getAggregatedIntentsAssets({ theme: "dark" }).then((assets) => {
      setIntentsAssets(assets);
    });
  }, []);

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

  const isQuoteExpired = useMemo(() => {
    if (!proposalData?.quoteDeadline) return false;
    return new Date() > new Date(proposalData.quoteDeadline);
  }, [proposalData?.quoteDeadline]);

  const proposalStatusLabel = useMemo(
    () => ({
      approved: "Asset Exchange Request Executed",
      rejected: "Asset Exchange Request Rejected",
      deleted: "Asset Exchange Request Deleted",
      failed: "Asset Exchange Request Failed",
      expired: "Asset Exchange Request Expired",
    }),
    []
  );

  useEffect(() => {
    async function fetchProposalData() {
      if (!daoId || !proposalPeriod || proposalData) return;
      try {
        const item = await Near.view(daoId, "get_proposal", {
          id: parseInt(id),
        });
        const notes = decodeProposalDescription("notes", item.description);
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
        const quoteDeadlineStr = decodeProposalDescription(
          "quoteDeadline",
          item.description
        );
        const destinationNetwork = decodeProposalDescription(
          "destinationNetwork",
          item.description
        );
        const timeEstimate = decodeProposalDescription(
          "timeEstimate",
          item.description
        );
        const depositAddress = decodeProposalDescription(
          "depositAddress",
          item.description
        );
        const signature = decodeProposalDescription(
          "signature",
          item.description
        );
        const outEstimate = parseFloat(amountOut) || 0;
        const slippageValue = parseFloat(slippage) || 0;
        const minAmountReceive = Number(
          outEstimate * (1 - slippageValue / 100)
        );
        let status = item.status;
        if (status === "InProgress") {
          const endTime = Big(item.submission_time ?? "0")
            .plus(proposalPeriod ?? "0")
            .toFixed();
          const timestampInMilliseconds = Big(endTime).div(Big(1_000_000));
          if (Big(timestampInMilliseconds).lt(Date.now())) {
            status = "Expired";
          }
        }
        const sourceWallet = quoteDeadlineStr ? "NEAR Intents" : "SputnikDAO";
        let intentsTokenContractId = null;
        if (quoteDeadlineStr && item.kind?.FunctionCall) {
          const action = item.kind.FunctionCall?.actions?.[0];
          if (action && action.method_name === "mt_transfer") {
            const args = action.args;
            if (args) {
              const decodedArgs = decodeBase64(args);
              const tokenId = decodedArgs?.token_id;
              intentsTokenContractId = tokenId?.startsWith("nep141:")
                ? tokenId.replace("nep141:", "")
                : tokenId;
            }
          }
        }
        setProposalData({
          id: item.id,
          proposer: item.proposer,
          votes: item.votes,
          submissionTime: item.submission_time,
          notes,
          status,
          amountIn,
          amountOut,
          minAmountReceive,
          tokenIn,
          tokenOut,
          slippage,
          proposal: item,
          quoteDeadline: quoteDeadlineStr ? new Date(quoteDeadlineStr) : null,
          destinationNetwork,
          timeEstimate,
          depositAddress,
          signature,
          sourceWallet,
          intentsTokenContractId,
        });
      } catch (e) {
        setIsDeleted(true);
      }
    }
    fetchProposalData();
  }, [id, daoId, proposalPeriod]);

  useEffect(() => {
    if (proposalData && proposalData.id !== id) {
      setProposalData(null);
    }
  }, [id, proposalData]);

  const refreshData = useCallback(() => {
    setProposalData(null);
    invalidateCategory();
  }, [invalidateCategory]);

  const updateVoteSuccess = useCallback(
    (status, proposalId) => {
      setVoteProposalId?.(proposalId);
      setToastStatus?.(status);
      refreshData();
    },
    [setVoteProposalId, setToastStatus, refreshData]
  );

  const checkProposalStatus = useCallback(
    async (proposalId) => {
      try {
        const result = await Near.view(daoId, "get_proposal", {
          id: proposalId,
        });
        updateVoteSuccess(result.status, proposalId);
      } catch {
        updateVoteSuccess("Removed", proposalId);
      }
    },
    [daoId, updateVoteSuccess]
  );

  const handleCheckProposalStatus = useMemo(
    () =>
      proposalData?.id ? () => checkProposalStatus(proposalData.id) : undefined,
    [checkProposalStatus, proposalData?.id]
  );

  return (
    <ProposalDetails
      currentTab={currentTab}
      proposalPeriod={proposalPeriod}
      page="asset-exchange"
      VoteActions={
        (hasVotingPermission || hasDeletePermission) &&
        proposalData?.status === "InProgress" ? (
          <VoteActions
            votes={proposalData?.votes}
            proposalId={proposalData?.id}
            hasDeletePermission={hasDeletePermission}
            hasVotingPermission={hasVotingPermission}
            proposalCreator={proposalData?.proposer}
            currentAmount={proposalData?.amountIn}
            currentContract={
              proposalData?.intentsTokenContractId || proposalData?.tokenIn
            }
            isHumanReadableCurrentAmount={true}
            requiredVotes={functionCallApproversGroup?.requiredVotes}
            isIntentsRequest={!!proposalData?.quoteDeadline}
            checkProposalStatus={handleCheckProposalStatus}
            isProposalDetailsPage={true}
            proposal={proposalData?.proposal}
            isQuoteExpired={isQuoteExpired}
            quoteDeadline={proposalData?.quoteDeadline}
          />
        ) : null
      }
      ProposalContent={
        proposalData && (
          <div className="card card-body d-flex flex-column gap-2">
            <div className="d-flex flex-column gap-2">
              <label className="proposal-label">Source Wallet</label>
              <div className="text-secondary">{proposalData?.sourceWallet}</div>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">Send</label>
              <h6 className="mb-0">
                {proposalData?.quoteDeadline ? (
                  <IntentsTokenDisplay
                    icon={networkInfo[proposalData?.tokenIn]?.icon}
                    symbol={networkInfo[proposalData?.tokenIn]?.symbol}
                    price={networkInfo[proposalData?.tokenIn]?.price}
                    amountWithDecimals={proposalData?.amountIn}
                    showUSDValue={true}
                    networkName={
                      networkInfo[proposalData?.tokenIn]?.networkInfo?.label
                    }
                  />
                ) : (
                  <TokenAmount
                    amountWithDecimals={proposalData?.amountIn}
                    address={proposalData?.tokenIn}
                    showUSDValue={true}
                    isProposalDetails={true}
                  />
                )}
              </h6>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">Receive</label>
              <h6 className="mb-0">
                {proposalData?.quoteDeadline ? (
                  <IntentsTokenDisplay
                    icon={networkInfo[proposalData?.tokenOut]?.icon}
                    symbol={networkInfo[proposalData?.tokenOut]?.symbol}
                    price={networkInfo[proposalData?.tokenOut]?.price}
                    amountWithDecimals={proposalData?.amountOut}
                    showUSDValue={true}
                    networkName={
                      networkInfo[proposalData?.tokenOut]?.networkInfo?.label
                    }
                  />
                ) : (
                  <TokenAmount
                    amountWithDecimals={proposalData?.amountOut}
                    address={proposalData?.tokenOut}
                    showUSDValue={true}
                    isProposalDetails={true}
                  />
                )}
              </h6>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">
                Price Slippage Limit{" "}
                <Tooltip tooltip="This is the slippage limit defined for this request. If the market rate changes beyond this threshold during execution, the request will automatically fail.">
                  <i className="bi bi-info-circle text-secondary"></i>
                </Tooltip>
              </label>
              <div>{proposalData?.slippage}%</div>
            </div>
            <div className="d-flex flex-column gap-2 mt-1">
              <label className="border-top proposal-label">
                Minimum Amount Receive{" "}
                <Tooltip tooltip="This is the minimum amount you'll receive from this exchange, based on the slippage limit set for the request.">
                  <i className="bi bi-info-circle text-secondary"></i>
                </Tooltip>
              </label>
              <h6 className="mb-0">
                {proposalData?.quoteDeadline ? (
                  <IntentsTokenDisplay
                    icon={networkInfo[proposalData?.tokenOut]?.icon}
                    symbol={networkInfo[proposalData?.tokenOut]?.symbol}
                    price={networkInfo[proposalData?.tokenOut]?.price}
                    amountWithDecimals={proposalData?.minAmountReceive}
                    showUSDValue={false}
                    showPrice={false}
                  />
                ) : (
                  <TokenAmount
                    amountWithDecimals={proposalData?.minAmountReceive}
                    address={proposalData?.tokenOut}
                    showUSDValue={false}
                    isProposalDetails={true}
                  />
                )}
              </h6>
            </div>
            {proposalData?.quoteDeadline && (
              <>
                <div className="d-flex flex-column gap-2 mt-1">
                  <label className="border-top proposal-label">
                    1Click Quote Deadline{" "}
                    <Tooltip tooltip="Time when the deposit address becomes inactive and funds may be lost">
                      <i className="bi bi-info-circle text-secondary"></i>
                    </Tooltip>
                  </label>
                  <div className={isQuoteExpired ? "text-danger fw-bold" : ""}>
                    <DateTimeDisplay timestamp={proposalData.quoteDeadline} />
                    {isQuoteExpired && " (EXPIRED)"}
                  </div>
                </div>
                {proposalData?.timeEstimate && (
                  <div className="d-flex flex-column gap-2 mt-1">
                    <label className="border-top proposal-label">
                      Estimated Time{" "}
                      <Tooltip tooltip="Estimated time for the swap to be executed after the deposit transaction is confirmed">
                        <i className="bi bi-info-circle text-secondary"></i>
                      </Tooltip>
                    </label>
                    <div>{proposalData.timeEstimate}</div>
                  </div>
                )}
                {proposalData?.depositAddress && (
                  <div className="d-flex flex-column gap-2 mt-1">
                    <label className="border-top proposal-label">
                      Deposit Address{" "}
                      <Tooltip tooltip="The 1Click deposit address where tokens will be sent for the cross-chain swap execution.">
                        <i className="bi bi-info-circle text-secondary"></i>
                      </Tooltip>
                    </label>
                    <div
                      className="text-break"
                      style={{ fontFamily: "monospace", fontSize: "14px" }}
                    >
                      <a
                        href={`https://explorer.near-intents.org/transactions/${proposalData.depositAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ wordBreak: "break-all" }}
                      >
                        {proposalData.depositAddress}
                      </a>
                    </div>
                  </div>
                )}
                {proposalData?.signature && (
                  <div className="d-flex flex-column gap-2 mt-1">
                    <label className="border-top proposal-label">
                      Quote Signature{" "}
                      <Tooltip tooltip="The cryptographic signature from 1Click API that validates this quote.">
                        <i className="bi bi-info-circle text-secondary"></i>
                      </Tooltip>
                    </label>
                    <div
                      className="text-break"
                      style={{ fontFamily: "monospace", fontSize: "12px" }}
                    >
                      {proposalData.signature}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      }
      proposalData={proposalData}
      isDeleted={isDeleted}
      isCompactVersion={isCompactVersion}
      approversGroup={functionCallApproversGroup}
      proposalStatusLabel={proposalStatusLabel}
      onClose={onClose}
    />
  );
};

export default ProposalDetailsPage;

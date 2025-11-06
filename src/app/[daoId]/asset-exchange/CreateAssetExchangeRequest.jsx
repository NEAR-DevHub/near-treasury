"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import DropdownWithModal from "@/components/dropdowns/DropdownWithModal";
import Tooltip from "@/components/ui/Tooltip";
import Modal from "@/components/ui/Modal";
import { useDao } from "@/context/DaoContext";
import { formatTokenAmount, formatUsdValue } from "@/helpers/nearHelpers";
import { getAggregatedIntentsAssets } from "@/helpers/treasuryHelpers";
import { useTheme } from "@/context/ThemeContext";
import { fetchDryQuote } from "@/api/chaindefuser";
import { fetchTreasuryOneClickQuote } from "@/api/backend";
import Big from "big.js";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import { useNearWallet } from "@/context/NearWalletContext";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import { Near } from "@/api/near";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import { formatDateTimeWithTimezone } from "@/components/ui/DateTimeDisplay";

const formatNumberWithCommas = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-US");
};

const TokenBadge = ({ token, network, hideSymbol = false }) => {
  if (!token) return null;
  return (
    <div className="d-flex align-items-center gap-2 justify-content-start">
      {token.icon && (
        <div className="position-relative">
          <img
            src={token.icon}
            alt=""
            className="rounded-circle"
            style={{ width: "30px", height: "30px", objectFit: "cover" }}
          />
          <div
            className="position-absolute"
            style={{ right: "-2px", bottom: "-12px" }}
          >
            <img
              src={network.icon}
              alt="Edit"
              width={16}
              height={16}
              className="rounded-circle object-fit-cover"
            />
          </div>
        </div>
      )}
      <div className="d-flex flex-column align-items-start">
        {!hideSymbol && <span className="fw-semi-bold">{token.symbol}</span>}
        {network && !hideSymbol && (
          <span className="text-secondary" style={{ fontSize: 12 }}>
            {network.label}
          </span>
        )}
      </div>
    </div>
  );
};

const CreateAssetExchangeRequest = ({ onCloseCanvas = () => {} }) => {
  const { daoId: treasuryDaoID, intentsBalances, daoPolicy } = useDao();
  const { signAndSendTransactions, accountId } = useNearWallet();
  const { showToast } = useProposalToastContext();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      sendToken: null,
      sendNetwork: null,
      sendAmount: "",
      receiveToken: null,
      receiveNetwork: null,
      slippagePct: "1",
    },
  });

  const sendToken = watch("sendToken");
  const sendNetwork = watch("sendNetwork");
  const sendAmount = watch("sendAmount");
  const receiveToken = watch("receiveToken");
  const receiveNetwork = watch("receiveNetwork");
  const slippagePct = watch("slippagePct");
  const { isDarkTheme } = useTheme();

  // Quote state and preview modal
  const [dryQuote, setDryQuote] = useState(null);
  const [isFetchingDryQuote, setIsFetchingDryQuote] = useState(false);
  const [dryQuoteError, setDryQuoteError] = useState("");

  const dryQuoteIntervalRef = useRef(null);
  const dryQuoteDebounceTimeout = useRef(null);

  const [showPreview, setShowPreview] = useState(false);

  const [proposalQuote, setProposalQuote] = useState(null);
  const [isFetchingProposalQuote, setIsFetchingProposalQuote] = useState(false);
  const [proposalRefreshCountdown, setProposalRefreshCountdown] = useState(10);
  const proposalRefreshIntervalRef = useRef(null);
  const [isTxnCreated, setTxnCreated] = useState(false);

  const [networkModalSide, setNetworkModalSide] = useState(null);
  const [tokenOptions, setTokenOptions] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [sendDropdownOpen, setSendDropdownOpen] = useState(false);
  const [receiveDropdownOpen, setReceiveDropdownOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const formatFixed2 = (value) =>
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  function getTokenNetworkBalance(token, network) {
    if (!token) return null;
    const nets = Array.isArray(token.networks) ? token.networks : [];
    if (network) {
      const entry = nets.find((n) => n.id === network.id);
      if (entry && typeof entry.amount !== "undefined") {
        const v = Number(entry.amount || 0);
        return isNaN(v) ? null : v;
      }
    }
    const sum = nets.reduce((acc, n) => acc + (Number(n.amount || 0) || 0), 0);
    return sum > 0 ? sum : null;
  }

  // Build aggregated token list from defuse + metadata; merge balances from intents
  useEffect(() => {
    async function loadAllTokens() {
      setIsLoadingTokens(true);
      try {
        const aggregatedList = await getAggregatedIntentsAssets({
          intentsBalances,
          theme: isDarkTheme ? "dark" : "light",
        });
        const sorted = (aggregatedList || []).slice().sort((a, b) => {
          const usdA = Number(
            a.totalUsd ?? Number(a.totalAmount || 0) * (a.price || 0)
          );
          const usdB = Number(
            b.totalUsd ?? Number(b.totalAmount || 0) * (b.price || 0)
          );
          if (usdB !== usdA) return usdB - usdA;
          const sa = (a.symbol || "").toString();
          const sb = (b.symbol || "").toString();
          return sa.localeCompare(sb);
        });
        setTokenOptions(sorted);
      } catch (e) {
        console.error("Failed to build tokens:", e);
        setTokenOptions([]);
      } finally {
        setIsLoadingTokens(false);
      }
    }
    loadAllTokens();
  }, [intentsBalances, isDarkTheme]);

  function swapDirections() {
    // Only swap when both sides have token AND network selected
    if ((!sendToken && !sendNetwork) || (!receiveToken && !receiveNetwork)) {
      return;
    }

    const prevSendToken = sendToken;
    const prevSendNetwork = sendNetwork;
    const prevReceiveToken = receiveToken;
    const prevReceiveNetwork = receiveNetwork;

    setValue("sendToken", prevReceiveToken, { shouldDirty: true });
    setValue("sendNetwork", prevReceiveNetwork, { shouldDirty: true });
    setValue("sendAmount", "", { shouldDirty: true });
    setValue("receiveToken", prevSendToken, { shouldDirty: true });
    setValue("receiveNetwork", prevSendNetwork, { shouldDirty: true });
  }

  async function fetchProposalQuote() {
    if (
      !sendToken ||
      !receiveToken ||
      !sendNetwork ||
      !receiveNetwork ||
      !sendAmount
    ) {
      return;
    }
    setIsFetchingProposalQuote(true);
    try {
      const decimals = sendNetwork.decimals || 18;
      const amountInSmallestUnit = Big(sendAmount || 0)
        .mul(Big(10).pow(decimals))
        .toFixed(0);

      const data = await fetchTreasuryOneClickQuote({
        treasuryDaoID,
        inputToken: {
          id: sendNetwork.id,
          symbol: sendToken.symbol,
        },
        outputToken: {
          id: receiveNetwork.id,
        },
        amountIn: amountInSmallestUnit,
        slippageTolerance: parseFloat(slippagePct || 1) * 100, // Convert percentage to basis points
        networkOut: receiveNetwork.label,
      });

      // Store the real quote with token symbols
      const quoteWithRate = {
        ...data.proposalPayload,
      };

      // Calculate rate and price difference using market prices
      const { rate, priceDiffPct } = getRateAndPriceDiff(data.proposalPayload);
      quoteWithRate.rate = rate;
      quoteWithRate.priceDiffPct = priceDiffPct;

      setProposalQuote(quoteWithRate);

      setProposalRefreshCountdown(10);
      setShowPreview(true);
    } catch (err) {
      console.error("Failed to get proposal quote:", err);
      // You might want to set an error state here
    } finally {
      setIsFetchingProposalQuote(false);
    }
  }

  // Preview countdown - refreshes proposal quote every 10 seconds
  useEffect(() => {
    if (!showPreview) {
      if (proposalRefreshIntervalRef.current)
        clearInterval(proposalRefreshIntervalRef.current);
      return;
    }
    proposalRefreshIntervalRef.current = setInterval(() => {
      setProposalRefreshCountdown((s) => {
        if (s <= 1) {
          // Refresh quote when countdown reaches 0
          fetchProposalQuote();
          return 10;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(proposalRefreshIntervalRef.current);
  }, [
    showPreview,
    sendToken,
    receiveToken,
    sendNetwork,
    receiveNetwork,
    sendAmount,
  ]);

  // Function to fetch and update dry quote
  const fetchAndUpdateDryQuote = async () => {
    if (
      !sendToken ||
      !sendNetwork ||
      !receiveToken ||
      !receiveNetwork ||
      !sendAmount
    ) {
      return;
    }
    setIsFetchingDryQuote(true);
    try {
      const result = await fetchDryQuote({
        treasuryDaoID,
        daoPolicy,
        sendNetwork,
        receiveNetwork,
        amount: Number(sendAmount),
        slippagePct,
      });
      if (result?.error) {
        setDryQuote(null);
        setDryQuoteError(result.error);
      } else if (result?.quote) {
        setDryQuoteError(null);
        const amountOut = parseFloat(result.quote.amountOutFormatted || "0");
        const rate =
          Number(result.quote.amountInFormatted || 0) > 0
            ? Number(
                Big(result.quote.amountOutFormatted || 0)
                  .div(Big(result.quote.amountInFormatted || 0))
                  .toString()
              )
            : 0;

        setDryQuote({
          ...result,
          rate,
          receiveAmount: amountOut,
          receiveAmountUSD: result.quote.amountOutUsd,
          minReceived: result.quote.minAmountOut
            ? Big(result.quote.minAmountOut)
                .div(Big(10).pow(receiveNetwork.decimals))
                .toFixed()
            : 0,
        });
      }
    } finally {
      setIsFetchingDryQuote(false);
    }
  };

  function getRateAndPriceDiff(quote) {
    if (!quote || !quote.quote || !sendToken?.price || !receiveToken?.price) {
      return { rate: 0, priceDiffPct: 0 };
    }

    const quoteAmountIn = parseFloat(quote.quote.amountInFormatted || 0);
    const quoteAmountOut = parseFloat(quote.quote.amountOutFormatted || 0);

    if (quoteAmountIn <= 0 || quoteAmountOut <= 0) {
      return { rate: 0, priceDiffPct: 0 };
    }

    // Calculate exchange rate from quote: how many receive tokens per 1 send token
    const quoteRate = Big(quoteAmountOut).div(Big(quoteAmountIn)).toNumber();

    // Calculate market rate based on token prices
    // Market rate = how many receive tokens per 1 send token based on market prices
    // If sendToken.price = $100 and receiveToken.price = $1, then 1 send token = 100 receive tokens
    const marketRate =
      sendToken.price > 0 && receiveToken.price > 0
        ? Big(sendToken.price).div(Big(receiveToken.price)).toNumber()
        : 0;

    // Calculate price difference percentage
    // Positive means quote gives more receive tokens than market rate (good for user)
    // Negative means quote gives fewer receive tokens than market rate
    const priceDiffPct =
      marketRate > 0
        ? Big(quoteRate)
            .minus(Big(marketRate))
            .div(Big(marketRate))
            .mul(100)
            .toNumber()
        : 0;

    return {
      rate: quoteRate,
      priceDiffPct: priceDiffPct,
    };
  }

  // Auto-quote for dry receive (debounced initial fetch, then refresh every 10 seconds)
  useEffect(() => {
    // Clear any existing timers
    if (dryQuoteDebounceTimeout.current)
      clearTimeout(dryQuoteDebounceTimeout.current);
    if (dryQuoteIntervalRef.current) clearInterval(dryQuoteIntervalRef.current);

    // Stop fetching if preview modal is open
    if (showPreview) {
      return;
    }

    if (
      !sendToken ||
      !sendNetwork ||
      !receiveToken ||
      !receiveNetwork ||
      !sendAmount
    ) {
      setDryQuote(null);
      setIsFetchingDryQuote(false);
      return;
    }

    // Debounced initial fetch after 3 seconds, then start interval
    dryQuoteDebounceTimeout.current = setTimeout(() => {
      fetchAndUpdateDryQuote();

      // Set up interval to refresh every 10 seconds
      dryQuoteIntervalRef.current = setInterval(() => {
        // Check if preview is still closed before fetching
        if (!showPreview) {
          fetchAndUpdateDryQuote();
        }
      }, 10000); // 10 seconds
    }, 1000);

    return () => {
      if (dryQuoteDebounceTimeout.current)
        clearTimeout(dryQuoteDebounceTimeout.current);
      if (dryQuoteIntervalRef.current)
        clearInterval(dryQuoteIntervalRef.current);
    };
  }, [
    sendToken,
    sendNetwork,
    receiveToken,
    receiveNetwork,
    sendAmount,
    slippagePct,
    showPreview,
  ]);

  async function onSubmit() {
    if (!proposalQuote || !sendToken || !receiveToken || !sendNetwork) {
      return;
    }

    setTxnCreated(true);

    try {
      // Format the 1Click proposal with encoded metadata
      const proposalDescription = encodeToMarkdown({
        proposal_action: "asset-exchange",
        notes: `**Must be executed before ${proposalQuote.quote?.deadline}** for transferring tokens to 1Click's deposit address for swap execution.`,
        tokenIn: sendToken.symbol,
        tokenOut: receiveToken.symbol,
        amountIn: proposalQuote.quote?.amountInFormatted || sendAmount,
        amountOut:
          proposalQuote.quote?.amountOutFormatted ||
          proposalQuote.receiveAmount,
        slippage: slippagePct || "1",
        quoteDeadline: proposalQuote.quote?.deadline,
        destinationNetwork: receiveNetwork.chainId,
        timeEstimate: proposalQuote.quote?.timeEstimate
          ? `${proposalQuote.quote.timeEstimate} seconds`
          : undefined,
        depositAddress: proposalQuote.quote?.depositAddress,
        signature: proposalQuote.quote?.signature,
      });

      // Get proposal bond
      const deposit = daoPolicy?.proposal_bond || 0;
      const gas = "300000000000000"; // 300 TGas

      // Use quote.amountIn (in smallest units) instead of proposalPayload.amountIn (formatted decimal)
      // The 1Click API returns amountIn in smallest units in the quote object
      const amountInSmallestUnit = proposalQuote.quote?.amountIn || "0";

      // Build mt_transfer args
      const mtTransferArgs = {
        receiver_id: proposalQuote.quote?.depositAddress,
        amount: amountInSmallestUnit, // Amount in smallest units
        token_id: proposalQuote.tokenIn, // Keep nep141: prefix if present
      };

      const calls = [
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
                    description: proposalDescription,
                    kind: {
                      FunctionCall: {
                        receiver_id: "intents.near",
                        actions: [
                          {
                            method_name: "mt_transfer",
                            args: Buffer.from(
                              JSON.stringify(mtTransferArgs)
                            ).toString("base64"),
                            deposit: "1", // 1 yoctoNEAR
                            gas: "100000000000000", // 100 TGas
                          },
                        ],
                      },
                    },
                  },
                },
                gas,
                deposit,
              },
            },
          ],
        },
      ];

      const result = await signAndSendTransactions({
        transactions: calls,
      });

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        // Toast context will automatically fetch proposal ID and invalidate cache
        showToast("ProposalAdded", null, "exchange");
        setTxnCreated(false);
        setShowPreview(false);
        onCloseCanvas();
      }
    } catch (error) {
      console.error("Error submitting proposal:", error);
      showToast("ErrorAddingProposal", null, "exchange");
      setTxnCreated(false);
    }
  }

  const sendNetworks = sendToken?.networks || [];
  const receiveNetworks = receiveToken?.networks || [];

  return (
    <div className="d-flex flex-column gap-3">
      <TransactionLoader showInProgress={isTxnCreated} />
      <Modal
        isOpen={showCancelModal}
        heading="Are you sure you want to cancel?"
        onClose={() => setShowCancelModal(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowCancelModal(false)}
            >
              No
            </button>
            <button
              type="button"
              className="btn theme-btn"
              onClick={() => {
                reset();
                setShowCancelModal(false);
                onCloseCanvas();
              }}
            >
              Yes
            </button>
          </>
        }
      >
        <div>
          This action will clear all the information you have entered in the
          form and cannot be undone.
        </div>
      </Modal>
      {/* Source Wallet */}

      <div className="text-secondary" style={{ fontSize: 13 }}>
        Swap tokens in your NEAR Intents holdings via the 1Click API. Exchanged
        tokens stay in your treasury account.
      </div>

      {/* Combined Send/Receive block matching design */}
      <div className="position-relative">
        {/* Send panel */}
        <div className="border rounded-3 p-3 mb-2">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <label className="mb-0" style={{ fontSize: 18 }}>
              Send
            </label>
            {sendToken && sendNetwork && (
              <div
                className="d-flex align-items-center gap-3 text-secondary"
                style={{ fontSize: 14 }}
              >
                {(() => {
                  const bal = getTokenNetworkBalance(sendToken, sendNetwork);
                  return bal !== null ? (
                    <span>
                      Balance: {formatFixed2(bal)} {sendToken.symbol}
                    </span>
                  ) : null;
                })()}
                <span
                  className="p-1 rounded-2 border cursor-pointer"
                  style={{ backgroundColor: "var(--grey-04)" }}
                  onClick={() => {
                    if (!sendToken || !sendNetwork) return;
                    const bal = getTokenNetworkBalance(sendToken, sendNetwork);
                    if (bal !== null) {
                      setValue("sendAmount", String(bal), {
                        shouldDirty: true,
                      });
                    }
                  }}
                >
                  MAX
                </span>
              </div>
            )}
          </div>
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div className="flex-1" style={{ minWidth: "150px" }}>
              <input type="hidden" {...register("sendToken")} />
              <DropdownWithModal
                hideBorder={true}
                modalTitle="Select Token"
                options={tokenOptions}
                open={sendDropdownOpen}
                onOpenChange={setSendDropdownOpen}
                dropdownLabel="Select token"
                enableSearch={true}
                isLoading={isLoadingTokens}
                renderOption={(opt) => (
                  <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center gap-2">
                      {opt.icon ? (
                        <img
                          src={opt.icon}
                          className="rounded-circle"
                          style={{ width: 24, height: 24 }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            display: "inline-block",
                          }}
                        />
                      )}
                      <div className="d-flex flex-column">
                        <span>{opt.symbol}</span>
                        <span
                          className="text-secondary"
                          style={{ fontSize: 12 }}
                        >
                          {opt.symbol} • {opt.networks?.length || 0} Networks
                        </span>
                      </div>
                    </div>
                    {Number(opt.totalAmount || 0) > 0 && (
                      <div className="text-end">
                        <div>
                          {formatTokenAmount(opt.totalAmount, opt.price)}
                        </div>
                        <div
                          className="text-secondary"
                          style={{ fontSize: 12 }}
                        >
                          {formatUsdValue(opt.totalAmount, opt.price)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                selectedElement={
                  sendToken && sendNetwork ? (
                    <TokenBadge token={sendToken} network={sendNetwork} />
                  ) : null
                }
                onSelect={(opt) => {
                  setValue("sendToken", opt, { shouldDirty: true });
                  setValue("sendNetwork", null, { shouldDirty: true });
                  if (opt?.networks?.length) setNetworkModalSide("send");
                  setSendDropdownOpen(false);
                }}
                modalSize="lg"
              />
              {errors.sendToken && (
                <div className="invalid-feedback d-block">
                  {errors.sendToken.message}
                </div>
              )}
            </div>
            <div className="text-end flex-2">
              <input
                type="number"
                min="0"
                step="any"
                className={`no-focus form-control text-end border-0 p-0  ${
                  errors.sendAmount ? "is-invalid" : ""
                }`}
                placeholder="00.00"
                {...register("sendAmount")}
              />
              {errors.sendAmount && (
                <div className="invalid-feedback d-block">
                  {errors.sendAmount.message}
                </div>
              )}

              <div className="text-secondary" style={{ fontSize: 12 }}>
                ≈
                {formatUsdValue(Number(sendAmount || 0), sendToken?.price || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Divider with overlay swap */}
        <div className="position-relative my-2">
          <button
            type="button"
            className="btn btn-light border rounded-3 position-absolute top-50 start-50 translate-middle"
            onClick={swapDirections}
            title="Swap"
            style={{ width: 40, height: 40 }}
            disabled={isFetchingDryQuote}
          >
            {isFetchingDryQuote ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              <i className="bi bi-arrow-down-up"></i>
            )}
          </button>
        </div>

        {/* Receive panel */}
        <div className="border rounded-3 p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="mb-0" style={{ fontSize: 18 }}>
              Receive
            </label>
            <div className="text-secondary" style={{ fontSize: 14 }}>
              {(() => {
                if (!receiveToken || !receiveNetwork) return null;
                const bal = getTokenNetworkBalance(
                  receiveToken,
                  receiveNetwork
                );
                return bal !== null ? (
                  <span>
                    Balance: {formatFixed2(bal)} {receiveToken.symbol}
                  </span>
                ) : null;
              })()}
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div className="flex-1" style={{ minWidth: "150px" }}>
              <input type="hidden" {...register("receiveToken")} />
              <DropdownWithModal
                hideBorder={true}
                modalTitle="Select Token"
                options={tokenOptions}
                open={receiveDropdownOpen}
                onOpenChange={setReceiveDropdownOpen}
                dropdownLabel="Select token"
                enableSearch={true}
                isLoading={isLoadingTokens}
                renderOption={(opt) => (
                  <div className="d-flex align-items-center justify-content-between w-100">
                    <div className="d-flex align-items-center gap-2">
                      {opt.icon && (
                        <img
                          src={opt.icon}
                          className="rounded-circle"
                          style={{ width: 24, height: 24 }}
                        />
                      )}
                      <div className="d-flex flex-column">
                        <span>{opt.symbol}</span>
                        <span
                          className="text-secondary"
                          style={{ fontSize: 12 }}
                        >
                          {opt.symbol} • {opt.networks?.length || 0} Networks
                        </span>
                      </div>
                    </div>
                    {Number(opt.totalAmount || 0) > 0 && (
                      <div className="text-end">
                        <div>
                          {formatTokenAmount(opt.totalAmount, opt.price)}
                        </div>
                        <div
                          className="text-secondary"
                          style={{ fontSize: 12 }}
                        >
                          {formatUsdValue(opt.totalAmount, opt.price)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                selectedElement={
                  receiveToken && receiveNetwork ? (
                    <TokenBadge token={receiveToken} network={receiveNetwork} />
                  ) : null
                }
                onSelect={(opt) => {
                  setValue("receiveToken", opt, { shouldDirty: true });
                  setValue("receiveNetwork", null, { shouldDirty: true });
                  if (opt?.networks?.length) setNetworkModalSide("receive");
                  setReceiveDropdownOpen(false);
                }}
                modalSize="lg"
              />
              {errors.receiveToken && (
                <div className="invalid-feedback d-block">
                  {errors.receiveToken.message}
                </div>
              )}
            </div>
            {dryQuoteError ? (
              <div className="text-danger flex-2 text-end">{dryQuoteError}</div>
            ) : (
              <div className="text-end flex-2">
                <div className="fw-bold border-0">
                  {dryQuote
                    ? formatNumberWithCommas(dryQuote.receiveAmount)
                    : "00.00"}
                </div>
                {dryQuote && (
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    ≈$
                    {dryQuote
                      ? formatNumberWithCommas(
                          (dryQuote.receiveAmount || 0) *
                            (receiveToken?.price || 0)
                        )
                      : "0.00"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rate line */}
        <div className="mt-2 text-secondary text-end" style={{ fontSize: 14 }}>
          {sendToken && receiveToken && dryQuote && (
            <>
              1 {sendToken.symbol} ($
              {formatNumberWithCommas(sendToken?.price || 0)}) ≈{" "}
              {formatNumberWithCommas(dryQuote?.rate || 0) || "-"}{" "}
              {receiveToken.symbol}
            </>
          )}
        </div>
      </div>

      {/* Network selection modal (triggered after token selection) */}
      <Modal
        isOpen={!!networkModalSide}
        heading={`Select Network for ${
          networkModalSide === "send" ? sendToken?.symbol : receiveToken?.symbol
        }`}
        onClose={() => setNetworkModalSide(null)}
        size="lg"
        footer={
          <div className="w-100 text-center">
            <div
              className="cursor-pointer text-color h6 mb-0"
              onClick={() => {
                const side = networkModalSide;
                setNetworkModalSide(null);
                if (side === "send") setSendDropdownOpen(true);
                if (side === "receive") setReceiveDropdownOpen(true);
              }}
            >
              Back
            </div>
          </div>
        }
      >
        <div className="d-flex flex-column gap-2">
          {(networkModalSide === "send" ? sendNetworks : receiveNetworks).map(
            (n) => (
              <div
                key={n.id}
                className="dropdown-item cursor-pointer p-2 rounded d-flex align-items-center justify-content-between w-100"
                onClick={() => {
                  if (networkModalSide === "send")
                    setValue("sendNetwork", n, { shouldDirty: true });
                  if (networkModalSide === "receive")
                    setValue("receiveNetwork", n, { shouldDirty: true });
                  setNetworkModalSide(null);
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  {n.icon ? (
                    <img
                      src={n.icon}
                      className="rounded-circle"
                      style={{ width: 24, height: 24 }}
                    />
                  ) : (
                    <span
                      style={{ width: 24, height: 24, display: "inline-block" }}
                    />
                  )}
                  <span>{n.label}</span>
                </div>
                {Number(n.amount || 0) > 0 && (
                  <div className="text-end" style={{ minWidth: 120 }}>
                    <div className="fw-semibold">{formatFixed2(n.amount)}</div>
                    <div className="text-secondary" style={{ fontSize: 12 }}>
                      ≈$
                      {formatFixed2(
                        (n.amount || 0) *
                          (sendToken?.price || receiveToken?.price || 0)
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </Modal>

      {/* Slippage */}
      <div className="d-flex flex-column gap-1">
        <label className="d-flex align-items-center gap-1">
          Price Slippage Limit (%){" "}
          <Tooltip tooltip="Max price movement allowed before order fails." />
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          className="form-control"
          defaultValue="1"
          {...register("slippagePct")}
        />
      </div>

      {/* Notes */}
      <div className="d-flex flex-column gap-1">
        <label>Notes (Optional)</label>
        <textarea className="form-control" rows={3} {...register("notes")} />
      </div>

      {sendToken &&
        sendNetwork &&
        sendAmount &&
        getTokenNetworkBalance(sendToken, sendNetwork) !== null &&
        parseFloat(sendAmount) >
          parseFloat(getTokenNetworkBalance(sendToken, sendNetwork)) && (
          <div className="warning-box d-flex gap-3 align-items-center px-3 py-2 rounded-3">
            <i className="bi bi-exclamation-triangle h5"></i>
            <div>
              The treasury balance is insufficient to cover the exchange. You
              can create the request, but it won't be approved until the balance
              is topped up.
            </div>
          </div>
        )}
      <div className="d-flex mt-2 gap-3 justify-content-end">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setShowCancelModal(true)}
          disabled={!isDirty || isFetchingDryQuote}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn theme-btn"
          onClick={fetchProposalQuote}
          disabled={isFetchingDryQuote || isFetchingProposalQuote}
        >
          {isFetchingProposalQuote
            ? "Fetching Deposit Address..."
            : !sendNetwork || !receiveNetwork
            ? "Select Token"
            : "Preview"}
        </button>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreview}
        heading={<div className="h5 mb-0 fw-bold">Confirm</div>}
        onClose={() => setShowPreview(false)}
        size="lg"
      >
        <div className="position-relative">
          {/* Overlay */}
          {isFetchingProposalQuote && (
            <div
              className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.1)",
                color: "white",
                zIndex: 999,
                borderRadius: "8px",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <span>Refetching quote</span>
                <div
                  className="spinner-border spinner-border-lg"
                  role="status"
                ></div>
              </div>
            </div>
          )}

          <div
            style={{
              opacity: isFetchingProposalQuote ? 0.3 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            <div className="d-flex flex-column gap-3">
              {/* Preview top: tokens with amounts and USD */}
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div className="d-flex flex-column align-items-center flex-1 gap-2">
                  <div className="h6 mb-0">Send</div>
                  <TokenBadge
                    token={sendToken}
                    network={sendNetwork}
                    hideSymbol={true}
                  />
                  <div className="fw-bold mt-2">
                    {formatNumberWithCommas(Number(sendAmount || 0))}{" "}
                    {sendToken?.symbol}
                  </div>
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    ≈
                    {formatUsdValue(
                      Number(sendAmount || 0),
                      sendToken?.price || 0
                    )}
                  </div>
                </div>
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{ minWidth: 40 }}
                >
                  <i className="bi bi-arrow-right"></i>
                </div>
                <div className="d-flex flex-column align-items-center flex-1 gap-2">
                  <div className="h6 mb-0">Receive</div>
                  <TokenBadge
                    token={receiveToken}
                    network={receiveNetwork}
                    hideSymbol={true}
                  />
                  <div className="fw-bold mt-2">
                    {formatNumberWithCommas(
                      Number(proposalQuote?.quote?.amountOutFormatted || 0)
                    )}{" "}
                    {receiveToken?.symbol}
                  </div>
                  <div className="text-secondary" style={{ fontSize: 12 }}>
                    ≈
                    {formatUsdValue(
                      Number(proposalQuote?.quote?.amountOutUsd || 0),
                      1
                    )}
                  </div>
                </div>
              </div>

              <div className="border rounded-3 p-3 d-flex flex-column gap-2">
                <div className="d-flex justify-content-between ">
                  <span className="text-secondary">Rate</span>
                  <span>
                    1 {sendToken?.symbol} ($
                    {formatNumberWithCommas(sendToken?.price || 0)}) ≈{" "}
                    {formatNumberWithCommas(proposalQuote?.rate || 0)}{" "}
                    {receiveToken?.symbol}
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">
                    Price Difference{" "}
                    <Tooltip tooltip="Difference from mid-market price." />
                  </span>
                  <span>
                    {formatNumberWithCommas(proposalQuote?.priceDiffPct || 0)}%
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">
                    Estimated Time{" "}
                    <Tooltip tooltip="Approximate time to complete the swap." />
                  </span>
                  <span>{proposalQuote?.quote?.timeEstimate || 0} seconds</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Minimum Received</span>
                  <span>
                    {formatNumberWithCommas(
                      Big(proposalQuote?.quote?.minAmountOut || 0).div(
                        Big(10).pow(receiveNetwork?.decimals || 0)
                      )
                    )}{" "}
                    {receiveToken?.symbol}
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Deposit Address</span>
                  <span className="text-monospace">
                    {proposalQuote?.quote?.depositAddress}
                  </span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-secondary">Quote Expires</span>
                  <span>
                    {formatDateTimeWithTimezone(proposalQuote?.quote?.deadline)}
                  </span>
                </div>
                {/* <div className="d-flex justify-content-between">
              <span className="text-secondary">Widget Fee (0.35%)</span>
              <span></span>
            </div> */}
              </div>

              <div
                className="warning-box d-flex gap-3 px-3 py-2 rounded-3 align-items-center"
                style={{ fontSize: 15 }}
              >
                <i className="bi bi-exclamation-triangle h5 mb-0"></i>
                <span>
                  Please approve this request within 24 hours - otherwise, it
                  will be expired. We recommend confirming as soon as possible.
                </span>
              </div>

              {!isFetchingProposalQuote && (
                <div className="text-center text-secondary">
                  Exchange rate will refresh in {proposalRefreshCountdown}s
                </div>
              )}

              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn theme-btn"
                  disabled={isFetchingProposalQuote || isTxnCreated}
                  onClick={onSubmit}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CreateAssetExchangeRequest;

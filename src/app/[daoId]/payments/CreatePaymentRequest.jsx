"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Big from "big.js";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Modal from "@/components/ui/Modal";
import WalletDropdown from "@/components/dropdowns/WalletDropdown";
import DropdownWithModal from "@/components/dropdowns/DropdownWithModal";
import TokensDropdown from "@/components/dropdowns/TokensDropdown";
import AccountInput from "@/components/forms/AccountInput";
import OtherChainAccountInput from "@/components/forms/OtherChainAccountInput";
import Tooltip from "@/components/ui/Tooltip";
import { useDao } from "@/context/DaoContext";
import { Near } from "@/api/near";
import {
  getNearPrice,
  searchProposals as searchProposalsAPI,
  fetchApprovedProposals,
} from "@/api/backend";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import { parseString } from "@/helpers/formatters";
import { useNearWallet } from "@/context/NearWalletContext";
import { useProposalToastContext } from "@/context/ProposalToastContext";

const tokenMapping = {
  NEAR: "NEAR",
  USDT: "usdt.tether-token.near",
  USDC: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
};

const CreatePaymentRequest = ({
  onCloseCanvas = () => {},
  setIsBulkImport,
}) => {
  const { showToast } = useProposalToastContext();
  const {
    daoId: treasuryDaoID,
    lockupContract,
    lockupNearBalances,
    lastProposalId,
    daoPolicy,
    intentsBalances,
    refetchLastProposalId,
    customConfig,
  } = useDao();
  const router = useRouter();
  const { signAndSendTransactions, accountId } = useNearWallet();

  const showProposalSelection = customConfig?.showProposalSelection;

  // Custom setValue wrapper with defaults
  const setValueWithDefaults = (name, value, options = {}) => {
    setValue(name, value, {
      shouldDirty: true,
      shouldValidate: true,
      ...options,
    });
  };

  // React Hook Form setup - manages ALL form state
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isDirty, isValid },
    reset,
  } = useForm({
    mode: "onSubmit", // Validate only on submit (cleaner UX)
    reValidateMode: "onChange", // Re-validate on change after first submit
    defaultValues: {
      // Proposal fields
      proposalTitle: "",
      proposalSummary: "",
      proposalId: "",

      // Payment fields
      selectedWallet: null,
      tokenId: null,
      receiver: "",
      amount: "",
      notes: "",

      // Internal state
      selectedTokenBlockchain: null,
      selectedTokenIsIntent: false,
      isReceiverAccountValid: false,
      selectedTokensAvailable: null,
      isReceiverRegistered: false,
    },
  });

  // Watch form values
  const selectedWallet = watch("selectedWallet");
  const tokenId = watch("tokenId");
  const receiver = watch("receiver");
  const amount = watch("amount");
  const notes = watch("notes");
  const selectedTokenBlockchain = watch("selectedTokenBlockchain");
  const selectedTokenIsIntent = watch("selectedTokenIsIntent");
  const isReceiverAccountValid = watch("isReceiverAccountValid");
  const selectedTokensAvailable = watch("selectedTokensAvailable");
  const isReceiverRegistered = watch("isReceiverRegistered");

  // Non-form state (for UI and data fetching)
  const [proposalsArray, setProposalsArray] = useState([]);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [proposalsOptions, setProposalsOptions] = useState([]);
  const [searchProposalId, setSearchProposalId] = useState("");
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [parsedAmount, setParsedAmount] = useState(null);
  const [isManualRequest, setIsManualRequest] = useState(false);
  const [isLoadingProposals, setLoadingProposals] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [nearPrice, setNearPrice] = useState("1");

  useEffect(() => {
    if (!showProposalSelection) {
      setIsManualRequest(true);
    }
  }, [showProposalSelection]);

  function setProposalData(result) {
    const proposalsData = result;
    const data = [];
    for (const prop of proposalsData) {
      data.push({
        label: (
          <span className="text-sm">
            <b>#{prop.sequentialId}</b>{" "}
            {parseString(prop?.eligibilityAnswers?.[0].answer)}{" "}
          </span>
        ),
        value: prop.sequentialId,
      });
    }
    setProposalsArray(proposalsData);
    setProposalsOptions(data);
    setLoadingProposals(false);
  }

  function searchProposals() {
    searchProposalsAPI(customConfig.proposalAPIEndpoint, searchProposalId).then(
      (result) => {
        setProposalData(result);
      }
    );
  }

  function fetchProposals() {
    fetchApprovedProposals(customConfig.proposalAPIEndpoint).then((result) => {
      const proposals = (result || []).slice(0, 10);
      setProposalData(proposals);
    });
  }

  function cleanInputs() {
    setSelectedProposal(null);
    reset(); // Reset React Hook Form - clears all form fields
  }

  useEffect(() => {
    if (!customConfig.proposalAPIEndpoint) return;

    const handler = setTimeout(() => {
      setLoadingProposals(true);
      if (searchProposalId) {
        searchProposals();
      } else {
        fetchProposals();
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchProposalId, customConfig.proposalAPIEndpoint]);

  // Fetch NEAR price
  useEffect(() => {
    function fetchNearPriceData() {
      getNearPrice().then((price) => {
        if (typeof price === "number") {
          setNearPrice(price);
        }
      });
    }

    const interval = setInterval(() => {
      fetchNearPriceData();
    }, 60_000);

    fetchNearPriceData();
    return () => clearInterval(interval);
  }, []);

  function onSelectProposal(id) {
    if (!id) {
      setSelectedProposal(null);
      return;
    }

    const proposal = proposalsArray.find(
      (item) => item.sequentialId === id.value
    );

    if (proposal !== null) {
      setSelectedProposal({
        name: parseString(proposal.eligibilityAnswers?.[0]?.answer ?? ""),
        summary: parseString(proposal.eligibilityAnswers?.[1]?.answer ?? ""),
        proposal_id: proposal.sequentialId,
        status: proposal.status,
        url: `https://nearn.io/devhub/${proposal.listing.sequentialId}/${proposal.sequentialId}`,
      });
      const token = tokenMapping[proposal.token];
      if (token === tokenMapping.NEAR) {
        const nearTokens = Big(proposal.ask).div(nearPrice).toFixed();
        setValue("amount", nearTokens, { shouldDirty: true });
      } else {
        setValue("amount", proposal.ask, { shouldDirty: true });
      }
      const receiverAccount = proposal.user?.publicKey;
      setValue("receiver", receiverAccount, { shouldDirty: true });
      setValue("tokenId", token, { shouldDirty: true });
      setValue("proposalId", id.value, { shouldDirty: true });
    }
  }

  useEffect(() => {
    if (amount && tokenId) {
      const isNEAR = tokenId === tokenMapping.NEAR;
      if (isNEAR) {
        setParsedAmount(
          Big(amount ? amount : 0)
            .mul(Big(10).pow(24))
            .toFixed()
        );
      } else {
        Near.view(tokenId, "ft_metadata", {}).then((ftMetadata) => {
          setParsedAmount(
            Big(amount ? amount : 0)
              .mul(Big(10).pow(ftMetadata.decimals))
              .toFixed()
          );
        });
      }
    }
  }, [amount, tokenId]);

  const onSubmit = async (data) => {
    // Check additional validations beyond form validation
    if (!isReceiverAccountValid || !isAmountValid()) {
      return;
    }

    setTxnCreated(true);
    const isNEAR = tokenId === tokenMapping.NEAR;
    const gas = "270000000000000"; // 270 Tgas for transfer
    const gasForIntentAction = Big(30).mul(Big(10).pow(12)).toFixed(); // 30 Tgas for ft_withdraw
    const deposit = daoPolicy?.proposal_bond || 0;
    const description = {
      title: selectedProposal.name,
      summary: selectedProposal.summary,
      notes: notes,
    };

    if (!isManualRequest) {
      description["proposalId"] = selectedProposalId;
      description["url"] = selectedProposal.url;
    }

    const isLockupTransfer = selectedWallet.value === lockupContract;
    let proposalKind;

    if (selectedTokenIsIntent) {
      if (selectedTokenBlockchain && selectedTokenBlockchain !== "near") {
        // Non-NEAR / Intent-based payment
        const ftWithdrawArgs = {
          token: tokenId, // This is the NEAR FT contract, e.g., "btc.omft.near"
          receiver_id: tokenId, // Per test expectation, this is also the token contract ID for intents.near
          amount: parsedAmount, // Amount in FT's decimals (e.g., 2 * 10^8 for 2 BTC if 8 decimals)
          memo: `WITHDRAW_TO:${receiver}`, // `receiver` holds the actual off-chain address
        };

        proposalKind = {
          FunctionCall: {
            receiver_id: "intents.near",
            actions: [
              {
                method_name: "ft_withdraw",
                args: Buffer.from(JSON.stringify(ftWithdrawArgs)).toString(
                  "base64"
                ),
                deposit: "1",
                gas: gasForIntentAction,
              },
            ],
          },
        };
      } else {
        // NEAR / Intent-based payment
        const ftWithdrawArgs = {
          token: tokenId,
          receiver_id: receiver,
          amount: parsedAmount,
        };

        proposalKind = {
          FunctionCall: {
            receiver_id: "intents.near",
            actions: [
              {
                method_name: "ft_withdraw",
                args: Buffer.from(JSON.stringify(ftWithdrawArgs)).toString(
                  "base64"
                ),
                deposit: "1",
                gas: gasForIntentAction,
              },
            ],
          },
        };
      }
    }

    if (isLockupTransfer) {
      description["proposal_action"] = "transfer";
    }

    function toBase64(json) {
      return Buffer.from(JSON.stringify(json)).toString("base64");
    }

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
                  description: encodeToMarkdown(description),
                  kind: selectedTokenIsIntent
                    ? proposalKind
                    : isLockupTransfer
                    ? {
                        FunctionCall: {
                          receiver_id: lockupContract,
                          actions: [
                            {
                              method_name: "transfer",
                              args: toBase64({
                                amount: parsedAmount,
                                receiver_id: receiver,
                              }),
                              deposit: "0",
                              gas,
                            },
                          ],
                        },
                      }
                    : {
                        Transfer: {
                          token_id: isNEAR ? "" : tokenId,
                          receiver_id: receiver,
                          amount: parsedAmount,
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

    if (!selectedTokenIsIntent && !isReceiverRegistered && !isNEAR) {
      const depositInYocto = Big(0.125).mul(Big(10).pow(24)).toFixed();
      calls.push({
        receiverId: tokenId,
        signerId: accountId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "storage_deposit",
              args: {
                account_id: receiver,
                registration_only: true,
              },
              gas,
              deposit: depositInYocto,
            },
          },
        ],
      });
    }

    console.log("Payment request calls:", calls);
    try {
      const result = await signAndSendTransactions({
        transactions: calls,
      });

      console.log("Payment request result:", result);

      if (result && result.length > 0 && result[0]?.status?.SuccessValue) {
        cleanInputs();
        showToast("ProposalAdded", null, "payment");
        setTxnCreated(false);
        onCloseCanvas();
      }
    } catch (error) {
      console.error("Payment request error:", error);
      showToast("ErrorAddingProposal", null, "payment");
      setTxnCreated(false);
    }
  };

  function isAmountValid() {
    const maxU128 = Big("340282366920938463463374607431768211455");

    if (!parsedAmount) {
      return false;
    }
    if (Big(parsedAmount).gt(maxU128)) {
      return false;
    }
    if (Big(parsedAmount).lte(0)) {
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (
      !selectedTokenIsIntent &&
      tokenId &&
      tokenId !== tokenMapping.NEAR &&
      receiver &&
      isReceiverAccountValid
    ) {
      Near.view(tokenId, "storage_balance_of", {
        account_id: receiver,
      }).then((storage) => {
        if (!storage) {
          setValue("isReceiverRegistered", false);
        } else {
          setValue("isReceiverRegistered", true);
        }
      });
    }
  }, [receiver, tokenId, selectedTokenIsIntent, isReceiverAccountValid]);

  // Trigger validation when account validity changes
  useEffect(() => {
    if (receiver) {
      trigger("receiver");
    }
  }, [isReceiverAccountValid, receiver, trigger]);

  return (
    <div>
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
                cleanInputs();
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
      <div className="d-flex flex-column gap-3">
        <WalletDropdown
          showIntents={true}
          selectedValue={selectedWallet}
          onUpdate={(v) => {
            // Only update if the value actually changed
            if (v.value === selectedWallet?.value) {
              return;
            }

            // Set the new wallet
            setValueWithDefaults("selectedWallet", v);

            // Clear other fields when wallet changes
            setValue("selectedTokenBlockchain", null);
            setValue("tokenId", null);
            setValue("receiver", "");
            setValue("amount", "");
            setValue("notes", "");
            setValue("selectedTokenIsIntent", false);
            setValue("isReceiverAccountValid", false);
            setValue("selectedTokensAvailable", null);
            setValue("isReceiverRegistered", false);
            setSelectedProposal(null);
          }}
        />
        {selectedWallet && (
          <div className="d-flex flex-column gap-3">
            {selectedWallet.value === treasuryDaoID && (
              <div className="text-secondary">
                You can send a payment request to only one recipient at a time.
                Need to send many?{" "}
                <span
                  className="text-primary text-decoration-underline cursor-pointer"
                  onClick={() => setIsBulkImport && setIsBulkImport(true)}
                >
                  Import Multiple Payment Requests
                </span>
              </div>
            )}
            {intentsBalances &&
              !intentsBalances?.length &&
              selectedWallet.value === "intents.near" && (
                <div className="d-flex flex-column gap-2 border border-1 px-4 py-3 rounded-3 text-center justify-content-center align-items-center">
                  Your NEAR Intents wallet has no tokens. Fund it now to start
                  using the platform's features
                  <button
                    className="btn theme-btn"
                    onClick={() =>
                      router.push(`/${treasuryDaoID}/dashboard?deposit=intents`)
                    }
                  >
                    Deposit
                  </button>
                </div>
              )}

            {/* Only show form if not intents wallet or if intents wallet has balance */}
            {!(
              selectedWallet.value === "intents.near" &&
              (!intentsBalances || !intentsBalances?.length)
            ) && (
              <>
                {showProposalSelection && !isManualRequest && (
                  <div className="d-flex flex-column gap-2">
                    <label>Proposal</label>
                    <DropdownWithModal
                      modalTitle="Select Proposal"
                      options={proposalsOptions}
                      onSelect={(option) => {
                        setIsManualRequest(false);
                        onSelectProposal(option);
                      }}
                      renderOption={(option) => option.label}
                      dropdownLabel="Select proposal"
                      selectedElement={
                        selectedProposal ? (
                          <div className="text-left">
                            <strong>#{selectedProposal.proposal_id}</strong> -{" "}
                            {selectedProposal.name}
                          </div>
                        ) : null
                      }
                      enableSearch={true}
                      searchPlaceholder="Search by id or title"
                      onSearch={(value) => setSearchProposalId(value)}
                      isLoading={isLoadingProposals}
                      dataTestId="proposal-dropdown"
                      modalSize="lg"
                    />
                    <button
                      type="button"
                      className="btn btn-link text-start p-0 d-flex align-items-center gap-2"
                      onClick={() => {
                        // Only clear proposal-related state, keep payment fields
                        setSelectedProposal(null);
                        setValue("proposalTitle", "");
                        setValue("proposalSummary", "");
                        setValue("proposalId", "");
                        setIsManualRequest(true);
                      }}
                      style={{ color: "var(--theme-color)" }}
                    >
                      <i className="bi bi-plus-lg"></i>
                      Add manual request
                    </button>
                  </div>
                )}
                {isManualRequest && (
                  <div className="d-flex flex-column gap-3">
                    <div className="d-flex flex-column gap-1">
                      <label htmlFor="proposalTitle">
                        {showProposalSelection && "Proposal"} Title
                        {errors.proposalTitle && (
                          <span className="text-danger ms-1">*</span>
                        )}
                      </label>
                      <textarea
                        id="proposalTitle"
                        className={`form-control ${
                          errors.proposalTitle ? "is-invalid" : ""
                        }`}
                        rows={3}
                        {...register("proposalTitle", {
                          required: "Title is required",
                        })}
                        onChange={(e) => {
                          setValue("proposalTitle", e.target.value, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setSelectedProposal((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }));
                        }}
                      />
                      {errors.proposalTitle && (
                        <div className="invalid-feedback d-block">
                          {errors.proposalTitle.message}
                        </div>
                      )}
                    </div>
                    <div className="d-flex flex-column gap-1">
                      <label htmlFor="proposalSummary">
                        {showProposalSelection && "Proposal"} Summary
                      </label>
                      <textarea
                        id="proposalSummary"
                        className={`form-control ${
                          errors.proposalSummary ? "is-invalid" : ""
                        }`}
                        rows={3}
                        {...register("proposalSummary")}
                        onChange={(e) => {
                          setValue("proposalSummary", e.target.value, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setSelectedProposal((prev) => ({
                            ...prev,
                            summary: e.target.value,
                          }));
                        }}
                      />
                      {errors.proposalSummary && (
                        <div className="invalid-feedback d-block">
                          {errors.proposalSummary.message}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedProposal && !isManualRequest && (
                  <div className="border p-3 rounded-3 d-flex flex-column gap-2">
                    <h6 className="d-flex gap-2 mb-0 align-items-start">
                      {selectedProposal.name}{" "}
                      <span className="badge bg-success">
                        {selectedProposal.status}
                      </span>
                    </h6>
                    <div>{selectedProposal.summary}</div>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={selectedProposal.url}
                    >
                      <button className="btn p-0 d-flex align-items-center gap-2 fw-semi-bold text-color">
                        Open Proposal{" "}
                        <i className="bi bi-box-arrow-up-right"></i>
                      </button>
                    </a>
                  </div>
                )}

                <div className="d-flex flex-column gap-1">
                  <label htmlFor="tokenId">
                    Requested Token
                    {errors.tokenId && (
                      <span className="text-danger ms-1">*</span>
                    )}
                  </label>
                  {/* Hidden input for form validation */}
                  <input
                    type="hidden"
                    {...register("tokenId", {
                      required: "Token selection is required",
                    })}
                  />
                  <TokensDropdown
                    daoAccount={selectedWallet.value}
                    selectedValue={tokenId}
                    onChange={(v) => setValueWithDefaults("tokenId", v)}
                    setSelectedTokenBlockchain={(blockchain) => {
                      if (blockchain !== selectedTokenBlockchain) {
                        setValue("receiver", "");
                        setValue("isReceiverAccountValid", false);
                        setValueWithDefaults(
                          "selectedTokenBlockchain",
                          blockchain
                        );
                      }
                    }}
                    setTokensAvailable={(v) =>
                      setValue("selectedTokensAvailable", v)
                    }
                    setSelectedTokenIsIntent={(v) =>
                      setValue("selectedTokenIsIntent", v)
                    }
                    lockupNearBalances={lockupNearBalances}
                    lockupContract={lockupContract}
                    selectedWallet={selectedWallet.value}
                  />
                  {errors.tokenId && (
                    <div className="invalid-feedback d-block">
                      {errors.tokenId.message}
                    </div>
                  )}
                </div>
                <div className="d-flex flex-column gap-1">
                  <label htmlFor="receiver">
                    Recipient
                    {errors.receiver && (
                      <span className="text-danger ms-1">*</span>
                    )}
                  </label>
                  {/* Hidden input for form validation */}
                  <input
                    type="hidden"
                    {...register("receiver", {
                      required: "Recipient is required",
                      validate: (value) => {
                        if (!value) return "Recipient is required";
                        // Only validate account validity if we have a value and it's not currently being checked
                        if (value && !isReceiverAccountValid) {
                          return "Invalid recipient address";
                        }
                        return true;
                      },
                    })}
                  />
                  {selectedTokenBlockchain === "near" ||
                  selectedTokenBlockchain == null ? (
                    <AccountInput
                      value={receiver}
                      placeholder="treasury.near"
                      onUpdate={(v) => setValueWithDefaults("receiver", v)}
                      setParentAccountValid={(v) =>
                        setValue("isReceiverAccountValid", v)
                      }
                      maxWidth="100%"
                      allowNonExistentImplicit={true}
                    />
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      <OtherChainAccountInput
                        blockchain={selectedTokenBlockchain}
                        value={receiver}
                        setValue={(v) => setValueWithDefaults("receiver", v)}
                        setIsValid={(v) =>
                          setValue("isReceiverAccountValid", v)
                        }
                      />
                    </div>
                  )}
                  {errors.receiver && (
                    <div className="invalid-feedback d-block">
                      {errors.receiver.message}
                    </div>
                  )}
                </div>
                <div className="d-flex flex-column gap-1">
                  <label htmlFor="amount">
                    Total Amount
                    {errors.amount && (
                      <span className="text-danger ms-1">*</span>
                    )}
                  </label>
                  <input
                    id="amount"
                    type="number"
                    min="0"
                    step="any"
                    className={`form-control ${
                      errors.amount ? "is-invalid" : ""
                    }`}
                    placeholder="Enter amount"
                    {...register("amount", {
                      required: "Amount is required",
                      min: {
                        value: 0.000001,
                        message: "Amount must be greater than 0",
                      },
                      validate: {
                        maxU128: (value) => {
                          const maxU128 = Big(
                            "340282366920938463463374607431768211455"
                          );
                          if (Big(value || 0).gt(maxU128)) {
                            return "Amount exceeds maximum allowed value";
                          }
                          return true;
                        },
                      },
                    })}
                    onChange={(e) => {
                      setValue("amount", e.target.value, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                  />
                  {errors.amount && (
                    <div className="invalid-feedback d-block">
                      {errors.amount.message}
                    </div>
                  )}
                  {tokenId === tokenMapping.NEAR && (
                    <div className="d-flex gap-2 align-items-center justify-content-between">
                      <div className="d-flex gap-1 align-items-center">
                        {"$" +
                          Big(amount ? amount : 0)
                            .mul(nearPrice)
                            .toFixed(2)
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        <Tooltip tooltip="The USD value is calculated based on token prices from CoinGecko and updates automatically every minute." />
                      </div>
                      <div>${Big(nearPrice).toFixed(2)}</div>
                    </div>
                  )}
                </div>
                {selectedTokensAvailable &&
                  amount &&
                  parseFloat(selectedTokensAvailable) <
                    parseFloat(amount ? amount : 0) && (
                    <div className="warning-box d-flex gap-3 align-items-center px-3 py-2 rounded-3">
                      <i className="bi bi-exclamation-triangle h5"></i>
                      <div>
                        The treasury balance is insufficient to cover the
                        payment. You can create the request, but it won't be
                        approved until the balance is topped up.
                      </div>
                    </div>
                  )}

                <div className="d-flex flex-column gap-1">
                  <label htmlFor="notes">Notes (Optional)</label>
                  <textarea
                    id="notes"
                    className="form-control"
                    rows={3}
                    {...register("notes")}
                    onChange={(e) => {
                      setValue("notes", e.target.value, { shouldDirty: true });
                    }}
                  />
                </div>
                <div className="d-flex mt-2 gap-3 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setShowCancelModal(true);
                    }}
                    disabled={!isDirty || isTxnCreated}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn theme-btn"
                    disabled={isTxnCreated}
                    onClick={handleSubmit(onSubmit)}
                  >
                    {isTxnCreated ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatePaymentRequest;

"use client";

import React, { useState, useMemo, useEffect, useCallback, memo } from "react";
import Big from "big.js";
import { useDao } from "@/context/DaoContext";
import { useNearWallet } from "@/context/NearWalletContext";
import {
  viewStorageCredits,
  generateListId,
  submitPaymentList,
  buildApproveListProposal,
} from "@/api/bulk-payment";
import { Near } from "@/api/near";
import { isValidNearAccount } from "@/helpers/nearHelpers";
import Modal from "@/components/ui/Modal";
import OffCanvas from "@/components/ui/OffCanvas";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Profile from "@/components/ui/Profile";
import TokenAmount from "@/components/proposals/TokenAmount";
import Tooltip from "@/components/ui/Tooltip";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import { REFRESH_DELAY } from "@/constants/ui";
import Edit from "@/components/icons/Edit";
import AccountInput from "@/components/forms/AccountInput";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import { parseAmount } from "@/helpers/formatters";

/**
 * Memoized table row component to prevent unnecessary re-renders
 */
const PaymentRow = memo(function PaymentRow({
  item,
  index,
  onEdit,
  onDelete,
  error,
  selectedToken,
  isUnregistered,
}) {
  const hasError = error && error.length > 0;
  const isRecipientError =
    hasError &&
    (error.toLowerCase().includes("recipient") ||
      error.toLowerCase().includes("invalid") ||
      error.toLowerCase().includes("does not exist"));

  return (
    <tr>
      <td style={{ width: "50px" }}>{index + 1}</td>
      <td>
        <div className="d-flex align-items-center gap-2">
          {isRecipientError ? (
            <span className="small">{item["Recipient"] || ""}</span>
          ) : (
            <Profile accountId={item["Recipient"]} showKYC={false} />
          )}
          {isUnregistered && (
            <span
              className="warning-box p-1 px-2 rounded-4 text-sm"
              title="Storage deposit required"
            >
              Unregistered
            </span>
          )}
        </div>
      </td>
      <td>{hasError && <span className="text-danger small">{error}</span>}</td>
      <td className="text-end">
        <TokenAmount
          amountWithDecimals={item["Amount"]}
          address={selectedToken?.contract}
          showUSDValue={true}
        />
      </td>
      <td style={{ width: "100px" }}>
        <div className="d-flex gap-2 justify-content-end">
          <button
            className="btn btn-sm btn-link p-0 text-decoration-none"
            onClick={() => onEdit(index)}
            title="Edit"
          >
            <Edit width={24} height={24} />
          </button>
          <button
            className="btn btn-sm btn-link p-0 text-decoration-none"
            onClick={() => onDelete(index)}
            title="Delete"
          >
            <i className="bi bi-trash text-danger h5 mb-0"></i>
          </button>
        </div>
      </td>
    </tr>
  );
});

/**
 * BulkImportPreviewTable Component
 * Full page preview of bulk payment requests with edit/delete functionality
 */
const BulkImportPreviewTable = ({
  proposals = [],
  closePreviewTable,
  sourceWallet,
  selectedToken, // Full token object with metadata
  title = "", // User-provided title for the bulk payment
}) => {
  const { showToast } = useProposalToastContext();
  const {
    daoId: treasuryDaoID,
    daoPolicy,
    lastProposalId,
    daoNearBalances,
    daoFtBalances,
  } = useDao();
  const { signAndSendTransactions, accountId } = useNearWallet();

  const [proposalList, setProposalList] = useState(proposals);
  const [isTxnCreated, setTxnCreated] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [isRecipientValid, setIsRecipientValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Row validation state
  const [rowErrors, setRowErrors] = useState({}); // { index: "error message" }
  const [isValidating, setIsValidating] = useState(true);

  // Unregistered accounts (need storage deposit)
  const [unregisteredAccounts, setUnregisteredAccounts] = useState([]); // Array of indices

  // Bulk payment state
  const [storageCredits, setStorageCredits] = useState(0); // Number of available storage records
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return proposalList.reduce((sum, proposal) => {
      return Big(sum).plus(Big(proposal["Amount"] || 0));
    }, Big(0));
  }, [proposalList]);

  const totalRecipients = proposalList.length;

  // Check if treasury has sufficient balance
  const isBalanceSufficient = useMemo(() => {
    if (!selectedToken || !totalAmount) return true;

    const isNEAR =
      selectedToken.contract.toLowerCase() === "near" ||
      selectedToken.contract === "";

    let availableBalance = "0";

    if (isNEAR) {
      // Get NEAR balance from DAO wallet
      availableBalance = daoNearBalances?.availableParsed || "0";
    } else {
      // Get FT token balance from DAO wallet
      if (daoFtBalances?.fts) {
        const tokenBalance = daoFtBalances.fts.find(
          (ft) => ft.contract === selectedToken.contract
        );
        if (tokenBalance) {
          // Convert from smallest units to human-readable
          const decimals = selectedToken.decimals || 18;
          availableBalance = Big(tokenBalance.amount || "0")
            .div(Big(10).pow(decimals))
            .toFixed();
        }
      }
    }

    return Big(availableBalance).gte(Big(totalAmount));
  }, [selectedToken, totalAmount, daoNearBalances, daoFtBalances]);

  // Sorted proposal list with errors at the top (excluding unregistered accounts)
  const sortedProposalList = useMemo(() => {
    return proposalList
      .map((item, originalIndex) => ({ item, originalIndex }))

      .sort((a, b) => {
        const aHasError = rowErrors[a.originalIndex] ? 1 : 0;
        const bHasError = rowErrors[b.originalIndex] ? 1 : 0;
        // Errors first (descending), then by original order
        return bHasError - aHasError || a.originalIndex - b.originalIndex;
      });
  }, [proposalList, rowErrors, unregisteredAccounts]);

  // Count of rows with errors
  const errorCount = Object.keys(rowErrors).length;

  // Check if user has exceeded their recipient quota
  const hasExceededQuota =
    !isLoadingCredits && totalRecipients > storageCredits;

  // Pre-compute listId for display (deterministic hash)
  const [listId, setListId] = useState(null);
  useEffect(() => {
    async function computeListId() {
      if (proposalList.length === 0 || !selectedToken) return;

      const tokenId = selectedToken?.contract || "near";
      const isNEAR =
        tokenId.toLowerCase() === "near" || tokenId === "" || !tokenId;

      // Convert amounts to smallest units for contract
      const payments = proposalList.map((proposal) => ({
        recipient: proposal.Recipient,
        amount: Big(proposal["Amount"] || "0")
          .times(Big(10).pow(selectedToken?.decimals || 24))
          .toFixed(),
      }));

      const id = await generateListId(
        treasuryDaoID,
        isNEAR ? "native" : tokenId,
        payments
      );
      setListId(id);
    }

    computeListId();
  }, [proposalList, selectedToken, treasuryDaoID]);

  // Validate all rows on mount
  useEffect(() => {
    async function validateAllRows() {
      setIsValidating(true);
      const errors = {};
      const unregistered = [];
      const tokenMeta = selectedToken;

      if (!tokenMeta) {
        setIsValidating(false);
        return;
      }

      const isNEAR = tokenMeta.contract.toLowerCase() === "near";

      const validationPromises = proposalList.map(async (proposal, index) => {
        const rowErrors = [];

        // Validate recipient
        const recipient = proposal.Recipient?.trim();
        if (!recipient) {
          rowErrors.push("Recipient account does not exist.");
        } else if (!isValidNearAccount(recipient)) {
          rowErrors.push(
            "Invalid recipient address. Must be a .near or .aurora or 0x address."
          );
        } else {
          // Check if account exists on chain
          try {
            const accountData = await Near.viewAccount(recipient);
            if (accountData) {
              // For FT tokens, check storage balance
              if (!isNEAR) {
                try {
                  const storage = await Near.view(
                    tokenMeta.contract,
                    "storage_balance_of",
                    {
                      account_id: recipient,
                    }
                  );

                  if (!storage) {
                    // Account exists but not registered for this token
                    unregistered.push(index);
                  }
                } catch (error) {
                  console.error("Error checking storage balance:", error);
                  // If we can't check storage, assume not registered
                  unregistered.push(index);
                }
              }
            } else {
              rowErrors.push("Recipient account does not exist.");
            }
          } catch (error) {
            rowErrors.push("Recipient account does not exist.");
          }
        }

        // Validate amount
        const amountStr = proposal.Amount?.trim();
        if (!amountStr) {
          rowErrors.push("Amount is missing.");
        } else {
          const value = parseAmount(amountStr);
          if (isNaN(value) || value <= 0) {
            rowErrors.push("Amount must be a positive number.");
          }
        }

        if (rowErrors.length > 0) {
          errors[index] = rowErrors.join(" ");
        }
      });

      await Promise.all(validationPromises);
      setRowErrors(errors);
      setUnregisteredAccounts(unregistered);
      setIsValidating(false);
    }

    validateAllRows();
  }, [proposalList, selectedToken]);

  // Check storage credits on mount
  useEffect(() => {
    async function checkStorageCredits() {
      setIsLoadingCredits(true);
      try {
        const credits = await viewStorageCredits(treasuryDaoID);
        setStorageCredits(credits); // Number of available storage records
      } catch (error) {
        console.error("Error checking storage credits:", error);
        setStorageCredits(0);
      } finally {
        setIsLoadingCredits(false);
      }
    }

    if (treasuryDaoID && totalRecipients > 0) {
      checkStorageCredits();
    }
  }, [treasuryDaoID, totalRecipients]);

  /**
   * Open edit modal with pre-filled data
   */
  const handleEdit = useCallback(
    (index) => {
      const proposal = proposalList[index];
      setEditingIndex(index);
      setEditingData({
        // Amount is already human-readable
        Amount: proposal["Amount"],
        Recipient: proposal.Recipient,
      });
      setIsRecipientValid(true); // Assume valid since it was already validated
      setValidationErrors({});
    },
    [proposalList, selectedToken?.decimals]
  );

  /**
   * Close edit modal
   */
  const handleCloseEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingData(null);
    setIsRecipientValid(false);
    setValidationErrors({});
  }, []);

  /**
   * Validate form fields
   */
  const validateFields = useCallback(() => {
    const errors = {};

    // Amount validation
    if (!editingData?.Amount || editingData.Amount === "") {
      errors.Amount = "Amount is required";
    } else {
      const amount = parseAmount(editingData.Amount);
      if (isNaN(amount) || amount <= 0) {
        errors.Amount = "Amount must be a positive number";
      }
    }

    // Recipient validation - AccountInput handles format and existence checks
    // We just check if it's valid based on AccountInput's callback
    if (!editingData?.Recipient || !editingData.Recipient.trim()) {
      errors.Recipient = "Recipient is required";
    } else if (!isRecipientValid) {
      errors.Recipient = "Please enter a valid NEAR account";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editingData, isRecipientValid]);

  /**
   * Re-validate a single row after edit
   */
  const revalidateRow = useCallback(
    async (index, recipient) => {
      const tokenMeta = selectedToken;
      if (!tokenMeta) return;

      const isNEAR = tokenMeta.contract.toLowerCase() === "near";
      let hasError = false;
      let isUnregistered = false;

      // Step 1: Check if account is valid
      if (!recipient || !recipient.trim()) {
        hasError = true;
      } else if (!isValidNearAccount(recipient)) {
        hasError = true;
      } else {
        // Step 2: Check if account exists on chain
        try {
          const accountData = await Near.viewAccount(recipient);
          if (accountData) {
            // Step 3: For FT tokens, check storage registration
            if (!isNEAR) {
              try {
                const storage = await Near.view(
                  tokenMeta.contract,
                  "storage_balance_of",
                  { account_id: recipient }
                );
                if (!storage) {
                  isUnregistered = true;
                }
              } catch (error) {
                console.error("Error checking storage balance:", error);
                isUnregistered = true;
              }
            }
          } else {
            hasError = true;
          }
        } catch (error) {
          hasError = true;
        }
      }

      // Update states based on validation
      if (hasError) {
        // Remove from unregistered if it has an error
        setUnregisteredAccounts((prev) => prev.filter((i) => i !== index));
      } else if (isUnregistered) {
        // Add to unregistered list
        setUnregisteredAccounts((prev) => {
          if (!prev.includes(index)) {
            return [...prev, index];
          }
          return prev;
        });
      } else {
        // Valid and registered - remove from unregistered
        setUnregisteredAccounts((prev) => prev.filter((i) => i !== index));
      }
    },
    [selectedToken]
  );

  /**
   * Save edited proposal
   */
  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null || !editingData) return;

    // Validate before saving
    const isValid = validateFields();
    if (!isValid) return;

    const updatedList = [...proposalList];
    updatedList[editingIndex] = {
      ...updatedList[editingIndex],
      Amount: editingData.Amount, // Keep human-readable
      Recipient: editingData.Recipient,
    };

    setProposalList(updatedList);

    // Re-validate the edited row for storage registration
    revalidateRow(editingIndex, editingData.Recipient);

    handleCloseEdit();
  }, [
    editingIndex,
    editingData,
    revalidateRow,
    validateFields,
    proposalList,
    handleCloseEdit,
    selectedToken?.decimals,
  ]);

  /**
   * Show delete confirmation modal
   */
  const handleDelete = useCallback((index) => {
    setDeletingIndex(index);
  }, []);

  /**
   * Confirm and delete a proposal from the list
   */
  const confirmDelete = useCallback(() => {
    if (deletingIndex === null) return;
    const newList = proposalList.filter((_, idx) => idx !== deletingIndex);
    setProposalList(newList);
    setDeletingIndex(null);
  }, [deletingIndex, proposalList]);

  /**
   * Create bulk payment proposal using the bulk payment contract flow:
   * 1. Generate list_id from payments
   * 2. If there are unregistered accounts, add storage deposit transactions first
   * 3. Create approve_list proposal (NEAR) or ft_transfer_call proposal (FT)
   * 4. Submit payment list to backend API after proposal is created
   */
  async function createPaymentTx() {
    if (proposalList.length === 0) return;

    const proposalBond = daoPolicy?.proposal_bond || "0";
    const tokenId = selectedToken?.contract || "near";
    const isNEAR =
      tokenId.toLowerCase() === "near" || tokenId === "" || !tokenId;

    try {
      // Build payments array for bulk payment API - convert to smallest units
      const payments = proposalList.map((proposal) => ({
        recipient: proposal.Recipient,
        amount: Big(proposal["Amount"] || "0")
          .times(Big(10).pow(selectedToken?.decimals || 24))
          .toFixed(),
      }));

      // Generate list_id (deterministic hash of payments)
      const listId = await generateListId(
        treasuryDaoID,
        isNEAR ? "native" : tokenId,
        payments
      );

      console.log("Generated list_id:", listId);

      // Build proposal description with recipient count, total amount, token contract, and list_id
      const description = encodeToMarkdown({
        proposal_action: "bulk-payment",
        title: title || undefined,
        recipients: totalRecipients,
        contract: selectedToken?.contract || "",
        amount: totalAmount.toFixed(),
        list_id: listId,
      });

      const transactions = [];

      // Step 1: Add storage deposit transactions for unregistered accounts (if any)
      if (unregisteredAccounts.length > 0 && !isNEAR) {
        const unregisteredRecipients = unregisteredAccounts.map(
          (index) => proposalList[index].Recipient
        );

        // Create storage deposit transactions for each unregistered recipient
        const storageTransactions = unregisteredRecipients.map((recipient) => ({
          receiverId: tokenId,
          signerId: accountId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "storage_deposit",
                args: {
                  account_id: recipient,
                  registration_only: true,
                },
                gas: "30000000000000", // 30 TGas
                deposit: "12500000000000000000000", // 0.0125 NEAR
              },
            },
          ],
        }));

        transactions.push(...storageTransactions);
        console.log(
          `Added ${storageTransactions.length} storage deposit transaction(s)`
        );
      }

      // Step 2: Create approve_list proposal - convert totalAmount to smallest units
      const totalAmountInSmallestUnits = Big(totalAmount)
        .times(Big(10).pow(selectedToken?.decimals || 24))
        .toFixed();

      const approveListProposal = await buildApproveListProposal({
        daoAccountId: treasuryDaoID,
        listId,
        tokenId: isNEAR ? "near" : tokenId,
        totalAmount: totalAmountInSmallestUnits,
        description,
        proposalBond,
      });

      transactions.push({
        receiverId: approveListProposal.contractName,
        signerId: accountId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: approveListProposal.methodName,
              args: approveListProposal.args,
              gas: approveListProposal.gas,
              deposit: approveListProposal.deposit,
            },
          },
        ],
      });

      console.log("Submitting", transactions, "proposal(s) to wallet");
      setIsCreatingRequest(false);
      setTxnCreated(true);

      // Submit transactions to create the proposal(s)
      const result = await signAndSendTransactions({ transactions });

      if (
        result &&
        result.length > 0 &&
        typeof result[result.length - 1]?.status?.SuccessValue === "string"
      ) {
        console.log("Proposal(s) created successfully");

        // Step 3: After proposal is created, submit payment list to backend
        const submitResult = await submitPaymentList({
          listId,
          submitterId: treasuryDaoID,
          daoContractId: treasuryDaoID,
          tokenId: isNEAR ? "native" : tokenId,
          payments,
        });

        if (submitResult.success) {
          console.log("Payment list submitted to backend:", submitResult);
          showToast(
            `BulkProposalAdded: ${proposalList.length}`,
            null,
            "payment"
          );
        } else {
          console.warn(
            "Payment list submission to backend failed:",
            submitResult.error
          );
          // Still show success for proposal creation
          showToast(
            `BulkProposalAdded: ${proposalList.length}`,
            null,
            "payment"
          );
        }

        setTimeout(() => {
          setTxnCreated(false);
          closePreviewTable();
        }, REFRESH_DELAY);
      }
    } catch (err) {
      console.error("Failed to create bulk payment proposal:", err);
      setIsCreatingRequest(false);
      setTxnCreated(false);
      showToast("ErrorAddingProposal", null, "payment");
    }
  }

  return (
    <div
      className="w-100 h-100 flex-grow-1 d-flex flex-column"
      style={{ fontSize: "14px" }}
    >
      <TransactionLoader showInProgress={isTxnCreated} />

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        heading="Are you sure?"
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
                setShowCancelModal(false);
                closePreviewTable();
              }}
            >
              Yes
            </button>
          </>
        }
      >
        <div className="text-color">
          If you close now, all current progress will be discarded.
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingIndex !== null}
        heading="Remove Recipient"
        onClose={() => setDeletingIndex(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setDeletingIndex(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn theme-btn"
              onClick={confirmDelete}
            >
              Confirm
            </button>
          </>
        }
      >
        <div className="text-color">
          Are you sure you want to remove the payment to{" "}
          <strong>{proposalList?.[deletingIndex]?.Recipient}</strong>? This
          action cannot be undone.
        </div>
      </Modal>

      {/* Edit Payment Request OffCanvas */}
      <OffCanvas
        showCanvas={editingIndex !== null}
        onClose={handleCloseEdit}
        title="Edit Payment Request"
      >
        {editingData && (
          <div className="d-flex flex-column gap-4 pb-4">
            {/* Recipient */}
            <div className="d-flex flex-column gap-2">
              <label>Recipient</label>
              <AccountInput
                value={editingData.Recipient}
                placeholder="treasury.near"
                onUpdate={(v) => {
                  setEditingData({ ...editingData, Recipient: v });
                  // Clear error on change
                  if (validationErrors.Recipient) {
                    setValidationErrors({
                      ...validationErrors,
                      Recipient: null,
                    });
                  }
                }}
                setParentAccountValid={setIsRecipientValid}
                maxWidth="100%"
                allowNonExistentImplicit={true}
              />
              {validationErrors.Recipient && (
                <div className="text-danger small">
                  {validationErrors.Recipient}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="d-flex flex-column gap-2">
              <label>Amount</label>
              <input
                type="number"
                className={`form-control ${
                  validationErrors.Amount ? "is-invalid" : ""
                }`}
                value={editingData.Amount}
                onChange={(e) => {
                  setEditingData({
                    ...editingData,
                    Amount: e.target.value,
                  });
                  // Clear error on change
                  if (validationErrors.Amount) {
                    setValidationErrors({
                      ...validationErrors,
                      Amount: null,
                    });
                  }
                }}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              {validationErrors.Amount && (
                <div className="text-danger small">
                  {validationErrors.Amount}
                </div>
              )}
              {selectedToken &&
                editingData.Amount &&
                !validationErrors.Amount && (
                  <div className="d-flex justify-content-between align-items-center text-sm">
                    <div className="text-secondary d-flex align-items-center gap-1">
                      $
                      {Big(editingData.Amount || 0)
                        .times(selectedToken.price || 0)
                        .toFixed(2)}
                      <Tooltip tooltip="The USD value is calculated based on token prices from CoinGecko">
                        <i className="bi bi-info-circle"></i>
                      </Tooltip>
                    </div>
                    <div className="text-secondary">
                      ${Big(selectedToken.price || 0).toFixed(2)}
                    </div>
                  </div>
                )}
            </div>

            {/* Footer Buttons */}
            <div className="d-flex gap-3 justify-content-end mt-auto">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handleCloseEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn theme-btn"
                onClick={handleSaveEdit}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </OffCanvas>
      {/* Header with Back Button and Centered Title */}
      <div className="d-flex align-items-center justify-content-center position-relative mb-4">
        <button
          className="btn btn-outline-secondary d-flex align-items-center gap-2 position-absolute start-0 mt-2"
          onClick={() => setShowCancelModal(true)}
        >
          <i className="bi bi-arrow-left h5 mb-0"></i>
          <span className="h6 mb-0">Back</span>
        </button>
        <h4 className="mb-0 fw-bold">Review Your Payment Requests</h4>
      </div>

      <div className="card card-body">
        <div
          className="d-flex gap-4 mb-2 p-3 rounded justify-content-between flex-wrap"
          style={{ backgroundColor: "var(--grey-05)" }}
        >
          <div className="d-flex flex-column gap-1">
            <div className="text-secondary small">Request ID</div>
            <div className="fw-550" title={listId}>
              {lastProposalId}
            </div>
          </div>
          <div className="d-flex flex-column gap-1">
            <div className="text-secondary small">Source Wallet</div>
            <div className="fw-550">{sourceWallet || "SputnikDAO"}</div>
          </div>
          <div className="d-flex flex-column gap-1">
            <div className="text-secondary small">Total Amount</div>
            <div className="fw-550 d-flex align-items-center gap-1">
              <TokenAmount
                amountWithDecimals={totalAmount}
                address={selectedToken?.contract}
                displayAllDecimals={true}
                showUSDValue={true}
                isProposalDetails={true}
              />
            </div>
          </div>
          <div className="d-flex flex-column gap-1">
            <div className="text-secondary small">Total Recipients</div>
            <div className="fw-550">
              {totalRecipients} Recipient{totalRecipients !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Recipient Limit Reached Banner */}
        {hasExceededQuota && (
          <div className="warning-box d-flex align-items-center gap-3 my-2 p-3 rounded-3">
            <i className="bi bi-exclamation-triangle h5 mb-0"></i>
            <div>
              <strong>Recipient limit reached</strong>
              <p className="mb-0">
                You can add up to {storageCredits} recipients on your current
                plan. Please remove some recipients or{" "}
                <a
                  href="https://docs.neartreasury.com/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-decoration-underline"
                >
                  contact us
                </a>{" "}
                to increase your limit.
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          {title && (
            <div className="my-3 px-2">
              <h5 className="fw-bold mb-0">{title}</h5>
            </div>
          )}
          <table className="table" data-testid="preview-table">
            <thead>
              <tr>
                <th className="text-secondary small fw-normal">№</th>
                <th className="text-secondary small fw-normal">Recipient</th>
                <th className="text-secondary small fw-normal"></th>
                <th className="text-secondary small fw-normal text-end">
                  Funding Ask
                </th>
                <th className="text-secondary small fw-normal text-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isValidating ? (
                <TableSkeleton
                  numberOfCols={5}
                  numberOfRows={Math.min(proposalList.length, 5)}
                />
              ) : (
                // Actual rows
                sortedProposalList.map(
                  ({ item, originalIndex }, displayIndex) => (
                    <PaymentRow
                      key={originalIndex}
                      item={item}
                      index={displayIndex}
                      onEdit={() => handleEdit(originalIndex)}
                      onDelete={() => handleDelete(originalIndex)}
                      error={rowErrors[originalIndex]}
                      selectedToken={selectedToken}
                      isUnregistered={unregisteredAccounts.includes(
                        originalIndex
                      )}
                    />
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Unregistered Accounts Warning */}
        {!isValidating &&
          !hasExceededQuota &&
          unregisteredAccounts.length > 0 && (
            <div className="warning-box d-flex gap-3 mb-3 p-2 rounded-3 align-items-center">
              <i className="bi bi-exclamation-triangle h5 mb-0 mt-1"></i>
              <div className="flex-grow-1">
                <strong>Storage Deposit Required</strong>
                <div className="mt-1">
                  You'll pay a total of{" "}
                  <strong>
                    {Big(unregisteredAccounts.length).mul(0.0125).toFixed(4)}{" "}
                    NEAR
                  </strong>{" "}
                  (0.0125 NEAR per account) to register{" "}
                  <strong>
                    {unregisteredAccounts.length} account
                    {unregisteredAccounts.length !== 1 ? "s" : ""}
                  </strong>{" "}
                  when you submit this request. This one-time deposit enables
                  these recipients to receive payments.
                </div>
              </div>
            </div>
          )}

        {/* Insufficient Balance Warning */}
        {!isBalanceSufficient && (
          <div className="warning-box d-flex gap-3 align-items-center px-3 py-2 rounded-3 my-3">
            <i className="bi bi-exclamation-triangle h5 mb-0"></i>
            <div>
              The treasury balance is insufficient to cover the payment. You can
              create the request, but it won't be approved until the balance is
              topped up.
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="d-flex justify-content-end gap-3">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowCancelModal(true)}
            disabled={isCreatingRequest || isTxnCreated}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn theme-btn"
            disabled={
              proposalList.length === 0 ||
              isCreatingRequest ||
              isTxnCreated ||
              isLoadingCredits ||
              isValidating ||
              errorCount > 0 ||
              hasExceededQuota
            }
            onClick={() => {
              setIsCreatingRequest(true);
              createPaymentTx();
            }}
          >
            {isCreatingRequest || isTxnCreated
              ? "Submitting..."
              : `Submit Request`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportPreviewTable;

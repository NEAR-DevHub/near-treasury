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
  buildBuyStorageProposal,
  calculateStorageCost,
  formatStorageCost,
} from "@/api/bulk-payment";
import Modal from "@/components/ui/Modal";
import OffCanvas from "@/components/ui/OffCanvas";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Profile from "@/components/ui/Profile";
import TokenAmount from "@/components/proposals/TokenAmount";
import Tooltip from "@/components/ui/Tooltip";
import { useProposalToastContext } from "@/context/ProposalToastContext";
import { REFRESH_DELAY } from "@/constants/ui";
import Edit from "@/components/icons/Edit";
import AccountInput from "@/components/forms/AccountInput";
import { encodeToMarkdown } from "@/helpers/daoHelpers";

/**
 * Memoized table row component to prevent unnecessary re-renders
 */
const PaymentRow = memo(function PaymentRow({ item, index, onEdit, onDelete }) {
  return (
    <tr>
      <td>{index + 1}</td>
      <td>
        <Profile accountId={item["Recipient"]} showKYC={false} />
      </td>
      <td className="text-end">
        <TokenAmount
          amountWithoutDecimals={item["Amount"]}
          address={item["Requested Token"]}
          showUSDValue={true}
        />
      </td>
      <td>
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
}) => {
  const { showToast } = useProposalToastContext();
  const { daoId: treasuryDaoID, daoPolicy } = useDao();
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

  // Bulk payment state
  const [storageCredits, setStorageCredits] = useState(0); // Number of available storage records
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [needsStoragePurchase, setNeedsStoragePurchase] = useState(false);
  const [showStorageConfirmModal, setShowStorageConfirmModal] = useState(false);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return proposalList.reduce((sum, proposal) => {
      return Big(sum).plus(Big(proposal["Amount"] || 0));
    }, Big(0));
  }, [proposalList]);

  const totalRecipients = proposalList.length;

  // Storage fee calculation based on bulk payment contract
  const storageFee = useMemo(() => {
    const cost = calculateStorageCost(totalRecipients);
    return formatStorageCost(cost);
  }, [totalRecipients]);

  // Pre-compute listId for display (deterministic hash)
  const [listId, setListId] = useState(null);
  useEffect(() => {
    async function computeListId() {
      if (proposalList.length === 0 || !selectedToken) return;

      const tokenId = selectedToken?.contract || "near";
      const isNEAR =
        tokenId.toLowerCase() === "near" || tokenId === "" || !tokenId;

      const payments = proposalList.map((proposal) => ({
        recipient: proposal.Recipient,
        amount: Big(proposal["Amount"]).toFixed(),
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

  // Check storage credits on mount
  useEffect(() => {
    async function checkStorageCredits() {
      setIsLoadingCredits(true);
      try {
        const credits = await viewStorageCredits(treasuryDaoID);
        setStorageCredits(credits); // Number of available storage records

        // Compare available records with required records
        const hasEnoughCredits = credits >= totalRecipients;
        setNeedsStoragePurchase(!hasEnoughCredits);
      } catch (error) {
        console.error("Error checking storage credits:", error);
        setStorageCredits(0);
        setNeedsStoragePurchase(true);
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
        // Convert from smallest units to human-readable for editing
        Amount: Big(proposal["Amount"])
          .div(Big(10).pow(selectedToken?.decimals || 24))
          .toFixed(),
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
      const amount = parseFloat(editingData.Amount);
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
      Amount: Big(editingData.Amount)
        .times(Big(10).pow(selectedToken?.decimals || 24))
        .toFixed(),
      Recipient: editingData.Recipient,
    };

    setProposalList(updatedList);
    handleCloseEdit();
  }, [
    editingIndex,
    editingData,
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
   * 2. If insufficient storage credits, create buy_storage proposal first
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
      // Build payments array for bulk payment API
      const payments = proposalList.map((proposal) => ({
        recipient: proposal.Recipient,
        amount: Big(proposal["Amount"]).toFixed(),
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
        recipients: totalRecipients,
        contract: selectedToken?.contract || "",
        amount: totalAmount.toFixed(),
        list_id: listId,
      });

      const transactions = [];

      // Step 1: If insufficient storage credits, add buy_storage proposal
      if (needsStoragePurchase) {
        // Calculate how many additional records we need storage for
        // storageCredits is the number of available records
        const recordsNeeded = Math.max(0, totalRecipients - storageCredits);

        const buyStorageProposal = buildBuyStorageProposal({
          daoAccountId: treasuryDaoID,
          numRecords: recordsNeeded,
          description: encodeToMarkdown({
            proposal_action: "buy-storage",
            recipients: totalRecipients,
          }),
          proposalBond,
        });

        transactions.push({
          receiverId: buyStorageProposal.contractName,
          signerId: accountId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: buyStorageProposal.methodName,
                args: buyStorageProposal.args,
                gas: buyStorageProposal.gas,
                deposit: buyStorageProposal.deposit,
              },
            },
          ],
        });
      }

      // Step 2: Create approve_list proposal
      const approveListProposal = await buildApproveListProposal({
        daoAccountId: treasuryDaoID,
        listId,
        tokenId: isNEAR ? "near" : tokenId,
        totalAmount: totalAmount.toFixed(),
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

      {/* Storage Purchase Confirmation Modal */}
      <Modal
        isOpen={showStorageConfirmModal}
        heading="Confirm Request Creation"
        onClose={() => setShowStorageConfirmModal(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowStorageConfirmModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn theme-btn"
              onClick={() => {
                setShowStorageConfirmModal(false);
                setIsCreatingRequest(true);
                createPaymentTx();
              }}
            >
              Confirm
            </button>
          </>
        }
      >
        <div className="text-color">
          <p>
            You are about to create bulk payment request. To complete the
            approval, will need to confirm two separate transactions:
          </p>
          <ul className="mb-0">
            <li>
              One to purchase storage{" "}
              <strong>
                {storageFee} <span style={{ fontFamily: "sans-serif" }}>Ⓝ</span>
              </strong>
            </li>
            <li>One to confirm the payment for recipients</li>
          </ul>
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
        <h4 className="mb-0 fw-bold">Review Your Payments</h4>
      </div>

      <div className="card card-body">
        <div
          className="d-flex gap-4 mb-2 p-3 rounded justify-content-between flex-wrap"
          style={{ backgroundColor: "var(--grey-05)" }}
        >
          <div className="d-flex flex-column gap-1">
            <div className="text-secondary small">Request ID</div>
            <div className="fw-550" title={listId}>
              {listId ? `${listId.slice(0, 8)}...${listId.slice(-6)}` : ""}
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
                amountWithoutDecimals={totalAmount.toFixed()}
                address={selectedToken?.contract}
                displayAllDecimals={true}
                showUSDValue={true}
              />
            </div>
          </div>
          <div className="d-flex flex-column gap-1">
            <div className="text-secondary small">Total Recipients</div>
            <div className="fw-550">
              {totalRecipients} Recipient{totalRecipients !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="d-flex flex-column gap-1">
            <div className="text-secondary small d-flex align-items-center gap-1">
              Storage Fee
              <Tooltip
                tooltip={`This is the storage fee that covers storage for your ${totalRecipients} recipients. You can continue creating requests until your storage limit is reached. Once it’s fully used, an additional storage fee will be required to create more requests. Learn more`}
              >
                <i className="bi bi-info-circle"></i>
              </Tooltip>
            </div>
            <div className="fw-550">{storageFee} NEAR</div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="table" data-testid="preview-table">
            <thead>
              <tr>
                <th className="text-secondary small fw-normal">№</th>
                <th className="text-secondary small fw-normal">Recipient</th>
                <th className="text-secondary small fw-normal text-end">
                  Amount
                </th>
                <th className="text-secondary small fw-normal text-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {proposalList.map((item, index) => (
                <PaymentRow
                  key={index}
                  item={item}
                  index={index}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>

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
              isLoadingCredits
            }
            onClick={() => {
              // If storage purchase is needed, show confirmation modal
              if (needsStoragePurchase) {
                setShowStorageConfirmModal(true);
              } else {
                // Otherwise, proceed directly
                setIsCreatingRequest(true);
                createPaymentTx();
              }
            }}
          >
            {isCreatingRequest || isTxnCreated
              ? "Submitting..."
              : `Submit ${proposalList.length} Request${
                  proposalList.length !== 1 ? "s" : ""
                }`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImportPreviewTable;

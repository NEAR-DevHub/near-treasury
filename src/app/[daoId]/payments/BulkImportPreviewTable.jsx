"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Big from "big.js";
import { useDao } from "@/context/DaoContext";
import { useProposals } from "@/hooks/useProposals";
import { useNearWallet } from "@/context/NearWalletContext";
import { Near } from "@/api/near";
import { encodeToMarkdown } from "@/helpers/daoHelpers";
import Modal from "@/components/ui/Modal";
import TransactionLoader from "@/components/proposals/TransactionLoader";
import Profile from "@/components/ui/Profile";
import TokenIcon from "@/components/proposals/TokenIcon";
import TokenAmount from "@/components/proposals/TokenAmount";

/**
 * BulkImportPreviewTable Component
 * Shows preview of bulk payment requests with checkbox selection
 * Optimized to prevent flickering on checkbox toggle
 */
const BulkImportPreviewTable = ({
  proposals = [],
  closePreviewTable,
  setToastStatus,
}) => {
  const {
    daoId: treasuryDaoID,
    daoPolicy,
    lastProposalId,
    refetchLastProposalId,
  } = useDao();

  const { signAndSendTransactions, accountId } = useNearWallet();

  // Use proposals directly, memoized to prevent re-initialization
  const proposalList = useMemo(() => proposals, [proposals]);

  // Initialize selectedMap once on mount - prevents flickering
  const [selectedMap, setSelectedMap] = useState(() => {
    const initialMap = {};
    proposals.forEach((_, idx) => {
      initialMap[idx] = true; // All selected by default
    });
    return initialMap;
  });

  const [isTxnCreated, setTxnCreated] = useState(false);
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Memoized selected count - updates only when selectedMap changes
  const selectedCount = useMemo(() => {
    return Object.values(selectedMap).filter((v) => v === true).length;
  }, [selectedMap]);

  // Memoized all selected check
  const allSelected = useMemo(() => {
    return (
      proposalList.length > 0 && Object.values(selectedMap).every((v) => v)
    );
  }, [proposalList, selectedMap]);

  // useCallback to prevent re-creating function on every render
  const handleToggleRow = useCallback((idx) => {
    setSelectedMap((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }, []);

  const handleToggleAll = useCallback(() => {
    const newMap = {};
    Object.keys(selectedMap).forEach((key) => {
      newMap[key] = !allSelected;
    });
    setSelectedMap(newMap);
  }, [selectedMap, allSelected]);

  const { invalidateCategoryAfterTransaction } = useProposals({
    category: "payments",
    enabled: false,
  });

  async function refreshData() {
    if (setToastStatus) {
      setToastStatus(`BulkProposalAdded: ${selectedCount}`);
    }
    // Invalidate proposals cache with delay for indexer processing
    await invalidateCategoryAfterTransaction();
  }

  // Monitor transaction completion
  useEffect(() => {
    if (isTxnCreated) {
      let checkTxnTimeout = null;

      const checkForNewProposal = () => {
        refetchLastProposalId().then((id) => {
          if (typeof lastProposalId === "number" && lastProposalId !== id) {
            setTimeout(() => {
              closePreviewTable();
              clearTimeout(checkTxnTimeout);
              refreshData();
            }, 1000);
          } else {
            checkTxnTimeout = setTimeout(() => checkForNewProposal(), 1000);
          }
        });
      };
      checkForNewProposal();

      return () => clearTimeout(checkTxnTimeout);
    }
  }, [isTxnCreated, lastProposalId, refetchLastProposalId]);

  /**
   * Check if receiver is registered for FT storage
   */
  async function isReceiverRegistered(tokenId, receiver) {
    try {
      const result = await Near.view(tokenId, "storage_balance_of", {
        account_id: receiver,
      });
      return !!result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create payment transactions for selected proposals
   */
  async function createPaymentTx() {
    const gas = "270000000000000";
    const deposit = daoPolicy?.proposal_bond || "0";
    const isNEAR = (token) => token.toLowerCase() === "near";
    const selected = proposalList.filter((_, idx) => selectedMap[idx]);

    if (selected.length === 0) return;

    const storageDepositOps = [];
    const proposalOps = [];

    const proposalPromises = selected.map(async (proposal) => {
      const Title = proposal.Title;
      const Summary = proposal.Summary;
      const Notes = proposal.Notes;
      const Recipient = proposal.Recipient;
      const tokenId = proposal["Requested Token"];
      const amount = proposal["Funding Ask"];
      const isTokenNEAR = isNEAR(tokenId);
      const receiver = Recipient;
      const parsedAmount = Big(amount).toFixed();

      const description = {
        title: Title,
        summary: Summary,
        notes: Notes,
      };

      const addProposalCall = {
        contractName: treasuryDaoID,
        methodName: "add_proposal",
        args: {
          proposal: {
            description: encodeToMarkdown(description),
            kind: {
              Transfer: {
                token_id: isTokenNEAR ? "" : tokenId,
                receiver_id: receiver,
                amount: parsedAmount,
              },
            },
          },
        },
        gas,
        deposit,
      };

      if (isTokenNEAR) {
        proposalOps.push(addProposalCall);
        return;
      }

      // Check registration and add storage deposit if needed
      const isRegistered = await isReceiverRegistered(tokenId, receiver);
      if (!isRegistered) {
        const depositInYocto = Big(0.125).mul(Big(10).pow(24)).toFixed();
        storageDepositOps.push({
          contractName: tokenId,
          methodName: "storage_deposit",
          args: {
            account_id: receiver,
            registration_only: true,
          },
          gas,
          deposit: depositInYocto,
        });
      }
      proposalOps.push(addProposalCall);
    });

    try {
      await Promise.all(proposalPromises);
      const calls = storageDepositOps.concat(proposalOps);

      // Transform calls array to format expected by signAndSendTransactions
      const transactions = calls.map(call => ({
        receiverId: call.contractName,
        signerId: accountId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: call.methodName,
              args: call.args,
            },
            gas: call.gas,
            deposit: call.deposit,
          },
        ],
      }));

      console.log("Submitting", transactions.length, "transactions to wallet");
      setIsCreatingRequest(false);
      setTxnCreated(true);

      const result = await signAndSendTransactions({ transactions });

      if (result && result.length > 0) {
        console.log("Transactions completed successfully:", result.length);
        // The useEffect polling will detect the new proposals and close the modal
      }
    } catch (err) {
      console.error("Failed to process proposals:", err);
      setIsCreatingRequest(false);
      setTxnCreated(false);
      setToastStatus("ErrorAddingProposal");
    }
  }

  const columns = [
    "Title",
    "Summary",
    "Recipient",
    "Requested Token",
    "Funding Ask",
    "Notes",
  ];

  return (
    <>
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
          If you close now, all current progress, including any pasted data,
          will be discarded.
        </div>
      </Modal>

      {/* Main Preview Modal */}
      <Modal
        isOpen={!showCancelModal}
        heading="Import Payment Requests"
        onClose={() => setShowCancelModal(true)}
        size="xl"
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn theme-btn"
              disabled={
                selectedCount === 0 || isCreatingRequest || isTxnCreated
              }
              onClick={() => {
                setIsCreatingRequest(true);
                createPaymentTx();
              }}
            >
              {isCreatingRequest || isTxnCreated
                ? "Submitting..."
                : `Submit ${selectedCount} Request${
                    selectedCount !== 1 ? "s" : ""
                  }`}
            </button>
          </>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table className="table" data-testid="preview-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allSelected}
                    onChange={handleToggleAll}
                    aria-label="Select all proposals"
                  />
                </th>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proposalList.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={!!selectedMap[index]}
                      onChange={() => handleToggleRow(index)}
                      aria-label={`Select row ${index + 1}`}
                    />
                  </td>
                  <td>{item["Title"]}</td>
                  <td>{item["Summary"]}</td>
                  <td>
                    <Profile accountId={item["Recipient"]} showKYC={false} />
                  </td>
                  <td className="text-center">
                    <TokenIcon address={item["Requested Token"]} />
                  </td>
                  <td className="text-end">
                    <TokenAmount
                      amountWithoutDecimals={item["Funding Ask"]}
                      address={item["Requested Token"]}
                    />
                  </td>
                  <td className="text-sm">{item["Notes"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
};

export default BulkImportPreviewTable;

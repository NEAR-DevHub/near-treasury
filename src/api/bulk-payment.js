import { Near } from "./near";
import Big from "big.js";
import { createHash } from "crypto";

// Bulk Payment Contract Configuration
const BULK_PAYMENT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_BULK_PAYMENT_CONTRACT_ID;
const BULK_PAYMENT_API_URL = process.env.NEXT_PUBLIC_BULK_PAYMENT_API_URL;

// Storage cost calculation constants (matching bulk payment contract)
const BYTES_PER_RECORD = 216n; // AccountId (100) + amount (16) + status (~50) + overhead (~50)
const STORAGE_COST_PER_BYTE = 10n ** 19n; // yoctoNEAR per byte
const STORAGE_MARKUP_PERCENT = 110n; // 10% markup (110/100)

/**
 * Calculate storage cost for a given number of payment records
 * @param {number} numRecords - Number of payment records
 * @returns {string} Storage cost in yoctoNEAR
 */
export function calculateStorageCost(numRecords) {
  const storageBytes = BYTES_PER_RECORD * BigInt(numRecords);
  const storageCost = storageBytes * STORAGE_COST_PER_BYTE;
  const totalCost = (storageCost * STORAGE_MARKUP_PERCENT) / 100n;
  return totalCost.toString();
}

/**
 * Calculate cost per record in yoctoNEAR
 * @returns {string} Cost per record in yoctoNEAR
 */
export function getCostPerRecord() {
  const costPerRecord =
    (BYTES_PER_RECORD * STORAGE_COST_PER_BYTE * STORAGE_MARKUP_PERCENT) / 100n;
  return costPerRecord.toString();
}

/**
 * Calculate number of records that can be covered by given credits
 * @param {string} creditsYocto - Credits in yoctoNEAR
 * @returns {number} Number of records
 */
export function calculateRecordsFromCredits(creditsYocto) {
  const costPerRecord =
    (BYTES_PER_RECORD * STORAGE_COST_PER_BYTE * STORAGE_MARKUP_PERCENT) / 100n;
  const records = BigInt(creditsYocto) / costPerRecord;
  return Number(records);
}

/**
 * Generate a deterministic list_id (SHA-256 hash of canonical JSON)
 * Must match the backend's hash calculation
 * @param {string} submitterId - DAO account ID
 * @param {string} tokenId - Token contract ID or "native" for NEAR
 * @param {Array} payments - Array of {recipient, amount} objects
 * @returns {string} 64-character hex hash
 */
export function generateListId(submitterId, tokenId, payments) {
  // Sort payments by recipient for deterministic ordering (must match API)
  const sortedPayments = [...payments].sort((a, b) =>
    a.recipient.localeCompare(b.recipient)
  );

  // Create canonical JSON with alphabetically sorted keys (matches Rust serde_json)
  // Key order: payments, submitter, token_id (alphabetical)
  // Payment key order: amount, recipient (alphabetical)
  const canonical = JSON.stringify({
    payments: sortedPayments.map((p) => ({
      amount: p.amount,
      recipient: p.recipient,
    })),
    submitter: submitterId,
    token_id: tokenId,
  });

  // For browser compatibility, use SubtleCrypto if available
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    return window.crypto.subtle.digest("SHA-256", data).then((hashBuffer) => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    });
  }

  // Node.js fallback
  return Promise.resolve(createHash("sha256").update(canonical).digest("hex"));
}

/**
 * View storage credits for a DAO in the bulk payment contract
 * @param {string} daoAccountId - DAO account ID
 * @returns {Promise<number>} Number of available storage records
 */
/**
 * View storage credits for a DAO in the bulk payment contract
 * @param {string} daoAccountId - DAO account ID
 * @returns {Promise<string>} Available storage credits in yoctoNEAR
 */
export async function viewStorageCredits(daoAccountId) {
  try {
    const result = await Near.view(
      BULK_PAYMENT_CONTRACT_ID,
      "view_storage_credits",
      { account_id: daoAccountId }
    );
    // Contract returns credits in yoctoNEAR as a string
    return result?.toString() || "0";
  } catch (error) {
    console.warn("Error fetching storage credits:", error);
    return "0";
  }
}

/**
 * View payment list status from the contract
 * @param {string} listId - Payment list ID
 * @returns {Promise<object|null>} Payment list details
 */
export async function viewPaymentList(listId) {
  try {
    const result = await Near.view(BULK_PAYMENT_CONTRACT_ID, "view_list", {
      list_id: listId,
    });
    return result;
  } catch (error) {
    console.warn("Error fetching payment list:", error);
    return null;
  }
}

/**
 * Submit payment list to the backend API
 * @param {object} params - Submission parameters
 * @param {string} params.listId - Generated list ID
 * @param {string} params.submitterId - DAO account ID
 * @param {string} params.daoContractId - DAO contract ID (for proposal verification)
 * @param {string} params.tokenId - Token contract ID or "native"
 * @param {Array} params.payments - Array of {recipient, amount} objects
 * @returns {Promise<{success: boolean, list_id?: string, error?: string}>}
 */
export async function submitPaymentList({
  listId,
  submitterId,
  daoContractId,
  tokenId,
  payments,
}) {
  try {
    const response = await fetch(`${BULK_PAYMENT_API_URL}/submit-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        list_id: listId,
        submitter_id: submitterId,
        dao_contract_id: daoContractId,
        token_id: tokenId,
        payments,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error submitting payment list:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get payment list status from the API
 * @param {string} listId - Payment list ID
 * @returns {Promise<object>} List status with progress info
 */
export async function getPaymentListStatus(listId) {
  try {
    const response = await fetch(`${BULK_PAYMENT_API_URL}/list/${listId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching list status:", error);
    return { success: false, error: error.message };
  }
}

export async function getPaymentList(listId) {
  try {
    const response = await Near.view(BULK_PAYMENT_CONTRACT_ID, "view_list", {
      list_id: listId,
    });
    return response;
  } catch (error) {
    console.error("Error fetching list:", error);
    return null;
  }
}
/**
 * Build the proposal transaction for bulk payment
 * @param {object} params - Build parameters
 * @param {string} params.daoAccountId - DAO contract ID
 * @param {string} params.listId - Payment list ID
 * @param {string} params.tokenId - Token contract ID or "near" for native
 * @param {string} params.totalAmount - Total payment amount in yoctoNEAR/smallest unit
 * @param {string} params.description - Proposal description
 * @param {string} params.proposalBond - Proposal bond amount
 * @returns {object} Transaction object for signAndSendTransactions
 */
export function buildApproveListProposal({
  daoAccountId,
  listId,
  tokenId,
  totalAmount,
  description,
  proposalBond,
}) {
  const isNEAR = tokenId.toLowerCase() === "near" || tokenId === "";
  const gas = "300000000000000"; // 300 TGas

  if (isNEAR) {
    // For NEAR: FunctionCall proposal with deposit for approve_list
    return {
      contractName: daoAccountId,
      methodName: "add_proposal",
      args: {
        proposal: {
          description,
          kind: {
            FunctionCall: {
              receiver_id: BULK_PAYMENT_CONTRACT_ID,
              actions: [
                {
                  method_name: "approve_list",
                  args: Buffer.from(
                    JSON.stringify({ list_id: listId })
                  ).toString("base64"),
                  deposit: totalAmount, // Total amount to fund payments
                  gas: "150000000000000", // 150 TGas
                },
              ],
            },
          },
        },
      },
      gas,
      deposit: proposalBond,
    };
  } else {
    // For FT: FunctionCall proposal with ft_transfer_call
    return {
      contractName: daoAccountId,
      methodName: "add_proposal",
      args: {
        proposal: {
          description,
          kind: {
            FunctionCall: {
              receiver_id: tokenId, // Call the token contract
              actions: [
                {
                  method_name: "ft_transfer_call",
                  args: Buffer.from(
                    JSON.stringify({
                      receiver_id: BULK_PAYMENT_CONTRACT_ID,
                      amount: totalAmount,
                      msg: listId, // list_id as the message
                    })
                  ).toString("base64"),
                  deposit: "1", // 1 yoctoNEAR for ft_transfer_call
                  gas: "100000000000000", // 100 TGas
                },
              ],
            },
          },
        },
      },
      gas,
      deposit: proposalBond,
    };
  }
}

/**
 * Build the buy_storage proposal transaction
 * @param {object} params - Build parameters
 * @param {string} params.daoAccountId - DAO contract ID
 * @param {number} params.numRecords - Number of storage records to buy
 * @param {string} params.description - Proposal description
 * @param {string} params.proposalBond - Proposal bond amount
 * @returns {object} Transaction object for signAndSendTransactions
 */
export function buildBuyStorageProposal({
  daoAccountId,
  numRecords,
  description,
  proposalBond,
}) {
  const storageCost = calculateStorageCost(numRecords);
  const gas = "300000000000000"; // 300 TGas

  return {
    contractName: daoAccountId,
    methodName: "add_proposal",
    args: {
      proposal: {
        description,
        kind: {
          FunctionCall: {
            receiver_id: BULK_PAYMENT_CONTRACT_ID,
            actions: [
              {
                method_name: "buy_storage",
                args: Buffer.from(
                  JSON.stringify({ num_records: numRecords })
                ).toString("base64"),
                deposit: storageCost,
                gas: "50000000000000", // 50 TGas
              },
            ],
          },
        },
      },
    },
    gas,
    deposit: proposalBond,
  };
}

/**
 * Format storage cost to NEAR
 * @param {string} yoctoNear - Amount in yoctoNEAR
 * @returns {string} Formatted NEAR amount
 */
export function formatStorageCost(yoctoNear) {
  return Big(yoctoNear).div(Big(10).pow(24)).toFixed(4);
}

/**
 * Check if a proposal is a bulk payment approve_list proposal
 * @param {object} proposal - The proposal object
 * @returns {boolean} True if it's an approve_list proposal
 */
export function isBulkPaymentApproveProposal(proposal) {
  const functionCall = proposal?.kind?.FunctionCall;
  if (!functionCall) return false;

  const receiverId = functionCall.receiver_id;
  const actions = functionCall.actions || [];

  // Check if it's calling the bulk payment contract with approve_list
  return (
    receiverId === BULK_PAYMENT_CONTRACT_ID &&
    actions.some((action) => action.method_name === "approve_list")
  );
}

/**
 * Check if a proposal is a bulk payment buy_storage proposal
 * @param {object} proposal - The proposal object
 * @returns {boolean} True if it's a buy_storage proposal
 */
export function isBuyStorageProposal(proposal) {
  const functionCall = proposal?.kind?.FunctionCall;
  if (!functionCall) return false;

  const receiverId = functionCall.receiver_id;
  const actions = functionCall.actions || [];

  // Check if it's calling the bulk payment contract with buy_storage
  return (
    receiverId === BULK_PAYMENT_CONTRACT_ID &&
    actions.some((action) => action.method_name === "buy_storage")
  );
}

/**
 * Check if a proposal has a linked buy_storage proposal
 * When bulk payments need storage, buy_storage is created first (id: N),
 * then approve_list is created (id: N+1)
 * @param {object} approveListProposal - The approve_list proposal
 * @param {Array} allProposals - All proposals to check against
 * @returns {number|null} The linked buy_storage proposal ID, or null if none
 */
export function getLinkedStorageProposalId(approveListProposal, allProposals) {
  if (!isBulkPaymentApproveProposal(approveListProposal)) return null;

  const potentialStorageId = approveListProposal.id - 1;
  const potentialStorageProposal = allProposals?.find(
    (p) => p.id === potentialStorageId
  );

  // Only return the ID if the previous proposal is actually a buy_storage proposal
  if (
    potentialStorageProposal &&
    isBuyStorageProposal(potentialStorageProposal)
  ) {
    return potentialStorageId;
  }

  return null;
}

/**
 * Get the bulk payment contract ID
 * @returns {string} The bulk payment contract ID
 */
export function getBulkPaymentContractId() {
  return BULK_PAYMENT_CONTRACT_ID;
}

export const BulkPaymentContract = {
  contractId: BULK_PAYMENT_CONTRACT_ID,
  apiUrl: BULK_PAYMENT_API_URL,
  calculateStorageCost,
  generateListId,
  viewStorageCredits,
  viewPaymentList,
  submitPaymentList,
  getPaymentListStatus,
  buildApproveListProposal,
  buildBuyStorageProposal,
  formatStorageCost,
  isBulkPaymentApproveProposal,
  isBuyStorageProposal,
  getLinkedStorageProposalId,
  getBulkPaymentContractId,
};

export default BulkPaymentContract;

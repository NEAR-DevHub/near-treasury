import { Near } from "./near";
import Big from "big.js";
import { createHash } from "crypto";

// Bulk Payment Contract Configuration
const BULK_PAYMENT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_BULK_PAYMENT_CONTRACT_ID;
const BULK_PAYMENT_API_URL = process.env.NEXT_PUBLIC_BULK_PAYMENT_API_URL;

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
export async function viewStorageCredits(daoAccountId) {
  try {
    const result = await Near.view(
      BULK_PAYMENT_CONTRACT_ID,
      "view_storage_credits",
      { account_id: daoAccountId }
    );
    return typeof result === "number" ? result : parseInt(result || "0", 10);
  } catch (error) {
    console.warn("Error fetching storage credits:", error);
    return 0;
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

/**
 * Get the transaction hash for a specific recipient's payment
 * @param {string} listId - The payment list ID
 * @param {string} recipient - The recipient account ID
 * @returns {Promise<{success: boolean, recipient: string, amount: string, block_height: number, transaction_hash: string, error: string}>}
 */
export async function getPaymentTransactionHash(listId, recipient) {
  try {
    const response = await fetch(
      `${BULK_PAYMENT_API_URL}/list/${listId}/transaction/${recipient}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching payment transaction hash:", error);
    return {
      success: false,
      error: error.message,
    };
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
export async function buildApproveListProposal({
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
    const actions = [
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
    ];
    if (!isNEAR) {
      const ftStorageDeposit = await Near.view(tokenId, "storage_balance_of", {
        account_id: BULK_PAYMENT_CONTRACT_ID,
      });
      if (!ftStorageDeposit || !ftStorageDeposit?.total) {
        actions.unshift({
          method_name: "storage_deposit",
          args: Buffer.from(
            JSON.stringify({
              account_id: BULK_PAYMENT_CONTRACT_ID,
            })
          ).toString("base64"),
          deposit: Big(0.125).mul(Big(10).pow(24)).toFixed(),
          gas: "150000000000000",
        });
      }

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
                actions: actions,
              },
            },
          },
        },
        gas,
        deposit: proposalBond,
      };
    }
  }
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

  // Check for NEAR bulk payment: approve_list to bulk payment contract
  if (
    receiverId === BULK_PAYMENT_CONTRACT_ID &&
    actions.some((action) => action.method_name === "approve_list")
  ) {
    return true;
  }

  // Check for FT bulk payment: ft_transfer_call where args.receiver_id is bulk payment contract
  // Need to check ALL actions, not just the first one (proposals may have storage_deposit as first action)
  for (const action of actions) {
    if (action.method_name === "ft_transfer_call") {
      try {
        const argsBase64 = action.args;
        if (argsBase64) {
          const decodedArgs = JSON.parse(
            Buffer.from(argsBase64, "base64").toString("utf-8")
          );
          if (decodedArgs.receiver_id === BULK_PAYMENT_CONTRACT_ID) {
            return true;
          }
        }
      } catch (error) {
        console.error("Error decoding ft_transfer_call args:", error);
      }
    }
  }

  return false;
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
  generateListId,
  viewStorageCredits,
  submitPaymentList,
  getPaymentListStatus,
  getPaymentTransactionHash,
  buildApproveListProposal,
  isBulkPaymentApproveProposal,
  getBulkPaymentContractId,
};

export default BulkPaymentContract;

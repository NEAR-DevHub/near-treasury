import { logger } from "@/helpers/logger";

const CHAINDEFUSER_BRIDGE_RPC_URL = "https://bridge.chaindefuser.com/rpc";

/**
 * Fetch all supported tokens from the bridge
 * @returns {Promise<Object>} Result object containing tokens array
 */
export const fetchSupportedTokens = async () => {
  try {
    const response = await fetch(CHAINDEFUSER_BRIDGE_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "supportedTokensFetchAll",
        jsonrpc: "2.0",
        method: "supported_tokens",
        params: [{}],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Error fetching supported tokens.");
    }

    return data.result || null;
  } catch (error) {
    logger.error("Error fetching supported tokens from bridge:", error);
    throw error;
  }
};

/**
 * Fetch deposit address for a specific account and chain
 * @param {string} accountId - NEAR account ID
 * @param {string} chainId - Chain identifier (e.g., "eth:1")
 * @returns {Promise<Object>} Result object containing deposit address
 */
export const fetchDepositAddress = async (accountId, chainId) => {
  try {
    if (!accountId || !chainId) {
      throw new Error("Account ID and chain ID are required");
    }

    const response = await fetch(CHAINDEFUSER_BRIDGE_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "depositAddressFetch",
        jsonrpc: "2.0",
        method: "deposit_address",
        params: [
          {
            account_id: accountId,
            chain: chainId,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Error fetching deposit address.");
    }

    return data.result || null;
  } catch (error) {
    logger.error("Error fetching deposit address from bridge:", error);
    throw error;
  }
};

/**
 * Fetch withdrawal status for a transaction
 * @param {string} withdrawalHash - NEAR transaction hash
 * @returns {Promise<Object>} Result object containing withdrawal status
 */
export const fetchWithdrawalStatus = async (withdrawalHash) => {
  try {
    if (!withdrawalHash) {
      throw new Error("Withdrawal hash is required");
    }

    const response = await fetch(CHAINDEFUSER_BRIDGE_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "withdrawal_status",
        params: [
          {
            withdrawal_hash: withdrawalHash,
          },
        ],
      }),
    });

    if (!response.ok) {
      logger.warn("No withdrawal status response");
      return null;
    }

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    logger.error("Error fetching withdrawal status from bridge:", error);
    return null;
  }
};


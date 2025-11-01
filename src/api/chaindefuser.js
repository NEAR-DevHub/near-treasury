import { logger } from "@/helpers/logger";
import Big from "big.js";

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

/**
 * Fetch a DRY quote from 1Click API to estimate receive amount and rate
 * @param {Object} params - Quote parameters
 * @param {string} params.treasuryDaoID - Treasury DAO ID
 * @param {Object} params.daoPolicy - DAO policy with proposal_period
 * @param {Object} params.sendNetwork - Send token network object with id and decimals
 * @param {Object} params.receiveNetwork - Receive token network object with id
 * @param {number} params.amount - Amount to send (in human-readable format)
 * @param {number} params.slippagePct - Slippage tolerance percentage
 * @returns {Promise<Object>} Quote result with amountOut, rate, etc.
 */
export const fetchDryQuote = async ({
  treasuryDaoID,
  daoPolicy,
  sendNetwork,
  receiveNetwork,
  amount,
  slippagePct,
}) => {
  try {
    if (!sendNetwork || !receiveNetwork || !amount) {
      logger.warn("fetchDryQuote called with missing parameters");
      return { error: "Missing required parameters" };
    }

    const decimals = sendNetwork.decimals || 18;
    const amountInSmallestUnit = Big(amount || 0)
      .mul(Big(10).pow(decimals))
      .toFixed(0);
    const deadline = new Date();
    const proposalPeriodMs = Number(daoPolicy?.proposal_period || 0) / 1_000_000; // ns → ms
    deadline.setTime(deadline.getTime() + proposalPeriodMs);

    const quoteRequest = {
      dry: true,
      swapType: "EXACT_INPUT",
      slippageTolerance: Number(slippagePct || 1) * 100,
      originAsset: sendNetwork.id?.startsWith("nep141:")
        ? sendNetwork.id
        : `nep141:${sendNetwork.id}`,
      depositType: "INTENTS",
      destinationAsset: receiveNetwork.id,
      refundTo: treasuryDaoID,
      refundType: "INTENTS",
      recipient: treasuryDaoID,
      recipientType: "INTENTS",
      deadline: deadline.toISOString(),
      amount: amountInSmallestUnit,
    };

    logger.info("API call: fetchDryQuote", {
      treasuryDaoID,
      amount: amountInSmallestUnit,
    });

    const response = await fetch("https://1click.chaindefuser.com/v0/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      const text = await response.json();
      throw new Error(text.message || "Unable to fetch quote");
    }

    const data = await response.json();
    return data
  } catch (error) {
    logger.error("Error fetching dry quote:", error);
    return { error: error.message || "Unable to fetch quote", result: null };
  }
};

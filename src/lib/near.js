import { NearRpcClient, viewAccount } from '@near-js/jsonrpc-client';
import { logger } from "@/utils/logger";

// Utility functions for balance checking
export const getAccountBalance = async (accountId) => {
  try {
    const client = new NearRpcClient({
      endpoint: 'https://rpc.mainnet.near.org',
    });
    
    const account = await viewAccount(client, {
      accountId: accountId,
      finality: 'final',
    });
    
    return {
      available: (parseInt(account.amount) / 1e24).toString(),
      staked: (parseInt(account.locked) / 1e24).toString(),
      pending: "0"
    };
  } catch (error) {
    logger.error("Error getting balance:", error);
    return {
      available: "0",
      staked: "0", 
      pending: "0"
    };
  }
};
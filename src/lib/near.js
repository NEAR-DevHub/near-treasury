import { NearRpcClient, viewAccount } from '@near-js/jsonrpc-client';
import { logger } from "@/utils/logger";

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

// Get DAO information
export const getDaoInfo = async (daoId) => {
  try {
    const client = new NearRpcClient({
      endpoint: 'https://rpc.mainnet.near.org',
    });
    
    // Call DAO's get_policy method
    const result = await client.call({
      contractId: daoId,
      methodName: 'get_policy',
      args: {},
    });
    
    return result;
  } catch (error) {
    logger.error("Error getting DAO info:", error);
    return null;
  }
};
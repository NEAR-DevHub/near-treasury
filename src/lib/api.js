import { logger } from "@/utils/logger";

const BACKEND_API_BASE = 'https://ref-sdk-test-cold-haze-1300-2.fly.dev/api';


export const getFtTokens = async (accountId) => {
  try {
    logger.info("API call: getFtTokens", { accountId });
    const response = await fetch(`${BACKEND_API_BASE}/ft-tokens?account_id=${accountId}`);
    return response.json();
  } catch (error) {
    logger.error("Error getting FT tokens:", error);
    return [];
  }
};

export const getFtTokensPrices = async (tokens) => {
  try {
    logger.info("API call: getFtTokensPrices", { tokens });
    const response = await fetch(`${BACKEND_API_BASE}/api/ft-token-price?account_id=${accountId}`);
    return response.json();
  } catch (error) {
    logger.error("Error getting FT token prices:", error);
    return {};
  }
};

export const getNearPrice = async () => {
  try {
    logger.info("API call: getNearPrice");
    const response = await fetch(`${BACKEND_API_BASE}/near-price`);
    return response.json();
  } catch (error) {
    logger.error("Error getting NEAR price:", error);
  }
};

export const getHistoricalData = async (accountId, token) => {
  try {
    logger.info("API call: getHistoricalData", { token, accountId });
    const response = await fetch(`${BACKEND_API_BASE}/all-token-balance-history?token_id=${token}&account_id=${accountId}`);
    return response.json();
  } catch (error) {
    logger.error("Error getting historical data:", error);
    return [];
  }
};

export const getIntentsHistoricalData = async (accountId) => {
  try {
    logger.info("API call: getIntentsHistoricalData", { accountId });
    const response = await fetch(`${BACKEND_API_BASE}/intents-balance-history?account_id=${accountId}`);
    return response.json();
  } catch (error) {
    logger.error("Error getting intents data:", error);
    return [];
  }
};

export const getTransactionTransferHistory = async (accountId,lockupContract, page) => {
  try {
    logger.info("API call: getTransactionHistory", { accountId, lockupContract, page });
    let query = `transactions-transfer-history?treasuryDaoID=${accountId}&page=${page}`
    if(lockupContract){
      query += `&lockupContract=${lockupContract}`
    }
    const response = await fetch(`${BACKEND_API_BASE}/${query}`);
    return response.json();
  } catch (error) {
    logger.error("Error getting transaction history:", error);
    return [];
  }
};

export const getNearStakedPools = async (accountId) => {
  try {
    logger.info("API call: getNearStakedPool", { accountId });
    const response = await fetch(`https://staking-pools-api.neartreasury.com/v1/account/${accountId}/staking`);
    const stakingData = await response.json();
    return (stakingData?.pools ?? []).map((i) => i.pool_id);
  } catch (error) {
    logger.error("Error getting near staked pool:", error);
    return [];
  }
};

// Fetch token metadata by defuse asset ID
// Returns token metadata including symbol, icon, decimals, price, blockchain
export const fetchTokenMetadataByDefuseAssetId = async (defuseAssetIds) => {
  try {
    const tokenIdsString = Array.isArray(defuseAssetIds) 
      ? defuseAssetIds.join(",") 
      : defuseAssetIds;
    
    const response = await fetch(
      `${BACKEND_API_BASE}/token-by-defuse-asset-id?defuseAssetId=${tokenIdsString}`
    );
    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error("Error fetching token metadata by defuse asset ID:", error);
    return [];
  }
};

export const getFTTokenMetadata = async (tokenId) => {
  try {
    logger.info("API call: getFTTokenMetadata", { tokenId });
    const response = await fetch(`${BACKEND_API_BASE}/ft-token-metadata?account_id=${tokenId}`);
    return response.json();
  } catch (error) {
    logger.error("Error getting FT metadata:", error);
    return [];
  }
};
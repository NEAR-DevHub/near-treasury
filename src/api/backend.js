import { logger } from "@/helpers/logger";

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_API;

/**
 * Get all validators
 */
export const getValidators = async () => {
  try {
    const response = await fetch(`${BACKEND_API_BASE}/validators`);
    return response.json();
  } catch (error) {
    logger.error("Error getting validators:", error);
    return [];
  }
};

/**
 * Get validator details including fees and status
 */
export const getValidatorDetails = async (accountId) => {
  try {
    if (!accountId) {
      return null;
    }
    const response = await fetch(
      `${BACKEND_API_BASE}/validator-details?account_id=${accountId}`
    );
    return response.json();
  } catch (error) {
    logger.error("Error getting validator details:", error);
    return null;
  }
};

export const getFtTokens = async (accountId) => {
  try {
    if (!accountId) {
      logger.warn("getFtTokens called without accountId");
      return [];
    }

    logger.info("API call: getFtTokens", { accountId });
    const response = await fetch(
      `${BACKEND_API_BASE}/ft-tokens?account_id=${accountId}`
    );
    return response.json();
  } catch (error) {
    logger.error("Error getting FT tokens:", error);
    return [];
  }
};

/**
 * Get token price by contract address
 * @param {string} contractId - Token contract address (empty string or "near" for NEAR)
 * @returns {Promise<number|null>} Token price in USD
 */
export const getTokenPrice = async (contractId) => {
  try {
    // Don't make API call if no token address
    if (!contractId) {
      logger.warn("getTokenPrice called without valid contractId");
      return null;
    }

    logger.info("API call: getTokenPrice", { contractId });
    const response = await fetch(
      `${BACKEND_API_BASE}/ft-token-price?account_id=${contractId}`
    );
    const data = await response.json();
    return data?.price || null;
  } catch (error) {
    logger.error("Error getting token price:", error);
    return null;
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
    if (!accountId || !token) {
      logger.warn("getHistoricalData called without accountId or token");
      return [];
    }

    logger.info("API call: getHistoricalData", { token, accountId });
    const response = await fetch(
      `${BACKEND_API_BASE}/all-token-balance-history?token_id=${token}&account_id=${accountId}`
    );
    return response.json();
  } catch (error) {
    logger.error("Error getting historical data:", error);
    return [];
  }
};

export const getIntentsHistoricalData = async (accountId) => {
  try {
    if (!accountId) {
      logger.warn("getIntentsHistoricalData called without accountId");
      return [];
    }

    logger.info("API call: getIntentsHistoricalData", { accountId });
    const response = await fetch(
      `${BACKEND_API_BASE}/intents-balance-history?account_id=${accountId}`
    );
    return response.json();
  } catch (error) {
    logger.error("Error getting intents data:", error);
    return [];
  }
};

export const getTransactionTransferHistory = async (
  accountId,
  lockupContract,
  page
) => {
  try {
    if (!accountId) {
      logger.warn("getTransactionTransferHistory called without accountId");
      return [];
    }

    logger.info("API call: getTransactionHistory", {
      accountId,
      lockupContract,
      page,
    });
    let query = `transactions-transfer-history?treasuryDaoID=${accountId}&page=${page}`;
    if (lockupContract) {
      query += `&lockupContract=${lockupContract}`;
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
    if (!accountId) {
      logger.warn("getNearStakedPools called without accountId");
      return [];
    }

    logger.info("API call: getNearStakedPool", { accountId });

    const [fastnearResponse, stakingApiResponse] = await Promise.allSettled([
      fetch(`https://api.fastnear.com/v1/account/${accountId}/staking`),
      fetch(
        `https://staking-pools-api.neartreasury.com/v1/account/${accountId}/staking`
      ),
    ]);

    const allPools = [];

    // Process fastnear data
    if (fastnearResponse.status === "fulfilled" && fastnearResponse.value.ok) {
      const fastnearData = await fastnearResponse.value.json();
      const fastnearPools = (fastnearData?.pools ?? []).map((i) => i.pool_id);
      allPools.push(...fastnearPools);
    }

    // Process staking-pools-api data
    if (
      stakingApiResponse.status === "fulfilled" &&
      stakingApiResponse.value.ok
    ) {
      const stakingData = await stakingApiResponse.value.json();
      const stakingPools = (stakingData?.pools ?? []).map((i) => i.pool_id);
      allPools.push(...stakingPools);
    }

    // Return unique pool IDs
    return [...new Set(allPools)];
  } catch (error) {
    logger.error("Error getting near staked pool:", error);
    return [];
  }
};

// Fetch token metadata by defuse asset ID
// Returns token metadata including symbol, icon, decimals, price, blockchain
export const fetchTokenMetadataByDefuseAssetId = async (defuseAssetIds) => {
  try {
    if (!defuseAssetIds) {
      logger.warn(
        "fetchTokenMetadataByDefuseAssetId called without defuseAssetIds"
      );
      return [];
    }

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
    if (!tokenId) {
      logger.warn("getFTTokenMetadata called without tokenId");
      return [];
    }

    logger.info("API call: getFTTokenMetadata", { tokenId });
    const response = await fetch(
      `${BACKEND_API_BASE}/ft-token-metadata?account_id=${tokenId}`
    );
    return response.json();
  } catch (error) {
    logger.error("Error getting FT metadata:", error);
    return [];
  }
};

// Fetch blockchain metadata by network name
// Returns blockchain metadata including name and icon
export const fetchBlockchainByNetwork = async (networks, theme = "light") => {
  try {
    if (!networks) {
      logger.warn("fetchBlockchainByNetwork called without networks");
      return [];
    }

    const networkString = Array.isArray(networks)
      ? networks.join(",")
      : networks;

    const response = await fetch(
      `${BACKEND_API_BASE}/blockchain-by-network?network=${networkString}&theme=${theme}`
    );
    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error("Error fetching blockchain metadata:", error);
    return [];
  }
};

// Proposal API endpoints
// These endpoints are used for fetching and searching approved proposals

/**
 * Search proposals by ID or title
 * @param {string} proposalAPIEndpoint - The base API endpoint for proposals
 * @param {string} searchTerm - The search term (can be ID or title)
 * @returns {Promise<Array>} Array of matching proposals
 */
export const searchProposals = async (proposalAPIEndpoint, searchTerm) => {
  try {
    if (!proposalAPIEndpoint || !searchTerm) {
      logger.warn(
        "searchProposals called without proposalAPIEndpoint or searchTerm"
      );
      return [];
    }

    logger.info("API call: searchProposals", {
      proposalAPIEndpoint,
      searchTerm,
    });

    let searchUrl;
    // If search term is a number, search by sequential ID
    if (!isNaN(parseFloat(searchTerm)) && isFinite(searchTerm)) {
      const searchInput = encodeURI(searchTerm);
      searchUrl = `${proposalAPIEndpoint}?sequentialId=${searchInput}`;
    } else {
      // Otherwise, search by title
      const searchInput = encodeURI(searchTerm);
      searchUrl = `${proposalAPIEndpoint}?customQuestion=title&customAnswer=${searchInput}`;
    }

    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error("Error searching proposals:", error);
    return [];
  }
};

/**
 * Fetch approved proposals (limited to 10)
 * @param {string} proposalAPIEndpoint - The base API endpoint for proposals
 * @returns {Promise<Array>} Array of approved proposals
 */
export const fetchApprovedProposals = async (proposalAPIEndpoint) => {
  try {
    if (!proposalAPIEndpoint) {
      logger.warn("fetchApprovedProposals called without proposalAPIEndpoint");
      return [];
    }

    logger.info("API call: fetchApprovedProposals", { proposalAPIEndpoint });

    const fetchUrl = `${proposalAPIEndpoint}?status=approved`;

    const response = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error("Error fetching approved proposals:", error);
    return [];
  }
};

/**
 * Search for FT token by query (symbol or contract address)
 * Returns token metadata if found
 *
 * @param {string} query - Token symbol or contract address
 * @returns {Promise<Object|null>} Token metadata or null
 */
export const searchFTToken = async (query) => {
  try {
    if (!query) {
      logger.warn("searchFTToken called without query");
      return null;
    }

    // Handle NEAR token
    if (query?.toLowerCase() === "near") {
      return {
        contract: "near",
        name: "NEAR",
        symbol: "NEAR",
        decimals: 24,
        icon: null,
        reference: null,
      };
    }

    logger.info("API call: searchFTToken", { query });

    const response = await fetch(
      `${BACKEND_API_BASE}/search-ft?query=${query}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data || null;
  } catch (error) {
    logger.error("Error searching FT token:", error);
    return null;
  }
};

/**
 * Get list of DAOs for a user account
 * @param {string} accountId - User's NEAR account ID
 * @returns {Promise<Array>} Array of DAO IDs the user is part of
 */
export const getUserDaos = async (accountId) => {
  try {
    if (!accountId) {
      logger.warn("getUserDaos called without accountId");
      return [];
    }

    logger.info("API call: getUserDaos", { accountId });

    const response = await fetch(
      `${BACKEND_API_BASE}/user-daos?account_id=${accountId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error("Error getting user DAOs:", error);
    return [];
  }
};

/**
 * Get list of timezones
 * @returns {Promise<Array>} Array of timezone objects
 */
export const getTimezones = async () => {
  try {
    logger.info("API call: getTimezones");

    const response = await fetch(`${BACKEND_API_BASE}/timezones`, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    logger.error("Error getting timezones:", error);
    return [];
  }
};

/**
 * Fetch a real proposal quote from treasury oneclick-quote endpoint
 * @param {Object} params - Quote parameters
 * @param {string} params.treasuryDaoID - Treasury DAO ID
 * @param {Object} params.inputToken - Input token object with id, symbol, decimals, network
 * @param {Object} params.outputToken - Output token object with symbol, network, decimals
 * @param {string} params.amountIn - Amount to send in smallest units
 * @param {number} params.slippageTolerance - Slippage tolerance in basis points
 * @param {string} params.networkOut - Output network label
 * @param {string} params.tokenOutSymbol - Output token symbol
 * @returns {Promise<Object>} Quote result with proposalPayload
 */
export const fetchTreasuryOneClickQuote = async ({
  treasuryDaoID,
  inputToken,
  outputToken,
  amountIn,
  slippageTolerance,
  networkOut,
  tokenOutSymbol,
}) => {
  try {
    if (!treasuryDaoID || !inputToken || !outputToken || !amountIn) {
      logger.warn("fetchTreasuryOneClickQuote called with missing parameters");
      throw new Error("Missing required parameters");
    }

    const requestBody = {
      treasuryDaoID,
      inputToken,
      outputToken,
      amountIn,
      slippageTolerance,
      networkOut,
      tokenOutSymbol,
    };

    const response = await fetch(
      `${BACKEND_API_BASE}/treasury/oneclick-quote`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      logger.error("Backend error response:", text);
      throw new Error(
        `Backend error (${response.status}): ${text || response.statusText}`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }
    if (!data.success || !data.proposalPayload) {
      throw new Error("Invalid response from backend");
    }

    return data;
  } catch (error) {
    logger.error("Error fetching treasury oneclick quote:", error);
    throw error;
  }
};

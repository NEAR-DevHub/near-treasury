import { logger } from "@/helpers/logger";
const { Social } = require('@builddao/near-social-js');

const social = new Social();

/**
 * Get profile data from NEAR Social
 * Accepts either a single account ID or multiple account IDs
 * 
 * @param {string|Array<string>} accountIds - Single account ID or array of account IDs
 * @returns {Promise<Object>} Profile data - single profile object or object with multiple profiles
 */
export const getProfilesFromSocialDb = async (accountIds) => {
  try {
    // Handle both single account ID and array of account IDs
    const accounts = Array.isArray(accountIds) ? accountIds : [accountIds];
    
    logger.info("Social API call: getProfilesFromSocialDb", { accountIds: accounts });
    
    // Build keys array for all accounts
    const keys = accounts.map(accountId => `${accountId}/profile/*`);
    
    const result = await social.get({
      keys: keys,
    });
    
    // If single account ID was passed, return single profile
    if (!Array.isArray(accountIds)) {
      return result?.[accountIds]?.profile || {};
    }
    
    // If multiple account IDs were passed, return object with all profiles
    const profiles = {};
    accounts.forEach(accountId => {
      profiles[accountId] = result?.[accountId]?.profile || {};
    });
    
    return profiles;
  } catch (error) {
    logger.error("Error getting profiles:", error);
    return Array.isArray(accountIds) ? {} : {};
  }
};

export const getPattern = async (pattern) => {
  try {
    logger.info("Social API call: getPattern", { pattern });
    const result = await social.get({
  keys: [
   pattern,
  ],
  });

    console.log({result});
    // Placeholder - implement actual Social API call
    // This would typically call social.near contract
    return {};
  } catch (error) {
    logger.error("Error getting pattern:", error);
    return {};
  }
};

/**
 * Search and rank accounts based on term match
 * Uses profile names and account IDs from NEAR Social
 * 
 * @param {string} term - Search term
 * @param {string} currentAccountId - Current user's account ID (for ranking)
 * @param {Array<string>} filterAccounts - Accounts to exclude from results
 * @param {number} limit - Maximum number of results (default: 5)
 * @returns {Promise<Array>} Array of account objects with scores
 */
export const searchAccounts = async (
  term,
  currentAccountId,
  filterAccounts = [],
  limit = 5
) => {
  try {
    if (!currentAccountId || !term) return [];

    logger.info("Social API call: searchAccounts", { term, currentAccountId });
    
    // Fetch profiles data and following graph in a single API call
    const result = await social.get({
      keys: [
        '*/profile/name',
        `${currentAccountId}/graph/follow/**`
      ],
    });

    const profilesData = result || {};
    const followingData = result || {};

    if (!profilesData) return [];

    const profiles = Object.entries(profilesData);
    const parsedTerm = (term || "").replace(/\W/g, "").toLowerCase();
    const results = [];

    // Score and rank profiles based on search term
    for (let i = 0; i < profiles.length; i++) {
      let score = 0;
      const accountId = profiles[i][0];
      const accountIdSearch = profiles[i][0].replace(/\W/g, "").toLowerCase();
      const nameSearch = (profiles[i][1]?.profile?.name || "")
        .replace(/\W/g, "")
        .toLowerCase();
      const accountIdSearchIndex = accountIdSearch.indexOf(parsedTerm);
      const nameSearchIndex = nameSearch.indexOf(parsedTerm);

      if (accountIdSearchIndex > -1 || nameSearchIndex > -1) {
        score += 10;

        if (accountIdSearchIndex === 0) {
          score += 10;
        }
        if (nameSearchIndex === 0) {
          score += 10;
        }
        
        // Boost score for followed accounts
        if (followingData[accountId] === "") {
          score += 30;
        }

        results.push({
          accountId,
          score,
        });
      }
    }

    // Sort by score and apply filters
    results.sort((a, b) => b.score - a.score);
    let filteredResults = results.slice(0, limit);
    
    if (filterAccounts?.length > 0) {
      filteredResults = filteredResults.filter(
        (item) => !filterAccounts.includes(item.accountId)
      );
    }

    return filteredResults;
  } catch (error) {
    logger.error("Error searching accounts:", error);
    return [];
  }
};


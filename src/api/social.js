import { logger } from "@/helpers/logger";
const { Social } = require("@builddao/near-social-js");

const social = new Social();

// Cache for profile data to prevent redundant API calls
const profileCache = {};

/**
 * Get profile data from NEAR Social
 * Accepts either a single account ID or multiple account IDs
 *
 * @param {string|Array<string>} accountIds - Single account ID or array of account IDs
 * @returns {Promise<Object>} Profile data - single profile object or object with multiple profiles
 */
export const getProfilesFromSocialDb = async (accountIds) => {
  const accounts = Array.isArray(accountIds) ? accountIds : [accountIds];

  // Check cache first
  const uncachedAccounts = accounts.filter(
    (accountId) => profileCache[accountId] === undefined
  );

  if (uncachedAccounts.length === 0) {
    console.log("✅ All profiles in cache, returning cached data");
    // Return cached data
    if (Array.isArray(accountIds)) {
      return Object.fromEntries(
        accounts.map((accountId) => [accountId, profileCache[accountId] || {}])
      );
    } else {
      return profileCache[accountIds] || {};
    }
  }

  console.log("🚨 getProfilesFromSocialDb API call for:", uncachedAccounts);

  try {
    // Handle both single account ID and array of account IDs
    const keys = uncachedAccounts.map((accountId) => `${accountId}/profile/*`);

    const result = await social.get({
      keys: keys,
    });

    // Cache the results
    uncachedAccounts.forEach((accountId) => {
      profileCache[accountId] = result?.[accountId]?.profile || {};
    });

    // If single account ID was passed, return single profile
    if (!Array.isArray(accountIds)) {
      return profileCache[accountIds] || {};
    }

    // If multiple account IDs were passed, return object with all profiles
    const profiles = {};
    accounts.forEach((accountId) => {
      profiles[accountId] = profileCache[accountId] || {};
    });

    return profiles;
  } catch (error) {
    logger.error("Error getting profiles:", error);
    // Cache null to prevent retries
    uncachedAccounts.forEach((accountId) => {
      profileCache[accountId] = {};
    });
    return Array.isArray(accountIds) ? {} : {};
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
      keys: ["*/profile/name", `${currentAccountId}/graph/follow/**`],
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

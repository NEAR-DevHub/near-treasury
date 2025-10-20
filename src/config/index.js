import daoConfigData from "@/config/daoConfig.json";

/**
 * Get configuration for a specific DAO
 * Falls back to default config if DAO-specific config not found
 * 
 * @param {string} daoId - The DAO account ID
 * @returns {Object} DAO configuration
 */
export function getDaoConfig(daoId) {
  if (!daoId) {
    return daoConfigData.default;
  }

  // Check if we have DAO-specific config
  const daoSpecificConfig = daoConfigData.daos[daoId];

  if (daoSpecificConfig) {
    // Merge with defaults (DAO-specific config overrides defaults)
    return {
      ...daoConfigData.default,
      ...daoSpecificConfig,
    };
  }

  // Return default config
  return daoConfigData.default;
}
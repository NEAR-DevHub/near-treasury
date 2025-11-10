import { Near } from "@/api/near";

/**
 * Validates a DAO ID for Sputnik DAO treasury access
 * First checks the format, then makes an API call to verify existence
 *
 * @param {string} daoId - The DAO ID to validate
 * @returns {Promise<{isValid: boolean, error?: string, daoId?: string}>} - Validation result
 */
export const validateDaoId = async (daoId) => {
  if (!daoId || !daoId.trim()) {
    return {
      isValid: false,
      error: "DAO ID is required",
    };
  }

  const trimmedDaoId = daoId.trim();

  // Check if DAO ID ends with sputnik-dao.near
  if (!trimmedDaoId.endsWith(".sputnik-dao.near")) {
    return {
      isValid: false,
      error: "DAO ID must end with .sputnik-dao.near",
    };
  }

  try {
    // Check if account exists on NEAR
    const accountData = await Near.viewAccount(trimmedDaoId);

    if (!accountData) {
      return {
        isValid: false,
        error: "DAO account does not exist on NEAR blockchain",
      };
    }

    return {
      isValid: true,
      daoId: trimmedDaoId,
    };
  } catch (error) {
    console.error("Error validating DAO:", error);
    return {
      isValid: false,
      error: "Error validating DAO account. Please try again.",
    };
  }
};

/**
 * Treasury-specific helper functions
 */

import { getUserDaos } from "@/api/backend";
import { Near } from "@/api/near";

/**
 * Get list of treasuries for a user account
 * Checks for frontend existence and includes config data
 */
export async function getUserTreasuries(accountId) {
  if (!accountId) return [];

  try {
    const userDaos = await getUserDaos(accountId);

    const treasuries = await Promise.all(
      userDaos.map(async (daoId) => {
        try {
          const config= await  Near.view(daoId, "get_config", {});
          const metadata = config.metadata
            ? JSON.parse(atob(config.metadata))
            : null;

          return {
            daoId,
            config: {
              ...config,
              metadata,
            },
          };
        } catch (error) {
          console.error(`Error processing DAO ${daoId}:`, error);
          return null;
        }
      })
    );

    return treasuries.filter(Boolean);
  } catch (error) {
    console.error("Error getting user treasuries:", error);
    return [];
  }
}


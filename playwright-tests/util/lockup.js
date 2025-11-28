/**
 * Lockup Contract Creation Utilities
 *
 * Functions for deploying lockup contracts in near-sandbox tests.
 * This file only handles lockup creation. For staking operations through lockup,
 * see test-helpers.js in the stake-delegation test folder.
 */

// Lockup contract ID constants
export const LOCKUP_WHITELIST_ID = "lockup-whitelist.near";
export const LOCKUP_FACTORY_ID = "lockup.near";
export const POOL_FACTORY_ID = "poolv1.near";
export const ASTRO_STAKERS_POOL_ID = "astro-stakers.poolv1.near";

/**
 * Helper function to extract lockup contract ID from creation result logs
 * @private
 */
function findLockupContractLog(json) {
  // Check if logs are at the top level first (sandbox returns this way)
  if (json.logs && Array.isArray(json.logs)) {
    for (const log of json.logs) {
      if (
        log.includes("The lockup contract") &&
        log.includes("was successfully created")
      ) {
        const match = log.match(
          /The lockup contract (.+?) was successfully created/
        );
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  }

  // Check receiptsOutcome (camelCase from sandbox)
  if (json.receiptsOutcome && Array.isArray(json.receiptsOutcome)) {
    for (const receipt of json.receiptsOutcome) {
      const logs = receipt.outcome?.logs || [];
      for (const log of logs) {
        if (
          log.includes("The lockup contract") &&
          log.includes("was successfully created")
        ) {
          const match = log.match(
            /The lockup contract (.+?) was successfully created/
          );
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }
  }

  // Fallback: check receipts_outcome (snake_case for compatibility)
  if (json.receipts_outcome && Array.isArray(json.receipts_outcome)) {
    for (const receipt of json.receipts_outcome) {
      const logs = receipt.outcome?.logs || [];
      for (const log of logs) {
        if (
          log.includes("The lockup contract") &&
          log.includes("was successfully created")
        ) {
          const match = log.match(
            /The lockup contract (.+?) was successfully created/
          );
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }
  }

  return "No lockup contract creation log found.";
}

/**
 * Setup lockup account in sandbox
 * Deploys and initializes lockup contracts following NEAR's lockup pattern
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.daoAccountId - DAO account ID (will be lockup owner)
 * @param {string} params.creatorAccountId - Account to deploy from
 * @param {string} params.lockupDuration - Lockup duration in nanoseconds (default: 2 years)
 * @returns {Promise<string>} - Lockup contract ID
 */
export async function setupLockupAccount({
  sandbox,
  daoAccountId,
  creatorAccountId,
  lockupDuration = "63036000000000000", // 2 years in nanoseconds
}) {
  console.log("\n=== Setting up Lockup Contracts ===\n");

  // Helper to parse NEAR amounts
  const parseNEAR = (amount) => BigInt(parseFloat(amount) * 1e24).toString();

  // Step 1: Import and initialize lockup-whitelist contract
  const whitelistContractId = await sandbox.importMainnetContract(
    LOCKUP_WHITELIST_ID,
    LOCKUP_WHITELIST_ID
  );

  await sandbox.functionCall(
    creatorAccountId,
    whitelistContractId,
    "new",
    {
      foundation_account_id: POOL_FACTORY_ID,
    },
    "300000000000000"
  );
  console.log(`✓ Initialized ${LOCKUP_WHITELIST_ID}`);

  // Step 2: Import and initialize lockup factory
  const lockupFactoryId = await sandbox.importMainnetContract(
    LOCKUP_FACTORY_ID,
    LOCKUP_FACTORY_ID
  );

  await sandbox.functionCall(
    creatorAccountId,
    lockupFactoryId,
    "new",
    {
      whitelist_account_id: LOCKUP_WHITELIST_ID,
      foundation_account_id: POOL_FACTORY_ID,
      master_account_id: POOL_FACTORY_ID,
      lockup_master_account_id: LOCKUP_FACTORY_ID,
    },
    "300000000000000"
  );
  console.log(`✓ Initialized ${LOCKUP_FACTORY_ID} factory`);

  await sandbox.functionCall(
    creatorAccountId,
    POOL_FACTORY_ID,
    "new",
    {
      staking_pool_whitelist_account_id: LOCKUP_WHITELIST_ID,
    },
    "300000000000000"
  );

  console.log(`✓ Initialized ${POOL_FACTORY_ID} factory`);

  // Step 3: Verify DAO account exists before creating lockup
  console.log(`\nVerifying DAO account exists: ${daoAccountId}`);
  try {
    const daoAccount = await sandbox.viewAccount(daoAccountId);
    console.log(`✓ DAO account confirmed - Balance: ${daoAccount.amount}`);
  } catch (error) {
    console.error(`❌ DAO account NOT FOUND: ${daoAccountId}`);
    console.error(`Error:`, error.message);
    throw new Error(
      `Cannot create lockup: DAO account ${daoAccountId} does not exist`
    );
  }

  // Step 4: Create the actual lockup instance for the DAO
  console.log(`\nCreating lockup with owner: ${daoAccountId}`);
  const createLockupResult = await sandbox.functionCall(
    creatorAccountId,
    lockupFactoryId,
    "create",
    {
      owner_account_id: daoAccountId,
      lockup_duration: lockupDuration,
    },
    "300000000000000",
    parseNEAR("40") // 40 NEAR attached deposit
  );
  console.log("✓ Created lockup instance");

  // Whitelist the astro-stakers pool
  await sandbox.functionCall(
    POOL_FACTORY_ID,
    whitelistContractId,
    "add_staking_pool",
    { staking_pool_account_id: ASTRO_STAKERS_POOL_ID },
    "300000000000000"
  );

  // Step 5: Extract lockup contract ID from creation logs
  const lockupContractId = findLockupContractLog(createLockupResult);

  if (
    !lockupContractId ||
    lockupContractId === "No lockup contract creation log found."
  ) {
    throw new Error("Failed to create lockup contract - no log found");
  }

  console.log(`✓ Lockup contract ID: ${lockupContractId}`);

  // Step 6: Fund the lockup with additional NEAR
  await sandbox.transfer(creatorAccountId, lockupContractId, parseNEAR("10"));
  console.log(`✓ Funded lockup with 10 NEAR`);

  console.log("\n=== Lockup Setup Complete ===\n");

  return lockupContractId;
}

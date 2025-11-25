/**
 * Lockup Contract Helpers for Sandbox Tests
 *
 * Utilities for setting up and mocking lockup contracts in near-sandbox tests.
 * Used across stake, unstake, and withdraw delegation tests.
 */

import { sha256 } from "js-sha256";

// Contract ID constants
export const ASTRO_STAKERS_POOL_ID = "astro-stakers.poolv1.near";
export const POOL_FACTORY_ID = "poolv1.near";
export const LOCKUP_WHITELIST_ID = "lockup-whitelist.near";
export const LOCKUP_FACTORY_ID = "lockup.near";

/**
 * Calculate lockup address from DAO account ID
 * Uses SHA256 hash (same as production)
 *
 * @param {string} accountId - The DAO account ID
 * @returns {string} - The lockup contract address
 */
export function accountToLockup(accountId) {
  if (!accountId) return null;

  const lockupAccount = `${sha256(Buffer.from(accountId))
    .toString("hex")
    .slice(0, 40)}.lockup.near`;

  return lockupAccount;
}

/**
 * Setup lockup account in sandbox
 * This properly deploys and initializes lockup contracts following NEAR's lockup pattern
 *
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
  // Step 3: Create the actual lockup instance for the DAO
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

  // Step 4: Extract lockup contract ID from creation logs
  const lockupContractId = findLockupContractLog(createLockupResult);

  if (
    !lockupContractId ||
    lockupContractId === "No lockup contract creation log found."
  ) {
    throw new Error("Failed to create lockup contract - no log found");
  }

  console.log(`✓ Lockup contract ID: ${lockupContractId}`);

  // Step 5: Fund the lockup with additional NEAR
  await sandbox.transfer(creatorAccountId, lockupContractId, parseNEAR("10"));
  console.log(`✓ Funded lockup with 10 NEAR`);

  console.log("\n=== Lockup Setup Complete ===\n");

  return lockupContractId;
}

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
 * Setup lockup account (Simple Version)
 * Creates a basic lockup account without full contract deployment
 * Use this for quick tests that only need mocked responses
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.daoAccountId - DAO account ID
 * @param {string} params.creatorAccountId - Account to fund from
 * @returns {Promise<string>} - Lockup contract ID
 */
export async function setupLockupAccountSimple({
  sandbox,
  daoAccountId,
  creatorAccountId,
}) {
  // Calculate lockup address (for reference, even though we won't use it in sandbox)
  const lockupAccountId = accountToLockup(daoAccountId);

  console.log(`✓ Using lockup ID: ${lockupAccountId} (mocked)`);
  console.log(
    "⚠️  Note: Using simple setup - lockup contract not actually deployed"
  );
  console.log(
    "   This works with RPC mocking but won't execute actual lockup transactions"
  );

  return lockupAccountId;
}

/**
 * Mock lockup contract state (view_state)
 *
 * This mocks the lockup contract's internal state which includes:
 * - Owner account
 * - Locked amount
 * - Release duration
 * - Whitelist account ID
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page
 * @param {string} params.lockupContract - Lockup contract ID
 * @param {boolean} params.stakingAllowed - Whether staking is allowed (default: true)
 */
export async function mockLockupState({
  page,
  lockupContract,
  stakingAllowed = true,
}) {
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const request = route.request();
    const requestPostData = request.postDataJSON();

    if (
      requestPostData.params &&
      requestPostData.params.account_id === lockupContract &&
      requestPostData.params.request_type === "view_state"
    ) {
      // Base64 encoded state with whitelist
      // If stakingAllowed = true, use "lockup-whitelist.near"
      // If stakingAllowed = false, use "lockup-no-whitelist.near"
      const whitelistValue = stakingAllowed
        ? "bG9ja3VwLXdoaXRlbGlzdC5uZWFy" // "lockup-whitelist.near"
        : "bG9ja3VwLW5vLXdoaXRlbGlzdC5uZWFy"; // "lockup-no-whitelist.near"

      const json = {
        jsonrpc: "2.0",
        result: {
          block_hash: "2Dc8Jh8mFU8bKe16hAVcZ3waQhhdfUXwvvnsDP9djN95",
          block_height: 140432800,
          values: [
            {
              key: "U1RBVEU=", // Base64 for "STATE"
              value:
                "DAAAAG1lZ2hhMTkubmVhcgAAACWkAAqLyiIEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAABPkZROAAABAACi6omWKxgAfKTy6T+hPRYAGAAAAGxvY2t1cC13aGl0ZWxpc3QubmVhcgAA",
            },
          ],
        },
        id: requestPostData.id,
      };
      await route.fulfill({ json });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock get_staking_pool_account_id method
 *
 * Returns the currently selected validator (or null if none)
 * Lockup contracts can only have ONE validator at a time
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page
 * @param {string|null} params.validatorPoolId - Current validator (null if none)
 */
export async function mockLockupSelectedPool({ page, validatorPoolId = null }) {
  await page.route("**/rpc.mainnet.near.org/**", async (route) => {
    const request = route.request();
    const requestPostData = request.postDataJSON();

    if (
      requestPostData.params &&
      requestPostData.params.method_name === "get_staking_pool_account_id"
    ) {
      const resultValue = validatorPoolId
        ? Buffer.from(JSON.stringify(validatorPoolId)).toJSON().data
        : Buffer.from(JSON.stringify(null)).toJSON().data;

      const json = {
        jsonrpc: "2.0",
        result: {
          block_hash: "abc123",
          block_height: 123456,
          logs: [],
          result: resultValue,
        },
        id: requestPostData.id,
      };
      await route.fulfill({ json });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock get_balance method for lockup
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page
 * @param {string} params.balance - Balance in yoctoNEAR
 */
export async function mockLockupBalance({ page, balance }) {
  await page.route("**/rpc.mainnet.near.org/**", async (route) => {
    const request = route.request();
    const requestPostData = request.postDataJSON();

    if (
      requestPostData.params &&
      requestPostData.params.method_name === "get_balance"
    ) {
      const json = {
        jsonrpc: "2.0",
        result: {
          block_hash: "abc123",
          block_height: 123456,
          logs: [],
          result: Buffer.from(JSON.stringify(balance)).toJSON().data,
        },
        id: requestPostData.id,
      };
      await route.fulfill({ json });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock get_locked_amount method for lockup
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page
 * @param {string} params.lockedAmount - Locked amount in yoctoNEAR
 */
export async function mockLockupLockedAmount({ page, lockedAmount }) {
  await page.route("**/rpc.mainnet.near.org/**", async (route) => {
    const request = route.request();
    const requestPostData = request.postDataJSON();

    if (
      requestPostData.params &&
      requestPostData.params.method_name === "get_locked_amount"
    ) {
      const json = {
        jsonrpc: "2.0",
        result: {
          block_hash: "abc123",
          block_height: 123456,
          logs: [],
          result: Buffer.from(JSON.stringify(lockedAmount)).toJSON().data,
        },
        id: requestPostData.id,
      };
      await route.fulfill({ json });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock staking pools API for lockup
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page
 * @param {string} params.lockupContract - Lockup contract ID
 * @param {Array} params.pools - Array of pool objects { pool_id, staked, unstaked, availableToWithdraw }
 */
export async function mockLockupStakedPools({
  page,
  lockupContract,
  pools = [],
}) {
  await page.route(
    `**/staking-pools-api.neartreasury.com/v1/account/${lockupContract}/staking`,
    async (route) => {
      const json = {
        account_id: lockupContract,
        pools: pools.map((pool) => ({
          last_update_block_height: 129849269,
          pool_id: pool.pool_id,
          // Additional fields if needed
        })),
      };
      await route.fulfill({ json });
    }
  );
}

/**
 * Mock lockup discovery (when app checks if lockup exists)
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page
 * @param {string} params.lockupContract - Lockup contract ID
 * @param {string} params.sandboxRpcUrl - Sandbox RPC URL
 */
export async function mockLockupDiscovery({
  page,
  lockupContract,
  sandboxRpcUrl,
}) {
  await page.route("**/rpc.mainnet.near.org/**", async (route) => {
    const postData = route.request().postDataJSON();

    // When app checks if lockup exists
    if (
      postData.params?.account_id === lockupContract &&
      postData.method === "query" &&
      postData.params?.request_type === "view_account"
    ) {
      // Return that lockup exists with balance
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          jsonrpc: "2.0",
          result: {
            amount: "50000000000000000000000000", // 50 NEAR
            block_height: 123456,
            block_hash: "abc123",
            code_hash: "11111111111111111111111111111111",
            locked: "0",
            storage_paid_at: 0,
            storage_usage: 182,
          },
          id: postData.id,
        }),
      });
      return;
    }

    // Pass through to sandbox
    const response = await route.fetch({
      url: sandboxRpcUrl,
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      postData: JSON.stringify(postData),
    });
    await route.fulfill({ response });
  });
}

/**
 * Setup all lockup mocks at once (convenience function)
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page
 * @param {string} params.lockupContract - Lockup contract ID
 * @param {string} params.sandboxRpcUrl - Sandbox RPC URL
 * @param {Object} params.config - Configuration
 * @param {boolean} params.config.stakingAllowed - Whether staking is allowed
 * @param {string|null} params.config.validatorPoolId - Current validator (null if none)
 * @param {string} params.config.balance - Total balance in yoctoNEAR
 * @param {string} params.config.lockedAmount - Locked amount in yoctoNEAR
 * @param {Array} params.config.stakedPools - Array of staked pools
 */
export async function setupLockupMocks({
  page,
  lockupContract,
  sandboxRpcUrl,
  config = {},
}) {
  const {
    stakingAllowed = true,
    validatorPoolId = null,
    balance = "50000000000000000000000000", // 50 NEAR
    lockedAmount = "25000000000000000000000000", // 25 NEAR locked
    stakedPools = [],
  } = config;

  // Mock lockup state
  await mockLockupState({ page, lockupContract, stakingAllowed });

  // Mock selected validator
  await mockLockupSelectedPool({ page, validatorPoolId });

  // Mock balance
  await mockLockupBalance({ page, balance });

  // Mock locked amount
  await mockLockupLockedAmount({ page, lockedAmount });

  // Mock staked pools
  await mockLockupStakedPools({ page, lockupContract, pools: stakedPools });

  // Mock discovery
  await mockLockupDiscovery({ page, lockupContract, sandboxRpcUrl });

  console.log(`✓ Setup all lockup mocks for: ${lockupContract}`);
}

/**
 * Helper to convert NEAR to yoctoNEAR
 */
export function toYoctoNEAR(nearAmount) {
  return BigInt(parseFloat(nearAmount) * 1e24).toString();
}

/**
 * Helper to convert yoctoNEAR to NEAR
 */
export function fromYoctoNEAR(yoctoAmount) {
  return (BigInt(yoctoAmount) / BigInt(1e24)).toString();
}

/**
 * Select a staking pool for a lockup contract
 * This is required before staking with a new validator
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.lockupContractId - Lockup contract ID
 * @param {string} params.validatorPoolId - Validator pool ID (default: astro-stakers.poolv1.near)
 * @param {string} params.callerAccountId - Account calling the function (must be lockup owner)
 * @returns {Promise<void>}
 */
export async function selectStakingPool({
  sandbox,
  lockupContractId,
  validatorPoolId,
  callerAccountId,
}) {
  console.log(
    `Selecting staking pool ${validatorPoolId} for lockup ${lockupContractId}...`
  );

  await sandbox.functionCall(
    callerAccountId,
    lockupContractId,
    "select_staking_pool",
    {
      staking_pool_account_id: validatorPoolId,
    },
    "300000000000000" // 300 TGas
  );

  console.log(`✓ Selected staking pool: ${validatorPoolId}`);
}

/**
 * Stake tokens through a lockup contract
 * Deposits and stakes tokens to the selected validator pool
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.lockupContractId - Lockup contract ID
 * @param {string} params.amount - Amount to stake in yoctoNEAR
 * @param {string} params.callerAccountId - Account calling the function (must be lockup owner)
 * @returns {Promise<void>}
 */
export async function stakeThroughLockup({
  sandbox,
  lockupContractId,
  amount,
  callerAccountId,
}) {
  console.log(
    `Staking ${fromYoctoNEAR(amount)} NEAR through lockup ${lockupContractId}...`
  );

  await sandbox.functionCall(
    callerAccountId,
    lockupContractId,
    "deposit_and_stake",
    {
      amount,
    },
    "300000000000000" // 300 TGas
  );

  console.log(`✓ Staked ${fromYoctoNEAR(amount)} NEAR`);
}

/**
 * Unstake tokens through a lockup contract
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.lockupContractId - Lockup contract ID
 * @param {string} params.amount - Amount to unstake in yoctoNEAR
 * @param {string} params.callerAccountId - Account calling the function (must be lockup owner)
 * @returns {Promise<void>}
 */
export async function unstakeThroughLockup({
  sandbox,
  lockupContractId,
  amount,
  callerAccountId,
}) {
  console.log(
    `Unstaking ${fromYoctoNEAR(amount)} NEAR through lockup ${lockupContractId}...`
  );

  await sandbox.functionCall(
    callerAccountId,
    lockupContractId,
    "unstake",
    {
      amount,
    },
    "300000000000000" // 300 TGas
  );

  console.log(`✓ Unstaked ${fromYoctoNEAR(amount)} NEAR`);
}

/**
 * Withdraw tokens from staking pool through lockup contract
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.lockupContractId - Lockup contract ID
 * @param {string} params.callerAccountId - Account calling the function (must be lockup owner)
 * @returns {Promise<void>}
 */
export async function withdrawThroughLockup({
  sandbox,
  lockupContractId,
  callerAccountId,
}) {
  console.log(
    `Withdrawing from staking pool through lockup ${lockupContractId}...`
  );

  await sandbox.functionCall(
    callerAccountId,
    lockupContractId,
    "withdraw_all_from_staking_pool",
    {},
    "300000000000000" // 300 TGas
  );

  console.log(`✓ Withdrawn from staking pool`);
}

/**
 * Deploy staking pool infrastructure in sandbox
 * Creates the poolv1.near factory and astro-stakers.poolv1.near validator pool.
 * This is needed for DAO staking tests. For lockup tests, it's already deployed in setupLockupAccount.
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.creatorAccountId - Account to use for deployment
 * @returns {Promise<void>}
 */
export async function deployStakingPool({ sandbox, creatorAccountId }) {
  console.log("\n=== Deploying Staking Pool Infrastructure ===\n");

  // Helper to parse NEAR amounts
  const parseNEAR = (amount) => BigInt(parseFloat(amount) * 1e24).toString();

  // Step 1: Import and deploy poolv1.near factory if not exists
  try {
    await sandbox.importMainnetContract(POOL_FACTORY_ID, POOL_FACTORY_ID);

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
  } catch (e) {
    console.error(`Error importing ${POOL_FACTORY_ID} factory:`, e);
  }

  // Step 2: Create astro-stakers staking pool
  const creatorKeyPair = sandbox.accountKeys?.get(creatorAccountId);
  const publicKey = creatorKeyPair
    ? creatorKeyPair.getPublicKey().toString()
    : "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp";

  await sandbox.functionCall(
    creatorAccountId,
    POOL_FACTORY_ID,
    "create_staking_pool",
    {
      staking_pool_id: "astro-stakers",
      owner_id: creatorAccountId,
      stake_public_key: publicKey,
      reward_fee_fraction: {
        numerator: 10,
        denominator: 100,
      },
    },
    "300000000000000",
    parseNEAR("32") // 32 NEAR attached deposit
  );
  console.log(`✓ Created staking pool: ${ASTRO_STAKERS_POOL_ID}`);
}

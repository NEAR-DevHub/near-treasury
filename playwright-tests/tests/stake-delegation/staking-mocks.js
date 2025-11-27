/**
 * Optimized Staking API Mocking Utilities
 *
 * Provides efficient mocking for staking-related API calls
 * - Supports both fastnear and neartreasury staking APIs
 * - Pre-configured scenarios for common test cases
 * - Single route handler for optimal performance
 */

/**
 * Convert NEAR to yoctoNEAR string (API format)
 */
const toYoctoString = (nearAmount) => {
  const yocto = BigInt(Math.floor(nearAmount * 1e24));
  return yocto.toString();
};

/**
 * Core staking API mocker - handles both fastnear and neartreasury APIs
 * Uses a single regex route for efficiency
 *
 * @param {Object} options
 * @param {Page} options.page - Playwright page object
 * @param {string} options.accountId - Account to mock staking for
 * @param {Array} options.pools - Array of pool objects with staked/unstaked/availableToWithdraw
 * @param {boolean} options.mockRPC - If true, mocks RPC calls to validator contracts (default: true)
 *                                     Set to false when using real deployed contracts in sandbox
 */
export async function mockStakingPoolsAPI({
  page,
  accountId,
  pools = [],
  mockRPC = true,
}) {
  const poolData = pools.map((pool) => ({
    pool_id: pool.poolId,
    staked: toYoctoString(pool.staked || 0),
    unstaked: toYoctoString(pool.unstaked || 0),
    available_to_withdraw: toYoctoString(pool.availableToWithdraw || 0),
    last_update_block_height: 129849269,
  }));

  const response = { account_id: accountId, pools: poolData };

  // Mock staking APIs (which pools exist) - always needed
  await page.route(
    /\/(api\.fastnear\.com|staking-pools-api\.neartreasury\.com)\/.*\/staking$/,
    async (route) => {
      if (route.request().url().includes(accountId)) {
        await route.fulfill({ json: response });
      } else {
        await route.continue();
      }
    }
  );

  // Only mock RPC if mockRPC is true (for validation tests without real contracts)
  // When mockRPC is false, we use the real deployed contracts in sandbox
  if (mockRPC) {
    // Mock RPC calls to validator pool contracts (actual balances)
    await page.route(
      /rpc\.(mainnet\.near\.org|mainnet\.fastnear\.com)|localhost:\d+/,
      async (route) => {
        const postData = route.request().postDataJSON();

        // Check if it's a view call to a validator pool
        if (postData?.params?.request_type === "call_function") {
          const contractId = postData.params.account_id;
          const methodName = postData.params.method_name;
          const args = postData.params.args_base64
            ? JSON.parse(
                Buffer.from(postData.params.args_base64, "base64").toString()
              )
            : {};

          // Find the pool in our mocked data
          const pool = pools.find((p) => contractId === p.poolId);

          if (pool && args.account_id === accountId) {
            let result;

            if (methodName === "get_account_staked_balance") {
              result = toYoctoString(pool.staked || 0);
            } else if (methodName === "get_account_unstaked_balance") {
              result = toYoctoString(
                (pool.unstaked || 0) + (pool.availableToWithdraw || 0)
              );
            } else if (methodName === "is_account_unstaked_balance_available") {
              result = (pool.availableToWithdraw || 0) > 0;
            } else {
              return route.continue();
            }

            await route.fulfill({
              json: {
                jsonrpc: "2.0",
                result: {
                  result: Array.from(Buffer.from(JSON.stringify(result))),
                  logs: [],
                  block_height: 129849269,
                  block_hash: "abc123",
                },
                id: postData.id,
              },
            });
            return;
          }
        }

        await route.continue();
      }
    );
  }
}

/**
 * Pre-configured staking scenarios
 * Use these for cleaner, more readable tests
 */
export const StakingScenarios = {
  /** No staked funds */
  NONE: (accountId) => ({ accountId, pools: [] }),

  /** Only staked balance (for unstake tests) */
  STAKED: (accountId, amount = 10, poolId = "astro-stakers.poolv1.near") => ({
    accountId,
    pools: [{ poolId, staked: amount, unstaked: 0, availableToWithdraw: 0 }],
  }),

  /** Unstaked but in waiting period */
  UNSTAKED_PENDING: (
    accountId,
    amount = 5,
    poolId = "astro-stakers.poolv1.near"
  ) => ({
    accountId,
    pools: [{ poolId, staked: 0, unstaked: amount, availableToWithdraw: 0 }],
  }),

  /** Ready to withdraw */
  WITHDRAWABLE: (
    accountId,
    amount = 5,
    poolId = "astro-stakers.poolv1.near"
  ) => ({
    accountId,
    pools: [{ poolId, staked: 0, unstaked: 0, availableToWithdraw: amount }],
  }),

  /** Multiple validators */
  MULTI: (accountId) => ({
    accountId,
    pools: [
      {
        poolId: "astro-stakers.poolv1.near",
        staked: 10,
        unstaked: 5,
        availableToWithdraw: 3,
      },
      {
        poolId: "legends.poolv1.near",
        staked: 8,
        unstaked: 2,
        availableToWithdraw: 2,
      },
    ],
  }),
};

/**
 * Quick setup with pre-configured scenario
 * @param {Page} page - Playwright page object
 * @param {Object} scenario - Scenario from StakingScenarios
 * @param {boolean} mockRPC - If true, mocks RPC calls to validator contracts (default: true)
 * @example
 * // Validation test (no real contracts, mock everything):
 * await mockStakingScenario(page, StakingScenarios.STAKED(daoId, 15));
 *
 * // Integration test (with deployed contracts, only mock API):
 * await mockStakingScenario(page, StakingScenarios.STAKED(daoId, 15), false);
 */
export const mockStakingScenario = (page, scenario, mockRPC = true) =>
  mockStakingPoolsAPI({
    page,
    ...scenario,
    mockRPC,
  });

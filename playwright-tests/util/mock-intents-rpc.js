/**
 * Mock Intents RPC Utility
 *
 * Provides utilities to mock NEAR RPC responses for intents.near contract
 * specifically for mt_tokens_for_owner and mt_batch_balance_of methods.
 *
 * This allows mainnet tests to simulate NEAR Intents wallet having specific
 * tokens (BTC, ETH, SOL, etc.) without requiring actual tokens on chain.
 */

/**
 * Creates mock token data for intents.near contract
 *
 * @param {Array<{symbol: string, tokenId: string, balance: string}>} tokens - Array of tokens to mock
 * @returns {Object} Mock data for mt_tokens_for_owner and mt_batch_balance_of
 *
 * @example
 * const mockData = createMockIntentsTokens([
 *   { symbol: "BTC", tokenId: "nep141:btc.omft.near", balance: "100000000" }, // 1 BTC (8 decimals)
 *   { symbol: "ETH", tokenId: "nep141:eth.omft.near", balance: "1000000000000000000" }, // 1 ETH (18 decimals)
 *   { symbol: "SOL", tokenId: "nep141:sol.omft.near", balance: "1000000000" }, // 1 SOL (9 decimals)
 * ]);
 */
export function createMockIntentsTokens(tokens) {
  // Ensure token IDs have nep141: prefix
  const ownedTokens = tokens.map((token) => {
    const tokenId = token.tokenId.startsWith("nep141:")
      ? token.tokenId
      : `nep141:${token.tokenId}`;
    return {
      token_id: tokenId,
    };
  });

  const balances = tokens.map((token) => token.balance);

  return {
    ownedTokens,
    balances,
  };
}

/**
 * Setup RPC interception to mock intents.near contract responses
 *
 * @param {Page} page - Playwright page object
 * @param {Object} mockData - Mock data from createMockIntentsTokens
 * @param {string} accountId - DAO account ID that owns the tokens
 *
 * @example
 * const mockData = createMockIntentsTokens([
 *   { symbol: "BTC", tokenId: "nep141:btc.omft.near", balance: "100000000" },
 * ]);
 * await mockIntentsRpc(page, mockData, "testing-astradao.sputnik-dao.near");
 */
export async function mockIntentsRpc(page, mockData, accountId) {
  // Set up route handlers
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const postData = route.request().postDataJSON();

    // Check if this is an intents.near contract call
    // The structure from @near-js/jsonrpc-client is different
    if (
      postData &&
      postData.params &&
      postData.params.request_type === "call_function" &&
      postData.params.account_id === "intents.near"
    ) {
      const methodName = postData.params.method_name;

      const args = JSON.parse(
        Buffer.from(postData.params.args_base64, "base64").toString()
      );

      // Mock mt_tokens_for_owner
      if (methodName === "mt_tokens_for_owner") {
        // Only mock for the specific account we're testing
        if (args.account_id === accountId) {
          console.log("[MOCK] Mocking mt_tokens_for_owner response");
          console.log("[MOCK] Returning tokens:", mockData.ownedTokens);

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              result: {
                result: Array.from(
                  new TextEncoder().encode(JSON.stringify(mockData.ownedTokens))
                ),
              },
              id: postData.id,
            }),
          });
          return;
        }
      }

      // Mock mt_batch_balance_of
      if (methodName === "mt_batch_balance_of") {
        console.log("[MOCK] Mocking mt_batch_balance_of response");
        const args = JSON.parse(
          Buffer.from(postData.params.args_base64, "base64").toString()
        );
        console.log("[MOCK] Requested tokens:", args.token_ids);

        // Only mock for the specific account we're testing
        if (args.account_id === accountId) {
          // Match requested token_ids with our mock data and return balances in order
          const requestedTokenIds = args.token_ids || [];
          const balances = requestedTokenIds.map((requestedId) => {
            const index = mockData.ownedTokens.findIndex(
              (t) => t.token_id === requestedId
            );
            return index >= 0 ? mockData.balances[index] : "0";
          });
          console.log("[MOCK] Returning balances:", balances);

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              result: {
                result: Array.from(
                  new TextEncoder().encode(JSON.stringify(balances))
                ),
              },
              id: postData.id,
            }),
          });
          return;
        }
      }
    }

    // For all other requests, continue normally
    await route.continue();
  });

  // Also intercept rpc.mainnet.near.org
  await page.route("**/rpc.mainnet.near.org/**", async (route) => {
    const postData = route.request().postDataJSON();

    // Check if this is an intents.near contract call
    if (
      postData &&
      postData.params &&
      postData.params.request_type === "call_function" &&
      postData.params.account_id === "intents.near"
    ) {
      const methodName = postData.params.method_name;

      // Mock mt_tokens_for_owner
      if (methodName === "mt_tokens_for_owner") {
        const args = JSON.parse(
          Buffer.from(postData.params.args_base64, "base64").toString()
        );

        // Only mock for the specific account we're testing
        if (args.account_id === accountId) {
          console.log("[MOCK] Mocking mt_tokens_for_owner response");
          console.log("[MOCK] Returning tokens:", mockData.ownedTokens);

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              result: {
                result: Array.from(
                  new TextEncoder().encode(JSON.stringify(mockData.ownedTokens))
                ),
              },
              id: postData.id,
            }),
          });
          return;
        }
      }

      // Mock mt_batch_balance_of
      if (methodName === "mt_batch_balance_of") {
        console.log("[MOCK] Mocking mt_batch_balance_of response");
        const args = JSON.parse(
          Buffer.from(postData.params.args_base64, "base64").toString()
        );
        console.log("[MOCK] Requested tokens:", args.token_ids);

        // Only mock for the specific account we're testing
        if (args.account_id === accountId) {
          // Match requested token_ids with our mock data and return balances in order
          const requestedTokenIds = args.token_ids || [];
          const balances = requestedTokenIds.map((requestedId) => {
            const index = mockData.ownedTokens.findIndex(
              (t) => t.token_id === requestedId
            );
            return index >= 0 ? mockData.balances[index] : "0";
          });
          console.log("[MOCK] Returning balances:", balances);

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              result: {
                result: Array.from(
                  new TextEncoder().encode(JSON.stringify(balances))
                ),
              },
              id: postData.id,
            }),
          });
          return;
        }
      }
    }

    // For all other requests, continue normally
    await route.continue();
  });

  // Wait a moment to ensure route handlers are fully registered
  // This prevents race conditions where balance lookups happen before mocks are ready
  await page.waitForTimeout(100);
}

/**
 * Common token configurations for easy reuse
 * Balances are provided as strings with proper decimals
 */
export const MOCK_TOKENS = {
  BTC: {
    symbol: "BTC",
    tokenId: "nep141:btc.omft.near",
    balance: "100000000", // 1 BTC (8 decimals)
  },
  ETH: {
    symbol: "ETH",
    tokenId: "nep141:eth.omft.near",
    balance: "1000000000000000000", // 1 ETH (18 decimals)
  },
  SOL: {
    symbol: "SOL",
    tokenId: "nep141:sol.omft.near",
    balance: "1000000000", // 1 SOL (9 decimals)
  },
  USDC_BASE: {
    symbol: "USDC (BASE)",
    tokenId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    balance: "1000000", // 1 USDC (6 decimals)
  },
  USDC_ARB: {
    symbol: "USDC (ARB)",
    tokenId:
      "nep141:arbitrum-0xaf88d065e77c8cC2239327C5EDb3A432268e5831.omft.near",
    balance: "1000000", // 1 USDC (6 decimals)
  },
};

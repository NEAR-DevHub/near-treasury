/**
 * Reusable RPC Mocking Utilities
 *
 * Utilities for mocking NEAR RPC responses in Playwright tests.
 */

/**
 * Create a mock RPC response for a view function call
 * @param {any} result - The result to return (will be JSON stringified and base64 encoded)
 * @param {string|number} id - The RPC request ID
 * @returns {object} - The mock RPC response
 */
export function createRpcResponse(result, id) {
  const resultJson = JSON.stringify(result);
  const resultBase64 = Buffer.from(resultJson).toString("base64");
  const resultBytes = Array.from(Buffer.from(resultBase64, "base64"));

  return {
    jsonrpc: "2.0",
    result: { result: resultBytes },
    id: id,
  };
}

/**
 * Check if an RPC request is for a specific contract method
 * @param {object} postData - The RPC request data
 * @param {string} methodName - The method name to check for
 * @returns {boolean} - True if the request is for the specified method
 */
export function isRpcMethodCall(postData, methodName) {
  return (
    postData?.params?.request_type === "call_function" &&
    postData?.params?.method_name === methodName
  );
}

/**
 * Parse args from an RPC request
 * @param {object} postData - The RPC request data
 * @returns {object|null} - The parsed args or null
 */
export function parseRpcArgs(postData) {
  const argsBase64 = postData?.params?.args_base64;
  if (!argsBase64) return null;

  try {
    const argsString = Buffer.from(argsBase64, "base64").toString();
    return JSON.parse(argsString);
  } catch (error) {
    console.warn("Failed to parse RPC args:", error);
    return null;
  }
}

/**
 * Mock view_storage_credits method
 * @param {object} page - Playwright page object
 * @param {number} credits - Number of credits to return
 */
export async function mockStorageCredits(page, credits) {
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const postData = route.request().postDataJSON();

    if (isRpcMethodCall(postData, "view_storage_credits")) {
      const response = createRpcResponse(credits, postData.id);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock storage_balance_of method
 * @param {object} page - Playwright page object
 * @param {function} balanceResolver - Function that takes account_id and returns balance or null
 *
 * Example:
 * mockStorageBalanceOf(page, (accountId) => {
 *   if (accountId === "unregistered.near") return null;
 *   return { total: "1250000000000000000000", available: "0" };
 * });
 */
export async function mockStorageBalanceOf(page, balanceResolver) {
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const postData = route.request().postDataJSON();

    if (isRpcMethodCall(postData, "storage_balance_of")) {
      const args = parseRpcArgs(postData);
      const accountId = args?.account_id;
      const balance = balanceResolver(accountId);

      const response = createRpcResponse(balance, postData.id);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock multiple RPC methods at once
 * @param {object} page - Playwright page object
 * @param {object} methodMocks - Object mapping method names to resolver functions
 *
 * Example:
 * mockRpcMethods(page, {
 *   view_storage_credits: () => 100,
 *   storage_balance_of: (args) => {
 *     if (args.account_id === "unregistered.near") return null;
 *     return { total: "1250000000000000000000", available: "0" };
 *   },
 *   ft_metadata: () => ({ name: "USDT", decimals: 6 })
 * });
 */
export async function mockRpcMethods(page, methodMocks) {
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const postData = route.request().postDataJSON();

    // Check each method mock
    for (const [methodName, resolver] of Object.entries(methodMocks)) {
      if (isRpcMethodCall(postData, methodName)) {
        const args = parseRpcArgs(postData);
        const result =
          typeof resolver === "function" ? resolver(args) : resolver;

        const response = createRpcResponse(result, postData.id);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(response),
        });
        return;
      }
    }

    // Let other RPC calls through
    await route.continue();
  });
}

/**
 * Mock a specific contract method with custom logic
 * @param {object} page - Playwright page object
 * @param {string} methodName - The method name to mock
 * @param {function|any} resolver - Function that takes args and returns result, or a static value
 *
 * Example with function:
 * mockContractMethod(page, "view_storage_credits", (args) => {
 *   return args.account_id === "special.near" ? 1000 : 100;
 * });
 *
 * Example with static value:
 * mockContractMethod(page, "view_storage_credits", 100);
 */
export async function mockContractMethod(page, methodName, resolver) {
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const postData = route.request().postDataJSON();

    if (isRpcMethodCall(postData, methodName)) {
      const args = parseRpcArgs(postData);
      const result = typeof resolver === "function" ? resolver(args) : resolver;

      const response = createRpcResponse(result, postData.id);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    } else {
      await route.continue();
    }
  });
}

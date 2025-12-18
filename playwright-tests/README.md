# Playwright E2E Test Suite

End-to-end tests for the NEAR Treasury application using Playwright with near-sandbox integration.

## Setup

The test suite is already configured. Dependencies are installed in the main project.

## Running Tests

```bash
# Run all tests in headless mode
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in UI mode (for devcontainer/codespace)
npm run test:e2e:ui:devcontainer

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# Show test report
npm run test:e2e:report

# Run specific test files
npx playwright test playwright-tests/tests/intents/payment-request-ui.spec.js
npx playwright test playwright-tests/tests/sandbox/btc-payment-request.spec.js
```

## Test Structure

```
playwright-tests/
├── playwright.config.js              # Playwright configuration
├── util/
│   ├── sandbox.js                    # Near-sandbox wrapper utilities
│   └── mock-intents-rpc.js           # RPC mocking utility for read-only tests
├── tests/
│   ├── sandbox/                      # [Category 1] Integration tests - Pure contract testing
│   │   └── btc-payment-request.spec.js   # Example: BTC payment with sandbox
│   ├── intents/                      # Mixed test categories for Intents features
│   │   ├── payment-request-ui.spec.js    # [Category 1] Integration: Full E2E with sandbox
│   │   ├── payment-request-detail.spec.js # [Category 2] Read-only: Mainnet historical data
│   │   ├── intents-dashboard.spec.js     # [Category 3] Read-only: RPC mocking
│   │   └── intents-deposit-ui.spec.js    # [Category 1] Integration: Deposit flows
│   ├── components/                   # [Category 4] Component tests
│   │   ├── token-amount.spec.js          # Example: Amount formatting
│   │   └── other-chain-account-input.spec.js # Example: Address validation
│   └── dashboard/
│       └── open-dashboard.spec.js
└── README.md

Test Categories:
[1] Integration Tests with Sandbox    - Create new blockchain state
[2] Read-Only with Mainnet Data       - Test historical data display
[3] Read-Only with RPC Mocking        - Test current data with controlled mocks
[4] Component Tests                   - Test UI components in isolation
```

## Configuration

The test suite is configured to:

- Run against `http://localhost:3000` by default
- Automatically start the Next.js dev server before tests
- Test on Chromium, Firefox, and WebKit
- Capture screenshots and videos on failure
- Retry failed tests in CI environments

## Test Categories

The test suite is organized into different categories based on testing approach. Each category serves a specific purpose and should be used for the appropriate test scenario.

> **Note**: As the test suite grows, tests may be further organized into dedicated folders by category (e.g., `tests/read-only-mainnet/`, `tests/read-only-mocked/`). The examples below show the current organization and serve as patterns for future tests.

### 1. Integration Tests with Sandbox (`tests/intents/payment-request-ui.spec.js`)

- **Use case**: End-to-end flows that create new blockchain state
- **Setup**: Uses near-sandbox to create isolated blockchain environment
- **Characteristics**:
  - Creates accounts, deploys contracts, executes transactions
  - Full UI + blockchain interaction
  - Slower (2-5 min setup time)
  - Perfect for testing complete user journeys

### 2. Read-Only Tests with Mainnet Data (`tests/intents/payment-request-detail.spec.js`)

- **Use case**: Testing UI rendering of existing historical data
- **Setup**: No sandbox, no mocking - uses real mainnet data
- **Characteristics**:
  - Fast (< 30 seconds)
  - No blockchain state changes
  - Tests against historical proposals that won't change
  - Perfect for detail pages, display logic, read-only views

### 3. Read-Only Tests with RPC Mocking (`tests/intents/intents-dashboard.spec.js`)

- **Use case**: Testing UI with controlled, predictable data
- **Setup**: Mock RPC responses to return specific test data
- **Characteristics**:
  - Fast (< 30 seconds)
  - Deterministic - same data every test run
  - No external dependencies
  - Perfect for testing different UI states (empty, loaded, multi-chain)

### 4. Component Tests (`tests/components/`)

- **Use case**: Testing individual UI components in isolation
- **Setup**: Direct component interaction, no blockchain
- **Characteristics**:
  - Very fast (< 10 seconds)
  - Tests validation logic, formatting, user input
  - No network calls
  - Perfect for forms, inputs, display components

## Choosing the Right Testing Approach

### Decision Tree

**Q: Are you creating new blockchain state (proposals, transfers, votes)?**

- ✅ **YES** → Use Integration Tests with Sandbox ([See Section](#test-type-2-ui-tests-with-sandbox-integration))
  - Examples: Creating payment requests, voting, executing proposals
  - File pattern: `tests/intents/*-ui.spec.js`

**Q: Are you testing display of existing data?**

- ✅ **YES** → Continue to next question

**Q: Does the data change frequently or need to be controlled?**

- ✅ **YES** (e.g., current portfolio balances) → Use RPC Mocking ([See Section](#read-only-tests-with-rpc-mocking))
  - Examples: Dashboard portfolio display, current token balances
  - File pattern: `tests/intents/*-dashboard.spec.js`
- ❌ **NO** (e.g., historical proposals) → Use Mainnet Data ([See Section](#read-only-tests-with-mainnet-data))
  - Examples: Payment detail pages, proposal history, past transactions
  - File pattern: `tests/intents/*-detail.spec.js`

**Q: Are you testing a UI component in isolation?**

- ✅ **YES** → Use Component Tests ([See Section](#component-tests))
  - Examples: Input validation, formatting, address validation
  - File pattern: `tests/components/*.spec.js`

### Read-Only Tests with Mainnet Data

**When to use:**

- Testing detail pages for historical data (proposals, transactions)
- Data that won't change over time
- Want fastest possible tests without mocking complexity
- Need to test against real production data

**Example:** `tests/intents/payment-request-detail.spec.js`

```javascript
import { test, expect } from "@playwright/test";

const DAO_ID = "webassemblymusic-treasury.sputnik-dao.near";

test.describe("Payment Request Detail Page", () => {
  test("displays Intents payment for ETH", async ({ page }) => {
    // Use historical proposal ID that won't change
    // Proposal ID 2: 0.005 ETH payment created on specific date
    await page.goto(
      `http://localhost:3000/${DAO_ID}/payments?tab=history&id=2`,
      { waitUntil: "networkidle" }
    );

    // Wait for page to fully load with real data
    await expect(page.getByText("Payment Request Approved")).toBeVisible({
      timeout: 15000,
    });

    // Test UI renders correctly with real mainnet data
    await expect(
      page.getByText("0xa029Ca6D14b97749889702eE16E7d168a1094aFE")
    ).toBeVisible();
    await expect(page.getByText("0.005")).toBeVisible();

    console.log("✓ Detail page displays correctly with mainnet data");
  });
});
```

**Advantages:**

- ✅ No mocking code needed
- ✅ Tests against real production data
- ✅ Very fast (< 30 seconds)
- ✅ Catches regressions in real data handling

**When NOT to use:**

- ❌ Data might change (current balances, active proposals)
- ❌ Need to test edge cases not present in mainnet
- ❌ Testing create/update/delete operations

### Read-Only Tests with RPC Mocking

**When to use:**

- Testing UI with current/changing data (portfolio balances)
- Need deterministic, controlled test data
- Want to test multiple scenarios (empty, loaded, multi-chain)
- Data should stay consistent across test runs

**Example:** `tests/intents/intents-dashboard.spec.js`

```javascript
import { test, expect } from "@playwright/test";
import {
  createMockIntentsTokens,
  mockIntentsRpc,
  MOCK_TOKENS,
} from "../../util/mock-intents-rpc.js";

const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

test.describe("Intents Dashboard Display", () => {
  test("should display NEAR Intents card with token balances", async ({
    page,
  }) => {
    // Mock RPC to return specific token balances
    const mockData = createMockIntentsTokens([
      MOCK_TOKENS.BTC, // 1 BTC
      MOCK_TOKENS.ETH, // 1 ETH
      MOCK_TOKENS.SOL, // 1 SOL
    ]);
    await mockIntentsRpc(page, mockData, TEST_DAO_ID);

    // Navigate to dashboard - will use mocked data
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/dashboard`);
    await page.waitForLoadState("networkidle");

    // Verify UI displays mocked tokens
    const intentsCard = page.locator('[data-testid="intents-portfolio"]');
    await expect(intentsCard.getByText("BTC")).toBeVisible();
    await expect(intentsCard.getByText("ETH")).toBeVisible();
    await expect(intentsCard.getByText("SOL")).toBeVisible();
  });

  test("should aggregate USDC across multiple chains", async ({ page }) => {
    // Mock USDC on NEAR, Base, and Ethereum
    const mockData = createMockIntentsTokens([
      {
        symbol: "USDC",
        tokenId:
          "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
        balance: "1000000", // 1 USDC on NEAR
      },
      MOCK_TOKENS.USDC_BASE, // 1 USDC on Base
      {
        symbol: "USDC",
        tokenId: "eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
        balance: "1000000", // 1 USDC on Ethereum
      },
    ]);
    await mockIntentsRpc(page, mockData, TEST_DAO_ID);

    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/dashboard`);
    await page.waitForLoadState("networkidle");

    // Verify aggregation works correctly
    const intentsCard = page.locator('[data-testid="intents-portfolio"]');
    await expect(intentsCard.getByText("USDC")).toBeVisible();

    const intentsText = await intentsCard.textContent();
    // Should show aggregated amount (3 USDC total)
    expect(intentsText).toMatch(/USDC.*[23]/); // 2-3 tokens aggregated
  });

  test("should not display NEAR Intents card when no assets", async ({
    page,
  }) => {
    // Mock empty balances
    const mockData = createMockIntentsTokens([]);
    await mockIntentsRpc(page, mockData, TEST_DAO_ID);

    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/dashboard`);
    await page.waitForLoadState("networkidle");

    // Verify card is hidden when no tokens
    await expect(page.getByText("NEAR Intents")).not.toBeVisible();
  });
});
```

**Creating the Mock Utility** (`util/mock-intents-rpc.js`):

```javascript
export const MOCK_TOKENS = {
  BTC: { symbol: "BTC", tokenId: "nep141:btc.omft.near", balance: "100000000" },
  ETH: {
    symbol: "ETH",
    tokenId: "nep141:eth.omft.near",
    balance: "1000000000000000000",
  },
  SOL: {
    symbol: "SOL",
    tokenId: "nep141:sol.omft.near",
    balance: "1000000000",
  },
  USDC_BASE: {
    symbol: "USDC",
    tokenId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    balance: "1000000",
  },
};

export function createMockIntentsTokens(tokens) {
  return {
    tokens_for_owner: tokens.map((t) => ({ token_id: t.tokenId })),
    batch_balance_of: tokens.map((t) => t.balance),
  };
}

export async function mockIntentsRpc(page, mockData, daoId) {
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const postData = route.request().postDataJSON();

    // Mock mt_tokens_for_owner
    if (postData.params?.method_name === "mt_tokens_for_owner") {
      const result = Array.from(
        new TextEncoder().encode(JSON.stringify(mockData.tokens_for_owner))
      );
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ result: { result } }),
      });
      return;
    }

    // Mock mt_batch_balance_of
    if (postData.params?.method_name === "mt_batch_balance_of") {
      const result = Array.from(
        new TextEncoder().encode(JSON.stringify(mockData.batch_balance_of))
      );
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ result: { result } }),
      });
      return;
    }

    // Let other RPC calls pass through
    await route.continue();
  });
}
```

**Advantages:**

- ✅ Deterministic - same data every run
- ✅ Can test edge cases (empty, partial data, errors)
- ✅ No external dependencies
- ✅ Fast (< 30 seconds)

**When NOT to use:**

- ❌ Testing against real historical data
- ❌ Need to verify actual blockchain state
- ❌ Creating new blockchain transactions

### Component Tests

**When to use:**

- Testing input validation
- Testing formatting logic
- Testing user interactions with form elements
- No blockchain data needed

**Example:** `tests/components/other-chain-account-input.spec.js`

```javascript
test("validates Bitcoin address format", async ({ page }) => {
  await page.goto("http://localhost:3000/test-dao/payments/create");

  // Select Bitcoin network
  await page.getByRole("combobox", { name: "Network" }).selectOption("Bitcoin");

  // Enter invalid address
  await page.getByRole("textbox", { name: "Recipient" }).fill("invalid");

  // Verify error message
  await expect(page.getByText("Invalid Bitcoin address")).toBeVisible();

  // Enter valid address
  await page
    .getByRole("textbox", { name: "Recipient" })
    .fill("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");

  // Verify error cleared
  await expect(page.getByText("Invalid Bitcoin address")).not.toBeVisible();
});
```

**Advantages:**

- ✅ Very fast (< 10 seconds)
- ✅ Isolated from backend
- ✅ Easy to test edge cases
- ✅ Great for TDD

## Writing Tests with Near-Sandbox

### Overview

The test suite supports two types of tests:

1. **Sandbox-only tests**: Pure contract testing without UI (fast, isolated)
2. **UI tests with sandbox**: Full end-to-end tests with browser + sandbox blockchain

### Test Type 1: Sandbox-Only Contract Tests

These tests focus on smart contract interactions without a browser UI.

**Example:** `tests/sandbox/btc-payment-request.spec.js`

```javascript
import { test, expect } from "@playwright/test";
import { NearSandbox, parseNEAR } from "../../util/sandbox.js";

let sandbox;

test.describe("BTC Payment Request Flow (Sandbox Only)", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    sandbox = new NearSandbox();
    await sandbox.start();
  });

  test.afterAll(async () => {
    await sandbox.stop();
  });

  test("create payment request to transfer BTC", async () => {
    // 1. Import contracts from mainnet
    const omftContractId = await sandbox.importMainnetContract(
      "omft.near",
      "omft.near"
    );

    // 2. Initialize contracts
    await sandbox.functionCall(omftContractId, omftContractId, "new", {
      /* args */
    });

    // 3. Create accounts
    const creatorAccountId = await sandbox.createAccount("testcreator.near");

    // 4. Execute transactions
    await sandbox.functionCall(creatorAccountId, daoAccountId, "add_proposal", {
      /* args */
    });

    // 5. Verify state
    const balance = await sandbox.viewFunction(
      contractId,
      "mt_batch_balance_of",
      {
        /* args */
      }
    );
    expect(balance).toEqual(["32000000000"]);
  });
});
```

### Test Type 2: UI Tests with Sandbox Integration

These tests combine browser UI interactions with a sandboxed blockchain.

**Example:** `tests/intents/payment-request-ui.spec.js`

#### Step 1: Setup Sandbox and Contracts

```javascript
import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

let sandbox;
let contractVariables; // Store contract IDs, account IDs, etc.

test.describe("Payment Request UI Flow", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);

    // Initialize sandbox
    sandbox = new NearSandbox();
    await sandbox.start();

    // Import and setup contracts
    const omftContractId = await sandbox.importMainnetContract(
      "omft.near",
      "omft.near"
    );
    const intentsContractId = await sandbox.importMainnetContract(
      "intents.near",
      "intents.near"
    );

    // Initialize contracts, create accounts, deposit tokens
    // ... (same as sandbox-only tests)

    // Store for use in tests
    contractVariables = { omftContractId, intentsContractId /* ... */ };
  });

  test.afterAll(async () => {
    await sandbox.stop();
  });
});
```

#### Step 2: Inject Test Wallet and Setup Interceptors

```javascript
test("should create and approve payment request", async ({ page }) => {
  // 1. Inject test wallet into browser
  await injectTestWallet(page, sandbox, creatorAccountId);

  // 2. Route RPC calls to sandbox
  const sandboxRpcUrl = sandbox.getRpcUrl();
  await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
    const postData = route.request().postDataJSON();
    const response = await route.fetch({
      url: sandboxRpcUrl,
      method: "POST",
      headers: { "content-type": "application/json" },
      postData: JSON.stringify(postData),
    });
    await route.fulfill({ response });
  });

  // 3. Intercept indexer API calls
  await interceptIndexerAPI(page, sandbox);

  // Now navigate to the app
  await page.goto(`http://localhost:3000/${daoAccountId}/payments`);
});
```

#### Step 3: Set Wallet in localStorage

```javascript
// Set localStorage to use test wallet
await page.evaluate(() => {
  localStorage.setItem("selected-wallet", "test-wallet");
});

// Reload to apply localStorage changes
await page.reload();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000); // Wait for React hydration
```

#### Step 4: Interact with UI

```javascript
// Navigate and fill form
await page.getByText("Create Request").click();
await page
  .getByRole("textbox", { name: "Title" })
  .fill("Payment request title");
await page.getByRole("spinbutton", { name: "Amount" }).fill("2");

// Submit form (transaction will be signed by injected wallet)
await page.getByRole("button", { name: "Submit" }).click();

// Wait for transaction to complete
await page.waitForTimeout(3000);

// Verify success
await expect(
  page.getByText("Payment request has been successfully created.")
).toBeVisible();
```

#### Step 5: Handle Conditional UI States

```javascript
// Check if proposal appears in table or needs navigation
const proposalInTable = await page
  .locator("tbody tr")
  .filter({ hasText: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" })
  .first()
  .isVisible()
  .catch(() => false);

if (proposalInTable) {
  await page
    .locator("tbody tr")
    .filter({ hasText: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" })
    .first()
    .click();
} else {
  await page.getByText("View Request").click();
}

// Handle expand button if sidebar opens
const expandButton = page.locator(".bi.bi-arrows-angle-expand");
if (await expandButton.isVisible().catch(() => false)) {
  await expandButton.click();
}
```

#### Step 6: Verify Contract State

```javascript
// Verify balance before approval
const balanceBefore = await sandbox.viewFunction(
  intentsContractId,
  "mt_batch_balance_of",
  {
    account_id: daoAccountId,
    token_ids: ["nep141:btc.omft.near"],
  }
);
expect(balanceBefore).toEqual(["32000000000"]); // 320 BTC

// Approve proposal
await page.getByRole("button", { name: "Approve" }).first().click();
await page.getByRole("button", { name: "Confirm" }).click();
await page.waitForTimeout(3000);

// Verify balance after
const balanceAfter = await sandbox.viewFunction(/* ... */);
expect(balanceAfter).toEqual(["31800000000"]); // 318 BTC
```

### Sandbox Utility API Reference

#### `NearSandbox` Class

```javascript
const sandbox = new NearSandbox();

// Initialize sandbox
await sandbox.start();

// Create funded account
const accountId = await sandbox.createAccount("myaccount.near");

// Import mainnet contract
const contractId = await sandbox.importMainnetContract(
  "contract.near",
  "localname.near"
);

// Execute state-changing function
await sandbox.functionCall(
  signerId,
  receiverId,
  methodName,
  args,
  (gas = "300000000000000"),
  (deposit = "0")
);

// Query contract state
const result = await sandbox.viewFunction(contractId, methodName, args);

// View mainnet contract (for metadata, etc.)
const metadata = await sandbox.viewFunctionMainnet("token.near", "ft_metadata");

// Get RPC URL for routing
const rpcUrl = sandbox.getRpcUrl();

// Clean up
await sandbox.stop();
```

#### `injectTestWallet(page, sandbox, accountId)`

Injects a test wallet into the browser that signs transactions using sandbox keypairs.

```javascript
await injectTestWallet(page, sandbox, "testaccount.near");
```

#### `interceptIndexerAPI(page, sandbox)`

Intercepts Sputnik indexer API calls and returns sandbox data.

```javascript
await interceptIndexerAPI(page, sandbox);
```

#### `parseNEAR(amount)`

Converts NEAR amount to yoctoNEAR.

```javascript
const deposit = await parseNEAR("5"); // Returns "5000000000000000000000000"
```

### Best Practices

1. **Use `test.beforeAll` for setup**: Initialize sandbox and contracts once for all tests
2. **Clean up in `test.afterAll`**: Always call `sandbox.stop()`
3. **Set adequate timeouts**: Sandbox setup can take 1-2 minutes
4. **Wait for transactions**: Use `page.waitForTimeout(3000)` after transaction signing
5. **Handle conditional UI states**: Check if elements exist before interacting
6. **Use `.first()` for duplicate elements**: When sidebar + table both show same content
7. **Verify both UI and contract state**: Check UI updates AND blockchain state

### Common Patterns

#### Pattern: Create DAO with Specific Policy

```javascript
const daoAccountId = await sandbox.createDao({
  name: "testdao",
  creatorAccountId,
  roles: [
    {
      name: "Create Requests",
      permissions: ["call:AddProposal", "transfer:AddProposal"],
    },
  ],
});
```

#### Pattern: Deposit Tokens to DAO

```javascript
await sandbox.functionCall(omftContractId, omftContractId, "ft_deposit", {
  owner_id: intentsContractId,
  token: "btc",
  amount: "32000000000",
  msg: JSON.stringify({ receiver_id: daoAccountId }),
});
```

#### Pattern: Verify Event Logs

```javascript
const result = await sandbox.functionCall(/* ... */);
expect(result.logsContain('EVENT_JSON:{"event":"ft_burn"}')).toBeTruthy();
```

### Debugging Tips

1. **Use headed mode**: `npm run test:e2e:headed` to see browser
2. **Check console logs**: Browser console errors are logged to test output
3. **Take screenshots**: `await page.screenshot({ path: 'debug.png' })`
4. **Check sandbox logs**: Sandbox RPC calls are logged to console
5. **Use Playwright Inspector**: `npm run test:e2e:debug`

## Resources

- [Playwright Documentation](https://playwright.dev)
- [near-sandbox Documentation](https://github.com/near/near-sandbox)
- [Test Plan](../PLAYWRIGHT_TEST_PLAN.md)
- [Old Test Suite](https://github.com/NEAR-DevHub/neardevhub-treasury-dashboard/tree/develop/playwright-tests) (reference)

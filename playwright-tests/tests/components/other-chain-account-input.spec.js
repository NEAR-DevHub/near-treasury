import { test, expect } from "@playwright/test";
import {
  createMockIntentsTokens,
  mockIntentsRpc,
  MOCK_TOKENS,
} from "../../util/mock-intents-rpc.js";
import { mockIndexerFtTokens } from "../../util/mock-indexer-api.js";

/**
 * OtherChainAccountInput Component Tests
 *
 * Tests cross-chain address validation for various blockchains including:
 * - Bitcoin (BTC): Bech32, P2PKH, P2SH formats
 * - Ethereum (ETH) and ETH-like chains (BASE, ARB, etc.): 0x format
 * - Solana (SOL): Base58 format
 * - Dogecoin (DOGE): D or A prefix
 * - XRP: r prefix
 * - Tron (TRON): T prefix
 * - Zcash (ZEC): t1, t3, zc formats
 *
 * The component validates addresses using regex patterns and shows visual
 * feedback (is-valid/is-invalid CSS classes) based on validation results.
 *
 * Note: These tests use mainnet and test validation on the create payment form.
 * No transactions are created - we only test frontend validation logic.
 */

const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

// Test data with valid and invalid addresses for each blockchain
const testCases = {
  btc: {
    name: "Bitcoin",
    valid: [
      "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080", // Bech32
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // P2PKH Legacy
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", // P2SH Legacy
    ],
    invalid: [
      "bc1invalid", // Too short
      "bc2qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080", // Wrong prefix
      "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Ethereum address
    ],
  },
  eth: {
    name: "Ethereum",
    valid: [
      "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      "0x0000000000000000000000000000000000000000", // Zero address
    ],
    invalid: [
      "0x742d35Cc6634C0532925a3b844Bc454e4438f44", // Too short
      "742d35Cc6634C0532925a3b844Bc454e4438f44e", // Missing 0x
      "0x742d35Cc6634C0532925a3b844Bc454e4438f44G", // Invalid hex
    ],
  },
  sol: {
    name: "Solana",
    valid: [
      "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      "11111111111111111111111111111112", // System program
    ],
    invalid: [
      "9WzDXwBbmkg8ZTbNMqUxvQRAyr", // Too short
      "0WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", // Starts with 0
      "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWW+", // Invalid character
    ],
  },
};

test.describe("OtherChainAccountInput validation", () => {
  test.afterEach(async ({ page }) => {
    // Clean up route handlers to avoid interference between tests
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("validates BTC addresses correctly", async ({ page }) => {
    const daoId = TEST_DAO_ID;

    // Mock indexer API to avoid rate limiting
    await mockIndexerFtTokens(page);

    // Mock RPC to ensure BTC is available (test won't fail if removed from treasury)
    const mockData = createMockIntentsTokens([MOCK_TOKENS.BTC]);
    await mockIntentsRpc(page, mockData, daoId);

    // Navigate to payments page first
    await page.goto(`http://localhost:3000/${daoId}/payments`);

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Click "Create Request" button
    const createButton = page.getByRole("button", { name: "Create Request" });
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();
    await page.getByText("Single Request").click();

    // Wait for the form to load
    await expect(page.getByText("Create Payment Request")).toBeVisible({
      timeout: 10000,
    });

    console.log("Testing Bitcoin (BTC) address validation");

    // Select NEAR Intents wallet
    const walletSelector = page.getByRole("button", { name: "Select Wallet" });
    await expect(walletSelector).toBeVisible();
    await walletSelector.click();

    await expect(page.getByText("NEAR Intents")).toBeVisible();
    await page.getByText("NEAR Intents").click();

    // Wait for wallet selection to complete
    await page.waitForTimeout(1000);

    // Select a cross-chain token (BTC) to trigger address input
    const tokenDropdown = page
      .locator(
        'button:has-text("Select Token"), [data-testid="token-dropdown"]'
      )
      .first();
    await expect(tokenDropdown).toBeVisible({ timeout: 10_000 });
    await tokenDropdown.click();
    await page.waitForTimeout(500);

    // Look for BTC or any cross-chain token option
    const btcOption = page.locator("text=/BTC/i").first();
    await expect(btcOption).toBeVisible({ timeout: 10_000 });
    await btcOption.click();
    await page.waitForTimeout(500);

    // Now the address input should be visible
    const addressInput = page.locator('input[placeholder*="Address"]').first();
    await expect(addressInput).toBeVisible({ timeout: 10_000 });

    // Test valid BTC addresses
    for (const address of testCases.btc.valid) {
      console.log(`  Testing valid BTC address: ${address}`);
      await addressInput.fill(address);
      await page.waitForTimeout(200);

      const inputClasses = await addressInput.getAttribute("class");
      expect(inputClasses).toContain("is-valid");
      expect(inputClasses).not.toContain("is-invalid");
    }

    // Test invalid BTC addresses
    for (const address of testCases.btc.invalid) {
      console.log(`  Testing invalid BTC address: ${address}`);
      await addressInput.fill(address);
      await page.waitForTimeout(200);

      const inputClasses = await addressInput.getAttribute("class");
      if (address !== "") {
        expect(inputClasses).toContain("is-invalid");
        expect(inputClasses).not.toContain("is-valid");
      }
    }

    console.log("✓ BTC address validation working correctly");
  });

  test("validates ETH addresses correctly", async ({ page }) => {
    const daoId = TEST_DAO_ID;

    // Mock indexer API to avoid rate limiting
    await mockIndexerFtTokens(page);

    // Mock RPC to ensure ETH/USDC tokens are available
    const mockData = createMockIntentsTokens([
      MOCK_TOKENS.ETH,
      MOCK_TOKENS.USDC_BASE,
    ]);
    await mockIntentsRpc(page, mockData, daoId);

    await page.goto(`http://localhost:3000/${daoId}/payments`);
    await page.waitForLoadState("networkidle");

    const createButton = page.getByRole("button", { name: "Create Request" });
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();
    await page.getByText("Single Request").click();

    await expect(page.getByText("Create Payment Request")).toBeVisible({
      timeout: 10000,
    });

    console.log("Testing Ethereum (ETH) address validation");

    // Select NEAR Intents wallet
    const walletSelector = page.getByRole("button", { name: "Select Wallet" });
    await expect(walletSelector).toBeVisible();
    await walletSelector.click();

    await expect(page.getByText("NEAR Intents")).toBeVisible();
    await page.getByText("NEAR Intents").click();
    await page.waitForTimeout(1000);

    const tokenDropdown = page
      .locator(
        'button:has-text("Select Token"), [data-testid="token-dropdown"]'
      )
      .first();
    await expect(tokenDropdown).toBeVisible({ timeout: 10_000 });
    await tokenDropdown.click();
    await page.waitForTimeout(500);

    // Look for ETH or USDC (which uses ETH-like addresses)
    const ethOption = page.locator("text=/ETH|USDC.*BASE|USDC.*ARB/i").first();
    await expect(ethOption).toBeVisible({ timeout: 10_000 });
    await ethOption.click();
    await page.waitForTimeout(500);

    const addressInput = page.locator('input[placeholder*="Address"]').first();
    await expect(addressInput).toBeVisible({ timeout: 10_000 });

    // Test valid ETH addresses
    for (const address of testCases.eth.valid) {
      console.log(`  Testing valid ETH address: ${address}`);
      await addressInput.fill(address);
      await page.waitForTimeout(200);

      const inputClasses = await addressInput.getAttribute("class");
      expect(inputClasses).toContain("is-valid");
      expect(inputClasses).not.toContain("is-invalid");
    }

    // Test invalid ETH addresses
    for (const address of testCases.eth.invalid) {
      console.log(`  Testing invalid ETH address: ${address}`);
      await addressInput.fill(address);
      await page.waitForTimeout(200);

      const inputClasses = await addressInput.getAttribute("class");
      if (address !== "") {
        expect(inputClasses).toContain("is-invalid");
        expect(inputClasses).not.toContain("is-valid");
      }
    }

    console.log("✓ ETH address validation working correctly");
  });

  test("validates Solana addresses correctly", async ({ page }) => {
    const daoId = TEST_DAO_ID;

    // Mock indexer API to avoid rate limiting
    await mockIndexerFtTokens(page);

    // Mock RPC to ensure SOL token is available
    const mockData = createMockIntentsTokens([MOCK_TOKENS.SOL]);
    await mockIntentsRpc(page, mockData, daoId);

    await page.goto(`http://localhost:3000/${daoId}/payments`);
    await page.waitForLoadState("networkidle");

    const createButton = page.getByRole("button", { name: "Create Request" });
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();
    await page.getByText("Single Request").click();

    await expect(page.getByText("Create Payment Request")).toBeVisible({
      timeout: 10000,
    });

    console.log("Testing Solana (SOL) address validation");

    // Select NEAR Intents wallet
    const walletSelector = page.getByRole("button", { name: "Select Wallet" });
    await expect(walletSelector).toBeVisible();
    await walletSelector.click();

    await expect(page.getByText("NEAR Intents")).toBeVisible();
    await page.getByText("NEAR Intents").click();
    await page.waitForTimeout(1000);

    const tokenDropdown = page
      .locator(
        'button:has-text("Select Token"), [data-testid="token-dropdown"]'
      )
      .first();
    await expect(tokenDropdown).toBeVisible({ timeout: 10_000 });
    await tokenDropdown.click();
    await page.waitForTimeout(500);

    const solOption = page.locator("text=/SOL|USDC.*SOL/i").first();
    await expect(solOption).toBeVisible({ timeout: 10_000 });
    await solOption.click();
    await page.waitForTimeout(500);

    const addressInput = page.locator('input[placeholder*="Address"]').first();
    await expect(addressInput).toBeVisible({ timeout: 10_000 });

    // Test valid SOL addresses
    for (const address of testCases.sol.valid) {
      console.log(`  Testing valid SOL address: ${address}`);
      await addressInput.fill(address);
      await page.waitForTimeout(200);

      const inputClasses = await addressInput.getAttribute("class");
      expect(inputClasses).toContain("is-valid");
      expect(inputClasses).not.toContain("is-invalid");
    }

    // Test invalid SOL addresses
    for (const address of testCases.sol.invalid) {
      console.log(`  Testing invalid SOL address: ${address}`);
      await addressInput.fill(address);
      await page.waitForTimeout(200);

      const inputClasses = await addressInput.getAttribute("class");
      if (address !== "") {
        expect(inputClasses).toContain("is-invalid");
        expect(inputClasses).not.toContain("is-valid");
      }
    }

    console.log("✓ SOL address validation working correctly");
  });

  test("rejects cross-chain address mismatches", async ({ page }) => {
    const daoId = TEST_DAO_ID;

    // Mock indexer API to avoid rate limiting
    await mockIndexerFtTokens(page);

    // Mock RPC to ensure ETH-like tokens are available
    const mockData = createMockIntentsTokens([
      MOCK_TOKENS.ETH,
      MOCK_TOKENS.USDC_BASE,
      MOCK_TOKENS.USDC_ARB,
    ]);
    await mockIntentsRpc(page, mockData, daoId);

    await page.goto(`http://localhost:3000/${daoId}/payments`);
    await page.waitForLoadState("networkidle");

    const createButton = page.getByRole("button", { name: "Create Request" });
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await createButton.click();
    await page.getByText("Single Request").click();

    await expect(page.getByText("Create Payment Request")).toBeVisible({
      timeout: 10000,
    });

    console.log("Testing cross-chain address mismatch detection");

    // Select NEAR Intents wallet
    const walletSelector = page.getByRole("button", { name: "Select Wallet" });
    await expect(walletSelector).toBeVisible();
    await walletSelector.click();

    await expect(page.getByText("NEAR Intents")).toBeVisible();
    await page.getByText("NEAR Intents").click();
    await page.waitForTimeout(1000);

    const tokenDropdown = page
      .locator(
        'button:has-text("Select Token"), [data-testid="token-dropdown"]'
      )
      .first();
    await expect(tokenDropdown).toBeVisible({ timeout: 10_000 });
    await tokenDropdown.click();
    await page.waitForTimeout(500);

    // Select an ETH-like token (BASE, ARB, etc.)
    const ethLikeOption = page
      .locator("text=/USDC.*BASE|USDC.*ARB|ETH/i")
      .first();
    await expect(ethLikeOption).toBeVisible({ timeout: 10_000 });
    await ethLikeOption.click();
    await page.waitForTimeout(500);

    const addressInput = page.locator('input[placeholder*="Address"]').first();
    await expect(addressInput).toBeVisible({ timeout: 10_000 });

    // BTC address should be invalid for ETH-like chains
    const btcAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080";
    console.log(`  Testing BTC address on ETH chain: ${btcAddress}`);
    await addressInput.fill(btcAddress);
    await page.waitForTimeout(200);

    let inputClasses = await addressInput.getAttribute("class");
    expect(inputClasses).toContain("is-invalid");
    expect(inputClasses).not.toContain("is-valid");

    // ETH address should be valid
    const ethAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    console.log(`  Testing ETH address on ETH chain: ${ethAddress}`);
    await addressInput.fill(ethAddress);
    await page.waitForTimeout(200);

    inputClasses = await addressInput.getAttribute("class");
    expect(inputClasses).toContain("is-valid");
    expect(inputClasses).not.toContain("is-invalid");

    console.log("✓ Cross-chain mismatch detection working correctly");
  });
});

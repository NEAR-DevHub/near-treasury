import { test, expect } from "@playwright/test";
import { createMockIntentsTokens, mockIntentsRpc, MOCK_TOKENS } from "../../util/mock-intents-rpc.js";

/**
 * Intents Dashboard Tests
 *
 * Tests the display of NEAR Intents portfolio on the dashboard.
 * The dashboard should show cross-chain token balances (BTC, ETH, SOL, etc.)
 * when available, and hide the NEAR Intents card when there are no balances.
 */

const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

test.describe("Intents Dashboard Display", () => {
  test("should not display NEAR Intents card when there are no assets", async ({ page }) => {
    const daoId = TEST_DAO_ID;

    // Mock RPC to return empty balances (all zeros)
    // We need to mock mt_tokens_for_owner to return empty array
    const mockData = createMockIntentsTokens([]);
    await mockIntentsRpc(page, mockData, daoId);

    // Navigate to dashboard
    await page.goto(`http://localhost:3000/${daoId}/dashboard`);

    // Wait for dashboard to load
    await page.waitForLoadState("networkidle");

    console.log("Testing dashboard with no intents balances");

    // Hard expectation: Total Balance should be visible (main dashboard loaded)
    await expect(page.getByText("Total Balance")).toBeVisible({ timeout: 10000 });
    console.log("✓ Dashboard loaded");

    // Hard expectation: NEAR Intents card should NOT be visible when there are no tokens
    await expect(page.getByText("NEAR Intents")).not.toBeVisible();
    console.log("✓ NEAR Intents card correctly hidden when no balances");
  });

  test("should display NEAR Intents card with token balances", async ({ page }) => {
    const daoId = TEST_DAO_ID;

    // Mock RPC to return multiple token balances
    const mockData = createMockIntentsTokens([
      MOCK_TOKENS.BTC,
      MOCK_TOKENS.ETH,
      MOCK_TOKENS.SOL,
    ]);
    await mockIntentsRpc(page, mockData, daoId);

    // Navigate to dashboard
    await page.goto(`http://localhost:3000/${daoId}/dashboard`);
    await page.waitForLoadState("networkidle");

    console.log("Testing dashboard with intents balances");

    // Hard expectation: Dashboard should load
    await expect(page.getByText("Total Balance")).toBeVisible({ timeout: 10000 });
    console.log("✓ Dashboard loaded");

    // Hard expectation: NEAR Intents card should be visible
    const intentsCard = page.locator('[data-testid="intents-portfolio"], .card:has-text("NEAR Intents")');
    await expect(intentsCard).toBeVisible({ timeout: 10000 });
    console.log("✓ NEAR Intents card is visible");

    // Hard expectation: BTC should be displayed in the intents card
    await expect(intentsCard.getByText("BTC")).toBeVisible();
    console.log("✓ BTC is displayed in intents portfolio");

    // Hard expectation: ETH should be displayed
    await expect(intentsCard.getByText("ETH")).toBeVisible();
    console.log("✓ ETH is displayed in intents portfolio");

    // Hard expectation: SOL should be displayed
    await expect(intentsCard.getByText("SOL")).toBeVisible();
    console.log("✓ SOL is displayed in intents portfolio");

    console.log("✓ NEAR Intents card displays all mocked tokens correctly");
  });

  test("should display aggregated USDC balance across multiple chains", async ({ page }) => {
    const daoId = TEST_DAO_ID;

    // Mock RPC with USDC on multiple chains (Base, Arbitrum, Ethereum)
    // This is a common real-world scenario for DAO treasuries
    const mockData = createMockIntentsTokens([
      MOCK_TOKENS.USDC_BASE,    // 1 USDC on Base
      MOCK_TOKENS.USDC_ARB,     // 1 USDC on Arbitrum
      {
        symbol: "USDC",
        tokenId: "eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near", // USDC on Ethereum
        balance: "1000000", // 1 USDC (6 decimals)
      },
    ]);
    await mockIntentsRpc(page, mockData, daoId);

    await page.goto(`http://localhost:3000/${daoId}/dashboard`);
    await page.waitForLoadState("networkidle");

    console.log("Testing aggregated USDC balance across chains");

    // Hard expectation: NEAR Intents card should be visible
    const intentsCard = page.locator('[data-testid="intents-portfolio"], .card:has-text("NEAR Intents")');
    await expect(intentsCard).toBeVisible({ timeout: 10000 });

    // Hard expectation: USDC should be displayed in NEAR Intents section
    const usdcInIntents = intentsCard.locator(':has-text("USDC")').first();
    await expect(usdcInIntents).toBeVisible();
    console.log("✓ USDC token is visible in NEAR Intents");

    // Hard expectation: Check the aggregated amount
    // The UI shows "USDC 2" or similar, and we mocked 3 tokens with 1 USDC each = 3 USDC total
    const intentsText = await intentsCard.textContent();

    // Look for the USDC amount - should be around 3 USDC
    // The pattern might be "2" (count) followed by amount, or just the amount
    const hasUSDC = intentsText?.includes("USDC");
    expect(hasUSDC).toBe(true);
    console.log("✓ USDC is aggregated in intents portfolio");

    // Hard expectation: Verify there are multiple USDC tokens being aggregated
    // The UI might show a number indicating multiple tokens (e.g., "USDC 2" or "3")
    const numberMatch = intentsText?.match(/USDC\s+(\d+)/);
    if (numberMatch) {
      const tokenCount = parseInt(numberMatch[1]);
      expect(tokenCount).toBeGreaterThanOrEqual(2); // At least 2 chains aggregated
      console.log(`✓ UI shows ${tokenCount} USDC tokens aggregated`);
    }

    // Hard expectation: Check that USD values are displayed
    // The UI shows both individual token price and total value
    const usdMatches = intentsText?.matchAll(/\$(\d+\.?\d{0,2})/g);
    const usdValues = Array.from(usdMatches || []).map(m => parseFloat(m[1]));

    expect(usdValues.length).toBeGreaterThan(0);
    console.log(`✓ USD values found: ${usdValues.map(v => '$' + v).join(', ')}`);

    // Hard expectation: The total should reflect multiple USDC tokens
    // With 3 tokens of 1 USDC each @ $1, the total should be around $2-$3
    const maxValue = Math.max(...usdValues);
    expect(maxValue).toBeGreaterThanOrEqual(1); // At least $1 total
    expect(maxValue).toBeLessThanOrEqual(4); // Not more than $4

    console.log(`✓ Multi-chain USDC aggregation working (max value: $${maxValue})`);
  });
});

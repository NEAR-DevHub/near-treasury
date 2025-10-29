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

  test.skip("should display aggregated ETH balance across multiple chains", async ({ page }) => {
    // TODO: This test requires UI support for displaying custom token IDs (arb.omft.near, base.omft.near)
    // The UI currently only displays tokens it recognizes from the token registry.
    // Multi-chain aggregation may need additional implementation in the frontend.
    const daoId = TEST_DAO_ID;

    // Mock RPC with ETH on multiple chains (Ethereum, Arbitrum, Base)
    const mockData = createMockIntentsTokens([
      {
        symbol: "ETH",
        tokenId: "eth.omft.near",
        balance: "128226700000000000000", // 128.2267 ETH on Ethereum
      },
      {
        symbol: "ETH",
        tokenId: "arb.omft.near",
        balance: "50000000000000000000", // 50 ETH on Arbitrum
      },
      {
        symbol: "ETH",
        tokenId: "base.omft.near",
        balance: "25000000000000000000", // 25 ETH on Base
      },
    ]);
    await mockIntentsRpc(page, mockData, daoId);

    await page.goto(`http://localhost:3000/${daoId}/dashboard`);
    await page.waitForLoadState("networkidle");

    console.log("Testing aggregated ETH balance across chains");

    // Hard expectation: NEAR Intents card should be visible
    const intentsCard = page.locator('[data-testid="intents-portfolio"], .card:has-text("NEAR Intents")');
    await expect(intentsCard).toBeVisible({ timeout: 10000 });

    // Hard expectation: ETH should be displayed
    await expect(intentsCard.getByText("ETH")).toBeVisible();
    console.log("✓ ETH token is visible");

    // The UI should aggregate: 128.2267 + 50 + 25 = 203.2267 ETH
    const cardText = await intentsCard.textContent();

    // Hard expectation: ETH amount must be present and match the pattern
    const ethAmountMatch = cardText?.match(/~?([\d,]+\.?\d*)\s*ETH/);
    expect(ethAmountMatch).not.toBeNull();
    expect(ethAmountMatch).toBeDefined();

    const displayedAmount = parseFloat(ethAmountMatch[1].replace(/,/g, ""));
    console.log(`✓ ETH amount displayed: ${displayedAmount}`);

    // Hard expectation: Allow some flexibility for rounding/formatting but must be in range
    expect(displayedAmount).toBeGreaterThan(200);
    expect(displayedAmount).toBeLessThan(210);
    console.log("✓ Aggregated ETH balance is correct (~203 ETH)");
  });
});

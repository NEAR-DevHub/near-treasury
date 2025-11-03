import { expect } from "@playwright/test";
import { test } from "@playwright/test";

/**
 * Asset Exchange Proposal Details Page Tests
 *
 * Tests verify that asset exchange proposal details display correctly
 * for NEAR Intents 1Click swaps.
 *
 * Uses real mainnet data from webassemblymusic-treasury.sputnik-dao.near
 * which contains historical proposals that won't change.
 */

const DAO_ID = "webassemblymusic-treasury.sputnik-dao.near";

test.describe("Asset Exchange Proposal Details", () => {
  test("displays NEAR Intents asset exchange proposal #30 with correct values", async ({ page }) => {
    test.setTimeout(60_000);

    // Navigate to the proposal details page for proposal #30
    // This is a 1Click swap: 20 USDC → 0.00017249 BTC
    await page.goto(
      `http://localhost:3000/${DAO_ID}/asset-exchange?tab=history&id=30`,
      { waitUntil: 'networkidle' }
    );

    console.log("Testing asset exchange proposal #30 details");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5_000);

    // Hard expectation: Source Wallet should be visible
    const sourceWalletLabel = page.getByText("Source Wallet", { exact: false });
    await expect(sourceWalletLabel.first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("NEAR Intents")).toBeVisible();
    console.log("✓ Source Wallet (NEAR Intents) is visible");

    // Hard expectation: Send section should display correctly
    await expect(page.getByText("Send", { exact: true })).toBeVisible();
    await expect(page.getByText("20 USDC")).toBeVisible();
    console.log("✓ Send amount (20 USDC) is visible");

    // Hard expectation: Send network should be Ethereum
    await expect(page.getByText("Ethereum").first()).toBeVisible();
    console.log("✓ Send network (Ethereum) is visible");

    // Hard expectation: Receive section should display correctly
    await expect(page.getByText("Receive", { exact: true })).toBeVisible();
    await expect(page.getByText("0.00017249 BTC")).toBeVisible();
    console.log("✓ Receive amount (0.00017249 BTC) is visible");

    // Hard expectation: Receive network should be Bitcoin
    await expect(page.getByText("Bitcoin")).toBeVisible();
    console.log("✓ Receive network (Bitcoin) is visible");

    // Hard expectation: Price Slippage Limit should be displayed
    await expect(page.getByText("Price Slippage Limit")).toBeVisible();
    await expect(page.getByText("0.5%")).toBeVisible();
    console.log("✓ Price Slippage Limit (0.5%) is visible");

    // Hard expectation: Minimum Amount Receive should be displayed
    await expect(page.getByText("Minimum Amount Receive")).toBeVisible();
    await expect(page.getByText("0.00017163 BTC")).toBeVisible();
    console.log("✓ Minimum Amount Receive is visible");

    // Hard expectation: 1Click Quote Deadline should be displayed
    await expect(page.getByText("1Click Quote Deadline")).toBeVisible();
    await expect(page.getByText("Mon, Sep 22, 2025, 08:02 UTC")).toBeVisible();
    console.log("✓ 1Click Quote Deadline is visible");

    // Hard expectation: Estimated Time should be displayed
    await expect(page.getByText("Estimated Time")).toBeVisible();
    await expect(page.getByText("10 minutes")).toBeVisible();
    console.log("✓ Estimated Time is visible");

    // Hard expectation: Deposit Address should be displayed
    await expect(
      page.getByText("Deposit Address", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(
        "77caca4e7a00ef170fe885c3733684fa6166eb46933b7253ef1d4440f07e3994"
      )
    ).toBeVisible();
    console.log("✓ Deposit Address is visible");

    // Hard expectation: Quote Signature should be displayed
    await expect(page.getByText("Quote Signature")).toBeVisible();
    await expect(
      page.getByText(
        "ed25519:2SW5V4MNZ9pj9QPoCafimFysCSDK95DxfJW54rwQFdFAkmYAyfybKXwrxzoFRk4bhQTz6oo8zVeFTL3Yv6wg1zEW"
      )
    ).toBeVisible();
    console.log("✓ Quote Signature is visible");

    // Hard expectation: Proposal metadata should be displayed
    await expect(page.getByText("Created By")).toBeVisible();
    await expect(page.getByText("petersalomonsen.near")).toBeVisible();
    console.log("✓ Created By is visible");

    await expect(page.getByText("Created Date")).toBeVisible();
    await expect(page.getByText("Sun, Sep 21, 2025, 08:04 UTC")).toBeVisible();
    console.log("✓ Created Date is visible");

    await expect(page.getByText("Expires At")).toBeVisible();
    await expect(page.getByText("Sun, Sep 28, 2025, 08:04 UTC")).toBeVisible();
    console.log("✓ Expires At is visible");

    // Hard expectation: Status should be displayed
    await expect(page.getByText("1 Approved")).toBeVisible();
    await expect(page.getByText("Required Votes: 1")).toBeVisible();
    console.log("✓ Status (1 Approved) is visible");

    // Hard expectation: Note about execution deadline should be visible
    await expect(
      page.getByText(
        "**Must be executed before 2025-09-22T08:02:41.846Z** for transferring tokens to 1Click's deposit address for swap execution."
      )
    ).toBeVisible();
    console.log("✓ Execution deadline note is visible");

    console.log("✓ Asset exchange proposal #30 displays all details correctly");
  });
});

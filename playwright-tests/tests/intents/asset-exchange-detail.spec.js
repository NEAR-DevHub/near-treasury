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
    // Note: USD prices will vary based on real-time market data
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
    // Check for amount "20" and symbol "USDC" (they may be in separate elements)
    await expect(page.getByText("20", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("USDC", { exact: false }).first()).toBeVisible();
    console.log("✓ Send amount (20 USDC) is visible");

    // Hard expectation: Send network should be Ethereum
    await expect(page.getByText("Ethereum", { exact: true })).toBeVisible();
    await expect(page.getByText("1 USDC", { exact: false })).toBeVisible();
    console.log("✓ Send network (Ethereum) is visible");

    // Hard expectation: Receive section should display correctly
    await expect(page.getByText("Receive", { exact: true })).toBeVisible();
    // Check for the BTC amount
    await expect(page.getByText("0.00017249", { exact: false })).toBeVisible();
    await expect(page.getByText("BTC", { exact: false }).first()).toBeVisible();
    console.log("✓ Receive amount (0.00017249 BTC) is visible");

    // Hard expectation: Receive network should be Bitcoin
    await expect(page.getByText("Bitcoin", { exact: true })).toBeVisible();
    await expect(page.getByText("1 BTC", { exact: false })).toBeVisible();
    console.log("✓ Receive network (Bitcoin) is visible");

    // Hard expectation: Price Slippage Limit should be displayed
    await expect(page.getByText("Price Slippage Limit")).toBeVisible();
    await expect(page.getByText("0.5%")).toBeVisible();
    console.log("✓ Price Slippage Limit (0.5%) is visible");

    // Hard expectation: Minimum Amount Receive should be displayed
    await expect(page.getByText("Minimum Amount Receive")).toBeVisible();
    // The minimum is calculated as: 0.00017249 * (1 - 0.5/100) = 0.00017162754999999999
    // UI may display with full precision or rounded
    await expect(page.getByText("0.000171627", { exact: false })).toBeVisible();
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
    // The markdown ** is rendered as bold, so just check for the key content
    await expect(
      page.getByText("Must be executed before 2025-09-22T08:02:41.846Z", { exact: false })
    ).toBeVisible();
    console.log("✓ Execution deadline note is visible");

    console.log("✓ Asset exchange proposal #30 displays all details correctly");
  });

  test("displays NEAR Intents asset exchange proposal #43 with correct destination network", async ({ page }) => {
    test.setTimeout(60_000);

    // Navigate to proposal #43: 10 USDC (Near) → 10 USDC (Base)
    // This test verifies the destination network display bug reported in issue #39
    // Expected: Should show "Base" as the receive network
    // Actual bug: Shows "Near" instead
    await page.goto(
      `http://localhost:3000/${DAO_ID}/asset-exchange?tab=history&id=43`,
      { waitUntil: 'networkidle' }
    );

    console.log("Testing asset exchange proposal #43 - destination network display");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5_000);

    // Hard expectation: Source Wallet should be visible
    const sourceWalletLabel = page.getByText("Source Wallet", { exact: false });
    await expect(sourceWalletLabel.first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("NEAR Intents")).toBeVisible();
    console.log("✓ Source Wallet (NEAR Intents) is visible");

    // Hard expectation: Send section should display USDC on Near
    await expect(page.getByText("Send", { exact: true })).toBeVisible();
    await expect(page.getByText("10", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("USDC", { exact: false }).first()).toBeVisible();
    console.log("✓ Send amount (10 USDC) is visible");

    // Hard expectation: Send network should be Near
    // The send token is on Near (source)
    await expect(page.getByText("Near", { exact: false }).first()).toBeVisible();
    console.log("✓ Send network is visible");

    // Hard expectation: Receive section should display USDC
    await expect(page.getByText("Receive", { exact: true })).toBeVisible();
    await expect(page.getByText("9.99998", { exact: false })).toBeVisible();
    console.log("✓ Receive amount (9.99998 USDC) is visible");

    // THIS IS THE BUG: Receive network should be "Base" but currently shows "Near"
    // The proposal description contains: "Destination Network: eth:8453" (Base)
    // But the UI incorrectly displays "Near"

    // First, let's verify the bug exists by checking what's currently displayed
    const receiveNetworkText = await page.locator('text=/Receive/').locator('..').locator('..').textContent();
    console.log("Receive section content:", receiveNetworkText);

    // Check if "Base" is displayed (it should be, but currently isn't due to bug)
    const hasBase = await page.getByText("Base", { exact: true }).isVisible().catch(() => false);

    if (hasBase) {
      console.log("✅ FIXED: Receive network correctly shows 'Base'");
      await expect(page.getByText("Base", { exact: true })).toBeVisible();
    } else {
      console.log("❌ BUG CONFIRMED: Receive network does not show 'Base' (issue #39)");
      console.log("Expected: Base (eth:8453)");
      console.log("This test will fail until the bug is fixed");

      // This assertion will fail, documenting the bug
      await expect(page.getByText("Base", { exact: true })).toBeVisible({
        timeout: 2000
      });
    }

    // Verify the proposal metadata contains the correct destination network
    await expect(page.getByText("Destination Network: eth:8453", { exact: false })).toBeVisible();
    console.log("✓ Proposal description contains correct destination network (eth:8453)");

    console.log("✓ Asset exchange proposal #43 test complete");
  });
});

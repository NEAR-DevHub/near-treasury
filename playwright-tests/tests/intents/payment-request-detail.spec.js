import { test, expect } from "@playwright/test";

/**
 * Payment Request Detail Page Tests
 *
 * These tests verify the payment request detail page displays correctly
 * for various payment types:
 * - Intents payments (cross-chain: ETH, NEAR-to-NEAR)
 * - Regular treasury payments
 * - Failed payments
 *
 * Tests use real mainnet data from webassemblymusic-treasury.sputnik-dao.near
 * which contains historical proposals that won't change.
 */

const DAO_ID = "webassemblymusic-treasury.sputnik-dao.near";

test.describe.configure({ mode: 'serial' });

test.describe("Payment Request Detail Page", () => {
  test("displays Intents payment request for ETH with all details", async ({ page }) => {
    // Navigate to an Intents payment for ETH (cross-chain to Ethereum)
    // Proposal ID 2: 0.005 ETH to 0xa029Ca6D14b97749889702eE16E7d168a1094aFE
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history&id=2`, { waitUntil: 'networkidle' });

    console.log("Testing Intents payment request detail for ETH");

    // Hard expectation: Page should load
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    // Wait for status to be visible (indicates page fully loaded)
    await expect(page.getByText("Payment Request Funded")).toBeVisible({ timeout: 15000 });

    // Hard expectation: Recipient address should be visible
    await expect(page.getByText("0xa029Ca6D14b97749889702eE16E7d168a1094aFE")).toBeVisible({ timeout: 10000 });
    console.log("✓ Recipient address is visible");

    // Hard expectation: Token amount should be displayed in Funding Ask
    await expect(page.getByText("Funding Ask")).toBeVisible();
    await expect(page.getByText("0.005")).toBeVisible();
    console.log("✓ Token amount (0.005) is visible");

    // Hard expectation: Network section should be displayed
    await expect(page.getByText("Network")).toBeVisible({ timeout: 5000 });
    console.log("✓ Network section is visible");

    // Hard expectation: Network name should display as "Ethereum"
    await expect(page.getByText("Ethereum", { exact: false })).toBeVisible({ timeout: 10000 });
    console.log("✓ Network name (Ethereum) is visible");

    // Hard expectation: Estimated Fee should be displayed
    await expect(page.getByText("Estimated Fee").first()).toBeVisible();
    console.log("✓ Estimated Fee is visible");

    // Hard expectation: Transaction Links section should be displayed
    await expect(page.getByText("Transaction Links").first()).toBeVisible({ timeout: 10000 });
    console.log("✓ Transaction Links section is visible");

    // Hard expectation: NEAR transaction link should be visible
    await expect(page.getByText("View execution on nearblocks.io")).toBeVisible({ timeout: 10000 });
    console.log("✓ nearblocks.io link is visible");

    // Hard expectation: Etherscan link should be visible for ETH payments
    await expect(page.getByText("View transfer on etherscan.io")).toBeVisible({ timeout: 10000 });
    console.log("✓ etherscan.io link is visible");

    console.log("✓ Intents payment request for ETH displays all details correctly");
  });

  test("displays Intents payment request for wNEAR (NEAR-to-NEAR)", async ({ page }) => {
    // Navigate to an Intents payment for wNEAR (NEAR-to-NEAR)
    // Proposal ID 4: 0.2 wNEAR to petersalomonsen.near
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history&id=4`, { waitUntil: 'networkidle' });

    console.log("Testing Intents payment request detail for wNEAR");

    // Hard expectation: Page should load and status should be visible
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Payment Request Funded")).toBeVisible({ timeout: 15000 });

    // Hard expectation: Token amount should be displayed in Funding Ask
    await expect(page.getByText("Funding Ask")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("0.2")).toBeVisible();
    console.log("✓ Token amount (0.2) is visible");

    // Hard expectation: Recipient name and address should be visible (use .first() to avoid strict mode)
    await expect(page.getByText("petersalomonsen.near").first()).toBeVisible();
    console.log("✓ Recipient address (petersalomonsen.near) is visible");

    // Hard expectation: Recipient avatar should be visible
    const avatar = page.locator('img[src*="petersalomonsen.near"]');
    await expect(avatar.first()).toBeVisible({ timeout: 5000 });
    console.log("✓ Recipient avatar is visible");

    // Hard expectation: Network section should be displayed for NEAR-to-NEAR payments
    await expect(page.getByText("Network")).toBeVisible({ timeout: 5000 });
    console.log("✓ Network section is visible");

    // Hard expectation: Network name should display (use locator to be more specific)
    const networkLabel = page.locator('label:has-text("Network")');
    const networkValue = networkLabel.locator('..').locator('span.text-capitalize');
    await expect(networkValue).toBeVisible({ timeout: 10000 });
    await expect(networkValue).toContainText("Near");
    console.log("✓ Network name is visible");

    // Hard expectation: Payment Request Funded status should be visible
    await expect(page.getByText("Payment Request Funded")).toBeVisible();
    console.log("✓ Payment Request Funded status is visible");

    // Hard expectation: Transaction Links section should be displayed
    await expect(page.getByText("Transaction Links")).toBeVisible({ timeout: 10000 });
    console.log("✓ Transaction Links section is visible");

    // Hard expectation: NEAR transaction link should be visible
    await expect(page.getByText("View execution on nearblocks.io")).toBeVisible({ timeout: 10000 });
    console.log("✓ nearblocks.io link is visible");

    // For NEAR-to-NEAR, external chain links should not appear
    const externalChainLink = page.getByText(/View.*on (etherscan|polygonscan|bscscan)/i);
    await expect(externalChainLink).not.toBeVisible();
    console.log("✓ No external chain links (as expected for NEAR-to-NEAR)");

    console.log("✓ Intents payment request for wNEAR displays all details correctly");
  });

  test("displays regular (non-intents) payment request", async ({ page }) => {
    // Navigate to a regular treasury payment (non-intents)
    // Proposal ID 8: Regular payment to petersalomonsen.near
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history&id=8`, { waitUntil: 'networkidle' });

    console.log("Testing regular payment request detail");

    // Hard expectation: Page should load and status should be visible
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Payment Request Funded")).toBeVisible({ timeout: 15000 });

    // Hard expectation: Recipient name and address should be visible (use .first() to avoid strict mode)
    await expect(page.getByText("petersalomonsen.near").first()).toBeVisible({ timeout: 10000 });
    console.log("✓ Recipient address is visible");

    // Hard expectation: Recipient avatar should be visible
    const avatar = page.locator('img[src*="petersalomonsen.near"]');
    await expect(avatar.first()).toBeVisible({ timeout: 5000 });
    console.log("✓ Recipient avatar is visible");

    // Hard expectation: Payment Request Funded status should be visible
    await expect(page.getByText("Payment Request Funded")).toBeVisible();
    console.log("✓ Payment Request Funded status is visible");

    // Hard expectation: Transaction Links section should be displayed
    await expect(page.getByText("Transaction Links")).toBeVisible({ timeout: 15000 });
    console.log("✓ Transaction Links section is visible");

    // Hard expectation: NEAR transaction link should be visible
    await expect(page.getByText("View execution on nearblocks.io")).toBeVisible({ timeout: 10000 });
    console.log("✓ nearblocks.io link is visible");

    // For regular payments, external chain links should not appear
    const externalChainLink = page.getByText(/View.*on (etherscan|polygonscan|bscscan)/i);
    await expect(externalChainLink).not.toBeVisible();
    console.log("✓ No external chain links (as expected for regular NEAR payments)");

    console.log("✓ Regular payment request displays all details correctly");
  });

  test("displays failed payment request with transaction links", async ({ page }) => {
    // Navigate to a failed payment request
    // Proposal ID 0: Failed payment
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history&id=0`, { waitUntil: 'networkidle' });

    console.log("Testing failed payment request detail");

    // Hard expectation: Page should load and Payment Request Failed status should be visible
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Payment Request Failed")).toBeVisible({ timeout: 15000 });
    console.log("✓ Payment Request Failed status is visible");

    // Hard expectation: Transaction Links section should be displayed for failed payments
    await expect(page.getByText('Transaction Links', { exact: true })).toBeVisible({ timeout: 10000 });
    console.log("✓ Transaction Links section is visible");

    // Hard expectation: NEAR transaction link should be visible
    await expect(page.getByText("View execution on nearblocks.io")).toBeVisible({ timeout: 10000 });
    console.log("✓ nearblocks.io link is visible");

    console.log("✓ Failed payment request displays transaction links correctly");
  });
});

import { test, expect } from "@playwright/test";

/**
 * Payment Request Detail Page Tests (Regular SputnikDAO Payments)
 *
 * These tests verify the payment request detail page displays correctly
 * for regular SputnikDAO treasury payments (not Intents payments).
 *
 * Tests use real mainnet data from webassemblymusic-treasury.sputnik-dao.near
 * which contains historical proposals that won't change.
 */

const DAO_ID = "webassemblymusic-treasury.sputnik-dao.near";

test.describe("Payment Request Detail Page - Full Page View", () => {
  test("displays regular payment request with all details (full page)", async ({ page }) => {
    // Navigate to a regular treasury payment (non-intents)
    // Proposal ID 8: Regular payment to petersalomonsen.near
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history&id=8`, { waitUntil: 'networkidle' });

    console.log("Testing regular payment request detail - full page view");

    // Hard expectation: Page should load and status should be visible
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Payment Request Approved")).toBeVisible({ timeout: 15000 });

    // Hard expectation: Recipient name and address should be visible
    await expect(page.getByText("petersalomonsen.near").first()).toBeVisible({ timeout: 10000 });
    console.log("✓ Recipient address is visible");

    // Hard expectation: Recipient avatar should be visible
    const avatar = page.locator('img[src*="petersalomonsen.near"]');
    await expect(avatar.first()).toBeVisible({ timeout: 5000 });
    console.log("✓ Recipient avatar is visible");

    // Hard expectation: Payment Request Approved status should be visible
    await expect(page.getByText("Payment Request Approved")).toBeVisible();
    console.log("✓ Payment Request Approved status is visible");

    console.log("✓ Regular payment request displays all details correctly");
  });

  test("displays failed payment request correctly (full page)", async ({ page }) => {
    // Navigate to a failed payment request
    // Proposal ID 0: Failed payment
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history&id=0`, { waitUntil: 'networkidle' });

    console.log("Testing failed payment request detail - full page view");

    // Hard expectation: Payment Request Failed status should be visible
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Payment Request Failed")).toBeVisible({ timeout: 15000 });
    console.log("✓ Payment Request Failed status is visible");

    console.log("✓ Failed payment request displays correctly");
  });

  test("navigates back from full page detail to payments list", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history&id=8`, { waitUntil: 'networkidle' });

    // Wait for page to load
    await expect(page.getByText("Payment Request Approved")).toBeVisible({ timeout: 15000 });

    // Hard expectation: Back button must exist
    const backButton = page.getByRole("button", { name: /back|close/i }).first();
    await expect(backButton).toBeVisible({ timeout: 5000 });
    console.log("✓ Back button is visible");

    // Click back button
    await backButton.click();
    await page.waitForTimeout(1000);

    // Hard expectation: Should navigate back to payments list
    const currentUrl = page.url();
    expect(currentUrl).toContain(`${DAO_ID}/payments`);
    expect(currentUrl).not.toContain("id=8");
    console.log("✓ Back navigation works correctly");
  });
});

test.describe("Payment Request Detail Page - Compact View (Overlay)", () => {
  test("opens compact view when clicking on history proposal row", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history`, { waitUntil: 'networkidle' });

    console.log("Testing compact view for history proposal");

    // Wait for history tab to load
    await expect(page.getByText("History")).toBeVisible({ timeout: 10000 });
    console.log("✓ On History tab");

    // Find a proposal row - look for one with ID 8
    const proposalRow = page.locator('table tbody tr').filter({ hasText: /8|#8/ }).first();

    // If we can't find #8, use first row
    const rowVisible = await proposalRow.isVisible({ timeout: 5000 }).catch(() => false);
    const targetRow = rowVisible ? proposalRow : page.locator('table tbody tr').first();

    await expect(targetRow).toBeVisible({ timeout: 10000 });
    console.log("✓ Found proposal row in history");

    // Click the row
    await targetRow.click();
    await page.waitForTimeout(1000);

    // Hard expectation: Compact view should show proposal ID heading
    const proposalIdHeading = page.getByRole("heading", { name: /#\d+/ });
    await expect(proposalIdHeading).toBeVisible({ timeout: 5000 });
    console.log("✓ Compact detail view opened with proposal ID heading");

    // Verify detail content is visible
    await expect(page.getByText(/Payment Request (Approved|Failed|Rejected)/)).toBeVisible({ timeout: 5000 });
    console.log("✓ Payment status visible in compact view");

    // Hard expectation: Close button (X icon) should exist
    const closeButton = page.locator('.bi-x-lg').first();
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    console.log("✓ Close button (X icon) visible");

    // Click close
    await closeButton.click();
    await page.waitForTimeout(500);

    // Verify we're back to the list view (heading disappears)
    await expect(proposalIdHeading).toBeHidden({ timeout: 5000 });
    console.log("✓ Back to list view after closing compact view");
  });
});

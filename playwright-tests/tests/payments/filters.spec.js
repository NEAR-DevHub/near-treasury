import { test, expect } from "@playwright/test";
import {
  getColumnIndex,
  checkColumnValues,
  openFiltersPanel,
  addFilter,
} from "../../util/filter-utils.js";

/**
 * Payment Requests Filters Tests
 *
 * These tests verify the basic filter functionality for payment requests including:
 * 1. Filter panel opening
 * 2. Available filters per tab (Pending vs History)
 * 3. Adding and using basic filters
 * 4. Removing filters
 * 5. Search functionality
 *
 * Uses real mainnet data from webassemblymusic-treasury.sputnik-dao.near
 */

const DAO_ID = "webassemblymusic-treasury.sputnik-dao.near";

test.describe("Payments Filters", () => {
  test("should open filters panel when filter button is clicked", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history`, { waitUntil: 'networkidle' });

    // Hard expectation: Filter panel must open
    await openFiltersPanel(page);
    console.log("✓ Filter panel opened successfully");
  });

  test("should show correct available filters for Pending Requests tab", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments`, { waitUntil: 'networkidle' });

    // Hard expectation: Should be on Pending Requests tab
    await expect(page.getByText("Pending Requests")).toBeVisible({ timeout: 10000 });

    await openFiltersPanel(page);
    await page.locator("text=Add Filter").click();
    await page.waitForTimeout(500);

    // Hard expectation: Verify only Pending Requests filters are available
    await expect(page.getByRole("button", { name: "Recipient" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Token" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Created by" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approver" })).toBeVisible();
    console.log("✓ Pending Requests tab filters are correct");

    // Hard expectation: History-specific filters must NOT be available
    await expect(page.getByRole("button", { name: "Created Date" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Status" })).not.toBeVisible();
    console.log("✓ History-only filters correctly hidden in Pending tab");
  });

  test("should show correct available filters for History tab", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history`, { waitUntil: 'networkidle' });

    // Hard expectation: Should be on History tab
    await expect(page.getByText("History")).toBeVisible({ timeout: 10000 });

    // Hard expectation: Export button must be visible
    const exportButton = page.getByRole("button", { name: /export.*csv/i });
    await expect(exportButton).toBeVisible({ timeout: 10000 });
    console.log("✓ Export button visible in History tab");

    await openFiltersPanel(page);
    await page.locator("text=Add Filter").click();
    await page.waitForTimeout(500);

    // Hard expectation: Verify all filters are available for History
    await expect(page.getByRole("button", { name: "Created Date" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recipient" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Token" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Created by" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approver" })).toBeVisible();
    console.log("✓ All History tab filters are available");
  });

  test("should add and display Created by filter", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history`, { waitUntil: 'networkidle' });

    await addFilter(page, {
      filterName: "Created by",
      isMultiple: true,
    });

    // Search for and select a creator
    await page.getByRole("textbox", { name: "Search by account address" }).fill("peter");
    await page.waitForTimeout(1000);

    // Hard expectation: Creator search result must appear
    const creatorOption = page.getByText("petersalomonsen.near").first();
    await expect(creatorOption).toBeVisible({ timeout: 5000 });
    await creatorOption.click();
    await page.waitForTimeout(2000);
    console.log("✓ Created by filter applied");

    // Hard expectation: All table rows must show the selected creator
    const creatorColumnIndex = await getColumnIndex(page, "Created by");
    expect(creatorColumnIndex).toBeGreaterThan(-1);
    await checkColumnValues(page, creatorColumnIndex, "petersalomonsen.near", true);
    console.log("✓ All rows show selected creator");
  });

  test("should remove filter when trash icon is clicked", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history`, { waitUntil: 'networkidle' });

    await addFilter(page, {
      filterName: "Recipient",
      isMultiple: true,
    });

    // Hard expectation: Filter button must be visible
    const activeFilter = page.locator(`button:has-text("Recipient")`).first();
    await expect(activeFilter).toBeVisible({ timeout: 5000 });
    console.log("✓ Recipient filter is visible");

    // Click trash icon to remove filter
    const trashIcon = page.locator(".bi.bi-trash").first();
    await expect(trashIcon).toBeVisible({ timeout: 5000 });
    await trashIcon.click();
    await page.waitForTimeout(1000);

    // Hard expectation: Filter must be removed
    await expect(activeFilter).not.toBeVisible();
    console.log("✓ Filter removed successfully");
  });

  test("should search by search input", async ({ page }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/payments?tab=history`, { waitUntil: 'networkidle' });

    // Hard expectation: Search input must be visible
    const searchInput = page.getByPlaceholder("Search");
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Search for a specific proposal ID
    await searchInput.fill("8");
    await page.waitForTimeout(3000);

    // Hard expectation: Should have search results
    const searchRows = page.locator("tbody tr");
    const searchCount = await searchRows.count();
    expect(searchCount).toBeGreaterThan(0);
    console.log(`✓ Search returned ${searchCount} results for ID 8`);

    // Clear search by clearing the input
    await searchInput.clear();
    await page.waitForTimeout(2000);

    // Hard expectation: Should have more results after clearing
    const allRows = page.locator("tbody tr");
    const allCount = await allRows.count();
    expect(allCount).toBeGreaterThan(searchCount);
    console.log(`✓ Cleared search - now showing ${allCount} results`);
  });
});

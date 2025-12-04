import { test, expect } from "@playwright/test";
import {
  getColumnIndex,
  checkColumnValues,
  checkColumnAmounts,
  checkColumnImages,
  checkColumnDateRange,
  openFiltersPanel,
  checkExportUrlWithFilters,
  switchToHistoryTab,
  addFilterAndOpenPopup,
} from "../../util/filter-utils.js";

/**
 * Stake Delegation Filters Tests
 *
 * These tests verify the basic filter functionality for stake delegation requests including:
 * 1. Filter panel opening
 * 2. Available filters per tab (Pending vs History)
 * 3. Adding and using basic filters (Type, Amount, Validator, Created by, Approver, Status)
 * 4. Removing filters
 * 5. Search functionality
 * 6. Export URL generation with filters
 *
 * Uses real mainnet data from testing-astradao.sputnik-dao.near
 */

const DAO_ID = "testing-astradao.sputnik-dao.near";
const TIMEOUT = 3000;

test.describe("Stake Delegation Filters", () => {
  test("should open filters panel when filter button is clicked", async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    // Hard expectation: Filter panel must open
    await openFiltersPanel(page);
    console.log("✓ Filter panel opened successfully");
  });

  test("should show correct available filters for Pending Requests tab", async ({
    page,
  }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/stake-delegation`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Hard expectation: Should be on Pending Requests tab
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });

    await openFiltersPanel(page);
    await page.locator("text=Add Filter").click();
    await page.waitForTimeout(500);

    // Hard expectation: Verify only Pending Requests filters are available
    await expect(page.getByRole("button", { name: "Type" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("button", { name: "Amount" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validator" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Created by" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Approver" })).toBeVisible();
    console.log("✓ Pending Requests tab filters are correct");

    // Hard expectation: History-specific filters must NOT be available
    await expect(
      page.getByRole("button", { name: "Created Date" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Status" })
    ).not.toBeVisible();
    console.log("✓ History-only filters correctly hidden in Pending tab");
  });

  test("should show correct available filters for History tab", async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

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
    await expect(
      page.getByRole("button", { name: "Created Date" })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Type" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Amount" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Validator" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Created by" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Approver" })).toBeVisible();
    console.log("✓ All History tab filters are available");
  });

  test("should add and display Type filter", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    await addFilterAndOpenPopup(page, {
      filterName: "Type",
    });

    // Select "Stake" type
    await page
      .locator(".dropdown-item")
      .getByText("Stake", { exact: true })
      .click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    await expect(
      page.getByRole("button", { name: "Type : Stake " })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Type filter applied: Stake");

    // Hard expectation: All rows must show "Stake" type
    const typeColumnIndex = await getColumnIndex(page, "Type");
    expect(typeColumnIndex).toBeGreaterThan(-1);
    await checkColumnValues(page, typeColumnIndex, "Stake", true);
    console.log("✓ All rows show Stake type");

    // Check export URL contains type filter
    await checkExportUrlWithFilters(
      page,
      {
        stake_type: "stake",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains type filter");

    // Test "is not" functionality
    await page.getByRole("button", { name: "Type : Stake " }).click();
    await page.getByText("is", { exact: true }).click();
    await page.getByText("is not", { exact: true }).click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: No rows should show "Stake" type when excluded
    await checkColumnValues(page, typeColumnIndex, "Stake", false);
    console.log("✓ No rows show Stake type when excluded (is not)");

    // Check export URL contains type_not filter
    await checkExportUrlWithFilters(
      page,
      {
        stake_type_not: "stake",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains type_not filter");
  });

  test("should add and display Amount filter", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(1000);

    await addFilterAndOpenPopup(page, {
      filterName: "Amount",
    });

    // Test "between" range
    await expect(page.getByRole("button", { name: "Between" })).toBeVisible({
      timeout: 5000,
    });
    await page.locator('input[name="amount-min"]').fill("0.01");
    await page.locator('input[name="amount-max"]').fill("10");
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible with range
    await expect(
      page.getByRole("button", { name: /Amount.*0\.01.*10.*NEAR/i })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Amount filter applied: 0.01-10 NEAR");

    // Hard expectation: All amounts must be within range
    const amountColumnIndex = await getColumnIndex(page, "Amount");
    expect(amountColumnIndex).toBeGreaterThan(-1);
    await checkColumnAmounts(page, amountColumnIndex, 0.01, ">=");
    await checkColumnAmounts(page, amountColumnIndex, 10, "<=");
    console.log("✓ All amounts within range");

    // Check export URL contains amount range
    await checkExportUrlWithFilters(
      page,
      {
        amount_min: "0.01",
        amount_max: "10",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains amount range");

    // Test "Is" (equal)
    await page.getByRole("button", { name: "Between" }).click();
    await page.getByText("Is", { exact: true }).click();
    await page.locator('input[name="amount-equal"]').fill("0.01");
    await expect(
      page.getByRole("button", { name: "Amount : 0.01 NEAR" })
    ).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(TIMEOUT);
    console.log("✓ Amount filter applied: = 0.01 NEAR");

    // Hard expectation: All amounts must equal 0.01
    await checkColumnAmounts(page, amountColumnIndex, 0.01, "=");
    console.log("✓ All amounts equal 0.01");

    // Check export URL contains amount equal
    await checkExportUrlWithFilters(
      page,
      {
        amount_equal: "0.01",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains amount_equal filter");

    // Test "Less than"
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Is " }).click();
    await page.getByText("Less than").click();
    await page.locator('input[name="amount-max"]').fill("0.2");
    await expect(
      page.getByRole("button", { name: "Amount : < 0.2 NEAR" })
    ).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(TIMEOUT);
    console.log("✓ Amount filter applied: < 0.2 NEAR");

    // Hard expectation: All amounts must be less than 0.2
    await checkColumnAmounts(page, amountColumnIndex, 0.2, "<");
    console.log("✓ All amounts less than 0.2");

    // Check export URL contains amount max
    await checkExportUrlWithFilters(
      page,
      {
        amount_max: "0.2",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains amount_max filter");

    // Test "More than"
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Less than " }).click();
    await page.getByText("More than").click();
    await page.locator('input[name="amount-min"]').fill("0.1");
    await expect(
      page.getByRole("button", { name: "Amount : > 0.1 NEAR" })
    ).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(TIMEOUT);
    console.log("✓ Amount filter applied: > 0.1 NEAR");

    // Hard expectation: All amounts must be greater than 0.1
    await checkColumnAmounts(page, amountColumnIndex, 0.1, ">");
    console.log("✓ All amounts greater than 0.1");

    // Check export URL contains amount min
    await checkExportUrlWithFilters(
      page,
      {
        amount_min: "0.1",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains amount_min filter");
  });

  test("should add and display Validator filter", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);
    const validatorText = "astro-stakers.poolv1.near";

    await addFilterAndOpenPopup(page, {
      filterName: "Validator",
    });

    // Wait for validator options to load
    await page.waitForTimeout(TIMEOUT);

    await page
      .getByRole("textbox", { name: "Search by name" })
      .pressSequentially("astro");
    // Select first available validator
    const validatorOption = page.getByText(validatorText).first();
    await expect(validatorOption).toBeVisible({ timeout: 5000 });
    await validatorOption.click();
    await page.waitForTimeout(TIMEOUT);
    console.log(`✓ Selected validator: ${validatorText}`);

    // Hard expectation: Filter must be visible
    const activeFilter = page.getByRole("button", {
      name: `Validator : ${validatorText} `,
    });
    await expect(activeFilter).toBeVisible({ timeout: 5000 });
    console.log("✓ Validator filter is active");

    // Hard expectation: No rows should show the excluded validator
    const validatorColumnIndex = await getColumnIndex(page, "Validator");
    expect(validatorColumnIndex).toBeGreaterThan(-1);
    await checkColumnValues(page, validatorColumnIndex, validatorText, true);
    console.log(`✓ All rows show ${validatorText} validator`);

    await checkExportUrlWithFilters(
      page,
      {
        validators: validatorText,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains validators filter");

    // Test "is not all" functionality
    await page.getByText("is any").click();
    await page.getByText("is not all", { exact: true }).click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: No rows should show the excluded validator
    await checkColumnValues(page, validatorColumnIndex, validatorText, false);
    console.log(`✓ No rows show excluded validator (is not all)`);

    // Check export URL contains validators_not filter
    await checkExportUrlWithFilters(
      page,
      {
        validators_not: validatorText,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains validators_not filter");
  });

  test("should add and display Status filter", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    await addFilterAndOpenPopup(page, {
      filterName: "Status",
    });

    // Select "Approved" status
    await page.getByText("Approved", { exact: true }).first().click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    await expect(
      page.getByRole("button", { name: "Status : Approved" })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Status filter applied: Approved");

    // Hard expectation: All rows must show "Approved" status
    const statusColumnIndex = await getColumnIndex(page, "Status");
    expect(statusColumnIndex).toBeGreaterThan(-1);
    await checkColumnValues(page, statusColumnIndex, "Approved", true);
    console.log("✓ All rows show Approved status");

    // Check export URL contains status filter
    await checkExportUrlWithFilters(
      page,
      {
        statuses: "Approved",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains status filter");

    // Test "is not" functionality
    await page.getByRole("button", { name: "Status : Approved" }).click();
    await page.getByText("is", { exact: true }).click();
    await page.getByText("is not", { exact: true }).click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: No rows should show "Approved" status when excluded
    await checkColumnValues(page, statusColumnIndex, "Approved", false);
    console.log("✓ No rows show Approved status when excluded (is not)");

    // Check export URL contains status_not filter
    await checkExportUrlWithFilters(
      page,
      {
        statuses: "Rejected,Failed,Expired",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains status exclusion filter");
  });

  test("should add and display Created by filter", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);
    const creatorAccountAddress = "megha19.near";

    await addFilterAndOpenPopup(page, {
      filterName: "Created by",
    });

    // Wait for creator options to load
    await page.waitForTimeout(TIMEOUT);

    // Select first available creator
    await page
      .getByRole("textbox", { name: "Search by account address" })
      .pressSequentially("megh");
    const creatorOption = page.getByText(creatorAccountAddress).first();
    await expect(creatorOption).toBeVisible({ timeout: 5000 });
    await creatorOption.click();
    await page.waitForTimeout(TIMEOUT);
    console.log(`✓ Selected creator: ${creatorAccountAddress}`);

    const creatorColumnIndex = await getColumnIndex(page, "Created by");
    expect(creatorColumnIndex).toBeGreaterThan(-1);
    await checkColumnValues(
      page,
      creatorColumnIndex,
      creatorAccountAddress,
      true
    );
    console.log(`✓ All rows show ${creatorAccountAddress} creator`);

    await checkExportUrlWithFilters(
      page,
      {
        proposers: creatorAccountAddress,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains proposers filter");

    // Test "is not all" functionality
    await page.getByText("is any").click();
    await page.getByText("is not all", { exact: true }).click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: No rows should show the excluded creator
    await checkColumnValues(
      page,
      creatorColumnIndex,
      creatorAccountAddress,
      false
    );
    console.log(`✓ No rows show excluded creator (is not all)`);

    // Check export URL contains proposers_not filter
    await checkExportUrlWithFilters(
      page,
      {
        proposers_not: creatorAccountAddress,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains proposers_not filter");
  });

  test("should add and display Approver filter", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    await addFilterAndOpenPopup(page, {
      filterName: "Approver",
    });

    const approverAccountAddress = "megha19.near";
    // Wait for approver options to load
    await page.waitForTimeout(TIMEOUT);

    // Select first available approver
    await page
      .getByRole("textbox", { name: "Search by account address" })
      .pressSequentially("megh");
    const approverOption = page.getByText(approverAccountAddress).first();
    await expect(approverOption).toBeVisible({ timeout: 5000 });
    await approverOption.click();
    await page.waitForTimeout(TIMEOUT);
    console.log(`✓ Selected approver: ${approverAccountAddress}`);

    // Hard expectation: Verify all rows show the selected approver
    const approversColumnIndex = await getColumnIndex(page, "Approvers");
    expect(approversColumnIndex).toBeGreaterThan(-1);
    await checkColumnImages(
      page,
      approversColumnIndex,
      approverAccountAddress,
      true
    );
    console.log(`✓ All rows show ${approverAccountAddress} approver`);

    // Check export URL contains approver_not filter
    await checkExportUrlWithFilters(
      page,
      {
        approvers: approverAccountAddress,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains approvers filter");

    // Test "is not all" functionality
    await page.getByText("is any").click();
    await page.getByText("is not all", { exact: true }).click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Verify no rows show the excluded approver
    await checkColumnImages(
      page,
      approversColumnIndex,
      approverAccountAddress,
      false
    );
    console.log(`✓ No rows show excluded approver (is not all)`);

    // Check export URL contains approvers_not filter
    await checkExportUrlWithFilters(
      page,
      {
        approvers_not: approverAccountAddress,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains approvers_not filter");
  });

  test("should remove filter when trash icon is clicked", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    await addFilterAndOpenPopup(page, {
      filterName: "Type",
    });

    // Select "Stake" type
    await page
      .locator(".dropdown-item")
      .getByText("Stake", { exact: true })
      .click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    const activeFilter = page.getByRole("button", { name: "Type : Stake " });
    await expect(activeFilter).toBeVisible({ timeout: 5000 });
    console.log("✓ Type filter is visible");

    // Click trash icon to remove filter
    await activeFilter.click();
    const trashIcon = page.locator(".bi.bi-trash").first();
    await expect(trashIcon).toBeVisible({ timeout: 5000 });
    await trashIcon.click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be removed
    await expect(activeFilter).not.toBeVisible();
    console.log("✓ Filter removed successfully");
  });

  test("should clear all filters when clear button is clicked", async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    // Add Type filter
    await addFilterAndOpenPopup(page, {
      filterName: "Type",
    });
    await page
      .locator(".dropdown-item")
      .getByText("Stake", { exact: true })
      .click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    await expect(
      page.getByRole("button", { name: "Type : Stake " })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Type filter applied");

    // Click clear all button (X button)
    await page.click("button:has(i.bi-x-lg)");
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be cleared
    await expect(
      page.getByRole("button", { name: "Type : Stake " })
    ).not.toBeVisible();
    console.log("✓ All filters cleared successfully");
  });

  test("should add and display Created Date filter with date range", async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    await addFilterAndOpenPopup(page, {
      filterName: "Created Date",
    });

    // Hard expectation: Date inputs must be visible
    await expect(page.getByText("From Date")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("To Date")).toBeVisible({ timeout: 5000 });
    console.log("✓ Date range inputs displayed");

    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-12-31");

    await page
      .getByRole("textbox")
      .nth(1)
      .fill(startDate.toISOString().split("T")[0]);
    await page
      .getByRole("textbox")
      .nth(2)
      .fill(endDate.toISOString().split("T")[0]);
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: All rows must have dates within range
    const createdDateColumnIndex = await getColumnIndex(page, "Created Date");
    expect(createdDateColumnIndex).toBeGreaterThan(-1);
    await checkColumnDateRange(
      page,
      createdDateColumnIndex,
      startDate,
      endDate,
      true
    );
    console.log("✓ All rows have dates within range");

    // Check export URL contains date range
    // Note: toDate is adjusted by +1 day to include the entire end date
    await checkExportUrlWithFilters(
      page,
      {
        created_date_from: "2024-01-01",
        created_date_to: "2025-01-01",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains date range");
  });

  test("should switch between tabs and verify filters are cleared", async ({
    page,
  }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/stake-delegation`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Start on Pending Requests tab
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });

    // Add a filter
    await addFilterAndOpenPopup(page, {
      filterName: "Type",
    });
    await page
      .locator(".dropdown-item")
      .getByText("Stake", { exact: true })
      .click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    await expect(
      page.getByRole("button", { name: "Type : Stake " })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Filter applied on Pending Requests tab");

    // Switch to History tab
    await switchToHistoryTab(page);

    // Hard expectation: Filter should be cleared
    await expect(
      page.getByRole("button", { name: "Type : Stake " })
    ).not.toBeVisible();
    console.log("✓ Filter cleared when switching tabs");

    // Hard expectation: Filters panel should be closed
    await expect(
      page.getByRole("button", { name: "Add Filter" })
    ).not.toBeVisible();
    console.log("✓ Filters panel closed after tab switch");
  });

  test("should search by search input", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    // Hard expectation: Search input must be visible
    const searchInput = page.getByPlaceholder("Search");
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Step 1: Search by title/keyword
    await searchInput.pressSequentially("stake");
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Should have search results
    const searchRows = page.locator("tbody tr");
    const searchCount = await searchRows.count();
    expect(searchCount).toBeGreaterThan(0);
    console.log(`✓ Search by keyword returned ${searchCount} results`);

    // Check export URL contains search parameter
    await checkExportUrlWithFilters(
      page,
      {
        search: "stake",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains search parameter");

    // Step 2: Search by specific proposal ID
    await searchInput.fill("391");
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Should have results for ID 1
    const idSearchRows = page.locator("tbody tr");
    const idSearchCount = await idSearchRows.count();
    expect(idSearchCount).toBe(1);
    console.log(`✓ Search by ID returned ${idSearchCount} results`);

    // Check export URL contains search parameter for ID
    await checkExportUrlWithFilters(
      page,
      {
        search: "391",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains ID search parameter");

    // Step 3: Clear search using clear button
    await page.locator(".bi.bi-x-lg").click();
    await expect(searchInput).toBeEmpty();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Should have more results after clearing
    const allRows = page.locator("tbody tr");
    const allCount = await allRows.count();
    expect(allCount).toBeGreaterThan(0);
    console.log(`✓ Cleared search - now showing ${allCount} results`);
  });

  test("should combine multiple filters", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);

    // Add Type filter
    await addFilterAndOpenPopup(page, {
      filterName: "Type",
    });
    await page
      .locator(".dropdown-item")
      .getByText("Stake", { exact: true })
      .click();
    await page.waitForTimeout(TIMEOUT);

    // Add Status filter
    await page.getByRole("button", { name: " Add Filter" }).click();
    await page.getByRole("button", { name: "Status" }).click();
    await page.getByRole("button", { name: "Status " }).click();
    await page.getByText("Approved", { exact: true }).first().click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Both filters must be visible
    await expect(
      page.getByRole("button", { name: "Type : Stake " })
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: "Status : Approved " })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Multiple filters applied");

    // Hard expectation: All rows must match both filters
    const typeColumnIndex = await getColumnIndex(page, "Type");
    const statusColumnIndex = await getColumnIndex(page, "Status");
    await checkColumnValues(page, typeColumnIndex, "Stake", true);
    await checkColumnValues(page, statusColumnIndex, "Approved", true);
    console.log("✓ All rows match both filters");

    // Check export URL contains both filters
    await checkExportUrlWithFilters(
      page,
      {
        stake_type: "stake",
        statuses: "Approved",
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains both filters");
  });
});

test.describe("Logged in user - Stake Delegation Filters", () => {
  test.use({
    storageState: "playwright-tests/util/megha-logged-in-state.json",
  });

  test("should add and display My Vote Status filter", async ({ page }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/stake-delegation?tab=history`,
      {
        waitUntil: "networkidle",
      }
    );
    await page.waitForTimeout(2000);
    const approverAccountAddress = "megha19.near";

    await addFilterAndOpenPopup(page, {
      filterName: "My Vote Status",
    });

    // Test "Approved" vote status
    await page.getByText("Approved", { exact: true }).first().click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    await expect(
      page.getByRole("button", { name: "My Vote Status : Approved " })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ My Vote Status filter applied: Approved");

    // Hard expectation: All rows must show approved votes for logged in user
    // Get the logged in user's account ID from the storage state
    const approversColumnIndex = await getColumnIndex(page, "Approvers");
    expect(approversColumnIndex).toBeGreaterThan(-1);
    await checkColumnImages(
      page,
      approversColumnIndex,
      approverAccountAddress,
      true
    );
    console.log(`✓ All rows show ${approverAccountAddress} approver`);

    await checkExportUrlWithFilters(
      page,
      {
        voter_votes: `${approverAccountAddress}:approved`,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains voter_votes filter: Approved");

    // Test "Rejected" vote status
    await page
      .getByRole("button", { name: "My Vote Status : Approved" })
      .click();
    await page.getByText("Rejected", { exact: true }).click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    await expect(
      page.getByRole("button", { name: "My Vote Status : Rejected" })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ My Vote Status filter applied: Rejected");

    // Hard expectation: All rows must show rejected votes for logged in user
    await checkColumnImages(
      page,
      approversColumnIndex,
      approverAccountAddress,
      true
    );
    console.log(`✓ All rows show ${approverAccountAddress} approver`);

    await checkExportUrlWithFilters(
      page,
      {
        voter_votes: `${approverAccountAddress}:rejected`,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains voter_votes filter: Rejected");
    // Test "Not Voted" status
    await page
      .getByRole("button", { name: "My Vote Status : Rejected" })
      .click();
    await page.getByText("Not Voted", { exact: true }).click();
    await page.waitForTimeout(TIMEOUT);

    // Hard expectation: Filter must be visible
    await expect(
      page.getByRole("button", { name: "My Vote Status : Not Voted" })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ My Vote Status filter applied: Not Voted");

    // Hard expectation: All rows must show requests where user has not voted
    await checkColumnImages(
      page,
      approversColumnIndex,
      approverAccountAddress,
      false
    );
    console.log(
      `✓ All rows show ${approverAccountAddress} approver (not voted)`
    );

    await checkExportUrlWithFilters(
      page,
      {
        approvers_not: approverAccountAddress,
      },
      "stake-delegation"
    );
    console.log("✓ Export URL contains voter_votes filter: Not Voted");
  });
});

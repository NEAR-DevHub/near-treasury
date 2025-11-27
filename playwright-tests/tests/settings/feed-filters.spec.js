import { test } from "../../util/test.js";
import { expect } from "@playwright/test";
import { openFiltersPanel } from "../../util/filter-utils.js";
import {
  addFilterAndOpenPopup,
  getColumnIndex,
  checkColumnValues,
  checkColumnImages,
  checkColumnDateRange,
  switchToHistoryTab,
  addFilter,
  checkVoteStatusWithImages,
} from "../../util/filter-utils.js";

const DAO_ID = "testing-astradao.sputnik-dao.near";
const BASE_URL = `http://localhost:3000/${DAO_ID}/settings`;

const navigateToTab = async (page, tab) => {
  await page.goto(`${BASE_URL}?tab=${tab}`, {
    waitUntil: "networkidle",
  });
};

const openAddFilterMenu = async (page) => {
  await openFiltersPanel(page);
  await page.locator("text=Add Filter").click();
};

const expectFilterButtonVisible = async (page, filterName) => {
  await expect(
    page.getByRole("button", { name: filterName, exact: true })
  ).toBeVisible();
};

const expectButtonFilterNotVisible = async (page, filterName) => {
  await expect(
    page.getByRole("button", { name: filterName })
  ).not.toBeVisible();
};

const selectFilterDropdownItem = async (page, itemText) => {
  await page.locator(".dropdown-item").getByText(itemText).click();
};

test.describe("Settings Feed Filters", () => {
  test("should open filters panel when filter button is clicked", async ({
    page,
  }) => {
    await navigateToTab(page, "pending-requests");
    await openFiltersPanel(page);
  });

  test("should show correct available filters for Pending Requests tab", async ({
    page,
  }) => {
    await navigateToTab(page, "pending-requests");
    await openAddFilterMenu(page);

    await expectFilterButtonVisible(page, "Created by");
    await expectFilterButtonVisible(page, "Approver");
    await expectFilterButtonVisible(page, "Proposal Type");
    await expectButtonFilterNotVisible(page, "My Vote Status");
    await expectButtonFilterNotVisible(page, "Created Date");
    await expectButtonFilterNotVisible(page, "Status");
  });

  test("should show correct available filters for History tab", async ({
    page,
  }) => {
    await navigateToTab(page, "history");
    await openAddFilterMenu(page);

    await expectFilterButtonVisible(page, "Created Date");
    await expectFilterButtonVisible(page, "Status");
    await expectFilterButtonVisible(page, "Created by");
    await expectFilterButtonVisible(page, "Approver");
    await expectFilterButtonVisible(page, "Proposal Type");
    await expectButtonFilterNotVisible(page, "My Vote Status");
  });

  test("should add and display Created by filter", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Created by" });

    await page
      .getByRole("textbox", { name: "Search by account address" })
      .fill("megha");
    await page.getByText("Megha", { exact: true }).first().click();

    await page.waitForTimeout(3000);

    // Get Created by column index and verify all rows show the selected proposer
    const creatorColumnIndex = await getColumnIndex(page, "Created by");
    await checkColumnValues(page, creatorColumnIndex, "megha19.near", true);

    await page.getByText("is any").click();
    await page.getByText("is not all").click();
    await page.waitForTimeout(1000);

    // Verify no rows show the excluded proposer
    await checkColumnValues(page, creatorColumnIndex, "megha19.near", false);
  });

  test("should add and display Approver filter", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Approver" });

    await page
      .getByRole("textbox", { name: "Search by account address" })
      .fill("fro");
    await page.getByText("frol", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    const approversColumnIndex = await getColumnIndex(page, "Approver");
    await checkColumnImages(page, approversColumnIndex, "frol.near", true);

    await page.getByText("is any").click();
    await page.getByText("is not all").click();
    await page.waitForTimeout(1000);

    // Verify no rows show the excluded approver
    await checkColumnImages(page, approversColumnIndex, "frol.near", false);
  });

  // TODO: to be fixed by Megha, need to update indexer to show correct result
  // test("should filter by Members Permissions proposal type", async ({
  //   page,
  // }) => {
  //   await navigateToTab(page, "history");
  //   await addFilterAndOpenPopup(page, { filterName: "Proposal Type" });

  //   await selectFilterDropdownItem(page, "Members Permissions");
  //   await page.waitForTimeout(2000);

  //   const titleColumnIndex = await getColumnIndex(page, "Title");
  //   await checkColumnValues(page, titleColumnIndex, "Member", true);
  // });

  // test("should filter by Voting Thresholds proposal type", async ({ page }) => {
  //   await navigateToTab(page, "history");
  //   await addFilterAndOpenPopup(page, { filterName: "Proposal Type" });

  //   await selectFilterDropdownItem(page, "Voting Thresholds");
  //   await page.waitForTimeout(2000);

  //   const titleColumnIndex = await getColumnIndex(page, "Title");
  //   await checkColumnValues(page, titleColumnIndex, "Voting Thresholds", true);
  // });

  test("should filter by Voting Duration proposal type", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Proposal Type" });

    await selectFilterDropdownItem(page, "Voting Duration");
    await page.waitForTimeout(2000);

    const titleColumnIndex = await getColumnIndex(page, "Title");
    await checkColumnValues(page, titleColumnIndex, "Voting Duration", true);
  });

  test("should filter by Theme & logo proposal type", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Proposal Type" });

    await selectFilterDropdownItem(page, "Theme & logo");
    await page.waitForTimeout(2000);

    const titleColumnIndex = await getColumnIndex(page, "Title");
    await checkColumnValues(page, titleColumnIndex, "Theme & logo", true);
  });

  test("should filter by multiple proposal types", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Proposal Type" });

    await selectFilterDropdownItem(page, "Members Permissions");
    await selectFilterDropdownItem(page, "Voting Thresholds");
    await page.waitForTimeout(3000);

    const titleColumnIndex = await getColumnIndex(page, "Title");
    await expect(
      page
        .locator("tbody tr", {
          hasText:
            /Members Permissions|Add New Members|Edit Members Permissions|Remove Members/,
        })
        .first()
        .locator("td")
        .nth(titleColumnIndex)
    ).toBeVisible();

    await expect(
      page
        .locator("tbody tr", { hasText: /Voting Thresholds/ })
        .first()
        .locator("td")
        .nth(titleColumnIndex)
    ).toBeVisible();
  });

  test("should add and display status filter", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Status" });

    await page.getByText("Approved", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Get Status column index and verify all rows show the selected status
    const statusColumnIndex = await getColumnIndex(page, "Status");
    await checkColumnValues(page, statusColumnIndex, "Approved", true);

    await page.getByText("Approved", { exact: true }).first().click();
    await page.getByText("is", { exact: true }).first().click();
    await page.getByText("is not", { exact: true }).first().click();
    await page.waitForTimeout(3000);

    // Verify no rows show the excluded status
    await checkColumnValues(page, statusColumnIndex, "Approved", false);
  });

  test("should remove filter when trash icon is clicked", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Created by" });
    await page.locator(".bi.bi-trash").click();
    await expectButtonFilterNotVisible(page, "Created by");
  });

  test("should clear all filters when clear all button is clicked", async ({
    page,
  }) => {
    await navigateToTab(page, "history");

    await openAddFilterMenu(page);
    await page.getByRole("button", { name: "Created by" }).click();

    // Close filters panel
    const filterButton = page.locator("button:has(i.bi-funnel)");
    await filterButton.click();

    await openAddFilterMenu(page);
    await page.getByRole("button", { name: "Approver" }).click();
    await page.click("button:has(i.bi-x-lg)");
    await expectButtonFilterNotVisible(page, "Created by");
    await expectButtonFilterNotVisible(page, "Approver");
  });

  test("should set date range in Created Date filter", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilterAndOpenPopup(page, { filterName: "Created Date" });

    await expect(page.getByText("From Date")).toBeVisible();
    await expect(page.getByText("To Date")).toBeVisible();

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
    await page.waitForTimeout(3000);

    const createdDateColumnIndex = await getColumnIndex(page, "Created Date");
    await checkColumnDateRange(
      page,
      createdDateColumnIndex,
      startDate,
      endDate,
      true
    );
  });

  test("should switch between tabs and verify filters are cleared", async ({
    page,
  }) => {
    await navigateToTab(page, "pending-requests");
    await addFilter(page, { filterName: "Created by" });

    await switchToHistoryTab(page);
    await expectButtonFilterNotVisible(page, "Created by");
    await expect(
      page.getByRole("button", { name: "Add Filter" })
    ).not.toBeVisible();
  });

  test("should search by search input", async ({ page }) => {
    await navigateToTab(page, "history");

    // Get the search input
    const searchInput = page.getByPlaceholder("Search");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("314");
    await page.waitForTimeout(3000);

    // Verify ID search results
    const idSearchRows = page.locator("tbody tr");
    const idSearchCount = await idSearchRows.count();

    // Should have exactly 1 result for specific ID
    expect(idSearchCount).toBe(1);
    expect(page.getByRole("cell", { name: "314" })).toBeVisible();

    // Step 3: Clear search
    await page.locator(".bi.bi-x-lg").click();
    await expect(searchInput).toBeEmpty();
    await page.waitForTimeout(3000);

    // Verify all results are back
    const allRows = page.locator("tbody tr");
    const allRowCount = await allRows.count();
    expect(allRowCount).toBeGreaterThanOrEqual(idSearchCount);
  });
});

test.describe("Logged in user", () => {
  test.use({
    storageState: "playwright-tests/util/logged-in-state.json",
  });

  test("should add and display My Vote Status filter", async ({ page }) => {
    await navigateToTab(page, "history");
    await page.waitForTimeout(5000);
    await addFilterAndOpenPopup(page, { filterName: "My Vote Status" });

    // Approved
    await page
      .locator(".dropdown-item")
      .getByText("Approved", { exact: true })
      .click();
    await page.waitForTimeout(3000);
    await checkVoteStatusWithImages(page, "theori.near", "approved", true);

    // Rejected
    await page
      .getByRole("button", { name: "My Vote Status : Approved" })
      .click();
    await page.getByText("Rejected", { exact: true }).click();
    await page.waitForTimeout(3000);

    await checkVoteStatusWithImages(page, "theori.near", "rejected", true);

    // Not Voted
    await page
      .getByRole("button", { name: "My Vote Status : Rejected" })
      .click();
    await page.getByText("Not Voted", { exact: true }).click();
    await page.waitForTimeout(3000);

    // no approver or reject votes
    await checkVoteStatusWithImages(page, "theori.near", "rejected", false);
    await checkVoteStatusWithImages(page, "theori.near", "approved", false);
  });
});

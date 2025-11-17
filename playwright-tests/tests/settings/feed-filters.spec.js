import { test } from "../../util/test.js";
import { expect } from "@playwright/test";
import { openFiltersPanel } from "../../util/filter-utils.js";
import {
  addFilter,
  getColumnIndex,
  checkColumnValues,
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

const expectFilterVisible = async (page, filterName) => {
  await expect(page.getByRole("button", { name: filterName })).toBeVisible();
};

const expectFilterNotVisible = async (page, filterName) => {
  await expect(
    page.getByRole("button", { name: filterName })
  ).not.toBeVisible();
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

    await expectFilterVisible(page, "Created by");
    await expectFilterVisible(page, "Approver");
    await expectFilterVisible(page, "Proposal Type");
    await expectFilterNotVisible(page, "My Vote Status");
    await expectFilterNotVisible(page, "Created Date");
    await expectFilterNotVisible(page, "Status");
  });

  test("should show correct available filters for History tab", async ({
    page,
  }) => {
    await navigateToTab(page, "history");
    await openAddFilterMenu(page);

    await expectFilterVisible(page, "Created Date");
    await expectFilterVisible(page, "Status");
    await expectFilterVisible(page, "Created by");
    await expectFilterVisible(page, "Approver");
    await expectFilterVisible(page, "Proposal Type");
    await expectFilterNotVisible(page, "My Vote Status");
  });

  test("should add and display Created by filter", async ({ page }) => {
    await navigateToTab(page, "history");
    await addFilter(page, { filterName: "Created by" });

    await page
      .getByRole("textbox", { name: "Search by account address" })
      .fill("megha");
    await page.getByText("Megha", { exact: true }).first().click();

    // Wait for the search results to appear
    await page.waitForTimeout(1000);

    // Get Created by column index and verify all rows show the selected proposer
    const creatorColumnIndex = await getColumnIndex(page, "Created by");
    await checkColumnValues(page, creatorColumnIndex, "megha19.near", true);

    await page.getByText("is any").click();
    await page.getByText("is not all").click();
    await page.waitForTimeout(1000);

    // Verify no rows show the excluded proposer
    await checkColumnValues(page, creatorColumnIndex, "megha19.near", false);
  });
});

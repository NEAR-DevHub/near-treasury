import { test } from "../../util/test.js";
import { expect } from "@playwright/test";
import { openFiltersPanel } from "../../util/filter-utils.js";

const DAO_ID = "testing-astradao.sputnik-dao.near";

test.describe("Settings Feed Filters", () => {
  test("should open filters panel when filter button is clicked", async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/settings?tab=pending-requests`,
      {
        waitUntil: "networkidle",
      }
    );
    await openFiltersPanel(page);
  });

  test("should show correct available filters for Pending Requests tab", async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/${DAO_ID}/settings?tab=pending-requests`,
      {
        waitUntil: "networkidle",
      }
    );

    await openFiltersPanel(page);
    await page.locator("text=Add Filter").click();

    await expect(
      page.getByRole("button", { name: "Created by" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Approver" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Proposal Type" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "My Vote Status" })
    ).not.toBeVisible();

    // Verify History-specific filters are NOT available
    await expect(
      page.getByRole("button", { name: "Created Date" })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Status" })
    ).not.toBeVisible();
  });

  test("should show correct available filters for History tab", async ({
    page,
  }) => {
    await page.goto(`http://localhost:3000/${DAO_ID}/settings?tab=history`, {
      waitUntil: "networkidle",
    });

    await openFiltersPanel(page);
    await page.locator("text=Add Filter").click();

    await expect(
      page.getByRole("button", { name: "Created Date" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Status" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Created by" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Approver" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Proposal Type" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "My Vote Status" })
    ).not.toBeVisible();
  });
});

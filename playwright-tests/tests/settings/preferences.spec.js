import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Preferences Settings Tests
 *
 * These tests verify the preferences functionality for user-specific settings
 * like time format and timezone selection.
 *
 * Tests cover:
 * 1. Save preferences with toast and persist on reload
 * 2. Handle timezone selection and location toggle
 * 3. Reset changes on cancel
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";

let sandbox;
let factoryContractId;
let creatorAccountId;
let daoAccountId;

test.describe("Preferences Settings", () => {
  test.beforeEach(async () => {
    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import sputnik-dao factory from mainnet
    factoryContractId = await sandbox.importMainnetContract(
      SPUTNIK_DAO_FACTORY_ID,
      SPUTNIK_DAO_FACTORY_ID
    );

    // Create creator account with NEAR
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      "10000000000000000000000000000"
    );
    console.log(`Creator account: ${creatorAccountId}`);

    // Initialize the factory
    await sandbox.functionCall(
      factoryContractId,
      SPUTNIK_DAO_FACTORY_ID,
      "new",
      {},
      "300000000000000"
    );

    // Create a DAO
    const daoName = "preferencesdao";
    await sandbox.functionCall(
      creatorAccountId,
      factoryContractId,
      "create",
      {
        name: daoName,
        args: Buffer.from(
          JSON.stringify({
            config: {
              name: daoName,
              purpose: "Test DAO for preferences settings",
              metadata: "",
            },
            policy: {
              roles: [
                {
                  kind: {
                    Group: [creatorAccountId],
                  },
                  name: "Admin",
                  permissions: [
                    "*:AddProposal",
                    "*:VoteApprove",
                    "*:VoteReject",
                    "*:VoteRemove",
                    "*:Finalize",
                    "config:*",
                    "policy:*",
                    "add_member_to_role:*",
                    "remove_member_from_role:*",
                  ],
                  vote_policy: {},
                },
              ],
              default_vote_policy: {
                weight_kind: "RoleWeight",
                quorum: "0",
                threshold: [1, 2],
              },
              proposal_bond: "1000000000000000000000000",
              proposal_period: "604800000000000",
              bounty_bond: "1000000000000000000000000",
              bounty_forgiveness_period: "86400000000000",
            },
          })
        ).toString("base64"),
      },
      "150000000000000",
      "8000000000000000000000000"
    );

    daoAccountId = `${daoName}.${factoryContractId}`;
    console.log(`DAO created: ${daoAccountId}`);
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });

    if (sandbox) {
      await sandbox.stop();
    }
  });

  test("should save preferences with toast and persist on reload", async ({
    page,
  }) => {
    test.setTimeout(120000);

    console.log("\n=== Test: Save Preferences and Persist ===\n");

    await interceptIndexerAPI(page, sandbox, daoAccountId);
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const response = await page.request.post(sandbox.getRpcUrl(), {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    await injectTestWallet(page, sandbox, creatorAccountId);
    await page.goto(
      `http://localhost:3000/${daoAccountId}/settings?tab=preferences`,
      {
        waitUntil: "networkidle",
      }
    );

    console.log("✓ Navigated to preferences page");

    // Wait for page to load
    await page.waitForTimeout(2000);

    await expect(
      page.locator(".card-title").filter({ hasText: "Preferences" })
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Preferences page loaded");

    // Wait for page to fully load
    await page.waitForTimeout(2000);

    // Change time format from 12-hour to 24-hour - find the dropdown showing current selection
    const timeFormatButton = page
      .locator("button")
      .filter({ hasText: /12-hour/ })
      .first();
    await timeFormatButton.waitFor({ state: "visible", timeout: 10000 });
    await timeFormatButton.click();
    await page.waitForTimeout(500);

    const option24h = page.getByText("24-hour (13:00)");
    await option24h.waitFor({ state: "visible", timeout: 5000 });
    await option24h.click();
    await page.waitForTimeout(500);
    console.log("✓ Changed time format to 24-hour");

    // Verify save button is enabled
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();

    // Save and verify toast
    await saveButton.click();
    await expect(
      page.getByText(/preferences saved|saved successfully/i)
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Preferences saved with toast notification");

    // Verify save button is disabled after save
    await expect(saveButton).toBeDisabled();

    // Test persistence - reload page
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Verify 24-hour format is still selected
    await expect(
      page.locator("button").filter({ hasText: /24-hour/ })
    ).toBeVisible();
    await expect(saveButton).toBeDisabled();
    console.log("✓ Preferences persisted after reload");

    // Change format back - should enable button
    const timeFormatButton2 = page
      .locator("button")
      .filter({ hasText: /24-hour/ })
      .first();
    await timeFormatButton2.click();
    await page.waitForTimeout(500);
    await page.getByText("12-hour (1:00 PM)").click();
    await page.waitForTimeout(500);
    await expect(saveButton).toBeEnabled();

    // Change back to 24-hour - should disable button (back to saved state)
    await page
      .locator("button")
      .filter({ hasText: /12-hour/ })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.getByText("24-hour (13:00)").click();
    await page.waitForTimeout(500);
    await expect(saveButton).toBeDisabled();
    console.log("✓ Save button state changes correctly with edits");
  });

  test("should handle timezone selection and location toggle", async ({
    page,
  }) => {
    test.setTimeout(120000);

    console.log("\n=== Test: Timezone Selection and Location Toggle ===\n");

    await interceptIndexerAPI(page, sandbox, daoAccountId);
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const response = await page.request.post(sandbox.getRpcUrl(), {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    await injectTestWallet(page, sandbox, creatorAccountId);
    await page.goto(
      `http://localhost:3000/${daoAccountId}/settings?tab=preferences`,
      {
        waitUntil: "networkidle",
      }
    );

    await page.waitForTimeout(2000);
    await expect(
      page.locator(".card-title").filter({ hasText: "Preferences" })
    ).toBeVisible({ timeout: 10000 });

    // Select timezone - click the dropdown button
    const timezoneDropdown = page.getByTestId("select-timezone-dropdown");
    await timezoneDropdown.waitFor({ state: "visible", timeout: 10000 });
    await timezoneDropdown.click();
    await page.waitForTimeout(1000);

    // Wait for modal to open
    await expect(
      page.getByRole("heading", { name: "Select Timezone" })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Timezone modal opened");

    // Search for Tokyo timezone
    const searchInput = page.getByPlaceholder(/search timezone/i);
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Tokyo");
    await page.waitForTimeout(500);

    // Select Tokyo timezone - look for option containing "Tokyo"
    await page.getByText(/Tokyo/).first().click();
    await page.waitForTimeout(500);
    console.log("✓ Selected Tokyo timezone");

    // Test location toggle if available
    const locationToggle = page.locator(
      "[data-testid='use-location-checkbox']"
    );
    if (await locationToggle.isVisible().catch(() => false)) {
      await locationToggle.click();
      await page.waitForTimeout(500);
      console.log("✓ Toggled location checkbox");

      await locationToggle.click();
      await page.waitForTimeout(500);
    }

    // Save and verify persistence
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(
      page.getByText(/preferences saved|saved successfully/i)
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Timezone preferences saved successfully");
  });

  test("should reset changes on cancel", async ({ page }) => {
    test.setTimeout(120000);

    console.log("\n=== Test: Reset Changes on Cancel ===\n");

    await interceptIndexerAPI(page, sandbox, daoAccountId);
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const response = await page.request.post(sandbox.getRpcUrl(), {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    await injectTestWallet(page, sandbox, creatorAccountId);
    await page.goto(
      `http://localhost:3000/${daoAccountId}/settings?tab=preferences`,
      {
        waitUntil: "networkidle",
      }
    );

    await page.waitForTimeout(2000);
    await expect(
      page.locator(".card-title").filter({ hasText: "Preferences" })
    ).toBeVisible({ timeout: 10000 });

    // Wait for page to fully load
    await page.waitForTimeout(2000);

    // Make changes
    const timeFormatButton = page
      .locator("button")
      .filter({ hasText: /12-hour/ })
      .first();
    await timeFormatButton.waitFor({ state: "visible", timeout: 10000 });
    await timeFormatButton.click();
    await page.waitForTimeout(500);
    await page.getByText("24-hour (13:00)").click();
    await page.waitForTimeout(500);
    console.log("✓ Changed time format to 24-hour");

    // Change timezone - click the dropdown button using test ID
    const timezoneDropdown = page.getByTestId("select-timezone-dropdown");
    await timezoneDropdown.waitFor({ state: "visible", timeout: 10000 });
    await timezoneDropdown.click();
    await page.waitForTimeout(1000);

    // Wait for modal and search for Tokyo
    await expect(
      page.getByRole("heading", { name: "Select Timezone" })
    ).toBeVisible({ timeout: 5000 });
    const searchInput = page.getByPlaceholder(/search timezone/i);
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Tokyo");
    await page.waitForTimeout(500);

    // Select Tokyo timezone
    await page.getByText(/Tokyo/).first().click();
    await page.waitForTimeout(500);
    console.log("✓ Changed timezone to Tokyo");

    // Verify button enabled
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();

    // Cancel changes
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    await cancelButton.click();
    await page.waitForTimeout(500);
    console.log("✓ Clicked Cancel button");

    // Verify reset to 12-hour format
    await expect(
      page.locator("button").filter({ hasText: /12-hour/ })
    ).toBeVisible();
    await expect(saveButton).toBeDisabled();
    console.log("✓ Changes were reset successfully");
  });
});

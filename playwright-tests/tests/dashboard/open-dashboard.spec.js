import { expect } from "@playwright/test";
import { test } from "../../util/test.js";

/**
 * Test: Homepage/Dashboard functionality
 *
 * Verifies that users can:
 * 1. See welcome screen when not logged in
 * 2. Navigate to DAO dashboard when logged in with treasuries
 * 3. See empty state when logged in without treasuries
 */

test.describe("Homepage - Not Logged In", () => {
  test("should show welcome screen when wallet is not connected", async ({
    page,
  }) => {
    await page.goto("/");

    // Check for welcome message
    await expect(
      page.getByRole("heading", { name: "Welcome to NEAR Treasury" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Please sign in with your NEAR wallet to view your treasuries"
      )
    ).toBeVisible();

    // Check for wallet icon
    await expect(page.locator("i.bi-wallet2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("Homepage - Logged In with Treasuries", () => {
  test.use({
    storageState: "playwright-tests/util/logged-in-state.json",
  });

  test("should show My Treasuries and navigate to DAO on click", async ({
    page,
  }) => {
    // Mock the getUserDaos API
    await page.route("**/user-daos?account_id=theori.near", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          "build.sputnik-dao.near",
          "testing-astradao.sputnik-dao.near",
          "devdao.sputnik-dao.near",
          "infinex.sputnik-dao.near",
          "templar.sputnik-dao.near",
        ]),
      });
    });

    await page.goto("/");

    // Wait for treasuries to load
    await page.waitForTimeout(1000);

    // Check for My Treasuries heading
    await expect(
      page.getByRole("heading", { name: "My Treasuries" })
    ).toBeVisible();

    // Check for Create Treasury button
    await expect(
      page.getByRole("button", { name: /Create Treasury/i })
    ).toBeVisible();

    const treasuryCard = page.getByText(
      "Sputnik DAO:testing-astradao.sputnik-dao.near"
    );
    await expect(treasuryCard).toBeVisible();

    // Click on the treasury card to navigate to dashboard
    await treasuryCard.click();

    // Verify navigation to dashboard
    await page.waitForURL("**/testing-astradao.sputnik-dao.near/dashboard", {
      timeout: 10000,
    });
    expect(page.url()).toContain(
      "/testing-astradao.sputnik-dao.near/dashboard"
    );
  });
});

test.describe("Homepage - Invalid DAO ID in URL", () => {
  test("should redirect to homepage and show error toast when invalid DAO ID is accessed", async ({
    page,
  }) => {
    // Try to access an invalid DAO
    await page.goto("/invalid-dao-id.near/dashboard");

    // Should redirect to homepage with error query param
    await page.waitForURL("/?error=invalid-dao", { timeout: 5000 });

    // Check that error toast is visible
    await expect(page.getByText("Invalid Link", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(
        "Invalid link. Please check the URL or address you entered and try again."
      )
    ).toBeVisible();

    // Check for danger icon in toast
    await expect(
      page.locator("i.bi-exclamation-circle-fill.text-danger")
    ).toBeVisible();

    // Verify close button exists
    await expect(page.locator("button.btn-close").first()).toBeVisible();

    // Close the toast
    await page.locator("button.btn-close").first().click();

    // Verify toast is hidden after closing
    await expect(
      page.getByText("Invalid Link", { exact: true })
    ).not.toBeVisible({
      timeout: 2000,
    });
  });
});

test.describe("Homepage - Logged In without Treasuries", () => {
  test.use({
    storageState: "playwright-tests/util/logged-in-state.json",
  });

  test("should show empty state and Create Treasury button navigates correctly", async ({
    page,
    context,
  }) => {
    // Mock the getUserDaos API to return empty array
    await page.route("**/user-daos?account_id=theori.near", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");

    // Wait for API call to complete
    await page.waitForTimeout(1000);

    // Check for My Treasuries heading
    await expect(
      page.getByRole("heading", { name: "My Treasuries" })
    ).toBeVisible();

    // Check for empty state message
    await expect(
      page.getByRole("heading", { name: "No Treasuries Found" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("You are not a member of any DAOs with treasuries yet.")
    ).toBeVisible();
    await expect(
      page.getByText("Create a new treasury to get started.")
    ).toBeVisible();

    // Check for inbox icon
    await expect(page.locator("i.bi-inbox")).toBeVisible();

    // Check that Create Treasury button exists
    const createButton = page.getByRole("button", { name: /Create Treasury/i });
    await expect(createButton).toBeVisible();

    // Verify the button has correct link
    const link = page.locator('a[href*="treasury-factory.near.page"]');
    await expect(link).toBeVisible();
    expect(await link.getAttribute("href")).toContain(
      "treasury-factory.near.page/app?page=create"
    );
    expect(await link.getAttribute("target")).toBe("_blank");
    expect(await link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

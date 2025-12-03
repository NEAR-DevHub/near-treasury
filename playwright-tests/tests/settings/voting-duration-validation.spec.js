import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

/**
 * Test to verify fix for issue #145:
 * [BUG] Near Treasury - Voting Duration: Validation for 0-day duration
 *
 * This test validates that:
 * 1. The UI prevents setting Voting Duration to 0 days with validation
 * 2. The submit button is disabled when duration is 0 or invalid
 * 3. An error message is shown to the user
 *
 * This is a UI validation test - no blockchain interaction needed.
 */

// Use a real mainnet DAO for testing the UI
const TEST_DAO_ID = "webassemblymusic-treasury.sputnik-dao.near";

test.describe("Voting Duration Validation", () => {
  test("should prevent 0-day voting duration with disabled button", async ({
    page,
  }) => {
    // Mock RPC to return DAO policy that gives user permission
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      // Mock get_policy to give user permission to update voting duration
      if (postData?.params?.method_name === "get_policy") {
        const policy = {
          roles: [
            {
              name: "Manage Members",
              kind: { Group: ["theori.near"] },
              permissions: ["policy_update_parameters:*"],
              vote_policy: {},
            },
          ],
          default_vote_policy: {
            weight_kind: "RoleWeight",
            quorum: "0",
            threshold: [1, 2],
          },
          proposal_bond: "100000000000000000000000",
          proposal_period: "604800000000000",
          bounty_bond: "100000000000000000000000",
          bounty_forgiveness_period: "604800000000000",
        };

        const result = Array.from(
          new TextEncoder().encode(JSON.stringify(policy))
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ result: { result } }),
        });
        return;
      }

      // Let other RPC calls pass through
      await route.continue();
    });

    // Navigate to Settings > Voting Duration
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/settings`, {
      waitUntil: "networkidle",
    });

    // Wait for page to load
    await page.waitForSelector('text="Settings"', { timeout: 15000 });

    // Click on Voting Duration
    const votingDurationLink = page.locator('text="Voting Duration"').first();
    await expect(votingDurationLink).toBeVisible({ timeout: 10000 });
    await votingDurationLink.click();
    await page.waitForTimeout(2000);

    // Verify Voting Duration page loaded
    await expect(
      page.locator("text=/Set the number of days a vote is active/i")
    ).toBeVisible({ timeout: 10000 });

    // Get the voting duration input field
    const durationInput = page.locator("input#votingDuration");
    await expect(durationInput).toBeVisible();

    // Check current value
    const currentValue = await durationInput.inputValue();
    console.log("Current voting duration:", currentValue);

    // Clear the input and enter 0
    await durationInput.clear();
    await durationInput.fill("0");
    await page.waitForTimeout(500);

    // Verify the value was set to 0
    const zeroValue = await durationInput.inputValue();
    expect(zeroValue).toBe("0");
    console.log("Set voting duration to:", zeroValue);

    // Check that validation error appears
    const validationError = page.locator(
      "text=/must be greater than 0|cannot be set to 0/i"
    );
    await expect(validationError).toBeVisible({ timeout: 5000 });
    console.log("✓ Validation error message is displayed");

    // Try to find the submit button
    const submitButton = page.locator('button:has-text("Submit Request")');

    // If button exists, it should be disabled
    const submitExists = await submitButton.count();
    if (submitExists > 0) {
      const isEnabled = await submitButton.isEnabled();
      console.log("Submit button enabled for 0-day duration:", isEnabled);

      // Button should be disabled for invalid input
      expect(isEnabled).toBe(false);
      console.log("✓ Submit button is correctly disabled for 0-day duration");
    } else {
      console.log("ℹ Submit button not visible (user may lack permission)");
    }
  });

  test("should show and clear validation error appropriately", async ({
    page,
  }) => {
    // Mock RPC to return DAO policy that gives user permission
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();

      if (postData?.params?.method_name === "get_policy") {
        const policy = {
          roles: [
            {
              name: "Manage Members",
              kind: { Group: ["theori.near"] },
              permissions: ["policy_update_parameters:*"],
              vote_policy: {},
            },
          ],
          default_vote_policy: {
            weight_kind: "RoleWeight",
            quorum: "0",
            threshold: [1, 2],
          },
          proposal_bond: "100000000000000000000000",
          proposal_period: "604800000000000",
          bounty_bond: "100000000000000000000000",
          bounty_forgiveness_period: "604800000000000",
        };

        const result = Array.from(
          new TextEncoder().encode(JSON.stringify(policy))
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ result: { result } }),
        });
        return;
      }

      await route.continue();
    });

    // Navigate to Settings > Voting Duration
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/settings`, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector('text="Settings"', { timeout: 15000 });

    const votingDurationLink = page.locator('text="Voting Duration"').first();
    await expect(votingDurationLink).toBeVisible({ timeout: 10000 });
    await votingDurationLink.click();
    await page.waitForTimeout(2000);

    // Get the voting duration input field
    const durationInput = page.locator("input#votingDuration");
    await expect(durationInput).toBeVisible();

    // Test with 0 days
    await durationInput.clear();
    await durationInput.fill("0");
    await page.waitForTimeout(500);

    // Validation error should appear
    const validationError = page
      .locator('.invalid-feedback, .text-danger, [class*="error"]')
      .filter({ hasText: /must be greater than 0|cannot be set to 0/i });

    await expect(validationError).toBeVisible({ timeout: 5000 });
    console.log("✓ Validation error displayed for 0-day duration");

    // Test with negative value
    await durationInput.clear();
    await durationInput.fill("-1");
    await page.waitForTimeout(500);

    await expect(validationError).toBeVisible({ timeout: 5000 });
    console.log("✓ Validation error displayed for negative duration");

    // Test that valid value removes error
    await durationInput.clear();
    await durationInput.fill("7");
    await page.waitForTimeout(500);

    // Error should disappear
    await expect(validationError).not.toBeVisible();
    console.log("✓ Validation error clears for valid duration");
  });
});

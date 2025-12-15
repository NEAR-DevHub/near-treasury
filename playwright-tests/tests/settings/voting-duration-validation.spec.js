import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

/**
 * Test to verify Voting Duration validation:
 *
 * This test validates that:
 * 1. The UI prevents setting Voting Duration to 0 or negative days
 * 2. The UI only accepts whole numbers (no decimals)
 * 3. The UI enforces minimum (1 day) and maximum (1000 days) limits
 * 4. The submit button is disabled when duration is invalid
 * 5. Error messages are shown for invalid inputs
 *
 * This is a UI validation test - no blockchain interaction needed.
 */

// Use a real mainnet DAO for testing the UI
const TEST_DAO_ID = "webassemblymusic-treasury.sputnik-dao.near";

test.describe("Voting Duration Validation", () => {
  test("should validate all voting duration constraints", async ({ page }) => {
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

    // Verify Voting Duration page loaded
    await expect(
      page.locator("text=/Set the number of days a vote is active/i")
    ).toBeVisible({ timeout: 10000 });

    // Get the voting duration input field
    const durationInput = page.locator("input#votingDuration");
    await expect(durationInput).toBeVisible();

    const submitButton = page.locator('button:has-text("Submit Request")');
    const minError = page
      .locator(".invalid-feedback")
      .filter({ hasText: /must be at least 1 day/i });
    const decimalError = page
      .locator(".invalid-feedback")
      .filter({ hasText: /whole number/i });
    const maxError = page
      .locator(".invalid-feedback")
      .filter({ hasText: /cannot exceed 1000/i });

    console.log("\n=== Testing Zero Value ===");
    await durationInput.clear();
    await durationInput.fill("0");
    await page.waitForTimeout(500);
    await expect(minError).toBeVisible({ timeout: 3000 });
    if ((await submitButton.count()) > 0) {
      expect(await submitButton.isEnabled()).toBe(false);
    }
    console.log("✓ Zero value rejected with error");

    console.log("\n=== Testing Negative Value ===");
    await durationInput.clear();
    await durationInput.fill("-1");
    await page.waitForTimeout(500);
    await expect(minError).toBeVisible({ timeout: 3000 });
    console.log("✓ Negative value rejected with error");

    console.log("\n=== Testing Minimum Valid (1 day) ===");
    await durationInput.clear();
    await durationInput.fill("1");
    await page.waitForTimeout(500);
    await expect(minError).not.toBeVisible();
    await expect(decimalError).not.toBeVisible();
    console.log("✓ Minimum value 1 day accepted");

    console.log("\n=== Testing Decimal Values ===");
    await durationInput.clear();
    await durationInput.fill("7.5");
    await page.waitForTimeout(500);
    await expect(decimalError).toBeVisible({ timeout: 3000 });
    if ((await submitButton.count()) > 0) {
      expect(await submitButton.isEnabled()).toBe(false);
    }
    console.log("✓ Decimal value 7.5 rejected with whole number error");

    await durationInput.clear();
    await durationInput.fill("0.5");
    await page.waitForTimeout(500);
    // 0.5 fails min validation first (< 1), shows minError not decimalError
    await expect(minError).toBeVisible({ timeout: 3000 });
    console.log("✓ Decimal value 0.5 rejected with minimum error");

    console.log("\n=== Testing Valid Whole Numbers ===");
    await durationInput.clear();
    await durationInput.fill("7");
    await page.waitForTimeout(500);
    await expect(minError).not.toBeVisible();
    await expect(decimalError).not.toBeVisible();
    await expect(maxError).not.toBeVisible();
    console.log("✓ Whole number 7 accepted");

    await durationInput.clear();
    await durationInput.fill("365");
    await page.waitForTimeout(500);
    await expect(minError).not.toBeVisible();
    await expect(decimalError).not.toBeVisible();
    await expect(maxError).not.toBeVisible();
    console.log("✓ Large valid value 365 accepted");

    console.log("\n=== Testing Maximum Boundary ===");
    await durationInput.clear();
    await durationInput.fill("1000");
    await page.waitForTimeout(500);
    await expect(minError).not.toBeVisible();
    await expect(decimalError).not.toBeVisible();
    await expect(maxError).not.toBeVisible();
    console.log("✓ Maximum value 1000 accepted");

    await durationInput.clear();
    await durationInput.fill("1001");
    await page.waitForTimeout(500);
    await expect(maxError).toBeVisible({ timeout: 3000 });
    if ((await submitButton.count()) > 0) {
      expect(await submitButton.isEnabled()).toBe(false);
    }
    console.log("✓ Value 1001 rejected (exceeds maximum)");

    await durationInput.clear();
    await durationInput.fill("5000");
    await page.waitForTimeout(500);
    await expect(maxError).toBeVisible({ timeout: 3000 });
    console.log("✓ Value 5000 rejected (exceeds maximum)");

    console.log("\n=== Testing Error Clearing ===");
    await durationInput.clear();
    await durationInput.fill("10");
    await page.waitForTimeout(500);
    await expect(minError).not.toBeVisible();
    await expect(decimalError).not.toBeVisible();
    await expect(maxError).not.toBeVisible();
    console.log("✓ All errors cleared for valid input");

    console.log("\n✅ All validation tests passed");
  });
});

import { test, expect } from "@playwright/test";
import { mockRpcMethods, mockStorageCredits } from "../../util/mock-rpc.js";

/**
 * Bulk Import Form Tests
 *
 * Tests the complete bulk import form flow including:
 * 1. Form inputs and validation through paste
 * 2. Upload with FT token and storage registration
 * 3. Credit quota validation
 * 4. Error handling and recovery
 */

const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

test.describe("Bulk Import Form Tests", () => {
  test.use({
    storageState: "playwright-tests/util/logged-in-state.json",
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/payments`);
    await page.waitForLoadState("networkidle");
  });

  // ============== TEST 1: Full Flow with NEAR Token ==============

  test("should validate complete flow with 50 recipients - paste, errors, edit, delete", async ({
    page,
  }) => {
    console.log("\n=== Test 1: Complete Flow with NEAR Token ===\n");

    // Mock user with 100 credits
    await mockStorageCredits(page, 100);

    // Step 1: Open bulk import form and get offcanvas
    console.log("Step 1: Opening bulk import form");
    await page.getByRole("button", { name: /Create Request/i }).click();
    await page.getByText("Bulk Payment").click();
    await page.waitForTimeout(1000);

    // Get the offcanvas element
    const offcanvas = page.locator(".offcanvas.show");
    await expect(offcanvas).toBeVisible();

    // Check form has all inputs - scoped to offcanvas
    await expect(
      offcanvas.getByText("Create Bulk Payment Request")
    ).toBeVisible();
    console.log("✓ Form title visible");

    await expect(
      offcanvas.getByPlaceholder(
        "Short descriptive title (e.g., Team Payout, Marketing Budget)"
      )
    ).toBeVisible();
    console.log("✓ Title input visible");

    await expect(offcanvas.getByText(/Select source wallet/i)).toBeVisible();
    console.log("✓ Wallet selector visible");

    await expect(offcanvas.getByText("Select token")).toBeVisible();
    console.log("✓ Token selector visible");

    await expect(
      offcanvas.getByPlaceholder("Copy all the filled data")
    ).toBeVisible();
    console.log("✓ CSV textarea visible");

    await expect(
      offcanvas.getByRole("button", { name: "Continue" })
    ).toBeVisible();
    console.log("✓ Continue button visible");

    // Check credits display
    await expect(
      offcanvas.getByText(/100 recipient credit.*available/i)
    ).toBeVisible();
    console.log("✓ Credits info shows 100 credits available");

    // Step 2: Select wallet and token (within offcanvas)
    console.log("\nStep 2: Selecting wallet and token");

    // Verify "Select Wallet" label exists initially
    await expect(offcanvas.getByText("Select Wallet")).toBeVisible();

    // Click wallet dropdown to open it
    await offcanvas.getByText("Select Wallet").click();
    await page.waitForTimeout(500);

    // Select "SputnikDAO" wallet
    await offcanvas.getByText("SputnikDAO", { exact: true }).click();
    await page.waitForTimeout(500);

    // Verify wallet was selected - "Select Wallet" should be replaced with "SputnikDAO"
    await expect(offcanvas.getByText("Select Wallet")).not.toBeVisible();
    await expect(
      offcanvas.getByTestId("wallet-dropdown-btn").getByText("SputnikDAO")
    ).toBeVisible();
    console.log("✓ Wallet selected: SputnikDAO (verified dropdown changed)");

    // Verify "Select token" label exists initially
    await expect(offcanvas.getByText("Select token")).toBeVisible();

    // Click token dropdown to open it
    await offcanvas.getByText("Select token").click();
    await page.waitForTimeout(500);

    // Select "NEAR" token (exact match to avoid "wNEAR" or other tokens)
    await offcanvas
      .getByText("NEAR")
      .filter({ hasText: /^NEAR$/ })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Verify token was selected - "Select token" should be replaced with "NEAR"
    await expect(offcanvas.getByText("Select token")).not.toBeVisible();
    await expect(offcanvas.getByText("NEAR")).toBeVisible();
    console.log("✓ Token selected: NEAR (verified dropdown changed)");

    // Step 3: Fill in 50 recipients with some errors
    console.log("\nStep 3: Pasting 50 recipients (with some errors)");

    let csvData = "Recipient\tAmount\n";
    // 5 invalid format
    for (let i = 1; i <= 5; i++) {
      csvData += `invalid@user${i}\t100\n`;
    }
    // 5 missing amounts
    for (let i = 6; i <= 10; i++) {
      csvData += `user${i}.near\t\n`;
    }
    // 5 zero/negative amounts
    for (let i = 11; i <= 15; i++) {
      csvData += `user${i}.near\t${i % 2 === 0 ? "0" : "-50"}\n`;
    }
    // 35 valid (amounts 1-5 NEAR)
    for (let i = 16; i <= 50; i++) {
      csvData += `user${i}.near\t${(i % 5) + 1}\n`;
    }

    await offcanvas.getByPlaceholder("Copy all the filled data").fill(csvData);
    await offcanvas.getByRole("button", { name: "Continue" }).click();

    // Step 4: Check preview table shows
    console.log("\nStep 4: Checking preview table");
    await expect(page.getByText("Review Your Payment Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Preview table loaded");

    await expect(page.getByText(/50 Recipient/i)).toBeVisible();
    console.log("✓ Shows 50 recipients");

    // Wait for validation
    await page.waitForTimeout(5000);

    // Step 5: Check errors are visible in table
    console.log("\nStep 5: Checking errors visible in table");

    // Find rows with error messages (text-danger class indicates error)
    const errorRows = page.locator("tbody tr:has(.text-danger)");
    await expect(errorRows.first()).toBeVisible({ timeout: 5000 });
    const errorCount = await errorRows.count();
    console.log(`✓ Found ${errorCount} error rows`);

    await expect(
      page.getByRole("button", { name: /Submit Request/i })
    ).toBeDisabled();
    console.log("✓ Submit button disabled");

    // Step 6: Edit errors to fix them
    console.log("\nStep 6: Editing rows to fix errors");

    // Find first error row and click edit
    const firstErrorRow = errorRows.first();
    const editButton = firstErrorRow.locator('button[title="Edit"]');

    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    console.log("✓ Clicked edit button");

    // Wait for edit modal to open
    await expect(page.getByText("Edit Payment Request")).toBeVisible();
    console.log("✓ Edit modal opened");

    // Fix the recipient - find the recipient input in the OffCanvas
    const recipientInput = page
      .locator('.offcanvas.show input[type="text"]')
      .first();
    await recipientInput.clear();
    await recipientInput.pressSequentially("megha19.near");
    await page.waitForTimeout(1000);
    console.log("✓ Updated recipient to megha19.near");

    // Click Save button
    const saveButton = page
      .locator('.offcanvas.show button:has-text("Save")')
      .first();
    await saveButton.click();
    await page.waitForTimeout(5000);
    console.log("✓ Saved changes");

    // Step 7: Delete some rows
    console.log("\nStep 7: Deleting rows");

    const initialRowCount = await page.locator("tbody tr").count();
    console.log(`  Initial row count: ${initialRowCount}`);

    // Find and click delete button (trash icon button)
    const deleteButton = page
      .locator('tbody tr button[title="Delete"]')
      .first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();
    console.log("✓ Clicked delete button");

    // Wait for confirmation modal
    await expect(page.getByText("Remove Recipient")).toBeVisible();
    console.log("✓ Delete confirmation modal appeared");

    // Click confirm button in modal
    const confirmButton = page.locator(".modal button.theme-btn");
    await confirmButton.click();
    await page.waitForTimeout(5000);
    console.log("✓ Confirmed deletion");

    // Verify row was deleted
    const newRowCount = await page.locator("tbody tr").count();
    console.log(
      `✓ Row deleted, new count: ${newRowCount} (was ${initialRowCount})`
    );
    expect(newRowCount).toBe(initialRowCount - 1);

    console.log("\n✅ Test 1 completed\n");
  });

  // ============== TEST 2: Upload with FT Token and Storage Registration ==============

  test("should handle 15 recipients with USDT - unregistered accounts and gas payment", async ({
    page,
  }) => {
    console.log("\n=== Test 2: Upload with FT Token ===\n");

    // Mock RPC calls for credits and storage_balance_of
    await mockRpcMethods(page, {
      view_storage_credits: () => 100,
      storage_balance_of: (args) => {
        const accountId = args?.account_id;
        // First 10 accounts are unregistered (return null)
        if (accountId && accountId.match(/user([1-9]|10)\.near/)) {
          return null;
        }
        // Others are registered
        return { total: "1250000000000000000000", available: "0" };
      },
    });

    console.log("Step 1: Opening bulk import form");
    await page.getByRole("button", { name: /Create Request/i }).click();
    await page.getByText("Bulk Payment").click();
    await page.waitForTimeout(1000);

    // Get the offcanvas element
    const offcanvas = page.locator(".offcanvas.show");
    await expect(offcanvas).toBeVisible();

    console.log("\nStep 2: Selecting wallet and USDT token");

    // Verify "Select Wallet" label exists initially
    await expect(offcanvas.getByText("Select Wallet")).toBeVisible();

    // Click wallet dropdown to open it
    await offcanvas.getByText("Select Wallet").click();
    await page.waitForTimeout(500);

    // Select "SputnikDAO" wallet
    await offcanvas.getByText("SputnikDAO", { exact: true }).click();
    await page.waitForTimeout(500);

    // Verify wallet was selected - "Select Wallet" should be replaced with "SputnikDAO"
    await expect(offcanvas.getByText("Select Wallet")).not.toBeVisible();
    await expect(
      offcanvas.getByTestId("wallet-dropdown-btn").getByText("SputnikDAO")
    ).toBeVisible();
    console.log("✓ Wallet selected: SputnikDAO (verified dropdown changed)");

    // Verify "Select token" label exists initially
    await expect(offcanvas.getByText("Select token")).toBeVisible();

    // Click token dropdown to open it
    await offcanvas.getByText("Select token").click();
    await page.waitForTimeout(500);

    // Select "USDT" token - look for exact USDT or usdt.tether-token.near
    const usdtOption = offcanvas
      .getByText("USDT")
      .or(offcanvas.getByText("usdt.tether-token.near"))
      .first();
    await expect(usdtOption).toBeVisible({ timeout: 5000 });
    await usdtOption.click();
    await page.waitForTimeout(500);

    // Verify token was selected - "Select token" should be replaced with token name
    await expect(offcanvas.getByText("Select token")).not.toBeVisible();
    const selectedToken = offcanvas
      .getByText("USDT")
      .or(offcanvas.getByText("usdt.tether-token.near"))
      .first();
    await expect(selectedToken).toBeVisible();
    console.log("✓ Token selected: USDT (verified dropdown changed)");

    console.log("\nStep 3: Filling 25 recipients");
    let csvData = "Recipient\tAmount\n";
    for (let i = 1; i < 15; i++) {
      csvData += `user${i}.near\t${(i % 5) + 1}\n`;
    }

    await offcanvas.getByPlaceholder("Copy all the filled data").fill(csvData);
    await offcanvas.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Review Your Payment Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Preview table loaded");

    // Wait for storage balance checks
    console.log("\nStep 4: Waiting for storage registration checks");
    await page.waitForTimeout(5000);

    // Should show unregistered accounts warning
    await expect(
      page.getByText(
        /The payment will fail for these recipients if you don't pay the storage deposit/i
      )
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Unregistered accounts warning displayed");

    // Should show Pay button
    const payButton = page.getByRole("button", { name: /Pay.*NEAR/i });
    await expect(payButton).toBeVisible();
    console.log("✓ Pay NEAR button visible");

    // Step 5: Try to submit without paying gas
    console.log("\nStep 5: Attempting to submit without paying gas");
    const submitButton = page.getByRole("button", { name: /Submit Request/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    // Should show warning modal
    await expect(page.getByText(/Confirm Request Creation/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(/For the following recipients, the payment will fail/i)
    ).toBeVisible();
    console.log("✓ Warning modal displayed");

    // Cancel the modal
    const cancelButton = page.getByRole("button", { name: /Cancel/i }).first();
    await cancelButton.click();
    await page.waitForTimeout(500);
    console.log("✓ Modal cancelled");

    // Step 5: Pay for all unregistered accounts
    console.log("\nStep 5: Paying for unregistered accounts");

    // Select all checkbox
    const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
    await selectAllCheckbox.click();
    console.log("✓ Selected all unregistered accounts");

    // Click Pay button
    await payButton.click();
    await page.waitForTimeout(500);

    // Should show gas fee payment modal
    await expect(
      page.getByText(/Confirm Storage Deposit Payment/i)
    ).toBeVisible({
      timeout: 5000,
    });
    console.log("✓ Storage deposit payment modal displayed");
    // Verify payment details in modal
    await expect(
      page.getByText(/You selected to pay the storage deposit/i)
    ).toBeVisible();
    console.log("✓ Payment details visible");

    await expect(page.getByText("0.1250 NEAR", { exact: true })).toBeVisible(); // 10 * 0.0125
    console.log("✓ Total cost displayed correctly");

    console.log("\n✅ Test 2 completed\n");
  });

  // ============== TEST 3: User Has 5 Credits, Tries to Upload 10 ==============

  test("should show quota error when user tries to upload more than credits", async ({
    page,
  }) => {
    console.log("\n=== Test 3: Quota Exceeded ===\n");

    // Mock user with only 5 credits
    await mockStorageCredits(page, 5);

    console.log("Step 1: Opening bulk import form");
    await page.getByRole("button", { name: /Create Request/i }).click();
    await page.getByText("Bulk Payment").click();
    await page.waitForTimeout(1000);

    // Get the offcanvas element
    const offcanvas = page.locator(".offcanvas.show");
    await expect(offcanvas).toBeVisible();

    // Should show 5 credits available
    await expect(
      offcanvas.getByText(/5 recipient credit.*available/i)
    ).toBeVisible();
    console.log("✓ Shows 5 credits available");

    console.log("\nStep 2: Selecting wallet and token");

    // Select wallet
    await expect(offcanvas.getByText("Select Wallet")).toBeVisible();
    await offcanvas.getByTestId("wallet-dropdown-btn").click();
    await page.waitForTimeout(300);
    await offcanvas
      .locator(".dropdown-menu.show")
      .getByText("SputnikDAO", { exact: true })
      .click();
    await page.waitForTimeout(500);
    await expect(
      offcanvas.getByTestId("wallet-dropdown-btn").getByText("SputnikDAO")
    ).toBeVisible();
    await expect(offcanvas.getByText("Select Wallet")).not.toBeVisible();
    console.log("✓ Wallet selected: SputnikDAO");

    // Select token
    await expect(offcanvas.getByText("Select token")).toBeVisible();

    // Click token dropdown to open it
    await offcanvas.getByText("Select token").click();
    await page.waitForTimeout(500);

    // Select "NEAR" token (exact match to avoid "wNEAR" or other tokens)
    await offcanvas
      .getByText("NEAR")
      .filter({ hasText: /^NEAR$/ })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Verify token was selected - "Select token" should be replaced with "NEAR"
    await expect(offcanvas.getByText("Select token")).not.toBeVisible();
    await expect(offcanvas.getByText("NEAR")).toBeVisible();
    console.log("✓ Token selected: NEAR");

    console.log("\nStep 3: Attempting to upload 10 recipients");
    let csvData = "Recipient\tAmount\n";
    for (let i = 1; i <= 10; i++) {
      csvData += `user${i}.near\t${i}\n`;
    }

    await offcanvas.getByPlaceholder("Copy all the filled data").fill(csvData);
    await offcanvas.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Review Your Payment Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Preview table loaded");

    // Wait for validation
    await page.waitForTimeout(5000);

    // Should show quota exceeded warning
    await expect(page.getByText(/Recipient limit reached/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(/You can add up to 5 recipients/i)
    ).toBeVisible();
    console.log("✓ Quota exceeded warning displayed");

    // Submit button should be disabled
    await expect(
      page.getByRole("button", { name: /Submit Request/i })
    ).toBeDisabled();
    console.log("✓ Submit button disabled");

    console.log("\n✅ Test 3 completed\n");
  });

  // ============== TEST 4: User Has Used All Credits ==============

  test("should show error in create form when user has no credits", async ({
    page,
  }) => {
    console.log("\n=== Test 4: No Credits Available ===\n");

    // Mock user with 0 credits
    await mockStorageCredits(page, 0);

    console.log("Step 1: Opening bulk import form");
    await page.getByRole("button", { name: /Create Request/i }).click();
    await page.getByText("Bulk Payment").click();
    await page.waitForTimeout(1000);

    // Get the offcanvas element
    const offcanvas = page.locator(".offcanvas.show");
    await expect(offcanvas).toBeVisible();

    // Should show quota exhausted message
    await expect(
      offcanvas.getByText(/You've used all available recipient slots/i)
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Quota exhausted message displayed");

    await expect(offcanvas.getByText(/Contact us.*upgrade/i)).toBeVisible();
    console.log("✓ Contact us message displayed");

    // Continue button should still be visible but form is informational
    await expect(
      offcanvas.getByRole("button", { name: "Continue" })
    ).toBeVisible();
    console.log("✓ Form displayed with warning");

    console.log("\n✅ Test 4 completed\n");
  });
});

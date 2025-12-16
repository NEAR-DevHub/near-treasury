import { test, expect } from "@playwright/test";
import { setupLockupAccount } from "../../util/lockup.js";
import { StakingScenarios, mockStakingScenario } from "./staking-mocks.js";
import { setupTestEnvironment } from "../../util/sandbox.js";
import {
  setupTestDAO,
  navigateToStakeDelegation,
  openCreateRequestForm,
  voteAndApproveProposal,
  verifyProposalInTable,
  closeOffcanvas,
  selectValidator,
  reopenFormToCheckBalances,
  selectWallet,
  ASTRO_STAKERS_POOL_ID,
} from "./test-helpers.js";

/**
 * Stake Request Tests
 *
 * Comprehensive tests for staking delegation requests including:
 * - Form validation (DAO + Lockup wallets)
 * - DAO Stake: Create → View → Vote
 * - Lockup Stake: Create → View → Vote
 */

// Variables for sandbox integration tests
let sandbox;
let creatorAccountId;
let daoAccountId;
let lockupContractId;

test.describe("Stake Request Form Validation", () => {
  // Use logged-in storage state for authentication
  test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

  test("should comprehensively validate all stake form fields", async ({
    page,
  }) => {
    const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

    // Navigate to stake delegation page
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/stake-delegation`);
    await page.waitForTimeout(5000);

    // Click Create Request button to open dropdown
    await openCreateRequestForm({ page, requestType: "Stake" });

    // Verify form opened
    const canvasLocator = page.locator(".offcanvas-body");
    await page.waitForTimeout(1000);
    console.log("✓ Stake form opened successfully");

    // ===== 1. Test Form Structure =====

    const validatorDropdown = canvasLocator.locator(
      '[data-testid="validator-dropdown"]'
    );
    await expect(validatorDropdown).toBeVisible();
    console.log("✓ Validator dropdown is visible");

    const balanceDisplay = canvasLocator.locator(
      '[data-testid="balance-display"]'
    );
    await expect(balanceDisplay).toBeVisible();
    console.log("✓ Balance display is visible");

    // ===== 2. Test Required Field Validation (Empty Submission) =====
    const submitButton = canvasLocator.getByRole("button", { name: "Submit" });
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(
      canvasLocator.getByText("Please select a validator")
    ).toBeVisible();
    console.log("✓ Validator required validation shown");

    await expect(canvasLocator.getByText("Amount is required")).toBeVisible();
    console.log("✓ Amount required validation shown");

    // ===== 3. Test Validator Dropdown Modal and Search =====
    console.log("\n--- Testing Validator Dropdown ---");

    // Click to open validator dropdown/modal
    await validatorDropdown.click();
    await page.waitForTimeout(3000);

    // Verify modal is visible
    const validatorModal = page.locator('.modal-content, [role="dialog"]');
    await expect(validatorModal).toBeVisible();
    console.log("✓ Validator modal opened");

    // Verify search input is present
    const searchInput = page.getByPlaceholder(/Search validators/i);
    await expect(searchInput).toBeVisible();
    console.log("✓ Search input is visible");

    // Verify validator options are displayed
    const validatorOptions = page.locator('[data-testid="validator-option"]');
    const initialCount = await validatorOptions.count();
    expect(initialCount).toBeGreaterThan(0);
    console.log(`✓ Found ${initialCount} validators in list`);

    // Test search functionality - search for a specific validator
    await searchInput.fill("astro-stakers");
    await page.waitForTimeout(500);

    const filteredCount = await validatorOptions.count();
    console.log(`✓ Search filtered to ${filteredCount} validator(s)`);
    expect(filteredCount).toBeGreaterThan(0);

    // Find and select astro-stakers.poolv1.near
    const astroValidator = page
      .locator('[data-testid="validator-option"]')
      .filter({ hasText: "astro-stakers.poolv1.near" });
    await expect(astroValidator).toBeVisible();
    console.log("✓ Found astro-stakers.poolv1.near in search results");

    // Click to select it
    await astroValidator.click();
    await page.waitForTimeout(500);
    console.log("✓ Selected astro-stakers.poolv1.near");

    // Verify modal closed after selection
    await expect(validatorModal).not.toBeVisible();
    console.log("✓ Modal closed after validator selection");

    // Verify validator is displayed in the dropdown button
    await expect(validatorDropdown).toContainText("astro-stakers.poolv1.near");
    console.log("✓ 'astro-stakers.poolv1.near' displayed in dropdown button");

    // Test search clear - reopen dropdown to test
    await validatorDropdown.click();
    await page.waitForTimeout(500);
    await expect(validatorModal).toBeVisible();

    // Search input should be visible again
    const searchInputReopened = page.getByPlaceholder(/Search validators/i);
    await searchInputReopened.clear();
    await searchInputReopened.fill("test");
    await page.waitForTimeout(500);
    await searchInputReopened.clear();
    await page.waitForTimeout(500);
    const clearedCount = await validatorOptions.count();
    expect(clearedCount).toBe(initialCount);
    console.log("✓ Search clear works, showing all validators again");

    // Close modal using the Close button
    const closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    await page.waitForTimeout(500);
    await expect(validatorModal).not.toBeVisible();
    console.log("✓ Modal can be closed with Close button");

    // ===== 4. Test Amount Validations =====
    const amountInput = canvasLocator.getByLabel("Amount");
    await expect(amountInput).toBeVisible();
    await expect(amountInput).toBeEnabled(); // Should always be enabled

    // Test zero amount
    await amountInput.fill("0");
    await submitButton.click();
    await page.waitForTimeout(500);
    await expect(
      canvasLocator.getByText("Amount must be positive")
    ).toBeVisible();
    console.log("✓ Zero amount rejected");

    // Test negative amount
    await amountInput.fill("-10");
    await submitButton.click();
    await page.waitForTimeout(500);
    await expect(
      canvasLocator.getByText("Amount must be positive")
    ).toBeVisible();
    console.log("✓ Negative amount rejected");

    // Test amount exceeding balance
    await amountInput.fill("999999");
    await submitButton.click();
    await page.waitForTimeout(500);
    await expect(canvasLocator.getByText("Insufficient balance")).toBeVisible();
    console.log("✓ Excessive amount rejected");

    // Test valid amount
    await amountInput.fill("10");
    await page.waitForTimeout(300);
    console.log("✓ Valid amount accepted");

    // ===== 5. Test Available Balance Display =====
    await expect(canvasLocator.getByText(/Available:/)).toBeVisible();
    console.log("✓ Available balance text displayed");

    // ===== 6. Test "Use Max" Button =====
    const useMaxButton = canvasLocator.getByText("Use Max");
    await expect(useMaxButton).toBeVisible();
    await useMaxButton.click();
    await page.waitForTimeout(300);
    const maxValue = await amountInput.inputValue();
    expect(parseFloat(maxValue)).toBeGreaterThan(0);
    console.log(`✓ Use Max button sets value: ${maxValue} NEAR`);

    // ===== 7. Test Notes Field (Optional) =====
    const notesInput = canvasLocator.getByLabel("Notes");
    await expect(notesInput).toBeVisible();

    await notesInput.fill("Test stake note with special chars: @#$%");
    expect(await notesInput.inputValue()).toBe(
      "Test stake note with special chars: @#$%"
    );

    await notesInput.fill("");
    expect(await notesInput.inputValue()).toBe("");
    console.log("✓ Notes field is optional and accepts any text");

    // ===== 8. Test Cancel Button and Confirmation Modal =====
    const cancelButton = canvasLocator.getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toBeEnabled();

    // Click cancel button to open confirmation modal
    await cancelButton.click();
    await page.waitForTimeout(500);

    // Verify cancel confirmation modal
    const cancelModal = page
      .locator(".modal-content")
      .filter({ hasText: "Are you sure you want to cancel?" });
    await expect(cancelModal).toBeVisible();
    console.log("✓ Cancel confirmation modal opened");

    // Verify modal content
    await expect(
      page.getByText("This action will clear all the information")
    ).toBeVisible();
    console.log("✓ Cancel warning message displayed");

    // Test "No" button - should close modal and keep form open
    const noButton = cancelModal.getByRole("button", { name: "No" });
    await expect(noButton).toBeVisible();
    await noButton.click();
    await page.waitForTimeout(500);
    await expect(cancelModal).not.toBeVisible();
    console.log("✓ 'No' button closes modal without clearing form");

    // Verify form is still open with data
    await expect(canvasLocator).toBeVisible();
    expect(await amountInput.inputValue()).toBeTruthy();
    console.log("✓ Form data preserved after clicking 'No'");

    // Verify modal is closed after clicking "No"
    await expect(cancelModal).not.toBeVisible();

    // ===== 9. Test Submit Button State =====
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    console.log("✓ Submit button is functional");

    console.log("\n✅ Comprehensive stake form validation test completed");
  });
});

test.describe("Stake Request Integration Tests", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    const setup = await setupTestDAO();
    sandbox = setup.sandbox;
    creatorAccountId = setup.creatorAccountId;
    daoAccountId = setup.daoAccountId;
  });

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.close();
  });

  test.afterAll(async () => {
    if (sandbox) {
      console.log("Stopping sandbox...");
      try {
        await sandbox.stop();
        console.log("\n=== Sandbox Environment Stopped ===\n");
      } catch (error) {
        console.error("Error stopping sandbox:", error);
      }
    }
  });

  test("should create DAO stake request, view in table and details, and vote", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    // Setup test environment
    await setupTestEnvironment({ page, sandbox, creatorAccountId });

    // Navigate to stake delegation page
    await navigateToStakeDelegation({ page, daoAccountId });

    // Open create request form
    await openCreateRequestForm({ page, requestType: "Stake" });

    // Wait for form to open
    const canvasLocator = page.locator(".offcanvas-body");
    await page.waitForTimeout(1000);

    // Select validator
    await selectValidator({ page });

    // Fill amount
    const amountInput = canvasLocator.getByLabel("Amount");
    await amountInput.fill("10");
    console.log("✓ Filled amount: 10 NEAR");

    // Fill notes
    const notesInput = canvasLocator.getByLabel("Notes");
    await notesInput.fill("Test DAO stake request");
    console.log("✓ Filled notes");

    // Submit the form
    const submitButton = canvasLocator.getByRole("button", { name: "Submit" });
    await submitButton.click();
    console.log("✓ Clicked submit button");

    // Check for success toast
    await expect(
      page.getByText("Stake request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    // Close offcanvas
    await closeOffcanvas(page);

    // Verify proposal appears in table
    await verifyProposalInTable({ page, text: "Test DAO stake request" });

    // Click on the proposal to view details
    await page.getByText("Test DAO stake request").click();
    await page.waitForTimeout(2000);

    // Verify details page content
    await expect(page.getByText("Request Type")).toBeVisible();
    await expect(
      page.locator("label").filter({ hasText: "Amount" })
    ).toBeVisible();
    await expect(page.getByText("10NEAR")).toBeVisible();
    await expect(
      page.locator("label").filter({ hasText: "Validator" })
    ).toBeVisible();
    console.log("✓ Proposal details displayed correctly");

    // Mock staking balance after execution
    // After the proposal executes, the DAO now has 10 NEAR staked with astro-stakers
    // mockRPC = false: only mocks the API, uses real deployed astro-stakers contract for balances
    console.log("✓ Mocking staking API to show astro-stakers pool...");
    await mockStakingScenario(
      page,
      StakingScenarios.STAKED(daoAccountId, 10),
      false // mockRPC = false: Only mock API, use real deployed contract for RPC calls
    );

    // Vote on the proposal
    await voteAndApproveProposal({ page });

    // Open create request form to check balances
    await reopenFormToCheckBalances({ page, requestType: "Stake" });

    await expect(page.getByText("Ready to stake 90.59 NEAR")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Staked 10.00 NEAR")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button").nth(1).click();

    // Navigate to Dashboard to verify staking balance is shown
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(2000);
    console.log("✓ Navigated to Dashboard");

    // Verify NEAR portfolio shows staking balance
    const nearPortfolio = page.locator('[data-testid="NEAR-token"]');
    await expect(nearPortfolio).toBeVisible({ timeout: 10000 });

    // Click to expand the NEAR portfolio to see details
    await nearPortfolio.click();
    await page.waitForTimeout(500);

    // Verify "Staked" shows 10.00 NEAR
    await expect(
      page.getByTestId("NEAR-token").getByText("Staking")
    ).toBeVisible({ timeout: 5000 });
    // Check the balance shows 10.00 (formatted)
    await expect(
      page.getByTestId("NEAR-token").getByText("10", { exact: true })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ Staked balance correctly shows 10 NEAR in dashboard");
  });

  test("should create lockup stake request, view in table and details, and vote", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    // Setup lockup contract
    lockupContractId = await setupLockupAccount({
      sandbox,
      daoAccountId,
      creatorAccountId,
    });

    // Setup test environment
    await setupTestEnvironment({ page, sandbox, creatorAccountId });

    // Navigate to stake delegation page
    await navigateToStakeDelegation({ page, daoAccountId });

    // Open create request form
    await openCreateRequestForm({ page, requestType: "Stake" });

    // Wait for form to open
    const canvasLocator = page.locator(".offcanvas-body");
    await page.waitForTimeout(1000);

    // Wallet dropdown should be visible since we created a lockup
    const walletDropdown = canvasLocator.locator(
      '[data-testid="wallet-dropdown"]'
    );
    await expect(walletDropdown).toBeVisible({ timeout: 10000 });
    console.log("✓ Wallet dropdown is visible (lockup created)");

    // Switch to Lockup wallet
    await selectWallet({ page, walletType: "Lockup" });

    // Select validator
    await selectValidator({ page });

    // Fill amount
    const amountInput = canvasLocator.getByLabel("Amount");
    await amountInput.fill("10");
    console.log("✓ Filled amount: 10 NEAR");

    // Fill notes
    const notesInput = canvasLocator.getByLabel("Notes");
    await notesInput.fill("Test lockup stake request");
    console.log("✓ Filled notes");

    // Submit the form
    const submitButton = canvasLocator.getByRole("button", { name: "Submit" });
    await submitButton.click();
    console.log("✓ Clicked submit button");

    // For lockup first-time staking, there should be TWO proposals:
    // 1. select_staking_pool (whitelist validator)
    // 2. deposit_and_stake (actual stake)
    // Check for success toast
    await expect(
      page.getByText("Stake request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    // Wait for transaction to complete
    await page.waitForTimeout(3000);

    // Close the offcanvas/modal
    await closeOffcanvas(page);

    // Verify whitelist proposal appears in table
    await verifyProposalInTable({
      page,
      text: "Approve to designate this validator with this lockup account. Lockup accounts can only have one validator",
    });

    // Verify that stake request is NOT visible yet (waiting for whitelist approval)
    await expect(page.getByText("Test lockup stake request")).not.toBeVisible();
    console.log("✓ Stake request is hidden (waiting for whitelist approval)");

    // Click on the proposal to view details
    await page
      .getByText(
        "Approve to designate this validator with this lockup account. Lockup accounts can only have one validator"
      )
      .click();
    await page.waitForTimeout(2000);

    await voteAndApproveProposal({ page });

    await page.waitForTimeout(2000);

    // Verify stake request is NOW visible (after whitelist approval)
    await expect(page.getByText("Test lockup stake request")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Stake request is now visible (after whitelist approval)");
    await page.getByText("Test lockup stake request").click();
    await page.waitForTimeout(1000);

    // Verify details page content
    await expect(page.getByText("Request Type")).toBeVisible();
    await expect(page.getByText("10NEAR")).toBeVisible();
    await expect(
      page.locator("label").filter({ hasText: "Validator" })
    ).toBeVisible();
    await expect(
      page.getByText("astro-stakers.poolv1.near").first()
    ).toBeVisible();
    console.log("✓ Lockup stake details page visible");

    await mockStakingScenario(
      page,
      StakingScenarios.STAKED(lockupContractId, 10),
      false
    );
    await voteAndApproveProposal({ page });

    await page.waitForTimeout(2000);

    // Open create request form to check balances
    await reopenFormToCheckBalances({ page, requestType: "Stake" });
    await selectWallet({ page, walletType: "Lockup" });

    await expect(
      page.getByRole("button", { name: "astro-stakers.poolv1.near" }).first()
    ).toBeDisabled({
      timeout: 10000,
    });

    await expect(
      page.getByText(
        "You cannot split your locked funds across multiple validators."
      )
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Ready to stake 36.50 NEAR")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Staked 10.00 NEAR")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button").nth(1).click();

    // Navigate to Dashboard to verify staking balance is shown
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(2000);
    console.log("✓ Navigated to Dashboard");

    // Verify NEAR portfolio shows staking balance
    const nearPortfolio = page.locator('[data-testid="NEAR-token"]').nth(1);
    await expect(nearPortfolio).toBeVisible({ timeout: 10000 });
    await nearPortfolio.click();
    await expect(nearPortfolio.getByText("Staking")).toBeVisible({
      timeout: 5000,
    });
    // Check the balance shows 10.00 (formatted)
    await expect(nearPortfolio.getByText("10", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    console.log("✓ Staked balance correctly shows 10 NEAR in dashboard");
  });
});

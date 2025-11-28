import { test, expect } from "@playwright/test";
import { setupLockupAccount } from "../../util/lockup.js";
import { StakingScenarios, mockStakingScenario } from "./staking-mocks.js";
import {
  setupTestDAO,
  setupTestEnvironment,
  navigateToStakeDelegation,
  openCreateRequestForm,
  voteAndApproveProposal,
  verifyProposalInTable,
  closeOffcanvas,
  reopenFormToCheckBalances,
  selectWallet,
  toYoctoNEAR,
  stakeFromDAO,
  selectStakingPool,
  stakeThroughLockup,
} from "./test-helpers.js";

/**
 * Unstake Request Tests
 *
 * Comprehensive tests for unstaking delegation requests including:
 * - Form validation (DAO + Lockup wallets)
 * - DAO Unstake: Create → View → Vote
 * - Lockup Unstake: Create → View → Vote
 */

// Variables for sandbox integration tests
let sandbox;
let creatorAccountId;
let daoAccountId;
let lockupContractId;

test.describe("Unstake Request Form Validation", () => {
  // Use logged-in storage state for authentication
  test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

  test("should comprehensively validate all unstake form fields with staked balance", async ({
    page,
  }) => {
    const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

    // Mock: 10 NEAR staked with astro-stakers validator
    await mockStakingScenario(page, StakingScenarios.STAKED(TEST_DAO_ID, 10));

    // Navigate to stake delegation page
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/stake-delegation`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Click Create Request button to open dropdown
    await openCreateRequestForm({ page, requestType: "Unstake" });

    // Verify unstake form opened
    const canvasLocator = page.locator(".offcanvas-body");
    await page.waitForTimeout(1000);
    console.log("✓ Unstake form opened successfully");

    const balanceDisplay = canvasLocator.locator(
      '[data-testid="balance-display"]'
    );
    await expect(balanceDisplay).toBeVisible();
    console.log("✓ Balance display is visible");

    const validatorDropdown = canvasLocator.locator(
      '[data-testid="validator-dropdown"]'
    );
    await expect(validatorDropdown).toBeVisible();
    console.log("✓ Validator dropdown is visible");

    // ===== 1. Test Required Field Validation (Empty Submission) =====
    const submitButton = canvasLocator.getByRole("button", { name: "Submit" });
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(
      canvasLocator.getByText("Please select a validator")
    ).toBeVisible();
    console.log("✓ Validator required validation shown");

    await expect(canvasLocator.getByText("Amount is required")).toBeVisible();
    console.log("✓ Amount required validation shown");

    // ===== 2. Test Amount Input State (Disabled Until Validator Selected) =====
    const amountInput = canvasLocator.getByLabel("Amount");
    await expect(amountInput).toBeVisible();

    // Amount should be disabled until validator is selected
    const isDisabled = await amountInput.isDisabled();
    if (isDisabled) {
      console.log("✓ Amount input disabled until validator selected");
    }

    // ===== 3. Test Validator Dropdown Modal and Search =====
    console.log("\n--- Testing Validator Dropdown ---");

    // Click to open validator dropdown/modal
    await validatorDropdown.click();
    await page.waitForTimeout(1000);

    // Verify modal is visible
    const validatorModal = page.locator('.modal-content, [role="dialog"]');
    await expect(validatorModal).toBeVisible();
    console.log("✓ Validator modal opened");

    await page.waitForTimeout(3000);

    // Verify search input is present
    const searchInput = page.getByPlaceholder(/Search validators/i);
    await expect(searchInput).toBeVisible();
    console.log("✓ Search input is visible");

    // Verify validator options are displayed
    const validatorOptions = page.locator('[data-testid="validator-option"]');
    const initialCount = await validatorOptions.count();
    expect(initialCount).toBeGreaterThan(0);
    console.log(`✓ Found ${initialCount} validators with staked balance`);

    // Test search functionality - search for a specific validator
    await searchInput.fill("astro-stakers");
    await page.waitForTimeout(500);

    const filteredCount = await validatorOptions.count();
    console.log(`✓ Search filtered to ${filteredCount} validator(s)`);

    // Find and select astro-stakers.poolv1.near (if available)
    const astroValidator = page
      .locator('[data-testid="validator-option"]')
      .filter({ hasText: "astro-stakers.poolv1.near" });
    if (await astroValidator.isVisible()) {
      console.log("✓ Found astro-stakers.poolv1.near in search results");

      // Click to select it
      await astroValidator.click();
      await page.waitForTimeout(500);
      console.log("✓ Selected astro-stakers.poolv1.near");

      // Verify modal closed after selection
      await expect(validatorModal).not.toBeVisible();
      console.log("✓ Modal closed after validator selection");

      // Verify validator is displayed in the dropdown button
      await expect(validatorDropdown).toContainText(
        "astro-stakers.poolv1.near"
      );
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

      // Amount should now be enabled
      await expect(amountInput).toBeEnabled();
      console.log("✓ Amount input enabled after validator selection");

      // ===== 4. Test "Available to Unstake" Display =====
      await expect(
        canvasLocator.getByText(/Available to unstake:/)
      ).toBeVisible();
      console.log("✓ Available to unstake text displayed");

      // ===== 5. Test "Use Max" Button =====
      const useMaxButton = canvasLocator.getByText("Use Max");
      await expect(useMaxButton).toBeVisible();
      await useMaxButton.click();
      await page.waitForTimeout(300);
      const maxValue = await amountInput.inputValue();
      expect(parseFloat(maxValue)).toBeGreaterThan(0);
      console.log(`✓ Use Max button sets value: ${maxValue} NEAR`);

      // Reset amount for further tests
      await amountInput.fill("");

      // ===== 6. Test Amount Validations =====
      // Test zero amount
      await amountInput.fill("0");
      await submitButton.click();
      await page.waitForTimeout(500);
      await expect(
        canvasLocator.getByText("Amount must be positive")
      ).toBeVisible();
      console.log("✓ Zero amount rejected");

      // Test negative amount
      await amountInput.fill("-5");
      await submitButton.click();
      await page.waitForTimeout(500);
      await expect(
        canvasLocator.getByText("Amount must be positive")
      ).toBeVisible();
      console.log("✓ Negative amount rejected");

      // Test amount exceeding staked balance
      await amountInput.fill("999999");
      await submitButton.click();
      await page.waitForTimeout(500);
      await expect(
        canvasLocator.getByText(/Amount exceeds staked balance/)
      ).toBeVisible();
      console.log("✓ Excessive amount rejected");

      // Test valid amount
      await amountInput.fill("1");
      await page.waitForTimeout(500);

      // ===== 7. Test Two-Step Process Warning =====
      await expect(
        canvasLocator.getByText(/By submitting, you create two requests/)
      ).toBeVisible();
      console.log("✓ Two-step unstaking process warning displayed");

      // ===== 8. Test Notes Field (Optional) =====
      const notesInput = canvasLocator.getByLabel("Notes");
      await expect(notesInput).toBeVisible();

      await notesInput.fill("Test unstake note");
      expect(await notesInput.inputValue()).toBe("Test unstake note");

      await notesInput.fill("");
      expect(await notesInput.inputValue()).toBe("");
      console.log("✓ Notes field is optional");

      // ===== 9. Test Cancel Button and Confirmation Modal =====
      const cancelButton = canvasLocator.getByRole("button", {
        name: "Cancel",
      });
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

      // Verify modal is closed
      await expect(cancelModal).not.toBeVisible();

      // ===== 10. Test Submit Button State =====
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
      console.log("✓ Submit button is functional");
    }

    console.log(
      "\n✅ Comprehensive unstake form validation with staked balance test completed"
    );
  });

  test("should show 'no staked balance' message when DAO has no staked funds", async ({
    page,
  }) => {
    const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

    // Mock: No staked balance
    await mockStakingScenario(page, StakingScenarios.NONE(TEST_DAO_ID));

    // Navigate to stake delegation page
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/stake-delegation`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Click Create Request button
    await openCreateRequestForm({ page, requestType: "Unstake" });

    const canvasLocator = page.locator(".offcanvas-body");

    // Verify validator dropdown shows "No validators"
    const validatorDropdown = canvasLocator.getByText(
      "You don't have any staked tokens with a validator. Please stake tokens first"
    );
    await expect(validatorDropdown).toBeVisible();
    await expect(
      canvasLocator.getByRole("button", { name: "Submit" })
    ).not.toBeVisible();
    await expect(
      canvasLocator.getByRole("button", { name: "Cancel" })
    ).not.toBeVisible();

    console.log("✓ 'No validators' message displayed");
    console.log("\n✅ No staked balance scenario test completed");
  });
});

test.describe("Unstake Request Integration Tests", () => {
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

  test("should create DAO unstake request, view in table and details, and vote", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    console.log("\n=== Starting DAO Unstake Integration Test ===\n");

    // Setup test environment
    await setupTestEnvironment({ page, sandbox, creatorAccountId });

    // Step 1: Stake 10 NEAR from DAO to validator pool
    console.log("Step 1: Staking 10 NEAR from DAO to validator...");
    const validatorPoolId = "astro-stakers.poolv1.near";

    await stakeFromDAO({
      sandbox,
      daoAccountId,
      validatorPoolId,
      amount: toYoctoNEAR("10"),
      callerAccountId: creatorAccountId,
      proposalBond: "0",
    });

    // Step 2: Mock staking API to show staked balance
    console.log("Step 2: Setting up staking mocks...");
    await mockStakingScenario(
      page,
      StakingScenarios.STAKED(daoAccountId, 10),
      false
    );
    await page.waitForLoadState("networkidle");

    // Step 3: Navigate to Stake Delegation page
    console.log("Step 3: Navigating to Stake Delegation page...");
    await navigateToStakeDelegation({ page, daoAccountId });

    // Step 4: Open create request form and select Unstake
    console.log("Step 4: Creating unstake request...");
    await openCreateRequestForm({ page, requestType: "Unstake" });

    const canvas = page.locator(".offcanvas-body");
    await canvas.waitFor({ state: "visible", timeout: 5000 });

    // Step 5: Select validator
    console.log("Step 5: Selecting validator...");
    const validatorDropdown = canvas.getByTestId("validator-dropdown");
    await validatorDropdown.click();

    const modal = page.locator(".modal-content");
    await modal.waitFor({ state: "visible", timeout: 5000 });

    // Verify there's only one validator option (the one we staked with)
    const validatorOptions = modal.getByTestId("validator-option");
    await expect(validatorOptions).toHaveCount(1);
    console.log("✓ Validator dropdown shows exactly one option");

    // Verify the validator option shows correct details including staked amount
    await expect(validatorOptions).toContainText(validatorPoolId);
    await expect(validatorOptions).toContainText("1% Fee");
    await expect(validatorOptions).toContainText("Staked:10.00 NEAR");
    console.log(
      "✓ Validator shows: astro-stakers.poolv1.near, 1% Fee, Staked: 10.00 NEAR"
    );

    // Select the validator we staked with
    const validatorOption = modal
      .getByTestId("validator-option")
      .filter({ hasText: validatorPoolId });
    await validatorOption.click();

    // Close modal
    await modal.waitFor({ state: "hidden", timeout: 5000 });

    // Verify validator is selected
    await expect(validatorDropdown).toContainText(validatorPoolId);

    // Step 6: Fill unstake amount
    console.log("Step 6: Filling unstake form...");
    const amountInput = canvas.getByLabel("Amount");
    await amountInput.fill("5");

    const notesInput = canvas.getByLabel("Notes");
    await notesInput.fill("Unstaking 5 NEAR for testing");

    // Step 7: Submit request
    console.log("Step 7: Submitting unstake request...");
    const submitButton = canvas.getByRole("button", { name: "Submit" });
    await submitButton.click();

    // Check for success toast
    await expect(
      page.getByText("Unstake request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    // Wait for transaction to complete
    await page.waitForTimeout(3000);

    // Close the offcanvas/modal
    await closeOffcanvas(page);

    // Step 8: Verify request appears in table
    console.log("Step 8: Verifying request in table...");
    await verifyProposalInTable({ page, text: "Unstaking 5 NEAR for testing" });

    // Verify that auto-created withdraw request is NOT visible yet (waiting for unstake approval)
    await expect(
      page.getByText(/Following #\d+ unstake request/)
    ).not.toBeVisible();
    console.log("✓ Withdraw request is hidden (waiting for unstake approval)");

    // Step 9: Click on the proposal to view details
    console.log("Step 9: Viewing request details...");
    await page.getByText("Unstaking 5 NEAR for testing").click();
    await page.waitForTimeout(2000);

    // Verify details page content
    await expect(page.getByText("Request Type")).toBeVisible();
    await expect(page.getByText("5NEAR")).toBeVisible();
    console.log("✓ Unstake request details displayed correctly");

    // Step 10: Vote on the request
    console.log("Step 10: Voting on unstake request...");
    await voteAndApproveProposal({ page });
    await page.waitForTimeout(2000);

    // Verify auto-created withdraw request is NOW visible (after unstake approval)
    await expect(page.getByText(/Following #\d+ unstake request/)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Voting is not available before unstaking release")
    ).toBeVisible();
    await page.getByTestId("proposal-request-#2").click();
    await page.waitForTimeout(1000);
    await expect(
      page.getByText("Voting is not available before unstaking release")
    ).toHaveCount(2);

    console.log("✓ Withdraw request is now visible (after unstake approval)");

    // Open create request form to check updated balances
    await reopenFormToCheckBalances({ page, requestType: "Unstake" });

    const balanceCanvas = page.locator(".offcanvas-body");
    await balanceCanvas.waitFor({ state: "visible", timeout: 5000 });

    // Check the BalanceDisplay component shows updated balances
    const balanceDisplay = balanceCanvas.locator(
      '[data-testid="balance-display"]'
    );
    await expect(balanceDisplay).toBeVisible({ timeout: 10000 });

    // After unstaking 5 NEAR from 10 NEAR staked:
    // - Staked: 5.00 NEAR
    // - Pending release: 5.00 NEAR
    await expect(page.getByText("Staked 5.00 NEAR")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Pending release 5.00 NEAR")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Balances updated correctly after unstake");
    await page.getByRole("button").nth(1).click();

    // Navigate to Dashboard to verify updated staking balance
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(2000);
    console.log("✓ Navigated to Dashboard");

    // Verify NEAR portfolio shows updated staking balance
    const nearPortfolio = page.locator('[data-testid="NEAR-token"]');
    await expect(nearPortfolio).toBeVisible({ timeout: 10000 });

    // Click to expand the NEAR portfolio to see details
    await nearPortfolio.click();
    await page.waitForTimeout(500);

    // Verify "Staked" shows 5.00 NEAR (reduced from 10)
    await expect(nearPortfolio.getByText("Staking")).toBeVisible({
      timeout: 5000,
    });
    await nearPortfolio.getByText("Staking").click();
    await expect(nearPortfolio.getByText("Staked")).toBeVisible({
      timeout: 5000,
    });
    await expect(nearPortfolio.getByText("Pending Release")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("5", { exact: true })).toHaveCount(2);
    console.log(
      "✓ Staking balance correctly shows 5 NEAR in dashboard (after unstaking 5)"
    );
  });

  test("should create lockup unstake request, view in table and details, and vote", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    // Setup lockup contract
    lockupContractId = await setupLockupAccount({
      sandbox,
      daoAccountId,
      creatorAccountId,
    });

    console.log("\n=== Starting Lockup Unstake Integration Test ===\n");

    // Setup test environment
    await setupTestEnvironment({ page, sandbox, creatorAccountId });

    // Step 1: Select staking pool for lockup and stake
    console.log("Step 1: Selecting staking pool and staking through lockup...");
    const validatorPoolId = "astro-stakers.poolv1.near";

    // Select staking pool (creates proposal 0)
    await selectStakingPool({
      sandbox,
      daoAccountId,
      lockupContractId,
      validatorPoolId,
      callerAccountId: creatorAccountId,
    });

    // Stake 10 NEAR through lockup (creates proposal 1)
    await stakeThroughLockup({
      sandbox,
      daoAccountId,
      lockupContractId,
      amount: toYoctoNEAR("10"),
      callerAccountId: creatorAccountId,
    });
    console.log("✓ Staked 10 NEAR through lockup");

    // Step 2: Mock staking API to show staked balance for lockup
    console.log("Step 2: Setting up staking mocks for lockup...");
    await mockStakingScenario(
      page,
      StakingScenarios.STAKED(lockupContractId, 10),
      false
    );

    await page.waitForTimeout(2000);

    // Step 3: Navigate to Stake Delegation page
    console.log("Step 3: Navigating to Stake Delegation page...");
    await navigateToStakeDelegation({ page, daoAccountId });

    // Step 4: Open create request form and select Unstake
    console.log("Step 4: Creating unstake request...");
    await openCreateRequestForm({ page, requestType: "Unstake" });

    const canvas = page.locator(".offcanvas-body");
    await canvas.waitFor({ state: "visible", timeout: 5000 });

    // Step 5: Select Lockup wallet
    console.log("Step 5: Selecting Lockup wallet...");
    const walletDropdown = canvas.getByTestId("wallet-dropdown");
    await expect(walletDropdown).toBeVisible({ timeout: 10000 });
    console.log("✓ Wallet dropdown is visible (lockup created)");

    await walletDropdown.click();
    await page.waitForTimeout(500);

    const lockupOption = page.getByText("Lockup");
    await expect(lockupOption).toBeVisible({ timeout: 5000 });
    await lockupOption.click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected Lockup wallet");

    // Step 6: validator is already selected from stake through lockup
    console.log("Step 6: Selecting validator...");
    const validatorDropdown = canvas.getByTestId("validator-dropdown");
    await expect(validatorDropdown).toContainText(validatorPoolId);

    // Step 7: Fill unstake amount
    console.log("Step 7: Filling unstake form...");
    const amountInput = canvas.getByLabel("Amount");
    await amountInput.fill("5");
    console.log("✓ Filled amount: 5 NEAR");

    const notesInput = canvas.getByLabel("Notes");
    await notesInput.fill("Test lockup unstake request");
    console.log("✓ Filled notes");

    // Step 8: Submit request
    console.log("Step 8: Submitting unstake request...");
    const submitButton = canvas.getByRole("button", { name: "Submit" });
    await submitButton.click();

    // Check for success toast
    await expect(
      page.getByText("Unstake request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    // Wait for transaction to complete
    await page.waitForTimeout(3000);

    // Close the offcanvas/modal
    await closeOffcanvas(page);

    // Step 9: Verify request appears in table
    console.log("Step 9: Verifying request in table...");
    await verifyProposalInTable({ page, text: "Test lockup unstake request" });

    // Verify that auto-created withdraw request is NOT visible yet (waiting for unstake approval)
    await expect(
      page.getByText(/Following #\d+ unstake request/)
    ).not.toBeVisible();
    console.log("✓ Withdraw request is hidden (waiting for unstake approval)");

    // Step 10: Click on the proposal to view details
    console.log("Step 10: Viewing request details...");
    await page.getByText("Test lockup unstake request").click();
    await page.waitForTimeout(2000);

    // Verify details page content
    await expect(page.getByText("Request Type")).toBeVisible();
    await expect(page.getByText("5NEAR")).toBeVisible();
    console.log("✓ Lockup unstake details page visible");

    // Step 11: Vote on the request
    console.log("Step 11: Voting on unstake request...");
    await voteAndApproveProposal({ page });

    await page.waitForTimeout(2000);

    // Verify auto-created withdraw request is NOW visible (after unstake approval)
    await expect(page.getByText(/Following #\d+ unstake request/)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText("Voting is not available before unstaking release")
    ).toBeVisible();
    console.log("✓ Withdraw request is now visible (after unstake approval)");

    // Open create request form to check updated balances
    await reopenFormToCheckBalances({ page, requestType: "Unstake" });

    // Select Lockup wallet
    await selectWallet({ page, walletType: "Lockup" });

    const balanceCanvas = page.locator(".offcanvas-body");
    await balanceCanvas.waitFor({ state: "visible", timeout: 5000 });

    // Check the BalanceDisplay component shows updated balances
    const balanceDisplay = balanceCanvas.locator(
      '[data-testid="balance-display"]'
    );
    await expect(balanceDisplay).toBeVisible({ timeout: 10000 });

    // After unstaking 5 NEAR from 10 NEAR staked through lockup:
    // - Staked: 5.00 NEAR
    // - Pending release: 5.00 NEAR
    await expect(page.getByText("Staked 5.00 NEAR")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Pending release 5.00 NEAR")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Lockup balances updated correctly after unstake");
    await page.getByRole("button").nth(1).click();

    // Navigate to Dashboard to verify updated staking balance
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(2000);
    console.log("✓ Navigated to Dashboard");

    // Verify NEAR portfolio shows updated staking balance
    const nearPortfolio = page.locator('[data-testid="NEAR-token"]').nth(1);
    await expect(nearPortfolio).toBeVisible({ timeout: 10000 });

    // Click to expand the NEAR portfolio to see details
    await nearPortfolio.click();
    await page.waitForTimeout(500);

    // Verify "Staking" section shows 5.00 NEAR (reduced from 10)
    await expect(nearPortfolio.getByText("Staking")).toBeVisible({
      timeout: 5000,
    });
    await nearPortfolio.getByText("Staking").click();
    await expect(nearPortfolio.getByText("Pending Release")).toBeVisible({
      timeout: 5000,
    });
    await expect(nearPortfolio.getByText("Staked")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("5", { exact: true })).toHaveCount(2);
    console.log(
      "✓ Staking balance correctly shows 5 NEAR in dashboard (after unstaking 5 through lockup)"
    );

    console.log("\n✓ Lockup Unstake Integration Test Complete\n");
  });
});

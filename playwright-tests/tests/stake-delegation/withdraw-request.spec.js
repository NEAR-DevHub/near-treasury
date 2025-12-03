import { test, expect } from "@playwright/test";
import { setupLockupAccount } from "../../util/lockup.js";
import { StakingScenarios, mockStakingScenario } from "./staking-mocks.js";
import { setupTestEnvironment } from "../../util/sandbox.js";
import {
  setupTestDAO,
  navigateToStakeDelegation,
  openCreateRequestForm,
  voteAndApproveProposal,
  closeOffcanvas,
  reopenFormToCheckBalances,
  selectWallet,
  toYoctoNEAR,
  stakeFromDAO,
  unstakeFromDAO,
  selectStakingPool,
  stakeThroughLockup,
  unstakeThroughLockup,
  ASTRO_STAKERS_POOL_ID,
} from "./test-helpers.js";

/**
 * Withdraw Request Tests
 *
 * Comprehensive tests for withdrawal delegation requests including:
 * - Form validation (different states: no balance, pending, ready)
 * - DAO Withdraw: Create → View → Vote
 * - Lockup Withdraw: Create → View → Vote
 *
 * NOTE: Withdraw form is unique - it has NO user input fields.
 * It auto-selects ALL validators with available withdrawal balance.
 */

// Variables for sandbox integration tests
let sandbox;
let creatorAccountId;
let daoAccountId;
let lockupContractId;

test.describe("Withdraw Request Form Validation", () => {
  // Use logged-in storage state for authentication
  test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

  test("should show 'no unstaked balance' message when nothing is available to withdraw", async ({
    page,
  }) => {
    const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

    // Mock: No staked/unstaked balance
    await mockStakingScenario(page, StakingScenarios.NONE(TEST_DAO_ID));

    // Navigate to stake delegation page
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/stake-delegation`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Open withdraw form
    await openCreateRequestForm({ page, requestType: "Withdraw" });

    const canvasLocator = page.locator(".offcanvas-body");
    await page.waitForTimeout(1000);

    // Verify "no unstaked balance" warning is displayed
    await expect(
      canvasLocator.getByText(
        /You don't have any unstaked balance available for withdrawal/i
      )
    ).toBeVisible();
    console.log("✓ 'No unstaked balance' warning displayed");

    // Verify submit button is disabled
    const submitButton = canvasLocator.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeDisabled();
    console.log("✓ Submit button is disabled");
  });

  test("should allow withdrawal when unstaked balance is ready", async ({
    page,
  }) => {
    const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

    // Mock: 5 NEAR available for withdrawal (already unstaked and ready)
    await mockStakingScenario(
      page,
      StakingScenarios.WITHDRAWABLE(TEST_DAO_ID, 5)
    );

    // Navigate to stake delegation page
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/stake-delegation`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Open withdraw form
    await openCreateRequestForm({ page, requestType: "Withdraw" });

    const canvasLocator = page.locator(".offcanvas-body");
    await page.waitForTimeout(1000);

    // Verify validator with available balance is displayed
    await expect(
      canvasLocator.getByText("Available for withdrawal 5.00 NEAR")
    ).toBeVisible();
    console.log("✓ Validator with available balance displayed");

    // Verify the amount shows 5 NEAR
    await expect(
      canvasLocator.getByText("astro-stakers.poolv1.near")
    ).toBeVisible();

    console.log("✓ Withdrawal amount (5 NEAR) displayed");

    // Verify submit button is enabled
    const submitButton = canvasLocator.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeEnabled();
    console.log("✓ Submit button is enabled");
  });
});

test.describe("Withdraw Request Integration Tests", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);

    const setup = await setupTestDAO({ epochLength: 2 }); // 2 blocks per epoch for fast withdraw testing
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

  test("should create DAO withdraw request, view in table and details, and vote", async ({
    page,
  }) => {
    test.setTimeout(300000); // 3 minutes

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

    await page.waitForTimeout(10000);

    // Step 2: Unstake 5 NEAR
    console.log("Step 2: Unstaking 5 NEAR...");
    await unstakeFromDAO({
      sandbox,
      daoAccountId,
      validatorPoolId,
      amount: toYoctoNEAR("5"),
      callerAccountId: creatorAccountId,
      proposalBond: "0",
    });

    await page.waitForTimeout(10000);

    // Verify funds are now available for withdrawal
    const isAvailable = await sandbox.viewFunction(
      validatorPoolId,
      "is_account_unstaked_balance_available",
      { account_id: daoAccountId }
    );
    if (!isAvailable) {
      await page.waitForTimeout(10000);
    }

    // Step 4: Mock staking API to show the correct balance
    console.log("Step 4: Mocking staking API...");
    await mockStakingScenario(
      page,
      StakingScenarios.WITHDRAWABLE(daoAccountId, 5),
      false // mockRPC = false: Use real contracts (we just fast-forwarded!)
    );

    // Step 5: Navigate to Stake Delegation page
    console.log("Step 5: Navigating to Stake Delegation page...");
    await navigateToStakeDelegation({ page, daoAccountId });

    // Step 6: Create withdraw request
    console.log("Step 6: Creating withdraw request...");
    await openCreateRequestForm({ page, requestType: "Withdraw" });

    const canvas = page.locator(".offcanvas-body");
    await canvas.waitFor({ state: "visible", timeout: 5000 });

    // Verify validator with available balance is displayed
    await expect(
      canvas.getByText("Available for withdrawal 5.00 NEAR")
    ).toBeVisible();
    await expect(canvas.getByText("astro-stakers.poolv1.near")).toBeVisible();
    console.log("✓ Withdraw form shows 5 NEAR available");

    // Submit the form
    const submitButton = canvas.getByRole("button", { name: "Submit" });
    await submitButton.click();
    console.log("✓ Clicked submit button");

    // Check for success toast
    await expect(
      page.getByText("Withdraw request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    await page.waitForTimeout(3000);

    // Close the offcanvas
    await closeOffcanvas(page);

    // Step 6: Verify request appears in table
    console.log("Step 6: Verifying request in table...");
    await expect(
      page.getByTestId("proposal-request-#2").getByText("Withdraw")
    ).toBeVisible();

    // Step 7: Click on the proposal to view details
    console.log("Step 7: Viewing request details...");
    await page.getByTestId("proposal-request-#2").getByText("Withdraw").click();
    await page.waitForTimeout(2000);

    // Verify details page content
    await expect(page.getByText("Request Type")).toBeVisible();
    await expect(page.getByText("5NEAR")).toBeVisible();
    await expect(page.getByText("astro-stakers.poolv1.near")).toHaveCount(2);
    console.log("✓ Withdraw request details displayed correctly");

    // Step 8: Vote on the request
    console.log("Step 8: Voting on withdraw request...");

    await voteAndApproveProposal({ page });

    await page.waitForTimeout(2000);

    // Step 9: Check form to verify balance is now 0 (all withdrawn)
    console.log("Step 9: Checking form for updated balance...");
    await reopenFormToCheckBalances({ page, requestType: "Withdraw" });
    await page.waitForTimeout(2000);

    // Should show "no unstaked balance" message since we withdrew everything
    const balanceCanvas = page.locator(".offcanvas-body");
    await expect(
      balanceCanvas.getByText(
        /You don't have any unstaked balance available for withdrawal/i
      )
    ).toBeVisible({ timeout: 10000 });
    await expect(
      balanceCanvas.getByText("Available for withdrawal 0.00 NEAR")
    ).toBeVisible();
    console.log("✓ Form correctly shows no balance available (all withdrawn)");

    await page.getByRole("button").nth(1).click();

    // Step 10: Navigate to Dashboard to verify updated balance
    console.log("Step 10: Checking dashboard...");
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(2000);

    // Verify NEAR portfolio
    const nearPortfolio = page.locator('[data-testid="NEAR-token"]');
    await expect(nearPortfolio).toBeVisible({ timeout: 10000 });

    // Click to expand the NEAR portfolio
    await nearPortfolio.click();
    await page.waitForTimeout(500);

    // Verify staking section shows correct balances (5 NEAR still staked, 0 pending release)
    await expect(nearPortfolio.getByText("Staking")).toBeVisible({
      timeout: 5000,
    });
    await nearPortfolio.getByText("Staking").click();
    await expect(nearPortfolio.getByText("Staked")).toBeVisible({
      timeout: 5000,
    });
    // After withdrawing 5 NEAR, should still have 5 NEAR staked
    await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
    await expect(
      nearPortfolio.getByText("Available for withdrawal 0")
    ).toBeVisible();
    console.log("✓ Dashboard correctly shows 5 NEAR still staked");
  });

  test("should create lockup withdraw request, view in table and details, and vote", async ({
    page,
  }) => {
    test.setTimeout(300000); // 3 minutes

    // Setup lockup contract
    lockupContractId = await setupLockupAccount({
      sandbox,
      daoAccountId,
      creatorAccountId,
    });

    // Setup test environment
    await setupTestEnvironment({ page, sandbox, creatorAccountId });

    // Step 1: Select staking pool, stake, and unstake through lockup
    console.log("Step 1: Setting up lockup staking flow...");
    const validatorPoolId = ASTRO_STAKERS_POOL_ID;

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

    await page.waitForTimeout(10000);
    // Unstake 5 NEAR through lockup (creates proposal 2)
    await unstakeThroughLockup({
      sandbox,
      daoAccountId,
      lockupContractId,
      amount: toYoctoNEAR("5"),
      callerAccountId: creatorAccountId,
    });
    console.log("✓ Unstaked 5 NEAR through lockup");

    await page.waitForTimeout(10000);

    // Verify funds are now available for withdrawal
    const isAvailable = await sandbox.viewFunction(
      ASTRO_STAKERS_POOL_ID,
      "is_account_unstaked_balance_available",
      { account_id: lockupContractId }
    );

    if (!isAvailable) {
      await page.waitForTimeout(10000);
    }

    // Step 2: Mock staking API to show the correct balance
    console.log("Step 3: Mocking lockup staking API...");
    await mockStakingScenario(
      page,
      StakingScenarios.WITHDRAWABLE(lockupContractId, 5),
      false
    );

    // Step 3: Navigate to Stake Delegation page
    console.log("Step 4: Navigating to Stake Delegation page...");
    await navigateToStakeDelegation({ page, daoAccountId });

    // Step 4: Create withdraw request
    console.log("Step 5: Creating withdraw request...");
    await openCreateRequestForm({ page, requestType: "Withdraw" });

    const canvas = page.locator(".offcanvas-body");
    await canvas.waitFor({ state: "visible", timeout: 5000 });

    // Select Lockup wallet
    await selectWallet({ page, walletType: "Lockup" });

    // Verify validator with available balance is displayed
    await expect(
      canvas.getByText("Available for withdrawal 5.00 NEAR")
    ).toBeVisible();
    await expect(canvas.getByText("astro-stakers.poolv1.near")).toBeVisible();
    console.log("✓ Withdraw form shows 5 NEAR available for lockup");

    // Submit the form
    const submitButton = canvas.getByRole("button", { name: "Submit" });
    await submitButton.click();
    console.log("✓ Clicked submit button");

    // Check for success toast
    await expect(
      page.getByText("Withdraw request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    await page.waitForTimeout(3000);

    // Close the offcanvas
    await closeOffcanvas(page);

    // Step 5: Verify request appears in table
    console.log("Step 5: Verifying request in table...");
    await expect(
      page.getByTestId("proposal-request-#3").getByText("Withdraw")
    ).toBeVisible();

    // Step 6: Click on the proposal to view details
    console.log("Step 6: Viewing request details...");
    await page.getByTestId("proposal-request-#3").getByText("Withdraw").click();
    await page.waitForTimeout(2000);

    // Verify details page content
    await expect(page.getByText("Request Type")).toBeVisible();
    await expect(page.getByText("5NEAR")).toBeVisible();
    await expect(page.getByText("astro-stakers.poolv1.near")).toHaveCount(2);
    console.log("✓ Lockup withdraw request details displayed correctly");

    // Step 7: Vote on the request
    console.log("Step 7: Voting on withdraw request...");
    await voteAndApproveProposal({ page });

    await page.waitForTimeout(2000);

    // Step 8: Check form to verify balance is now 0 (all withdrawn)
    console.log("Step 8: Checking form for updated balance...");
    await reopenFormToCheckBalances({ page, requestType: "Withdraw" });

    // Select Lockup wallet again to check its balance
    await selectWallet({ page, walletType: "Lockup" });

    // Should show "no unstaked balance" message since we withdrew everything
    const balanceCanvas = page.locator(".offcanvas-body");
    await expect(
      balanceCanvas.getByText(
        /You don't have any unstaked balance available for withdrawal/i
      )
    ).toBeVisible({ timeout: 10000 });
    await expect(
      balanceCanvas.getByText("Available for withdrawal 0.00 NEAR")
    ).toBeVisible();
    console.log(
      "✓ Form correctly shows no balance available for lockup (all withdrawn)"
    );

    await page.getByRole("button").nth(1).click();

    // Step 9: Navigate to Dashboard to verify updated balance
    console.log("Step 9: Checking dashboard...");
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(2000);

    // Verify NEAR portfolio
    const nearPortfolio = page.locator('[data-testid="NEAR-token"]').nth(1);
    await expect(nearPortfolio).toBeVisible({ timeout: 10000 });
    await nearPortfolio.click();
    await page.waitForTimeout(500);
    await expect(nearPortfolio.getByText("Staking")).toBeVisible({
      timeout: 5000,
    });
    await nearPortfolio.getByText("Staking").click();
    await expect(nearPortfolio.getByText("Staked")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
    await expect(
      nearPortfolio.getByText("Available for withdrawal 0")
    ).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";
import {
  setupLockupAccount,
  setupLockupMocks,
  deployStakingPool,
} from "../../util/sandbox-lockup-helpers.js";
import {
  StakingScenarios,
  mockStakingScenario,
} from "../../util/staking-mocks.js";

/**
 * Stake Request Tests
 *
 * Comprehensive tests for staking delegation requests including:
 * - Form validation (DAO + Lockup wallets)
 * - DAO Stake: Create → View → Vote
 * - Lockup Stake: Create → View → Vote
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "0";
const TEST_VALIDATOR = "legends.poolv1.near";

// Variables for sandbox integration tests
let sandbox;
let factoryContractId;
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
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/stake-delegation`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Click Create Request button to open dropdown
    const createButton = page.getByRole("button", { name: /Create Request/i });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    await page.waitForTimeout(500);

    // Select "Stake" from dropdown
    const stakeOption = page.getByText("Stake", { exact: true });
    await expect(stakeOption).toBeVisible({ timeout: 5000 });
    await stakeOption.click();
    await page.waitForTimeout(1500);

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
    await page.waitForTimeout(1000);

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

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import and setup SputnikDAO factory
    factoryContractId = await sandbox.importMainnetContract(
      SPUTNIK_DAO_FACTORY_ID,
      SPUTNIK_DAO_FACTORY_ID
    );

    await sandbox.functionCall(
      factoryContractId,
      SPUTNIK_DAO_FACTORY_ID,
      "new",
      {},
      "300000000000000"
    );

    // Create testcreator account with initial balance
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      "3000000000000000000000000000"
    );

    // Deploy staking pool infrastructure (astro-stakers.poolv1.near)
    await deployStakingPool({ sandbox, creatorAccountId });

    // Create testdao using the factory
    const daoName = "testdao";
    const create_testdao_args = {
      name: daoName,
      args: Buffer.from(
        JSON.stringify({
          config: {
            name: daoName,
            purpose: "testing stake delegation",
            metadata: "",
          },
          policy: {
            roles: [
              {
                kind: {
                  Group: [creatorAccountId],
                },
                name: "Create Requests",
                permissions: [
                  "call:AddProposal",
                  "transfer:AddProposal",
                  "config:Finalize",
                ],
                vote_policy: {},
              },
              {
                kind: {
                  Group: [creatorAccountId],
                },
                name: "Manage Members",
                permissions: [
                  "config:*",
                  "policy:*",
                  "add_member_to_role:*",
                  "remove_member_from_role:*",
                ],
                vote_policy: {},
              },
              {
                kind: {
                  Group: [creatorAccountId],
                },
                name: "Vote",
                permissions: ["*:VoteReject", "*:VoteApprove", "*:VoteRemove"],
                vote_policy: {},
              },
            ],
            default_vote_policy: {
              weight_kind: "RoleWeight",
              quorum: "0",
              threshold: [1, 2],
            },
            proposal_bond: PROPOSAL_BOND,
            proposal_period: "604800000000000",
            bounty_bond: "100000000000000000000000",
            bounty_forgiveness_period: "604800000000000",
          },
        })
      ).toString("base64"),
    };

    await sandbox.functionCall(
      creatorAccountId,
      SPUTNIK_DAO_FACTORY_ID,
      "create",
      create_testdao_args,
      "300000000000000",
      await parseNEAR("6")
    );

    daoAccountId = `${daoName}.${SPUTNIK_DAO_FACTORY_ID}`;
    console.log(`✓ Created DAO: ${daoAccountId}`);

    // Fund the DAO with 100 NEAR
    await sandbox.transfer(
      creatorAccountId,
      daoAccountId,
      await parseNEAR("100")
    );
    console.log("✓ Funded DAO with 100 NEAR");

    console.log("\n=== Setup Complete ===\n");
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

    // Inject test wallet before navigation
    await injectTestWallet(page, sandbox, creatorAccountId);
    console.log(`✓ Injected test wallet for: ${creatorAccountId}`);

    // Get sandbox RPC URL
    const sandboxRpcUrl = sandbox.getRpcUrl();

    // Route all mainnet RPC requests to sandbox
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const postData = route.request().postDataJSON();
      const response = await route.fetch({
        url: sandboxRpcUrl,
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        postData: JSON.stringify(postData),
      });
      await route.fulfill({ response });
    });

    await page.route("**/rpc.mainnet.near.org/**", async (route) => {
      const postData = route.request().postDataJSON();
      const response = await route.fetch({
        url: sandboxRpcUrl,
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        postData: JSON.stringify(postData),
      });
      await route.fulfill({ response });
    });

    // Intercept indexer API calls
    await interceptIndexerAPI(page, sandbox);

    // Navigate to stake delegation page
    const url = `http://localhost:3000/${daoAccountId}/stake-delegation`;
    await page.goto(url);
    console.log(`✓ Navigated to: ${url}`);

    // Set localStorage
    await page.evaluate(() => {
      localStorage.setItem("selected-wallet", "test-wallet");
    });

    // Reload to apply localStorage changes
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    console.log("✓ Page loaded with authenticated user");

    // Click Create Request button to open dropdown
    const createRequestButton = page.getByRole("button", {
      name: /Create Request/i,
    });
    await expect(createRequestButton).toBeVisible({ timeout: 10000 });
    await createRequestButton.click();
    await page.waitForTimeout(500);
    console.log("✓ Clicked 'Create Request' button");

    // Select "Stake" from dropdown
    const stakeOption = page.getByText("Stake", { exact: true });
    await expect(stakeOption).toBeVisible({ timeout: 5000 });
    await stakeOption.click();
    await page.waitForTimeout(1500);
    console.log("✓ Selected 'Stake' from dropdown");

    // Wait for form to open
    const canvasLocator = page.locator(".offcanvas-body");
    await page.waitForTimeout(1000);

    // Select validator
    const validatorDropdown = canvasLocator.locator(
      '[data-testid="validator-dropdown"]'
    );
    await validatorDropdown.click();
    await page.waitForTimeout(1000);

    // Click on modal and select astro-stakers validator
    const modal = page.locator(".modal-content");
    await modal.waitFor({ state: "visible", timeout: 5000 });

    const astroValidator = modal
      .getByTestId("validator-option")
      .filter({ hasText: "astro-stakers.poolv1.near" });
    await astroValidator.click();

    // Close modal
    await modal.waitFor({ state: "hidden", timeout: 5000 });

    // Verify validator is selected
    await expect(validatorDropdown).toContainText("astro-stakers.poolv1.near");
    console.log("✓ Selected astro-stakers.poolv1.near validator");

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

    const closeButton = page.locator(".bi.bi-x-lg");
    await closeButton.click();
    await page.waitForTimeout(1000);

    // Verify proposal appears in table
    await expect(page.getByText("Test DAO stake request")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Proposal appears in table");

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
    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();
    console.log("✓ Clicked Approve button");

    await page.waitForTimeout(2000);
    const voteConfirmButton = page.getByRole("button", { name: "Confirm" });
    await voteConfirmButton.click();
    console.log("✓ Confirmed vote");

    // Check for success message
    await expect(
      page.getByText("The request has been successfully approved.")
    ).toBeVisible({
      timeout: 30000,
    });
    console.log("✓ Stake request executed successfully");

    // Open create request form to check balances
    await page.getByRole("button", { name: "" }).click();
    await page.waitForTimeout(500);

    await page
      .locator("a")
      .filter({ hasText: /^Stake$/ })
      .click();
    const balanceCanvas = page.locator(".offcanvas-body");
    await balanceCanvas.waitFor({ state: "visible", timeout: 5000 });

    // Check the BalanceDisplay component shows 10 NEAR staked
    const balanceDisplay = balanceCanvas.locator(
      '[data-testid="balance-display"]'
    );
    await expect(balanceDisplay).toBeVisible({ timeout: 10000 });

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

    // Inject test wallet before navigation
    await injectTestWallet(page, sandbox, creatorAccountId);
    console.log(`✓ Injected test wallet for: ${creatorAccountId}`);

    // Get sandbox RPC URL
    const sandboxRpcUrl = sandbox.getRpcUrl();

    // Route RPC requests to sandbox
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const postData = route.request().postDataJSON();
      const response = await route.fetch({
        url: sandboxRpcUrl,
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        postData: JSON.stringify(postData),
      });
      await route.fulfill({ response });
    });

    // Intercept indexer API calls
    await interceptIndexerAPI(page, sandbox);

    // Navigate to stake delegation page
    const url = `http://localhost:3000/${daoAccountId}/stake-delegation`;
    await page.goto(url);
    console.log(`✓ Navigated to: ${url}`);

    // Set localStorage
    await page.evaluate(() => {
      localStorage.setItem("selected-wallet", "test-wallet");
    });

    // Reload to apply localStorage changes
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    console.log("✓ Page loaded with authenticated user");

    // Click Create Request button to open dropdown
    const createRequestButton = page.getByRole("button", {
      name: /Create Request/i,
    });
    await expect(createRequestButton).toBeVisible({ timeout: 10000 });
    await createRequestButton.click();
    await page.waitForTimeout(500);
    console.log("✓ Clicked 'Create Request' button");

    // Select "Stake" from dropdown
    const stakeOption = page.getByText("Stake", { exact: true });
    await expect(stakeOption).toBeVisible({ timeout: 5000 });
    await stakeOption.click();
    await page.waitForTimeout(1500);
    console.log("✓ Selected 'Stake' from dropdown");

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
    await walletDropdown.click();
    await page.waitForTimeout(500);

    const lockupOption = page.getByText("Lockup");
    await expect(lockupOption).toBeVisible({ timeout: 5000 });
    await lockupOption.click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected Lockup wallet");

    // Select validator
    const validatorDropdown = canvasLocator.locator(
      '[data-testid="validator-dropdown"]'
    );
    await validatorDropdown.click();
    await page.waitForTimeout(1000);

    // Click on modal and select astro-stakers validator
    const modal = page.locator(".modal-content");
    await modal.waitFor({ state: "visible", timeout: 5000 });

    const astroValidator = modal
      .getByTestId("validator-option")
      .filter({ hasText: "astro-stakers.poolv1.near" });
    await astroValidator.click();

    // Close modal
    await modal.waitFor({ state: "hidden", timeout: 5000 });

    // Verify validator is selected
    await expect(validatorDropdown).toContainText("astro-stakers.poolv1.near");
    console.log("✓ Selected astro-stakers.poolv1.near validator");

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
    const closeButton = page.locator(".bi-x-lg");
    await closeButton.click();
    await page.waitForTimeout(1000);

    // Verify whitelist proposal appears in table
    await expect(
      page.getByText(
        "Approve to designate this validator with this lockup account. Lockup accounts can only have one validator"
      )
    ).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Whitelist proposal appears in table");

    // Click on the proposal to view details
    await page
      .getByText(
        "Approve to designate this validator with this lockup account. Lockup accounts can only have one validator"
      )
      .click();
    await page.waitForTimeout(2000);

    const whitelistApproveButton = page
      .getByRole("button", { name: "Approve" })
      .first();
    await expect(whitelistApproveButton).toBeVisible();
    await whitelistApproveButton.click();
    console.log("✓ Clicked Approve button");
    await page.waitForTimeout(2000);
    const whitelistVoteConfirmButton = page.getByRole("button", {
      name: "Confirm",
    });
    await whitelistVoteConfirmButton.click();
    console.log("✓ Confirmed vote");
    await page.waitForTimeout(2000);
    await expect(
      page.getByText("The request has been successfully approved.")
    ).toBeVisible({
      timeout: 30000,
    });
    console.log("✓ Whitelist request executed successfully");

    await expect(page.getByText("Test lockup stake request")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Lockup stake request appears in table");
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
    const stakeApproveButton = page
      .getByRole("button", { name: "Approve" })
      .first();
    await expect(stakeApproveButton).toBeVisible();
    await stakeApproveButton.click();
    console.log("✓ Clicked Approve button");
    await page.waitForTimeout(1000);
    const stakeVoteConfirmButton = page.getByRole("button", {
      name: "Confirm",
    });
    await stakeVoteConfirmButton.click();
    console.log("✓ Confirmed vote");
    await page.waitForTimeout(2000);
    await expect(
      page.getByText("The request has been successfully approved.")
    ).toBeVisible({
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // Open create request form to check balances
    await page.getByRole("button", { name: "" }).click();
    await page.waitForTimeout(500);
    await page
      .locator("a")
      .filter({ hasText: /^Stake$/ })
      .click();
    await page.locator('[data-testid="wallet-dropdown"]').click();
    await page.getByTestId("wallet-dropdown").getByText("Lockup").click();

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

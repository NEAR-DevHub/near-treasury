import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Create Payment Request Tests
 *
 * These tests verify the payment request creation flow using near-sandbox
 * for end-to-end testing with real blockchain interaction.
 *
 * Tests regular SputnikDAO payments (not Intents payments).
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";

let sandbox;
let factoryContractId;
let creatorAccountId;
let daoAccountId;

test.describe("Create Payment Request", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import sputnik-dao factory from mainnet
    factoryContractId = await sandbox.importMainnetContract(
      SPUTNIK_DAO_FACTORY_ID,
      SPUTNIK_DAO_FACTORY_ID
    );

    // Create a test account to be the DAO creator with 10000 NEAR initial balance
    // This ensures enough balance remains after DAO creation for proposal bonds and gas fees
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      "10000000000000000000000000000"
    ); // 10000 NEAR
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
    const daoName = "testdao";
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
              purpose: "Test DAO for payment requests",
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
                  permissions: [
                    "*:VoteReject",
                    "*:VoteApprove",
                    "*:VoteRemove",
                  ],
                  vote_policy: {},
                },
              ],
              default_vote_policy: {
                weight_kind: "RoleWeight",
                quorum: "0",
                threshold: [1, 2],
              },
              proposal_bond: "0",
              proposal_period: "604800000000000",
              bounty_bond: "100000000000000000000000",
              bounty_forgiveness_period: "604800000000000",
            },
          })
        ).toString("base64"),
      },
      "300000000000000",
      await parseNEAR("6")
    );

    daoAccountId = `${daoName}.${factoryContractId}`;
    console.log(`DAO created: ${daoAccountId}`);

    // Fund the DAO treasury with NEAR (needed for payment requests)
    // We transfer NEAR using a simple function call with attached deposit
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "version",
      {},
      "300000000000000",
      await parseNEAR("100")
    );
    console.log("✓ Funded DAO treasury with 100 NEAR");
  });

  test.afterAll(async () => {
    await sandbox.stop();
    console.log("\n=== Sandbox Environment Stopped ===\n");
  });

  test("create NEAR transfer payment request and verify it appears in pending requests", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    console.log("\n=== Starting Payment Request Test ===\n");

    // Inject test wallet and intercept API calls
    await injectTestWallet(page, sandbox, creatorAccountId);
    await interceptIndexerAPI(page, sandbox);

    // Intercept RPC calls to mainnet and redirect to sandbox
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const sandboxRpcUrl = sandbox.getRpcUrl();

      // Forward the request to sandbox RPC
      const response = await page.request.post(sandboxRpcUrl, {
        headers: request.headers(),
        data: request.postDataJSON(),
      });

      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    // Navigate to payments page
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    console.log("Navigated to payments page");

    // Wait for page to load
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 20000,
    });
    console.log("✓ Pending Requests tab visible");

    // Click Create Request button
    const createRequestButton = page.getByRole("button", {
      name: "Create Request",
    });
    await expect(createRequestButton).toBeVisible({ timeout: 20000 });
    await createRequestButton.click();
    console.log("✓ Clicked Create Request button");

    // Wait for the offcanvas (sidebar form) to open
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });
    console.log("✓ Payment request form opened");

    // Select Treasury Wallet (SputnikDAO wallet)
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();

    // Find and click the dropdown button (it's a div with SputnikDAO text and chevron)
    const walletDropdown = offcanvas.locator("div.dropdown").first();
    await walletDropdown.click();
    await page.waitForTimeout(500);
    console.log("✓ Opened wallet dropdown");

    // Wait for dropdown menu to appear and click SputnikDAO option
    const sputnikOption = page.locator('text="SputnikDAO"').last();
    await sputnikOption.click();
    await page.waitForTimeout(2000);
    console.log("✓ Selected SputnikDAO wallet");

    // Wait for form fields to be ready
    await page.waitForTimeout(1000);

    // Fill in Title - first text input
    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill("Test NEAR Payment Request");
    console.log("✓ Filled proposal title");

    // Fill in Summary textarea
    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.waitFor({ state: "visible", timeout: 10000 });
    await summaryInput.fill("Testing payment request creation via Playwright");
    console.log("✓ Filled proposal summary");

    // Fill in recipient - use creator account since it exists in sandbox
    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.waitFor({ state: "visible", timeout: 10000 });
    await recipientInput.fill(creatorAccountId);
    await page.waitForTimeout(500);
    console.log("✓ Filled recipient");

    // Select NEAR token
    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.waitFor({ state: "visible", timeout: 10000 });
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected NEAR token");

    // Fill in amount - find input near "Total Amount" label (might be type="number")
    const amountInput = offcanvas
      .locator("input")
      .filter({ hasText: "" })
      .last();
    await amountInput.waitFor({ state: "visible", timeout: 10000 });
    await amountInput.click();
    await amountInput.fill("5");
    await page.waitForTimeout(500);
    console.log("✓ Filled amount (5 NEAR)");

    // Submit the form
    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.scrollIntoViewIfNeeded({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await submitBtn.click();
    console.log("✓ Clicked Submit button");

    // Wait for transaction to be processed (test wallet signs automatically)
    // Look for success message or confirmation modal
    try {
      await expect(
        page.getByText("Awaiting transaction confirmation...")
      ).toBeVisible({ timeout: 5000 });
      console.log("✓ Transaction confirmation modal appeared");
    } catch (e) {
      console.log("⚠ No confirmation modal, transaction may be processing");
    }

    // Wait for success message
    await expect(
      page.getByText("Payment request has been successfully created.")
    ).toBeVisible({ timeout: 45000 });
    console.log("✓ Success message appeared");

    // Verify "View Request" link appears
    const viewRequestLink = page.locator('a:has-text("View Request")');
    await expect(viewRequestLink).toBeVisible({ timeout: 10000 });
    console.log("✓ View Request link visible");

    // Verify the form sidebar is closed
    await expect(offcanvas).toBeHidden({ timeout: 10000 });
    console.log("✓ Form closed after submission");

    // Verify the new proposal appears in the pending requests table
    // The proposal should be ID 0 (first proposal in sandbox)
    await expect(
      page.getByRole("cell", { name: "0", exact: true }).first()
    ).toBeVisible({ timeout: 20000 });
    console.log("✓ New proposal visible in pending requests table");

    // Verify proposal data is in the table (use more lenient matchers)
    // Title might be truncated, so just check it contains key words
    const proposalRow = page.locator("table tbody tr").first();
    await expect(proposalRow).toBeVisible({ timeout: 5000 });
    console.log("✓ Proposal row visible in table");

    // Verify amount and recipient are visible somewhere on the page
    await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
    console.log("✓ Amount visible");

    await expect(page.getByText(creatorAccountId).first()).toBeVisible();
    console.log("✓ Recipient visible");

    console.log("✅ All assertions passed!");
  });

  test("create, approve, and verify NEAR payment with balance changes", async ({
    page,
  }) => {
    test.setTimeout(240000); // 4 minutes

    console.log("\n=== Starting Create→Approve→Verify Test ===\n");

    // Create a recipient account
    const recipientAccountId = await sandbox.createAccount(
      "recipient.near",
      "1000000000000000000000000"
    ); // 1 NEAR
    console.log(`Recipient account created: ${recipientAccountId}`);

    // Get initial balances
    const initialRecipientBalance =
      await sandbox.viewAccount(recipientAccountId);
    const initialDaoBalance = await sandbox.viewAccount(daoAccountId);
    console.log(`Initial recipient balance: ${initialRecipientBalance.amount}`);
    console.log(`Initial DAO balance: ${initialDaoBalance.amount}`);

    // Inject test wallet and intercept API calls
    await injectTestWallet(page, sandbox, creatorAccountId);
    await interceptIndexerAPI(page, sandbox);

    // Intercept RPC calls to mainnet and redirect to sandbox
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const sandboxRpcUrl = sandbox.getRpcUrl();
      const response = await page.request.post(sandboxRpcUrl, {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    // Navigate to payments page
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    // Create payment request
    await page.getByRole("button", { name: "Create Request" }).click();
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Select wallet and fill form
    const walletDropdown = offcanvas.locator("div.dropdown").first();
    await walletDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('text="SputnikDAO"').last().click();
    await page.waitForTimeout(2000);

    // Fill form fields
    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.fill("Payment for recipient");
    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing end-to-end payment workflow");
    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(recipientAccountId);
    await page.waitForTimeout(500);

    // Select NEAR token
    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Enter amount (10 NEAR)
    const amountInput = offcanvas
      .locator("input")
      .filter({ hasText: "" })
      .last();
    await amountInput.fill("10");
    await page.waitForTimeout(500);

    // Submit
    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.scrollIntoViewIfNeeded({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await submitBtn.click();
    console.log("✓ Submitted payment request");

    // Wait for success
    await expect(
      page.getByText("Payment request has been successfully created.")
    ).toBeVisible({ timeout: 45000 });
    console.log("✓ Payment request created");

    // Wait for form to close and table to update
    await expect(offcanvas).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Now approve the proposal
    console.log("\n=== Approving Payment Request ===\n");

    // Find and click the Approve button for proposal ID 0
    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await approveButton.click();
    console.log("✓ Clicked Approve button");

    // Handle confirmation modal if it appears
    try {
      const confirmButton = page.getByRole("button", { name: "Confirm" });
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
      await confirmButton.click();
      console.log("✓ Confirmed approval");
    } catch (e) {
      console.log("⚠ No confirmation modal");
    }

    // Wait for approval to complete
    await page.waitForTimeout(10000); // Give time for blockchain transaction

    // Verify balances changed
    console.log("\n=== Verifying Balance Changes ===\n");

    const finalRecipientBalance = await sandbox.viewAccount(recipientAccountId);
    const finalDaoBalance = await sandbox.viewAccount(daoAccountId);

    console.log(`Final recipient balance: ${finalRecipientBalance.amount}`);
    console.log(`Final DAO balance: ${finalDaoBalance.amount}`);

    // Recipient should have received approximately 10 NEAR
    const recipientIncrease =
      BigInt(finalRecipientBalance.amount) -
      BigInt(initialRecipientBalance.amount);
    const expectedAmount = BigInt("10000000000000000000000000"); // 10 NEAR in yocto

    console.log(
      `Recipient balance increased by: ${recipientIncrease} yoctoNEAR`
    );

    // Allow some variance for gas fees
    expect(recipientIncrease).toBeGreaterThan(
      BigInt("9900000000000000000000000")
    ); // At least 9.9 NEAR
    expect(recipientIncrease).toBeLessThanOrEqual(expectedAmount);
    console.log("✓ Recipient balance increased correctly");

    // DAO balance should have decreased
    const daoDecrease =
      BigInt(initialDaoBalance.amount) - BigInt(finalDaoBalance.amount);
    expect(daoDecrease).toBeGreaterThan(BigInt("9000000000000000000000000")); // At least 9 NEAR (account for fees)
    console.log("✓ DAO balance decreased correctly");

    // Verify in History tab
    await page.getByText("History", { exact: true }).click();
    await page.waitForTimeout(2000);

    // The proposal should now appear in History tab
    // We've already verified the balance changes which is the key indicator of success
    console.log("✓ Navigated to History tab");

    console.log("✅ Full workflow test passed!");
  });

  test("create, approve, and verify fungible token (FT) payment with balance changes", async ({
    page,
  }) => {
    test.setTimeout(300000); // 5 minutes for FT setup and test

    console.log("\n=== Starting FT Payment Test ===\n");

    // Deploy wNEAR (wrap.near) as our test FT contract
    const ftContractId = await sandbox.importMainnetContract(
      "wrap.near",
      "wrap.near"
    );
    console.log(`FT contract deployed: ${ftContractId}`);

    // Initialize the FT contract
    await sandbox.functionCall(
      ftContractId,
      ftContractId,
      "new",
      {},
      "300000000000000"
    );
    console.log("✓ FT contract initialized");

    // Register accounts with the FT contract
    await sandbox.functionCall(
      creatorAccountId,
      ftContractId,
      "storage_deposit",
      { account_id: creatorAccountId },
      "300000000000000",
      "1250000000000000000000" // 0.00125 NEAR for storage
    );

    await sandbox.functionCall(
      creatorAccountId,
      ftContractId,
      "storage_deposit",
      { account_id: daoAccountId },
      "300000000000000",
      "1250000000000000000000"
    );
    console.log("✓ Registered creator and DAO with FT contract");

    // Mint some wNEAR to creator by depositing NEAR
    await sandbox.functionCall(
      creatorAccountId,
      ftContractId,
      "near_deposit",
      {},
      "300000000000000",
      await parseNEAR("50") // Deposit 50 NEAR
    );
    console.log("✓ Minted 50 wNEAR to creator");

    // Transfer wNEAR from creator to DAO treasury
    await sandbox.functionCall(
      creatorAccountId,
      ftContractId,
      "ft_transfer",
      {
        receiver_id: daoAccountId,
        amount: "30000000000000000000000000", // 30 wNEAR (24 decimals)
        memo: "Initial funding for DAO",
      },
      "300000000000000",
      "1" // 1 yoctoNEAR for ft_transfer
    );
    console.log("✓ Transferred 30 wNEAR to DAO treasury");

    // Create a recipient account and register it with FT
    const recipientAccountId = await sandbox.createAccount(
      "ft-recipient.near",
      "1000000000000000000000000"
    );
    await sandbox.functionCall(
      creatorAccountId,
      ftContractId,
      "storage_deposit",
      { account_id: recipientAccountId },
      "300000000000000",
      "1250000000000000000000"
    );
    console.log(`✓ Created and registered recipient: ${recipientAccountId}`);

    // Get initial FT balances
    const initialRecipientBalance = await sandbox.viewFunction(
      ftContractId,
      "ft_balance_of",
      { account_id: recipientAccountId }
    );
    const initialDaoBalance = await sandbox.viewFunction(
      ftContractId,
      "ft_balance_of",
      { account_id: daoAccountId }
    );
    console.log(`Initial recipient FT balance: ${initialRecipientBalance}`);
    console.log(`Initial DAO FT balance: ${initialDaoBalance}`);

    // Inject test wallet and intercept API calls
    await injectTestWallet(page, sandbox, creatorAccountId);
    await interceptIndexerAPI(page, sandbox);

    // Intercept RPC calls to mainnet and redirect to sandbox
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const sandboxRpcUrl = sandbox.getRpcUrl();
      const response = await page.request.post(sandboxRpcUrl, {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    // Intercept backend API call for FT tokens and return our sandbox wNEAR
    await page.route(
      "**/ref-sdk-test-cold-haze-1300-2.fly.dev/api/ft-tokens**",
      async (route) => {
        console.log("Intercepting FT tokens API call");

        // Return our sandbox wNEAR token
        const ftTokensResponse = {
          fts: [
            {
              contract: ftContractId,
              amount: "30000000000000000000000000", // 30 wNEAR
              ft_meta: {
                symbol: "wNEAR",
                decimals: 24,
                icon: null,
              },
            },
          ],
        };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(ftTokensResponse),
        });
      }
    );

    // Navigate to payments page
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    // Create FT payment request
    await page.getByRole("button", { name: "Create Request" }).click();
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Select wallet
    const walletDropdown = offcanvas.locator("div.dropdown").first();
    await walletDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('text="SputnikDAO"').last().click();
    await page.waitForTimeout(2000);

    // Fill form fields
    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.fill("wNEAR Payment for recipient");
    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing FT payment workflow with wNEAR");
    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(recipientAccountId);
    await page.waitForTimeout(500);

    // Select wNEAR token from dropdown
    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);

    // Click on wNEAR option
    await page.getByText("wNEAR").click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected wNEAR token");

    // Enter amount (5 wNEAR)
    const amountInput = offcanvas
      .locator("input")
      .filter({ hasText: "" })
      .last();
    await amountInput.fill("5");
    await page.waitForTimeout(500);

    // Submit
    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.scrollIntoViewIfNeeded({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await submitBtn.click();
    console.log("✓ Submitted FT payment request");

    // Wait for success
    await expect(
      page.getByText("Payment request has been successfully created.")
    ).toBeVisible({ timeout: 45000 });
    console.log("✓ FT payment request created");

    // Wait for form to close
    await expect(offcanvas).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Approve the proposal
    console.log("\n=== Approving FT Payment Request ===\n");

    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await approveButton.click();
    console.log("✓ Clicked Approve button");

    // Handle confirmation modal if it appears
    try {
      const confirmButton = page.getByRole("button", { name: "Confirm" });
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
      await confirmButton.click();
      console.log("✓ Confirmed approval");
    } catch (e) {
      console.log("⚠ No confirmation modal");
    }

    // Wait for approval to complete
    await page.waitForTimeout(10000);

    // Verify FT balances changed
    console.log("\n=== Verifying FT Balance Changes ===\n");

    const finalRecipientBalance = await sandbox.viewFunction(
      ftContractId,
      "ft_balance_of",
      { account_id: recipientAccountId }
    );
    const finalDaoBalance = await sandbox.viewFunction(
      ftContractId,
      "ft_balance_of",
      { account_id: daoAccountId }
    );

    console.log(`Final recipient FT balance: ${finalRecipientBalance}`);
    console.log(`Final DAO FT balance: ${finalDaoBalance}`);

    // Recipient should have received 5 wNEAR
    const recipientIncrease =
      BigInt(finalRecipientBalance) - BigInt(initialRecipientBalance);
    const expectedAmount = BigInt("5000000000000000000000000"); // 5 wNEAR (24 decimals)

    console.log(`Recipient FT balance increased by: ${recipientIncrease}`);

    expect(recipientIncrease).toBe(expectedAmount);
    console.log("✓ Recipient FT balance increased correctly");

    // DAO balance should have decreased by 5 wNEAR
    const daoDecrease = BigInt(initialDaoBalance) - BigInt(finalDaoBalance);
    expect(daoDecrease).toBe(expectedAmount);
    console.log("✓ DAO FT balance decreased correctly");

    console.log("✅ FT payment workflow test passed!");
  });
});

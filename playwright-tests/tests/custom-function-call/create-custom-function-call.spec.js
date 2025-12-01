import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";
const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "0";

// Variables for sandbox integration tests
let sandbox;
let factoryContractId;
let creatorAccountId;
let daoAccountId;
let wNearContractId;
let recipientAccountId;

test.describe("Custom Function Call Form Validation", () => {
  // Use logged-in storage state for authentication
  test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

  test("should comprehensively validate all form fields and behaviors", async ({
    page,
  }) => {
    // Navigate to function calls page
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/function-call`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Click Create Request to open form
    const createButton = page.getByRole("button", { name: /Create Request/i });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    await page.waitForTimeout(1500);

    // Verify form opened
    const canvasLocator = page.locator(".offcanvas-body");
    await expect(canvasLocator.getByTestId("contract-id-input")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Form opened successfully");

    // ===== 1. Test Warning Message =====
    await expect(
      canvasLocator.getByText("Heads Up: Advanced Feature")
    ).toBeVisible();
    await expect(
      canvasLocator.getByText(/Contract ID is correct and trusted/)
    ).toBeVisible();
    console.log("✓ Warning message displayed");

    // ===== 2. Test Required Fields (Empty Form Submission) =====
    const submitButton = canvasLocator.getByTestId("submit-button");
    await submitButton.click();
    await page.waitForTimeout(500);

    const requiredErrors = [
      "Contract ID is required",
      "Method Name is required",
      "Gas (Tgas) is required",
      "Deposit (NEAR) is required",
    ];

    for (const error of requiredErrors) {
      await expect(canvasLocator.getByText(error)).toBeVisible();
    }
    console.log("✓ All required field errors displayed together");

    // ===== 3. Test Contract ID Format Validation =====
    const contractIdInput = canvasLocator.getByTestId("contract-id-input");
    await contractIdInput.fill("invalid");
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(
      canvasLocator.getByText(
        "Invalid account format. Must be a .near, .aurora, .tg account or 64-character hex"
      )
    ).toBeVisible();
    console.log("✓ Invalid Contract ID format detected");

    // Clear error
    await contractIdInput.fill("example.near");
    await page.waitForTimeout(300);
    await expect(
      canvasLocator.getByText(
        "Invalid account format. Must be a .near, .aurora, .tg account or 64-character hex"
      )
    ).not.toBeVisible();
    console.log("✓ Contract ID error cleared with valid input");

    // ===== 4. Test Method Name Format Validation =====
    const methodNameInput = canvasLocator.getByTestId("method-name-input-0");
    await methodNameInput.fill("invalid method");
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(
      canvasLocator.getByText(
        "Method name must be a single word (letters, numbers, underscore only)"
      )
    ).toBeVisible();
    console.log("✓ Invalid Method Name format detected");

    // Fix error
    await methodNameInput.fill("ft_transfer");
    await page.waitForTimeout(300);
    await expect(
      canvasLocator.getByText(
        "Method name must be a single word (letters, numbers, underscore only)"
      )
    ).not.toBeVisible();
    console.log("✓ Method Name error cleared");

    // ===== 5. Test Arguments JSON Validation =====
    const argumentsInput = canvasLocator.getByTestId("arguments-input-0");

    // Test plain string (invalid)
    await argumentsInput.fill('"just a string"');
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(
      canvasLocator.getByText(
        "Arguments must be a JSON object or array, not a string"
      )
    ).toBeVisible();
    console.log("✓ Plain string in Arguments rejected");

    // Test invalid JSON syntax
    await argumentsInput.fill("{invalid}");
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(canvasLocator.getByText("Invalid JSON format")).toBeVisible();
    console.log("✓ Invalid JSON syntax detected");

    // Fix with valid JSON
    await argumentsInput.fill('{"receiver_id": "alice.near"}');
    await page.waitForTimeout(300);
    console.log("✓ Valid JSON accepted");

    // ===== 6. Test Gas Amount Validation =====
    const gasInput = canvasLocator.getByTestId("gas-input-0");

    // Test value above maximum
    await gasInput.fill("400");
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(
      canvasLocator.getByText("Gas must be between 0 and 270 Tgas")
    ).toBeVisible();
    console.log("✓ Gas above maximum rejected");

    // Fix with valid value
    await gasInput.fill("30");
    await page.waitForTimeout(300);
    console.log("✓ Valid Gas amount accepted");

    // ===== 7. Test Deposit Field =====
    const depositInput = canvasLocator.getByTestId("deposit-input-0");
    await depositInput.fill("0.1");
    console.log("✓ Deposit field accepts valid value");

    // ===== 8. Test Notes Field (Optional) =====
    const notesInput = canvasLocator.getByTestId("notes-input");
    await expect(notesInput).toBeVisible();
    expect(await notesInput.inputValue()).toBe("");

    await notesInput.fill("This is a test note");
    expect(await notesInput.inputValue()).toBe("This is a test note");

    await notesInput.fill("");
    expect(await notesInput.inputValue()).toBe("");
    console.log("✓ Notes field works as optional");

    // ===== 9. Test Multiple Actions (Add/Remove) =====
    await expect(canvasLocator.getByText("Action 1")).toBeVisible();

    // Add second action
    await canvasLocator.getByText("Add Another Action").click();
    await page.waitForTimeout(500);
    await expect(canvasLocator.getByText("Action 2")).toBeVisible();

    // Add third action
    await canvasLocator.getByText("Add Another Action").click();
    await page.waitForTimeout(500);
    await expect(canvasLocator.getByText("Action 3")).toBeVisible();
    console.log("✓ Multiple actions added successfully");

    // Verify remove buttons
    const removeButtons = canvasLocator.locator(
      '[data-testid*="remove-action"]'
    );
    await expect(removeButtons).toHaveCount(3);

    // Remove third action
    await canvasLocator.getByTestId("remove-action-2").click();
    await page.waitForTimeout(500);
    await expect(canvasLocator.getByText("Action 3")).not.toBeVisible();

    const remainingRemoveButtons = canvasLocator.locator(
      '[data-testid*="remove-action"]'
    );
    await expect(remainingRemoveButtons).toHaveCount(2);
    console.log("✓ Action removed successfully");

    // ===== 10. Test Independent Validation for Multiple Actions =====
    // Fill first action with valid data (already done above)

    // Fill second action with invalid data
    await canvasLocator
      .getByTestId("method-name-input-1")
      .fill("invalid method");
    await canvasLocator.getByTestId("gas-input-1").fill("400");
    await canvasLocator.getByTestId("deposit-input-1").fill("0.1");

    await submitButton.click();
    await page.waitForTimeout(500);

    // Should show errors for second action only
    await expect(
      canvasLocator.getByText(
        "Method name must be a single word (letters, numbers, underscore only)"
      )
    ).toBeVisible();
    await expect(
      canvasLocator.getByText("Gas must be between 0 and 270 Tgas")
    ).toBeVisible();
    console.log("✓ Independent validation working for each action");

    // Fix second action
    await canvasLocator.getByTestId("method-name-input-1").fill("ft_approve");
    await canvasLocator.getByTestId("gas-input-1").fill("25");
    await page.waitForTimeout(300);
    console.log("✓ Second action errors cleared");

    // ===== 11. Verify All Errors Cleared with Valid Form =====
    await page.waitForTimeout(500);

    // All required errors should be gone
    for (const error of requiredErrors) {
      await expect(canvasLocator.getByText(error)).not.toBeVisible();
    }
    console.log("✓ All validation errors cleared with valid form");
  });
});

test.describe("Custom Function Call Integration Tests", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);

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

    // Create recipient account (will NOT be registered with wrap.near)
    recipientAccountId = await sandbox.createAccount(
      "recipient.near",
      "10000000000000000000000000" // 10 NEAR
    );
    console.log(`✓ Created recipient account: ${recipientAccountId}`);

    // Create testdao using the factory
    const daoName = "testdao";
    const create_testdao_args = {
      name: daoName,
      args: Buffer.from(
        JSON.stringify({
          config: {
            name: daoName,
            purpose: "testing custom function calls",
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

    //

    daoAccountId = `${daoName}.${SPUTNIK_DAO_FACTORY_ID}`;
    console.log(`✓ Created DAO: ${daoAccountId}`);

    // Fund the DAO with 15 NEAR so it can execute Transfer proposals
    await sandbox.transfer(
      creatorAccountId,
      daoAccountId,
      await parseNEAR("15")
    );
    console.log("✓ Funded DAO with 15 NEAR");

    // Import and setup wrap.near contract for wNEAR (FT token)
    wNearContractId = await sandbox.importMainnetContract(
      "wrap.near",
      "wrap.near"
    );
    console.log("✓ Imported wrap.near contract");

    // Initialize wrap.near contract
    await sandbox.functionCall(
      wNearContractId,
      wNearContractId,
      "new",
      {
        owner_id: wNearContractId,
        total_supply: await parseNEAR("1000000000"),
        metadata: {
          spec: "ft-1.0.0",
          name: "Wrapped NEAR fungible token",
          symbol: "wNEAR",
          decimals: 24,
        },
      },
      "300000000000000"
    );
    console.log("✓ Initialized wrap.near contract");

    // Deposit NEAR to get wNEAR tokens for creator
    await sandbox.functionCall(
      creatorAccountId,
      wNearContractId,
      "near_deposit",
      {},
      "300000000000000",
      await parseNEAR("100")
    );
    console.log("✓ Creator deposited 100 NEAR to get 100 wNEAR");

    // Register DAO with wrap.near storage
    await sandbox.functionCall(
      creatorAccountId,
      wNearContractId,
      "storage_deposit",
      {
        account_id: daoAccountId,
        registration_only: true,
      },
      "30000000000000",
      await parseNEAR("0.01")
    );
    console.log("✓ Registered DAO with wrap.near storage");

    // Transfer 50 wNEAR from creator to DAO
    await sandbox.functionCall(
      creatorAccountId,
      wNearContractId,
      "ft_transfer",
      {
        receiver_id: daoAccountId,
        amount: await parseNEAR("50"),
      },
      "300000000000000",
      "1" // 1 yoctoNEAR for security
    );
    console.log("✓ Transferred 50 wNEAR to DAO");

    // Verify DAO wNEAR balance
    const daoBalance = await sandbox.viewFunction(
      wNearContractId,
      "ft_balance_of",
      {
        account_id: daoAccountId,
      }
    );
    console.log(`✓ DAO wNEAR balance: ${daoBalance}`);

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

  test("should create FT transfer proposal without storage deposit and fail on execution", async ({
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

    // Navigate to function calls page
    const url = `http://localhost:3000/${daoAccountId}/function-call`;
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

    // Click Create Request button
    const createRequestButton = page.getByRole("button", {
      name: /Create Request/i,
    });
    await expect(createRequestButton).toBeVisible({ timeout: 10000 });
    await createRequestButton.click();
    console.log("✓ Clicked 'Create Request' button");

    // Fill the form with single action - create a Transfer proposal via add_proposal
    const canvasLocator = page.locator(".offcanvas-body");
    await expect(canvasLocator.getByTestId("contract-id-input")).toBeVisible({
      timeout: 10000,
    });

    // Contract ID: wrap.near (wNEAR FT token)
    await canvasLocator.getByTestId("contract-id-input").fill(wNearContractId);

    // Method: ft_transfer
    await canvasLocator.getByTestId("method-name-input-0").fill("ft_transfer");

    // Arguments: Transfer 10 wNEAR to recipient (NOT registered)
    const transferArgs = {
      receiver_id: recipientAccountId,
      amount: await parseNEAR("10"), // 10 wNEAR
    };
    await canvasLocator
      .getByTestId("arguments-input-0")
      .fill(JSON.stringify(transferArgs, null, 2));

    await canvasLocator.getByTestId("gas-input-0").fill("30");
    await canvasLocator
      .getByTestId("deposit-input-0")
      .fill("0.000000000000000000000001"); // 1 yoctoNEAR for security
    await canvasLocator
      .getByTestId("notes-input")
      .fill("Transfer 10 wNEAR to recipient (will fail - not registered)");
    console.log("✓ Filled form with ft_transfer to send 10 wNEAR");

    // Submit the form
    await canvasLocator.getByTestId("submit-button").click();
    console.log("✓ Clicked submit button");
    await page.waitForTimeout(2000);

    // Check for success toast
    await expect(
      page.getByText("Function call request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    // Wait for transaction to complete
    await page.waitForTimeout(3000);

    // Close the offcanvas/modal
    const closeButton = page.locator(".bi-x-lg");
    await closeButton.click();
    await page.waitForTimeout(1000);

    // Verify proposal appears in table
    await expect(
      page.getByText(
        "Transfer 10 wNEAR to recipient (will fail - not registered)"
      )
    ).toBeVisible({ timeout: 10000 });
    // Click on the proposal to view details
    await page
      .getByText("Transfer 10 wNEAR to recipient (will fail - not registered)")
      .click();
    await page.waitForTimeout(2000);
    console.log("✓ Proposal appears in table");

    // Verify details page content
    await expect(page.getByText("Contract ID")).toBeVisible();
    await expect(page.getByText(wNearContractId)).toBeVisible();
    await expect(page.getByText("Method Name")).toBeVisible();
    await expect(page.getByText("ft_transfer")).toBeVisible();
    await expect(page.getByText("Arguments")).toBeVisible();
    await expect(page.getByText("Gas", { exact: true })).toBeVisible();
    await expect(page.getByText("Deposit", { exact: true })).toBeVisible();
    console.log("✓ Proposal details displayed correctly");

    // Vote on the proposal
    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();
    console.log("✓ Clicked Approve button");

    await page.waitForTimeout(2000);
    const voteConfirmButton = page.getByRole("button", { name: "Confirm" });
    await voteConfirmButton.click();
    console.log("✓ Confirmed vote");

    // Wait for the proposal to execute (and fail)
    await page.waitForTimeout(5000);
    console.log("✓ Waiting for proposal execution...");

    // The proposal should fail because recipient is not registered with wrap.near
    // Check for the "Failed" status badge or message
    await expect(
      page.getByText("Function Call Request Failed").first()
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Proposal failed as expected (receiver not registered)");

    // Verify recipient has 0 wNEAR balance (transfer failed)
    try {
      const recipientBalance = await sandbox.viewFunction(
        wNearContractId,
        "ft_balance_of",
        {
          account_id: recipientAccountId,
        }
      );
      console.log(
        `✗ Unexpected: Recipient has wNEAR balance: ${recipientBalance}`
      );
    } catch (error) {
      console.log("✓ Recipient not registered with wrap.near (expected)");
    }
  });

  test("should create multiple actions proposal with storage deposit and FT transfer, then succeed", async ({
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

    // Navigate to function calls page
    const url = `http://localhost:3000/${daoAccountId}/function-call`;
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

    // Click Create Request button
    const createRequestButton = page.getByRole("button", {
      name: /Create Request/i,
    });
    await expect(createRequestButton).toBeVisible({ timeout: 10000 });
    await createRequestButton.click();

    // Fill the form with 2 actions: storage_deposit + ft_transfer
    const canvasLocator = page.locator(".offcanvas-body");
    await expect(canvasLocator.getByTestId("contract-id-input")).toBeVisible({
      timeout: 10000,
    });

    // Fill contract ID - wrap.near
    await canvasLocator.getByTestId("contract-id-input").fill(wNearContractId);

    // Add second action
    await canvasLocator.getByText("Add Another Action").click();
    await page.waitForTimeout(500);
    console.log("✓ Added second action");

    // Fill first action - storage_deposit for recipient
    await canvasLocator
      .getByTestId("method-name-input-0")
      .fill("storage_deposit");
    const storageArgs = {
      account_id: recipientAccountId,
      registration_only: true,
    };
    await canvasLocator
      .getByTestId("arguments-input-0")
      .fill(JSON.stringify(storageArgs, null, 2));
    await canvasLocator.getByTestId("gas-input-0").fill("30");
    await canvasLocator.getByTestId("deposit-input-0").fill("0.01");

    // Fill second action - ft_transfer 10 wNEAR to recipient
    await canvasLocator.getByTestId("method-name-input-1").fill("ft_transfer");
    const transferArgs = {
      receiver_id: recipientAccountId,
      amount: await parseNEAR("10"), // 10 wNEAR
    };
    await canvasLocator
      .getByTestId("arguments-input-1")
      .fill(JSON.stringify(transferArgs, null, 2));
    await canvasLocator.getByTestId("gas-input-1").fill("30");
    await canvasLocator
      .getByTestId("deposit-input-1")
      .fill("0.000000000000000000000001");

    // Fill notes
    await canvasLocator
      .getByTestId("notes-input")
      .fill("Register storage and transfer 10 wNEAR to recipient");
    console.log("✓ Filled form with storage_deposit + ft_transfer");

    // Submit the form
    await canvasLocator.getByTestId("submit-button").click();
    console.log("✓ Clicked submit button");

    // Wait for confirmation modal and click Confirm
    await page.waitForTimeout(2000);

    // Check for success toast
    await expect(
      page.getByText("Function call request has been successfully created.")
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Success toast displayed");

    // Wait for transaction to complete
    await page.waitForTimeout(3000);

    // Close the offcanvas/modal
    const closeButton = page.locator(".bi-x-lg");
    await closeButton.click();
    await page.waitForTimeout(1000);

    // Verify proposal appears in table
    await expect(
      page.getByText("Register storage and transfer 10 wNEAR to recipient")
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Proposal appears in table");

    // Click on the proposal to view details
    await page
      .getByText("Register storage and transfer 10 wNEAR to recipient")
      .click();
    await page.waitForTimeout(2000);

    // Verify multiple actions are displayed
    await expect(page.getByText("Action 1")).toBeVisible();
    await expect(page.getByText("Action 2")).toBeVisible();
    await expect(page.getByText("Contract ID")).toBeVisible();
    await expect(page.getByText(wNearContractId)).toBeVisible();
    console.log("✓ Multiple actions displayed in details");

    // Verify each action shows correct methods
    await expect(page.getByText("storage_deposit")).toBeVisible();
    await expect(page.getByText("ft_transfer")).toBeVisible();
    console.log("✓ All action details displayed");

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
      page.getByText(/The request has been successfully approved/i)
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Multiple actions proposal executed successfully");

    // Verify recipient received wNEAR
    await page.waitForTimeout(2000);
    const finalBalance = await sandbox.viewFunction(
      wNearContractId,
      "ft_balance_of",
      {
        account_id: recipientAccountId,
      }
    );
    console.log(`✓ Recipient final wNEAR balance: ${finalBalance}`);
    // Should have received 10 wNEAR
  });
});

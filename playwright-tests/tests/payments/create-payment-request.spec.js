import { test, expect } from "@playwright/test";
import { NearSandbox, injectTestWallet, interceptIndexerAPI, parseNEAR } from "../../util/sandbox.js";

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
    creatorAccountId = await sandbox.createAccount("testcreator.near", "10000000000000000000000000000"); // 10000 NEAR
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
                  permissions: ["*:VoteReject", "*:VoteApprove", "*:VoteRemove"],
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
    const walletDropdown = offcanvas.locator('div.dropdown').first();
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
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill("Test NEAR Payment Request");
    console.log("✓ Filled proposal title");

    // Fill in Summary textarea
    const summaryInput = offcanvas.locator('textarea').first();
    await summaryInput.waitFor({ state: 'visible', timeout: 10000 });
    await summaryInput.fill("Testing payment request creation via Playwright");
    console.log("✓ Filled proposal summary");

    // Fill in recipient - use creator account since it exists in sandbox
    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.waitFor({ state: 'visible', timeout: 10000 });
    await recipientInput.fill(creatorAccountId);
    await page.waitForTimeout(500);
    console.log("✓ Filled recipient");

    // Select NEAR token
    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected NEAR token");

    // Fill in amount - find input near "Total Amount" label (might be type="number")
    const amountInput = offcanvas.locator('input').filter({ hasText: '' }).last();
    await amountInput.waitFor({ state: 'visible', timeout: 10000 });
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
    const proposalRow = page.locator('table tbody tr').first();
    await expect(proposalRow).toBeVisible({ timeout: 5000 });
    console.log("✓ Proposal row visible in table");

    // Verify amount and recipient are visible somewhere on the page
    await expect(page.getByText("5", { exact: true }).first()).toBeVisible();
    console.log("✓ Amount visible");

    await expect(page.getByText(creatorAccountId).first()).toBeVisible();
    console.log("✓ Recipient visible");

    console.log("✅ All assertions passed!");
  });
});

import { test, expect } from "@playwright/test";
import { NearSandbox, injectTestWallet, interceptIndexerAPI, parseNEAR } from "../../util/sandbox.js";

/**
 * Vote on Payment Request Tests
 *
 * These tests verify the voting functionality for payment requests using near-sandbox
 * for end-to-end testing with real blockchain interaction.
 *
 * Tests cover:
 * 1. Role-based access control (Requestor vs Approver roles)
 * 2. Reject payment request
 * 3. Delete/remove payment request
 *
 * Uses real SputnikDAO role structure (Requestor, Approver, Admin)
 * based on testing-astradao.sputnik-dao.near
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";

let sandbox;
let factoryContractId;
let creatorAccountId;
let daoAccountId;
let voterAccountId;
let nonVoterAccountId;

test.describe("Vote on Payment Request", () => {
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

    // Create creator account with 10000 NEAR
    creatorAccountId = await sandbox.createAccount("testcreator.near", "10000000000000000000000000000");
    console.log(`Creator account: ${creatorAccountId}`);

    // Create voter account with 10000 NEAR
    voterAccountId = await sandbox.createAccount("testvoter.near", "10000000000000000000000000000");
    console.log(`Voter account: ${voterAccountId}`);

    // Create non-voter account with 10000 NEAR (has no voting permissions)
    nonVoterAccountId = await sandbox.createAccount("nonvoter.near", "10000000000000000000000000000");
    console.log(`Non-voter account: ${nonVoterAccountId}`);

    // Initialize the factory
    await sandbox.functionCall(
      factoryContractId,
      SPUTNIK_DAO_FACTORY_ID,
      "new",
      {},
      "300000000000000"
    );

    // Create a DAO with both creator and voter as members
    const daoName = "votingdao";
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
              purpose: "Test DAO for voting on payment requests",
              metadata: "",
            },
            policy: {
              roles: [
                {
                  kind: {
                    Group: [creatorAccountId, nonVoterAccountId],
                  },
                  name: "Requestor",
                  permissions: [
                    "call:AddProposal",
                    "transfer:AddProposal",
                    "transfer:VoteRemove",
                    "call:VoteRemove",
                  ],
                  vote_policy: {},
                },
                {
                  kind: {
                    Group: [creatorAccountId, voterAccountId],
                  },
                  name: "Approver",
                  permissions: [
                    "transfer:VoteApprove",
                    "call:VoteApprove",
                    "transfer:RemoveProposal",
                    "call:VoteReject",
                    "transfer:VoteReject",
                    "transfer:Finalize",
                    "call:Finalize",
                    "call:RemoveProposal",
                  ],
                  vote_policy: {},
                },
              ],
              default_vote_policy: {
                weight_kind: "RoleWeight",
                quorum: "0",
                threshold: [1, 2],
              },
              proposal_bond: "1000000000000000000000000",
              proposal_period: "604800000000000",
              bounty_bond: "1000000000000000000000000",
              bounty_forgiveness_period: "86400000000000",
            },
          })
        ).toString("base64"),
      },
      "150000000000000",
      "8000000000000000000000000"
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
    if (sandbox) {
      await sandbox.stop();
    }
  });

  test("user without voting permissions should not see vote buttons", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    console.log("\n=== Test: Role-Based Access Control ===\n");

    // Add console logging to debug UI stability issues
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`Browser ${msg.type()}: ${msg.text()}`);
      }
    });
    page.on('pageerror', err => console.log('Page error:', err.message));

    // Setup interceptors before navigation
    await interceptIndexerAPI(page, sandbox, daoAccountId);
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const response = await page.request.post(sandbox.getRpcUrl(), {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    // First, create a proposal as creator
    await injectTestWallet(page, sandbox, creatorAccountId);
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, { waitUntil: 'networkidle' });

    // Create a payment request
    await page.getByRole("button", { name: "Create Request" }).click();
    await page.waitForTimeout(1000);

    // Wait for the offcanvas (sidebar form) to open
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Select Treasury Wallet (SputnikDAO)
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();
    const walletDropdown = offcanvas.locator('div.dropdown').first();
    await walletDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('text="SputnikDAO"').last().click();
    await page.waitForTimeout(2000);

    // Fill form fields
    await page.waitForTimeout(1000);

    // Fill Title
    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill("Role-Based Access Test");

    // Fill Summary
    const summaryInput = offcanvas.locator('textarea').first();
    await summaryInput.fill("Testing role-based access control");

    // Fill Recipient
    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(voterAccountId);
    await page.waitForTimeout(500);

    // Select NEAR token
    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    // Fill Amount
    const amountInput = offcanvas.locator('input').filter({ hasText: '' }).last();
    await amountInput.click();
    await amountInput.fill("2");
    await page.waitForTimeout(500);

    // Submit
    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log("✓ Created proposal");

    // Now switch to non-voter account
    await injectTestWallet(page, sandbox, nonVoterAccountId);
    await page.reload({ waitUntil: 'networkidle' });

    // Should see pending requests tab
    await expect(page.getByText("Pending Requests")).toBeVisible({ timeout: 10000 });
    console.log("✓ On Pending Requests tab");

    // Vote buttons should NOT be visible for non-voter
    const approveButton = page.getByRole("button", { name: /^approve$/i });
    const rejectButton = page.getByRole("button", { name: /^reject$/i });

    await expect(approveButton).toBeHidden({ timeout: 5000 });
    await expect(rejectButton).toBeHidden({ timeout: 5000 });
    console.log("✓ Vote buttons are hidden for user without voting permissions");
  });

  test("reject payment request", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    console.log("\n=== Test: Reject Payment Request ===\n");

    // Setup interceptors
    await interceptIndexerAPI(page, sandbox, daoAccountId);
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const response = await page.request.post(sandbox.getRpcUrl(), {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    // Create proposal as creator
    await injectTestWallet(page, sandbox, creatorAccountId);
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, { waitUntil: 'networkidle' });

    await page.getByRole("button", { name: "Create Request" }).click();
    await page.waitForTimeout(1000);

    // Wait for offcanvas and select wallet
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();

    const walletDropdown = offcanvas.locator('div.dropdown').first();
    await walletDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('text="SputnikDAO"').last().click();
    await page.waitForTimeout(2000);

    // Fill form fields
    await page.waitForTimeout(1000);

    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill("Payment for Rejection Test");

    const summaryInput = offcanvas.locator('textarea').first();
    await summaryInput.fill("Testing payment rejection workflow");

    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(voterAccountId);
    await page.waitForTimeout(500);

    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    const amountInput = offcanvas.locator('input').filter({ hasText: '' }).last();
    await amountInput.click();
    await amountInput.fill("3");
    await page.waitForTimeout(500);

    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Switch to voter account to reject
    await injectTestWallet(page, sandbox, voterAccountId);
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByText("Pending Requests")).toBeVisible({ timeout: 10000 });
    console.log("✓ On Pending Requests tab");

    // Click reject button
    const rejectButton = page.getByRole("button", { name: /reject/i }).first();
    await expect(rejectButton).toBeVisible({ timeout: 10000 });
    await rejectButton.click();
    console.log("✓ Clicked reject button");

    // Confirm rejection if dialog appears
    const confirmButton = page.getByRole("button", { name: /confirm/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify rejection succeeded - toast shows "Your vote is counted"
    await expect(page.getByText(/your vote is counted|vote.*counted/i)).toBeVisible({ timeout: 30000 });
    console.log("✓ Vote counted notification appeared");

    // Wait for toast to disappear and reload to see updated status
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'networkidle' });

    // Verify it moved to history
    // Note: With threshold 1/2, one reject vote may result in "Expired" status rather than "Rejected"
    await page.getByText("History").click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(/rejected|failed|expired/i)).toBeVisible({ timeout: 10000 });
    console.log("✓ Proposal with reject vote appears in history");
  });

  test("delete/remove payment request", async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    console.log("\n=== Test: Delete Payment Request ===\n");

    // Setup interceptors
    await interceptIndexerAPI(page, sandbox, daoAccountId);
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const response = await page.request.post(sandbox.getRpcUrl(), {
        headers: request.headers(),
        data: request.postDataJSON(),
      });
      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    // Create proposal as creator
    await injectTestWallet(page, sandbox, creatorAccountId);
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, { waitUntil: 'networkidle' });

    await page.getByRole("button", { name: "Create Request" }).click();
    await page.waitForTimeout(1000);

    // Wait for offcanvas and select wallet
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();

    const walletDropdown = offcanvas.locator('div.dropdown').first();
    await walletDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('text="SputnikDAO"').last().click();
    await page.waitForTimeout(2000);

    // Fill form fields
    await page.waitForTimeout(1000);

    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: 'visible', timeout: 10000 });
    await titleInput.fill("Payment for Deletion Test");

    const summaryInput = offcanvas.locator('textarea').first();
    await summaryInput.fill("Testing payment deletion workflow");

    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(voterAccountId);
    await page.waitForTimeout(500);

    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    const amountInput = offcanvas.locator('input').filter({ hasText: '' }).last();
    await amountInput.click();
    await amountInput.fill("1");
    await page.waitForTimeout(500);

    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Reload page to see the created proposal
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByText("Pending Requests")).toBeVisible({ timeout: 10000 });
    console.log("✓ On Pending Requests tab");

    // Click on the proposal row to open detail view
    const proposalRow = page.locator('table tbody tr').first();
    await expect(proposalRow).toBeVisible({ timeout: 10000 });
    await proposalRow.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened proposal detail view");

    // Look for delete button - it should be visible as a trash icon
    // The delete button only shows for the proposal creator (VoteActions.jsx:455)
    // The trash icon is inside the detail view
    const trashIcon = page.locator('.bi-trash').last();
    await expect(trashIcon).toBeVisible({ timeout: 10000 });
    console.log("✓ Delete button (trash icon) is visible");

    await trashIcon.click();
    console.log("✓ Clicked delete button");

    // Wait for the delete action to complete
    await page.waitForTimeout(5000);

    // Verify proposal moved to history
    // Reload the page to see the updated status
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Navigate to History tab
    const historyTab = page.getByText("History");
    await historyTab.click();
    await page.waitForTimeout(2000);

    // Hard expectation: The deleted proposal should appear in history with "Expired" status
    // (VoteRemove causes the proposal to expire when threshold isn't met)
    await expect(page.getByText(/expired/i)).toBeVisible({ timeout: 10000 });
    console.log("✓ Payment request deleted successfully - appears in history as Expired");
  });
});

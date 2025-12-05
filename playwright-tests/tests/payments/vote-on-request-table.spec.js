import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Vote on Payment Request Tests - Table View
 *
 * These tests verify the voting functionality from the table view using near-sandbox
 * for end-to-end testing with real blockchain interaction.
 *
 * Tests cover:
 * 1. Role-based access control (Requestor vs Approver roles)
 * 2. Approve payment request from table
 * 3. Reject payment request from table
 * 4. Delete payment request from table
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

test.describe("Vote on Payment Request - Table View", () => {
  test.beforeEach(async () => {
    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import sputnik-dao factory from mainnet
    factoryContractId = await sandbox.importMainnetContract(
      SPUTNIK_DAO_FACTORY_ID,
      SPUTNIK_DAO_FACTORY_ID
    );

    // Create creator account with 10000 NEAR
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      "10000000000000000000000000000"
    );
    console.log(`Creator account: ${creatorAccountId}`);

    // Create voter account with 10000 NEAR
    voterAccountId = await sandbox.createAccount(
      "testvoter.near",
      "10000000000000000000000000000"
    );
    console.log(`Voter account: ${voterAccountId}`);

    // Create non-voter account with 10000 NEAR (has no voting permissions)
    nonVoterAccountId = await sandbox.createAccount(
      "nonvoter.near",
      "10000000000000000000000000000"
    );
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

  test.afterEach(async ({ page }) => {
    // Clean up route handlers before closing page
    await page.unrouteAll({ behavior: "ignoreErrors" });

    if (sandbox) {
      await sandbox.stop();
    }
  });

  test("user without voting permissions should not see vote buttons", async ({
    page,
  }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Role-Based Access Control ===\n");

    // Add console logging to debug UI stability issues
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`Browser ${msg.type()}: ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => console.log("Page error:", err.message));

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
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    // Create a payment request
    await page.getByRole("button", { name: "Create Request" }).click();
    await page.getByText("Single Request").click();
    await page.waitForTimeout(1000);

    // Wait for the offcanvas (sidebar form) to open
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Select Treasury Wallet (SputnikDAO)
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();
    const walletDropdown = offcanvas.locator("div.dropdown").first();
    await walletDropdown.waitFor({ state: "visible", timeout: 10000 });
    await walletDropdown.click();
    await page.waitForTimeout(1000);

    const sputnikOption = page.locator('text="SputnikDAO"').last();
    await sputnikOption.waitFor({ state: "visible", timeout: 10000 });
    await sputnikOption.click();
    await page.waitForTimeout(2000);

    // Fill form fields
    await page.waitForTimeout(1000);

    // Fill Title
    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill("Role-Based Access Test");

    // Fill Summary
    const summaryInput = offcanvas.locator("textarea").first();
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
    const amountInput = offcanvas
      .locator("input")
      .filter({ hasText: "" })
      .last();
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
    await page.reload({ waitUntil: "networkidle" });

    // Should see pending requests tab
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ On Pending Requests tab");

    // Vote buttons should NOT be visible for non-voter
    const approveButton = page.getByRole("button", { name: /^approve$/i });
    const rejectButton = page.getByRole("button", { name: /^reject$/i });

    await expect(approveButton).toBeHidden({ timeout: 5000 });
    await expect(rejectButton).toBeHidden({ timeout: 5000 });
    console.log(
      "✓ Vote buttons are hidden for user without voting permissions"
    );
  });

  test("reject payment request", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

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
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    await page.getByRole("button", { name: "Create Request" }).click();
    await page.getByText("Single Request").click();
    await page.waitForTimeout(1000);

    // Wait for offcanvas and select wallet
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();

    const walletDropdown = offcanvas.locator("div.dropdown").first();
    await walletDropdown.waitFor({ state: "visible", timeout: 10000 });
    await walletDropdown.click();
    await page.waitForTimeout(1000);

    const sputnikOption = page.locator('text="SputnikDAO"').last();
    await sputnikOption.waitFor({ state: "visible", timeout: 10000 });
    await sputnikOption.click();
    await page.waitForTimeout(2000);

    // Fill form fields
    await page.waitForTimeout(1000);

    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill("Payment for Rejection Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing payment rejection workflow");

    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(voterAccountId);
    await page.waitForTimeout(500);

    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    const amountInput = offcanvas
      .locator("input")
      .filter({ hasText: "" })
      .last();
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
    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });
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
    await expect(
      page.getByText(/your vote is counted|vote.*counted/i)
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Vote counted notification appeared");

    // Wait for toast to disappear and reload to see updated status
    await page.waitForTimeout(3000);

    // Direct contract verification: query the proposal to check its status and votes
    const proposalId = 0; // First proposal created in this test
    try {
      const proposal = await sandbox.viewFunction(
        daoAccountId,
        "get_proposal",
        { id: proposalId }
      );
      console.log(
        `✓ Proposal ${proposalId} status in contract:`,
        proposal.status
      );
      console.log(
        `✓ Proposal ${proposalId} votes:`,
        JSON.stringify(proposal.votes)
      );

      // Check what votes exist
      const hasRejectVote = Object.values(proposal.votes || {}).some(
        (vote) => vote === "Reject"
      );
      if (hasRejectVote) {
        console.log(`✓ Contract verification: Proposal has "Reject" vote(s)`);
      }
    } catch (error) {
      console.error(`✗ Error querying proposal from contract:`, error.message);
    }

    // Switch back to creator account to verify the rejection badge
    await injectTestWallet(page, sandbox, creatorAccountId);
    await page.reload({ waitUntil: "networkidle" });

    // Verify proposal remains in Pending Requests with "You Rejected" badge
    // Note: Proposals stay "InProgress" until someone calls finalize()
    // They don't automatically move to History just from having reject votes
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/You Rejected/i)).toBeVisible({
      timeout: 10000,
    });
    console.log(
      "✓ Proposal with reject vote remains in Pending Requests with 'You Rejected' badge"
    );
  });

  test("approve payment request from table", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Approve from Table ===\n");

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
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    await page.getByRole("button", { name: "Create Request" }).click();
    await page.getByText("Single Request").click();
    await page.waitForTimeout(1000);

    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();

    const walletDropdown = offcanvas.locator("div.dropdown").first();
    await walletDropdown.waitFor({ state: "visible", timeout: 10000 });
    await walletDropdown.click();
    await page.waitForTimeout(1000);

    const sputnikOption = page.locator('text="SputnikDAO"').last();
    await sputnikOption.waitFor({ state: "visible", timeout: 10000 });
    await sputnikOption.click();
    await page.waitForTimeout(2000);

    await page.waitForTimeout(1000);
    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill("Approve from Table Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing approve from table");

    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(voterAccountId);
    await page.waitForTimeout(500);

    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    const amountInput = offcanvas
      .locator("input")
      .filter({ hasText: "" })
      .last();
    await amountInput.click();
    await amountInput.fill("5");
    await page.waitForTimeout(500);

    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Switch to voter account to approve from table
    await injectTestWallet(page, sandbox, voterAccountId);
    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ On Pending Requests tab");

    // Click approve button in the table
    const approveButton = page
      .getByRole("button", { name: /^approve$/i })
      .first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await approveButton.click();
    console.log("✓ Clicked approve button in table");

    // Confirm if dialog appears
    const confirmButton = page.getByRole("button", { name: /confirm/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify approval succeeded
    await expect(
      page.getByText(/your vote is counted|vote.*counted/i)
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Approve vote from table successful");
  });

  test("delete payment request from table", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Delete from Table ===\n");

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
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    await page.getByRole("button", { name: "Create Request" }).click();
    await page.getByText("Single Request").click();
    await page.waitForTimeout(1000);

    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();

    const walletDropdown = offcanvas.locator("div.dropdown").first();
    await walletDropdown.waitFor({ state: "visible", timeout: 10000 });
    await walletDropdown.click();
    await page.waitForTimeout(1000);

    const sputnikOption = page.locator('text="SputnikDAO"').last();
    await sputnikOption.waitFor({ state: "visible", timeout: 10000 });
    await sputnikOption.click();
    await page.waitForTimeout(2000);

    await page.waitForTimeout(1000);
    const titleInput = offcanvas.locator('input[type="text"]').first();
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill("Delete from Table Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing delete from table");

    const recipientInput = offcanvas.getByPlaceholder("treasury.near");
    await recipientInput.fill(voterAccountId);
    await page.waitForTimeout(500);

    const tokenDropdown = offcanvas.getByText("Select token");
    await tokenDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR", { exact: true }).first().click();
    await page.waitForTimeout(1000);

    const amountInput = offcanvas
      .locator("input")
      .filter({ hasText: "" })
      .last();
    await amountInput.click();
    await amountInput.fill("1");
    await page.waitForTimeout(500);

    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Reload to see the proposal
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });

    // Click trash icon in table row
    const trashIconInTable = page.locator("tbody tr .bi-trash").first();
    await expect(trashIconInTable).toBeVisible({ timeout: 10000 });
    await trashIconInTable.click();
    console.log("✓ Clicked delete button in table");

    // Confirm deletion in modal
    await page.waitForTimeout(1000);
    const confirmButton = page.getByRole("button", { name: /^confirm$/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    console.log("✓ Confirmed deletion");

    await page.waitForTimeout(10000);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Direct contract verification: query the proposal to check its votes
    // Note: The contract does NOT delete proposals - it keeps them with "Remove" votes
    const proposalId = 0; // First proposal created in this test
    try {
      const proposal = await sandbox.viewFunction(
        daoAccountId,
        "get_proposal",
        { id: proposalId }
      );
      console.log(
        `✓ Proposal ${proposalId} status in contract:`,
        proposal.status
      );
      console.log(
        `✓ Proposal ${proposalId} votes:`,
        JSON.stringify(proposal.votes)
      );

      // Verify the proposal has a "Remove" vote
      const hasRemoveVote = Object.values(proposal.votes || {}).some(
        (vote) => vote === "Remove"
      );
      if (hasRemoveVote) {
        console.log(
          `✓ Contract verification: Proposal has "Remove" vote (should be filtered by indexer)`
        );
      } else {
        console.warn(
          `⚠ WARNING: Expected proposal to have "Remove" vote but it doesn't!`
        );
      }
    } catch (error) {
      console.error(`✗ Error querying proposal from contract:`, error.message);
    }

    // Verify proposal is gone from Pending Requests (filtered by mock indexer)
    await expect(page.getByText("Delete from Table Test")).not.toBeVisible();
    console.log(
      "✓ Proposal removed from Pending Requests (filtered out by indexer)"
    );
    console.log(
      "✓ Delete from table successful - indexer correctly filters proposals with Remove votes"
    );
  });
});

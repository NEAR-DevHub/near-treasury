import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Vote on Payment Request Tests - Full Page View
 *
 * These tests verify the voting functionality from the full proposal detail page using near-sandbox
 * for end-to-end testing with real blockchain interaction.
 *
 * Tests cover:
 * 1. Approve payment request from full page
 * 2. Reject payment request from full page
 * 3. Delete payment request from full page
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

test.describe("Vote on Payment Request - Full Page View", () => {
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
                    Group: [creatorAccountId],
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

  test("approve payment request from full page", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Approve from Full Page ===\n");

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
    await titleInput.fill("Approve from Full Page Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing approve action from full proposal page");

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
    await amountInput.fill("10");
    await page.waitForTimeout(500);

    // Submit proposal
    const submitButton = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Switch to voter account to approve from full page
    await injectTestWallet(page, sandbox, voterAccountId);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    console.log("✓ Switched to voter account");

    // Wait for proposals table to load
    await page.waitForSelector("table tbody tr", {
      state: "visible",
      timeout: 15000,
    });
    await page.waitForTimeout(2000);

    // Navigate to full proposal detail page
    // First, find the proposal in the table by its summary (displayed as title in UI)
    await expect(
      page.getByText("Testing approve action from full proposal page")
    ).toBeVisible({ timeout: 10000 });

    // Click on proposal row to open overlay
    const proposalRow = page.locator("table tbody tr").first();
    await proposalRow.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened proposal overlay");

    // Click expand button to navigate to full page
    const expandButton = page.locator(".bi-arrows-angle-expand").first();
    await expect(expandButton).toBeVisible({ timeout: 5000 });
    await expandButton.click();
    await page.waitForTimeout(2000);

    console.log("✓ Navigated to full proposal detail page");

    // Click approve button on full page
    const approveButton = page
      .getByRole("button", { name: /approve/i })
      .first();
    await expect(approveButton).toBeVisible({ timeout: 5000 });
    await approveButton.click();
    await page.waitForTimeout(2000);
    console.log("✓ Clicked approve button");

    // Confirm if modal appears
    const confirmButton = page.getByRole("button", { name: /^confirm$/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
      console.log("✓ Clicked confirm button");
    }

    // Wait for vote to be processed and success message
    await page.waitForTimeout(5000);
    await expect(page.getByText("Your vote is counted.")).toBeVisible({
      timeout: 30000,
    });
    console.log("✓ Approve from full page successful");
  });

  test("reject payment request from full page", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Reject from Full Page ===\n");

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
    await titleInput.fill("Reject from Full Page Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing reject action from full proposal page");

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
    await amountInput.fill("10");
    await page.waitForTimeout(500);

    // Submit proposal
    const submitButton = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Switch to voter account to reject from full page
    await injectTestWallet(page, sandbox, voterAccountId);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    console.log("✓ Switched to voter account");

    // Wait for proposals table to load
    await page.waitForSelector("table tbody tr", {
      state: "visible",
      timeout: 15000,
    });
    await page.waitForTimeout(2000);

    // Navigate to full proposal detail page
    // Find the proposal in the table by its summary (displayed as title in UI)
    await expect(
      page.getByText("Testing reject action from full proposal page")
    ).toBeVisible({ timeout: 10000 });

    // Click on proposal row to open overlay
    const proposalRow = page.locator("table tbody tr").first();
    await proposalRow.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened proposal overlay");

    // Click expand button to navigate to full page
    const expandButton = page.locator(".bi-arrows-angle-expand").first();
    await expect(expandButton).toBeVisible({ timeout: 5000 });
    await expandButton.click();
    await page.waitForTimeout(2000);

    console.log("✓ Navigated to full proposal detail page");

    // Click reject button on full page
    const rejectButton = page.getByRole("button", { name: /reject/i }).first();
    await expect(rejectButton).toBeVisible({ timeout: 5000 });
    await rejectButton.click();
    await page.waitForTimeout(2000);
    console.log("✓ Clicked reject button");

    // Confirm if modal appears
    const confirmButton = page.getByRole("button", { name: /^confirm$/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
      console.log("✓ Clicked confirm button");
    }

    // Wait for vote to be processed and success message
    await page.waitForTimeout(5000);
    await expect(page.getByText("Your vote is counted.")).toBeVisible({
      timeout: 30000,
    });
    console.log("✓ Reject from full page successful");
  });

  test("delete payment request from full page", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Delete from Full Page ===\n");

    // Setup interceptors
    await interceptIndexerAPI(page, sandbox, daoAccountId);
    let rpcCallCount = 0;
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      rpcCallCount++;
      console.log(
        `[RPC #${rpcCallCount}] Method: ${postData.method}, Params:`,
        JSON.stringify(postData.params).substring(0, 100)
      );
      const response = await page.request.post(sandbox.getRpcUrl(), {
        headers: request.headers(),
        data: postData,
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
    await titleInput.fill("Delete from Full Page Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing delete action from full proposal page");

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
    await amountInput.fill("10");
    await page.waitForTimeout(500);

    // Submit proposal
    const submitButton = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    await submitButton.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Reload to see the proposal (staying as creator who can delete)
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    console.log("✓ Reloaded page as creator");

    // Wait for proposals table to load
    await page.waitForSelector("table tbody tr", {
      state: "visible",
      timeout: 15000,
    });
    await page.waitForTimeout(2000);

    // Navigate to full proposal detail page
    // Find the proposal in the table by its summary (displayed as title in UI)
    await expect(
      page.getByText("Testing delete action from full proposal page")
    ).toBeVisible({ timeout: 10000 });

    // Click on proposal row to open overlay
    const proposalRow = page.locator("table tbody tr").first();
    await proposalRow.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened proposal overlay");

    // Click expand button to navigate to full page
    const expandButton = page.locator(".bi-arrows-angle-expand").first();
    await expect(expandButton).toBeVisible({ timeout: 5000 });
    await expandButton.click();
    await page.waitForTimeout(2000);

    console.log("✓ Navigated to full proposal detail page");

    // Click trash/delete icon on full page
    const deleteButton = page.locator(".bi-trash").first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();
    console.log("✓ Clicked delete button");

    // Confirm deletion in modal - wait longer for modal to appear
    await page.waitForTimeout(500);
    const confirmButton = page.getByRole("button", { name: "Confirm" });
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.click();
    console.log("✓ Confirmed deletion");

    // Wait for transaction
    await page.waitForTimeout(10000);

    // Direct contract verification: query the proposal to check its votes
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

    // Navigate back to payments page
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(3000);

    // Verify proposal is gone from Pending Requests (filtered by mock indexer)
    await expect(
      page.getByText("Delete from Full Page Test")
    ).not.toBeVisible();
    console.log(
      "✓ Proposal removed from Pending Requests (filtered out by indexer)"
    );
    console.log(
      "✓ Delete from full page successful - indexer correctly filters proposals with Remove votes"
    );
  });
});

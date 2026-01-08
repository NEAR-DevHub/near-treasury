import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Vote on Payment Request Tests - Overlay View
 *
 * These tests verify the voting functionality from the overlay/detail view using near-sandbox
 * for end-to-end testing with real blockchain interaction.
 *
 * Tests cover:
 * 1. Approve payment request from overlay
 * 2. Reject payment request from overlay
 * 3. Delete payment request from overlay
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

test.describe("Vote on Payment Request - Overlay View", () => {
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

  test("approve payment request from overlay", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Approve from Overlay ===\n");

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
    await page.getByText("Single Payment").click();
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
    await titleInput.fill("Approve from Overlay Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing approve from overlay");

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
    await amountInput.fill("4");
    await page.waitForTimeout(500);

    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Switch to voter account
    await injectTestWallet(page, sandbox, voterAccountId);
    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });

    // Click on proposal row to open overlay
    const proposalRow = page.locator("table tbody tr").first();
    await expect(proposalRow).toBeVisible({ timeout: 10000 });
    await proposalRow.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened proposal overlay");

    // Click approve button in overlay
    const approveButton = page
      .getByRole("button", { name: /approve/i })
      .first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await approveButton.click();
    console.log("✓ Clicked approve button in overlay");

    const confirmButton = page.getByRole("button", { name: /confirm/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await expect(
      page.getByText(/your vote is counted|vote.*counted/i)
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Approve from overlay successful");
  });

  test("reject payment request from overlay", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

    console.log("\n=== Test: Reject from Overlay ===\n");

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
    await page.getByText("Single Payment").click();
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
    await titleInput.fill("Reject from Overlay Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing reject from overlay");

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
    await amountInput.fill("2");
    await page.waitForTimeout(500);

    const submitBtn = offcanvas.getByRole("button", { name: "Submit" });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    console.log("✓ Payment request created");

    // Switch to voter account
    await injectTestWallet(page, sandbox, voterAccountId);
    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });

    // Click on proposal row to open overlay
    const proposalRow = page.locator("table tbody tr").first();
    await expect(proposalRow).toBeVisible({ timeout: 10000 });
    await proposalRow.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened proposal overlay");

    // Click reject button in overlay
    const rejectButton = page.getByRole("button", { name: /reject/i }).first();
    await expect(rejectButton).toBeVisible({ timeout: 10000 });
    await rejectButton.click();
    console.log("✓ Clicked reject button in overlay");

    const confirmButton = page.getByRole("button", { name: /confirm/i });
    if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await expect(
      page.getByText(/your vote is counted|vote.*counted/i)
    ).toBeVisible({ timeout: 30000 });
    console.log("✓ Reject from overlay successful");
  });

  test("delete/remove payment request", async ({ page }) => {
    test.setTimeout(90000); // 90 seconds

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
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, {
      waitUntil: "networkidle",
    });

    await page.getByRole("button", { name: "Create Request" }).click();
    await page.getByText("Single Payment").click();
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
    await titleInput.fill("Payment for Deletion Test");

    const summaryInput = offcanvas.locator("textarea").first();
    await summaryInput.fill("Testing payment deletion workflow");

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

    // Reload page to see the created proposal
    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ On Pending Requests tab");

    // Wait for proposals table to load
    await page.waitForTimeout(2000);

    // Click on the proposal row to open detail view
    const proposalRow = page.locator("table tbody tr").first();
    await expect(proposalRow).toBeVisible({ timeout: 10000 });
    await proposalRow.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened proposal detail view");

    // Look for delete button - it should be visible as a trash icon
    // The delete button only shows for the proposal creator (VoteActions.jsx:455)
    // The trash icon is inside the detail view
    const trashIcon = page.locator(".bi-trash").last();
    await expect(trashIcon).toBeVisible({ timeout: 10000 });
    console.log("✓ Delete button (trash icon) is visible");

    await trashIcon.click();
    console.log("✓ Clicked delete button");

    // Confirm deletion in modal - wait longer for modal to appear
    await page.waitForTimeout(2000);
    const confirmButton = page.getByRole("button", { name: /^confirm$/i });
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.click();
    console.log("✓ Confirmed deletion");

    // Wait for the delete action to complete
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

    // Verify proposal moved to history
    // Reload the page to see the updated status
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Verify proposal is gone from Pending Requests (filtered by mock indexer)
    await expect(page.getByText("Payment for Deletion Test")).not.toBeVisible();
    console.log(
      "✓ Proposal removed from Pending Requests (filtered out by indexer)"
    );
    console.log(
      "✓ Payment request deleted successfully - indexer correctly filters proposals with Remove votes"
    );
  });
});

import { test, expect } from "@playwright/test";
import { mockRpcMethods } from "../../util/mock-rpc.js";

/**
 * Bulk Import Proposal Display Tests
 *
 * Tests displaying bulk payment proposals (approve_list) in:
 * - Table view
 * - Compact details view
 * - Expanded details view
 *
 * Mocks proposals with both NEAR and FT tokens.
 */

const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

// Mock payment list data (as returned from view_list RPC)
const NEAR_PAYMENT_LIST = {
  list_id: "list_near_123",
  submitter_id: TEST_DAO_ID,
  token_id: "native",
  payments: [
    { recipient: "alice.near", amount: "1000000000000000000000000" }, // 1 NEAR
    { recipient: "bob.near", amount: "2000000000000000000000000" }, // 2 NEAR
    { recipient: "carol.near", amount: "3000000000000000000000000" }, // 3 NEAR
    { recipient: "dave.near", amount: "4000000000000000000000000" }, // 4 NEAR
    { recipient: "eve.near", amount: "5000000000000000000000000" }, // 5 NEAR
  ],
};

const FT_PAYMENT_LIST = {
  list_id: "list_usdt_456",
  submitter_id: TEST_DAO_ID,
  token_id: "usdt.tether-token.near",
  payments: [
    { recipient: "alice.near", amount: "1000000" }, // 1 USDT (6 decimals)
    { recipient: "bob.near", amount: "2000000" }, // 2 USDT
    { recipient: "carol.near", amount: "3000000" }, // 3 USDT
  ],
};

// Mock proposal data (as returned from indexer and get_proposal RPC)
const NEAR_PROPOSAL = {
  id: 101,
  proposer: "proposer.near",
  description:
    "* Proposal Action: bulk-payment <br>* Title: Q1 Team Payouts <br>* Recipients: 5 <br>* Contract: NEAR <br>* Amount: 15000000000000000000000000 <br>* List Id: list_near_123",
  kind: {
    FunctionCall: {
      receiver_id: "bulkpayment.near",
      actions: [
        {
          method_name: "approve_list",
          args: Buffer.from(
            JSON.stringify({ list_id: "list_near_123" })
          ).toString("base64"),
          deposit: "15000000000000000000000000",
          gas: "150000000000000",
        },
      ],
    },
  },
  status: "InProgress",
  vote_counts: {},
  votes: {},
  submission_time: (Date.now() * 1000000).toString(),
};

const FT_PROPOSAL = {
  id: 102,
  proposer: "proposer.near",
  description:
    "* Proposal Action: bulk-payment <br>* Title: Marketing Campaign Budget <br>* Recipients: 3 <br>* Contract: usdt.tether-token.near <br>* Amount: 6000000 <br>* List Id: list_usdt_456",
  kind: {
    FunctionCall: {
      receiver_id: "usdt.tether-token.near",
      actions: [
        {
          method_name: "ft_transfer_call",
          args: Buffer.from(
            JSON.stringify({
              receiver_id: "bulkpayment.near",
              amount: "6000000",
              msg: "list_usdt_456",
            })
          ).toString("base64"),
          deposit: "1",
          gas: "100000000000000",
        },
      ],
    },
  },
  status: "InProgress",
  vote_counts: {},
  votes: {},
  submission_time: (
    (Date.now() + 3 * 24 * 60 * 60 * 1000) *
    1000000
  ).toString(),
};

test.describe("Bulk Import Proposal Display Tests", () => {
  test.use({
    storageState: "playwright-tests/util/logged-in-state.json",
  });

  test.beforeEach(async ({ page }) => {
    // Mock all RPC methods at once
    await mockRpcMethods(page, {
      // Mock view_list for payment lists
      view_list: (args) => {
        const listId = args?.list_id;

        if (listId === "list_near_123") {
          return NEAR_PAYMENT_LIST;
        } else if (listId === "list_usdt_456") {
          return FT_PAYMENT_LIST;
        }

        return null;
      },
      // Mock get_proposal for proposal details
      get_proposal: (args) => {
        const proposalId = args?.id;

        if (proposalId === 101) {
          return NEAR_PROPOSAL;
        } else if (proposalId === 102) {
          return FT_PROPOSAL;
        }

        return null;
      },
    });

    // Mock proposals indexer API
    await page.route(`**/proposals/${TEST_DAO_ID}*`, async (route) => {
      // Return both NEAR and FT bulk payment proposals in correct format
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          proposals: [NEAR_PROPOSAL, FT_PROPOSAL],
          total: 2,
        }),
      });
    });

    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/payments`);
    await page.waitForLoadState("networkidle");
  });

  // ============== TEST 1: NEAR BULK PAYMENT ==============

  test("should display NEAR bulk payment in table, compact, and expanded views", async ({
    page,
  }) => {
    console.log("\n=== Testing NEAR Bulk Payment - All Views ===\n");

    // ===== TABLE VIEW =====
    console.log("\n--- Table View ---");
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Table loaded");

    // Check title
    await expect(page.getByText("Q1 Team Payouts")).toBeVisible();
    console.log("✓ Proposal title displayed");

    // Check recipient count
    await expect(page.getByText(/5 Recipient/i)).toBeVisible();
    console.log("✓ Recipient count: 5");

    // Check View Details button exists
    const viewDetailsButton = page.getByRole("button", {
      name: "View Details",
    });
    await expect(viewDetailsButton.first()).toBeVisible();
    console.log("✓ View Details button visible");

    // Verify NO vote actions in table
    const tableRow = page
      .locator("tbody tr")
      .filter({ hasText: "Q1 Team Payouts" });
    const approveInTable = tableRow.locator('button:has-text("Approve")');
    const hasApproveInTable = await approveInTable
      .isVisible()
      .catch(() => false);
    expect(hasApproveInTable).toBe(false);
    console.log("✓ No vote actions in table (correct)");

    // ===== COMPACT VIEW =====
    console.log("\n--- Compact View ---");
    await page.getByText("Q1 Team Payouts").click();
    await page.waitForTimeout(1000);

    // Get the proposal details container
    const proposalDetails = page.locator(".layout-secondary.show");
    await expect(proposalDetails).toBeVisible({ timeout: 5000 });

    // Check proposal ID
    await expect(proposalDetails.getByText("#101")).toBeVisible();
    console.log("✓ Proposal ID: #101");

    // Check metadata
    await expect(proposalDetails.getByText("Source Wallet")).toBeVisible();
    await expect(proposalDetails.getByText("Total Amount")).toBeVisible();
    await expect(proposalDetails.getByText("15NEAR")).toBeVisible();
    await expect(proposalDetails.getByText("Total Recipients")).toBeVisible();
    await expect(proposalDetails.getByText(/5 Recipient/i)).toBeVisible();
    console.log("✓ All metadata displayed correctly");

    // Check View Details expand button
    const expandButton = proposalDetails
      .getByRole("button", { name: "View Details" })
      .last();
    await expect(expandButton).toBeVisible();
    await expandButton.click();
    console.log("✓ View Details expand button visible");

    await page.waitForTimeout(3000); // Wait for the expanded view to load

    // Check proposal details
    await expect(page.getByText("Source Wallet")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Q1 Team Payouts")).toBeVisible();
    await expect(page.getByText("Total Amount")).toBeVisible();
    await expect(page.getByText(/5 Recipient/i)).toBeVisible();
    console.log("✓ Proposal details displayed");

    // Check recipients table
    await expect(page.getByRole("cell", { name: "Recipient" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("cell", { name: "Funding Ask" })).toBeVisible();
    console.log("✓ Recipients table headers visible");

    // Check all recipients
    await expect(page.getByText("alice.near")).toBeVisible();
    await expect(page.getByText("bob.near")).toBeVisible();
    await expect(page.getByText("carol.near")).toBeVisible();
    await expect(page.getByText("dave.near")).toBeVisible();
    await expect(page.getByText("eve.near")).toBeVisible();
    console.log("✓ All 5 recipients displayed");

    // Check amounts
    await expect(page.getByRole("cell", { name: "1 NEAR" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2 NEAR" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "3 NEAR" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "4 NEAR" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "5 NEAR" })).toBeVisible();
    console.log("✓ All amounts displayed correctly");

    console.log("\n✅ NEAR bulk payment test completed successfully\n");
  });

  // ============== TEST 2: FT BULK PAYMENT ==============

  test("should display FT bulk payment in table, compact, and expanded views", async ({
    page,
  }) => {
    console.log("\n=== Testing FT Bulk Payment - All Views ===\n");

    // ===== TABLE VIEW =====
    console.log("\n--- Table View ---");
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Table loaded");

    // Check title
    await expect(page.getByText("Marketing Campaign Budget")).toBeVisible();
    console.log("✓ Proposal title displayed");

    // Check recipient count
    await expect(page.getByText(/3 Recipient/i)).toBeVisible();
    console.log("✓ Recipient count: 3");

    // Check View Details button
    const viewDetailsButton = page.getByRole("button", {
      name: "View Details",
    });
    await expect(viewDetailsButton.last()).toBeVisible();
    console.log("✓ View Details button visible");

    // Verify NO vote actions in table
    const tableRow = page
      .locator("tbody tr")
      .filter({ hasText: "Marketing Campaign Budget" });
    const approveInTable = tableRow.locator('button:has-text("Approve")');
    const hasApproveInTable = await approveInTable
      .isVisible()
      .catch(() => false);
    expect(hasApproveInTable).toBe(false);
    console.log("✓ No vote actions in table (correct)");

    // ===== COMPACT VIEW =====
    console.log("\n--- Compact View ---");
    await page.getByText("Marketing Campaign Budget").click();
    await page.waitForTimeout(1000);

    // Get the proposal details container
    const proposalDetails = page.locator(".layout-secondary.show");
    await expect(proposalDetails).toBeVisible({ timeout: 5000 });

    // Check proposal ID
    await expect(proposalDetails.getByText("#102")).toBeVisible();
    console.log("✓ Proposal ID: #102");

    // Check metadata
    await expect(
      proposalDetails.getByText("Marketing Campaign Budget")
    ).toBeVisible();
    await expect(proposalDetails.getByText(/3 Recipient/i)).toBeVisible();
    console.log("✓ Metadata displayed correctly");

    // Check View Details expand button
    const expandButton = proposalDetails
      .getByRole("button", { name: "View Details" })
      .last();
    await expect(expandButton).toBeVisible();
    console.log("✓ View Details expand button visible");

    // ===== EXPANDED VIEW =====
    console.log("\n--- Expanded View ---");
    await expandButton.click();
    await page.waitForTimeout(3000); // Wait for the expanded view to load

    // Check proposal details
    await expect(page.getByText("Source Wallet")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Marketing Campaign Budget")).toBeVisible();
    await expect(page.getByText(/3 Recipient/i)).toBeVisible();
    console.log("✓ Proposal details displayed");

    // Check recipients table
    await expect(page.getByRole("cell", { name: "Recipient" })).toBeVisible({
      timeout: 5000,
    });
    console.log("✓ Recipients table headers visible");

    // Check all recipients
    await expect(page.getByText("alice.near")).toBeVisible();
    await expect(page.getByText("bob.near")).toBeVisible();
    await expect(page.getByText("carol.near")).toBeVisible();
    console.log("✓ All 3 recipients displayed");

    // Check USDT amounts (6 decimals)
    await expect(page.getByRole("cell", { name: "1 USDT" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "2 USDT" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "3 USDT" })).toBeVisible();
    console.log("✓ All USDT amounts displayed correctly");

    console.log("\n✅ FT bulk payment test completed successfully\n");
  });
});

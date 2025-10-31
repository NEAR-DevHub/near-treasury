import { test, expect } from "@playwright/test";
import { NearSandbox, injectTestWallet, interceptIndexerAPI, interceptRPC, parseNEAR } from "../../util/sandbox.js";

/**
 * Bulk Import Payment Requests Test
 *
 * This test verifies the bulk CSV import functionality with end-to-end
 * sandbox testing to confirm multiple payment requests are created successfully.
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";

let sandbox;
let factoryContractId;
let creatorAccountId;
let voterAccountId;
let daoAccountId;

test.describe("Bulk Import Payment Requests", () => {
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

    // Create test accounts with sufficient NEAR balance (100 NEAR each)
    // Need extra NEAR because creating the DAO costs ~6 NEAR and we need at least 0.20N remaining
    creatorAccountId = await sandbox.createAccount("testcreator.near", "100000000000000000000000000");
    voterAccountId = await sandbox.createAccount("testvoter.near", "100000000000000000000000000");
    console.log(`Creator account: ${creatorAccountId}`);
    console.log(`Voter account: ${voterAccountId}`);

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
    daoAccountId = `${daoName}.${SPUTNIK_DAO_FACTORY_ID}`;

    const createDaoArgs = {
      name: daoName,
      args: Buffer.from(
        JSON.stringify({
          purpose: "Test DAO for bulk import",
          bond: await parseNEAR("1"),
          vote_period: "604800000000000",
          grace_period: "86400000000000",
          policy: {
            roles: [
              {
                kind: { Group: [creatorAccountId, voterAccountId] },
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
                kind: { Group: [creatorAccountId, voterAccountId] },
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
            proposal_bond: "0",
            proposal_period: "604800000000000",
            bounty_bond: await parseNEAR("1"),
            bounty_forgiveness_period: "86400000000000",
          },
          config: {
            purpose: "Test DAO",
            name: daoName,
            metadata: "",
          },
        })
      ).toString("base64"),
    };

    await sandbox.functionCall(
      creatorAccountId,
      SPUTNIK_DAO_FACTORY_ID,
      "create",
      createDaoArgs,
      "300000000000000",
      await parseNEAR("6")
    );

    console.log(`DAO created: ${daoAccountId}\n`);
  });

  test.afterAll(async () => {
    if (sandbox) {
      await sandbox.stop();
    }
  });

  test("should create multiple payment requests via bulk import and verify all are created", async ({ page }) => {
    test.setTimeout(180000);

    // Inject test wallet and intercept API calls
    await injectTestWallet(page, sandbox, creatorAccountId);
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox); // Redirect mainnet RPC calls to sandbox (prevents insufficient funds modal)
    console.log(`✓ Injected wallet for ${creatorAccountId}`);

    // Navigate to payments page
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Click Create Request
    await page.getByRole("button", { name: "Create Request" }).click();
    await page.waitForTimeout(1000);

    // Hard expectation: Offcanvas sidebar must open
    const offcanvas = page.locator(".offcanvas-body");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });

    // Select Treasury Wallet (SputnikDAO)
    await expect(offcanvas.getByText("Treasury Wallet")).toBeVisible();
    const walletDropdown = offcanvas.locator('div.dropdown').first();
    await walletDropdown.click();
    await page.waitForTimeout(500);
    await page.locator('text="SputnikDAO"').last().click();
    await page.waitForTimeout(2000);
    console.log("✓ Selected SputnikDAO wallet");

    // Click "Import Multiple Payment Requests"
    await page.getByText("Import Multiple Payment Requests").click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened bulk import form");

    // Paste CSV with 3 payment requests
    const csvText = `Title\tSummary\tRecipient\tRequested Token\tFunding Ask\tNotes
Bulk Payment 1\tFirst bulk payment\t${voterAccountId}\tnear\t10\tBulk test 1
Bulk Payment 2\tSecond bulk payment\t${voterAccountId}\tnear\t20\tBulk test 2
Bulk Payment 3\tThird bulk payment\t${creatorAccountId}\tnear\t30\tBulk test 3`;

    const textarea = page.getByPlaceholder("Paste your CSV/TSV data here...");
    await textarea.fill(csvText);

    const validateBtn = page.getByRole("button", { name: "Validate Data" });
    await expect(validateBtn).toBeEnabled({ timeout: 5000 });
    await validateBtn.click();
    await page.waitForTimeout(2000);

    // Show Preview button appears with correct count
    const previewBtn = page.getByRole("button", {
      name: /Show 3 Preview/,
    });
    await expect(previewBtn).toBeVisible({ timeout: 10000 });
    await previewBtn.click();
    await page.waitForTimeout(1000);
    console.log("✓ CSV validated and preview displayed");

    // All checkboxes should be checked by default - verify submit button shows 3
    await expect(
      page.getByRole("button", { name: /Submit 3 Request/ })
    ).toBeVisible({ timeout: 5000 });
    console.log("✓ All 3 requests selected for submission");

    // Click submit - bulk import submits directly without confirmation modal
    const submitBtn = page.getByRole("button", { name: /Submit 3 Request/ });
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Hard expectation: Transaction toast must appear
    await expect(
      page.getByText(/Awaiting transaction confirmation/i)
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Transaction submission started");

    // Wait for transactions to complete - bulk import creates multiple proposals
    await page.waitForTimeout(30000);

    // Hard expectation: Modal should close after successful import
    const importModal = page.locator(".offcanvas").filter({ hasText: "Import Payment Requests" });
    await expect(importModal).not.toBeVisible({ timeout: 30000 });
    console.log("✓ Import modal closed after successful submission");

    // Hard expectation: All 3 proposals must be visible in Pending Requests table
    // Wait for the table to update with new proposals
    await page.waitForTimeout(3000);
    await expect(page.getByText("Bulk Payment 1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Bulk Payment 2")).toBeVisible();
    await expect(page.getByText("Bulk Payment 3")).toBeVisible();
    console.log("✓ All 3 payment requests appear in Pending Requests table");

    // Verify all recipients are correct in the table
    await expect(page.getByText("@testvoter.near").first()).toBeVisible();
    await expect(page.getByText("@testcreator.near").first()).toBeVisible();
    console.log("✓ All recipients verified in table");

    console.log("✓ End-to-end bulk import flow complete - all proposals confirmed in sandbox");
  });
});

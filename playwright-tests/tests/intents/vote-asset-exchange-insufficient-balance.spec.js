import { test } from "../../util/test.js";
import { expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  interceptRPC,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Vote on Asset Exchange Request with Insufficient Balance - Table View
 *
 * This test verifies that insufficient balance warnings work correctly when voting
 * on asset exchange requests from the table view.
 *
 * Tests cover two types of warnings:
 * 1. User's NEAR balance too low for gas/storage (Type 1 - InsufficientBannerModal)
 * 2. Treasury balance too low for the asset exchange amount (Type 2 - InsufficientBalanceWarning)
 *
 * Both warnings are informational only - users can dismiss and proceed, experiencing
 * transaction failure at the blockchain level if they truly lack funds.
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const INTENTS_CONTRACT_ID = "intents.near";
const OMFT_CONTRACT_ID = "omft.near";
// Insufficient balance calculation for Type 1 warning:
// - For voting actions (Approve/Reject/Delete), checkForDeposit=false
// - Warning threshold is just 0.1 NEAR (for gas/storage costs)
// - We create a low balance voter with 0.05 NEAR to trigger the warning

let sandbox;
let factoryContractId;
let intentsContractId;
let omftContractId;
let creatorAccountId;
let daoAccountId;
let voterAccountId;
let lowBalanceVoterAccountId;
let lowBalanceCreatorAccountId;

test.describe("Vote on Asset Exchange Request with Insufficient Balance - Table View", () => {
  test.beforeAll(async () => {
    test.setTimeout(600000); // 10 minutes for setup (intents setup is complex)

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import sputnik-dao factory from mainnet
    factoryContractId = await sandbox.importMainnetContract(
      SPUTNIK_DAO_FACTORY_ID,
      SPUTNIK_DAO_FACTORY_ID
    );

    intentsContractId = await sandbox.importMainnetContract(
      INTENTS_CONTRACT_ID,
      INTENTS_CONTRACT_ID
    );

    omftContractId = await sandbox.importMainnetContract(
      OMFT_CONTRACT_ID,
      OMFT_CONTRACT_ID
    );

    // Create creator account with sufficient balance (reduced to conserve sandbox balance)
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      await parseNEAR("100")
    );
    console.log(`✓ Creator account: ${creatorAccountId}`);

    // Create voter account with sufficient balance (reduced to conserve sandbox balance)
    voterAccountId = await sandbox.createAccount(
      "testvoter.near",
      await parseNEAR("100")
    );
    console.log(`✓ Voter account: ${voterAccountId}`);

    // Create voter account with INSUFFICIENT balance (0.05 NEAR)
    // This is less than the 0.1 NEAR threshold for gas/storage costs
    lowBalanceVoterAccountId = await sandbox.createAccount(
      "lowbalancevoter.near",
      await parseNEAR("0.05") // 0.05 NEAR - below the 0.1 NEAR threshold
    );
    console.log(
      `✓ Low balance voter account: ${lowBalanceVoterAccountId} (0.05 NEAR - below 0.1 NEAR threshold)`
    );

    // Create creator account with LOW balance (1 NEAR) - enough to create one proposal
    // After creating the proposal (which costs ~0.1 NEAR bond + gas), they'll have ~0.89 NEAR left
    // But we'll use that balance up, leaving them with < 0.1 NEAR for the delete action
    lowBalanceCreatorAccountId = await sandbox.createAccount(
      "lowbalancecreator.near",
      await parseNEAR("1") // 1 NEAR - enough to create proposal, but will be reduced below threshold
    );
    console.log(
      `✓ Low balance creator account: ${lowBalanceCreatorAccountId} (1 NEAR initially)`
    );

    // Initialize the factory
    await sandbox.functionCall(
      factoryContractId,
      SPUTNIK_DAO_FACTORY_ID,
      "new",
      {},
      "300000000000000"
    );
    console.log("✓ Factory initialized");

    // Initialize intents contract
    await sandbox.functionCall(
      intentsContractId,
      INTENTS_CONTRACT_ID,
      "new",
      {
        config: {
          wnear_id: "wrap.near",
          fees: {
            fee: 1, // 1 basis point = 0.01%
            fee_collector: INTENTS_CONTRACT_ID,
          },
          roles: {
            super_admins: [INTENTS_CONTRACT_ID],
            admins: {},
            grantees: {},
          },
        },
      },
      "300000000000000"
    );
    console.log("✓ Intents contract initialized");

    // Initialize omft contract
    await sandbox.functionCall(
      omftContractId,
      OMFT_CONTRACT_ID,
      "new",
      {
        super_admins: [OMFT_CONTRACT_ID],
        admins: {},
        grantees: {
          DAO: [OMFT_CONTRACT_ID],
          TokenDeployer: [OMFT_CONTRACT_ID],
          TokenDepositer: [OMFT_CONTRACT_ID],
        },
      },
      "300000000000000"
    );
    console.log("✓ OMFT contract initialized");

    // Deploy ETH token on omft contract
    const ethMetadata = await sandbox.viewFunctionMainnet(
      "eth.omft.near",
      "ft_metadata"
    );
    await sandbox.functionCall(
      omftContractId,
      OMFT_CONTRACT_ID,
      "deploy_token",
      {
        token: "eth",
        metadata: ethMetadata,
      },
      "300000000000000",
      await parseNEAR("3")
    );
    console.log("✓ ETH token deployed on OMFT");

    // Deploy USDC token on omft contract
    const usdcMetadata = await sandbox.viewFunctionMainnet(
      "eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
      "ft_metadata"
    );
    await sandbox.functionCall(
      omftContractId,
      OMFT_CONTRACT_ID,
      "deploy_token",
      {
        token: "eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        metadata: usdcMetadata,
      },
      "300000000000000",
      await parseNEAR("3")
    );
    console.log("✓ USDC token deployed on OMFT");

    // Register intents contract for storage on both tokens
    await sandbox.functionCall(
      intentsContractId,
      "eth.omft.near",
      "storage_deposit",
      {
        account_id: INTENTS_CONTRACT_ID,
        registration_only: true,
      },
      "300000000000000",
      await parseNEAR("0.015")
    );

    await sandbox.functionCall(
      intentsContractId,
      "eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
      "storage_deposit",
      {
        account_id: INTENTS_CONTRACT_ID,
        registration_only: true,
      },
      "300000000000000",
      await parseNEAR("0.015")
    );
    console.log("✓ Intents contract registered for token storage");

    // Create a DAO with all three accounts
    const daoName = "assetexchangedao";
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
              purpose: "Test DAO for asset exchange voting with insufficient balance",
              metadata: "",
            },
            policy: {
              roles: [
                {
                  kind: {
                    Group: [creatorAccountId, lowBalanceCreatorAccountId],
                  },
                  name: "Requestor",
                  permissions: ["call:AddProposal", "transfer:AddProposal"],
                  vote_policy: {},
                },
                {
                  kind: {
                    Group: [voterAccountId, lowBalanceVoterAccountId, lowBalanceCreatorAccountId],
                  },
                  name: "Approver",
                  permissions: [
                    "call:VoteApprove",
                    "call:VoteReject",
                    "call:VoteRemove",
                  ],
                  vote_policy: {},
                },
              ],
              default_vote_policy: {
                weight_kind: "RoleWeight",
                quorum: "0",
                threshold: [1, 2],
              },
              proposal_bond: await parseNEAR("0.1"),
              proposal_period: "604800000000000",
              bounty_bond: "100000000000000000000000",
              bounty_forgiveness_period: "86400000000000",
            },
          })
        ).toString("base64"),
      },
      "300000000000000",
      await parseNEAR("6")
    );

    daoAccountId = `${daoName}.${factoryContractId}`;
    console.log(`✓ DAO created: ${daoAccountId}`);

    // Verify DAO was created by checking its policy
    const daoPolicy = await sandbox.viewFunction(daoAccountId, "get_policy", {});
    console.log(
      `✓ DAO policy verified - Approver group has ${daoPolicy.roles[1].kind.Group.length} members:`,
      daoPolicy.roles[1].kind.Group
    );

    // Fund the DAO treasury with NEAR (needed for asset exchange requests)
    // Creator has ~94 NEAR left after DAO creation (spent ~6 NEAR), so fund with 50 NEAR
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "version",
      {},
      "300000000000000",
      await parseNEAR("50")
    );
    console.log("✓ Funded DAO treasury with 50 NEAR");

    // Deposit ETH tokens to treasury via intents
    console.log("\n=== Depositing ETH to Treasury ===\n");
    await sandbox.functionCall(
      omftContractId,
      OMFT_CONTRACT_ID,
      "ft_deposit",
      {
        owner_id: INTENTS_CONTRACT_ID,
        token: "eth",
        amount: "5000000000000000000", // 5 ETH
        msg: JSON.stringify({ receiver_id: daoAccountId }),
        memo: `BRIDGED_FROM:${JSON.stringify({
          networkType: "eth",
          chainId: "1",
          txHash:
            "0xc6b7ecd5c7517a8f56ac7ec9befed7d26a459fc97c7d5cd7598d4e19b5a806b7",
        })}`,
      },
      "300000000000000",
      await parseNEAR("0.00125")
    );

    // Verify ETH balance
    const ethBalance = await sandbox.viewFunction(
      INTENTS_CONTRACT_ID,
      "mt_balance_of",
      {
        account_id: daoAccountId,
        token_id: "nep141:eth.omft.near",
      }
    );
    console.log(`✓ Treasury ETH balance: ${ethBalance} (5 ETH)`);
  });

  test.afterAll(async () => {
    if (sandbox) {
      await sandbox.stop();
      console.log("\n✓ Sandbox stopped");
    }
  });

  test("should show Type 1 warning (user NEAR balance too low) when approving asset exchange in all views", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Create an asset exchange proposal (0.5 ETH → 1500 USDC)
    const addProposalResult = await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: ETH <br>* Token Out: USDC <br>* Amount In: 0.5 <br>* Amount Out: 1500 <br>* Slippage: 1 <br>* Quote Deadline: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()} <br>* Destination Network: eth:1 <br>* Time Estimate: 10 seconds <br>* Deposit Address: 19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177 <br>* Signature: ed25519:mock-signature-12345`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(JSON.stringify({
                    receiver_id: "19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177",
                    amount: "500000000000000000",
                    token_id: "nep141:eth.omft.near"
                  })).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000"
                }
              ]
            }
          }
        }
      },
      "300000000000000",
      await parseNEAR("0.1")
    );
    console.log(JSON.stringify(addProposalResult, null, 1));
    console.log("✓ Asset exchange proposal created");

    await page.waitForTimeout(2000);
    // Set up page with interceptors
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);

    // Inject test wallet with LOW BALANCE voter
    await injectTestWallet(page, sandbox, lowBalanceVoterAccountId);

    // Navigate to asset exchange page
    const targetUrl = `http://localhost:3000/${daoAccountId}/asset-exchange`;
    console.log(`Navigating to: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForTimeout(3000);

    // Debug: Check current URL and page title
    console.log(`Current URL: ${page.url()}`);
    const pageContent = await page.textContent("body");
    console.log(
      `Page shows treasury content: ${pageContent.includes("No Treasuries Found")}`
    );

    // === TEST 1: TABLE VIEW ===
    console.log("\n=== Testing Table View ===");

    // Find and click Approve button in table
    const approveButtonTable = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButtonTable).toBeVisible({ timeout: 10000 });
    await approveButtonTable.click();

    // Assert Type 1 warning modal appears
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(
        /you don't have enough NEAR to complete actions on your treasury/i
      )
    ).toBeVisible();

    // Should show required balance threshold
    await expect(page.getByText(/You need at least/i)).toBeVisible();

    // Wait for video recording
    await page.waitForTimeout(1000);

    // User can dismiss the warning by clicking the close button
    let closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning displayed and dismissed correctly in table view");

    // === TEST 2: OVERLAY VIEW ===
    console.log("\n=== Testing Overlay View ===");

    // Click on the first row to open overlay modal
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Wait for overlay modal to open
    await page.waitForTimeout(1000);

    // Find and click Approve button in overlay (use .last() since overlay is rendered after table)
    const approveButtonOverlay = page.getByRole("button", { name: "Approve" }).last();
    await expect(approveButtonOverlay).toBeVisible({ timeout: 10000 });
    await approveButtonOverlay.click();

    // Assert Type 1 warning modal appears in overlay context
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(
        /you don't have enough NEAR to complete actions on your treasury/i
      )
    ).toBeVisible();

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss the warning
    closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning displayed and dismissed correctly in overlay view");

    // Close the overlay by clicking outside or pressing ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // === TEST 3: FULLPAGE VIEW ===
    console.log("\n=== Testing Fullpage View ===");

    // Navigate back to table view
    await page.goto(`http://localhost:3000/${daoAccountId}/asset-exchange`);
    await page.waitForTimeout(2000);

    // Click on the first row to open overlay
    const firstRowForExpand = page.locator('tbody tr').first();
    await expect(firstRowForExpand).toBeVisible({ timeout: 10000 });
    await firstRowForExpand.click();
    await page.waitForTimeout(1000);

    // Click the expand button to go to full page view
    const expandButton = page.locator('.bi.bi-arrows-angle-expand');
    await expect(expandButton).toBeVisible({ timeout: 5000 });
    await expandButton.click();
    await page.waitForTimeout(2000);

    // Find and click Approve button on fullpage
    const approveButtonFullpage = page.getByRole("button", { name: "Approve" });
    await expect(approveButtonFullpage).toBeVisible({ timeout: 10000 });
    await approveButtonFullpage.click();

    // Assert Type 1 warning modal appears in fullpage context
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(
        /you don't have enough NEAR to complete actions on your treasury/i
      )
    ).toBeVisible();

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss the warning
    closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning displayed and dismissed correctly in fullpage view");
    console.log("\n✓ All three views tested successfully!");
  });

  test("should show Type 1 warning (user NEAR balance too low) when rejecting asset exchange in all views", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Create an asset exchange proposal (1 ETH → 3000 USDC)
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: ETH <br>* Token Out: USDC <br>* Amount In: 1 <br>* Amount Out: 3000 <br>* Slippage: 1 <br>* Quote Deadline: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()} <br>* Destination Network: eth:1 <br>* Time Estimate: 10 seconds <br>* Deposit Address: 19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177 <br>* Signature: ed25519:mock-signature-12345`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(JSON.stringify({
                    receiver_id: "19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177",
                    amount: "1000000000000000000",
                    token_id: "nep141:eth.omft.near"
                  })).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000"
                }
              ]
            }
          }
        }
      },
      "300000000000000",
      await parseNEAR("0.1")
    );

    await page.waitForTimeout(2000);
    // Set up page with low balance voter
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);
    await injectTestWallet(page, sandbox, lowBalanceVoterAccountId);

    await page.goto(
      `http://localhost:3000/${daoAccountId}/asset-exchange`
    );
    await page.waitForTimeout(3000);

    // === TEST 1: TABLE VIEW ===
    console.log("\n=== Testing Reject in Table View ===");

    // Click Reject button in table
    const rejectButtonTable = page.getByRole("button", { name: "Reject" }).first();
    await expect(rejectButtonTable).toBeVisible({ timeout: 10000 });
    await rejectButtonTable.click();

    // Assert warning appears
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss and verify it can be closed
    let closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning shown for Reject in table view");

    // === TEST 2: OVERLAY VIEW ===
    console.log("\n=== Testing Reject in Overlay View ===");

    // Click on the first row to open overlay modal
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Wait for overlay modal to open
    await page.waitForTimeout(1000);

    // Find and click Reject button in overlay (use .last() since overlay is rendered after table)
    const rejectButtonOverlay = page.getByRole("button", { name: "Reject" }).last();
    await expect(rejectButtonOverlay).toBeVisible({ timeout: 10000 });
    await rejectButtonOverlay.click();

    // Assert warning appears
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss
    closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning shown for Reject in overlay view");

    // Close the overlay
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // === TEST 3: FULLPAGE VIEW ===
    console.log("\n=== Testing Reject in Fullpage View ===");

    // Navigate back to table view
    await page.goto(`http://localhost:3000/${daoAccountId}/asset-exchange`);
    await page.waitForTimeout(2000);

    // Click on the first row (reject test proposal - we're still viewing this one) to open overlay
    const rowForExpandReject = page.locator('tbody tr').first();
    await expect(rowForExpandReject).toBeVisible({ timeout: 10000 });
    await rowForExpandReject.click();
    await page.waitForTimeout(1000);

    // Click the expand button to go to full page view
    const expandButton = page.locator('.bi.bi-arrows-angle-expand');
    await expect(expandButton).toBeVisible({ timeout: 5000 });
    await expandButton.click();
    await page.waitForTimeout(2000);

    // Find and click Reject button on fullpage
    const rejectButtonFullpage = page.getByRole("button", { name: "Reject" });
    await expect(rejectButtonFullpage).toBeVisible({ timeout: 10000 });
    await rejectButtonFullpage.click();

    // Assert warning appears
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss
    closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning shown for Reject in fullpage view");
    console.log("\n✓ All three views tested successfully for Reject!");
  });

  test("should show Type 1 warning (user NEAR balance too low) when deleting asset exchange in all views", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Create an asset exchange proposal with low-balance creator (starts with 1 NEAR) (0.3 ETH → 900 USDC)
    await sandbox.functionCall(
      lowBalanceCreatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: ETH <br>* Token Out: USDC <br>* Amount In: 0.3 <br>* Amount Out: 900 <br>* Slippage: 1 <br>* Quote Deadline: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()} <br>* Destination Network: eth:1 <br>* Time Estimate: 10 seconds <br>* Deposit Address: 19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177 <br>* Signature: ed25519:mock-signature-12345`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(JSON.stringify({
                    receiver_id: "19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177",
                    amount: "300000000000000000",
                    token_id: "nep141:eth.omft.near"
                  })).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000"
                }
              ]
            }
          }
        }
      },
      "300000000000000",
      await parseNEAR("0.1")
    );

    // Now drain the creator's balance to below 0.1 NEAR by transferring most of it away
    // Creator should have ~0.89 NEAR left after creating proposal
    // Transfer 0.85 NEAR away, leaving ~0.04 NEAR (below 0.1 NEAR threshold)
    await sandbox.transfer(
      lowBalanceCreatorAccountId,
      voterAccountId,
      await parseNEAR("0.85")
    );

    await page.waitForTimeout(2000);
    // Set up page with low balance creator (who created the proposal and can delete it)
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);
    await injectTestWallet(page, sandbox, lowBalanceCreatorAccountId);

    await page.goto(
      `http://localhost:3000/${daoAccountId}/asset-exchange`
    );
    await page.waitForTimeout(3000);

    // === TEST 1: TABLE VIEW ===
    console.log("\n=== Testing Delete in Table View ===");

    // Click Delete button (trash icon) in table
    const deleteButtonTable = page.getByTestId("delete-btn").first();
    await expect(deleteButtonTable).toBeVisible({ timeout: 10000 });
    await deleteButtonTable.click();

    // Assert warning appears
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss
    let closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning shown for Delete in table view");

    // === TEST 2: OVERLAY VIEW ===
    console.log("\n=== Testing Delete in Overlay View ===");

    // Click on the first row to open overlay modal
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Wait for overlay modal to open
    await page.waitForTimeout(1000);

    // Find and click Delete button in overlay (use .last() since overlay is rendered after table)
    const deleteButtonOverlay = page.getByTestId("delete-btn").last();
    await expect(deleteButtonOverlay).toBeVisible({ timeout: 10000 });
    await deleteButtonOverlay.click();

    // Assert warning appears
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss - use force click since modal might be animating
    closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning shown for Delete in overlay view");

    // Close the overlay
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // === TEST 3: FULLPAGE VIEW ===
    console.log("\n=== Testing Delete in Fullpage View ===");

    // Navigate back to table view
    await page.goto(`http://localhost:3000/${daoAccountId}/asset-exchange`);
    await page.waitForTimeout(2000);

    // Click on the first row (delete test proposal - we're still viewing this one) to open overlay
    const rowForExpand = page.locator('tbody tr').first();
    await expect(rowForExpand).toBeVisible({ timeout: 10000 });
    await rowForExpand.click();
    await page.waitForTimeout(1000);

    // Click the expand button to go to full page view
    const expandButtonDelete = page.locator('.bi.bi-arrows-angle-expand');
    await expect(expandButtonDelete).toBeVisible({ timeout: 5000 });
    await expandButtonDelete.click();
    await page.waitForTimeout(2000);

    // Find and click Delete button on fullpage
    const deleteButtonFullpage = page.getByTestId("delete-btn");
    await expect(deleteButtonFullpage).toBeVisible({ timeout: 10000 });
    await deleteButtonFullpage.click();

    // Assert warning appears
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).toBeVisible({ timeout: 5000 });

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Dismiss
    closeButton = page.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click({ force: true });

    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    console.log("✓ Type 1 warning shown for Delete in fullpage view");
    console.log("\n✓ All three views tested successfully for Delete!");
  });

  test("should show Type 2 warning (treasury balance too low) with Proceed Anyway option", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Create an asset exchange proposal for MORE than the treasury has (Treasury has 5 ETH, request 10 ETH → 30000 USDC)
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: ETH <br>* Token Out: USDC <br>* Amount In: 10 <br>* Amount Out: 30000 <br>* Slippage: 1 <br>* Quote Deadline: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()} <br>* Destination Network: eth:1 <br>* Time Estimate: 10 seconds <br>* Deposit Address: 19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177 <br>* Signature: ed25519:mock-signature-12345`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(JSON.stringify({
                    receiver_id: "19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177",
                    amount: "10000000000000000000",
                    token_id: "nep141:eth.omft.near"
                  })).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000"
                }
              ]
            }
          }
        }
      },
      "300000000000000",
      await parseNEAR("0.1")
    );

    await page.waitForTimeout(2000);
    // Set up page with SUFFICIENT balance voter (to avoid Type 1 warning)
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);
    await injectTestWallet(page, sandbox, voterAccountId);

    await page.goto(
      `http://localhost:3000/${daoAccountId}/asset-exchange`
    );
    await page.waitForTimeout(3000);

    // Click Approve button
    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await approveButton.click();

    // Assert Type 2 warning modal appears (treasury balance warning)
    await expect(
      page.getByRole("heading", { name: /Insufficient Balance/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(
        /Your current balance is not enough to complete this transaction/i
      )
    ).toBeVisible();

    // Should show comparison
    await expect(page.getByText(/Transaction amount:/i)).toBeVisible();
    await expect(page.getByText(/Your current balance:/i)).toBeVisible();

    // Should have "Proceed Anyway" button
    const proceedButton = page.getByRole("button", { name: /Proceed Anyway/i });
    await expect(proceedButton).toBeVisible();

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Test Cancel path
    const cancelButton = page.getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    await expect(
      page.getByRole("heading", { name: /Insufficient Balance/i })
    ).not.toBeVisible();

    console.log("✓ Type 2 warning displayed with Proceed Anyway option");
  });

  test("should allow proceeding with Type 2 warning and show confirmation modal", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Create an asset exchange proposal exceeding treasury balance (8 ETH → 24000 USDC, exceeds 5 ETH treasury)
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: ETH <br>* Token Out: USDC <br>* Amount In: 8 <br>* Amount Out: 24000 <br>* Slippage: 1 <br>* Quote Deadline: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()} <br>* Destination Network: eth:1 <br>* Time Estimate: 10 seconds <br>* Deposit Address: 19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177 <br>* Signature: ed25519:mock-signature-12345`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(JSON.stringify({
                    receiver_id: "19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177",
                    amount: "8000000000000000000",
                    token_id: "nep141:eth.omft.near"
                  })).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000"
                }
              ]
            }
          }
        }
      },
      "300000000000000",
      await parseNEAR("0.1")
    );

    await page.waitForTimeout(2000);
    // Set up page
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);
    await injectTestWallet(page, sandbox, voterAccountId);

    await page.goto(
      `http://localhost:3000/${daoAccountId}/asset-exchange`
    );
    await page.waitForTimeout(3000);

    // Click Approve
    await page.getByRole("button", { name: "Approve" }).first().click();

    // Wait for Type 2 warning
    await expect(
      page.getByRole("heading", { name: /Insufficient Balance/i })
    ).toBeVisible({ timeout: 5000 });

    // Wait for video recording
    await page.waitForTimeout(1000);

    // Click "Proceed Anyway"
    await page.getByRole("button", { name: /Proceed Anyway/i }).click();

    // Should show confirmation modal
    await expect(
      page.getByRole("heading", { name: /Confirm your vote/i })
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByText(/Are you sure you want to vote to approve this request/i)
    ).toBeVisible();

    console.log("✓ Proceed Anyway flow works correctly");
  });

  test("should NOT show warning when user has sufficient NEAR balance", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Create a normal asset exchange proposal (2 ETH → 6000 USDC, within 5 ETH treasury)
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: ETH <br>* Token Out: USDC <br>* Amount In: 2 <br>* Amount Out: 6000 <br>* Slippage: 1 <br>* Quote Deadline: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()} <br>* Destination Network: eth:1 <br>* Time Estimate: 10 seconds <br>* Deposit Address: 19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177 <br>* Signature: ed25519:mock-signature-12345`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(JSON.stringify({
                    receiver_id: "19b04b5b8e1b5480c29a0ce7ec1ca84067fb8d7485165b176274a271e824f177",
                    amount: "2000000000000000000",
                    token_id: "nep141:eth.omft.near"
                  })).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000"
                }
              ]
            }
          }
        }
      },
      "300000000000000",
      await parseNEAR("0.1")
    );

    await page.waitForTimeout(2000);
    // Set up page with SUFFICIENT balance voter
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);
    await injectTestWallet(page, sandbox, voterAccountId);

    await page.goto(
      `http://localhost:3000/${daoAccountId}/asset-exchange`
    );
    await page.waitForTimeout(3000);

    // Click Approve
    await page.getByRole("button", { name: "Approve" }).first().click();

    // Should go directly to confirmation modal (no warning)
    await expect(
      page.getByRole("heading", { name: /Confirm your vote/i })
    ).toBeVisible({ timeout: 5000 });

    // Should NOT show insufficient balance warnings
    await expect(
      page.getByRole("heading", { name: /Insufficient Funds/i })
    ).not.toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Insufficient Balance/i })
    ).not.toBeVisible();

    console.log("✓ No warning shown when balance is sufficient");
  });
});

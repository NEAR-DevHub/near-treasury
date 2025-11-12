import { test } from "../../util/test.js";
import { expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  interceptRPC,
  parseNEAR,
} from "../../util/sandbox.js";
import { NearRpcClient, query } from "@near-js/jsonrpc-client";

/**
 * Bug reproduction tests for issue #61:
 * Asset Exchange requests for USDT show "Insufficient balance" error due to network mismatch
 *
 * Scenario from prod (romakqatesting.sputnik-dao.near proposal #43):
 * - Treasury has USDT on NEAR network (usdt.tether-token.near)
 * - User creates proposal to swap USDT on TRX network (tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near)
 * - Dashboard shows "USDT" without indicating which network
 * - User assumes they have USDT TRX but actually have USDT NEAR
 * - Result: Insufficient balance warning appears (correctly, but confusingly)
 *
 * These tests verify:
 * 1. Token network mismatch causes insufficient balance warning
 * 2. Same network tokens work correctly without warning
 *
 * Technical implementation:
 * - Creates usdt.tether-token.near as subaccount of tether-token.near
 * - Deploys wrap.near contract (FT standard) to simulate USDT token
 * - Deposits tokens to intents contract via ft_transfer_call
 * - Verifies insufficient balance warning appears for network mismatch
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const INTENTS_CONTRACT_ID = "intents.near";
const OMFT_CONTRACT_ID = "omft.near";

let sandbox;
let factoryContractId;
let intentsContractId;
let omftContractId;
let tetherTokenContractId;
let creatorAccountId;
let daoAccountId;
let voterAccountId;

test.describe("Asset Exchange USDT TRX Bug Reproduction - Issue #61", () => {
  test.beforeAll(async () => {
    test.setTimeout(600000); // 10 minutes for setup

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Setting up sandbox for USDT TRX bug reproduction ===\n");

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

    // Create tether-token.near parent account
    const tetherParentAccountId = await sandbox.createAccount(
      "tether-token.near",
      await parseNEAR("100")
    );
    console.log(`✓ Created parent account: ${tetherParentAccountId}`);

    // Create usdt.tether-token.near as subaccount and deploy wrap.near contract
    tetherTokenContractId = await sandbox.createAccount(
      "usdt.tether-token.near",
      await parseNEAR("50"),
      tetherParentAccountId
    );
    console.log(`✓ Created USDT subaccount: ${tetherTokenContractId}`);

    // Fetch wrap.near contract WASM from mainnet and deploy to usdt.tether-token.near
    const mainnetRpcClient = new NearRpcClient(
      "https://rpc.mainnet.fastnear.com"
    );
    const contractCode = await query(mainnetRpcClient, {
      requestType: "view_code",
      finality: "final",
      accountId: "wrap.near",
    });
    const wrapNearWasm = contractCode.codeBase64
      ? Buffer.from(contractCode.codeBase64, "base64")
      : null;
    if (!wrapNearWasm) {
      throw new Error("No contract code found for wrap.near");
    }
    await sandbox.deployContract(tetherTokenContractId, wrapNearWasm);
    console.log(`✓ Deployed wrap.near contract to ${tetherTokenContractId}`);

    // Initialize with USDT metadata
    await sandbox.functionCall(
      tetherTokenContractId,
      tetherTokenContractId,
      "new",
      {},
      "300000000000000"
    );
    console.log("✓ USDT token contract initialized");

    // Create test accounts
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      await parseNEAR("100")
    );
    console.log(`✓ Creator account: ${creatorAccountId}`);

    voterAccountId = await sandbox.createAccount(
      "testvoter.near",
      await parseNEAR("100")
    );
    console.log(`✓ Voter account: ${voterAccountId}`);

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
            fee: 1,
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

    // Create DAO with proper permissions for asset exchange (call:Vote*)
    const daoName = "usdttrxdao";
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
              purpose: "Test DAO for USDT TRC20 bug reproduction",
              metadata: "",
            },
            policy: {
              roles: [
                {
                  kind: {
                    Group: [creatorAccountId],
                  },
                  name: "Requestor",
                  permissions: ["call:AddProposal", "transfer:AddProposal"],
                  vote_policy: {},
                },
                {
                  kind: {
                    Group: [voterAccountId, creatorAccountId],
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

    // Fund DAO treasury with NEAR
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "deposit",
      {},
      "300000000000000",
      await parseNEAR("50")
    );
    console.log("✓ Funded DAO treasury with 50 NEAR");

    // Now deposit USDT from the real usdt.tether-token.near contract to the intents contract
    console.log("\n=== Depositing USDT NEAR to Treasury ===\n");

    // Register the intents contract with the USDT token for storage
    await sandbox.functionCall(
      creatorAccountId,
      tetherTokenContractId,
      "storage_deposit",
      {
        account_id: intentsContractId,
      },
      "300000000000000",
      await parseNEAR("0.00125")
    );
    console.log("✓ Registered intents contract with USDT token");

    // Also register DAO for storage (though it receives via intents)
    await sandbox.functionCall(
      creatorAccountId,
      tetherTokenContractId,
      "storage_deposit",
      {
        account_id: daoAccountId,
      },
      "300000000000000",
      await parseNEAR("0.00125")
    );
    console.log("✓ Registered DAO with USDT token");

    // Mint some USDT to the creator account (wrap.near allows minting for testing)
    await sandbox.functionCall(
      creatorAccountId,
      tetherTokenContractId,
      "near_deposit",
      {},
      "300000000000000",
      await parseNEAR("3") // Deposit 3 NEAR to get wNEAR (simulating USDT)
    );

    // Transfer USDT to DAO via intents contract using ft_transfer_call
    const tranfer_result = await sandbox.functionCall(
      creatorAccountId,
      tetherTokenContractId,
      "ft_transfer_call",
      {
        receiver_id: intentsContractId,
        amount: "2000000", // 2 USDT (we'll use 6 decimals like real USDT)
        msg: JSON.stringify({ receiver_id: daoAccountId }),
      },
      "300000000000000",
      "1"
    );

    console.log(JSON.stringify(tranfer_result));
    console.log("✓ Deposited 2 USDT NEAR to treasury");

    // Deploy USDT TRC20 token (so the proposal can reference it, but DAO won't have any)
    console.log(
      "\n=== Deploying USDT TRC20 token (DAO will NOT have this) ===\n"
    );

    const usdtTrc20Metadata = {
      spec: "ft-1.0.0",
      name: "Tether USD (TRC20)",
      symbol: "USDT",
      icon: null,
      reference: null,
      reference_hash: null,
      decimals: 6,
    };

    await sandbox.functionCall(
      omftContractId,
      OMFT_CONTRACT_ID,
      "deploy_token",
      {
        token: "tron-d28a265909efecdcee7c5028585214ea0b96f015",
        metadata: usdtTrc20Metadata,
      },
      "300000000000000",
      await parseNEAR("3")
    );
    console.log("✓ USDT TRC20 token deployed (for reference in proposal)");
  });

  test.afterAll(async () => {
    await sandbox?.stop();
  });

  test("should show insufficient balance when USDT network mismatch (has NEAR, needs TRX)", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Create an asset exchange proposal matching prod (romakqatesting.sputnik-dao.near proposal #43)
    // Treasury has USDT NEAR but proposal tries to swap USDT TRX → TRX
    // Requesting to swap 1 USDT TRX (treasury has 2 USDT NEAR, but 0 USDT TRX)
    const deadline = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${deadline}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: USDT <br>* Token Out: TRX <br>* Amount In: 1.0 <br>* Amount Out: 3.489863 <br>* Slippage: 1 <br>* Quote Deadline: ${deadline} <br>* Destination Network: tron:mainnet <br>* Time Estimate: 10 seconds <br>* Deposit Address: b787d39a440943ec04aef938c0803118e56f43d173c2282913725f615bac86b2 <br>* Signature: ed25519:396dg4YzqUt7DU1oCFXZSziboQyYxTNAhnTFzrGgSrFmny71ksC573MivHbhStA4wBEmRMptwJNThToBimTPF84M`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(
                    JSON.stringify({
                      receiver_id:
                        "b787d39a440943ec04aef938c0803118e56f43d173c2282913725f615bac86b2",
                      amount: "1000000", // 1 USDT TRX (6 decimals) - matching prod
                      token_id:
                        "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near", // USDT TRX token ID
                    })
                  ).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000",
                },
              ],
            },
          },
        },
      },
      "300000000000000",
      await parseNEAR("0.1")
    );

    console.log(
      "✓ Created USDT TRX → TRX asset exchange proposal (network mismatch scenario)"
    );

    await page.waitForTimeout(2000);

    // Set up page with voter account
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);
    await injectTestWallet(page, sandbox, voterAccountId);

    // First navigate to dashboard to visually confirm USDT balance is displayed
    console.log("\n=== Verifying USDT NEAR balance on dashboard ===");
    await page.goto(`http://localhost:3000/${daoAccountId}/dashboard`);
    await page.waitForTimeout(5000);

    // Look for the NEAR Intents portfolio section
    const intentsPortfolio = page.getByTestId("intents-portfolio");
    await expect(intentsPortfolio).toBeVisible({ timeout: 10000 });
    console.log("✓ NEAR Intents portfolio section is visible");

    // Check if USDT is displayed
    const usdtElement = intentsPortfolio.getByText(/USDT/i);
    await expect(usdtElement).toBeVisible({ timeout: 10000 });
    const usdtText = await usdtElement.textContent();
    console.log("✓ USDT token is displayed in Intents portfolio");
    console.log(`  Dashboard shows: ${usdtText}`);
    console.log(
      "  NOTE: Dashboard shows 'USDT' but doesn't clearly indicate it's on NEAR network"
    );

    // Take a screenshot of the dashboard
    await page.screenshot({
      path: "test-results/usdt-network-mismatch-dashboard.png",
      fullPage: true,
    });
    console.log(
      "✓ Screenshot saved: test-results/usdt-network-mismatch-dashboard.png"
    );

    // Navigate to asset exchange page to see the proposal
    console.log("\n=== Viewing USDT TRX proposal (network mismatch) ===");
    await page.goto(`http://localhost:3000/${daoAccountId}/asset-exchange`);
    await page.waitForTimeout(3000);

    // Click Approve button on the existing proposal
    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });

    console.log("\n=== Clicking Approve button for USDT TRX → TRX swap ===");
    await approveButton.click();

    // EXPECTED: Insufficient balance warning should appear due to network mismatch
    // Treasury has 2 USDT NEAR but proposal needs 1 USDT TRX
    // Wait a moment to see if warning appears
    await page.waitForTimeout(2000);

    // Check if insufficient balance warning appeared (it should!)
    const insufficientBalanceHeading = page.getByRole("heading", {
      name: /Insufficient Balance/i,
    });

    // This test EXPECTS the warning to appear
    await expect(insufficientBalanceHeading).toBeVisible({ timeout: 5000 });
    console.log(
      "✓ EXPECTED BEHAVIOR: Insufficient balance warning appeared correctly!"
    );
    console.log(
      "   Treasury has 2 USDT NEAR, but proposal needs 1 USDT TRX (network mismatch)"
    );

    // Take a screenshot
    await page.screenshot({
      path: "test-results/usdt-network-mismatch.png",
      fullPage: true,
    });

    // Get the balance display to see what it thinks the balance is
    const balanceText = await page
      .getByText(/Your current balance:/i)
      .textContent();
    console.log("   Warning shows:", balanceText);

    console.log("\n✓ Scenario successfully reproduced!");
    console.log(
      "  This matches prod (romakqatesting.sputnik-dao.near proposal #43):"
    );
    console.log(`    - Treasury has: ${tetherTokenContractId} (USDT NEAR)`);
    console.log(
      "    - Proposal needs: tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near (USDT TRX)"
    );
    console.log("    - Dashboard shows: 'USDT' without network indicator");
    console.log(
      "    - Result: User confused about which USDT network they have"
    );

    // Wait for video recording
    await page.waitForTimeout(1000);
  });

  test("should NOT show insufficient balance when USDT network matches (has TRX, needs TRX)", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // For this test, we need to deposit USDT TRX and create a proposal that matches
    console.log("\n=== Setting up USDT TRX balance for second test ===");

    // Register intents contract with OMFT for storage
    await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "storage_deposit",
      {
        account_id: intentsContractId,
      },
      "300000000000000",
      await parseNEAR("0.00125")
    );
    console.log("✓ Registered intents.near with OMFT contract");

    // Also register intents with the USDT TRX token contract
    const usdtTrxTokenId =
      "tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near";
    await sandbox.functionCall(
      omftContractId,
      usdtTrxTokenId,
      "storage_deposit",
      {
        account_id: intentsContractId,
      },
      "300000000000000",
      await parseNEAR("0.00125")
    );
    console.log(`✓ Registered intents.near with ${usdtTrxTokenId}`);

    // Deposit USDT TRX to treasury
    const depositUsdtTrxResult = await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "ft_deposit",
      {
        owner_id: intentsContractId,
        token: "tron-d28a265909efecdcee7c5028585214ea0b96f015",
        amount: "2000000", // 2 USDT TRX (6 decimals)
        msg: JSON.stringify({ receiver_id: daoAccountId }),
        memo: `BRIDGED_FROM:${JSON.stringify({
          networkType: "trx",
          chainId: "0x2b6653dc",
          txHash: "0xtest-trx-deposit-hash",
        })}`,
      },
      "300000000000000",
      "1250000000000000000000"
    );
    console.log(
      "✓ Deposited 2 USDT TRX to treasury",
      JSON.stringify(depositUsdtTrxResult)
    );

    // Create a USDT TRX → TRX proposal (matching the TRX balance we just added)
    const deadline = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: {
          description: `* Proposal Action: asset-exchange <br>* Notes: **Must be executed before ${deadline}** for transferring tokens to 1Click's deposit address for swap execution. <br>* Token In: USDT (TRX) <br>* Token Out: TRX <br>* Amount In: 1.0 <br>* Amount Out: 3.489863 <br>* Slippage: 1 <br>* Quote Deadline: ${deadline} <br>* Destination Network: tron:mainnet <br>* Time Estimate: 10 seconds <br>* Deposit Address: b787d39a440943ec04aef938c0803118e56f43d173c2282913725f615bac86b2 <br>* Signature: ed25519:396dg4YzqUt7DU1oCFXZSziboQyYxTNAhnTFzrGgSrFmny71ksC573MivHbhStA4wBEmRMptwJNThToBimTPF84M`,
          kind: {
            FunctionCall: {
              receiver_id: intentsContractId,
              actions: [
                {
                  method_name: "mt_transfer",
                  args: Buffer.from(
                    JSON.stringify({
                      receiver_id:
                        "b787d39a440943ec04aef938c0803118e56f43d173c2282913725f615bac86b2",
                      amount: "1000000", // 1 USDT TRX (6 decimals)
                      token_id:
                        "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
                    })
                  ).toString("base64"),
                  deposit: "1",
                  gas: "100000000000000",
                },
              ],
            },
          },
        },
      },
      "300000000000000",
      await parseNEAR("0.1")
    );
    console.log(
      "✓ Created USDT TRX → TRX proposal (treasury has matching USDT TRX balance)"
    );

    await page.waitForTimeout(2000);

    // Set up page
    await interceptIndexerAPI(page, sandbox);
    await interceptRPC(page, sandbox);
    await injectTestWallet(page, sandbox, voterAccountId);

    // Navigate to dashboard to verify USDT TRX balance is displayed
    console.log("\n=== Verifying USDT TRX balance on dashboard ===");
    await page.goto(`http://localhost:3000/${daoAccountId}/dashboard`);
    await page.waitForTimeout(5000);

    // Look for the NEAR Intents portfolio section
    const intentsPortfolio = page.getByTestId("intents-portfolio");
    await expect(intentsPortfolio).toBeVisible({ timeout: 10000 });
    console.log("✓ NEAR Intents portfolio section is visible");

    // Check if USDT is displayed
    const usdtElement = intentsPortfolio.getByText(/USDT/i);
    await expect(usdtElement).toBeVisible({ timeout: 10000 });
    const usdtText = await usdtElement.textContent();
    console.log("✓ USDT token is displayed in Intents portfolio");
    console.log(`  Dashboard shows: ${usdtText}`);
    console.log(
      "  NOTE: Dashboard now shows USDT from both networks (NEAR + TRX)"
    );
    console.log("        but doesn't clearly distinguish between them");

    // Take screenshot
    await page.screenshot({
      path: "test-results/usdt-network-match-dashboard.png",
      fullPage: true,
    });
    console.log(
      "✓ Screenshot saved: test-results/usdt-network-match-dashboard.png"
    );

    // Navigate to asset exchange page
    console.log("\n=== Viewing USDT TRX proposal (network match) ===");
    await page.goto(`http://localhost:3000/${daoAccountId}/asset-exchange`);
    await page.waitForTimeout(3000);

    // Click approve on the USDT TRX proposal (the one from beforeAll)
    // Now that we've added USDT TRX balance, it should NOT show insufficient balance
    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    console.log(
      "✓ Clicking Approve on USDT TRX proposal (now with matching balance)"
    );
    await approveButton.click();

    // EXPECTED: No insufficient balance warning (network matches)
    await page.waitForTimeout(2000);

    const insufficientBalanceHeading = page.getByRole("heading", {
      name: /Insufficient Balance/i,
    });

    // Warning should NOT appear (network matches)
    await expect(insufficientBalanceHeading).not.toBeVisible();
    console.log("✓ EXPECTED: No insufficient balance warning appeared!");
    console.log(
      "   Treasury has 2 USDT TRX and proposal needs 1 USDT TRX (network matches)"
    );

    // Confirm modal should appear instead
    const confirmHeading = page.getByRole("heading", {
      name: /Confirm your vote/i,
    });
    await expect(confirmHeading).toBeVisible({ timeout: 5000 });
    console.log("✓ Confirm modal appeared correctly");

    await page.waitForTimeout(1500);

    // Take screenshot
    await page.screenshot({
      path: "test-results/usdt-network-match-confirm.png",
      fullPage: true,
    });
    console.log("✓ Screenshot saved: confirm modal for matching network");

    console.log("\n✓ Test passed: Network match scenario works correctly!");
    console.log(
      "  - Treasury has: tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near (USDT TRX)"
    );
    console.log(
      "  - Proposal needs: tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near (USDT TRX)"
    );
    console.log(
      "  - Result: No insufficient balance warning (correct behavior)"
    );

    // Wait for video recording
    await page.waitForTimeout(1000);
  });
});

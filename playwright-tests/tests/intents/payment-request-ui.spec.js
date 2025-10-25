import { test, expect } from "@playwright/test";
import { NearSandbox, injectTestWallet, parseNEAR } from "../../util/sandbox.js";

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "0";

let sandbox;
let omftContractId;
let intentsContractId;
let factoryContractId;
let creatorAccountId;
let daoAccountId;
let nativeToken;

async function selectIntentsWallet(page) {
  const canvasLocator = page.locator(".offcanvas-body");
  await expect(canvasLocator.getByText("Treasury Wallet")).toBeVisible();
  await canvasLocator.getByRole("button", { name: "Select Wallet" }).click();
  await expect(canvasLocator.getByText("NEAR Intents")).toBeVisible();
  await canvasLocator.getByText("NEAR Intents").click();
  await expect(
    canvasLocator.getByRole("button", { name: "Submit" })
  ).toBeVisible({
    timeout: 14_000,
  });
  await page.waitForTimeout(2_000);
}

test.describe("Payment Request UI Flow", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Fetch supported tokens from Defuse API
    const supportedTokens = await fetch("https://bridge.chaindefuser.com/rpc", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: "dontcare",
        jsonrpc: "2.0",
        method: "supported_tokens",
        params: [
          {
            chains: ["btc:mainnet"],
          },
        ],
      }),
    }).then((r) => r.json());

    nativeToken = supportedTokens.result.tokens[0];
    expect(nativeToken.near_token_id).toEqual("btc.omft.near");

    // Import and setup omft.near contract
    omftContractId = await sandbox.importMainnetContract("omft.near", "omft.near");

    // Fetch BTC token metadata from mainnet
    const btcMetadata = await sandbox.viewFunctionMainnet(
      nativeToken.near_token_id,
      "ft_metadata"
    );

    // Initialize omft contract
    await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "new",
      {
        super_admins: ["omft.near"],
        admins: {},
        grantees: {
          DAO: ["omft.near"],
          TokenDeployer: ["omft.near"],
          TokenDepositer: ["omft.near"],
        },
      }
    );

    // Deploy BTC token
    await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "deploy_token",
      {
        token: "btc",
        metadata: btcMetadata,
      },
      "300000000000000",
      await parseNEAR("3")
    );

    // Import and setup intents.near contract
    intentsContractId = await sandbox.importMainnetContract("intents.near", "intents.near");
    await sandbox.functionCall(
      intentsContractId,
      intentsContractId,
      "new",
      {
        config: {
          wnear_id: "wrap.near",
          fees: {
            fee: 100,
            fee_collector: "intents.near",
          },
          roles: {
            super_admins: ["intents.near"],
            admins: {},
            grantees: {},
          },
        },
      }
    );

    // Register intents contract with BTC token storage
    await sandbox.functionCall(
      omftContractId,
      nativeToken.near_token_id,
      "storage_deposit",
      {
        account_id: intentsContractId,
        registration_only: true,
      },
      "30000000000000",
      "1500000000000000000000"
    );

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

    // Create testcreator account
    creatorAccountId = await sandbox.createAccount("testcreator.near");

    // Create testdao using the factory
    const daoName = "testdao";
    const create_testdao_args = {
      name: daoName,
      args: Buffer.from(
        JSON.stringify({
          config: {
            name: daoName,
            purpose: "creating dao treasury",
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

    daoAccountId = `${daoName}.${SPUTNIK_DAO_FACTORY_ID}`;
    console.log(`✓ Created DAO: ${daoAccountId}`);

    // Deposit BTC tokens to DAO via intents
    await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "ft_deposit",
      {
        owner_id: intentsContractId,
        token: "btc",
        amount: "32000000000", // 320 BTC
        msg: JSON.stringify({ receiver_id: daoAccountId }),
        memo: `BRIDGED_FROM:${JSON.stringify({
          networkType: "btc",
          chainId: "1",
          txHash: "0xc6b7ecd5c7517a8f56ac7ec9befed7d26a459fc97c7d5cd7598d4e19b5a806b7",
        })}`,
      },
      "300000000000000",
      "1250000000000000000000"
    );

    console.log("✓ Deposited 320 BTC to DAO via intents");

    console.log("\n=== Setup Complete ===\n");
  });

  test.afterEach(async ({ page }) => {
    // Clean up page routes before closing
    await page.unrouteAll({ behavior: 'ignoreErrors' });
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

  test("should navigate to payment request creation", async ({ page }) => {
    test.setTimeout(120000); // 2 minutes

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('Browser page error:', error.message);
    });

    // Inject test wallet before navigation
    await injectTestWallet(page, sandbox, creatorAccountId);
    console.log(`✓ Injected test wallet for: ${creatorAccountId}`);

    // Get sandbox RPC URL
    const sandboxRpcUrl = sandbox.getRpcUrl();
    console.log(`✓ Sandbox RPC URL: ${sandboxRpcUrl}`);

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

    // Also route rpc.mainnet.near.org in case it's used
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

    // Navigate to the treasury application payments page for the DAO
    const treasuryUrl = `http://localhost:3000/${daoAccountId}/payments`;
    await page.goto(treasuryUrl);

    console.log(`✓ Navigated to: ${treasuryUrl}`);

    // Set localStorage after page loads
    await page.evaluate(() => {
      localStorage.setItem('selected-wallet', 'test-wallet');
    });
    console.log("✓ Set localStorage selected-wallet");

    // Reload to apply localStorage changes
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait a moment for React to hydrate and wallet to connect
    await page.waitForTimeout(3000);

    console.log("✓ Page loaded with authenticated user");

    // Click Create Request button
    const createRequestButton = await page.getByText("Create Request");
    await createRequestButton.click();
    console.log("✓ Clicked 'Create Request' button");

    // Verify payment request modal/page is visible
    await expect(page.getByText("Create Payment Request")).toBeVisible();
    console.log("✓ Payment request creation modal visible");

    // Select intents wallet
    await selectIntentsWallet(page);
    console.log("✓ Selected NEAR Intents wallet");

    // Open tokens dropdown and verify BTC is available
    await page.getByTestId("tokens-dropdown").locator("div").first().click();

    // Wait for the token selection modal to appear
    await expect(page.getByRole('heading', { name: 'Select Token' })).toBeVisible();

    // Verify BTC is available with the balance
    await expect(page.getByText("BTC", { exact: true })).toBeVisible();
    await expect(page.getByText("320.00 through BTC")).toBeVisible();
    console.log("✓ BTC token is available in dropdown");

    // Select BTC token - try clicking on a more specific element
    // Look for a clickable container that has both BTC text and the balance info
    await page.locator('.modal-body').getByText("BTC", { exact: true }).click({ force: true });

    // Wait for modal to close
    await expect(page.getByRole('heading', { name: 'Select Token' })).not.toBeVisible({ timeout: 10000 });
    console.log("✓ Selected BTC token");

    // Wait for form to update after token selection
    await page.waitForTimeout(1000);

    // Fill in Title field
    await page.getByRole('textbox', { name: 'Title' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill("btc proposal title");
    console.log("✓ Filled title");

    // Fill in Summary field
    await page.getByRole('textbox', { name: 'Summary' }).click();
    await page.getByRole('textbox', { name: 'Summary' }).fill("describing the btc payment request proposal");
    console.log("✓ Filled summary");

    // Fill in BTC recipient address
    await page.getByRole('textbox', { name: 'Enter BTC Address (e.g., bc1' }).click();
    await page.getByRole('textbox', { name: 'Enter BTC Address (e.g., bc1' }).fill("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
    console.log("✓ Filled BTC recipient address");

    // Fill in amount
    await page.getByRole('spinbutton', { name: 'Total Amount' }).click();
    await page.getByRole('spinbutton', { name: 'Total Amount' }).fill("2");
    console.log("✓ Filled amount: 2 BTC");

    // Verify no validation errors and submit button is enabled
    await expect(
      page.getByText("Please enter valid account ID")
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeEnabled();

    // Take screenshot before submitting
    await page.screenshot({
      path: "playwright-tests/screenshots/payment-request-filled.png",
      fullPage: true
    });

    // Submit the form
    await page.getByRole("button", { name: "Submit" }).click();
    console.log("✓ Clicked Submit button");

    // Wait for transaction to be signed and sent by our test wallet
    // Note: New UI doesn't have a confirmation modal, wallet signs directly
    await page.waitForTimeout(3000);
    console.log("✓ Waiting for transaction to complete");

    // Check if there's an error message
    const hasError = await page.getByText("Failed to create payment request").isVisible().catch(() => false);
    if (hasError) {
      console.log("ERROR: Transaction failed to create payment request");
      // Take screenshot of error
      await page.screenshot({
        path: "playwright-tests/screenshots/payment-request-error.png",
        fullPage: true
      });
      throw new Error("Transaction signing failed - check screenshot");
    }

    // The modal should close after successful transaction
    await expect(page.getByText("Create Payment Request")).not.toBeVisible({ timeout: 15000 });
    console.log("✓ Transaction submitted successfully, modal closed");

    // Verify the proposal appears in the table
    await page.waitForTimeout(2000);

    // Take screenshot of the proposal in table
    await page.screenshot({
      path: "playwright-tests/screenshots/payment-request-created.png",
      fullPage: true
    });

    console.log("✓ Payment request created successfully");

    // Verify proposal details in the table
    const proposalRow = page.locator('tbody tr').first();
    await expect(proposalRow).toContainText("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
    await expect(proposalRow).toContainText("BTC");
    await expect(proposalRow).toContainText("2");
    console.log("✓ Proposal details verified in table");

    // Click on the proposal to open details
    await proposalRow.click();
    await page.waitForTimeout(2000);

    // Verify balance before approval
    const balanceBefore = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: ["nep141:btc.omft.near"],
      }
    );
    expect(balanceBefore).toEqual(["32000000000"]); // 320 BTC with 8 decimals
    console.log("✓ Balance before approval: 320 BTC");

    // Click Approve button
    await page.getByRole("button", { name: "Approve" }).nth(1).click();
    console.log("✓ Clicked Approve button");

    // Confirm approval
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Confirm Transaction")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    console.log("✓ Confirmed approval");

    // Wait for success message
    await expect(
      page.getByText("The payment request has been successfully executed.")
    ).toBeVisible({ timeout: 15_000 });
    console.log("✓ Payment request executed successfully");

    // Verify balance after approval (should be 318 BTC = 320 - 2)
    await page.waitForTimeout(1000);
    const balanceAfter = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: ["nep141:btc.omft.near"],
      }
    );
    expect(balanceAfter).toEqual(["31800000000"]); // 318 BTC with 8 decimals
    console.log("✓ Balance after approval: 318 BTC");

    // Navigate to Dashboard and verify balance
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(1000);

    const btcRowLocator = page
      .getByTestId("intents-portfolio")
      .locator(
        'div.d-flex.flex-column:has(div.h6.mb-0.text-truncate:has-text("BTC"))'
      );
    const btcAmountElement = btcRowLocator.locator(
      "div.d-flex.gap-2.align-items-center.justify-content-end div.d-flex.flex-column.align-items-end div.h6.mb-0"
    );
    await expect(btcAmountElement).toBeAttached();
    await btcAmountElement.scrollIntoViewIfNeeded();
    // With intelligent formatting, 318 BTC displays as "318" (no trailing zeros)
    await expect(btcAmountElement).toHaveText("318");
    console.log("✓ Dashboard shows updated balance: 318 BTC");

    // Take final screenshot
    await page.screenshot({
      path: "playwright-tests/screenshots/payment-request-completed.png",
      fullPage: true
    });

    console.log("\n✓✓✓ Payment request flow completed successfully! ✓✓✓\n");
  });
});

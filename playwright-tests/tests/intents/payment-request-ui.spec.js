import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

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
    omftContractId = await sandbox.importMainnetContract(
      "omft.near",
      "omft.near"
    );

    // Fetch BTC token metadata from mainnet
    const btcMetadata = await sandbox.viewFunctionMainnet(
      nativeToken.near_token_id,
      "ft_metadata"
    );

    // Initialize omft contract
    await sandbox.functionCall(omftContractId, omftContractId, "new", {
      super_admins: ["omft.near"],
      admins: {},
      grantees: {
        DAO: ["omft.near"],
        TokenDeployer: ["omft.near"],
        TokenDepositer: ["omft.near"],
      },
    });

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

    // Deploy USDC (BASE) token
    const usdcBaseTokenId =
      "base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
    const usdcBaseMetadata = await sandbox.viewFunctionMainnet(
      usdcBaseTokenId,
      "ft_metadata"
    );
    await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "deploy_token",
      {
        token: "base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        metadata: usdcBaseMetadata,
      },
      "300000000000000",
      await parseNEAR("3")
    );

    // Import and setup intents.near contract
    intentsContractId = await sandbox.importMainnetContract(
      "intents.near",
      "intents.near"
    );
    await sandbox.functionCall(intentsContractId, intentsContractId, "new", {
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
    });

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

    // Register intents contract with USDC (BASE) token storage
    await sandbox.functionCall(
      omftContractId,
      "base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
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

    // Create testcreator account with 3000 NEAR initial balance
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      "3000000000000000000000000000"
    );

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
          txHash:
            "0xc6b7ecd5c7517a8f56ac7ec9befed7d26a459fc97c7d5cd7598d4e19b5a806b7",
        })}`,
      },
      "300000000000000",
      "1250000000000000000000"
    );

    console.log("✓ Deposited 320 BTC to DAO via intents");

    // Deposit USDC (BASE) tokens to DAO via intents
    await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "ft_deposit",
      {
        owner_id: intentsContractId,
        token: "base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        amount: "100000000000", // 100,000 USDC (6 decimals)
        msg: JSON.stringify({ receiver_id: daoAccountId }),
        memo: `BRIDGED_FROM:${JSON.stringify({
          networkType: "base",
          chainId: "8453",
          txHash: "0xusdcbaseplaceholdertxhash",
        })}`,
      },
      "300000000000000",
      "1250000000000000000000"
    );

    console.log("✓ Deposited 100,000 USDC to DAO via intents");

    // Import and setup wrap.near contract for wNEAR
    const wrapNearContractId = await sandbox.importMainnetContract(
      "wrap.near",
      "wrap.near"
    );

    // Initialize wrap.near contract with proper parameters
    await sandbox.functionCall(
      wrapNearContractId,
      wrapNearContractId,
      "new",
      {
        owner_id: wrapNearContractId,
        total_supply: await parseNEAR("1000000000"),
        metadata: {
          spec: "ft-1.0.0",
          name: "Wrapped NEAR fungible token",
          symbol: "wNEAR",
          decimals: 24,
        },
      },
      "300000000000000"
    );

    // Register intents contract with wrap.near storage
    await sandbox.functionCall(
      intentsContractId,
      wrapNearContractId,
      "storage_deposit",
      {
        account_id: intentsContractId,
        registration_only: true,
      },
      "30000000000000",
      await parseNEAR("0.01")
    );

    // Deposit NEAR into wrap.near to get wNEAR tokens (deposit more than we'll transfer to cover fees)
    await sandbox.functionCall(
      creatorAccountId,
      wrapNearContractId,
      "near_deposit",
      {},
      "300000000000000",
      await parseNEAR("100")
    );

    // Check testcreator balance before transfer
    const creatorBalanceBefore = await sandbox.viewFunction(
      wrapNearContractId,
      "ft_balance_of",
      {
        account_id: creatorAccountId,
      }
    );
    console.log(
      `✓ testcreator wNEAR balance before transfer: ${creatorBalanceBefore}`
    );

    // Transfer wNEAR to intents contract for the DAO (transfer less than deposited to account for fees)
    await sandbox.functionCall(
      creatorAccountId,
      wrapNearContractId,
      "ft_transfer_call",
      {
        receiver_id: intentsContractId,
        amount: await parseNEAR("91.3"),
        msg: JSON.stringify({ receiver_id: daoAccountId }),
      },
      "50000000000000",
      "1"
    );

    console.log("✓ Deposited 91.3 wNEAR to DAO via intents");

    // Wait for blockchain state to settle
    await sandbox.waitForBlockchainState(200);

    // Check intents.near balance on wrap.near after transfer
    const intentsWnearBalance = await sandbox.viewFunction(
      wrapNearContractId,
      "ft_balance_of",
      {
        account_id: intentsContractId,
      }
    );
    console.log(
      `✓ intents.near wNEAR balance on wrap.near: ${intentsWnearBalance}`
    );

    // Debug: Check wNEAR balance in intents contract
    const wnearBalance = await sandbox.viewFunction(
      intentsContractId,
      "mt_balance_of",
      {
        account_id: daoAccountId,
        token_id: `nep141:${wrapNearContractId}`,
      }
    );
    console.log(
      `✓ wNEAR balance for ${daoAccountId} in intents: ${wnearBalance}`
    );

    console.log("\n=== Setup Complete ===\n");
  });

  test.afterEach(async ({ page }) => {
    // Clean up page routes before closing
    await page.unrouteAll({ behavior: "ignoreErrors" });
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
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("Browser console error:", msg.text());
      }
    });

    page.on("pageerror", (error) => {
      console.log("Browser page error:", error.message);
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

    // Intercept indexer API calls to return sandbox data
    await interceptIndexerAPI(page, sandbox);
    console.log("✓ Intercepting indexer API calls");

    // Navigate to the treasury application payments page for the DAO
    const treasuryUrl = `http://localhost:3000/${daoAccountId}/payments`;
    await page.goto(treasuryUrl);

    console.log(`✓ Navigated to: ${treasuryUrl}`);

    // Set localStorage after page loads
    await page.evaluate(() => {
      localStorage.setItem("selected-wallet", "test-wallet");
    });
    console.log("✓ Set localStorage selected-wallet");

    // Reload to apply localStorage changes
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait a moment for React to hydrate and wallet to connect
    await page.waitForTimeout(3000);

    console.log("✓ Page loaded with authenticated user");

    // Navigate to Dashboard first to verify initial balance
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(1000);

    const initialBtcAmountElement = page
      .getByTestId("intents-portfolio")
      .locator("div.flex-column", { hasText: "BTC" })
      .locator("div.h6.mb-0")
      .last();
    await expect(initialBtcAmountElement).toHaveText("320");

    await initialBtcAmountElement.scrollIntoViewIfNeeded();
    console.log("✓ Dashboard shows initial balance: 320 BTC");

    // Navigate to Payments page
    await page.getByRole("link", { name: "Payments" }).click();
    await page.waitForTimeout(1000);
    console.log("✓ Navigated to Payments page");

    // Click Create Request dropdown and select Single Payment
    const createRequestButton = await page.getByText("Create Request");
    await createRequestButton.click();
    await page.getByText("Single Payment").click();
    console.log("✓ Clicked 'Create Request' and selected 'Single Request'");

    // Verify payment request modal/page is visible
    await expect(page.getByText("Create Payment Request")).toBeVisible();
    console.log("✓ Payment request creation modal visible");

    // Select intents wallet
    await selectIntentsWallet(page);
    console.log("✓ Selected NEAR Intents wallet");

    // Open tokens dropdown and verify BTC is available
    await page.getByTestId("tokens-dropdown").locator("div").first().click();

    // Wait for the token selection modal to appear
    await expect(
      page.getByRole("heading", { name: "Select Token" })
    ).toBeVisible({ timeout: 10_000 });

    // Verify BTC is available with the balance
    await expect(page.getByText("BTC", { exact: true })).toBeVisible();
    await expect(page.getByText("320 through BTC")).toBeVisible();
    console.log("✓ BTC token is available in dropdown");

    // Select BTC token - try clicking on a more specific element
    // Look for a clickable container that has both BTC text and the balance info
    await page
      .locator(".modal-body")
      .getByText("BTC", { exact: true })
      .click({ force: true });

    // Wait for modal to close
    await expect(
      page.getByRole("heading", { name: "Select Token" })
    ).not.toBeVisible({ timeout: 10000 });
    console.log("✓ Selected BTC token");

    // Wait for form to update after token selection
    await page.waitForTimeout(1000);

    // Fill in Title field
    await page.getByRole("textbox", { name: "Title" }).click();
    await page
      .getByRole("textbox", { name: "Title" })
      .fill("btc proposal title");
    console.log("✓ Filled title");

    // Fill in Summary field
    await page.getByRole("textbox", { name: "Summary" }).click();
    await page
      .getByRole("textbox", { name: "Summary" })
      .fill("describing the btc payment request proposal");
    console.log("✓ Filled summary");

    // Fill in BTC recipient address
    await page
      .getByRole("textbox", { name: "Enter BTC Address (e.g., bc1" })
      .click();
    await page
      .getByRole("textbox", { name: "Enter BTC Address (e.g., bc1" })
      .fill("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh");
    console.log("✓ Filled BTC recipient address");

    // Fill in amount
    await page.getByRole("spinbutton", { name: "Amount" }).click();
    await page.getByRole("spinbutton", { name: "Amount" }).fill("2");
    console.log("✓ Filled amount: 2 BTC");

    // Verify no validation errors and submit button is enabled
    await expect(
      page.getByText("Please enter valid account ID")
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeEnabled();

    // Take screenshot before submitting
    await page.screenshot({
      path: "playwright-tests/screenshots/payment-request-filled.png",
      fullPage: true,
    });

    // Submit the form
    await page.getByRole("button", { name: "Submit" }).click();
    console.log("✓ Clicked Submit button");

    // Wait for transaction to be signed and sent by our test wallet
    // Note: New UI doesn't have a confirmation modal, wallet signs directly
    await page.waitForTimeout(3000);
    console.log("✓ Waiting for transaction to complete");

    // Check if there's an error message
    const hasError = await page
      .getByText("Failed to create payment request")
      .isVisible()
      .catch(() => false);
    if (hasError) {
      console.log("ERROR: Transaction failed to create payment request");
      // Take screenshot of error
      await page.screenshot({
        path: "playwright-tests/screenshots/payment-request-error.png",
        fullPage: true,
      });
      throw new Error("Transaction signing failed - check screenshot");
    }

    // The modal should close after successful transaction
    await expect(page.getByText("Create Payment Request")).not.toBeVisible({
      timeout: 15000,
    });
    console.log("✓ Transaction submitted successfully, modal closed");

    // Wait for success toast
    await expect(
      page.getByText("Payment request has been successfully created.")
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Payment request created successfully");

    // Verify the "View Request" link is present in the toast
    const viewRequestLink = page.getByText("View Request");
    await expect(viewRequestLink).toBeVisible();
    console.log("✓ 'View Request' link is visible in toast");

    // Wait for proposal to appear in table (with the fix, it should appear immediately after the 2s delay)
    await page.waitForTimeout(2500); // Wait slightly longer than the 2s cache invalidation delay

    // Hard expectation: Proposal MUST be visible in the table
    const proposalRow = page
      .locator("tbody tr")
      .filter({ hasText: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" })
      .first();
    await expect(proposalRow).toBeVisible({ timeout: 3000 });
    console.log("✓ Proposal is visible in table (fix verified!)");

    // Extract the proposal ID from the table row to verify "View Request" link points to it
    const proposalIdInTable = await proposalRow
      .locator("td")
      .first()
      .textContent();
    console.log(`✓ Proposal ID in table: ${proposalIdInTable}`);

    // Verify the "View Request" link points to the same proposal by clicking it
    // This will navigate to the proposal detail page with the ID in the URL
    await viewRequestLink.click();
    await page.waitForTimeout(1000);

    // Check that the URL contains the proposal ID (format: ?id=0)
    const currentUrl = page.url();
    expect(currentUrl).toContain(`id=${proposalIdInTable}`);
    console.log(
      `✓ 'View Request' link correctly points to proposal ${proposalIdInTable}`
    );

    // Navigate back to the payments page
    await page.goBack();
    await page.waitForTimeout(1000);

    // Now click the proposal row to open detail sidebar
    await proposalRow.click();
    console.log("✓ Clicked on proposal in table");

    // Wait for proposal detail sidebar to open
    await page.waitForTimeout(2000);
    console.log("✓ Proposal detail sidebar opened");

    // If sidebar is open, click the expand button to open full detail page
    // This avoids duplicate elements (sidebar + table)
    const expandButton = page.locator(".bi.bi-arrows-angle-expand");
    const isExpandButtonVisible = await expandButton
      .isVisible()
      .catch(() => false);

    if (isExpandButtonVisible) {
      await expandButton.click();
      await page.waitForTimeout(1000);
      console.log("✓ Clicked expand button to open full detail page");
    }

    // Verify proposal details on detail page
    await expect(
      page.getByRole("heading", { name: "btc proposal title" }).first()
    ).toBeVisible();
    await expect(
      page.getByText("describing the btc payment request proposal").first()
    ).toBeVisible();
    await expect(
      page.getByText("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh").first()
    ).toBeVisible();
    console.log("✓ Proposal details verified on detail page");

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
    await page.getByRole("button", { name: "Approve" }).first().click();
    console.log("✓ Clicked Approve button");

    // Confirm your vote modal appears
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    console.log("✓ Confirmed vote");

    // Wait for transaction to be signed and sent by our test wallet
    // Note: New wallet integration doesn't show "Confirm Transaction" button, wallet signs directly
    await page.waitForTimeout(3000);
    console.log("✓ Waiting for approval transaction to complete");

    // Wait for success message
    await expect(
      page.getByText("The payment request has been successfully approved.")
    ).toBeVisible({ timeout: 15_000 });
    console.log("✓ Payment request approved successfully");

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
      fullPage: true,
    });

    console.log("\n✓✓✓ BTC Payment request flow completed successfully! ✓✓✓\n");
  });

  test("should create USDC payment request to BASE address", async ({
    page,
  }) => {
    test.setTimeout(120000); // 2 minutes

    // Inject test wallet before navigation
    await injectTestWallet(page, sandbox, creatorAccountId);
    console.log(`✓ Injected test wallet for: ${creatorAccountId}`);

    // Get sandbox RPC URL
    const sandboxRpcUrl = sandbox.getRpcUrl();

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

    // Intercept indexer API calls
    await interceptIndexerAPI(page, sandbox);

    // Navigate to dashboard
    const treasuryUrl = `http://localhost:3000/${daoAccountId}/dashboard`;
    await page.goto(treasuryUrl);

    // Set localStorage
    await page.evaluate(() => {
      localStorage.setItem("selected-wallet", "test-wallet");
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Verify initial USDC balance
    const usdcRowLocator = page
      .getByTestId("intents-portfolio")
      .locator(
        'div.d-flex.flex-column:has(div.h6.mb-0.text-truncate:has-text("USDC"))'
      );
    const usdcAmountElement = usdcRowLocator.locator(
      "div.d-flex.gap-2.align-items-center.justify-content-end div.d-flex.flex-column.align-items-end div.h6.mb-0"
    );
    await expect(usdcAmountElement).toBeAttached();
    await usdcAmountElement.scrollIntoViewIfNeeded();
    await expect(usdcAmountElement).toHaveText("100,000");
    console.log("✓ Dashboard shows initial balance: 100,000 USDC");

    // Navigate to Payments page
    await page.getByRole("link", { name: "Payments" }).click();
    await page.waitForTimeout(1000);

    // Click Create Request dropdown and select Single Payment
    await page.getByText("Create Request").click();
    await page.getByText("Single Payment").click();
    await expect(page.getByText("Create Payment Request")).toBeVisible();

    // Select intents wallet
    await selectIntentsWallet(page);
    console.log("✓ Selected NEAR Intents wallet");

    // Open tokens dropdown
    await page.getByTestId("tokens-dropdown").locator("div").first().click();
    await expect(
      page.getByRole("heading", { name: "Select Token" })
    ).toBeVisible({ timeout: 10_000 });

    // Select USDC token
    await page
      .locator(".modal-body")
      .getByText("USDC", { exact: true })
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: "Select Token" })
    ).not.toBeVisible({ timeout: 10000 });
    console.log("✓ Selected USDC token");

    await page.waitForTimeout(1000);

    // Fill in form
    await page
      .getByRole("textbox", { name: "Title" })
      .fill("usdc proposal title");
    await page
      .getByRole("textbox", { name: "Summary" })
      .fill("describing the usdc payment request proposal");
    await page
      .getByPlaceholder(/Enter .* Address \(0x/)
      .fill("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    await page.getByRole("spinbutton", { name: "Amount" }).fill("2500");
    console.log("✓ Filled form with USDC payment details");

    // Submit
    await expect(page.getByRole("button", { name: "Submit" })).toBeEnabled();
    await page.getByRole("button", { name: "Submit" }).click();
    await page.waitForTimeout(3000);

    // Verify proposal created
    await expect(page.getByText("Create Payment Request")).not.toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("Payment request has been successfully created.")
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ USDC payment request created successfully");

    await page.waitForTimeout(2500);

    // Find and click proposal
    const proposalRow = page
      .locator("tbody tr")
      .filter({ hasText: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" })
      .first();
    await expect(proposalRow).toBeVisible({ timeout: 3000 });
    await proposalRow.click();
    await page.waitForTimeout(2000);

    // Expand to full detail page
    const expandButton = page.locator(".bi.bi-arrows-angle-expand");
    const isExpandButtonVisible = await expandButton
      .isVisible()
      .catch(() => false);
    if (isExpandButtonVisible) {
      await expandButton.click();
      await page.waitForTimeout(1000);
    }

    // Verify proposal details
    await expect(
      page.getByRole("heading", { name: "usdc proposal title" }).first()
    ).toBeVisible();
    await expect(
      page.getByText("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045").first()
    ).toBeVisible();

    // Verify balance before approval
    const balanceBefore = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: [
          "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
        ],
      }
    );
    expect(balanceBefore).toEqual(["100000000000"]); // 100,000 USDC with 6 decimals
    console.log("✓ Balance before approval: 100,000 USDC");

    // Approve
    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(3000);

    // Verify execution
    await expect(
      page.getByText("The payment request has been successfully approved.")
    ).toBeVisible({ timeout: 15_000 });
    console.log("✓ USDC payment request approved successfully");

    // Verify balance after approval (should be 97,500 USDC = 100,000 - 2,500)
    await page.waitForTimeout(1000);
    const balanceAfter = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: [
          "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
        ],
      }
    );
    expect(balanceAfter).toEqual(["97500000000"]); // 97,500 USDC with 6 decimals
    console.log("✓ Balance after approval: 97,500 USDC");

    // Verify on Dashboard
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(1000);
    await usdcAmountElement.scrollIntoViewIfNeeded();
    await expect(usdcAmountElement).toHaveText("97,500");
    console.log("✓ Dashboard shows updated balance: 97,500 USDC");

    console.log(
      "\n✓✓✓ USDC Payment request flow completed successfully! ✓✓✓\n"
    );
  });

  test("should create wNEAR payment request to NEAR account", async ({
    page,
  }) => {
    test.setTimeout(120000); // 2 minutes

    // Inject test wallet before navigation
    await injectTestWallet(page, sandbox, creatorAccountId);
    console.log(`✓ Injected test wallet for: ${creatorAccountId}`);

    // Get sandbox RPC URL
    const sandboxRpcUrl = sandbox.getRpcUrl();

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

    // Intercept indexer API calls
    await interceptIndexerAPI(page, sandbox);

    // Navigate to dashboard
    const treasuryUrl = `http://localhost:3000/${daoAccountId}/dashboard`;
    await page.goto(treasuryUrl);

    // Set localStorage
    await page.evaluate(() => {
      localStorage.setItem("selected-wallet", "test-wallet");
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Verify initial wNEAR balance
    // Wait for intents portfolio to load
    await page.waitForTimeout(2000);

    // Try to find wNEAR token - it might be displayed as "NEAR" or "wNEAR"
    const intentsPortfolio = page.getByTestId("intents-portfolio");
    await expect(intentsPortfolio).toBeVisible();

    // Look for either "wNEAR" or "NEAR" text in the portfolio
    const wnearRowLocator = intentsPortfolio
      .locator(
        'div.d-flex.flex-column:has(div.h6.mb-0.text-truncate:has-text("NEAR"))'
      )
      .first();

    const wnearAmountElement = wnearRowLocator.locator(
      "div.d-flex.gap-2.align-items-center.justify-content-end div.d-flex.flex-column.align-items-end div.h6.mb-0"
    );

    // Wait for the element with a longer timeout
    await expect(wnearAmountElement).toBeVisible({ timeout: 10000 });
    await wnearAmountElement.scrollIntoViewIfNeeded();
    await expect(wnearAmountElement).toHaveText("91.3");
    console.log("✓ Dashboard shows initial balance: 91.3 wNEAR");

    // Navigate to Payments page
    await page.getByRole("link", { name: "Payments" }).click();
    await page.waitForTimeout(1000);

    // Click Create Request dropdown and select Single Payment
    await page.getByText("Create Request").click();
    await page.getByText("Single Payment").click();
    await expect(page.getByText("Create Payment Request")).toBeVisible();

    // Select intents wallet
    await selectIntentsWallet(page);
    console.log("✓ Selected NEAR Intents wallet");

    // Open tokens dropdown
    await page.getByTestId("tokens-dropdown").locator("div").first().click();
    await expect(
      page.getByRole("heading", { name: "Select Token" })
    ).toBeVisible({ timeout: 10_000 });

    // Select wNEAR token
    await page
      .locator(".modal-body")
      .getByText("wNEAR", { exact: true })
      .click({ force: true });
    await expect(
      page.getByRole("heading", { name: "Select Token" })
    ).not.toBeVisible({ timeout: 10000 });
    console.log("✓ Selected wNEAR token");

    await page.waitForTimeout(1000);

    // Use testcreator as recipient (must be an existing account)
    const recipientAccountId = creatorAccountId;

    // Fill in form
    await page
      .getByRole("textbox", { name: "Title" })
      .fill("wNEAR withdrawal proposal");
    await page
      .getByRole("textbox", { name: "Summary" })
      .fill("Withdrawal of wNEAR tokens from intents contract");

    // Fill amount first (new order - amount before recipient)
    await page.getByRole("spinbutton", { name: /Amount/i }).fill("50");
    await page.waitForTimeout(500);

    // Fill recipient with keypress simulation to trigger validation
    const recipientInput = page.getByPlaceholder(
      /treasury.near|Enter NEAR Account/
    );
    await recipientInput.click();
    await recipientInput.clear();
    await recipientInput.pressSequentially(recipientAccountId, { delay: 50 });
    await page.waitForTimeout(500); // Wait for validation to complete
    console.log("✓ Filled form with wNEAR payment details");

    // Submit
    await expect(page.getByRole("button", { name: "Submit" })).toBeEnabled();
    await page.getByRole("button", { name: "Submit" }).click();
    await page.waitForTimeout(3000);

    // Verify proposal created
    await expect(page.getByText("Create Payment Request")).not.toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("Payment request has been successfully created.")
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ wNEAR payment request created successfully");

    await page.waitForTimeout(2500);

    // Find and click proposal
    const proposalRow = page
      .locator("tbody tr")
      .filter({ hasText: recipientAccountId })
      .first();
    await expect(proposalRow).toBeVisible({ timeout: 3000 });
    await proposalRow.click();
    await page.waitForTimeout(2000);

    // Expand to full detail page
    const expandButton = page.locator(".bi.bi-arrows-angle-expand");
    const isExpandButtonVisible = await expandButton
      .isVisible()
      .catch(() => false);
    if (isExpandButtonVisible) {
      await expandButton.click();
      await page.waitForTimeout(1000);
    }

    // Verify proposal details
    await expect(
      page.getByRole("heading", { name: "wNEAR withdrawal proposal" }).first()
    ).toBeVisible();
    await expect(page.getByText(recipientAccountId).first()).toBeVisible();

    // Verify balance before approval
    const balanceBefore = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: ["nep141:wrap.near"],
      }
    );
    expect(balanceBefore).toEqual([await parseNEAR("91.3")]); // 91.3 wNEAR
    console.log("✓ Balance before approval: 91.3 wNEAR");

    // Approve
    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.waitForTimeout(3000);

    // Verify execution
    await expect(
      page.getByText("The payment request has been successfully approved.")
    ).toBeVisible({ timeout: 15_000 });
    console.log("✓ wNEAR payment request approved successfully");

    // Verify balance after approval (should be 41.3 wNEAR = 91.3 - 50)
    await page.waitForTimeout(1000);
    const balanceAfter = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: ["nep141:wrap.near"],
      }
    );
    expect(balanceAfter).toEqual([await parseNEAR("41.3")]); // 41.3 wNEAR
    console.log("✓ Balance after approval: 41.3 wNEAR");

    // Verify on Dashboard
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForTimeout(2000);

    // Re-locate the wNEAR amount element after navigation
    const finalIntentsPortfolio = page.getByTestId("intents-portfolio");
    const finalWnearRowLocator = finalIntentsPortfolio
      .locator(
        'div.d-flex.flex-column:has(div.h6.mb-0.text-truncate:has-text("NEAR"))'
      )
      .first();
    const finalWnearAmountElement = finalWnearRowLocator.locator(
      "div.d-flex.gap-2.align-items-center.justify-content-end div.d-flex.flex-column.align-items-end div.h6.mb-0"
    );

    await finalWnearAmountElement.scrollIntoViewIfNeeded();
    await expect(finalWnearAmountElement).toHaveText("41.3");
    console.log("✓ Dashboard shows updated balance: 41.3 wNEAR");

    console.log(
      "\n✓✓✓ wNEAR Payment request flow completed successfully! ✓✓✓\n"
    );
  });
});

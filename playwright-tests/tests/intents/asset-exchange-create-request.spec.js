import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Asset Exchange Request Creation Tests
 *
 * These tests verify the asset exchange (1Click swap) request creation flow
 * using near-sandbox for end-to-end testing with real blockchain interaction.
 *
 * Tests NEAR Intents 1Click swap integration.
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const INTENTS_CONTRACT_ID = "intents.near";
const OMFT_CONTRACT_ID = "omft.near";

let sandbox;
let factoryContractId;
let intentsContractId;
let omftContractId;
let creatorAccountId;
let daoAccountId;

test.describe("Create Asset Exchange Request (1Click)", () => {
  test.beforeAll(async () => {
    test.setTimeout(600000); // 10 minutes for setup (intents setup is complex)

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import required contracts from mainnet
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

    console.log("✓ Contracts imported from mainnet");

    // Create a test account with 10000 NEAR initial balance
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      await parseNEAR("10000")
    );
    console.log(`✓ Creator account: ${creatorAccountId}`);

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

    // Create a DAO
    const daoName = "testdao";
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
              purpose: "Test DAO for asset exchange",
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
              proposal_bond: "100000000000000000000000",
              proposal_period: "604800000000000",
              bounty_bond: "100000000000000000000000",
              bounty_forgiveness_period: "604800000000000",
            },
          })
        ),
      },
      "300000000000000",
      await parseNEAR("6")
    );

    daoAccountId = `${daoName}.${factoryContractId}`;
    console.log(`✓ DAO created: ${daoAccountId}`);

    // Wait for DAO account to be queryable (the factory creates it via receipt)
    // Retry up to 10 times with 500ms delay between attempts
    console.log("⏳ Waiting for DAO account to be created via receipt...");
    let daoAccountInfo;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        daoAccountInfo = await sandbox.viewAccount(daoAccountId);
        console.log(`✓ DAO account verified after ${(i + 1) * 500}ms - Balance: ${daoAccountInfo.amount}`);
        break;
      } catch (error) {
        if (i === 9) {
          console.error(`❌ Failed to query DAO account after ${10 * 500}ms: ${error.message}`);
          throw error;
        }
        console.log(`  Attempt ${i + 1}/10: Account not yet available, retrying...`);
      }
    }

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
    expect(ethBalance).toBe("5000000000000000000");

    console.log("\n=== Sandbox Setup Complete ===\n");
  });

  test.afterAll(async () => {
    await sandbox.stop();
  });

  test("should create asset exchange request for ETH → USDC swap", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes for test execution

    console.log("\n=== Starting Asset Exchange UI Test ===\n");

    // Step 1: Inject test wallet
    await injectTestWallet(page, sandbox, creatorAccountId);
    console.log("✓ Test wallet injected");

    // Step 2: Route RPC calls to sandbox
    const sandboxRpcUrl = sandbox.getRpcUrl();
    console.log(`Routing RPC calls to sandbox: ${sandboxRpcUrl}`);

    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      try {
        const postData = route.request().postDataJSON();
        console.log(`[RPC Route] Intercepted call to ${route.request().url()}`);
        console.log(`[RPC Route] Method: ${postData.params?.method_name || postData.method}`);
        console.log(`[RPC Route] Request type: ${postData.params?.request_type}`);
        console.log(`[RPC Route] Account ID: ${postData.params?.account_id}`);

        const response = await route.fetch({
          url: sandboxRpcUrl,
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          postData: JSON.stringify(postData),
        });

        const responseBody = await response.text();
        console.log(`[RPC Route] Response status: ${response.status()}`);
        console.log(`[RPC Route] Response preview: ${responseBody.substring(0, 200)}`);

        await route.fulfill({
          status: response.status(),
          headers: response.headers(),
          body: responseBody,
        });
      } catch (error) {
        console.error(`[RPC Route] Error:`, error.message);
        await route.abort();
      }
    });
    console.log("✓ RPC routing configured");

    // Step 3: Intercept indexer API
    await interceptIndexerAPI(page, sandbox);
    console.log("✓ Indexer API intercepted");

    // Step 4: Mock 1Click API responses
    // Mock the 1Click quote endpoint
    await page.route(
      "**/1click.chaindefuser.com/v0/quote",
      async (route) => {
        console.log("✓ 1Click API quote request intercepted");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            quote: {
              amountIn: "150000000000000000", // 0.15 ETH
              amountOut: "450000000", // 450 USDC
              amountInFormatted: "0.15",
              amountOutFormatted: "450.00",
              depositAddress: "test-deposit-address-123",
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              timeEstimate: 10,
              signature: "ed25519:mock-signature-12345",
            },
            signature: "ed25519:mock-signature-12345",
          }),
        });
      }
    );

    // Mock the backend oneclick-quote endpoint
    await page.route("**/api/treasury/oneclick-quote", async (route) => {
      const requestBody = route.request().postDataJSON();
      console.log("✓ Backend oneclick-quote request intercepted");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          proposalPayload: {
            tokenIn: requestBody.inputToken.id,
            tokenInSymbol: requestBody.inputToken.symbol,
            tokenOut: requestBody.outputToken.symbol,
            networkOut: requestBody.networkOut,
            amountIn: "0.15",
            quote: {
              amountIn: "150000000000000000",
              amountOut: "450000000",
              amountInFormatted: "0.15",
              amountOutFormatted: "450.00",
              depositAddress: "test-deposit-address-123",
              deadline: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toISOString(),
              timeEstimate: 10,
              signature: "ed25519:mock-signature-12345",
              timeWhenInactive: new Date(
                Date.now() + 1 * 60 * 60 * 1000
              ).toISOString(),
            },
          },
        }),
      });
    });
    console.log("✓ 1Click API mocks configured");

    // Step 5: Navigate to the asset exchange page for the DAO
    const treasuryUrl = `http://localhost:3000/${daoAccountId}/asset-exchange`;
    await page.goto(treasuryUrl);
    console.log(`✓ Navigated to: ${treasuryUrl}`);

    // Take screenshot after initial navigation
    await page.screenshot({ path: 'test-results/01-after-initial-navigation.png', fullPage: true });

    // Step 6: Set wallet in localStorage after page loads
    await page.evaluate(() => {
      localStorage.setItem("selected-wallet", "test-wallet");
    });
    console.log("✓ Set localStorage selected-wallet");

    // Step 7: Reload to apply localStorage changes
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait a moment for React to hydrate and wallet to connect
    await page.waitForTimeout(3000);
    console.log("✓ Page loaded with authenticated user");

    // Take screenshot after reload
    await page.screenshot({ path: 'test-results/02-after-reload.png', fullPage: true });

    // Step 8: Navigate to Asset Exchange page via menu (to properly load DAO context)
    await page.getByRole("link", { name: "Asset Exchange" }).click();
    await page.waitForTimeout(1000);
    console.log("✓ Navigated to Asset Exchange page via menu");

    // Take screenshot after navigation
    await page.screenshot({ path: 'test-results/03-after-menu-navigation.png', fullPage: true });

    // Step 9: Wait for page to load
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 15000,
    });
    console.log("✓ Asset exchange page loaded");

    // Take screenshot after page loaded
    await page.screenshot({ path: 'test-results/04-page-loaded.png', fullPage: true });

    // Step 10: Click Create Request button
    const createRequestButton = page.getByRole("button", {
      name: "Create Request",
    });
    await expect(createRequestButton).toBeVisible();
    await createRequestButton.click();
    await page.waitForTimeout(2000);
    console.log("✓ Opened Create Request form");

    // Step 11: Select NEAR Intents wallet
    await expect(page.getByText("Treasury Wallet")).toBeVisible({
      timeout: 10000,
    });
    const treasuryWalletDropdown = page.getByTestId("wallet-dropdown-btn");
    await treasuryWalletDropdown.click();
    await page.waitForTimeout(500);
    await page.getByText("NEAR Intents", { exact: true }).click();
    await page.waitForTimeout(2000);
    console.log("✓ Selected NEAR Intents wallet");

    // Step 12: Wait for 1Click iframe to load
    const iframe = page.frameLocator("iframe");
    await expect(iframe.locator(".info-message")).toContainText(
      "Swap tokens in your NEAR Intents holdings",
      { timeout: 10000 }
    );
    console.log("✓ 1Click form loaded in iframe");

    // Step 13: Fill in swap amount
    const amountInput = iframe.locator("#amount-in");
    await expect(amountInput).toBeVisible({ timeout: 10000 });
    await amountInput.fill("0.15");
    await page.waitForTimeout(2000);
    console.log("✓ Filled swap amount: 0.15 ETH");

    // Step 14: Select send token (ETH)
    const sendTokenDropdown = iframe
      .locator(".send-section")
      .locator(".dropdown-toggle");
    await expect(sendTokenDropdown).toBeVisible({ timeout: 10000 });
    await sendTokenDropdown.click();
    await page.waitForTimeout(500);

    const ethOption = iframe
      .locator("#send-dropdown-menu .dropdown-item")
      .filter({ has: iframe.locator('h6:text-is("ETH")') });
    await expect(ethOption).toBeVisible({ timeout: 5000 });
    await ethOption.click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected ETH as send token");

    // Step 15: Select receive token (USDC)
    const receiveTokenDropdown = iframe
      .locator(".receive-section")
      .locator(".dropdown-toggle");
    await expect(receiveTokenDropdown).toBeVisible({ timeout: 10000 });
    await receiveTokenDropdown.click();
    await page.waitForTimeout(500);

    const receiveDropdownMenu = iframe.locator(
      ".receive-section .dropdown-menu.show"
    );
    await receiveDropdownMenu.waitFor({ state: "visible" });

    const usdcOption = receiveDropdownMenu
      .locator(".dropdown-item")
      .filter({ has: iframe.locator('h6:text-is("USDC")') });
    await expect(usdcOption).toBeVisible({ timeout: 5000 });
    await usdcOption.click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected USDC as receive token");

    // Step 16: Select Ethereum network
    await page.waitForTimeout(1000);
    const networkDropdown = iframe
      .locator(".form-section")
      .filter({ hasText: "Network" })
      .locator(".dropdown-toggle");
    await expect(networkDropdown).toBeVisible({ timeout: 10000 });
    await networkDropdown.click();
    await page.waitForTimeout(500);

    const networkDropdownMenu = iframe.locator("#network-dropdown-menu");
    await networkDropdownMenu.waitFor({ state: "visible" });
    const ethNetworkOption = networkDropdownMenu
      .locator(".dropdown-item")
      .first();
    await expect(ethNetworkOption).toBeVisible({ timeout: 5000 });
    await ethNetworkOption.click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected Ethereum network");

    // Step 17: Get quote
    await page.waitForTimeout(2000);
    const getQuoteButton = iframe.locator("#get-quote-btn");
    await expect(getQuoteButton).toBeEnabled({ timeout: 10000 });
    await getQuoteButton.click();
    console.log("✓ Clicked Get Quote button");

    // Step 18: Wait for quote to appear
    await expect(iframe.locator("#quote-alert")).toContainText(
      "Please approve this request",
      { timeout: 10000 }
    );
    await expect(iframe.locator(".collapse-container")).toBeVisible();
    console.log("✓ Quote displayed successfully");

    // Step 19: Create proposal
    const createProposalButton = iframe.locator("#create-proposal-btn");
    await expect(createProposalButton).toBeVisible({ timeout: 10000 });
    await createProposalButton.click();
    console.log("✓ Clicked Create Proposal button");

    // Step 20: Confirm transaction
    await expect(page.getByText("Confirm Transaction")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: "Confirm" }).click();
    console.log("✓ Confirmed transaction");

    // Step 21: Wait for success
    await expect(
      page.getByText("Asset exchange request has been successfully created")
    ).toBeVisible({
      timeout: 15000,
    });
    console.log("✓ Asset exchange request created successfully");

    // Step 22: Verify proposal appears in table
    await page.goto(treasuryUrl);
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 15000,
    });

    const tableRows = page.locator(
      'tr[data-component="widgets.treasury-factory.near/widget/pages.asset-exchange.Table"]'
    );
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    const proposalRow = tableRows.nth(1);
    await expect(proposalRow).toBeVisible();
    await expect(proposalRow).toContainText("ETH");
    await expect(proposalRow).toContainText("USDC");
    console.log("✓ Proposal appears in Pending Requests table");

    console.log("\n=== Test Complete ===\n");
  });
});

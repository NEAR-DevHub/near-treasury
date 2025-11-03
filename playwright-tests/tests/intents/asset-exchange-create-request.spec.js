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
    const createDaoResult = await sandbox.functionCall(
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
        ).toString("base64"),
      },
      "300000000000000",
      await parseNEAR("6")
    );

    daoAccountId = `${daoName}.${factoryContractId}`;
    console.log(`✓ DAO created: ${daoAccountId}`);

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
        console.log(`[RPC Route] Response preview: ${responseBody}`);

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

    // Step 11: Verify modal is open with "Create Asset Exchange Request" title
    await expect(page.getByText("Create Asset Exchange Request")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Asset Exchange Request modal opened");

    // Step 12: Select send token (ETH)
    // Click on the first "Select token" dropdown (Send section)
    const sendTokenDropdown = page.getByText("Select token").first();
    await expect(sendTokenDropdown).toBeVisible({ timeout: 10000 });
    await sendTokenDropdown.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened send token dropdown");

    // Wait for token selector modal to appear
    await expect(page.getByRole("heading", { name: "Select Token" })).toBeVisible({ timeout: 10000 });

    // Click on ETH in the list - it shows as "ETH" with subtext "ETH • 4 Networks"
    await page.getByText("ETH", { exact: true }).first().click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected ETH token");

    // Now select network for ETH - "Select Network for ETH" modal appears
    await expect(page.getByRole("heading", { name: "Select Network for ETH" })).toBeVisible({ timeout: 10000 });
    await page.getByText("Ethereum", { exact: true }).click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected Ethereum network for ETH");

    // Step 13: Select receive token (USDC)
    // The form now shows ETH selected in Send section
    // Now we need to select token in the Receive section
    // Look for "Select token" text that appears AFTER "Receive" heading
    await page.waitForTimeout(1000); // Wait for form to update after ETH selection

    // Click the second "Select token" button (the one in Receive section)
    const receiveTokenButton = page.locator('text="Receive"').locator('..').getByText("Select token");
    await expect(receiveTokenButton).toBeVisible({ timeout: 10000 });
    await receiveTokenButton.click();
    await page.waitForTimeout(1000);
    console.log("✓ Opened receive token dropdown");

    // Wait for token selector modal and select USDC
    await expect(page.getByRole("heading", { name: "Select Token" })).toBeVisible({ timeout: 10000 });
    await page.getByText("USDC", { exact: true }).first().click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected USDC token");

    // Select network for USDC
    await expect(page.getByRole("heading", { name: /Select Network for USDC/i })).toBeVisible({ timeout: 10000 });
    await page.getByText("Ethereum", { exact: true }).click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected Ethereum network for USDC");

    // Step 14: Fill in send amount
    // Look for input field near the Send section
    const sendAmountInput = page.locator('input[type="number"]').first();
    await expect(sendAmountInput).toBeVisible({ timeout: 10000 });
    await sendAmountInput.fill("0.15");
    await page.waitForTimeout(1000);
    console.log("✓ Entered send amount: 0.15 ETH");

    // Step 15: Set price slippage limit
    const slippageInput = page.getByText("Price Slippage Limit").locator("..").locator("input");
    await expect(slippageInput).toBeVisible({ timeout: 10000 });
    // Default is already 1%, we can keep it or change it
    console.log("✓ Price slippage limit set");

    // Step 16: Click "Select Token" button to proceed
    const selectTokenButton = page.getByRole("button", { name: "Select Token" });
    await expect(selectTokenButton).toBeVisible({ timeout: 10000 });
    await selectTokenButton.click();
    console.log("✓ Clicked Select Token button");

    // Step 17: Wait for quote to be fetched and form to update
    await page.waitForTimeout(3000);
    console.log("✓ Waiting for quote...");

    // Step 18: Look for "Create Request" or "Submit" button in the modal
    // The form should now show quote details
    const submitButton = page.getByRole("button", { name: /Create|Submit/i });
    await expect(submitButton).toBeVisible({ timeout: 15000 });
    await submitButton.click();
    console.log("✓ Clicked Create/Submit button");

    // Step 19: Confirm transaction if prompted
    const confirmButton = page.getByRole("button", { name: "Confirm" });
    if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmButton.click();
      console.log("✓ Confirmed transaction");
    }

    // Step 20: Wait for success message
    await expect(
      page.getByText(/successfully|created/i)
    ).toBeVisible({
      timeout: 15000,
    });
    console.log("✓ Asset exchange request created successfully");

    // Step 21: Verify proposal appears in table
    // Close the modal if still open
    const closeButton = page.getByRole("button", { name: "Close" });
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // Refresh the page to see the new proposal
    await page.reload();
    await expect(page.getByText("Pending Requests")).toBeVisible({
      timeout: 15000,
    });

    // Look for ETH and USDC in the table
    await expect(page.getByText("ETH")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("USDC")).toBeVisible({ timeout: 10000 });
    console.log("✓ Proposal appears in Pending Requests table with ETH → USDC");

    console.log("\n=== Test Complete ===\n");
  });
});

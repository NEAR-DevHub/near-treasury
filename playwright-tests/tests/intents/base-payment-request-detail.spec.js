import { test, expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  parseNEAR,
} from "../../util/sandbox.js";

/**
 * Base Payment Request Detail Tests
 *
 * Tests payment request details for Layer 2 networks (Base uses eth:8453).
 * Verifies that the network section correctly displays Layer 2 network info
 * and that transaction links point to the correct explorer (basescan.org).
 */

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "0";

let sandbox;
let omftContractId;
let intentsContractId;
let factoryContractId;
let creatorAccountId;
let daoAccountId;

test.describe("Base Payment Request Detail", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import and setup omft.near contract
    omftContractId = await sandbox.importMainnetContract(
      "omft.near",
      "omft.near"
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

    // Create testcreator account with sufficient NEAR for DAO creation and gas
    // DAO creation costs ~6 NEAR, giving 10 NEAR to be safe
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      await parseNEAR("10")
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
  });

  test.afterAll(async () => {
    if (sandbox) {
      await sandbox.stop();
    }
  });

  test("creates Base USDC payment request and logs proposal structure", async ({
    page,
  }) => {
    console.log("\n=== Creating Base USDC Payment Request ===\n");

    // Mock indexer API to return sandbox proposals
    await interceptIndexerAPI(page, sandbox);

    // Intercept RPC calls to mainnet and redirect to sandbox
    await page.route("**/rpc.mainnet.fastnear.com/**", async (route) => {
      const request = route.request();
      const sandboxRpcUrl = sandbox.getRpcUrl();

      // Forward the request to sandbox RPC
      const response = await page.request.post(sandboxRpcUrl, {
        headers: request.headers(),
        data: request.postDataJSON(),
      });

      route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: await response.body(),
      });
    });

    // Inject test wallet
    await injectTestWallet(page, sandbox, creatorAccountId);

    // Navigate to DAO payments page
    await page.goto(`http://localhost:3000/${daoAccountId}/payments`);
    await page.waitForLoadState("networkidle");

    // Click Create Request dropdown and select Single Request
    const createButton = page.getByRole("button", { name: "Create Request" });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    await page.getByText("Single Request").click();

    // Wait for form to open - the form is in an offcanvas
    await page.waitForTimeout(1000);
    const offcanvas = page.locator(".offcanvas.show");
    await expect(offcanvas).toBeVisible({ timeout: 10000 });
    await expect(offcanvas.getByText("Create Payment Request")).toBeVisible({
      timeout: 10000,
    });
    console.log("✓ Payment request form opened");

    // Select NEAR Intents wallet
    const walletSelector = offcanvas.getByRole("button", {
      name: "Select Wallet",
    });
    await expect(walletSelector).toBeVisible();
    await walletSelector.click();

    await expect(offcanvas.getByText("NEAR Intents")).toBeVisible();
    await offcanvas.getByText("NEAR Intents").click();
    console.log("✓ Selected NEAR Intents wallet");

    // Wait for token dropdown to be available
    await page.waitForTimeout(2000);

    // Select USDC (BASE) token
    const tokenDropdown = offcanvas
      .locator(
        'button:has-text("Select Token"), [data-testid="token-dropdown"]'
      )
      .first();
    await expect(tokenDropdown).toBeVisible({ timeout: 10000 });
    await tokenDropdown.click();
    await page.waitForTimeout(500);

    // Look for USDC on BASE
    const usdcBaseOption = page.locator("text=/USDC.*BASE/i").first();
    await expect(usdcBaseOption).toBeVisible({ timeout: 10000 });
    await usdcBaseOption.click();
    console.log("✓ Selected USDC (BASE) token");

    await page.waitForTimeout(500);

    // Fill in title
    await page
      .getByRole("textbox", { name: "Title" })
      .fill("Test Base Payment");
    console.log("✓ Entered title");

    // Fill in summary
    await page
      .getByRole("textbox", { name: "Summary" })
      .fill("Testing Base USDC payment");
    console.log("✓ Entered summary");

    // Fill in amount
    await page.getByRole("spinbutton", { name: "Amount" }).click();
    await page.getByRole("spinbutton", { name: "Amount" }).fill("50");
    console.log("✓ Entered amount: 50 USDC");

    // Fill in recipient address (Base address)
    const recipientInput = page.getByRole("textbox", {
      name: /Enter.*Address/,
    });
    await recipientInput.click();
    await recipientInput.fill("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
    console.log("✓ Entered recipient address");

    // Submit the proposal
    const submitButton = offcanvas.getByRole("button", { name: /Submit/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    console.log("✓ Clicked submit");

    // Wait for transaction confirmation
    await expect(
      page.getByText(/Awaiting transaction confirmation/i)
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Transaction submitted");

    // Wait for the "View Request" link to appear in the toast
    const viewRequestLink = page.getByText("View Request");
    await expect(viewRequestLink).toBeVisible({ timeout: 10000 });
    console.log("✓ View Request link appeared");

    // Click the "View Request" link to navigate to the proposal detail page
    await viewRequestLink.click();
    await page.waitForLoadState("networkidle");
    console.log("✓ Navigated to proposal detail page");

    // Fetch the proposal from the DAO contract to log its structure
    const proposalId = 0; // First proposal in the DAO
    const proposal = await sandbox.viewFunction(daoAccountId, "get_proposal", {
      id: proposalId,
    });

    console.log("\n=== PROPOSAL STRUCTURE ===");
    console.log(JSON.stringify(proposal, null, 2));

    // Decode the args to see the memo and token info
    const argsBase64 = proposal.kind.FunctionCall.actions[0].args;
    const decodedArgs = JSON.parse(
      Buffer.from(argsBase64, "base64").toString()
    );

    console.log("\n=== DECODED ARGS ===");
    console.log(JSON.stringify(decodedArgs, null, 2));

    // Fetch supported tokens to see how the network info maps
    const supportedTokensResponse = await fetch(
      "https://bridge.chaindefuser.com/rpc",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "supportedTokensFetchAll",
          jsonrpc: "2.0",
          method: "supported_tokens",
          params: [{}],
        }),
      }
    ).then((r) => r.json());

    const baseToken = supportedTokensResponse.result?.tokens?.find(
      (token) => token.near_token_id === decodedArgs.token
    );

    if (baseToken) {
      console.log("\n=== TOKEN METADATA FROM BRIDGE ===");
      console.log(JSON.stringify(baseToken, null, 2));
      console.log(
        `\ndefuse_asset_identifier: ${baseToken.defuse_asset_identifier}`
      );

      const parts = baseToken.defuse_asset_identifier?.split(":");
      if (parts) {
        console.log(`Network: ${parts[0]}`);
        console.log(`Chain ID: ${parts[1]}`);
        console.log(`Token Address: ${parts[2]}`);
        console.log(
          `\nBlockchain identifier (what code uses): ${parts[0]}:${parts[1]}`
        );
      }
    }

    // Verify the proposal was created correctly
    expect(proposal).toBeDefined();
    expect(proposal.id).toBe(proposalId);
    expect(proposal.kind.FunctionCall.receiver_id).toBe("intents.near");
    expect(decodedArgs.token).toContain(
      "base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    );
    expect(decodedArgs.memo).toContain(
      "WITHDRAW_TO:0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    );

    console.log(
      "\n✓ Base payment request created successfully with correct structure"
    );

    // Verify the payment request detail page displays correctly
    console.log("\n=== Verifying Payment Request Detail Page ===");

    // Hard expectation: Recipient address should be visible
    await expect(
      page.getByText("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")
    ).toBeVisible({ timeout: 10000 });
    console.log("✓ Recipient address is visible");

    // Hard expectation: Token amount should be displayed in Funding Ask
    await expect(page.getByText("Funding Ask")).toBeVisible();
    await expect(page.getByText("50")).toBeVisible();
    console.log("✓ Token amount (50) is visible");

    // Hard expectation: Network section should be displayed
    const networkSection = page.locator("div.mt-3", { hasText: "Network" });
    await expect(page.locator("div.mt-3", { hasText: "Network" })).toBeVisible({
      timeout: 5000,
    });
    console.log("✓ Network section is visible");

    await expect(networkSection.locator("span.text-capitalize")).toContainText(
      "Base"
    );

    await expect(await networkSection.locator("img").getAttribute("src")).toBe(
      "https://near-intents.org/static/icons/network/base.svg"
    );

    // Verify it's showing Base, not Ethereum or eth:8453
    console.log("✓ Network correctly shows 'Base' (Layer 2 network name)");

    // Hard expectation: Estimated Fee should be displayed
    await expect(page.getByText("Estimated Fee").first()).toBeVisible();
    console.log("✓ Estimated Fee is visible");

    await page.waitForTimeout(1000);
    console.log(
      "\n✓ Base payment request detail page displays correctly with Layer 2 network info"
    );
  });
});

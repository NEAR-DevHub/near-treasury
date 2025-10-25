import { test, expect } from "@playwright/test";
import { NearSandbox, setPageAuthSettings, parseNEAR } from "../../util/sandbox.js";

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

  test.afterAll(async () => {
    await sandbox.stop();
    console.log("\n=== Sandbox Environment Stopped ===\n");
  });

  test("should navigate to payment request creation", async ({ page }) => {
    test.setTimeout(120000); // 2 minutes

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

    // Set page authentication for creator account
    const creatorKeyPair = sandbox.getKeyPair(creatorAccountId);
    await setPageAuthSettings(page, creatorAccountId, creatorKeyPair);

    console.log(`✓ Set authentication for: ${creatorAccountId}`);

    // Wait for page to be ready after reload
    await page.waitForLoadState("networkidle");

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

    // Take a screenshot for debugging
    await page.screenshot({
      path: "playwright-tests/screenshots/payment-request-form.png",
      fullPage: true
    });

    console.log("✓ Payment request form loaded");
  });
});

import { test, expect } from "@playwright/test";
import { NearSandbox, parseNEAR } from "../../util/sandbox.js";

// Constants from legacy sandboxrpc.js
const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "0";

let sandbox;

test.describe("BTC Payment Request Flow (Sandbox Only)", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");
  });

  test.afterAll(async () => {
    await sandbox.stop();
    console.log("\n=== Sandbox Environment Stopped ===\n");
  });

  test("create payment request to transfer BTC", async () => {
    test.setTimeout(120_000);
    const daoName = "testdao";

    // Fetch available tokens from Defuse API
    const availableTokens = (
      await fetch("https://api-mng-console.chaindefuser.com/api/tokens").then(
        (r) => r.json()
      )
    ).items;
    const tokenId = availableTokens.find(
      (token) => token.defuse_asset_id === "nep141:btc.omft.near"
    ).defuse_asset_id;

    // Fetch supported tokens
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
            chains: [
              "btc:mainnet",
            ],
          },
        ],
      }),
    }).then((r) => r.json());

    const nativeToken = supportedTokens.result.tokens[0];
    expect(nativeToken.near_token_id).toEqual("btc.omft.near");
    expect(tokenId).toEqual("nep141:btc.omft.near");

    // Import and setup omft.near contract
    const omftContractId = await sandbox.importMainnetContract("omft.near", "omft.near");

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
    const intentsContractId = await sandbox.importMainnetContract("intents.near", "intents.near");
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
    const factoryContractId = await sandbox.importMainnetContract(
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
    const creatorAccountId = await sandbox.createAccount("testcreator.near");

    // Create testdao
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

    const daoAccountId = `${daoName}.${SPUTNIK_DAO_FACTORY_ID}`;

    // Get deposit address for the DAO
    const depositAddress = (
      await fetch("https://bridge.chaindefuser.com/rpc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "deposit_address",
          params: [
            {
              account_id: daoAccountId,
              chain: "btc:mainnet",
            },
          ],
        }),
      }).then((r) => r.json())
    ).result.address;

    expect(depositAddress).toEqual("1JBmcrzAPeAeQA9CRAuYEoKSE6RN8hu59x");

    // Deposit BTC tokens to DAO via intents
    await sandbox.functionCall(
      omftContractId,
      omftContractId,
      "ft_deposit",
      {
        owner_id: "intents.near",
        token: "btc",
        amount: "32000000000000000000",
        msg: JSON.stringify({ receiver_id: daoAccountId }),
        memo: `BRIDGED_FROM:${JSON.stringify({
          networkType: "btc",
          chainId: "1",
          txHash:
            "0xc6b7ecd5c7517a8f56ac7ec9befed7d26a459fc97c7d5cd7598d4e19b5a806b7",
        })}`,
      },
      "300000000000000",
      await parseNEAR("0.00125")
    );

    // Verify DAO has the BTC tokens
    const balance = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: [tokenId],
      }
    );

    expect(balance).toEqual(["32000000000000000000"]);

    // Create payment request proposal to withdraw BTC
    const proposal = {
      description: "Transfer BTC",
      kind: {
        FunctionCall: {
          receiver_id: intentsContractId,
          actions: [
            {
              method_name: "ft_withdraw",
              args: Buffer.from(
                JSON.stringify({
                  token: nativeToken.near_token_id,
                  receiver_id: nativeToken.near_token_id,
                  amount: "1000000000000000000",
                  memo: "WITHDRAW_TO:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
                })
              ).toString("base64"),
              deposit: "1",
              gas: "30000000000000",
            },
          ],
        },
      },
    };

    const proposalResult = await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "add_proposal",
      {
        proposal: proposal,
      },
      "30000000000000",
      PROPOSAL_BOND
    );

    // Extract proposal ID from result (it should be 0 for the first proposal)
    const proposalId = 0;

    // Vote and execute proposal
    const voteResult = await sandbox.functionCall(
      creatorAccountId,
      daoAccountId,
      "act_proposal",
      {
        id: proposalId,
        action: "VoteApprove",
      },
      "300000000000000"
    );

    // Verify logs contain expected burn events
    expect(
      voteResult.logsContain(
        `EVENT_JSON:{"standard":"nep245","version":"1.0.0","event":"mt_burn","data":[{"owner_id":"testdao.sputnik-dao.near","token_ids":["nep141:btc.omft.near"],"amounts":["1000000000000000000"],"memo":"withdraw"}]}`
      )
    ).toBeTruthy();

    expect(
      voteResult.logsContain(
        `EVENT_JSON:{"standard":"nep141","version":"1.0.0","event":"ft_burn","data":[{"owner_id":"intents.near","amount":"1000000000000000000","memo":"WITHDRAW_TO:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"}]}`
      )
    ).toBeTruthy();

    expect(voteResult.failed).toBeFalsy();

    // Verify final balance
    const finalBalance = await sandbox.viewFunction(
      intentsContractId,
      "mt_batch_balance_of",
      {
        account_id: daoAccountId,
        token_ids: [tokenId],
      }
    );

    expect(finalBalance).toEqual(["31000000000000000000"]);

    console.log("✓ BTC payment request flow completed successfully");
  });
});

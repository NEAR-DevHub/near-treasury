import { expect } from "@playwright/test";
import { NearSandbox, parseNEAR } from "../../util/sandbox.js";

// Staking pool constants
const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "0";
export const ASTRO_STAKERS_POOL_ID = "astro-stakers.poolv1.near";
export const POOL_FACTORY_ID = "poolv1.near";
const LOCKUP_WHITELIST_ID = "lockup-whitelist.near";

/**
 * Sets up a complete test DAO environment with sandbox
 *
 * @returns {Promise<Object>} Object containing sandbox, accounts, and factory IDs
 */
export async function setupTestDAO({ epochLength = 1000 } = {}) {
  const sandbox = new NearSandbox();
  await sandbox.start({ epochLength });

  console.log("\n=== Sandbox Environment Started ===\n");

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

  // Create testcreator account with initial balance
  const creatorAccountId = await sandbox.createAccount(
    "testcreator.near",
    "3000000000000000000000000000"
  );

  // Deploy staking pool infrastructure (astro-stakers.poolv1.near)
  await _deployStakingPool({ sandbox, creatorAccountId });

  // Create testdao using the factory
  const daoName = "testdao";
  const create_testdao_args = {
    name: daoName,
    args: Buffer.from(
      JSON.stringify({
        config: {
          name: daoName,
          purpose: "testing stake delegation",
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
  console.log(`✓ Created DAO: ${daoAccountId}`);

  // Fund the DAO with 100 NEAR
  await sandbox.transfer(
    creatorAccountId,
    daoAccountId,
    await parseNEAR("100")
  );
  console.log("✓ Funded DAO with 100 NEAR");

  console.log("\n=== Setup Complete ===\n");

  return {
    sandbox,
    factoryContractId,
    creatorAccountId,
    daoAccountId,
  };
}

/**
 * Navigates to stake delegation page and sets up localStorage
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page object
 * @param {string} params.daoAccountId - DAO account ID
 */
export async function navigateToStakeDelegation({ page, daoAccountId }) {
  const url = `http://localhost:3000/${daoAccountId}/stake-delegation`;
  await page.goto(url);
  console.log(`✓ Navigated to: ${url}`);

  // Set localStorage
  await page.evaluate(() => {
    localStorage.setItem("selected-wallet", "test-wallet");
  });

  // Reload to apply localStorage changes
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  console.log("✓ Page loaded with authenticated user");
}

/**
 * Opens the create request form and selects a request type
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page object
 * @param {string} params.requestType - Request type ("Stake", "Unstake", "Withdraw")
 */
export async function openCreateRequestForm({ page, requestType }) {
  const createButton = page.getByRole("button", { name: /Create Request/i });
  await createButton.click();
  await page.waitForTimeout(500);

  const requestOption = await page
    .locator(".dropdown-item")
    .getByText(requestType, { exact: true });
  await requestOption.click();
  await page.waitForTimeout(1500);
  console.log(`✓ Selected '${requestType}' from dropdown`);
}

/**
 * Votes on and approves a proposal
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page object
 */
export async function voteAndApproveProposal({ page }) {
  const approveButton = page.getByRole("button", { name: "Approve" }).first();
  await approveButton.click();
  console.log("✓ Clicked Approve button");

  await page.waitForTimeout(2000);
  const voteConfirmButton = page.getByRole("button", { name: "Confirm" });
  await voteConfirmButton.click();
  console.log("✓ Confirmed vote");

  // Check for success message
  await page
    .getByText("The request has been successfully approved.")
    .waitFor({ timeout: 30000 });
  console.log("✓ Request executed successfully");
}

/**
 * Verifies a proposal appears in the table
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page object
 * @param {string} params.text - Text to search for in the proposal
 */
export async function verifyProposalInTable({ page, text }) {
  await page.getByText(text).waitFor({ timeout: 10000 });
  console.log(`✓ Proposal "${text}" appears in table`);
}

/**
 * Closes the offcanvas/modal by clicking the close button
 *
 * @param {Page} page - Playwright page object
 */
export async function closeOffcanvas(page) {
  const closeButton = page.locator(".bi-x-lg");
  await closeButton.click();
  await page.waitForTimeout(1000);
}

/**
 * Selects a validator from the dropdown
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page object
 * @param {string} [params.validatorName="astro-stakers.poolv1.near"] - Validator name
 */
export async function selectValidator({
  page,
  validatorName = "astro-stakers.poolv1.near",
}) {
  const canvas = page.locator(".offcanvas-body");
  const validatorDropdown = canvas.locator(
    '[data-testid="validator-dropdown"]'
  );
  await validatorDropdown.click();
  await page.waitForTimeout(1000);

  const modal = page.locator(".modal-content");
  await modal.waitFor({ state: "visible", timeout: 5000 });

  const validator = modal
    .getByTestId("validator-option")
    .filter({ hasText: validatorName });
  await validator.click();

  await modal.waitFor({ state: "hidden", timeout: 5000 });

  await expect(validatorDropdown).toContainText(validatorName);

  await page.waitForTimeout(500);
  console.log(`✓ Selected ${validatorName} validator`);
}

/**
 * Reopens the create request form to check balances
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page object
 * @param {string} params.requestType - Request type ("Stake", "Unstake", "Withdraw")
 * @returns {Locator} Canvas locator for further assertions
 */
export async function reopenFormToCheckBalances({ page, requestType }) {
  await page.getByRole("button", { name: "" }).click();
  await page.waitForTimeout(500);

  await page
    .locator("a")
    .filter({ hasText: new RegExp(`^${requestType}$`) })
    .click();

  const balanceCanvas = page.locator(".offcanvas-body");
  await balanceCanvas.waitFor({ state: "visible", timeout: 5000 });

  const balanceDisplay = balanceCanvas.locator(
    '[data-testid="balance-display"]'
  );
  await balanceDisplay.waitFor({ timeout: 10000 });

  return balanceCanvas;
}

/**
 * Selects a wallet from the wallet dropdown
 *
 * @param {Object} params
 * @param {Page} params.page - Playwright page object
 * @param {string} params.walletType - Wallet type ("Lockup" or "SputnikDAO")
 */
export async function selectWallet({ page, walletType }) {
  const canvas = page.locator(".offcanvas-body");
  const walletDropdown = canvas.locator('[data-testid="wallet-dropdown"]');
  await walletDropdown.click();
  await page.waitForTimeout(500);

  const walletOption = await walletDropdown.getByText(walletType);
  await walletOption.click();
  await page.waitForTimeout(1000);
  console.log(`✓ Selected ${walletType} wallet`);
}

// ============================================================================
// Staking & Blockchain Utilities
// ============================================================================

/**
 * Helper to convert NEAR to yoctoNEAR
 */
export function toYoctoNEAR(nearAmount) {
  return BigInt(parseFloat(nearAmount) * 1e24).toString();
}

/**
 * Helper to convert yoctoNEAR to NEAR
 * @private
 */
function fromYoctoNEAR(yoctoAmount) {
  return (BigInt(yoctoAmount) / BigInt("1000000000000000000000000")).toString();
}

/**
 * Deploy staking pool infrastructure in sandbox
 * Creates the poolv1.near factory and astro-stakers.poolv1.near validator pool.
 * @private - used internally by setupTestDAO
 */
async function _deployStakingPool({ sandbox, creatorAccountId }) {
  console.log("\n=== Deploying Staking Pool Infrastructure ===\n");

  // Step 1: Import and deploy poolv1.near factory if not exists
  try {
    await sandbox.importMainnetContract(POOL_FACTORY_ID, POOL_FACTORY_ID);

    await sandbox.functionCall(
      creatorAccountId,
      POOL_FACTORY_ID,
      "new",
      {
        staking_pool_whitelist_account_id: LOCKUP_WHITELIST_ID,
      },
      "300000000000000"
    );
    console.log(`✓ Initialized ${POOL_FACTORY_ID} factory`);
  } catch (e) {
    console.error(`Error importing ${POOL_FACTORY_ID} factory:`, e);
  }

  // Step 2: Create astro-stakers staking pool
  const creatorKeyPair = sandbox.accountKeys?.get(creatorAccountId);
  const publicKey = creatorKeyPair
    ? creatorKeyPair.getPublicKey().toString()
    : "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp";

  await sandbox.functionCall(
    creatorAccountId,
    POOL_FACTORY_ID,
    "create_staking_pool",
    {
      staking_pool_id: "astro-stakers",
      owner_id: creatorAccountId,
      stake_public_key: publicKey,
      reward_fee_fraction: {
        numerator: 10,
        denominator: 100,
      },
    },
    "300000000000000",
    await parseNEAR("32") // 32 NEAR attached deposit
  );
  console.log(`✓ Created staking pool: ${ASTRO_STAKERS_POOL_ID}`);
}

/**
 * Stake NEAR directly from DAO to validator (not through lockup)
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.daoAccountId - DAO account ID
 * @param {string} params.validatorPoolId - Validator pool ID
 * @param {string} params.amount - Amount to stake in yoctoNEAR
 * @param {string} params.callerAccountId - Account calling the function (must be DAO member)
 * @param {string} params.proposalBond - Proposal bond (default: "0")
 * @returns {Promise<number>} Proposal ID
 */
export async function stakeFromDAO({
  sandbox,
  daoAccountId,
  validatorPoolId,
  amount,
  callerAccountId,
  proposalBond = "0",
}) {
  console.log(
    `Staking ${fromYoctoNEAR(amount)} NEAR from DAO to ${validatorPoolId}...`
  );

  // Create proposal to stake from DAO
  const createProposalResult = await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "add_proposal",
    {
      proposal: {
        description: `Stake ${fromYoctoNEAR(amount)} NEAR to validator`,
        kind: {
          FunctionCall: {
            receiver_id: validatorPoolId,
            actions: [
              {
                method_name: "deposit_and_stake",
                args: Buffer.from(JSON.stringify({})).toString("base64"),
                deposit: amount,
                gas: "150000000000000",
              },
            ],
          },
        },
      },
    },
    "300000000000000",
    proposalBond
  );

  // Extract proposal ID from success value (base64 encoded)
  const proposalId = parseInt(
    Buffer.from(
      createProposalResult.receiptsOutcome[0].outcome.status.SuccessValue,
      "base64"
    ).toString()
  );
  console.log(`✓ Created stake proposal (ID: ${proposalId})`);

  // Vote and approve the proposal
  await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "act_proposal",
    {
      id: proposalId,
      action: "VoteApprove",
    },
    "300000000000000"
  );

  console.log(`✓ Staked ${fromYoctoNEAR(amount)} NEAR from DAO`);
  return proposalId;
}

/**
 * Unstake NEAR directly from DAO's validator (not through lockup)
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.daoAccountId - DAO account ID
 * @param {string} params.validatorPoolId - Validator pool ID
 * @param {string} params.amount - Amount to unstake in yoctoNEAR
 * @param {string} params.callerAccountId - Account calling the function (must be DAO member)
 * @param {string} params.proposalBond - Proposal bond (default: "0")
 * @returns {Promise<number>} Proposal ID
 */
export async function unstakeFromDAO({
  sandbox,
  daoAccountId,
  validatorPoolId,
  amount,
  callerAccountId,
  proposalBond = "0",
}) {
  console.log(
    `Unstaking ${fromYoctoNEAR(amount)} NEAR from ${validatorPoolId}...`
  );

  // Create proposal to unstake from DAO
  const createProposalResult = await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "add_proposal",
    {
      proposal: {
        description: `Unstake ${fromYoctoNEAR(amount)} NEAR from validator`,
        kind: {
          FunctionCall: {
            receiver_id: validatorPoolId,
            actions: [
              {
                method_name: "unstake",
                args: Buffer.from(JSON.stringify({ amount })).toString(
                  "base64"
                ),
                deposit: "0",
                gas: "150000000000000",
              },
            ],
          },
        },
      },
    },
    "300000000000000",
    proposalBond
  );

  // Extract proposal ID from success value (base64 encoded)
  const proposalId = parseInt(
    Buffer.from(
      createProposalResult.receiptsOutcome[0].outcome.status.SuccessValue,
      "base64"
    ).toString()
  );
  console.log(`✓ Created unstake proposal (ID: ${proposalId})`);

  // Vote and approve the proposal
  await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "act_proposal",
    {
      id: proposalId,
      action: "VoteApprove",
    },
    "300000000000000"
  );

  console.log(`✓ Unstaked ${fromYoctoNEAR(amount)} NEAR from DAO`);
  return proposalId;
}

// ============================================================================
// Lockup Staking Operations
// ============================================================================

/**
 * Select a staking pool for a lockup contract
 * This is required before staking with a new validator
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.daoAccountId - DAO account ID
 * @param {string} params.lockupContractId - Lockup contract ID
 * @param {string} params.validatorPoolId - Validator pool ID
 * @param {string} params.callerAccountId - Account calling the function (must be DAO member)
 * @returns {Promise<number>} Proposal ID
 */
export async function selectStakingPool({
  sandbox,
  lockupContractId,
  validatorPoolId,
  daoAccountId,
  callerAccountId,
}) {
  console.log(
    `Selecting staking pool ${validatorPoolId} for lockup ${lockupContractId}...`
  );

  // Create proposal to select staking pool
  const selectStakingPoolResult = await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "add_proposal",
    {
      proposal: {
        description: `Select staking pool ${validatorPoolId} for lockup`,
        kind: {
          FunctionCall: {
            receiver_id: lockupContractId,
            actions: [
              {
                method_name: "select_staking_pool",
                args: Buffer.from(
                  JSON.stringify({
                    staking_pool_account_id: validatorPoolId,
                  })
                ).toString("base64"),
                deposit: "0",
                gas: "150000000000000",
              },
            ],
          },
        },
      },
    },
    "300000000000000",
    "0" // proposal bond
  );

  // Extract proposal ID from success value (base64 encoded)
  const proposalId = parseInt(
    Buffer.from(
      selectStakingPoolResult.receiptsOutcome[0].outcome.status.SuccessValue,
      "base64"
    ).toString()
  );
  console.log(`✓ Created select staking pool proposal (ID: ${proposalId})`);

  // Vote and approve the proposal
  await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "act_proposal",
    {
      id: proposalId,
      action: "VoteApprove",
    },
    "300000000000000"
  );

  console.log(`✓ Selected staking pool: ${validatorPoolId}`);
  return proposalId;
}

/**
 * Stake tokens through a lockup contract
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.daoAccountId - DAO account ID
 * @param {string} params.lockupContractId - Lockup contract ID
 * @param {string} params.amount - Amount to stake in yoctoNEAR
 * @param {string} params.callerAccountId - Account calling the function (must be DAO member)
 * @returns {Promise<number>} Proposal ID
 */
export async function stakeThroughLockup({
  sandbox,
  daoAccountId,
  lockupContractId,
  amount,
  callerAccountId,
}) {
  console.log(
    `Staking ${fromYoctoNEAR(amount)} NEAR through lockup ${lockupContractId}...`
  );

  // Create proposal to stake through lockup
  const stakeThroughLockupResult = await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "add_proposal",
    {
      proposal: {
        description: `Stake ${fromYoctoNEAR(amount)} NEAR through lockup`,
        kind: {
          FunctionCall: {
            receiver_id: lockupContractId,
            actions: [
              {
                method_name: "deposit_and_stake",
                args: Buffer.from(JSON.stringify({ amount })).toString(
                  "base64"
                ),
                deposit: "0",
                gas: "150000000000000",
              },
            ],
          },
        },
      },
    },
    "300000000000000",
    "0" // proposal bond
  );

  // Extract proposal ID from success value (base64 encoded)
  const proposalId = parseInt(
    Buffer.from(
      stakeThroughLockupResult.receiptsOutcome[0].outcome.status.SuccessValue,
      "base64"
    ).toString()
  );
  console.log(`✓ Created stake proposal (ID: ${proposalId})`);

  // Vote and approve the proposal
  await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "act_proposal",
    {
      id: proposalId,
      action: "VoteApprove",
    },
    "300000000000000"
  );

  console.log(`✓ Staked ${fromYoctoNEAR(amount)} NEAR`);
  return proposalId;
}

/**
 * Unstake tokens through a lockup contract
 *
 * @param {Object} params
 * @param {NearSandbox} params.sandbox - Sandbox instance
 * @param {string} params.daoAccountId - DAO account ID
 * @param {string} params.lockupContractId - Lockup contract ID
 * @param {string} params.amount - Amount to unstake in yoctoNEAR
 * @param {string} params.callerAccountId - Account calling the function (must be DAO member)
 * @returns {Promise<number>} Proposal ID
 */
export async function unstakeThroughLockup({
  sandbox,
  daoAccountId,
  lockupContractId,
  amount,
  callerAccountId,
}) {
  console.log(
    `Unstaking ${fromYoctoNEAR(amount)} NEAR through lockup ${lockupContractId}...`
  );

  // Create proposal to unstake through lockup
  const createProposalResult = await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "add_proposal",
    {
      proposal: {
        description: `Unstake ${fromYoctoNEAR(amount)} NEAR through lockup`,
        kind: {
          FunctionCall: {
            receiver_id: lockupContractId,
            actions: [
              {
                method_name: "unstake",
                args: Buffer.from(JSON.stringify({ amount })).toString(
                  "base64"
                ),
                deposit: "0",
                gas: "150000000000000",
              },
            ],
          },
        },
      },
    },
    "300000000000000",
    "0" // proposal bond
  );

  // Extract proposal ID from success value (base64 encoded)
  const proposalId = parseInt(
    Buffer.from(
      createProposalResult.receiptsOutcome[0].outcome.status.SuccessValue,
      "base64"
    ).toString()
  );
  console.log(`✓ Created unstake proposal (ID: ${proposalId})`);

  // Vote and approve the proposal
  await sandbox.functionCall(
    callerAccountId,
    daoAccountId,
    "act_proposal",
    {
      id: proposalId,
      action: "VoteApprove",
    },
    "300000000000000"
  );

  console.log(`✓ Unstaked ${fromYoctoNEAR(amount)} NEAR`);
  return proposalId;
}

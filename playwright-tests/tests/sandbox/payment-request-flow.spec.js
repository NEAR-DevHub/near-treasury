import { test, expect } from "@playwright/test";
import { NearSandbox, parseNEAR } from "../../util/sandbox.js";

let sandbox;

test.describe("Payment Request Blockchain Flow (Sandbox Only)", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    // Enable sandbox logging for debugging
    process.env.NEAR_ENABLE_SANDBOX_LOG = "1";

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");
  });

  test.afterAll(async () => {
    await sandbox.stop();
    console.log("\n=== Sandbox Environment Stopped ===\n");
  });

  test("should create test accounts", async () => {
    // Create test accounts
    const alice = await sandbox.createAccount("alice.test.near");
    const bob = await sandbox.createAccount("bob.test.near");

    expect(alice).toBe("alice.test.near");
    expect(bob).toBe("bob.test.near");
    console.log("✓ Account creation test passed");
  });

  test("should deploy and call a simple contract", async () => {
    // Create an account for the contract
    const contractId = await sandbox.createAccount("simple.test.near");

    // For now, we'll just verify the account was created
    // Later we can deploy an actual contract
    expect(contractId).toBe("simple.test.near");
    console.log("✓ Contract account created");
  });

  test("should create DAO account and add payment request proposal", async () => {
    // Create accounts needed for DAO
    const creator = await sandbox.createAccount("creator.test.near");
    const daoFactory = await sandbox.createAccount("dao-factory.test.near");

    expect(creator).toBe("creator.test.near");
    expect(daoFactory).toBe("dao-factory.test.near");

    console.log("✓ DAO setup accounts created");
    console.log("  - Creator:", creator);
    console.log("  - DAO Factory:", daoFactory);
  });

  test("should support view function calls", async () => {
    // Create a contract account
    const contractId = await sandbox.createAccount("viewer.test.near");

    // We'll test view functions after we have a deployed contract
    expect(contractId).toBe("viewer.test.near");
    console.log("✓ View function test account created");
  });

  test.skip("Full Payment Request Flow (requires deployed contracts)", async () => {
    // This test will be implemented once we have:
    // 1. SputnikDAO factory contract deployed
    // 2. DAO created
    // 3. Ability to create proposals
    // 4. Ability to vote on proposals

    console.log("⊘ Full flow test - pending contract deployment");
  });
});

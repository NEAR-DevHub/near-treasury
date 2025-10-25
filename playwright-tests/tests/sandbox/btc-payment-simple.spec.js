import { test, expect } from "@playwright/test";
import { NearSandbox, parseNEAR } from "../../util/sandbox.js";

let sandbox;

test.describe("BTC Payment Simple Test", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    process.env.NEAR_ENABLE_SANDBOX_LOG = "1";

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");
  });

  test.afterAll(async () => {
    await sandbox.stop();
    console.log("\n=== Sandbox Environment Stopped ===\n");
  });

  test("simple contract import and initialization", async () => {
    test.setTimeout(120_000);

    console.log("Step 1: Import omft.near contract");
    const omftContractId = await sandbox.importMainnetContract("omft.near", "omft.near");
    expect(omftContractId).toBe("omft.near");

    console.log("Step 2: Try to initialize omft contract");
    try {
      const result = await sandbox.functionCall(
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
        },
        "300000000000000", // 300 Tgas
        "0" // no deposit
      );
      console.log("Initialization result:", JSON.stringify(result.status, null, 2));
      expect(result.failed).toBeFalsy();
    } catch (error) {
      console.error("Error initializing contract:", error.message);
      if (error.data) {
        console.error("Error data:", JSON.stringify(error.data, null, 2));
      }
      throw error;
    }

    console.log("✓ Contract initialized successfully");
  });
});

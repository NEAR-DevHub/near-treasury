import { test, expect } from "@playwright/test";
import { NearSandbox, parseNEAR } from "../../util/sandbox.js";

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";

let sandbox;

test.describe("DAO Factory Test", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);
    process.env.NEAR_ENABLE_SANDBOX_LOG = "1";
    sandbox = new NearSandbox();
    await sandbox.start();
    console.log("\n=== Sandbox Environment Started ===\n");
  });

  test.afterAll(async () => {
    await sandbox.stop();
    console.log("\n=== Sandbox Environment Stopped ===\n");
  });

  test("import and initialize DAO factory", async () => {
    test.setTimeout(120_000);

    console.log("Step 1: Import sputnik-dao factory");
    const factoryContractId = await sandbox.importMainnetContract(
      SPUTNIK_DAO_FACTORY_ID,
      SPUTNIK_DAO_FACTORY_ID
    );
    expect(factoryContractId).toBe(SPUTNIK_DAO_FACTORY_ID);

    console.log("Step 2: Initialize sputnik-dao factory");
    try {
      const result = await sandbox.functionCall(
        factoryContractId,
        SPUTNIK_DAO_FACTORY_ID,
        "new",
        {},
        "300000000000000",
        "0"
      );
      console.log("Factory initialization result:", JSON.stringify(result.status, null, 2));

      if (result.failed) {
        console.error("Transaction failed!");
        console.error("Logs:", result.logs);
      }

      expect(result.failed).toBeFalsy();
    } catch (error) {
      console.error("Error initializing factory:", error.message);
      if (error.code) console.error("Error code:", error.code);
      if (error.data) console.error("Error data:", JSON.stringify(error.data, null, 2));
      throw error;
    }

    console.log("✓ DAO Factory initialized successfully");
  });
});

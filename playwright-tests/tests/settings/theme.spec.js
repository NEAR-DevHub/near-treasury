import path from "path";
import { expect } from "@playwright/test";
import {
  NearSandbox,
  injectTestWallet,
  interceptIndexerAPI,
  interceptRPC,
  parseNEAR,
} from "../../util/sandbox.js";
import { test } from "../../util/test.js";

const DAO_ID = "devdao.sputnik-dao.near";
const ASSETS_PATH = path.join(
  process.cwd(),
  "playwright-tests/tests/settings/assets"
);

function toBase64(json) {
  return Buffer.from(JSON.stringify(json)).toString("base64");
}

const metadata = {
  flagLogo:
    "https://ipfs.near.social/ipfs/bafkreiboarigt5w26y5jyxyl4au7r2dl76o5lrm2jqjgqpooakck5xsojq",
  displayName: "testing-astradao",
  primaryColor: "#2f5483",
  theme: "dark",
};

async function navigateToThemePage({ page, daoId = DAO_ID }) {
  const baseUrl = `http://localhost:3000/${daoId}/settings`;
  await page.goto(`${baseUrl}?tab=theme-logo`);
  await page.waitForTimeout(5_000);
  await expect(page.getByText("Theme & Logo").nth(1)).toBeVisible();
}

async function expectImageUploadLabelVisible(page) {
  const imageUploaderLabel = page.locator("label[for='imageUpload']");
  await expect(imageUploaderLabel).toBeVisible();
  return imageUploaderLabel;
}

export async function getTransactionModalObject(page) {
  return await JSON.parse(
    await page.locator("div.modal-body code").first().innerText()
  );
}

test.describe("Theme & Logo behavior for logged-in user", () => {
  test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

  test.beforeEach(async ({ page, instanceAccount }, testInfo) => {
    await navigateToThemePage({ page, instanceAccount });
  });
});

const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";

let sandbox;
let factoryContractId;
let creatorAccountId;
let daoAccountId;
let lowBalanceVoterAccountId;
let voteOnlyAccountId;

test.describe("Theme & Logo image uploads for logged-in user in sandbox", () => {
  test.beforeAll(async () => {
    test.setTimeout(300000); // 5 minutes for setup

    sandbox = new NearSandbox();
    await sandbox.start();

    console.log("\n=== Sandbox Environment Started ===\n");

    // Import sputnik-dao factory from mainnet
    factoryContractId = await sandbox.importMainnetContract(
      SPUTNIK_DAO_FACTORY_ID,
      SPUTNIK_DAO_FACTORY_ID
    );

    // Create a test account to be the DAO creator with 100 NEAR
    creatorAccountId = await sandbox.createAccount(
      "testcreator.near",
      "100000000000000000000000000"
    );
    console.log(`Creator account: ${creatorAccountId}`);

    // Create voter account with INSUFFICIENT balance (0.05 NEAR)
    lowBalanceVoterAccountId = await sandbox.createAccount(
      "lowbalancevoter.near",
      await parseNEAR("0.05")
    );
    console.log(`Low balance voter account: ${lowBalanceVoterAccountId}`);

    // Create a user with only vote permissions
    voteOnlyAccountId = await sandbox.createAccount(
      "voteonly.near",
      await parseNEAR("100")
    );
    console.log(`Vote only account: ${voteOnlyAccountId}`);

    // Initialize the factory
    await sandbox.functionCall(
      factoryContractId,
      SPUTNIK_DAO_FACTORY_ID,
      "new",
      {},
      "300000000000000"
    );

    // Create a DAO
    const daoName = "testdao";
    const daoPolicy = {
      roles: [
        {
          kind: { Group: [creatorAccountId, lowBalanceVoterAccountId] },
          name: "Manage Members",
          permissions: [
            "config:*",
            "policy:*",
            "add_member_to_role:*",
            "remove_member_from_role:*",
            "*:AddProposal",
          ],
          vote_policy: {},
        },
        {
          kind: { Group: [voteOnlyAccountId] },
          name: "Vote",
          permissions: [
            "*:VoteReject",
            "*:VoteApprove",
            "*:VoteRemove",
            "*:RemoveProposal",
            "*:Finalize",
          ],
          vote_policy: {},
        },
      ],
      default_vote_policy: {
        weight_kind: "RoleWeight",
        quorum: "0",
        threshold: [1, 2],
      },
      proposal_bond: "0",
      proposal_period: "604800000000000",
      bounty_bond: "100000000000000000000000",
      bounty_forgiveness_period: "604800000000000",
    };

    await sandbox.functionCall(
      creatorAccountId,
      factoryContractId,
      "create",
      {
        name: daoName,
        args: Buffer.from(
          JSON.stringify({
            config: {
              name: "testing-astradao",
              metadata: toBase64(metadata),
              purpose: "Test DAO for theme settings",
            },
            policy: daoPolicy,
          })
        ).toString("base64"),
      },
      "300000000000000",
      await parseNEAR("6")
    );

    daoAccountId = `${daoName}.${factoryContractId}`;
    console.log(`DAO created: ${daoAccountId}`);
  });

  test.afterAll(async () => {
    await sandbox.stop();
    console.log("\n=== Sandbox Environment Stopped ===\n");
  });

  test.describe("Theme & Logo Permissions", () => {
    test.beforeEach(async ({ page }) => {
      await interceptIndexerAPI(page, sandbox);
      await interceptRPC(page, sandbox);
    });

    test("should disable config for unauthorized user", async ({ page }) => {
      await navigateToThemePage({ page, daoId: daoAccountId });

      const colorInput = page.getByTestId("color-picker-input");
      const submitButton = page.getByRole("button", {
        name: "Submit Request",
      });

      await expect(colorInput).toBeDisabled();
      await expect(submitButton).not.toBeVisible();
    });

    test("should enable config for authorized user (Create role)", async ({
      page,
    }) => {
      await injectTestWallet(page, sandbox, creatorAccountId);
      await navigateToThemePage({ page, daoId: daoAccountId });

      const colorInput = page.getByTestId("color-picker-input");
      const submitButton = page.getByRole("button", {
        name: "Submit Request",
      });

      await expect(colorInput).toBeEnabled();
      await expect(submitButton).toBeVisible();
    });

    test("should disable config for user with Vote role", async ({ page }) => {
      await injectTestWallet(page, sandbox, voteOnlyAccountId);
      await navigateToThemePage({ page, daoId: daoAccountId });

      const colorInput = page.getByTestId("color-picker-input");
      const submitButton = page.getByRole("button", {
        name: "Submit Request",
      });

      await expect(colorInput).toBeDisabled();
      await expect(submitButton).not.toBeVisible();
    });
  });

  test.describe("Theme & Logo image upload validations", () => {
    const MOCKED_CID = "simple_cid_1";
    const EXPECTED_IMAGE_URL = `https://ipfs.near.social/ipfs/${MOCKED_CID}`;

    test.beforeEach(async ({ page }) => {
      await injectTestWallet(page, sandbox, creatorAccountId);
      await interceptIndexerAPI(page, sandbox);
      await interceptRPC(page, sandbox);

      await navigateToThemePage({ page, daoId: daoAccountId });

      await page.route("https://ipfs.near.social/add", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ cid: MOCKED_CID }),
        });
      });
    });

    test("should show error when logo image with invalid dimensions is uploaded", async ({
      page,
    }) => {
      await expectImageUploadLabelVisible(page);
      const logoInput = page.locator("input[type=file]");
      const submitBtn = page.getByRole("button", {
        name: "Submit Request",
      });

      await logoInput.setInputFiles(path.join(ASSETS_PATH, "invalid.png"));
      await expect(
        page.getByText(
          "Invalid logo. Please upload a PNG, JPG, or SVG file that is exactly 256x256 px"
        )
      ).toBeVisible();
      await expect(submitBtn).toBeDisabled();
    });

    test("should show error when upload image fails", async ({ page }) => {
      await expectImageUploadLabelVisible(page);
      await page.route("https://ipfs.near.social/add", async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "" }),
        });
      });
      const submitBtn = page.getByRole("button", { name: "Submit Request" });
      const logoInput = page.locator("input[type=file]");
      await logoInput.setInputFiles(path.join(ASSETS_PATH, "valid.jpg"));
      await expect(submitBtn).toBeDisabled();
      await expect(
        page.getByText(
          "Error occurred while uploading image, please try again."
        )
      ).toBeVisible();
    });

    test("should preview uploaded logo when image is valid", async ({
      page,
    }) => {
      await expectImageUploadLabelVisible(page);
      const logoInput = page.locator("input[type=file]");

      await logoInput.setInputFiles(path.join(ASSETS_PATH, "valid.jpg"));
      await expect(page.locator("img[alt='DAO Logo']")).toHaveAttribute(
        "src",
        EXPECTED_IMAGE_URL
      );
    });

    test("should create ChangeConfig proposal after successful logo upload", async ({
      page,
    }) => {
      await expectImageUploadLabelVisible(page);
      const logoInput = page.locator("input[type=file]");
      const submitBtn = page.getByRole("button", {
        name: "Submit Request",
      });

      await logoInput.setInputFiles(path.join(ASSETS_PATH, "valid.jpg"));
      await submitBtn.click();

      await expect(
        page.getByText("Awaiting transaction confirmation...")
      ).toBeVisible();

      await expect(
        page.getByText("Proposal has been successfully created")
      ).toBeVisible({ timeout: 20000 });

      const lastProposalId = await sandbox.viewFunction(
        daoAccountId,
        "get_last_proposal_id",
        {}
      );

      expect(lastProposalId).toBeGreaterThan(-1);

      const proposal = await sandbox.viewFunction(
        daoAccountId,
        "get_proposal",
        {
          id: lastProposalId - 1,
        }
      );

      // Verify it's a ChangeConfig proposal
      expect(proposal.kind.ChangeConfig).toBeDefined();

      const configMetadata = JSON.parse(
        Buffer.from(
          proposal.kind.ChangeConfig.config.metadata,
          "base64"
        ).toString()
      );
      expect(configMetadata.flagLogo).toBe(EXPECTED_IMAGE_URL);
    });

    test("should be able to change color and theme", async ({ page }) => {
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const newColor = "#000000";
      await page.getByTestId("color-text-input").fill(newColor);
      await page.getByTestId("theme-toggle").click();
      await page.getByRole("button", { name: "Submit Request" }).click();
      await expect(
        page.getByText("Awaiting transaction confirmation...")
      ).toBeVisible();

      await expect(
        page.getByText("Proposal has been successfully created")
      ).toBeVisible({ timeout: 20000 });

      // Verify the proposal was created on the sandbox
      const lastProposalId = await sandbox.viewFunction(
        daoAccountId,
        "get_last_proposal_id",
        {}
      );

      expect(lastProposalId).toBeGreaterThan(-1);
      const proposal = await sandbox.viewFunction(
        daoAccountId,
        "get_proposal",
        {
          id: lastProposalId - 1,
        }
      );
      expect(proposal.kind.ChangeConfig).toBeDefined();
      const configMetadata = JSON.parse(
        Buffer.from(
          proposal.kind.ChangeConfig.config.metadata,
          "base64"
        ).toString()
      );
      expect(configMetadata.primaryColor).toBe(newColor);
      expect(configMetadata.theme).toBe("dark");
    });

    test("should toggle action buttons based on form changes", async ({
      page,
    }) => {
      const submitRequestButton = page.getByRole("button", {
        name: "Submit Request",
      });
      const cancelButton = page.getByRole("button", { name: "Cancel" });

      // Initially, both buttons should be disabled
      await expect(submitRequestButton).toBeDisabled();
      await expect(cancelButton).toBeDisabled();

      // Changing color input should enable the buttons
      const colorInput = page.getByTestId("color-text-input");
      await colorInput.fill("#000000");

      await expect(submitRequestButton).toBeEnabled();
      await expect(cancelButton).toBeEnabled();

      // Clicking the cancel button should reset the form and disable both buttons
      await cancelButton.click();
      await expect(submitRequestButton).toBeDisabled();
      await expect(cancelButton).toBeDisabled();
    });

    test("should show warning modal and block action when account balance is insufficient", async ({
      page,
    }) => {
      await injectTestWallet(page, sandbox, lowBalanceVoterAccountId);
      await interceptIndexerAPI(page, sandbox);
      await interceptRPC(page, sandbox);

      await navigateToThemePage({ page, daoId: daoAccountId });

      const colorInput = page.getByTestId("color-text-input");
      await colorInput.fill("#000000");

      await page
        .getByText("Submit Request", {
          exact: true,
        })
        .click();

      await expect(
        page.getByRole("heading", { name: /Insufficient Funds/i })
      ).toBeVisible({ timeout: 5000 });

      await expect(
        page.getByText(
          /you don't have enough NEAR to complete actions on your treasury/i
        )
      ).toBeVisible();

      await expect(
        page.getByText("Please add more funds to your account and try again")
      ).toBeVisible();

      const closeButton = page.getByRole("button", { name: "Close" });
      await expect(closeButton).toBeVisible({ timeout: 5000 });
      await closeButton.click();

      await expect(
        page.getByRole("heading", { name: /Insufficient Funds/i })
      ).not.toBeVisible();
    });
  });
});

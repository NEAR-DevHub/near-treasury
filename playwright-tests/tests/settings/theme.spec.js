import path from "path";
import { expect } from "@playwright/test";
import {
  NearSandbox,
  parseNEAR,
  setupTestEnvironment,
} from "../../util/sandbox.js";
import { test } from "../../util/test.js";

const DAO_ID = "devdao.sputnik-dao.near";
const ASSETS_PATH = path.join(
  process.cwd(),
  "playwright-tests/tests/settings/assets"
);

async function navigateToThemePage({ page, daoId = DAO_ID }) {
  const baseUrl = `http://localhost:3000/${daoId}/settings`;
  await page.goto(`${baseUrl}?tab=theme-logo`, { waitUntil: "networkidle" });
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
              metadata: "",
              purpose: "Test DAO for asset exchange",
            },
            policy: {
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
                  ],
                  vote_policy: {},
                },
              ],
              default_vote_policy: {
                weight_kind: "RoleWeight",
                quorum: "0",
                threshold: [1, 10],
              },
              proposal_bond: "0",
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
    console.log(`DAO created: ${daoAccountId}`);
  });

  test.afterAll(async () => {
    if (sandbox) {
      await sandbox.stop();
      console.log("\n✓ Sandbox stopped");
    }
  });

  test.describe("Theme & Logo Permissions", () => {
    test("should disable config for unauthorized user", async ({ page }) => {
      test.setTimeout(120000);
      await setupTestEnvironment({ page, sandbox });
      await navigateToThemePage({ page, daoId: daoAccountId });

      const colorInput = page.getByTestId("color-picker-input");
      const submitButton = page.getByRole("button", {
        name: "Submit Request",
      });

      const logoImg = page.locator("img[alt='DAO Logo']");

      await expect(logoImg).toBeVisible();
      await expect(logoImg).toHaveAttribute(
        "src",
        "https://github.com/user-attachments/assets/244e15fc-3fb7-4067-a2c3-013e189e8d20"
      );
      await expect(colorInput).toHaveValue("#01bf7a");
      await expect(colorInput).toBeDisabled();
      await expect(submitButton).not.toBeVisible();
    });

    test("should enable config for authorized user (Create role)", async ({
      page,
    }) => {
      test.setTimeout(120000);
      await setupTestEnvironment({ page, sandbox, creatorAccountId });
      await navigateToThemePage({ page, daoId: daoAccountId });

      const colorInput = page.getByTestId("color-picker-input");
      const submitButton = page.getByRole("button", {
        name: "Submit Request",
      });

      await expect(colorInput).toBeEnabled();
      await expect(submitButton).toBeVisible();
    });

    test("should disable config for user with Vote role", async ({ page }) => {
      test.setTimeout(120000);
      await setupTestEnvironment({
        page,
        sandbox,
        creatorAccountId: voteOnlyAccountId,
      });
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
      await setupTestEnvironment({ page, sandbox, creatorAccountId });

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
      test.setTimeout(120000);
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
      test.setTimeout(120000);
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
      test.setTimeout(120000);
      await expectImageUploadLabelVisible(page);
      const logoInput = page.locator("input[type=file]");

      await logoInput.setInputFiles(path.join(ASSETS_PATH, "valid.jpg"));
      await expect(page.locator("img[alt='DAO Logo']")).toHaveAttribute(
        "src",
        EXPECTED_IMAGE_URL
      );
    });

    test("should update DAO theme (logo and color) via proposal workflow", async ({
      page,
    }) => {
      test.setTimeout(180000);
      await expectImageUploadLabelVisible(page);

      // Upload Logo
      const logoInput = page.locator("input[type=file]");
      await logoInput.setInputFiles(path.join(ASSETS_PATH, "valid.jpg"));

      // Change Color
      const newColor = "#000000";
      await page.getByTestId("color-text-input").fill(newColor);

      // Submit Request
      const submitBtn = page.getByRole("button", {
        name: "Submit Request",
      });
      await submitBtn.click();

      await expect(
        page.getByText("Awaiting transaction confirmation...")
      ).toBeVisible();

      await expect(
        page.getByText("Proposal has been successfully created")
      ).toBeVisible({ timeout: 20000 });

      // Go to the proposal page
      const viewRequestLink = page.getByText("View Request");
      await expect(viewRequestLink).toBeVisible();
      await viewRequestLink.click();

      await page.waitForTimeout(2500); // Wait slightly longer than the 2s cache invalidation delay

      // Approve proposal
      const approveButton = page.getByRole("button", { name: "Approve" });
      await expect(approveButton).toBeVisible();
      await approveButton.click();

      // Handle confirmation modal
      const confirmationButton = page.getByRole("button", { name: "Confirm" });
      await expect(confirmationButton).toBeVisible();
      await confirmationButton.click();

      await expect(
        page.getByText("The proposal has been successfully approved.")
      ).toBeVisible({ timeout: 30000 });

      // Navigate back to Theme settings to verify changes
      await navigateToThemePage({ page, daoId: daoAccountId });

      // Verify changes in UI
      await expect(page.locator("img[alt='DAO Logo']")).toHaveAttribute(
        "src",
        EXPECTED_IMAGE_URL
      );
      await expect(page.getByTestId("color-picker-input")).toHaveValue(
        newColor
      );
    });

    test("should toggle action buttons based on form changes", async ({
      page,
    }) => {
      test.setTimeout(120000);
      const submitRequestButton = page.getByRole("button", {
        name: "Submit Request",
      });
      const cancelButton = page.getByRole("button", { name: "Cancel" });

      // Initially, both buttons should be disabled
      await expect(submitRequestButton).toBeDisabled();
      await expect(cancelButton).toBeDisabled();

      // Ensure clicking disabled button does nothing
      await submitRequestButton.click({ force: true });
      await expect(
        page.getByText("Awaiting transaction confirmation...")
      ).not.toBeVisible();

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
      test.setTimeout(120000);
      await setupTestEnvironment({
        page,
        sandbox,
        creatorAccountId: lowBalanceVoterAccountId,
      });

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

      await expect(page.getByText(/You need at least/i)).toBeVisible();

      await page.waitForTimeout(1000);

      const closeButton = page.getByRole("button", { name: "Close" });
      await expect(closeButton).toBeVisible({ timeout: 5000 });
      await closeButton.click();

      await expect(
        page.getByRole("heading", { name: /Insufficient Funds/i })
      ).not.toBeVisible();
    });
  });
});

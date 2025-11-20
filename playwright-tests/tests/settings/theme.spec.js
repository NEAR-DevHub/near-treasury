import path from "path";
import { expect } from "@playwright/test";
import { test } from "../../util/test.js";
import {
  updateDaoPolicyMembers,
  mockRpcRequest,
  mockNearBalances,
} from "../../util/rpcmock.js";

const DAO_ID = "testing-astradao.sputnik-dao.near";
const SETTINGS_BASE_URL = `http://localhost:3000/${DAO_ID}/settings`;
const ASSETS_PATH = path.join(
  process.cwd(),
  "playwright-tests/tests/settings/assets"
);

function toBase64(json) {
  return Buffer.from(JSON.stringify(json)).toString("base64");
}

const InsufficientBalance = BigInt(0.05 * 10 ** 24).toString();

const metadata = {
  flagLogo:
    "https://ipfs.near.social/ipfs/bafkreiboarigt5w26y5jyxyl4au7r2dl76o5lrm2jqjgqpooakck5xsojq",
  displayName: "testing-astradao",
  primaryColor: "#2f5483",
  theme: "dark",
};

const config = {
  name: "testing-astradao",
  metadata: toBase64(metadata),
};

async function updateDaoConfig({ page }) {
  await mockRpcRequest({
    page,
    filterParams: {
      method_name: "get_config",
    },
    modifyOriginalResultFunction: () => {
      return config;
    },
  });
}

async function navigateToThemePage({ page, instanceAccount, hasAllRole }) {
  await page.goto(`${SETTINGS_BASE_URL}?tab=theme-logo`);
  await updateDaoPolicyMembers({ instanceAccount, page, hasAllRole });
  await updateDaoConfig({ page });
  await page.waitForTimeout(5_000);
  await expect(page.getByText("Theme & Logo").nth(1)).toBeVisible();
}

export async function getTransactionModalObject(page) {
  return await JSON.parse(
    await page.locator("div.modal-body code").first().innerText()
  );
}

test.describe.parallel("User logged in with different roles", function () {
  const roles = [
    {
      name: "Create role",
      storageState: "playwright-tests/util/logout-state.json",
      hasAllRole: false,
    },
    {
      name: "Vote role",
      storageState:
        // TODO: replace with correct logged in state with Vote role
        "playwright-tests/util/logged-in-state.json",
      hasAllRole: false,
    },
    {
      name: "All role",
      storageState: "playwright-tests/util/logged-in-state.json",
      hasAllRole: true,
    },
  ];

  for (const { name, storageState, hasAllRole } of roles) {
    test.describe(`User with '${name}'`, function () {
      test.use({ storageState });

      test("should only allow authorized users to change config", async ({
        page,
        instanceAccount,
      }) => {
        await navigateToThemePage({ page, instanceAccount, hasAllRole });
        await page.waitForTimeout(5000);
        const colorInput = page.locator("input[type='color']");
        const submitButton = page.getByRole("button", {
          name: "Submit Request",
        });
        if (hasAllRole) {
          await expect(colorInput).toBeEnabled();
          await expect(submitButton).toBeVisible();
        } else {
          await expect(colorInput).toBeDisabled();
          await expect(submitButton).not.toBeVisible();
        }
      });
    });
  }
});

test.describe("User is logged in", () => {
  test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

  test.beforeEach(async ({ page, instanceAccount }, testInfo) => {
    if (testInfo.title.includes("insufficient account balance")) {
      await mockNearBalances({
        page,
        accountId: "theori.near",
        balance: InsufficientBalance,
        storage: 8,
      });
    }
    await navigateToThemePage({ page, instanceAccount });
  });

  test("insufficient account balance should show warning modal, disallow action", async ({
    page,
  }) => {
    // TODO: doesn't appeared
    await expect(
      page.getByText(
        "Hey Ori, you don't have enough NEAR to complete actions on your treasury."
      )
    ).toBeVisible();
    const colorInput = page.getByRole("textbox").nth(1);
    await colorInput.fill("#000");
    await page
      .getByText("Submit Request", {
        exact: true,
      })
      .click();
    await expect(
      page
        .getByText("Please add more funds to your account and try again")
        .nth(1)
    ).toBeVisible();
  });

  test("should be able to upload image, should show error with incorrect width and allow correct one", async ({
    page,
  }) => {
    await expect(page.getByText("Upload Logo"), { exact: true }).toBeVisible();
    await page.route("https://ipfs.near.social/add", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ cid: "simple_cid_1" }),
      });
    });

    const logoInput = page.locator("input[type=file]");
    const submitBtn = page.getByRole("button", {
      name: "Submit Request",
    });
    // invalid image
    await logoInput.setInputFiles(path.join(ASSETS_PATH, "invalid.png"));
    await page.waitForTimeout(5_000);
    await expect(
      page.getByText(
        "Invalid logo. Please upload a PNG, JPG, or SVG file that is exactly 256x256 px"
      )
    ).toBeVisible();
    await expect(submitBtn).toBeDisabled();
    await logoInput.setInputFiles(path.join(ASSETS_PATH, "valid.jpg"));
    await submitBtn.click();
    await expect(
      page.getByText("Awaiting transaction confirmation...")
    ).toBeVisible();

    await expect(await getTransactionModalObject(page)).toEqual({
      proposal: {
        description: "* Title: Update Config - Theme & logo",
        kind: {
          ChangeConfig: {
            config: {
              ...config,
              metadata: toBase64({
                ...metadata,
                flagLogo: "https://ipfs.near.social/ipfs/simple_cid_1",
              }),
            },
          },
        },
      },
    });
  });
});

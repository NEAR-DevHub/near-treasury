import { test, expect } from "@playwright/test";

/**
 * Asset Exchange Form Validation Tests (Category 4: Component Tests)
 *
 * Ported from legacy oneclick-exchange-form.spec.js
 * Tests form validation and key user interactions without blockchain state.
 *
 * Test Category: Component Tests
 * - Fast (< 30 seconds)
 * - Tests validation logic, formatting, user input
 * - No blockchain state needed
 *
 * Key scenarios from legacy tests:
 * - Form field validation
 * - Slippage tolerance handling
 * - Decimal input validation
 */

const TEST_DAO_ID = "testing-astradao.sputnik-dao.near";

// Use logged-in storage state for authentication
test.use({ storageState: "playwright-tests/util/logged-in-state.json" });

test.describe("Asset Exchange Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to asset exchange page
    await page.goto(`http://localhost:3000/${TEST_DAO_ID}/asset-exchange`, {
      waitUntil: "networkidle",
    });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Click Create Request to open form - MUST be visible
    const createButton = page.getByRole("button", { name: /Create Request/i });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    await page.waitForTimeout(1500);

    // Verify form modal opened
    await expect(
      page.getByRole("heading", { name: /Asset Exchange Request/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("validates amount input accepts different formats", async ({ page }) => {
    // Amount input MUST be visible
    const amountInput = page.locator('input[type="number"]').first();
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // Test valid amount
    await amountInput.fill("1.0");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("1.0");
    console.log("✓ Amount input accepts valid decimal");

    // Test empty amount
    await amountInput.fill("");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("");
    console.log("✓ Amount input can be cleared");

    // Test zero amount
    await amountInput.fill("0");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("0");
    console.log("✓ Amount input accepts zero");

    // Test small decimal
    await amountInput.fill("0.00001");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("0.00001");
    console.log("✓ Amount input accepts small decimals");
  });

  test("handles slippage tolerance input", async ({ page }) => {
    // Scroll down to see slippage field
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Find slippage input - MUST be visible
    const slippageInput = page.locator('input[type="number"]').nth(1); // Second number input (first is amount)
    await expect(slippageInput).toBeVisible({ timeout: 5000 });

    // Check default value (should be 1%)
    const defaultValue = await slippageInput.inputValue();
    expect(defaultValue).toBe("1");
    console.log(`✓ Slippage input has default value: ${defaultValue}%`);

    // Test changing slippage
    await slippageInput.fill("2.5");
    await page.waitForTimeout(500);
    const newValue = await slippageInput.inputValue();
    expect(newValue).toBe("2.5");
    console.log("✓ Slippage tolerance can be changed");

    // Test valid range
    await slippageInput.fill("0.5");
    await page.waitForTimeout(500);
    const minValue = await slippageInput.inputValue();
    expect(minValue).toBe("0.5");
    console.log("✓ Slippage accepts 0.5%");

    await slippageInput.fill("5");
    await page.waitForTimeout(500);
    const maxValue = await slippageInput.inputValue();
    expect(maxValue).toBe("5");
    console.log("✓ Slippage accepts 5%");
  });

  test("decimal input field accepts decimal numbers correctly", async ({ page }) => {
    // Amount input MUST be visible
    const amountInput = page.locator('input[type="number"]').first();
    await expect(amountInput).toBeVisible({ timeout: 5000 });

    // Test various decimal formats
    await amountInput.fill("0.1");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("0.1");
    console.log("✓ Accepts 0.1");

    await amountInput.fill("0.001");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("0.001");
    console.log("✓ Accepts 0.001");

    await amountInput.fill("123.456");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("123.456");
    console.log("✓ Accepts 123.456");

    await amountInput.fill("1000.99");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("1000.99");
    console.log("✓ Accepts 1000.99");

    // Test edge case: very small number
    await amountInput.fill("0.00000001");
    await page.waitForTimeout(300);
    expect(await amountInput.inputValue()).toBe("0.00000001");
    console.log("✓ Accepts very small decimals (0.00000001)");
  });

  test("displays form sections and controls", async ({ page }) => {
    // Send section MUST be visible (use label selector to avoid strict mode)
    const sendLabel = page.locator('label').filter({ hasText: 'Send' }).first();
    await expect(sendLabel).toBeVisible({ timeout: 5000 });
    console.log("✓ Send section is visible");

    // Receive section MUST be visible
    const receiveLabel = page.locator('label').filter({ hasText: 'Receive' }).first();
    await expect(receiveLabel).toBeVisible({ timeout: 5000 });
    console.log("✓ Receive section is visible");

    // Scroll to see slippage section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Slippage label MUST be visible
    const slippageLabel = page.getByText(/Price Slippage Limit/i);
    await expect(slippageLabel).toBeVisible({ timeout: 5000 });
    console.log("✓ Slippage section is visible");

    // Token dropdowns MUST exist
    const tokenDropdowns = page.getByRole("button", { name: /Select token/i });
    const dropdownCount = await tokenDropdowns.count();
    expect(dropdownCount).toBeGreaterThanOrEqual(2); // At least 2 (Send and Receive)
    console.log(`✓ Found ${dropdownCount} token selection dropdown(s)`);
  });

  test("displays optional notes field", async ({ page }) => {
    // Scroll down to see notes field
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Notes textarea MUST be visible
    const notesTextarea = page.locator('textarea');
    await expect(notesTextarea).toBeVisible({ timeout: 5000 });

    // Test that notes can be entered
    await notesTextarea.fill("Test exchange notes");
    await page.waitForTimeout(300);
    const value = await notesTextarea.inputValue();
    expect(value).toContain("Test exchange");
    console.log("✓ Notes field accepts input");
  });

  test("token selection dropdown can be clicked", async ({ page }) => {
    // Token dropdown MUST be visible
    const tokenDropdown = page.getByRole("button", { name: /Select token/i }).first();
    await expect(tokenDropdown).toBeVisible({ timeout: 5000 });

    // Click dropdown
    await tokenDropdown.click();
    await page.waitForTimeout(1000);

    // Modal MUST appear
    const modalHeading = page.getByRole("heading", { name: /Select Token/i });
    await expect(modalHeading).toBeVisible({ timeout: 5000 });
    console.log("✓ Token selection modal opens");

    // Close modal
    const closeButton = page.getByRole("button", { name: /Close/i }).or(
      page.locator('[aria-label="Close"]')
    ).first();
    await expect(closeButton).toBeVisible({ timeout: 3000 });
    await closeButton.click();
    await page.waitForTimeout(500);
    console.log("✓ Modal can be closed");
  });

  test("shows insufficient balance warning and preview button with excessive amount", async ({ page }) => {
    // Select send token (BTC)
    const sendTokenDropdown = page.getByRole("button", { name: /Select token/i }).first();
    await expect(sendTokenDropdown).toBeVisible({ timeout: 5000 });
    await sendTokenDropdown.click();
    await page.waitForTimeout(1000);

    // Select BTC from modal
    const btcOption = page.getByText("BTC", { exact: true }).first();
    await expect(btcOption).toBeVisible({ timeout: 5000 });
    await btcOption.click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected BTC send token");

    // Select Bitcoin network
    const bitcoinNetwork = page.getByText("Bitcoin", { exact: true }).first();
    await expect(bitcoinNetwork).toBeVisible({ timeout: 5000 });
    await bitcoinNetwork.click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected Bitcoin network");

    // Fill excessive amount (100 BTC - likely more than treasury balance)
    const amountInput = page.locator('input[type="number"]').first();
    await expect(amountInput).toBeVisible({ timeout: 5000 });
    await amountInput.fill("100");
    await page.waitForTimeout(500);
    console.log("✓ Filled amount: 100 BTC");

    // Scroll up to see the receive token dropdown
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Button should still say "Select Token" since receive token not selected yet
    const selectTokenButton = page.getByRole("button", { name: /Select Token/i }).last();
    await expect(selectTokenButton).toBeVisible({ timeout: 5000 });
    console.log("✓ Button shows 'Select Token' (not 'Preview') before receive token selected");

    // Select receive token (ETH)
    // There are 2 buttons: "Select token " (dropdown in Receive section) and "Select Token" (bottom button)
    // First click the dropdown in the Receive section
    const receiveTokenDropdown = page.getByRole("button", { name: "Select token", exact: false }).first();
    await expect(receiveTokenDropdown).toBeVisible({ timeout: 10000 });
    await receiveTokenDropdown.click();
    await page.waitForTimeout(1500);
    console.log("✓ Clicked receive token dropdown");

    // Wait for token selector modal and select ETH
    await expect(page.getByRole("heading", { name: "Select Token" })).toBeVisible({ timeout: 10000 });
    await page.getByText("ETH", { exact: true }).first().click();
    await page.waitForTimeout(1000);
    console.log("✓ Selected ETH token");

    // Select network for ETH
    await expect(page.getByRole("heading", { name: /Select Network for ETH/i })).toBeVisible({ timeout: 10000 });
    await page.getByText("Arbitrum", { exact: true }).first().click();
    await page.waitForTimeout(2000);
    console.log("✓ Selected Arbitrum network for ETH");

    // Scroll to bottom to see warning and Preview button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Now that both tokens are selected, button MUST change from "Select Token" to "Preview"
    const previewButton = page.getByRole("button", { name: /Preview/i });
    await expect(previewButton).toBeVisible({ timeout: 5000 });
    console.log("✓ Button changed to 'Preview' after both tokens selected");

    // Insufficient balance warning MUST appear
    const insufficientBalanceWarning = page.getByText(/treasury balance is insufficient/i);
    await expect(insufficientBalanceWarning).toBeVisible({ timeout: 10000 });
    console.log("✓ Insufficient balance warning is displayed");

    // Warning should mention "won't be approved until the balance is topped up"
    await expect(page.getByText(/won't be approved until the balance is topped up/i)).toBeVisible();
    console.log("✓ Warning message explains approval restriction");

    // Preview button MUST still be visible (allows creating request even with insufficient balance)
    await expect(previewButton).toBeVisible({ timeout: 5000 });
    console.log("✓ Preview button remains visible despite insufficient balance");
  });
});

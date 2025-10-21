import { test, expect } from '@playwright/test';

/**
 * Test: Open dashboard for a treasury
 *
 * Verifies that users can navigate to a treasury dashboard by:
 * 1. Entering a valid DAO ID on the home page
 * 2. Clicking the "Access Treasury" button
 * 3. Confirming the dashboard loads with expected elements (DAO name, deposit button, NEAR Intents)
 */
test.describe('Open Dashboard for Treasury', () => {
  test('should successfully open dashboard for a valid DAO ID', async ({ page }) => {
    await page.goto("/");
    await page.locator("input#daoId").fill("testing-astradao.sputnik-dao.near");
    await page.getByRole('button', { name: 'Access Treasury' }).click();
    await page.waitForURL("/testing-astradao.sputnik-dao.near/dashboard");
    await expect(page.locator('div').filter({ hasText: /^Sputnik DAO$/ }).nth(0)).toBeVisible({timeout: 10_000});
    await expect(page.getByTestId('deposit-btn')).toBeVisible();
    await expect(page.getByText('NEAR Intents')).toBeVisible();
  });
});

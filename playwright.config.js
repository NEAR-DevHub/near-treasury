import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';

/**
 * Set temp directory to project-local folder for near-sandbox
 * This is only needed when temp folder is on a different filesystem than node_modules.
 * It ensures fs.rename works when moving binaries from temp to node_modules.
 */
const tmpDir = './.tmp';
if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}
process.env.TMPDIR = tmpDir;

/**
 * Playwright configuration for NEAR Treasury E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './playwright-tests/tests',

  // Maximum time one test can run
  timeout: 60 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: 'html',

  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying failed tests
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording: on locally, only on failure in CI
    video: {
      mode: process.env.CI ? 'retain-on-failure' : 'on',
      size: { width: 1280, height: 800 },
    },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Run Next.js dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});


import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';

/**
 * Set temp directory to project-local folder for near-sandbox
 * This is only needed when temp folder is on a different filesystem than node_modules.
 * It ensures fs.rename works when moving binaries from temp to node_modules.
 */
const tmpDir = './.tmp';
if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}
process.env.TMPDIR = tmpDir;

/**
 * Playwright configuration for NEAR Treasury E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Set testDir to project root to allow flexible testMatch patterns across different test locations.
  testDir: './',
  // Define patterns to match test files. This ensures Playwright finds tests in:
  // - The existing 'playwright-tests/tests' directory.
  // - The new 'tests/e2e' directory for exchange request tests and future E2E suites.
  testMatch: [
    'playwright-tests/tests/**/*.spec.js',
    'tests/e2e/**/*.spec.js',
  ],

  // Maximum time one test can run
  timeout: 60 * 1000,

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: 'html',

  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying failed tests
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording: on locally, only on failure in CI
    video: {
      mode: process.env.CI ? 'retain-on-failure' : 'on',
      size: { width: 1280, height: 800 },
    },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Run Next.js dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
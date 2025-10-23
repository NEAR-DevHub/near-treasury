# Playwright Test Suite Setup Plan

## Overview

This document outlines the plan for porting the Playwright test suite from the original NEAR BOS treasury dashboard to the new Next.js React application. We will start with a simple test that opens the dashboard for a treasury and gradually expand the test coverage.

## Background

The project is a conversion of https://github.com/NEAR-DevHub/neardevhub-treasury-dashboard, which was built on NEAR BOS (Blockchain Operating System). The old project has an extensive Playwright test suite located in `neardevhub-treasury-dashboard/playwright-tests/` with tests covering:

- Dashboard functionality
- Stake delegation
- Payments
- Settings
- Lockup contracts
- Intents
- Asset exchange

## Goals

1. Set up Playwright testing infrastructure for the new Next.js app
2. Implement the first simple test: "Open dashboard for a treasury"
3. Learn and establish patterns for future test migrations

## Key Differences Between Old and New Project

| Aspect | Old BOS Project | New Next.js Project |
|--------|----------------|---------------------|
| **URLs** | `/${instanceAccount}/widget/app` | `/[daoId]/dashboard` |
| **Architecture** | BOS widgets with NEAR Social VM | Standard Next.js React app |
| **Entry Point** | Direct widget URL | Home page with DAO selector |
| **Data Fetching** | RPC calls from widgets | API routes + client-side hooks |
| **Test Files Location** | `playwright-tests/` at root | Will create new `playwright-tests/` |

## Implementation Plan

### Phase 1: Setup and Configuration

#### 1.1 Install Playwright
- Add `@playwright/test` as dev dependency
- Install Playwright browsers
- Generate initial configuration

**Commands:**
```bash
npm install -D @playwright/test
npx playwright install
```

#### 1.2 Create Directory Structure
```
playwright-tests/
├── playwright.config.js          # Main Playwright configuration
└── tests/
    └── dashboard/
        └── open-dashboard.spec.js    # First test
```

Additional directories (fixtures, utils, etc.) will be added as needed when patterns emerge.

#### 1.3 Configuration File
Create `playwright.config.js` with:
- Base URL configuration (default: http://localhost:3000)
- Browser configurations (Chromium, Firefox, WebKit)
- Test timeout settings
- Retry logic for flaky tests
- Screenshot/video on failure
- Parallel execution settings

### Phase 2: GitHub Actions CI/CD Setup

#### 2.1 Create GitHub Actions Workflow
Create `.github/workflows/playwright.yml` to run tests automatically on:
- Pull requests to main branch
- Pushes to main branch
- Manual workflow dispatch (for on-demand runs)

#### 2.2 Workflow Configuration
The workflow should:
- Set up Node.js environment
- Install dependencies (including Playwright browsers)
- Build the Next.js application
- Start the Next.js dev server
- Run Playwright tests
- Upload test artifacts (screenshots, videos, trace files) on failure
- Upload HTML test report for review

#### 2.3 Test Environment Services
Configure the workflow to start required services:
- **Next.js server**: Start and wait for it to be ready
- **near-sandbox**: Set up local NEAR testnet
- **Indexer API**: Start test instance with database snapshot (when applicable)
- Configure proper environment variables for test mode

#### 2.4 Optimization Strategies
- Cache Node.js dependencies for faster builds
- Cache Playwright browsers between runs
- Run tests in parallel using sharding for speed
- Set appropriate timeouts for CI environment
- Implement retry logic for flaky tests

#### 2.5 Reporting and Artifacts
- Generate HTML test report
- Upload test artifacts (screenshots, videos, traces) on failure
- Provide clear test result summary in PR comments (optional)
- Store test results for historical tracking

**Example workflow structure:**
```yaml
name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Install dependencies
      - name: Install Playwright browsers
      - name: Build application
      - name: Start services (Next.js, near-sandbox, indexer)
      - name: Run Playwright tests
      - name: Upload artifacts
```

## Acceptance Criteria

- [ ] Playwright is installed and configured
- [ ] Basic test directory structure is created
- [ ] First simple test can run successfully
- [ ] Can run tests in headless and UI mode

## Technical Considerations

### Test Environment Setup
For E2E tests, we'll run the full Next.js development server with supporting services:
- **Next.js server**: Tests will run against the real Next.js server (localhost:3000)
- **Next.js API routes** (`/api/*`) will run normally, no mocking needed
- **NEAR RPC**: Configure app to use near-sandbox RPC endpoint instead of mainnet
- **near-sandbox** provides its own RPC server for blockchain interactions
- **Indexer API**: Run test instance of [sputnik-dao-caching-api-server](https://github.com/near-daos/sputnik-dao-caching-api-server) with test database
- **External APIs** (pricing APIs, etc.) may need mocking

### Test Data Management
- Use consistent test DAO IDs across tests
- Create reusable mock data factories
- Consider test data fixtures for complex scenarios

### Running Against Different Environments

**Read-only/viewing tests** (no transactions):
- Can run against real backends and mainnet
- Tests UI rendering and display logic with real data
- Historical data won't change, providing stable test assertions
- Examples: dashboard display, portfolio views, transaction history

**Transaction/mutation tests** (making changes):
- Must run against near-sandbox for isolation and control
- Examples: creating proposals, staking, payments, settings changes

### CI/CD Integration (Future)
- Run tests on pull requests
- Store test results and artifacts
- Parallel test execution for speed
- Visual regression testing (optional)

## Resources

- [Old test suite](https://github.com/NEAR-DevHub/neardevhub-treasury-dashboard/tree/develop/playwright-tests) - Reference for test patterns and structure
- [Playwright Documentation](https://playwright.dev)
- [Next.js Testing Documentation](https://nextjs.org/docs/testing)

## Key Technology Changes from Old Test Suite

The old test suite uses **near-workspaces** for blockchain interactions. We will replace this with:
- **near-sandbox** - Local NEAR testnet for isolated testing
- **@near-js/jsonrpc-client** - Library for interacting with the sandbox RPC server

This provides more direct control over the test environment and aligns with modern NEAR tooling.

## Testing Approach

- Tests will run against **near-sandbox** - a local testnet that we control
- This approach is consistent with the old project's Playwright test suite
- Provides full control over blockchain state and test data
- Allows testing real blockchain interactions without external dependencies
- **Indexer API**: We can likely set up a test instance with its own database (needs further investigation)

## Test Setup Requirements

1. **Authentication state**: Yes, tests need wallet-connected states (like old test suite) to view the app as users do
2. **Test data setup/teardown**:
   - Initialize near-sandbox before tests (like old test suite)
   - Initialize indexer database with snapshot when needed
3. **Sandbox utilities**: Use **near-sandbox** and **@near-js/jsonrpc-client** instead of near-workspaces
4. **Indexer API setup**:
   - Get build from [sputnik-dao-caching-api-server](https://github.com/near-daos/sputnik-dao-caching-api-server) repository
   - Use database snapshot copy for consistent test data

## Next Steps

1. Review and approve this plan
2. Create GitHub issue from this document
3. Begin Phase 1: Setup and Configuration
4. Write the first simple test
5. Learn and iterate on test patterns as we go

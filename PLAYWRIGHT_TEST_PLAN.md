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

## Acceptance Criteria

- [ ] Playwright is installed and configured
- [ ] Basic test directory structure is created
- [ ] First simple test can run successfully
- [ ] Can run tests in headless and UI mode

## Technical Considerations

### API Mocking Strategy
The old tests used extensive RPC mocking. For the new app:
- Mock Next.js API routes (`/api/*`)
- Mock external APIs (NEAR RPC, pricing APIs, etc.)
- Consider using MSW (Mock Service Worker) for more robust mocking

### Test Data Management
- Use consistent test DAO IDs across tests
- Create reusable mock data factories
- Consider test data fixtures for complex scenarios

### Running Against Different Environments
- Local development (http://localhost:3000)
- Staging environment (if available)
- Testnet vs Mainnet DAO IDs

### CI/CD Integration (Future)
- Run tests on pull requests
- Store test results and artifacts
- Parallel test execution for speed
- Visual regression testing (optional)

## Resources

- [Old test suite](../neardevhub-treasury-dashboard/playwright-tests/)
- [Playwright Documentation](https://playwright.dev)
- [Next.js Testing Documentation](https://nextjs.org/docs/testing)

## Testing Approach

- Tests will run against **near-sandbox** - a local testnet that we control
- This approach is consistent with the old project's Playwright test suite
- Provides full control over blockchain state and test data
- Allows testing real blockchain interactions without external dependencies
- **Indexer API**: We can likely set up a test instance with its own database (needs further investigation)

## Questions to Resolve

1. Do we need authentication state for tests? (wallet connection)
2. How should we handle test data setup and teardown?
3. Should we reuse the old project's sandbox utilities or create new ones?
4. How to set up test instance of indexer API with test database?

## Next Steps

1. Review and approve this plan
2. Create GitHub issue from this document
3. Begin Phase 1: Setup and Configuration
4. Write the first simple test
5. Learn and iterate on test patterns as we go

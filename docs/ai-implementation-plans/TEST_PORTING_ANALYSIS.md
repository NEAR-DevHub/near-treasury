# Test Porting Analysis: Legacy to New Repository

## Executive Summary

This document maps the functionality implemented in the new `near-treasury` repository against the test suite available in the legacy `neardevhub-treasury-dashboard` repository. It identifies which tests can be ported immediately and which require additional implementation work.

**Legend:**
- ✅ **Ready to Port** - Functionality fully implemented, tests can be ported now
- ⚠️ **Partial Implementation** - Core functionality exists but some features may be missing
- ❌ **Not Implemented** - Feature not yet implemented, tests cannot be ported
- 🔄 **Architecture Change** - Feature exists but requires test adaptation due to BOS → Next.js migration

---

## Porting Status (Updated: 2025-10-30)

### Intents Tests: 7/21 Ported (33%)

**Completed** (7 tests covering 13 legacy test scenarios):
1. ✅ `intents-payment-request-ui.spec.js` - 3 payment flows (BTC, USDC, wNEAR)
2. ✅ `intents-deposit-ui.spec.js` - Deposit UI with QR codes
3. ✅ `intents-dashboard.spec.js` - 3 dashboard scenarios (empty, loaded, multi-chain)
4. ✅ `payment-request-detail.spec.js` - 4 detail page tests (ETH, wNEAR, regular, failed)
5. ✅ `token-amount.spec.js` - Component validation
6. ✅ `other-chain-account-input.spec.js` - Address validation
7. ✅ `sandbox/btc-payment-request.spec.js` - Integration test (covers `intents-payment-request.spec.js`)

**Covered by Other Tests** (6 legacy tests):
- `intents-deposit-near.spec.js` → Covered by `intents-deposit-ui.spec.js`
- `intents-deposit-other-chain.spec.js` → Covered by `intents-deposit-ui.spec.js`
- `intents-wnear-withdrawal.spec.js` → Covered by `payment-request-ui.spec.js`
- `qrcode-generator.spec.js` → Covered by `intents-deposit-ui.spec.js`
- `usdc-eth-payment-showcase.spec.js` → Covered by `payment-request-ui.spec.js`
- `intents-payment-request.spec.js` → Covered by `sandbox/btc-payment-request.spec.js`

**Skipped** (1 test):
- `asset-exchange-icons.spec.js` - Non-critical icon rendering

**Blocked** (7 tests):
- Exchange-related tests (5) - Feature not implemented
- BOS-specific tests (2) - Architecture change

**Result**: All critical Intents tests ported. Exchange features not in scope.

---

## Test Coverage Analysis by Feature Area

### 1. Dashboard Tests (5 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/dashboard/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `home-page.spec.js` | ✅ Ready | Dashboard page exists with portfolio display, token sorting, NEAR balances |
| `ft-lockup-portfolio.spec.js` | ✅ Ready | FtLockupPortfolio component implemented |
| `ft-lockup-factory-discovery.spec.js` | ⚠️ Partial | Lockup functionality exists, factory discovery may need verification |
| `intents-historical-graph.spec.js` | ✅ Ready | IntentsPortfolio with historical data implemented |
| `lockup-cliff.spec.js` | ⚠️ Partial | Lockup deserialization exists, cliff visualization needs verification |

**Porting Priority**: HIGH - Core functionality complete

**Implementation Status**:
- ✅ Portfolio component with token balances
- ✅ NEAR balance segregation (available, staked, storage)
- ✅ FT lockup portfolio display
- ✅ Intents portfolio with historical data
- ✅ Transaction history
- ✅ Token price tracking
- ✅ Balance charts and visualization
- ✅ Lockup contract support

**Required Adaptations**:
- URL structure: Legacy uses `/${instanceAccount}/widget/app`, new uses `/[daoId]/dashboard`
- Navigation flow: New repo has home page DAO selector before dashboard
- Data fetching: BOS widgets → Next.js API routes + React Query

---

### 2. Payments Tests (6 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/payments/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `create-payment-request.spec.js` | ✅ Ready | Full payment request form implemented with validation |
| `proposal-details.spec.js` | ✅ Ready | ProposalDetailsPage component exists |
| `vote-on-request.spec.js` | ✅ Ready | VoteActions component with approve/reject |
| `requests-feed.spec.js` | ✅ Ready | Payment proposal table with pagination |
| `filters.spec.js` | ✅ Ready | Advanced filtering implemented |
| `create-bulk-import-request.spec.js` | ✅ Ready | BulkImportForm with CSV/TSV support |

**Porting Priority**: HIGH - Full implementation complete

**Implementation Status**:
- ✅ Single payment creation form
- ✅ Bulk import from CSV/TSV with auto-delimiter detection
- ✅ NEAR and FT token transfers
- ✅ Multi-token support including Intents assets
- ✅ Recipient validation
- ✅ Token storage registration checks
- ✅ Amount validation and formatting
- ✅ Proposal list with search and filters
- ✅ Filter by status, proposers, approvers, recipients, tokens, amounts, dates
- ✅ Proposal details view
- ✅ Vote actions (approve/reject)
- ✅ Export transactions

**Required Adaptations**:
- Role-based access control tests may need adjustment for Next.js auth flow
- SandboxRPC tests need integration with new test infrastructure
- Lockup wallet payment tests require near-sandbox setup

---

### 3. Intents Tests (21 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/intents/`

| Test File | Status | Ported | Testing Approach | Notes |
|-----------|--------|--------|------------------|-------|
| `intents-payment-request-ui.spec.js` | ✅ Ready | ✅ | Integration (Sandbox) | 3 tests: BTC, USDC (BASE), wNEAR payment flows |
| `intents-deposit-ui.spec.js` | ✅ Ready | ✅ | Integration (Sandbox) | Deposit UI with QR codes, address generation |
| `intents-dashboard.spec.js` | ✅ Ready | ✅ | Read-Only (RPC Mock) | 3 tests: empty state, token display, multi-chain aggregation |
| `intents-payment-request.spec.js` | ✅ Ready | ✅ | Integration (Sandbox) | Covered by `sandbox/btc-payment-request.spec.js` |
| `intents-payment-request-detail.spec.js` | ✅ Ready | ✅ | Read-Only (Mainnet) | 4 tests using historical proposals from mainnet |
| `token-amount.spec.js` | ✅ Ready | ✅ | Component Test | Amount formatting and validation |
| `other-chain-account-input.spec.js` | ✅ Ready | ✅ | Component Test | BTC, ETH, SOL address validation |
| `intents-deposit-near.spec.js` | ⚠️ Partial | 🔄 | - | Covered by `intents-deposit-ui.spec.js` |
| `intents-deposit-other-chain.spec.js` | ⚠️ Partial | 🔄 | - | Covered by `intents-deposit-ui.spec.js` |
| `intents-wnear-withdrawal.spec.js` | ⚠️ Partial | 🔄 | - | Covered by `payment-request-ui.spec.js` wNEAR test |
| `asset-exchange-icons.spec.js` | ✅ Ready | ⛔ | - | Skipped - non-critical icon rendering test |
| `qrcode-generator.spec.js` | ⚠️ Partial | 🔄 | - | Covered by `intents-deposit-ui.spec.js` QR tests |
| `usdc-eth-payment-showcase.spec.js` | ⚠️ Partial | 🔄 | - | Covered by `payment-request-ui.spec.js` USDC test |
| `intents-usdc-swap-withdrawal.spec.js` | ❌ Not Implemented | ❌ | - | Swap functionality not in new repo |
| `intents-asset-exchange-detail.spec.js` | ❌ Not Implemented | ❌ | - | Asset exchange page is placeholder |
| `create-1click-exchange-request.spec.js` | ❌ Not Implemented | ❌ | - | One-click exchange not implemented |
| `oneclick-exchange-form.spec.js` | ❌ Not Implemented | ❌ | - | Exchange form not implemented |
| `oneclick-exchange-details.spec.js` | ❌ Not Implemented | ❌ | - | Exchange details not implemented |
| `vote-on-expired-quote.spec.js` | ❌ Not Implemented | ❌ | - | Exchange-related functionality |
| `vote-on-expired-quote-table.spec.js` | ❌ Not Implemented | ❌ | - | Exchange-related functionality |
| `web3-icon-fetcher-bos.spec.js` | 🔄 Architecture Change | ❌ | - | BOS-specific, not applicable to Next.js |

**Legend for Ported Column:**
- ✅ **Ported** - Test successfully ported to new repo
- 🔄 **Covered** - Functionality covered by other ported tests
- ⛔ **Skipped** - Intentionally not ported (non-critical)
- ❌ **Not Ported** - Not yet ported or blocked by missing features

**Porting Priority**: MEDIUM - Core Intents functionality ready, exchange features missing

**Implementation Status**:
- ✅ Intents portfolio display
- ✅ Cross-chain balance tracking
- ✅ Payment requests with Intents tokens
- ✅ Deposit UI with QR codes
- ✅ Multi-chain account input
- ✅ Token amount validation
- ❌ Asset exchange functionality (placeholder page)
- ❌ One-click swap/exchange
- ❌ Exchange quote management

**Required Adaptations**:
- Asset exchange tests require implementation of exchange feature
- Web3 icon fetcher tests need Next.js-specific adaptation
- Full deposit/withdrawal flows need integration testing with near-sandbox

---

### 4. Asset Exchange Tests (4 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/asset-exchange/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `create-exchange-request.spec.js` | ❌ Not Implemented | Asset exchange page is placeholder |
| `create-exchange-request-different-roles.spec.js` | ❌ Not Implemented | Exchange not implemented |
| `vote-on-request.spec.js` | ❌ Not Implemented | Exchange not implemented |
| `proposal-details.spec.js` | ❌ Not Implemented | Exchange not implemented |

**Porting Priority**: LOW - Feature not yet implemented

**Implementation Status**:
- ❌ Asset exchange page exists as placeholder only
- ❌ DEX integration not implemented
- ❌ Token swap functionality not implemented

---

### 5. Settings Tests (8 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/settings/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `preferences.spec.js` | ⚠️ Partial | Preferences page exists, feature scope unclear |
| `create-members-request.spec.js` | ⚠️ Partial | Members component exists, creation flow needs verification |
| `create-threshold-request.spec.js` | ⚠️ Partial | Thresholds component exists, creation flow needs verification |
| `voting-duration.spec.js` | ⚠️ Partial | VotingDurationPage exists, modification flow needs verification |
| `theme.spec.js` | ✅ Ready | Theme component with customization implemented |
| `request-feed.spec.js` | ⚠️ Partial | SettingsFeed component exists |
| `feed-filters.spec.js` | ⚠️ Partial | Filtering may exist in SettingsFeed |
| `proposal-details.spec.js` | ⚠️ Partial | Settings proposal details need verification |

**Porting Priority**: MEDIUM - Components exist but creation/modification flows unclear

**Implementation Status**:
- ✅ Settings page structure with navigation
- ✅ Members view component
- ✅ Thresholds configuration view
- ✅ Voting duration view
- ✅ Theme customization (logo, branding)
- ✅ Preferences page
- ✅ Settings feed for policy changes
- ⚠️ Proposal creation flows for settings changes need verification
- ⚠️ Voting on settings proposals needs verification

**Required Investigation**:
- Verify if settings modification creates proposals or is read-only
- Check if settings changes go through proposal/voting workflow
- Confirm role-based access for settings modifications

---

### 6. Stake Delegation Tests (6 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/stake-delegation/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `stake-delegation.spec.js` | ✅ Ready | Full staking flow implemented |
| `stake-delegation-filters.spec.js` | ✅ Ready | Filtering implemented |
| `stake-delegation-withdraw-request.spec.js` | ✅ Ready | Withdraw component exists |
| `stake-delegation-dont-ask-again.spec.js` | ⚠️ Partial | Depends on notification system |
| `stake-delegation-lockup-staking.spec.js` | ⚠️ Partial | Lockup staking support needs verification |
| `proposal-details.spec.js` | ✅ Ready | Proposal details support staking proposals |

**Porting Priority**: HIGH - Core functionality complete

**Implementation Status**:
- ✅ Create stake request form
- ✅ Create unstake request form
- ✅ Create withdraw request form
- ✅ Validator selection dropdown
- ✅ Staking pool balance tracking
- ✅ Proposal table with filtering
- ✅ Filter by type, validators, amounts, status
- ✅ Multiple validator support
- ✅ Real-time balance updates

**Required Verification**:
- Lockup contract staking flow
- Notification dismissal system
- Full integration with near-sandbox for staking tests

---

### 7. Lockup Tests (3 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/lockup/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `create-lockup.spec.js` | ❌ Not Implemented | Lockup creation not available |
| `vote-on-request.spec.js` | ❌ Not Implemented | Lockup creation not available |
| `proposal-details.spec.js` | ❌ Not Implemented | Lockup creation not available |

**Porting Priority**: LOW - Lockup viewing works, creation not implemented

**Implementation Status**:
- ✅ View lockup contract data
- ✅ Display lockup portfolio
- ✅ Deserialize lockup state
- ✅ Lockup cliff/vesting visualization
- ❌ Create new lockup contracts
- ❌ Lockup proposal creation

---

### 8. Custom Function Call Tests (1 test in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/custom-function-call/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `create-custom-function-call.spec.js` | ✅ Ready | Full implementation exists |

**Porting Priority**: HIGH - Fully implemented

**Implementation Status**:
- ✅ Custom function call request form
- ✅ Contract address input with validation
- ✅ Method name input
- ✅ Arguments input (JSON format)
- ✅ Deposit amount input
- ✅ Gas amount input
- ✅ Multiple actions per proposal
- ✅ Proposal table with filtering
- ✅ Proposal details view

---

### 9. Treasury Factory Tests (4 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/treasury-factory/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `treasury-factory.spec.js` | 🔄 Architecture Change | BOS-specific treasury creation |
| `treasury-factory-web4.spec.js` | 🔄 Architecture Change | BOS/Web4-specific |
| `my-treasuries.spec.js` | ⚠️ Partial | MyTreasuries component exists |
| `page.treasury-factory.near.spec.js` | 🔄 Architecture Change | BOS-specific |

**Porting Priority**: LOW - Architecture significantly different

**Implementation Status**:
- ✅ MyTreasuries component (list accessible DAOs)
- ❌ Treasury creation in new repo (different architecture)
- 🔄 Factory pattern not applicable to Next.js app

**Notes**:
- Legacy uses BOS widget factory for creating treasury instances
- New repo uses standard DAO selection from existing DAOs
- Treasury creation would be external to the app (via DAO factory contracts)

---

### 10. System Updates Tests (8 tests in legacy)

**Legacy Tests Location**: `/playground-tests/tests/system-updates/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `update-policy.spec.js` | 🔄 Architecture Change | BOS widget updates not applicable |
| `update-widgets.spec.js` | 🔄 Architecture Change | No widgets in Next.js |
| `update-sputnikdao-contract.spec.js` | 🔄 Architecture Change | External contract upgrade |
| `update-web4-contract-mainnet.spec.js` | 🔄 Architecture Change | No Web4 in new architecture |
| `update-infinex-sputnikdao.spec.js` | 🔄 Architecture Change | External contract upgrade |
| `update-specfied-instances.spec.js` | 🔄 Architecture Change | BOS-specific |
| `upgrade-instance.spec.js` | 🔄 Architecture Change | BOS-specific |
| `update-history.spec.js` | ⚠️ Partial | Could view contract upgrade history |

**Porting Priority**: NONE - Not applicable to new architecture

**Notes**:
- Legacy tests are specific to BOS widget deployment and updates
- New repo is a standard Next.js app with different deployment model
- Contract upgrades happen externally, not through the app

---

### 11. Web4 Tests (3 tests in legacy)

**Legacy Tests Location**: `/playwright-tests/tests/web4/`

| Test File | Status | Notes |
|-----------|--------|-------|
| `web4.spec.js` | 🔄 Architecture Change | BOS/Web4-specific gateway |
| `serviceworker.spec.js` | ⚠️ Partial | Could add PWA functionality |
| `service-worker-interference.spec.js` | ⚠️ Partial | If PWA added |

**Porting Priority**: NONE - Different architecture

**Notes**:
- Web4 is BOS-specific gateway technology
- New repo uses standard Next.js architecture
- Service worker tests could be relevant if PWA features added

---

## Test Porting Priority Matrix

### IMMEDIATE PRIORITY (Can Port Now)

**Total: 24 tests ready to port**

1. **Dashboard** (3 tests ready)
   - `home-page.spec.js` ✅
   - `ft-lockup-portfolio.spec.js` ✅
   - `intents-historical-graph.spec.js` ✅

2. **Payments** (6 tests ready)
   - `create-payment-request.spec.js` ✅
   - `proposal-details.spec.js` ✅
   - `vote-on-request.spec.js` ✅
   - `requests-feed.spec.js` ✅
   - `filters.spec.js` ✅
   - `create-bulk-import-request.spec.js` ✅

3. **Intents** (8 tests ready)
   - `intents-payment-request-ui.spec.js` ✅
   - `intents-deposit-ui.spec.js` ✅
   - `intents-dashboard.spec.js` ✅
   - `intents-payment-request.spec.js` ✅
   - `intents-payment-request-detail.spec.js` ✅
   - `asset-exchange-icons.spec.js` ✅
   - `token-amount.spec.js` ✅
   - `other-chain-account-input.spec.js` ✅

4. **Stake Delegation** (4 tests ready)
   - `stake-delegation.spec.js` ✅
   - `stake-delegation-filters.spec.js` ✅
   - `stake-delegation-withdraw-request.spec.js` ✅
   - `proposal-details.spec.js` ✅

5. **Custom Function Call** (1 test ready)
   - `create-custom-function-call.spec.js` ✅

6. **Settings** (1 test ready)
   - `theme.spec.js` ✅

7. **Existing Test** (1 already ported)
   - Dashboard open test (already exists in new repo)

---

### MEDIUM PRIORITY (Need Verification/Minor Work)

**Total: 16 tests requiring investigation**

1. **Dashboard** (2 tests)
   - `ft-lockup-factory-discovery.spec.js` ⚠️
   - `lockup-cliff.spec.js` ⚠️

2. **Intents** (4 tests)
   - `intents-deposit-near.spec.js` ⚠️
   - `intents-deposit-other-chain.spec.js` ⚠️
   - `intents-wnear-withdrawal.spec.js` ⚠️
   - `qrcode-generator.spec.js` ⚠️

3. **Settings** (7 tests)
   - `preferences.spec.js` ⚠️
   - `create-members-request.spec.js` ⚠️
   - `create-threshold-request.spec.js` ⚠️
   - `voting-duration.spec.js` ⚠️
   - `request-feed.spec.js` ⚠️
   - `feed-filters.spec.js` ⚠️
   - `proposal-details.spec.js` ⚠️

4. **Stake Delegation** (2 tests)
   - `stake-delegation-dont-ask-again.spec.js` ⚠️
   - `stake-delegation-lockup-staking.spec.js` ⚠️

5. **Treasury Factory** (1 test)
   - `my-treasuries.spec.js` ⚠️

---

### LOW PRIORITY (Blocked by Missing Features)

**Total: 14 tests blocked**

1. **Asset Exchange** (4 tests) - Exchange feature not implemented
2. **Intents Exchange** (5 tests) - Exchange-related Intents features
3. **Lockup Creation** (3 tests) - Lockup creation not implemented
4. **System Updates** (1 test) - Update history viewing
5. **Web4/Service Workers** (1 test) - PWA features

---

### NOT APPLICABLE (Architecture Changes)

**Total: 15 tests not applicable**

1. **Treasury Factory** (3 tests) - BOS-specific
2. **System Updates** (7 tests) - BOS widget updates
3. **Web4** (3 tests) - BOS/Web4 gateway
4. **Intents** (1 test) - BOS-specific icon fetcher
5. **Treasury Factory** (1 test) - My treasuries (architecture changed)

---

## Recommended Porting Order

### Phase 1: Core Functionality (Week 1-2)
**Focus**: Essential user workflows that are fully implemented

1. **Dashboard Tests** (3 tests)
   - Portfolio display
   - Balance tracking
   - Historical data

2. **Payment Tests** (6 tests)
   - Payment creation
   - Bulk import
   - Voting
   - Filtering

3. **Stake Delegation** (4 tests)
   - Staking flow
   - Unstaking/withdrawal
   - Filtering

**Total**: 13 tests

---

### Phase 2: Advanced Features (Week 3)
**Focus**: Multi-chain and advanced functionality

4. **Intents Tests** (8 tests)
   - Cross-chain payments
   - Deposit UI
   - Multi-chain account validation

5. **Custom Function Calls** (1 test)
   - Advanced contract interaction

**Total**: 9 tests

---

### Phase 3: Settings & Configuration (Week 4)
**Focus**: DAO configuration and management

6. **Settings Tests** (1 confirmed + investigate 7)
   - Theme customization (confirmed)
   - Member management (verify)
   - Policy configuration (verify)

**Total**: 1-8 tests (depending on investigation results)

---

### Phase 4: Edge Cases & Polish (Week 5)
**Focus**: Verification tests and edge cases

7. **Dashboard Edge Cases** (2 tests)
   - Lockup factory discovery
   - Lockup cliff visualization

8. **Intents Edge Cases** (4 tests)
   - Full deposit flows
   - Withdrawal flows
   - QR code generation

9. **Stake Delegation Edge Cases** (2 tests)
   - Notification system
   - Lockup staking

**Total**: 8 tests

---

## Ported Test Examples by Testing Approach

During porting, we established four testing approaches. Refer to `playwright-tests/README.md` for details on when to use each approach. These are the ported examples:

### 1. Integration Tests with Sandbox
- `tests/intents/payment-request-ui.spec.js` - BTC, USDC, wNEAR payment creation
- `tests/intents/intents-deposit-ui.spec.js` - Deposit flows with QR codes
- `tests/sandbox/btc-payment-request.spec.js` - Pure contract testing

### 2. Read-Only Tests with Mainnet Data
- `tests/intents/payment-request-detail.spec.js` - Historical proposals from mainnet

### 3. Read-Only Tests with RPC Mocking
- `tests/intents/intents-dashboard.spec.js` - Portfolio display with mocked balances

### 4. Component Tests
- `tests/components/token-amount.spec.js` - Amount formatting and validation
- `tests/components/other-chain-account-input.spec.js` - BTC/ETH/SOL address validation

---

## Critical Technical Differences: Legacy BOS vs New Next.js

### 1. URL Structure Changes

**Legacy BOS**:
```javascript
`/${instanceAccount}/widget/app?page=payments&tab=history&id=2`
`/${instanceAccount}/widget/app?page=dashboard`
```

**New Next.js**:
```javascript
`/${daoId}/payments?tab=history&id=2`
`/${daoId}/dashboard`
```

**Migration Pattern**:
- Remove `/widget/app` from all URLs
- `page=` query param → route segment
- Keep other query params (tab, id, etc.)

---

### 2. DOM Selectors Are Completely Different

**⚠️ CRITICAL**: Even though the UI looks identical, the DOM structure is completely different.

**Legacy BOS** (rendered inside widget iframe):
```javascript
// BOS widgets use data attributes
page.locator('[data-component="ProposalCard"]')
page.locator('[data-testid="payment-amount"]')

// Nested in widget container
page.frameLocator('iframe[name="bos-component"]')
```

**New Next.js** (standard React/Next.js):
```javascript
// Use semantic selectors
page.getByRole('button', { name: 'Approve' })
page.getByText('Payment Request Funded')
page.locator('tbody tr').filter({ hasText: 'bc1qxy...' })

// Standard DOM, no iframes
// Use Playwright's built-in locators
```

**Migration Strategy**:
1. ❌ **DON'T** copy selectors from legacy tests
2. ✅ **DO** inspect the new app's DOM and write new selectors
3. ✅ **Prefer**: `getByRole()`, `getByText()`, `getByLabel()`
4. ✅ **Fallback**: `locator()` with specific CSS selectors
5. ✅ **Use**: `.first()` for duplicate elements (sidebar + table)

---

### 3. Transaction Confirmation Flow

**Legacy BOS**:
```javascript
// BOS shows modal for EVERY transaction
await page.click('button:has-text("Submit")');
await page.click('button:has-text("Confirm")'); // Modal
await page.waitForTimeout(3000);
```

**New Next.js**:
```javascript
// NO confirmation modal - wallet handles it directly
await page.getByRole('button', { name: 'Submit' }).click();
// Transaction signed immediately in injected test wallet
await page.waitForTimeout(3000); // Just wait for blockchain
```

**⚠️ CRITICAL DIFFERENCE**:
- Legacy had 2-step process (Submit → Confirm in modal)
- New has 1-step process (Submit → wallet signs automatically)
- **Don't look for confirmation modal** - it doesn't exist
- Tests with `page.click('button:has-text("Confirm")')` will fail

---

### 4. Authentication & Login State

**Legacy BOS**:
```javascript
// BOS stored wallet state in specific localStorage keys
await page.evaluate(() => {
  localStorage.setItem('near-wallet-selector:selectedWalletId', 'my-near-wallet');
  localStorage.setItem('near-wallet-selector:recentlySignedInWallets', '...');
});
```

**New Next.js**:
```javascript
// Different localStorage keys and structure
await page.evaluate(() => {
  localStorage.setItem('selected-wallet', 'test-wallet');
  // Simpler structure in new app
});

// For sandbox tests: use injectTestWallet helper
await injectTestWallet(page, sandbox, accountId);
```

**Storage State Variables**:

| Purpose | Legacy BOS | New Next.js |
|---------|-----------|-------------|
| Selected wallet | `near-wallet-selector:selectedWalletId` | `selected-wallet` |
| Account ID | In wallet selector state | Managed by test wallet injection |
| Network | Part of wallet config | Handled by RPC routing |

**Migration Pattern**:
```javascript
// OLD (Legacy)
await page.evaluate(() => {
  localStorage.setItem('near-wallet-selector:selectedWalletId', 'my-near-wallet');
  const accounts = [{ accountId: 'test.near', publicKey: '...' }];
  localStorage.setItem('near-wallet-selector:contract', JSON.stringify({
    accounts,
    selectedAccount: accounts[0]
  }));
});

// NEW (Next.js)
// For mainnet/mocked tests (no blockchain interaction)
await page.evaluate(() => {
  localStorage.setItem('selected-wallet', 'test-wallet');
});
await page.reload();

// For sandbox tests (with blockchain interaction)
await injectTestWallet(page, sandbox, 'testcreator.near');
// This injects full wallet implementation
```

---

### 5. Wallet Injection for Sandbox Tests

**Legacy BOS**:
```javascript
// BOS had complex wallet selector integration
// Required mocking entire NEAR wallet selector
```

**New Next.js**:
```javascript
// We have a helper function that does everything
import { injectTestWallet } from '../../util/sandbox.js';

await injectTestWallet(page, sandbox, accountId);

// This injects a test wallet that:
// 1. Signs transactions using sandbox keypairs
// 2. Routes RPC calls to sandbox
// 3. Handles account info queries
// 4. No confirmation modals needed
```

**⚠️ Key Difference**: The test wallet is injected into `window.__testWallet`, not through the NEAR wallet selector.

---

### 6. RPC Call Routing

**Legacy BOS**:
```javascript
// BOS made RPC calls internally
// Had to intercept at widget level
```

**New Next.js**:
```javascript
// Intercept at network level
await page.route('**/rpc.mainnet.fastnear.com/**', async (route) => {
  const postData = route.request().postDataJSON();

  // For sandbox tests: redirect to sandbox
  const response = await route.fetch({
    url: sandbox.getRpcUrl(),
    method: 'POST',
    postData: JSON.stringify(postData),
  });

  // For mocked tests: return mock data
  if (postData.params?.method_name === 'mt_tokens_for_owner') {
    const result = Array.from(
      new TextEncoder().encode(JSON.stringify(mockData))
    );
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ result: { result } }),
    });
  }
});
```

**Critical Detail**: Use `TextEncoder`, not `Buffer.from().toString('base64')`

---

### 7. Page Load & Hydration

**Legacy BOS**:
```javascript
// Wait for BOS widget to load
await page.waitForSelector('[data-component="App"]');
await page.waitForTimeout(2000); // Widget render time
```

**New Next.js**:
```javascript
// Wait for Next.js hydration
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForLoadState('networkidle');

// For dynamic content, wait for indicators
await expect(page.getByText('Payment Request Funded')).toBeVisible({ timeout: 15000 });
```

**Key Differences**:
- Next.js pages hydrate faster than BOS widgets
- Use `waitUntil: 'networkidle'` consistently
- Wait for actual content, not arbitrary timeouts
- Longer timeouts (15s) for mainnet data fetching

---

### 8. Indexer API Calls

**Legacy BOS**:
```javascript
// BOS called indexer directly from widget
```

**New Next.js**:
```javascript
// Intercept indexer API calls
await page.route('**/sputnik-indexer.fly.dev/**', async (route) => {
  const url = route.request().url();

  if (url.includes('/proposals/')) {
    // For sandbox: return sandbox proposal data
    await route.fulfill({
      status: 200,
      body: JSON.stringify([/* sandbox proposals */]),
    });
  } else {
    await route.continue();
  }
});
```

**Helper Function Available**:
```javascript
import { interceptIndexerAPI } from '../../util/sandbox.js';
await interceptIndexerAPI(page, sandbox);
```

---

### 9. Form Interactions

**Legacy BOS**:
```javascript
// BOS had custom form components
await page.fill('input[data-field="amount"]', '100');
await page.click('button[data-action="submit"]');
```

**New Next.js**:
```javascript
// Use semantic selectors
await page.getByRole('spinbutton', { name: 'Amount' }).fill('100');
await page.getByRole('button', { name: 'Submit' }).click();

// Or accessible labels
await page.getByLabel('Amount').fill('100');
```

**Migration Tips**:
- Inspect the actual HTML in new app
- Use browser DevTools → Accessibility tab
- Prefer `getByRole()` for better semantics
- Test accessibility as you go

---

### 10. Navigation Flow

**Legacy BOS**:
```javascript
// BOS used query params for navigation
await page.goto(`/${daoId}/widget/app?page=payments`);
await page.click('a[href*="page=dashboard"]');
```

**New Next.js**:
```javascript
// Next.js uses proper routing
await page.goto(`/${daoId}/payments`);
await page.getByRole('link', { name: 'Dashboard' }).click();
await expect(page).toHaveURL(`/${daoId}/dashboard`);
```

**Navigation Patterns**:
- Home → DAO selector → Dashboard/Payments/etc.
- Use `page.getByRole('link')` for navigation
- Verify URL changes with `expect(page).toHaveURL()`

---

### 11. Proposal State Display

**Legacy BOS**:
```javascript
// Different status badge styling
await page.waitForSelector('.badge-success');
```

**New Next.js**:
```javascript
// Use text content, not CSS classes
await expect(page.getByText('Payment Request Funded')).toBeVisible();
await expect(page.getByText('Payment Request Failed')).toBeVisible();
await expect(page.getByText('Rejected 0')).toBeVisible();
```

**Why**: CSS classes may change, text content is stable.

---

### 12. Multi-Chain Account Display

**Legacy BOS**:
```javascript
// BOS showed addresses in specific format
```

**New Next.js**:
```javascript
// Check actual rendered text
await expect(page.getByText('0xa029Ca6D14b97749889702eE16E7d168a1094aFE')).toBeVisible();
await expect(page.getByText('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')).toBeVisible();

// Addresses shown in full, may have copy button
await page.getByRole('button', { name: 'Copy Address' }).click();
```

---

### 13. Error Handling & Validation

**Legacy BOS**:
```javascript
// BOS showed errors in specific containers
await page.waitForSelector('.error-message');
```

**New Next.js**:
```javascript
// Look for actual error text
await expect(page.getByText('Invalid Bitcoin address')).toBeVisible();
await expect(page.getByText('Insufficient balance')).toBeVisible();

// Or use ARIA live regions
await expect(page.getByRole('alert')).toContainText('Error');
```

---

### 14. Test Data & Constants

**Legacy BOS**:
```javascript
const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "100000000000000000000000"; // 0.1 NEAR
```

**New Next.js** (Same constants, different imports):
```javascript
// Import from util/sandbox.js or define in test
import { parseNEAR } from "../../util/sandbox.js";
const SPUTNIK_DAO_FACTORY_ID = "sputnik-dao.near";
const PROPOSAL_BOND = "0"; // Can be 0 in sandbox
```

---

## Quick Migration Checklist

When porting a legacy test, update:

- [ ] ✅ URL structure (remove `/widget/app`, move `page=` to route)
- [ ] ✅ All selectors (inspect new DOM, write new selectors)
- [ ] ✅ Remove transaction confirmation modal clicks
- [ ] ✅ Update localStorage keys for wallet state
- [ ] ✅ Use `injectTestWallet()` for sandbox tests
- [ ] ✅ Update RPC mocking (use TextEncoder)
- [ ] ✅ Use `waitUntil: 'networkidle'` for page loads
- [ ] ✅ Update indexer API interception if needed
- [ ] ✅ Use semantic selectors (`getByRole`, `getByText`)
- [ ] ✅ Remove BOS-specific waits and delays
- [ ] ✅ Test cross-browser (Firefox timing issues)
- [ ] ✅ Add TODO comments for missing features

---

## Common Pitfalls to Avoid

1. **❌ Copying selectors from legacy tests** → Will fail, DOM is different
2. **❌ Looking for confirmation modal** → Doesn't exist in new app
3. **❌ Using base64 for RPC mocks** → Use TextEncoder
4. **❌ Old localStorage keys** → Update to new keys
5. **❌ Not using `.first()` for duplicates** → Strict mode errors
6. **❌ Short timeouts for mainnet data** → Use 15s timeouts
7. **❌ Conditional logic in assertions** → Use hard expectations
8. **❌ Not waiting for `networkidle`** → Race conditions

---

## Test Infrastructure Adaptations Required

---

## Existing Test Infrastructure in New Repo

**Already Implemented** (from your Phase 1 setup):
- ✅ Playwright installed and configured
- ✅ GitHub Actions CI/CD workflow
- ✅ near-sandbox integration
- ✅ Basic test structure
- ✅ Dashboard open test working
- ✅ Complete Intents deposit UI test
- ✅ Complete payment request UI test
- ✅ Complete BTC payment with sandbox test

**Test Utilities Available**:
- QR code testing (jsQR, Jimp)
- Near sandbox setup
- Account/DAO creation
- Test wallet injection
- Indexer API mocking

---

## Summary Statistics

| Category | Ready to Port | Need Verification | Blocked | Not Applicable | Total |
|----------|--------------|-------------------|---------|----------------|-------|
| Dashboard | 3 | 2 | 0 | 0 | 5 |
| Payments | 6 | 0 | 0 | 0 | 6 |
| Intents | 8 | 4 | 5 | 1 | 18 |
| Asset Exchange | 0 | 0 | 4 | 0 | 4 |
| Settings | 1 | 7 | 0 | 0 | 8 |
| Stake Delegation | 4 | 2 | 0 | 0 | 6 |
| Lockup | 0 | 0 | 3 | 0 | 3 |
| Custom Function | 1 | 0 | 0 | 0 | 1 |
| Treasury Factory | 0 | 1 | 0 | 3 | 4 |
| System Updates | 0 | 1 | 0 | 7 | 8 |
| Web4 | 0 | 0 | 0 | 3 | 3 |
| **TOTAL** | **23** | **17** | **12** | **14** | **66** |

**Note**: This excludes the 3 tests already ported in the new repo.

---

## Key Recommendations

1. **Start with Phase 1** (13 ready tests) - These are confirmed working and essential
2. **Investigate Settings** - Components exist but workflow unclear, could add 7 more tests
3. **Defer Exchange Tests** - Wait for asset exchange feature implementation
4. **Skip Architecture-Specific Tests** - 14 tests don't apply to Next.js architecture
5. **Adapt, Don't Copy** - Tests need significant adaptation for new architecture
6. **Maintain Test Quality** - Use near-sandbox for integration tests, not just UI tests

---

## Next Steps

1. ✅ Review this analysis
2. ⏭️ Prioritize Phase 1 tests for immediate porting
3. ⏭️ Investigate Settings functionality to clarify test porting feasibility
4. ⏭️ Set up test porting workflow and conventions
5. ⏭️ Begin porting tests one feature area at a time
6. ⏭️ Document patterns and learnings as you go

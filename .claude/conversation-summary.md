# Near Sandbox Setup - Conversation Summary

**Date:** October 25, 2025
**Branch:** `feat/near-sandbox-setup`
**Issue:** Closes #12 - Setup near-sandbox for blockchain testing

## What We Accomplished

### 1. Fixed near-sandbox Configuration Issues

**Problem:** near-sandbox was failing to start due to:
- `fs.rename` errors when moving sandbox binary from /tmp to node_modules (different filesystems)
- Genesis configuration with mismatched total supply
- Hardcoded RPC port preventing parallel test execution

**Solutions Implemented:**

1. **TMPDIR Configuration** (`playwright.config.js:7`)
   - Set `process.env.TMPDIR = './.tmp'` to ensure sandbox binary and node_modules are on same filesystem
   - Added `.tmp` to `.gitignore`

2. **Genesis Configuration** (`playwright-tests/util/sandbox.js:22-87`)
   - Fixed total supply mismatch error
   - Set correct account balances:
     - `test.near`: 1,000,000 NEAR (amount) + 50 NEAR (locked)
     - `near`: 1,000,000 NEAR
     - `sandbox`: 10 NEAR
   - Total supply now correctly equals 2,050,010 NEAR

3. **Removed Hardcoded RPC Port**
   - Allows near-sandbox to auto-assign ports for parallel test execution

### 2. Created NearSandbox Wrapper Class

**File:** `playwright-tests/util/sandbox.js`

**Core Methods:**
- `start(config)` - Initialize sandbox with genesis configuration
- `stop()` - Teardown sandbox
- `createAccount(accountId, initialBalance)` - Create new accounts with keypairs
- `deployContract(accountId, wasmCode)` - Deploy contracts to accounts
- `functionCall(signerId, receiverId, methodName, args, gas, deposit)` - Execute contract methods
- `viewFunction(contractId, methodName, args)` - Read-only contract calls
- `viewFunctionMainnet(contractId, methodName, args)` - Query mainnet contracts
- `importMainnetContract(accountId, mainnetContractId)` - Import and deploy mainnet contracts to sandbox
- `getLatestBlockHash()` - Get current block hash
- `getAccessKeyNonce(accountId, publicKey)` - Get nonce for transaction signing

**Helper:**
- `parseNEAR(amount)` - Convert NEAR amounts to yoctoNEAR

### 3. Created Basic Tests

**File:** `playwright-tests/tests/sandbox/payment-request-flow.spec.js`

**Test Results:** ✅ All 4 tests passing (35.3s)
- ✓ should create test accounts
- ✓ should deploy and call a simple contract
- ✓ should create DAO account and add payment request proposal
- ✓ should support view function calls

### 4. Updated DevContainer Configuration

**File:** `.devcontainer/devcontainer.json`

**Added Features:**
- `ghcr.io/devcontainers/features/git-lfs:1` - Git LFS support
- `ghcr.io/devcontainers/features/github-cli:1` - GitHub CLI

### 5. Updated Dependencies

**File:** `package.json`

**Added:**
- `near-sandbox`: ^2.8.0
- `near-api-js`: ^5.0.1
- `@near-js/jsonrpc-client`: ^1.5.1

## Files Changed

```
.devcontainer/devcontainer.json     - Added git-lfs and github-cli features
.gitignore                           - Added .tmp directory
playwright.config.js                 - Set TMPDIR environment variable
package.json                         - Added near-sandbox dependencies
package-lock.json                    - Lockfile updates
playwright-tests/util/sandbox.js     - NEW: NearSandbox wrapper class
playwright-tests/tests/sandbox/      - NEW: Sandbox tests directory
  payment-request-flow.spec.js       - NEW: Basic sandbox tests
```

## Current State

**Branch Status:**
- Branch `feat/near-sandbox-setup` created and pushed to origin
- All changes committed in single commit: `3d37427`
- Ready for draft PR creation

**Next Steps:**

1. **Rebuild DevContainer**
   - The new features (git-lfs, github-cli) will be available after rebuild

2. **Create Draft PR**
   - URL: https://github.com/NEAR-DevHub/near-treasury/pull/new/feat/near-sandbox-setup
   - Title: `feat: Setup near-sandbox for blockchain testing`
   - Mark as draft
   - Should close issue #12

3. **Port Full Payment Request Test**
   - Source: `neardevhub-treasury-dashboard/playwright-tests/tests/intents/intents-payment-request.spec.js`
   - This test demonstrates full DAO + payment request flow with BTC transfers
   - Uses `near-workspaces` (we need to convert to our `NearSandbox` wrapper)

4. **Key Operations Needed for Payment Request Test:**
   - Import omft.near contract
   - Initialize omft with admin roles
   - Deploy BTC token
   - Import intents.near contract
   - Import SputnikDAO factory
   - Create DAO with policies
   - Add payment request proposal
   - Vote and execute proposal
   - Verify token balances

## Important Notes

### Debugging
- Set `process.env.NEAR_ENABLE_SANDBOX_LOG = "1"` to enable sandbox logging
- Sandbox logs show genesis validation and RPC startup

### Reference Code
- Working example: https://raw.githubusercontent.com/petersalomonsen/quickjs-rust-near/9177eb2c344544a81dad3cff69b01b39b5d67dc3/examples/aiproxy/playwright-tests/near_rpc.js
- Shows how to use near-sandbox with proper genesis configuration

## Commands to Resume

```bash
# After rebuilding devcontainer
git checkout feat/near-sandbox-setup

# Run tests to verify everything works
npx playwright test payment-request-flow.spec.js --project=chromium

# Create draft PR (after devcontainer rebuild with gh cli)
gh pr create --draft \
  --title "feat: Setup near-sandbox for blockchain testing" \
  --body "See .claude/conversation-summary.md for details. Closes #12"
```

## PR Description Template

```markdown
## Summary
This PR sets up near-sandbox infrastructure for blockchain testing, enabling us to test payment request flows without requiring a live network.

## Changes
- ✅ Configure TMPDIR to `./.tmp` for near-sandbox fs.rename compatibility
- ✅ Remove hardcoded RPC port to support parallel test execution
- ✅ Fix genesis configuration with correct total supply balances
- ✅ Add NearSandbox wrapper class with core operations:
  - Account creation and management
  - Contract deployment and imports from mainnet
  - Function calls (state-changing and view)
  - Mainnet contract viewing
- ✅ Create basic sandbox tests to verify functionality
- ✅ Add git-lfs and github-cli devcontainer features
- ✅ Add `.tmp` to .gitignore

## Test Results
All sandbox tests passing ✅

\`\`\`
4 passed (35.3s)
✓ should create test accounts
✓ should deploy and call a simple contract
✓ should create DAO account and add payment request proposal
✓ should support view function calls
\`\`\`

## Next Steps
- Port full payment request test from legacy project
- Add DAO factory and proposal tests
- Test intents wallet integration

Closes #12
```

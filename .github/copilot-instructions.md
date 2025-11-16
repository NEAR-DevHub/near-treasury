# NEAR Treasury - AI Coding Agent Instructions

## Project Overview

NEAR Treasury is a Next.js 15 (App Router) application for managing NEAR Protocol SputnikDAO treasuries. Converted from a NEAR BOS (Blockchain Operating System) widget-based architecture to unlock full web capabilities.

**Key Technologies**: Next.js 15, React 19, NEAR Protocol, React Query, Bootstrap 5, Playwright with near-sandbox

## Architecture Patterns

### Dynamic Route Structure

All DAO-specific pages use Next.js dynamic routing under `src/app/[daoId]/`:

- `/[daoId]/dashboard` - Portfolio view
- `/[daoId]/payments` - Payment proposals
- `/[daoId]/asset-exchange` - Cross-chain exchanges via NEAR Intents
- `/[daoId]/stake-delegation` - Validator staking
- `/[daoId]/settings` - DAO configuration

**Critical**: All components in `[daoId]` routes must use `"use client"` directive (Next.js client components).

### Context Architecture

Three core React contexts provide global state (see `src/context/`):

1. **DaoContext** (`useDaoContext()`) - DAO metadata, balances (NEAR, FT, staked, Intents), policy, lockup contracts
   - Auto-fetches when `daoId` changes from URL params
   - Provides `refreshDaoBalances()`, `hasPermission()`, `getApproversAndThreshold()`

2. **NearWalletContext** (`useNearWallet()`) - Wallet connection via `@hot-labs/near-connect`
   - Provides `accountId`, `connect()`, `disconnect()`, `signAndSendTransactions()`
   - Supports WalletConnect, browser wallets

3. **ProposalToastContext** - Transaction success/failure notifications
   - Use `showToast(status, proposalId, context)` after proposal actions

### Data Fetching Pattern

**React Query for proposals** (`src/hooks/useProposals.js`, `useProposal.js`):

```javascript
const { proposals, total, isLoading, refetch } = useProposals({
  category: "payments",
  statuses: ["InProgress", "Approved"],
  page: 0,
  pageSize: 10,
  filters: {
    /* ... */
  },
});
```

**API Layers** (`src/api/`):

- `indexer.js` - SputnikDAO Caching API (proposal queries, filters)
- `rpc.js` - Direct NEAR RPC (balances, NEAR Intents tokens)
- `near.js` - Contract view calls via `Near.view(contractId, method, args)`
- `backend.js` - Defuse API (token metadata, blockchain info)

### Transaction Flow

1. User submits form → Validate with `react-hook-form`
2. Call `useNearWallet().signAndSendTransactions()` with NEAR transaction params
3. Redirect back with `?transactionHashes=...` in URL
4. `useTransactionHandler()` hook intercepts, fetches result, shows toast

**Key files**: `src/hooks/useTransactionHandler.js`, `src/context/ProposalToastContext.jsx`

### NEAR Intents Integration

Multi-chain asset support (Bitcoin, Ethereum, Solana, etc.) via `intents.near` contract:

- Tokens use `nep141:` or `nep245:` prefixes (e.g., `nep141:btc.omft.near`)
- Fetch balances: `getIntentsBalances(daoId)` in `src/api/rpc.js`
- Display: `IntentsPortfolio.jsx`, token metadata from Defuse API

### DAO Configuration

Per-DAO feature flags in `src/config/daoConfig.json`:

```json
{
  "daos": {
    "treasury-devdao.sputnik-dao.near": {
      "showKYC": true,
      "showFunctionCall": true
    }
  }
}
```

Access via `customConfig` from `useDaoContext()`.

### LocalStorage Conventions

Use constants from `src/constants/localStorage.js`:

- `LOCAL_STORAGE_KEYS.THEME` - User theme (light/dark)
- `LOCAL_STORAGE_KEYS.USER_TIMEZONE_PREFERENCES` - Timezone/format settings
- `LOCAL_STORAGE_KEYS.COLUMNS_VISIBILITY` - Table column visibility per page

**Pattern**: Store with `JSON.stringify()`, parse on load, validate structure.

## Development Workflow

### Running the App

```bash
npm run dev          # Start Next.js dev server (http://localhost:3000)
npm run build        # Production build with Turbopack
npm run format       # Prettier formatting
```

### Testing

**End-to-End Tests** (Playwright + near-sandbox):

```bash
npm run test:e2e              # Run all tests
npm run test:e2e:ui           # Interactive UI mode (use DevContainer remote desktop)
npm run test:e2e:headed       # See browser
npm run test:video-merge      # Merge test recordings into demo video
```

**Test Categories** (see `playwright-tests/README.md`):

1. **Integration tests** (`*-ui.spec.js`) - Use near-sandbox for full blockchain state
2. **Read-only with mainnet** (`*-detail.spec.js`) - Historical data, no mocking
3. **Read-only with RPC mocking** (`*-dashboard.spec.js`) - Controlled test data via `mock-intents-rpc.js`
4. **Component tests** (`tests/components/`) - Isolated UI logic

**Writing Tests**: Always use `NearSandbox` class from `playwright-tests/util/sandbox.js` for blockchain interactions. Setup takes 2-5 minutes, so use `test.beforeAll()`.

### DevContainer Features

Project includes VS Code DevContainer with:

- **noVNC remote desktop** - Access via Ports panel (port 6080) for `test:e2e:ui`
- Pre-configured NEAR development tools, Git, GitHub CLI
- `ffmpeg` for test video merging

## Critical Patterns & Conventions

### Form State Management

Use `react-hook-form` with `reset()` for initial state (NOT `setValue()`):

```javascript
const {
  reset,
  formState: { isDirty },
} = useForm();

useEffect(() => {
  const loadedData = {
    /* from localStorage/API */
  };
  reset(loadedData); // Establishes baseline for isDirty tracking
}, []);
```

**Bug discovered in Preferences.jsx**: Using `setValue()` breaks `isDirty` flag.

### DAO ID Validation

Always validate DAO IDs from URL params (see `src/helpers/daoValidation.js`):

- Redirects to `/?error=invalid-dao` if not a valid SputnikDAO contract

### Proposal Description Encoding

Use markdown format for structured data:

```javascript
import { encodeToMarkdown } from "@/helpers/daoHelpers";

const description = encodeToMarkdown({
  title: "Payment Request",
  kyc: "verified",
}); // "* Title: Payment Request <br>* KYC: verified"
```

Parse with `decodeProposalDescription(key, description)`.

### Blockchain Query Optimization

- **Batch RPC calls** when possible (e.g., `mt_batch_balance_of` for multiple tokens)
- **Cache with React Query** - Proposals have `refetchInterval: REFRESH_DELAY` (10s)
- **Debounce user input** - See `useDebounce` hook (500ms search, 1000ms amount filters)

## Key Files & Directories

- `src/context/` - Global state (DAO, wallet, theme, toasts)
- `src/hooks/` - `useProposals`, `useProposal`, `useTransactionHandler`, `useDebounce`
- `src/api/` - External service integrations (indexer, RPC, backend APIs)
- `src/helpers/` - Formatting, DAO helpers, NEAR utilities, logging
- `src/config/daoConfig.json` - Per-DAO feature flags
- `playwright-tests/util/sandbox.js` - near-sandbox wrapper for E2E tests
- `playwright.config.js` - Test configuration with video recording

## Common Gotchas

1. **URL params in [daoId] routes** - Use `useParams()` hook, not `router.query` (Next.js App Router)
2. **localStorage in SSR** - Wrap in `useEffect` or check `typeof window !== 'undefined'`
3. **NEAR amount formatting** - Use `formatNearAmount()` from `src/helpers/nearHelpers.js` (handles yoctoNEAR)
4. **Proposal status enum** - Exact values: `InProgress`, `Approved`, `Rejected`, `Failed`, `Expired`, `Removed`
5. **Test timeouts** - Set `test.setTimeout(300000)` for sandbox setup (2-5 min)
6. **BigNumber precision** - Use `big.js` library, not native JS numbers for token amounts

## External Dependencies

- **SputnikDAO Indexer**: https://github.com/near-daos/sputnik-dao-caching-api-server (proposal queries)
- **NEAR Intents**: `intents.near` contract for multi-chain assets
- **Defuse API**: Token metadata and blockchain information
- **OMFT**: `omft.near` contract for cross-chain token wrapping

## Testing Reference

See legacy test suite for patterns: https://github.com/NEAR-DevHub/neardevhub-treasury-dashboard/tree/develop/playwright-tests

Key differences:

- Old: `/${instanceAccount}/widget/app` → New: `/[daoId]/dashboard`
- Old: BOS widget isolation → New: Full React app with standard APIs
- Old: Direct RPC from components → New: Centralized API layer with React Query

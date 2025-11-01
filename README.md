# NEAR Treasury

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

This project is a conversion of the [NEAR DevHub Treasury Dashboard](https://github.com/NEAR-DevHub/neardevhub-treasury-dashboard), which was originally built on NEAR BOS (Blockchain Operating System).

While BOS is excellent for serving multiple apps in one web portal, the sandbox environment and isolation enforced by [NEAR Social VM](https://github.com/NearSocial/VM) create development challenges. These restrictions limit access to certain web browser features and APIs that are not available to BOS widgets/components.

We chose to rebuild NEAR Treasury as a standard Next.js React app to accelerate development and unlock the full potential of modern web technologies for an optimal user experience.

## Development Environment

### DevContainer Setup

This project includes a DevContainer configuration with:
- Pre-configured development environment with all dependencies
- **Remote Desktop** via noVNC - accessible in your web browser
- Useful for running Playwright tests in UI mode or headed mode

To access the remote desktop:
1. Open the project in the DevContainer
2. Check the Ports panel in VS Code for the noVNC port (typically 6080)
3. Click "Open in Browser" to access the desktop environment

The remote desktop allows you to run `npm run test:e2e:ui` and interact with the Playwright UI directly.

## Testing

### End-to-End Tests

This project uses [Playwright](https://playwright.dev/) for end-to-end testing.

Available test commands:
```bash
npm run test:e2e              # Run all tests
npm run test:e2e:ui           # Run tests in UI mode (requires remote desktop)
npm run test:e2e:headed       # Run tests in headed mode
npm run test:e2e:debug        # Run tests in debug mode
npm run test:e2e:report       # View test report
```

### Creating Test Demo Videos

After running tests, you can create a merged demo video of all test recordings:

```bash
npm run test:video-merge
```

This script:
- Finds all test video recordings in `test-results/`
- Overlays test titles on each video
- Adds 1-second freeze frames between tests
- Merges everything into `final_output.mp4`

**Requirements:**
- `ffmpeg` must be installed (included in the DevContainer)
- Tests must be run with video recording enabled (automatic for local runs)

The video merger reads test titles from `test-title.txt` files (automatically created by the test utility), or falls back to using the test directory name.

### SputnikDAO Indexer

This project uses the [SputnikDAO Caching API Server](https://github.com/near-daos/sputnik-dao-caching-api-server) for indexing DAO proposals and data. The indexer source code provides insights into how proposal data is queried and filtered from the blockchain.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

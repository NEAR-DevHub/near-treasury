#!/bin/bash

# Install project dependencies
npm install

# Install Playwright system dependencies and browsers
npx playwright install-deps
npx playwright install

# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Install GitHub Copilot CLI

npm install -g @github/copilot

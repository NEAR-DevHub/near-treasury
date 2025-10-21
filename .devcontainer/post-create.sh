#!/bin/bash

# Install project dependencies
npm install

# Install Playwright system dependencies and browsers
npx playwright install-deps
npx playwright install

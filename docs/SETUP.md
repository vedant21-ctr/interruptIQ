# Local Development Setup Guide

## Requirements
* Node.js (version 18+ or 20+ is recommended, version 14 is supported for test suites using custom configurations).
* PostgreSQL database instance.
* PNPM package manager (`npm install -g pnpm`).

## Installation Steps

1. Install project dependencies:
   ```bash
   pnpm install
   ```

2. Copy env template and set credentials:
   ```bash
   cp .env.example .env
   ```

3. Sync database schemas:
   ```bash
   pnpm --filter @interrupt-iq/api prisma db push
   ```

4. Boot the development services:
   ```bash
   pnpm run dev
   ```

## Troubleshooting
* **Module resolution error:** If compiler fails to locate workspace package paths, ensure `tsconfig.base.json` paths matches the packages folder locations.

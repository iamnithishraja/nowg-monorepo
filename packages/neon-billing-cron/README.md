# Neon Billing Cron Service

A standalone cron job service for processing Neon database billing using Hono.

## Overview

This service runs hourly to:
1. Fetch consumption data from Neon API for all active projects
2. Calculate compute and storage costs
3. Deduct amounts from appropriate wallets (org project, team, or personal)

## Features

- **Hourly Cron Job**: Runs automatically every hour at minute 0 (UTC)
- **Hono Server**: Lightweight HTTP server with health check and manual trigger endpoints
- **Same Logic**: Uses the exact same billing logic as `packages/web`
- **Environment Variables**: Supports MongoDB-stored env vars with process.env fallback

## Environment Variables

Required environment variables (can be stored in MongoDB or process.env):

- `MONGODB_URI` - MongoDB connection string (required, must be in process.env)
- `MONGODB_DB_NAME` - Database name (default: "nowgai")
- `NEON_API_KEY` - Neon API key for fetching consumption data
- `ENABLE_NEON_BILLING` - Set to "true" to enable billing (default: "true")
- `NEON_API_URL` - Neon API URL (default: "https://console.neon.tech/api/v2")
- `PORT` - Server port (default: 3001)

## Usage

### Development

```bash
bun run dev
```

### Production

```bash
bun run build
bun run start
```

### Manual Trigger

You can manually trigger the billing job:

```bash
curl -X POST http://localhost:3001/trigger
```

### Health Check

```bash
curl http://localhost:3001/health
```

### Status

```bash
curl http://localhost:3001/status
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /status` - Get cron job status and configuration
- `POST /trigger` - Manually trigger the billing job

## Cron Schedule

The billing job runs every hour at minute 0 (UTC) using the cron expression: `0 * * * *`

## Architecture

- Uses Hono for the HTTP server
- Uses `node-cron` for scheduling
- Shares models and logic with the main web package via `@nowgai/shared`
- Connects to the same MongoDB database as the main application

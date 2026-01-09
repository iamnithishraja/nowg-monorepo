# DataDock

A Backend-as-a-Service platform that provisions PostgreSQL databases via Neon and provides a unified API gateway with built-in authentication. Deployable to Cloudflare Workers.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Client    │────▶│   DataDock  │────▶│   Neon DB       │
│  (API Key)  │     │   Gateway   │     │   (Project DB)  │
└─────────────┘     └──────┬──────┘     └─────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   MongoDB   │
                    │  (Mongoose) │
                    └─────────────┘
```

- **MongoDB + Mongoose**: Stores project metadata with proper schemas and validation
- **Neon**: Provisions PostgreSQL databases for each project (includes auth tables)
- **Hono**: Lightweight API framework compatible with Workers
- **Auth**: Built-in email/password authentication with JWT tokens

## Tech Stack

- **Runtime**: Cloudflare Workers / Node.js
- **Framework**: Hono
- **Database (Management)**: MongoDB with Mongoose ODM
- **Database (Projects)**: Neon PostgreSQL
- **Auth**: JWT + bcrypt

## Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas (required for Workers deployment)
- Neon API Key (https://console.neon.tech)
- Cloudflare account (for Workers deployment)

### Installation

```bash
npm install
```

### Configuration

Update the `.env` file for local development:

```env
# MongoDB Connection (Use MongoDB Atlas for production)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
MONGODB_DB_NAME=datadock

# Neon API Configuration
NEON_API_KEY=your_neon_api_key_here

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Server Configuration (Node.js only)
PORT=3000
```

## Running Locally

### Node.js Development

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Wrangler Development (Cloudflare Workers)

```bash
# Run locally with Wrangler
npm run dev:worker
```

## Deployment to Cloudflare Workers

### 1. Set Secrets

```bash
# Set your secrets using Wrangler CLI
wrangler secret put MONGODB_URI
wrangler secret put NEON_API_KEY
wrangler secret put JWT_SECRET
```

### 2. Deploy

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Project Structure

```
src/
├── index.ts              # Node.js entry point
├── worker.ts             # Cloudflare Workers entry point
├── db/
│   ├── mongoose.ts       # Mongoose connection
│   └── models/
│       ├── index.ts      # Model exports
│       └── Project.ts    # Project schema
├── routes/
│   ├── projects.ts       # Project management
│   ├── gateway.ts        # Database gateway
│   └── auth.ts           # Authentication
├── services/
│   ├── neon.ts           # Neon provisioning
│   └── auth.ts           # Auth utilities
└── types/
    └── index.ts          # TypeScript types
```

## Mongoose Schema

### Project Model

```typescript
const ProjectSchema = new Schema({
  projectId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  apiKey: { type: String, required: true, unique: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  neonProjectId: { type: String, required: true },
  neonConnectionString: { type: String, required: true },
  neonDatabaseName: { type: String, required: true },
}, { timestamps: true });
```

---

## API Reference

### Projects API

#### Create a Project

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My App"}'
```

Response:
```json
{
  "projectId": "uuid-here",
  "name": "My App",
  "apiKey": "dk_abc123...",
  "endpoint": "/api/v1/uuid-here",
  "connectionString": "postgresql://..."
}
```

#### List Projects

```bash
curl http://localhost:3000/projects
```

#### Get Project Details

```bash
curl http://localhost:3000/projects/:projectId
```

#### Delete Project

```bash
curl -X DELETE http://localhost:3000/projects/:projectId
```

---

### Authentication API (requires `x-api-key` header)

#### Sign Up

```bash
curl -X POST http://localhost:3000/api/v1/:projectId/auth/signup \
  -H "Content-Type: application/json" \
  -H "x-api-key: dk_your_api_key" \
  -d '{"email": "user@example.com", "password": "securepassword123"}'
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified": false,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600
}
```

#### Login

```bash
curl -X POST http://localhost:3000/api/v1/:projectId/auth/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: dk_your_api_key" \
  -d '{"email": "user@example.com", "password": "securepassword123"}'
```

#### Get Current User (/me)

```bash
curl http://localhost:3000/api/v1/:projectId/auth/me \
  -H "x-api-key: dk_your_api_key" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Refresh Token

```bash
curl -X POST http://localhost:3000/api/v1/:projectId/auth/refresh \
  -H "Content-Type: application/json" \
  -H "x-api-key: dk_your_api_key" \
  -d '{"refresh_token": "eyJhbGciOiJIUzI1NiIs..."}'
```

#### Logout

```bash
curl -X POST http://localhost:3000/api/v1/:projectId/auth/logout \
  -H "x-api-key: dk_your_api_key" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Change Password

```bash
curl -X PUT http://localhost:3000/api/v1/:projectId/auth/password \
  -H "Content-Type: application/json" \
  -H "x-api-key: dk_your_api_key" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{"current_password": "old", "new_password": "new"}'
```

---

### Gateway API (requires `x-api-key` header)

#### Execute SQL Query

```bash
curl -X POST http://localhost:3000/api/v1/:projectId/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: dk_your_api_key" \
  -d '{"query": "SELECT * FROM users WHERE id = $1", "params": [1]}'
```

#### List Tables

```bash
curl http://localhost:3000/api/v1/:projectId/tables \
  -H "x-api-key: dk_your_api_key"
```

#### REST-like Endpoints

```bash
# Select
curl "http://localhost:3000/api/v1/:projectId/rest/users?limit=10" \
  -H "x-api-key: dk_your_api_key"

# Insert
curl -X POST http://localhost:3000/api/v1/:projectId/rest/users \
  -H "Content-Type: application/json" \
  -H "x-api-key: dk_your_api_key" \
  -d '{"name": "John", "email": "john@example.com"}'
```

---

## React Integration

```typescript
const PROJECT_ID = 'your-project-id';
const API_KEY = 'dk_your_api_key';
// Important: DO NOT end BASE_URL with a trailing slash.
// On Vercel, `https://your-app.vercel.app/` + `/api/...` becomes `//api/...`,
// which triggers a 308 redirect. Browsers block redirected CORS preflights (OPTIONS),
// which shows up as "CORS Failed" only in production.
const BASE_URL = 'https://datadock-api.your-worker.workers.dev';

class DataDockAuth {
  private accessToken: string | null = null;

  async signUp(email: string, password: string) {
    const base = BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/${PROJECT_ID}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) this.accessToken = data.access_token;
    return data;
  }

  async signIn(email: string, password: string) {
    const base = BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/${PROJECT_ID}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) this.accessToken = data.access_token;
    return data;
  }

  async getUser() {
    if (!this.accessToken) return null;
    const base = BASE_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/api/v1/${PROJECT_ID}/auth/me`, {
      headers: {
        'x-api-key': API_KEY,
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });
    return res.json();
  }
}

export const auth = new DataDockAuth();
```

---

## Security Notes

- API keys use `dk_` prefix for identification
- Passwords hashed with bcrypt (12 rounds)
- JWT access tokens expire in 1 hour
- Refresh tokens expire in 7 days
- Use MongoDB Atlas for Workers (required for cloud deployment)
- Always use HTTPS in production
- Set strong `JWT_SECRET` in production

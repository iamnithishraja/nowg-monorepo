# @nowgai/shared

Shared code package for the Nowgai monorepo. Contains common types, utilities, database models, and connection utilities used across all packages.

## Installation

This package is automatically available to other packages in the monorepo via workspace linking. Add it to your package's dependencies:

```json
{
  "dependencies": {
    "@nowgai/shared": "workspace:*"
  }
}
```

## Usage

### Types

```typescript
import {
  UserRole,
  TeamRole,
  ProjectRole,
  OrganizationRole,
  hasAdminAccess,
  isValidUserRole,
  USER_ROLE_DISPLAY_NAMES,
} from "@nowgai/shared/types";
```

### Utilities

```typescript
import {
  // Currency conversion
  getUSDToINRRate,
  convertUSDToINR,
  convertINRToUSD,
  
  // Wallet helpers
  calculateTotalReceived,
  calculateTotalCreditedBack,
  calculateMaxCreditBack,
  validateCreditBackAmount,
  createTransaction,
  getLastTransactionId,
} from "@nowgai/shared/utils";
```

### Database Models

```typescript
import {
  OrganizationMember,
  ProjectMember,
  Team,
  TeamMember,
  TeamInvitation,
  OrgWallet,
  ProjectWallet,
} from "@nowgai/shared/models";
```

### Database Connection

```typescript
import {
  connectToMongoDB,
  disconnectFromMongoDB,
  isMongoDBConnected,
  mongoose,
} from "@nowgai/shared/db";

// Connect with default settings
await connectToMongoDB();

// Or with custom options
await connectToMongoDB({
  uri: process.env.MONGODB_URI,
  dbName: "mydb",
  maxPoolSize: 20,
});
```

## Structure

```
src/
├── types/           # Shared TypeScript types and enums
│   ├── roles.ts     # Role definitions (UserRole, TeamRole, etc.)
│   └── index.ts
├── utils/           # Shared utility functions
│   ├── currencyConverter.ts  # Currency conversion utilities
│   ├── walletHelpers.ts      # Wallet transaction helpers
│   └── index.ts
├── models/          # Mongoose models
│   ├── organizationMemberModel.ts
│   ├── projectMemberModel.ts
│   ├── teamModel.ts
│   ├── teamMemberModel.ts
│   ├── teamInvitationModel.ts
│   ├── orgWalletModel.ts
│   ├── projectWalletModel.ts
│   └── index.ts
├── db/              # Database connection utilities
│   ├── mongoose.ts
│   └── index.ts
└── index.ts         # Main export file
```

## Development

Build the package:

```bash
bun run build
```

Watch for changes:

```bash
bun run dev
```

Type check:

```bash
bun run typecheck
```

## Backward Compatibility

Existing code in `admin-server` and `web` packages continues to work because the old files now re-export from this shared package. You can gradually update imports to use `@nowgai/shared` directly, or keep using the existing paths.

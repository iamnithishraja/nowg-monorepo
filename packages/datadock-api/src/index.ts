import { serve } from '@hono/node-server';
import 'dotenv/config';

import { disconnectFromMongoDB } from './db/mongoose.js';
import { createApp } from './app.js';

const app = createApp({ runtime: 'node' });

// Start server
const port = parseInt(process.env.PORT || '3000');

async function main() {
  try {
    // Start HTTP server
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   🚀 DataDock API Server                                           ║
║                                                                    ║
║   Server running on http://localhost:${port}                          ║
║                                                                    ║
║   Projects:                                                        ║
║   • POST   /projects              - Create a new project           ║
║   • GET    /projects              - List all projects              ║
║   • GET    /projects/:id          - Get project details            ║
║   • DELETE /projects/:id          - Delete a project               ║
║                                                                    ║
║   Auth (requires x-api-key header):                                ║
║   • POST   /api/v1/:projectId/auth/signup   - Register user        ║
║   • POST   /api/v1/:projectId/auth/login    - Login (get JWT)      ║
║   • GET    /api/v1/:projectId/auth/me       - Get current user     ║
║   • POST   /api/v1/:projectId/auth/refresh  - Refresh token        ║
║   • POST   /api/v1/:projectId/auth/logout   - Logout               ║
║   • PUT    /api/v1/:projectId/auth/password - Change password      ║
║   • DELETE /api/v1/:projectId/auth/user     - Delete account       ║
║                                                                    ║
║   Gateway (requires x-api-key header):                             ║
║   • POST   /api/v1/:projectId/query         - Execute SQL          ║
║   • POST   /api/v1/:projectId/transaction   - Run transaction      ║
║   • GET    /api/v1/:projectId/tables        - List tables          ║
║   • GET    /api/v1/:projectId/rest/:table   - REST select          ║
║   • POST   /api/v1/:projectId/rest/:table   - REST insert          ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
    `);

    serve({
      fetch: app.fetch,
      port,
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await disconnectFromMongoDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await disconnectFromMongoDB();
  process.exit(0);
});

main();


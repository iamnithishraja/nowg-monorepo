import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

import { connectToMongoDB } from './db/mongoose.js';
import authRouter from './routes/auth.js';
import gatewayRouter from './routes/gateway.js';
import projectsRouter from './routes/projects.js';

export type RuntimeName = 'node' | 'vercel';

export function createApp(options: { runtime?: RuntimeName } = {}) {
  const runtime = options.runtime ?? 'node';
  const app = new Hono();

  // Middleware
  const corsOptions = {
    // Allow any origin (API-key/JWT based auth, no cookies required)
    origin: (origin: string) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as string[],
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'] as string[],
    exposeHeaders: ['Content-Length'] as string[],
    maxAge: 60 * 60 * 24, // 24h
    credentials: false,
  };

  app.use('*', cors(corsOptions));
  app.use('*', logger());
  app.use('*', prettyJSON());

  // Ensure MongoDB is connected for all routes (serverless-safe)
  app.use('*', async (c, next) => {
    // Preflight requests should be fast and should not require DB connectivity.
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    try {
      await connectToMongoDB();
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      return c.json(
        {
          success: false,
          error: 'Database connection failed',
        },
        503
      );
    }

    await next();
  });

  // Explicit preflight handler (keeps behavior consistent across runtimes)
  app.options('*', (c) => c.body(null, 204));

  // Health check
  app.get('/', (c) => {
    return c.json({
      name: 'DataDock API',
      version: '1.0.0',
      description: 'Supabase-like backend as a service',
      runtime,
      endpoints: {
        projects: '/projects',
        gateway: '/api/v1/:projectId',
        auth: '/api/v1/:projectId/auth',
      },
    });
  });

  app.get('/health', (c) => {
    return c.json({ status: 'healthy', timestamp: new Date().toISOString(), runtime });
  });

  // Mount routers
  app.route('/projects', projectsRouter);
  app.route('/api/v1', gatewayRouter);
  app.route('/api/v1', authRouter);

  // Error handling
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json(
      {
        error: 'Internal Server Error',
        message: err.message,
      },
      500
    );
  });

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        error: 'Not Found',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      404
    );
  });

  return app;
}

// Default export for Vercel's native Hono support
const app = createApp({ runtime: 'vercel' });
export default app;



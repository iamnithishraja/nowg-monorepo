import { neon } from '@neondatabase/serverless';
import { Hono } from 'hono';
import { Project } from '../db/models/index.js';
import type { QueryRequest, QueryResponse } from '../types/index.js';

const gateway = new Hono();

/**
 * Cache for Neon SQL functions to reuse connections
 */
const sqlCache = new Map<string, ReturnType<typeof neon>>();

/**
 * Get or create a cached SQL function for a connection string
 */
function getSql(connectionString: string): ReturnType<typeof neon> {
  let sql = sqlCache.get(connectionString);
  if (!sql) {
    sql = neon(connectionString);
    sqlCache.set(connectionString, sql);
  }
  return sql;
}

/**
 * Helper to execute dynamic SQL queries with the Neon driver
 * Includes retry logic and timeout for intermittent connection failures
 */
async function executeQuery(
  connectionString: string,
  query: string,
  params: any[] = [],
  retries: number = 2,
  timeoutMs: number = 8000
): Promise<any[]> {
  const sql = getSql(connectionString);
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Wrap the query in a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
      });
      
      const queryPromise = sql.query(query, params);
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      return result as any[];
    } catch (error) {
      console.error(`Query execution error (attempt ${attempt + 1}/${retries + 1}):`, error);
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        // Clear the cached connection on final failure - it might be stale
        sqlCache.delete(connectionString);
        throw error;
      }
      
      // Clear the cached connection and retry with a fresh one
      sqlCache.delete(connectionString);
      
      // Small delay before retry
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  
  throw new Error('Query execution failed after all retries');
}

/**
 * Middleware to extract and validate API key using Mongoose
 */
async function extractProject(c: any) {
  // Check for API key in header or query param
  const apiKey = c.req.header('x-api-key') || c.req.query('apiKey');
  
  if (!apiKey) {
    return null;
  }

  return Project.findOne({ apiKey }).lean();
}

/**
 * POST /api/v1/:projectId/query
 * Execute a SQL query against the project's Neon database
 */
gateway.post('/:projectId/query', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    
    // First try to get project by API key for authentication
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    // Verify the API key belongs to this project
    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    const body = await c.req.json<QueryRequest>();
    
    if (!body.query || typeof body.query !== 'string') {
      return c.json({ 
        success: false, 
        error: 'Query string is required' 
      }, 400);
    }

    // Execute the query
    const result = await executeQuery(
      projectByKey.neonConnectionString,
      body.query,
      body.params || []
    );

    const response: QueryResponse = {
      success: true,
      data: result,
      rowCount: Array.isArray(result) ? result.length : 0,
    };

    return c.json(response);
  } catch (error) {
    console.error('Query error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Query execution failed'
    }, 500);
  }
});

/**
 * POST /api/v1/:projectId/transaction
 * Execute multiple queries in a transaction
 */
gateway.post('/:projectId/transaction', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    const { queries } = await c.req.json<{ queries: QueryRequest[] }>();
    
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return c.json({ 
        success: false, 
        error: 'An array of queries is required' 
      }, 400);
    }

    const connString = projectByKey.neonConnectionString;
    
    // Execute queries wrapped in a transaction
    const results: any[] = [];
    
    await executeQuery(connString, 'BEGIN');
    try {
      for (const q of queries) {
        const result = await executeQuery(connString, q.query, q.params || []);
        results.push(result);
      }
      await executeQuery(connString, 'COMMIT');
    } catch (error) {
      await executeQuery(connString, 'ROLLBACK');
      throw error;
    }

    return c.json({
      success: true,
      data: results,
      queryCount: results.length,
    });
  } catch (error) {
    console.error('Transaction error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Transaction failed'
    }, 500);
  }
});

/**
 * GET /api/v1/:projectId/tables
 * List all tables in the project's database
 */
gateway.get('/:projectId/tables', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    const tables = await executeQuery(
      projectByKey.neonConnectionString,
      `SELECT table_name, table_type 
       FROM information_schema.tables 
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );

    return c.json({
      success: true,
      data: tables,
    });
  } catch (error) {
    console.error('Error listing tables:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to list tables'
    }, 500);
  }
});

/**
 * GET /api/v1/:projectId/tables/:tableName/schema
 * Get the schema of a specific table
 */
gateway.get('/:projectId/tables/:tableName/schema', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const tableName = c.req.param('tableName');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    const columns = await executeQuery(
      projectByKey.neonConnectionString,
      `SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
      [tableName]
    );

    if (columns.length === 0) {
      return c.json({ 
        success: false, 
        error: `Table '${tableName}' not found` 
      }, 404);
    }

    return c.json({
      success: true,
      tableName,
      columns,
    });
  } catch (error) {
    console.error('Error getting table schema:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get table schema'
    }, 500);
  }
});

/**
 * REST-like endpoints for tables
 * GET /api/v1/:projectId/rest/:tableName - Select all rows
 */
gateway.get('/:projectId/rest/:tableName', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const tableName = c.req.param('tableName');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    // Get query params for filtering
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    const orderBy = c.req.query('orderBy') || 'id';
    const order = c.req.query('order') === 'desc' ? 'DESC' : 'ASC';

    // Note: In production, sanitize tableName and orderBy to prevent SQL injection
    const query = `SELECT * FROM "${tableName}" ORDER BY "${orderBy}" ${order} LIMIT ${limit} OFFSET ${offset}`;
    const result = await executeQuery(projectByKey.neonConnectionString, query);

    return c.json({
      success: true,
      data: result,
      pagination: { limit, offset, count: result.length },
    });
  } catch (error) {
    console.error('REST GET error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Query failed'
    }, 500);
  }
});

/**
 * POST /api/v1/:projectId/rest/:tableName - Insert a row
 */
gateway.post('/:projectId/rest/:tableName', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const tableName = c.req.param('tableName');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const columns = Object.keys(body);
    const values = Object.values(body);
    
    if (columns.length === 0) {
      return c.json({ success: false, error: 'No data provided' }, 400);
    }

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    const query = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders}) RETURNING *`;
    
    const result = await executeQuery(projectByKey.neonConnectionString, query, values);

    return c.json({
      success: true,
      data: result[0],
    }, 201);
  } catch (error) {
    console.error('REST POST error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Insert failed'
    }, 500);
  }
});

export default gateway;

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { Project, type IProject } from '../db/models/index.js';
import { getNeonService } from '../services/neon.js';
import { initializeAuthTables } from '../services/auth.js';
import type { CreateProjectRequest, CreateProjectResponse } from '../types/index.js';

const projects = new Hono();

/**
 * POST /projects
 * Create a new project with a Neon database
 */
projects.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateProjectRequest>();
    
    if (!body.name || typeof body.name !== 'string') {
      return c.json({ error: 'Project name is required' }, 400);
    }

    const projectId = uuidv4();
    const apiKey = `dk_${uuidv4().replace(/-/g, '')}`;
    const endpoint = `/api/v1/${projectId}`;

    // Provision a new Neon database
    console.log(`🚀 Provisioning Neon database for project: ${body.name}`);
    const neonService = getNeonService();
    const neonProject = await neonService.createProject(`datadock-${projectId.slice(0, 8)}`);

    const connectionString = neonProject.connection_uris[0]?.connection_uri || '';
    const databaseName = neonProject.connection_uris[0]?.connection_parameters?.database || 'neondb';

    // Initialize auth tables in the new database
    console.log(`🔐 Initializing auth tables...`);
    await initializeAuthTables(connectionString);

    // Store mapping in MongoDB using Mongoose
    const project = new Project({
      projectId,
      name: body.name,
      apiKey,
      endpoint,
      neonProjectId: neonProject.id,
      neonConnectionString: connectionString,
      neonDatabaseName: databaseName,
    });

    await project.save();
    console.log(`✅ Project created: ${projectId} (with auth tables)`);

    const response: CreateProjectResponse = {
      projectId,
      name: body.name,
      apiKey,
      endpoint,
      connectionString,
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    return c.json({ 
      error: 'Failed to create project',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /projects
 * List all projects
 */
projects.get('/', async (c) => {
  try {
    const allProjects = await Project.find({}).select('-neonConnectionString -apiKey -__v').lean();
    
    const safeProjects = allProjects.map(p => ({
      projectId: p.projectId,
      name: p.name,
      endpoint: p.endpoint,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return c.json({ projects: safeProjects });
  } catch (error) {
    console.error('Error listing projects:', error);
    return c.json({ error: 'Failed to list projects' }, 500);
  }
});

/**
 * GET /projects/:projectId
 * Get project details by ID
 */
projects.get('/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const project = await Project.findOne({ projectId }).lean();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Don't expose the full connection string or API key
    return c.json({
      projectId: project.projectId,
      name: project.name,
      endpoint: project.endpoint,
      neonProjectId: project.neonProjectId,
      databaseName: project.neonDatabaseName,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    console.error('Error getting project:', error);
    return c.json({ error: 'Failed to get project' }, 500);
  }
});

/**
 * GET /projects/:projectId/credentials
 * Get project credentials (API key and connection string)
 * This is a sensitive endpoint - in production, add extra auth
 */
projects.get('/:projectId/credentials', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const project = await Project.findOne({ projectId }).lean();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    return c.json({
      projectId: project.projectId,
      apiKey: project.apiKey,
      endpoint: project.endpoint,
      connectionString: project.neonConnectionString,
    });
  } catch (error) {
    console.error('Error getting credentials:', error);
    return c.json({ error: 'Failed to get credentials' }, 500);
  }
});

/**
 * DELETE /projects/:projectId
 * Delete a project and its Neon database
 */
projects.delete('/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const project = await Project.findOne({ projectId }).lean();

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Delete the Neon project
    console.log(`🗑️ Deleting Neon project: ${project.neonProjectId}`);
    const neonService = getNeonService();
    await neonService.deleteProject(project.neonProjectId);

    // Remove from MongoDB using Mongoose
    await Project.deleteOne({ projectId });
    console.log(`✅ Project deleted: ${projectId}`);

    return c.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json({ 
      error: 'Failed to delete project',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /projects/validate-key
 * Validate an API key and return project info
 */
projects.post('/validate-key', async (c) => {
  try {
    const { apiKey } = await c.req.json<{ apiKey: string }>();
    
    if (!apiKey) {
      return c.json({ error: 'API key is required' }, 400);
    }

    const project = await Project.findOne({ apiKey }).lean();
    
    if (!project) {
      return c.json({ valid: false, error: 'Invalid API key' }, 401);
    }

    return c.json({
      valid: true,
      projectId: project.projectId,
      name: project.name,
      endpoint: project.endpoint,
    });
  } catch (error) {
    console.error('Error validating API key:', error);
    return c.json({ error: 'Failed to validate API key' }, 500);
  }
});

export default projects;

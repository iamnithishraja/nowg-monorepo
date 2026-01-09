import type { NeonProjectResponse } from '../types/index.js';

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

interface NeonCreateProjectPayload {
  project: {
    name: string;
    region_id?: string;
    pg_version?: number;
  };
}

interface NeonApiProjectResponse {
  project: {
    id: string;
    name: string;
    region_id: string;
    pg_version: number;
    created_at: string;
  };
  connection_uris: {
    connection_uri: string;
    connection_parameters: {
      database: string;
      host: string;
      password: string;
      user: string;
      pooler_host: string;
    };
  }[];
  databases: {
    id: number;
    branch_id: string;
    name: string;
    owner_name: string;
  }[];
  roles: {
    branch_id: string;
    name: string;
    password: string;
  }[];
}

export class NeonService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEON_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ NEON_API_KEY not set. Neon provisioning will fail.');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${NEON_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Neon API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Create a new Neon project with a database
   */
  async createProject(name: string): Promise<NeonProjectResponse> {
    const payload: NeonCreateProjectPayload = {
      project: {
        name,
        region_id: 'aws-us-east-2', // Default region
        pg_version: 16,
      },
    };

    const response = await this.request<NeonApiProjectResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      id: response.project.id,
      name: response.project.name,
      connection_uris: response.connection_uris.map((uri) => ({
        connection_uri: uri.connection_uri,
        connection_parameters: {
          database: uri.connection_parameters.database,
          host: uri.connection_parameters.host,
          password: uri.connection_parameters.password,
          user: uri.connection_parameters.user,
        },
      })),
    };
  }

  /**
   * Delete a Neon project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get project details
   */
  async getProject(projectId: string): Promise<NeonApiProjectResponse> {
    return this.request<NeonApiProjectResponse>(`/projects/${projectId}`);
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<{ projects: NeonApiProjectResponse['project'][] }> {
    return this.request('/projects');
  }
}

// Singleton instance
let neonService: NeonService | null = null;

export function getNeonService(): NeonService {
  if (!neonService) {
    neonService = new NeonService();
  }
  return neonService;
}


export interface Project {
  _id?: string;
  projectId: string;
  name: string;
  apiKey: string;
  endpoint: string;
  neonProjectId: string;
  neonConnectionString: string;
  neonDatabaseName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectRequest {
  name: string;
}

export interface CreateProjectResponse {
  projectId: string;
  name: string;
  apiKey: string;
  endpoint: string;
  connectionString: string;
}

export interface NeonProjectResponse {
  id: string;
  name: string;
  connection_uris: {
    connection_uri: string;
    connection_parameters: {
      database: string;
      host: string;
      password: string;
      user: string;
    };
  }[];
}

export interface QueryRequest {
  query: string;
  params?: any[];
}

export interface QueryResponse {
  success: boolean;
  data?: any;
  error?: string;
  rowCount?: number;
}

// Auth Types
export interface AuthUser {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
  email_verified: boolean;
  last_sign_in: Date | null;
}

export interface SignUpRequest {
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  projectId: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  projectId: string;
  type: 'refresh';
  iat: number;
  exp: number;
}


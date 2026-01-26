import mongoose from "mongoose";

interface SupabaseIntegrationDocument extends mongoose.Document {
  userId: string;
  supabaseUserId: string;
  supabaseEmail: string;
  accessToken: string;
  organizationId?: string;
  organizationName?: string;
  connectedAt: Date;
  lastUsedAt: Date;
}

// Schema definition for reuse
export const supabaseIntegrationSchemaDefinition = {
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  supabaseUserId: {
    type: String,
    required: true,
  },
  supabaseEmail: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  organizationId: {
    type: String,
  },
  organizationName: {
    type: String,
  },
  connectedAt: {
    type: Date,
    default: Date.now,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  },
};

export const supabaseIntegrationSchema = new mongoose.Schema<SupabaseIntegrationDocument>(
  supabaseIntegrationSchemaDefinition,
  {
    timestamps: true,
  }
);

// Model getter function for consistent access
export function getSupabaseIntegrationModel(): mongoose.Model<any> {
  if (mongoose.models.SupabaseIntegration) {
    return mongoose.models.SupabaseIntegration as mongoose.Model<any>;
  }
  return mongoose.model<SupabaseIntegrationDocument>(
    "SupabaseIntegration",
    supabaseIntegrationSchema
  );
}

const SupabaseIntegration = getSupabaseIntegrationModel();

export default SupabaseIntegration;

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

const supabaseIntegrationSchema =
  new mongoose.Schema<SupabaseIntegrationDocument>(
    {
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
    },
    {
      timestamps: true,
    }
  );

const SupabaseIntegration =
  mongoose.models.SupabaseIntegration ||
  mongoose.model<SupabaseIntegrationDocument>(
    "SupabaseIntegration",
    supabaseIntegrationSchema
  );

export default SupabaseIntegration;

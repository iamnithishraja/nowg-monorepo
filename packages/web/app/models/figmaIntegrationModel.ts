import mongoose from "mongoose";

interface FigmaIntegrationDocument extends mongoose.Document {
  userId: string;
  figmaUserId: string;
  figmaEmail: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  connectedAt: Date;
  lastUsedAt: Date;
}

const figmaIntegrationSchema =
  new mongoose.Schema<FigmaIntegrationDocument>(
    {
      userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      figmaUserId: {
        type: String,
        required: true,
      },
      figmaEmail: {
        type: String,
        required: true,
      },
      accessToken: {
        type: String,
        required: true,
      },
      refreshToken: {
        type: String,
      },
      expiresAt: {
        type: Date,
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

const FigmaIntegration =
  mongoose.models.FigmaIntegration ||
  mongoose.model<FigmaIntegrationDocument>(
    "FigmaIntegration",
    figmaIntegrationSchema
  );

export default FigmaIntegration;


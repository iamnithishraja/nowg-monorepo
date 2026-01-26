import mongoose from "mongoose";

/**
 * Environment Variables Configuration Model
 * Stores all environment variables in MongoDB instead of .env file
 */
export const envConfigSchemaDefinition = {
  key: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  value: {
    type: String,
    required: true,
  },
};

export const envConfigSchema = new mongoose.Schema(envConfigSchemaDefinition);

// Model getter function for consistent access
export function getEnvConfigModel(): mongoose.Model<any> {
  if (mongoose.models.EnvConfig) {
    return mongoose.models.EnvConfig as mongoose.Model<any>;
  }
  return mongoose.model("EnvConfig", envConfigSchema);
}

const EnvConfig = getEnvConfigModel();

export default EnvConfig;

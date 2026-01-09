import mongoose from "mongoose";

/**
 * Environment Variables Configuration Model
 * Stores all environment variables in MongoDB instead of .env file
 */
const envConfigSchema = new mongoose.Schema({
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
});

const EnvConfig = mongoose.model("EnvConfig", envConfigSchema);
export default EnvConfig;

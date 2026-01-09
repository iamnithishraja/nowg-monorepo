import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProject extends Document {
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

const ProjectSchema = new Schema<IProject>(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    neonProjectId: {
      type: String,
      required: true,
    },
    neonConnectionString: {
      type: String,
      required: true,
    },
    neonDatabaseName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'projects',
  }
);

// Static methods for common queries
ProjectSchema.statics.findByProjectId = function (projectId: string) {
  return this.findOne({ projectId });
};

ProjectSchema.statics.findByApiKey = function (apiKey: string) {
  return this.findOne({ apiKey });
};

ProjectSchema.statics.findByEndpoint = function (endpoint: string) {
  return this.findOne({ endpoint });
};

// Create and export the model
const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export default Project;


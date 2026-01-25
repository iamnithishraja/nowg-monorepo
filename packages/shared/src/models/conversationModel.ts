import mongoose from "mongoose";

// Schema definition for reuse
export const conversationSchemaDefinition = {
  userId: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  ],
  // Reference to chats (separate Chat model)
  // This allows organizing messages into different chat threads within a conversation
  chats: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
    },
  ],
  // Track tokens from reverted messages
  additionalTokensUsed: {
    type: Number,
    default: 0,
  },
  // Store uploaded files for the conversation (legacy - files now stored in R2)
  filesMap: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Database provider choice: "supabase" or "neon"
  dbProvider: {
    type: String,
    enum: ["supabase", "neon", null],
    default: null,
  },
  // Supabase provisioning settings and credentials scoped to this conversation
  supabase: {
    enabled: {
      type: Boolean,
      default: false,
    },
    ref: {
      type: String,
      default: undefined,
    },
    projectId: {
      type: String,
      default: undefined,
    },
    supabaseUrl: {
      type: String,
      default: undefined,
    },
    anonKey: {
      type: String,
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: undefined,
    },
  },
  // Neon provisioning settings and credentials scoped to this conversation
  neon: {
    enabled: {
      type: Boolean,
      default: false,
    },
    projectId: {
      type: String,
      default: undefined,
    },
    endpoint: {
      type: String,
      default: undefined,
    },
    apiKey: {
      type: String,
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: undefined,
    },
  },
  // GitHub repository association (reference to GitHubRepository model)
  githubRepository: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GitHubRepository",
    default: undefined,
  },
  // Team association (if this is a team project)
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    default: null, // null for personal projects
  },
  // Project type
  projectType: {
    type: String,
    enum: ["personal", "team"],
    default: "personal",
  },
  // Admin Project association (reference to Admin Project model)
  adminProjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    default: null,
    index: true,
  },
};

export const conversationSchema = new mongoose.Schema(conversationSchemaDefinition);

// Model getter function for consistent access
export function getConversationModel(): mongoose.Model<any> {
  if (mongoose.models.Conversation) {
    return mongoose.models.Conversation as mongoose.Model<any>;
  }
  return mongoose.model("Conversation", conversationSchema);
}

const Conversation = getConversationModel();

export default Conversation;

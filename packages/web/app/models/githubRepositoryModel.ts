import mongoose from "mongoose";

const githubRepositorySchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    unique: true, // One repo per conversation
  },
  userId: {
    type: String,
    required: true,
  },
  // GitHub repository details
  repoName: {
    type: String,
    required: true,
  },
  repoFullName: {
    type: String, // owner/repo
    required: true,
  },
  repoUrl: {
    type: String, // https://github.com/owner/repo
    required: true,
  },
  owner: {
    type: String,
    required: true,
  },
  branch: {
    type: String,
    default: "main",
  },
  isPrivate: {
    type: Boolean,
    default: true,
  },
  // Sync tracking
  lastSyncedAt: {
    type: Date,
    default: Date.now,
  },
  lastSyncedCommitSha: {
    type: String,
    default: undefined,
  },
  lastSyncedMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    default: undefined,
  },
  // Track code state hash to detect changes
  codeStateHash: {
    type: String,
    default: null,
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster lookups
githubRepositorySchema.index({ conversationId: 1 });
githubRepositorySchema.index({ userId: 1 });

const GitHubRepository = mongoose.model("GitHubRepository", githubRepositorySchema);
export default GitHubRepository;


import mongoose from "mongoose";

export type NotificationType =
  | "project_created"
  | "version_reverted"
  | "canvas_edit"
  | "github_push";

export const notificationSchemaDefinition = {
  userId: {
    type: String,
    required: true,
    index: true,
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    default: null,
  },
  type: {
    type: String,
    enum: ["project_created", "version_reverted", "canvas_edit", "github_push"],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
};

export const notificationSchema = new mongoose.Schema(
  notificationSchemaDefinition
);

// Compound index for efficient user notification queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export function getNotificationModel(): mongoose.Model<any> {
  if (mongoose.models.Notification) {
    return mongoose.models.Notification as mongoose.Model<any>;
  }
  return mongoose.model("Notification", notificationSchema);
}

const Notification = getNotificationModel();

export default Notification;

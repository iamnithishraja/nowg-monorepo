import { connectToDatabase } from "~/lib/mongo";
import { getNotificationModel, type NotificationType } from "~/models/notificationModel";

interface CreateNotificationParams {
  userId: string;
  conversationId?: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Create a new notification for a user
   */
  async create(params: CreateNotificationParams): Promise<any> {
    await connectToDatabase();
    const Notification = getNotificationModel();

    const notification = new Notification({
      userId: params.userId,
      conversationId: params.conversationId || null,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
      read: false,
    });

    await notification.save();
    return notification.toObject();
  }

  /**
   * Get all notifications for a user (most recent first)
   */
  async getForUser(userId: string, limit = 50): Promise<any[]> {
    await connectToDatabase();
    const Notification = getNotificationModel();

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return notifications.map((n: any) => ({
      id: n._id.toString(),
      userId: n.userId,
      conversationId: n.conversationId?.toString() || null,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      metadata: n.metadata || {},
      createdAt: n.createdAt,
    }));
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    await connectToDatabase();
    const Notification = getNotificationModel();
    return Notification.countDocuments({ userId, read: false });
  }

  /**
   * Mark a specific notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    await connectToDatabase();
    const Notification = getNotificationModel();
    const result = await Notification.updateOne(
      { _id: notificationId, userId },
      { $set: { read: true } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await connectToDatabase();
    const Notification = getNotificationModel();
    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string): Promise<boolean> {
    await connectToDatabase();
    const Notification = getNotificationModel();
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    return result.deletedCount > 0;
  }

  /**
   * Clear all notifications for a user
   */
  async clearAll(userId: string): Promise<void> {
    await connectToDatabase();
    const Notification = getNotificationModel();
    await Notification.deleteMany({ userId });
  }
}

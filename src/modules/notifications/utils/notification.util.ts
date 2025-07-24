import { Types } from 'mongoose';
import { toSafeString } from '../../../utils';
import {
  PopulatedNotification,
  FormattedNotification,
  isNotificationWithId,
  SocketAuthData,
} from '../interfaces/notification.interface';
import {
  NotificationStatus,
  NotificationType,
} from '../schemas/notification.schema';

function toVNTimeString(date: Date | string | undefined | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  // Chuyển sang UTC+7
  const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vnDate.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Format notification để gửi qua socket
 */
export function formatNotificationForSocket(
  notification: PopulatedNotification,
): FormattedNotification {
  return {
    id: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    status: notification.status,
    is_read: notification.is_read,
    sent_at: toVNTimeString(notification.sent_at),
    created_at: toVNTimeString(notification.created_at),
  };
}

/**
 * Lấy notification ID an toàn từ notification object
 */
export function extractNotificationId(notification: unknown): string {
  if (isNotificationWithId(notification)) {
    return toSafeString(notification._id);
  }
  return '';
}

/**
 * Lấy userId an toàn từ socket auth data
 */
export function extractUserIdFromAuth(auth: unknown): string | null {
  if (
    auth &&
    typeof auth === 'object' &&
    'userId' in auth &&
    typeof (auth as SocketAuthData).userId === 'string'
  ) {
    return (auth as SocketAuthData).userId!;
  }
  return null;
}

/**
 * Validate ObjectId string
 */
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

/**
 * Chuyển đổi string thành ObjectId an toàn
 */
export function toObjectId(id: string): Types.ObjectId | null {
  try {
    if (isValidObjectId(id)) {
      return new Types.ObjectId(id);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Tạo formatted notification để emit realtime
 */
export function createRealtimeNotification(params: {
  notificationId: string;
  title: string;
  message: string;
  type: NotificationType;
  status?: NotificationStatus;
  is_read?: boolean;
  sent_at?: Date;
  created_at?: Date;
  avatar_url?: string;
  sender_user_id?: string;
}): FormattedNotification {
  const {
    notificationId,
    title,
    message,
    type,
    status = NotificationStatus.SENT,
    is_read = false,
    sent_at,
    created_at,
    avatar_url,
    sender_user_id,
  } = params;

  return {
    id: notificationId,
    title,
    message,
    type,
    status,
    is_read,
    sent_at: toVNTimeString(sent_at || new Date()),
    created_at: toVNTimeString(created_at || new Date()),
    avatar_url,
    user_id: type === NotificationType.MESSAGE ? sender_user_id : undefined,
  };
}

/**
 * Xử lý error message an toàn cho socket response
 */
export function handleSocketError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Build room name cho socket notifications
 */
export function buildUserNotificationRoom(userId: string): string {
  return `notifications_${userId}`;
}

/**
 * Build room name cho broadcast notifications (theo type hoặc role)
 */
export function buildBroadcastRoom(type: string): string {
  return `broadcast_${type}`;
}

/**
 * Validate notification pagination parameters
 */
export function validatePaginationParams(
  page?: number,
  limit?: number,
): {
  page: number;
  limit: number;
  skip: number;
} {
  const validPage = Math.max(1, page || 1);
  const validLimit = Math.min(50, Math.max(1, limit || 10)); // Max 50 items per page
  const skip = (validPage - 1) * validLimit;

  return {
    page: validPage,
    limit: validLimit,
    skip,
  };
}

/**
 * Build MongoDB sort object từ string parameter
 */
export function buildSortObject(sort?: string): Record<string, 1 | -1> {
  const defaultSort = { created_at: -1 as const };

  if (!sort) return defaultSort;

  try {
    const sortFields = sort.split(',');
    const sortObj: Record<string, 1 | -1> = {};

    for (const field of sortFields) {
      const trimmedField = field.trim();
      if (trimmedField.startsWith('-')) {
        sortObj[trimmedField.substring(1)] = -1;
      } else {
        sortObj[trimmedField] = 1;
      }
    }

    return Object.keys(sortObj).length > 0 ? sortObj : defaultSort;
  } catch {
    return defaultSort;
  }
}

/**
 * Build filter object cho notifications query
 */
export function buildNotificationFilter(params: {
  userId: string;
  is_read?: boolean;
  type?: NotificationType;
  status?: NotificationStatus;
  isDeleted?: boolean;
}): Record<string, unknown> {
  const { userId, is_read, type, status, isDeleted = false } = params;

  const filter: Record<string, unknown> = {
    user_id: new Types.ObjectId(userId),
    isDeleted,
  };

  if (typeof is_read === 'boolean') {
    filter.is_read = is_read;
  }

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
  }

  return filter;
}

import { Types } from 'mongoose';
import {
  NotificationStatus,
  NotificationType,
  RecipientType,
  SentMethod,
} from '../schemas/notification.schema';

/**
 * Interface cho User được populate trong notification
 */
export interface PopulatedUser {
  _id: Types.ObjectId;
  username: string;
  email: string;
  avatar?: string;
  role: string;
}

/**
 * Interface cho Notification với populated fields
 */
export interface PopulatedNotification {
  _id: string;
  user_id: PopulatedUser;
  recipient_type: RecipientType;
  title: string;
  message: string;
  type: NotificationType;
  notification_template_id?: string;
  sent_method: SentMethod[];
  status: NotificationStatus;
  is_read: boolean;
  sent_at: Date;
  isDeleted: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Interface cho Notification formatted để gửi qua socket
 */
export interface FormattedNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  is_read: boolean;
  sent_at: string | null;
  created_at: string;
}

/**
 * Interface cho Connected User trong Gateway
 */
export interface ConnectedUser {
  userId: string;
  socketId: string;
}

/**
 * Interface cho Socket Auth Data
 */
export interface SocketAuthData {
  userId?: string;
  user?: {
    _id: string;
    username: string;
    email: string;
  };
}

/**
 * Interface cho Socket Response
 */
export interface SocketResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Interface cho Pagination Query
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  is_read?: boolean;
  type?: NotificationType;
  status?: NotificationStatus;
  sort?: string;
}

/**
 * Interface cho Notification Response với pagination
 */
export interface NotificationResponse {
  notifications: PopulatedNotification[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Interface cho Unread Count Response
 */
export interface UnreadCountResponse {
  unreadCount: number;
  byType: Record<NotificationType, number>;
}

/**
 * Type guard để kiểm tra notification có _id
 */
export function isNotificationWithId(
  obj: unknown,
): obj is { _id: string | Types.ObjectId } {
  return (
    obj !== null && obj !== undefined && typeof obj === 'object' && '_id' in obj
  );
}

/**
 * Type guard để kiểm tra populated notification
 */
export function isPopulatedNotification(
  obj: unknown,
): obj is PopulatedNotification {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    '_id' in obj &&
    'user_id' in obj &&
    'title' in obj &&
    'message' in obj &&
    'type' in obj
  );
}

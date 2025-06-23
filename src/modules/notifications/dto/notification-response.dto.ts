import {
  NotificationStatus,
  NotificationType,
  RecipientType,
  SentMethod,
} from '../schemas/notification.schema';

export class NotificationResponseDto {
  _id: string;
  user_id: {
    _id: string;
    username: string;
    email: string;
    avatar?: string;
    role: string;
  };
  recipient_type: RecipientType;
  title: string;
  message: string;
  type: NotificationType;
  notification_template_id?: string;
  sent_method: SentMethod[];
  status: NotificationStatus;
  is_read: boolean;
  sent_at: Date | null;
  isDeleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export class NotificationListResponseDto {
  notifications: NotificationResponseDto[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export class UnreadCountResponseDto {
  unreadCount: number;
  byType: Record<NotificationType, number>;
}

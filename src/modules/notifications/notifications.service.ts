import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import {
  QueryNotificationDto,
  AdminQueryNotificationDto,
} from './dto/query-notification.dto';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from './schemas/notification.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { NotificationsGateway } from './notifications.gateway';
import { removeUndefinedObject } from '../../utils/common.util';
import {
  isValidObjectId,
  createRealtimeNotification,
  validatePaginationParams,
  buildSortObject,
  buildNotificationFilter,
} from './utils/notification.util';
import {
  NotificationResponse,
  UnreadCountResponse,
  PopulatedNotification,
} from './interfaces/notification.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ==================== USER ENDPOINTS ====================

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    try {
      // Validate user_id is valid ObjectId
      if (!isValidObjectId(createNotificationDto.user_id)) {
        throw new BadRequestException('ID người dùng không hợp lệ');
      }

      const notificationData = {
        ...createNotificationDto,
        user_id: new Types.ObjectId(createNotificationDto.user_id),
        notification_template_id: createNotificationDto.notification_template_id
          ? new Types.ObjectId(createNotificationDto.notification_template_id)
          : undefined,
        status: createNotificationDto.status || NotificationStatus.PENDING,
        sent_method: createNotificationDto.sent_method || ['in_app'],
        sent_at:
          createNotificationDto.status === NotificationStatus.SENT
            ? new Date()
            : null,
      };

      const notification = new this.notificationModel(notificationData);
      const savedNotification = await notification.save();

      this.logger.log(
        `Created notification ${String(savedNotification._id)} for user ${createNotificationDto.user_id}`,
      );

      // Auto-send if status is SENT
      if (savedNotification.status === NotificationStatus.SENT) {
        const formattedNotification = createRealtimeNotification({
          notificationId: String(savedNotification._id),
          title: savedNotification.title,
          message: savedNotification.message,
          type: savedNotification.type,
          status: savedNotification.status,
          is_read: savedNotification.is_read,
          sent_at: savedNotification.sent_at,
          created_at: savedNotification.created_at,
        });

        this.notificationsGateway.emitNewNotification(
          formattedNotification,
          createNotificationDto.user_id,
        );

        // Update unread count
        const unreadCount = await this.getUnreadCount(
          createNotificationDto.user_id,
        );
        this.notificationsGateway.emitUnreadCountUpdate(
          createNotificationDto.user_id,
          unreadCount.unreadCount,
        );
      }

      return savedNotification;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('Error creating notification:', error.message);
      } else {
        this.logger.error('Error creating notification:', String(error));
      }
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Không thể tạo thông báo');
    }
  }

  async findAll(query: QueryNotificationDto, _user: JwtPayload): Promise<any> {
    try {
      const { page, limit, skip } = validatePaginationParams(
        query.page ? parseInt(query.page) : undefined,
        query.limit ? parseInt(query.limit) : undefined,
      );

      const filter = buildNotificationFilter({
        userId: _user._id,
        is_read: query.is_read,
        type: query.type,
        status: query.status,
        isDeleted: false,
      });

      const sort = buildSortObject(query.sort);

      const [notifications, totalItems] = await Promise.all([
        this.notificationModel
          .find(filter)
          .populate('user_id', 'username email avatar role')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.notificationModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        notifications: notifications as unknown as PopulatedNotification[],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('Error finding notifications:', error.message);
      } else {
        this.logger.error('Error finding notifications:', String(error));
      }
      throw new BadRequestException('Không thể lấy thông báo');
    }
  }

  async findOne(id: string, user: JwtPayload): Promise<Notification> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('ID thông báo không hợp lệ');
    }

    const notification = await this.notificationModel
      .findOne({
        _id: id,
        user_id: user._id,
        isDeleted: false,
      })
      .populate('user_id', 'username email avatar role')
      .exec();

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return notification;
  }

  async markAsRead(id: string, user: JwtPayload): Promise<Notification> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('ID thông báo không hợp lệ');
    }

    const notification = await this.notificationModel.findOne({
      _id: id,
      user_id: user._id,
      isDeleted: false,
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    if (notification.is_read) {
      return notification; // Already read
    }

    notification.is_read = true;
    notification.updated_at = new Date();
    const updatedNotification = await notification.save();

    // Emit real-time update
    this.notificationsGateway.emitNotificationRead(id, user._id);

    // Update unread count
    const unreadCount = await this.getUnreadCount(user._id);
    this.notificationsGateway.emitUnreadCountUpdate(
      user._id,
      unreadCount.unreadCount,
    );

    this.logger.log(`Notification ${id} marked as read by user ${user._id}`);

    return updatedNotification;
  }

  async markAllAsRead(user: JwtPayload): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      {
        user_id: user._id,
        is_read: false,
        isDeleted: false,
      },
      {
        is_read: true,
        updated_at: new Date(),
      },
    );

    // Emit real-time update
    this.notificationsGateway.emitUnreadCountUpdate(user._id, 0);

    this.logger.log(
      `Marked ${result.modifiedCount} notifications as read for user ${user._id}`,
    );

    return { modifiedCount: result.modifiedCount };
  }

  async softDelete(id: string, user: JwtPayload): Promise<void> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('ID thông báo không hợp lệ');
    }

    const notification = await this.notificationModel.findOne({
      _id: id,
      user_id: user._id,
      isDeleted: false,
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    notification.isDeleted = true;
    notification.updated_at = new Date();
    await notification.save();

    // Update unread count if notification was unread
    if (!notification.is_read) {
      const unreadCount = await this.getUnreadCount(user._id);
      this.notificationsGateway.emitUnreadCountUpdate(
        user._id,
        unreadCount.unreadCount,
      );
    }

    this.logger.log(`Notification ${id} soft deleted by user ${user._id}`);
  }

  async clearAll(user: JwtPayload): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      {
        user_id: user._id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        updated_at: new Date(),
      },
    );

    // Emit real-time update - no unread notifications after clearing all
    this.notificationsGateway.emitUnreadCountUpdate(user._id, 0);

    this.logger.log(
      `Cleared ${result.modifiedCount} notifications for user ${user._id}`,
    );

    return { modifiedCount: result.modifiedCount };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }

    const [totalUnread, byTypeData] = await Promise.all([
      this.notificationModel.countDocuments({
        user_id: userId,
        is_read: false,
        isDeleted: false,
      }),
      this.notificationModel.aggregate([
        {
          $match: {
            user_id: new Types.ObjectId(userId),
            is_read: false,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byType: Record<NotificationType, number> = {} as Record<
      NotificationType,
      number
    >;

    // Initialize all types with 0
    for (const type of Object.values(NotificationType)) {
      byType[type] = 0;
    }

    // Fill in actual counts
    for (const item of byTypeData as {
      _id: NotificationType;
      count: number;
    }[]) {
      if (item._id && Object.values(NotificationType).includes(item._id)) {
        byType[item._id] = item.count;
      }
    }

    return {
      unreadCount: totalUnread,
      byType,
    };
  }

  // ==================== ADMIN ENDPOINTS ====================

  async findAllForAdmin(
    query: AdminQueryNotificationDto,
  ): Promise<NotificationResponse> {
    try {
      const { page, limit, skip } = validatePaginationParams(
        query.page ? parseInt(query.page) : undefined,
        query.limit ? parseInt(query.limit) : undefined,
      );

      const filter: Record<string, unknown> = {};

      if (query.user_id && isValidObjectId(query.user_id)) {
        filter.user_id = new Types.ObjectId(query.user_id);
      }

      if (typeof query.is_read === 'boolean') {
        filter.is_read = query.is_read;
      }

      if (query.type) {
        filter.type = query.type;
      }

      if (query.status) {
        filter.status = query.status;
      }

      if (typeof query.isDeleted === 'boolean') {
        filter.isDeleted = query.isDeleted;
      } else {
        filter.isDeleted = false; // Default to show non-deleted
      }

      const sort = buildSortObject(query.sort);

      const [notifications, totalItems] = await Promise.all([
        this.notificationModel
          .find(filter)
          .populate('user_id', 'username email avatar role')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.notificationModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        notifications: notifications as unknown as PopulatedNotification[],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          'Error finding notifications for admin:',
          error.message,
        );
      } else {
        this.logger.error(
          'Error finding notifications for admin:',
          String(error),
        );
      }
      throw new BadRequestException('Không thể lấy thông báo');
    }
  }

  async findOneForAdmin(id: string): Promise<Notification> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('ID thông báo không hợp lệ');
    }

    const notification = await this.notificationModel
      .findById(id)
      .populate('user_id', 'username email avatar role')
      .exec();

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return notification;
  }

  async update(
    id: string,
    updateNotificationDto: UpdateNotificationDto,
    user: JwtPayload,
  ): Promise<Notification> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('ID thông báo không hợp lệ');
    }

    const notification = await this.notificationModel.findOne({
      _id: id,
      user_id: user._id,
      isDeleted: false,
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    const cleanedData = removeUndefinedObject(updateNotificationDto);
    Object.assign(notification, cleanedData);
    notification.updated_at = new Date();

    const updatedNotification = await notification.save();

    this.logger.log(`Notification ${id} updated by user ${user._id}`);

    return updatedNotification;
  }

  // ==================== INTERNAL SERVICE ENDPOINTS ====================

  async createAndSend(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    // Force status to SENT for internal service
    const notificationData = {
      ...createNotificationDto,
      status: NotificationStatus.SENT,
    };

    return this.create(notificationData);
  }

  async sendBulkNotifications(
    notifications: CreateNotificationDto[],
  ): Promise<Notification[]> {
    const results: Notification[] = [];

    for (const notificationDto of notifications) {
      try {
        const notification = await this.createAndSend(notificationDto);
        results.push(notification);
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.error(
            `Failed to send notification to user ${notificationDto.user_id}:`,
            error.message,
          );
        } else {
          this.logger.error(
            `Failed to send notification to user ${notificationDto.user_id}:`,
            String(error),
          );
        }
      }
    }

    return results;
  }
}

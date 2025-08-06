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
} from './utils/notification.util';
import {
  NotificationResponse,
  UnreadCountResponse,
  PopulatedNotification,
} from './interfaces/notification.interface';
import { PropertyStaffAssignmentService } from '../property-staff-assignment/property-staff-assignment.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
    @Inject(forwardRef(() => PropertyStaffAssignmentService))
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
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
          avatar_url: createNotificationDto.avatar_url,
          sender_user_id: createNotificationDto.sender_user_id,
        });

        this.logger.log(
          `Emitting real-time notification to user ${createNotificationDto.user_id} with recipient_type: ${createNotificationDto.recipient_type}`,
        );

        this.notificationsGateway.emitNewNotification(
          formattedNotification,
          createNotificationDto.user_id,
        );

        // Update unread count - use the new overloaded method for role-based count
        try {
          // Try to get user info to use role-based unread count
          const userObjectId = new Types.ObjectId(
            createNotificationDto.user_id,
          );
          const userInfo = await this.notificationModel.db
            .collection('users')
            .findOne({ _id: userObjectId });

          if (userInfo) {
            const userPayload: JwtPayload = {
              _id: createNotificationDto.user_id,
              email: userInfo.email || '',
              role: userInfo.role as 'guest' | 'staff' | 'admin',
              customRoles: (userInfo.customRoles as unknown as string[]) || [],
            };
            const unreadCount = await this.getUnreadCount(userPayload);
            this.notificationsGateway.emitUnreadCountUpdate(
              createNotificationDto.user_id,
              unreadCount.unreadCount,
            );
            this.logger.log(
              `Updated unread count for ${userInfo.role} user ${createNotificationDto.user_id}: ${unreadCount.unreadCount}`,
            );
          } else {
            // Fallback to old method
            const unreadCount = await this.getUnreadCount(
              createNotificationDto.user_id,
            );
            this.notificationsGateway.emitUnreadCountUpdate(
              createNotificationDto.user_id,
              unreadCount.unreadCount,
            );
          }
        } catch (error) {
          this.logger.error('Error updating unread count:', error);
          // Fallback to old method
          const unreadCount = await this.getUnreadCount(
            createNotificationDto.user_id,
          );
          this.notificationsGateway.emitUnreadCountUpdate(
            createNotificationDto.user_id,
            unreadCount.unreadCount,
          );
        }
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

      // Build role-based filter
      const filter = await this.buildRoleBasedNotificationFilter({
        user: _user,
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

    // Build role-based filter for finding the notification
    const baseFilter = await this.buildRoleBasedNotificationFilter({
      user,
      isDeleted: false,
    });

    const notification = await this.notificationModel
      .findOne({
        _id: id,
        ...baseFilter,
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

    const objectId = new Types.ObjectId(id);

    // Build role-based filter for finding the notification
    const baseFilter = await this.buildRoleBasedNotificationFilter({
      user,
      isDeleted: false,
    });

    const notification = await this.notificationModel.findOne({
      _id: objectId,
      ...baseFilter,
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

    // Emit real-time update to the notification owner, not the admin
    const notificationOwnerId = notification.user_id.toString();
    this.notificationsGateway.emitNotificationRead(id, notificationOwnerId);

    // Update unread count for the notification owner
    const unreadCount = await this.getUnreadCount(notificationOwnerId);
    this.notificationsGateway.emitUnreadCountUpdate(
      notificationOwnerId,
      unreadCount.unreadCount,
    );

    this.logger.log(
      `Notification ${id} marked as read by user ${user._id} (role: ${user.role})`,
    );

    return updatedNotification;
  }

  async markAllAsRead(user: JwtPayload): Promise<{ modifiedCount: number }> {
    const objectUserId = new Types.ObjectId(user._id);
    const result = await this.notificationModel.updateMany(
      {
        user_id: objectUserId,
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

    const objectId = new Types.ObjectId(id);

    // Build role-based filter for finding the notification
    const baseFilter = await this.buildRoleBasedNotificationFilter({
      user,
      isDeleted: false,
    });

    const notification = await this.notificationModel.findOne({
      _id: objectId,
      ...baseFilter,
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    notification.isDeleted = true;
    notification.updated_at = new Date();
    await notification.save();

    // Update unread count if notification was unread (for the notification owner)
    if (!notification.is_read) {
      const notificationOwnerId = notification.user_id.toString();
      const unreadCount = await this.getUnreadCount(notificationOwnerId);
      this.notificationsGateway.emitUnreadCountUpdate(
        notificationOwnerId,
        unreadCount.unreadCount,
      );
    }

    this.logger.log(
      `Notification ${id} soft deleted by user ${user._id} (role: ${user.role})`,
    );
  }

  async clearAll(user: JwtPayload): Promise<{ modifiedCount: number }> {
    const objectUserId = new Types.ObjectId(user._id);
    const result = await this.notificationModel.updateMany(
      {
        user_id: objectUserId,
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

  // Overloaded method - with user context for role-based filtering
  async getUnreadCount(user: JwtPayload): Promise<UnreadCountResponse>;
  // Original method - for backward compatibility
  async getUnreadCount(userId: string): Promise<UnreadCountResponse>;

  async getUnreadCount(
    userOrId: JwtPayload | string,
  ): Promise<UnreadCountResponse> {
    // Determine if it's a user object or just userId string
    const isUserObject =
      typeof userOrId === 'object' && userOrId !== null && '_id' in userOrId;

    if (isUserObject) {
      // New implementation with role-based filtering
      const user = userOrId;

      // Build role-based filter for unread count
      const baseFilter = await this.buildRoleBasedNotificationFilter({
        user,
        is_read: false,
        isDeleted: false,
      });

      const [totalUnread, byTypeData] = await Promise.all([
        this.notificationModel.countDocuments(baseFilter),
        this.notificationModel.aggregate([
          {
            $match: baseFilter,
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
    } else {
      // Original implementation for backward compatibility
      const userId = userOrId;

      if (!isValidObjectId(userId)) {
        throw new BadRequestException('ID người dùng không hợp lệ');
      }

      const objectUserId = new Types.ObjectId(userId);

      const [totalUnread, byTypeData] = await Promise.all([
        this.notificationModel.countDocuments({
          user_id: objectUserId,
          is_read: false,
          isDeleted: false,
        }),
        this.notificationModel.aggregate([
          {
            $match: {
              user_id: objectUserId,
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

    // Build role-based filter for finding the notification
    const baseFilter = await this.buildRoleBasedNotificationFilter({
      user,
      isDeleted: false,
    });

    const notification = await this.notificationModel.findOne({
      _id: id,
      ...baseFilter,
    });

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    const cleanedData = removeUndefinedObject(updateNotificationDto);
    Object.assign(notification, cleanedData);
    notification.updated_at = new Date();

    const updatedNotification = await notification.save();

    this.logger.log(
      `Notification ${id} updated by user ${user._id} (role: ${user.role})`,
    );

    return updatedNotification;
  }

  // ==================== ROLE-BASED FILTERING ====================

  /**
   * Build role-based notification filter
   * - Guest: Only their own notifications
   * - Staff: Only notifications for properties they manage + their own notifications
   * - Admin: All notifications
   */
  private async buildRoleBasedNotificationFilter(params: {
    user: JwtPayload;
    is_read?: boolean;
    type?: NotificationType;
    status?: NotificationStatus;
    isDeleted?: boolean;
  }): Promise<Record<string, unknown>> {
    const { user, is_read, type, status, isDeleted = false } = params;

    const baseFilter: Record<string, unknown> = {
      isDeleted,
    };

    // Add optional filters
    if (typeof is_read === 'boolean') {
      baseFilter.is_read = is_read;
    }
    if (type) {
      baseFilter.type = type;
    }
    if (status) {
      baseFilter.status = status;
    }

    // Role-based filtering
    if (user.role === 'admin') {
      // Admin sees all notifications - no user filter needed
      return baseFilter;
    } else if (user.role === 'staff') {
      try {
        // Staff sees notifications for properties they manage + their own notifications
        const staffAssignments =
          await this.propertyStaffAssignmentService.getPropertiesByStaff(
            new Types.ObjectId(user._id),
          );

        const managedPropertyIds = staffAssignments.map(
          (assignment) => assignment.propertyId,
        );

        // Get notifications where:
        // 1. User is the recipient (their own notifications)
        // 2. Notification is for a property they manage (check metadata.propertyId)
        const userFilter = {
          $or: [
            { user_id: new Types.ObjectId(user._id) },
            {
              'metadata.propertyId': {
                $in: managedPropertyIds.map((id) => id.toString()),
              },
            },
          ],
        };

        return { ...baseFilter, ...userFilter };
      } catch (error) {
        this.logger.error(
          'Error building staff filter, falling back to user-only:',
          error,
        );
        // Fallback to user-only notifications if there's an error
        return {
          ...baseFilter,
          user_id: new Types.ObjectId(user._id),
        };
      }
    } else {
      // Guest sees only their own notifications
      return {
        ...baseFilter,
        user_id: new Types.ObjectId(user._id),
      };
    }
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

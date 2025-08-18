import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../schemas/booking.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { PropertyStaffAssignmentService } from '../../property-staff-assignment/property-staff-assignment.service';
import { PropertyService } from '../../properties/services/property.service';
import { ListingService } from '../../listing/listing.service';
import { AssignmentStatus } from '../../property-staff-assignment/schemas/property-staff-assignment.schema';
import {
  NotificationType,
  RecipientType,
  NotificationStatus,
  SentMethod,
} from '../../notifications/schemas/notification.schema';
import { BookingRepo } from '../booking.repo';
import { CreateNotificationDto } from '../../notifications/dto/create-notification.dto';

type ObjectIdLike = Types.ObjectId | string;

interface UserInfo {
  _id: ObjectIdLike;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface StaffAssignment {
  status: AssignmentStatus;
  staffId?: UserInfo & { _id: ObjectIdLike };
}

@Injectable()
export class BookingNotificationStatusService {
  private readonly logger = new Logger(BookingNotificationStatusService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
    private readonly propertyService: PropertyService,
    private readonly listingService: ListingService,
    private readonly bookingRepo: BookingRepo,
  ) {}

  private idToString(id: ObjectIdLike): string {
    return typeof id === 'string' ? id : id.toString();
  }

  private idOptToString(id?: ObjectIdLike | null): string | undefined {
    return id ? this.idToString(id) : undefined;
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return err.stack ?? err.message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  /**
   * Tạo thông báo khi trạng thái booking thay đổi
   */
  async createStatusChangeNotification(
    booking: Booking,
    newStatus: BookingStatus,
  ): Promise<void> {
    try {
      const bookingId = this.idToString(booking._id as Types.ObjectId);
      const bookingCode = bookingId.slice(-8);
      const guestId = this.idToString(booking.guestId as Types.ObjectId);

      // Validate guest ID
      if (!guestId || guestId === 'null' || guestId === 'undefined') {
        this.logger.error(
          `[STATUS CHANGE] Invalid guest ID for booking ${bookingId}: ${guestId}`,
        );
        throw new Error('Invalid guest ID');
      }

      // Get property and listing information for room name
      let propertyName = 'Căn hộ';
      let listingTitle = '';

      try {
        if (booking.propertyId) {
          const property = await this.propertyService.findOne(
            booking.propertyId.toString(),
          );
          if (property) {
            propertyName = property.name || 'Căn hộ';
          }
        }

        if (booking.listingId) {
          const listing = await this.listingService.findOne(
            booking.listingId.toString(),
          );
          if (listing) {
            listingTitle = listing.title || '';
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not fetch property/listing details for notification: ${this.formatError(
            error,
          )}`,
        );
      }

      const roomName = listingTitle || propertyName;

      // Tạo thông báo cho khách hàng với tiêu đề và nội dung chuyên nghiệp
      const statusData: Partial<
        Record<BookingStatus, { title: string; message: string }>
      > = {
        [BookingStatus.CONFIRMED]: {
          title: '✅ Đặt phòng được xác nhận',
          message: `Chúc mừng! Đặt phòng tại ${roomName} đã được xác nhận thành công. Chúng tôi rất mong được phục vụ bạn.`,
        },
        [BookingStatus.CANCELLED]: {
          title: '❌ Đặt phòng đã bị hủy',
          message: `Đặt phòng tại ${roomName} đã được hủy. Nếu có thắc mắc, vui lòng liên hệ với chúng tôi.`,
        },
        [BookingStatus.COMPLETED]: {
          title: '🎉 Đặt phòng hoàn thành',
          message: `Cảm ơn bạn đã lưu trú tại ${roomName}! Hy vọng bạn đã có trải nghiệm tuyệt vời.`,
        },
        [BookingStatus.REJECTED]: {
          title: '⚠️ Đặt phòng bị từ chối',
          message: `Rất tiếc, đặt phòng tại ${roomName} không thể được chấp nhận. Vui lòng liên hệ để được hỗ trợ.`,
        },
      };

      const notificationData: { title: string; message: string } = statusData[
        newStatus
      ] ?? {
        title: '📋 Cập nhật đặt phòng',
        message: `Trạng thái đặt phòng tại ${roomName} đã được cập nhật thành ${newStatus}.`,
      };

      try {
        const dto: CreateNotificationDto = {
          user_id: guestId,
          recipient_type: RecipientType.GUEST,
          title: notificationData.title,
          message: `${notificationData.message} Mã đặt phòng: ${bookingCode.toUpperCase()}`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
          metadata: {
            bookingId: bookingId,
            propertyId: this.idOptToString(
              booking.propertyId as unknown as ObjectIdLike | undefined,
            ),
            listingId: this.idOptToString(
              booking.listingId as unknown as ObjectIdLike | undefined,
            ),
            bookingStatus: newStatus,
            previousStatus: booking.status,
            roomName: roomName,
            propertyName: propertyName,
            listingTitle: listingTitle,
            bookingCode: bookingCode.toUpperCase(),
            checkInDate: booking.checkInDate,
            checkOutDate: booking.check_out_date,
            guests: booking.guests,
            finalAmount: booking.final_amount,
            nights: booking.nights,
          },
        };
        await this.notificationsService.create(dto);
      } catch (guestNotificationError) {
        this.logger.error(
          `[GUEST NOTIFICATION] Failed to create status change notification for guest ${guestId}, booking ${bookingId}: ${this.formatError(
            guestNotificationError,
          )}`,
        );
        // Don't throw - continue with staff/admin notifications
      }

      // Create notification for staff managing this property
      try {
        await this.createStaffStatusChangeNotification(booking, newStatus);
      } catch (staffNotificationError) {
        this.logger.error(
          `[STAFF NOTIFICATION] Failed to create status change notification for booking ${bookingId}: ${this.formatError(
            staffNotificationError,
          )}`,
        );
      }

      // Create notification for admin
      try {
        await this.createAdminStatusChangeNotification(booking, newStatus);
      } catch (adminNotificationError) {
        this.logger.error(
          `[ADMIN NOTIFICATION] Failed to create status change notification for booking ${bookingId}: ${this.formatError(
            adminNotificationError,
          )}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error creating status change notification: ${this.formatError(error)}`,
      );
    }
  }

  /**
   * Tạo thông báo cho staff khi trạng thái booking thay đổi
   */
  private async createStaffStatusChangeNotification(
    booking: Booking,
    newStatus: BookingStatus,
  ): Promise<void> {
    try {
      const bookingId = this.idToString(booking._id as Types.ObjectId);
      const bookingCode = bookingId.slice(-8);
      const propertyId = this.idOptToString(
        booking.propertyId as unknown as ObjectIdLike | undefined,
      );

      if (!propertyId) return;

      // Get staff assigned to this property
      const staffAssignments =
        (await this.propertyStaffAssignmentService.getStaffByProperty(
          new Types.ObjectId(propertyId),
        )) as StaffAssignment[];

      // Get guest and property information for detailed notification
      const db = this.bookingRepo.getModel().db;
      const usersCol = db.collection<UserInfo>('users');
      const propsCol = db.collection<{ _id: Types.ObjectId; name?: string }>(
        'properties',
      );

      const guestInfo = await usersCol.findOne({
        _id: booking.guestId as Types.ObjectId,
      });
      const propertyInfo = await propsCol.findOne({
        _id: booking.propertyId as Types.ObjectId,
      });

      const guestName = guestInfo?.name || 'Khách hàng';
      const propertyName = propertyInfo?.name || 'Property';
      const checkInDate = booking.checkInDate
        ? new Date(booking.checkInDate).toLocaleDateString('vi-VN')
        : '';

      const statusMessages: Record<BookingStatus, string> = {
        [BookingStatus.PENDING]: '⏳ Chờ xử lý',
        [BookingStatus.CONFIRMED]: '✅ Đã xác nhận',
        [BookingStatus.CANCELLED]: '❌ Đã hủy',
        [BookingStatus.COMPLETED]: '✅ Hoàn thành',
        [BookingStatus.REJECTED]: '⚠️ Từ chối',
      };

      const statusIcon = statusMessages[newStatus] || `🔄 ${newStatus}`;

      // Find first actual staff member to create ONE representative staff notification
      let representativeStaff: (UserInfo & { _id: ObjectIdLike }) | null = null;
      const allStaffEmails: string[] = [];

      for (const assignment of staffAssignments) {
        if (
          assignment.status === AssignmentStatus.ACTIVE &&
          assignment.staffId
        ) {
          const rawStaffId = assignment.staffId._id;
          const staffObjectId =
            typeof rawStaffId === 'string'
              ? new Types.ObjectId(rawStaffId)
              : rawStaffId;
          if (await this.isActualStaff(staffObjectId)) {
            const staffUser = assignment.staffId;
            const staffIdStr = this.idToString(staffUser._id);
            allStaffEmails.push(staffUser.email || staffIdStr);

            // Use first actual staff as representative
            if (!representativeStaff) {
              representativeStaff = staffUser;
            }
          }
        }
      }

      // Create ONE staff status change notification if we found any staff
      if (representativeStaff) {
        const staffIdStr = this.idToString(representativeStaff._id);
        const dto: CreateNotificationDto = {
          user_id: staffIdStr,
          recipient_type: RecipientType.STAFF,
          title: `${statusIcon} Booking #${bookingCode}`,
          message: `Booking của khách ${guestName} tại ${propertyName} (${checkInDate}) đã chuyển từ "${booking.status}" sang "${newStatus}". Cần xử lý ngay!`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: bookingId,
            propertyId: propertyId,
            listingId: this.idOptToString(
              booking.listingId as unknown as ObjectIdLike | undefined,
            ),
            bookingStatus: newStatus,
            previousStatus: booking.status,
            guestName,
            propertyName,
            checkInDate: booking.checkInDate,
            bookingCode,
            allStaffEmails: allStaffEmails.join(', '),
            guestEmail: guestInfo?.email || '',
            guestPhone: guestInfo?.phone || '',
            finalAmount: booking.final_amount,
            nights: booking.nights,
            guests: booking.guests,
            checkOutDate: booking.check_out_date,
          },
        };
        await this.notificationsService.create(dto);
      }
    } catch (error) {
      this.logger.error(
        `Error creating staff status change notification: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  /**
   * Tạo thông báo cho admin khi trạng thái booking thay đổi
   */
  private async createAdminStatusChangeNotification(
    booking: Booking,
    newStatus: BookingStatus,
  ): Promise<void> {
    try {
      const bookingId = this.idToString(booking._id as Types.ObjectId);
      const bookingCode = bookingId.slice(-8).toUpperCase();

      // Get guest, property, and booking amount information
      const db = this.bookingRepo.getModel().db;
      const usersCol = db.collection<UserInfo>('users');
      const propsCol = db.collection<{ _id: Types.ObjectId; name?: string }>(
        'properties',
      );

      const [guestInfo, propertyInfo] = await Promise.all([
        usersCol.findOne({ _id: booking.guestId as Types.ObjectId }),
        propsCol.findOne({ _id: booking.propertyId as Types.ObjectId }),
      ]);

      const guestName = guestInfo?.name || 'Khách hàng';
      const guestEmail = guestInfo?.email || '';
      const propertyName = propertyInfo?.name || 'Property';
      const checkInDate = booking.checkInDate
        ? new Date(booking.checkInDate).toLocaleDateString('vi-VN')
        : '';
      const amount = booking.final_amount || booking.total_price || 0;

      const statusMessages: Record<BookingStatus, string> = {
        [BookingStatus.PENDING]: '⏳ Chờ xử lý',
        [BookingStatus.CONFIRMED]: '✅ Xác nhận',
        [BookingStatus.CANCELLED]: '❌ Hủy bỏ',
        [BookingStatus.COMPLETED]: '✅ Hoàn thành',
        [BookingStatus.REJECTED]: '⚠️ Từ chối',
      };

      const statusIcon = statusMessages[newStatus] || `🔄 ${newStatus}`;

      // Get all admin users
      const adminUsers = await usersCol.find({ role: 'admin' }).toArray();

      // Create ONE notification for admin (pick first admin as representative)
      if (adminUsers.length > 0) {
        const representativeAdmin = adminUsers[0];
        const adminId = this.idToString(representativeAdmin._id);

        const notificationData: CreateNotificationDto = {
          user_id: adminId,
          recipient_type: RecipientType.ADMIN,
          title: `${statusIcon} Booking #${bookingCode} - ${propertyName}`,
          message: `Booking của ${guestName}${
            guestEmail ? ` (${guestEmail})` : ''
          } tại ${propertyName} (${checkInDate}) đã chuyển từ "${
            booking.status
          }" → "${newStatus}". Giá trị: ${amount.toLocaleString('vi-VN')}đ`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: bookingId,
            propertyId: this.idOptToString(
              booking.propertyId as unknown as ObjectIdLike | undefined,
            ),
            listingId: this.idOptToString(
              booking.listingId as unknown as ObjectIdLike | undefined,
            ),
            bookingStatus: newStatus,
            previousStatus: booking.status,
            guestName,
            guestEmail,
            propertyName,
            checkInDate: booking.checkInDate,
            bookingCode,
            amount,
            allAdminEmails: adminUsers.map((a) => a.email ?? '').join(', '),
            guestPhone: guestInfo?.phone || '',
            nights: booking.nights,
            guests: booking.guests,
            checkOutDate: booking.check_out_date,
            finalAmount: booking.final_amount,
            paymentStatus: booking.payment_status,
          },
        };

        await this.notificationsService.create(notificationData);
      }
    } catch (error) {
      this.logger.error(
        `Error creating admin status change notification: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  /**
   * Tạo thông báo khi trạng thái payment thay đổi
   */
  async createPaymentStatusChangeNotification(
    booking: Booking,
    oldPaymentStatus: PaymentStatus,
    newPaymentStatus: PaymentStatus,
  ): Promise<void> {
    try {
      const bookingId = this.idToString(booking._id as Types.ObjectId);
      const bookingCode = bookingId.slice(-8);
      const guestId = this.idToString(booking.guestId as Types.ObjectId);

      // Validate guest ID
      if (!guestId || guestId === 'null' || guestId === 'undefined') {
        this.logger.error(
          `[PAYMENT STATUS CHANGE] Invalid guest ID for booking ${bookingId}: ${guestId}`,
        );
        return;
      }

      // Get property and listing information
      let propertyName = 'Căn hộ';
      let listingTitle = '';

      try {
        if (booking.propertyId) {
          const property = await this.propertyService.findOne(
            booking.propertyId.toString(),
          );
          if (property) {
            propertyName = property.name || 'Căn hộ';
          }
        }

        if (booking.listingId) {
          const listing = await this.listingService.findOne(
            booking.listingId.toString(),
          );
          if (listing) {
            listingTitle = listing.title || '';
          }
        }
      } catch (error) {
        this.logger.warn(
          `Could not fetch property/listing details for payment notification: ${this.formatError(
            error,
          )}`,
        );
      }

      const roomName = listingTitle || propertyName;

      // Payment status messages
      const paymentStatusData: Partial<
        Record<PaymentStatus, { title: string; message: string }>
      > = {
        [PaymentStatus.PAID]: {
          title: '💳 Thanh toán hoàn tất',
          message: `Thanh toán cho đặt phòng tại ${roomName} đã hoàn tất thành công.`,
        },
        [PaymentStatus.PARTIALLY_PAID]: {
          title: '💰 Thanh toán một phần',
          message: `Đã thanh toán một phần cho đặt phòng tại ${roomName}. Vui lòng thanh toán số tiền còn lại.`,
        },
        [PaymentStatus.REFUNDING]: {
          title: '🔄 Đang hoàn tiền',
          message: `Yêu cầu hoàn tiền cho đặt phòng tại ${roomName} đang được xử lý.`,
        },
        [PaymentStatus.REFUNDED]: {
          title: '✅ Hoàn tiền thành công',
          message: `Hoàn tiền cho đặt phòng tại ${roomName} đã hoàn tất.`,
        },
        [PaymentStatus.FAILED]: {
          title: '❌ Thanh toán thất bại',
          message: `Thanh toán cho đặt phòng tại ${roomName} không thành công. Vui lòng thử lại.`,
        },
      };

      const notificationData: { title: string; message: string } =
        paymentStatusData[newPaymentStatus] ?? {
          title: '📋 Cập nhật thanh toán',
          message: `Trạng thái thanh toán cho đặt phòng tại ${roomName} đã được cập nhật.`,
        };

      // Create notification for guest
      try {
        const dto: CreateNotificationDto = {
          user_id: guestId,
          recipient_type: RecipientType.GUEST,
          title: notificationData.title,
          message: `${notificationData.message} Mã đặt phòng: ${bookingCode.toUpperCase()}`,
          type: NotificationType.PAYMENT,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
          metadata: {
            bookingId: bookingId,
            propertyId: this.idOptToString(
              booking.propertyId as unknown as ObjectIdLike | undefined,
            ),
            listingId: this.idOptToString(
              booking.listingId as unknown as ObjectIdLike | undefined,
            ),
            paymentStatus: newPaymentStatus,
            previousPaymentStatus: oldPaymentStatus,
            roomName: roomName,
            propertyName: propertyName,
            listingTitle: listingTitle,
            bookingCode: bookingCode.toUpperCase(),
            checkInDate: booking.checkInDate,
            checkOutDate: booking.check_out_date,
            guests: booking.guests,
            finalAmount: booking.final_amount,
            depositPaidAmount: booking.deposit_paid_amount,
            outstandingAmount:
              (booking.final_amount || 0) - (booking.deposit_paid_amount || 0),
            nights: booking.nights,
          },
        };
        await this.notificationsService.create(dto);
      } catch (error) {
        this.logger.error(
          `[PAYMENT NOTIFICATION] Failed to create payment status change notification for guest ${guestId}, booking ${bookingId}: ${this.formatError(
            error,
          )}`,
        );
      }

      // Create notification for staff
      try {
        await this.createStaffPaymentStatusChangeNotification(
          booking,
          oldPaymentStatus,
          newPaymentStatus,
        );
      } catch (error) {
        this.logger.error(
          `[STAFF PAYMENT NOTIFICATION] Failed to create payment status change notification for booking ${bookingId}: ${this.formatError(
            error,
          )}`,
        );
      }

      // Create notification for admin
      try {
        await this.createAdminPaymentStatusChangeNotification(
          booking,
          oldPaymentStatus,
          newPaymentStatus,
        );
      } catch (error) {
        this.logger.error(
          `[ADMIN PAYMENT NOTIFICATION] Failed to create payment status change notification for booking ${bookingId}: ${this.formatError(
            error,
          )}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error creating payment status change notification: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  /**
   * Tạo thông báo cho staff khi trạng thái payment thay đổi
   */
  private async createStaffPaymentStatusChangeNotification(
    booking: Booking,
    oldPaymentStatus: PaymentStatus,
    newPaymentStatus: PaymentStatus,
  ): Promise<void> {
    try {
      const bookingId = this.idToString(booking._id as Types.ObjectId);
      const bookingCode = bookingId.slice(-8);
      const propertyId = this.idOptToString(
        booking.propertyId as unknown as ObjectIdLike | undefined,
      );

      if (!propertyId) return;

      // Get staff assigned to this property
      const staffAssignments =
        (await this.propertyStaffAssignmentService.getStaffByProperty(
          new Types.ObjectId(propertyId),
        )) as StaffAssignment[];

      // Get guest and property information
      const db = this.bookingRepo.getModel().db;
      const usersCol = db.collection<UserInfo>('users');
      const propsCol = db.collection<{ _id: Types.ObjectId; name?: string }>(
        'properties',
      );

      const guestInfo = await usersCol.findOne({
        _id: booking.guestId as Types.ObjectId,
      });
      const propertyInfo = await propsCol.findOne({
        _id: booking.propertyId as Types.ObjectId,
      });

      const guestName = guestInfo?.name || 'Khách hàng';
      const propertyName = propertyInfo?.name || 'Property';
      const checkInDate = booking.checkInDate
        ? new Date(booking.checkInDate).toLocaleDateString('vi-VN')
        : '';

      const paymentStatusMessages: Record<PaymentStatus, string> = {
        [PaymentStatus.UNPAID]: '💤 Chưa thanh toán',
        [PaymentStatus.PAID]: '💳 Đã thanh toán đầy đủ',
        [PaymentStatus.PARTIALLY_PAID]: '💰 Đã thanh toán một phần',
        [PaymentStatus.REFUNDING]: '🔄 Đang hoàn tiền',
        [PaymentStatus.REFUNDED]: '✅ Đã hoàn tiền',
        [PaymentStatus.FAILED]: '❌ Thanh toán thất bại',
      };

      const statusIcon =
        paymentStatusMessages[newPaymentStatus] || `🔄 ${newPaymentStatus}`;

      // Find first actual staff member
      let representativeStaff: (UserInfo & { _id: ObjectIdLike }) | null = null;
      const allStaffEmails: string[] = [];

      for (const assignment of staffAssignments) {
        if (
          assignment.status === AssignmentStatus.ACTIVE &&
          assignment.staffId
        ) {
          const rawStaffId = assignment.staffId._id;
          const staffObjectId =
            typeof rawStaffId === 'string'
              ? new Types.ObjectId(rawStaffId)
              : rawStaffId;
          if (await this.isActualStaff(staffObjectId)) {
            const staffUser = assignment.staffId as UserInfo & {
              _id: ObjectIdLike;
            };
            const staffIdStr = this.idToString(staffUser._id);
            allStaffEmails.push(staffUser.email || staffIdStr);

            if (!representativeStaff) {
              representativeStaff = staffUser;
            }
          }
        }
      }

      // Create staff payment notification
      if (representativeStaff) {
        const staffIdStr = this.idToString(representativeStaff._id);
        const dto: CreateNotificationDto = {
          user_id: staffIdStr,
          recipient_type: RecipientType.STAFF,
          title: `${statusIcon} Payment #${bookingCode}`,
          message: `Thanh toán của khách ${guestName} tại ${propertyName} (${checkInDate}) đã chuyển từ "${oldPaymentStatus}" sang "${newPaymentStatus}".`,
          type: NotificationType.PAYMENT,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: bookingId,
            propertyId: propertyId,
            listingId: this.idOptToString(
              booking.listingId as unknown as ObjectIdLike | undefined,
            ),
            paymentStatus: newPaymentStatus,
            previousPaymentStatus: oldPaymentStatus,
            guestName,
            propertyName,
            checkInDate: booking.checkInDate,
            bookingCode,
            allStaffEmails: allStaffEmails.join(', '),
            guestEmail: guestInfo?.email || '',
            guestPhone: guestInfo?.phone || '',
            finalAmount: booking.final_amount,
            depositPaidAmount: booking.deposit_paid_amount,
            outstandingAmount:
              (booking.final_amount || 0) - (booking.deposit_paid_amount || 0),
            nights: booking.nights,
            guests: booking.guests,
            checkOutDate: booking.check_out_date,
          },
        };
        await this.notificationsService.create(dto);
      }
    } catch (error) {
      this.logger.error(
        `Error creating staff payment status change notification: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  /**
   * Tạo thông báo cho admin khi trạng thái payment thay đổi
   */
  private async createAdminPaymentStatusChangeNotification(
    booking: Booking,
    oldPaymentStatus: PaymentStatus,
    newPaymentStatus: PaymentStatus,
  ): Promise<void> {
    try {
      const bookingId = this.idToString(booking._id as Types.ObjectId);
      const bookingCode = bookingId.slice(-8);

      // Get guest and property information
      const db = this.bookingRepo.getModel().db;
      const usersCol = db.collection<UserInfo>('users');
      const propsCol = db.collection<{ _id: Types.ObjectId; name?: string }>(
        'properties',
      );

      const [guestInfo, propertyInfo] = await Promise.all([
        usersCol.findOne({ _id: booking.guestId as Types.ObjectId }),
        propsCol.findOne({ _id: booking.propertyId as Types.ObjectId }),
      ]);

      const guestName = guestInfo?.name || 'Khách hàng';
      const guestEmail = guestInfo?.email || '';
      const propertyName = propertyInfo?.name || 'Property';
      const checkInDate = booking.checkInDate
        ? new Date(booking.checkInDate).toLocaleDateString('vi-VN')
        : '';
      const amount = booking.final_amount || 0;

      const paymentStatusMessages: Record<PaymentStatus, string> = {
        [PaymentStatus.UNPAID]: '💤 Chưa thanh toán',
        [PaymentStatus.PAID]: '💳 Đã thanh toán đầy đủ',
        [PaymentStatus.PARTIALLY_PAID]: '💰 Đã thanh toán một phần',
        [PaymentStatus.REFUNDING]: '🔄 Đang hoàn tiền',
        [PaymentStatus.REFUNDED]: '✅ Đã hoàn tiền',
        [PaymentStatus.FAILED]: '❌ Thanh toán thất bại',
      };

      const statusIcon =
        paymentStatusMessages[newPaymentStatus] || `🔄 ${newPaymentStatus}`;

      // Get all admin users
      const adminUsers = await usersCol.find({ role: 'admin' }).toArray();

      // Create notification for admin
      if (adminUsers.length > 0) {
        const representativeAdmin = adminUsers[0];
        const adminId = this.idToString(representativeAdmin._id);

        const notificationData: CreateNotificationDto = {
          user_id: adminId,
          recipient_type: RecipientType.ADMIN,
          title: `${statusIcon} Payment #${bookingCode} - ${propertyName}`,
          message: `Thanh toán của ${guestName}${
            guestEmail ? ` (${guestEmail})` : ''
          } tại ${propertyName} (${checkInDate}) đã chuyển từ "${oldPaymentStatus}" → "${newPaymentStatus}". Giá trị: ${amount.toLocaleString(
            'vi-VN',
          )}đ`,
          type: NotificationType.PAYMENT,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: bookingId,
            propertyId: this.idOptToString(
              booking.propertyId as unknown as ObjectIdLike | undefined,
            ),
            listingId: this.idOptToString(
              booking.listingId as unknown as ObjectIdLike | undefined,
            ),
            paymentStatus: newPaymentStatus,
            previousPaymentStatus: oldPaymentStatus,
            guestName,
            guestEmail,
            propertyName,
            checkInDate: booking.checkInDate,
            amount,
            bookingCode,
            allAdminEmails: adminUsers.map((a) => a.email ?? '').join(', '),
            guestPhone: guestInfo?.phone || '',
            nights: booking.nights,
            guests: booking.guests,
            checkOutDate: booking.check_out_date,
            finalAmount: booking.final_amount,
            depositPaidAmount: booking.deposit_paid_amount,
            outstandingAmount:
              (booking.final_amount || 0) - (booking.deposit_paid_amount || 0),
            bookingStatus: booking.status,
          },
        };

        await this.notificationsService.create(notificationData);
      }
    } catch (error) {
      this.logger.error(
        `Error creating admin payment status change notification: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  /**
   * Helper method to check if user is actual staff (not admin)
   */
  private async isActualStaff(userId: Types.ObjectId): Promise<boolean> {
    try {
      const userInfo = await this.bookingRepo
        .getModel()
        .db.collection<UserInfo>('users')
        .findOne({ _id: userId });

      return !!(userInfo && userInfo.role === 'staff');
    } catch (error) {
      this.logger.warn(
        `isActualStaff check failed: ${this.formatError(error)}`,
      );
      return false;
    }
  }
}

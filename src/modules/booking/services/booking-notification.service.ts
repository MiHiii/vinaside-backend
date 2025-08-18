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

interface ListingInfo {
  _id?: ObjectIdLike;
  title?: string;
  images?: string[];
  propertyId?: { name?: string } | ObjectIdLike;
}

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

interface AdminNotificationOptions {
  skipAdminNotification?: boolean;
  adminNotificationType?: 'all' | 'representative' | 'none';
}

@Injectable()
export class BookingNotificationService {
  private readonly logger = new Logger(BookingNotificationService.name);

  // Cache để tránh gửi duplicate admin notifications trong cùng 1 request
  private adminNotificationCache = new Map<string, Set<string>>();

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
    private readonly propertyService: PropertyService,
    private readonly listingService: ListingService,
    private readonly bookingRepo: BookingRepo,
  ) {}

  private idToString(
    id: Types.ObjectId | string | undefined | null,
  ): string | undefined {
    if (!id) return undefined;
    return typeof id === 'string' ? id : id.toString();
  }

  /**
   * Tạo thông báo cho khách hàng khi có booking mới
   */
  async createGuestNewBookingNotification(
    booking: Booking,
    listing: ListingInfo,
    finalAmount: number,
    user: UserInfo,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8);
      const roomName = listing.title || 'Căn hộ';

      const userIdStr =
        typeof user._id === 'string'
          ? user._id
          : (user._id as Types.ObjectId).toString();

      const createDto: CreateNotificationDto = {
        user_id: userIdStr,
        recipient_type: RecipientType.GUEST,
        title: '🎉 Đặt phòng thành công',
        message: `Chúc mừng! Bạn đã đặt phòng thành công tại ${roomName}. Tổng thanh toán: ${finalAmount.toLocaleString('vi-VN')} VNĐ. Mã đặt phòng: ${bookingCode.toUpperCase()}`,
        type: NotificationType.BOOKING,
        status: NotificationStatus.SENT,
        sent_method: [SentMethod.IN_APP, SentMethod.EMAIL],
        avatar_url:
          Array.isArray(listing.images) && listing.images.length > 0
            ? listing.images[0]
            : '',
        metadata: {
          bookingId: bookingId,
          propertyId: booking.propertyId?.toString(),
          listingId: this.idToString(listing._id),
          amount: finalAmount,
          bookingStatus: BookingStatus.PENDING,
          roomName: roomName,
          propertyName: listing.title,
          listingTitle: listing.title,
          bookingCode: bookingCode.toUpperCase(),
          checkInDate: booking.checkInDate,
          checkOutDate: booking.check_out_date,
          guests: booking.guests,
          nights: booking.nights,
          finalAmount: finalAmount,
          totalPrice: booking.total_price,
          serviceFee: booking.service_fee,
          taxAmount: booking.tax_amount,
          paymentStatus: PaymentStatus.UNPAID,
        },
      };

      await this.notificationsService.create(createDto);
    } catch (error) {
      this.logger.error(
        `Failed to create guest notification for booking ${(booking._id as Types.ObjectId).toString()}:`,
        error,
      );
    }
  }

  /**
   * Tạo thông báo cho staff khi có booking mới
   */
  async createStaffNewBookingNotification(
    propertyId: string,
    booking: Booking,
    listing: ListingInfo,
    finalAmount: number,
  ): Promise<void> {
    try {
      // Lấy danh sách staff của property từ PropertyStaffAssignmentService
      const staffAssignments =
        (await this.propertyStaffAssignmentService.getStaffByProperty(
          new Types.ObjectId(propertyId),
        )) as unknown as StaffAssignment[];

      if (staffAssignments.length === 0) {
        return;
      }

      // Get guest information for detailed notification
      const guestInfo = (await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({
          _id: booking.guestId,
        })) as unknown as Partial<UserInfo> | null;

      const checkInDate = new Date(booking.checkInDate).toLocaleDateString(
        'vi-VN',
      );
      const checkOutDate = new Date(booking.check_out_date).toLocaleDateString(
        'vi-VN',
      );
      const bookingCode = (booking._id as Types.ObjectId)
        .toString()
        .slice(-8)
        .toUpperCase();
      const guestName = guestInfo?.name || 'Khách hàng';
      const guestPhone = guestInfo?.phone || '';
      const propertyName = listing.title || 'Property';

      // Find first actual staff member to create ONE representative staff notification
      let representativeStaff: (UserInfo & { _id: ObjectIdLike }) | null = null;
      const allStaffEmails: string[] = [];

      for (const assignment of staffAssignments) {
        if (
          assignment.status === AssignmentStatus.ACTIVE &&
          assignment.staffId
        ) {
          // Check if this is actual staff, not admin
          const rawStaffId = assignment.staffId._id;
          const staffObjectId =
            typeof rawStaffId === 'string'
              ? new Types.ObjectId(rawStaffId)
              : (rawStaffId as Types.ObjectId);
          const isStaff = await this.isActualStaff(staffObjectId);

          if (isStaff) {
            const staffUser = assignment.staffId as UserInfo & {
              _id: ObjectIdLike;
            };
            const staffIdStr = this.idToString(staffUser._id)!;
            allStaffEmails.push(staffUser.email || staffIdStr);

            // Use first actual staff as representative
            if (!representativeStaff) {
              representativeStaff = staffUser;
            }
          }
        }
      }

      // Create ONE staff notification if we found any staff
      if (representativeStaff) {
        const staffIdStr = this.idToString(representativeStaff._id)!;

        const createNotificationDto: CreateNotificationDto = {
          user_id: staffIdStr,
          recipient_type: RecipientType.STAFF,
          title: `🏨 Đặt phòng mới - ${propertyName}`,
          message: `Khách hàng ${guestName}${guestPhone ? ` (${guestPhone})` : ''} đã đặt phòng từ ${checkInDate} đến ${checkOutDate}. Số khách: ${booking.guests} người. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')}đ. Mã booking: #${bookingCode}`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: (booking._id as Types.ObjectId).toString(),
            propertyId: propertyId,
            listingId: this.idToString(listing._id),
            amount: finalAmount,
            guestName,
            guestPhone,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.check_out_date,
            guests: booking.guests,
            bookingCode,
            allStaffEmails: allStaffEmails.join(', '), // Store all staff emails for reference
            propertyName: propertyName,
            listingTitle: listing.title || '',
            finalAmount: booking.final_amount,
            totalPrice: booking.total_price,
            serviceFee: booking.service_fee,
            taxAmount: booking.tax_amount,
            paymentStatus: booking.payment_status,
            nights: booking.nights,
            guestEmail: booking.guest_email || '',
          },
        };

        await this.notificationsService.create(createNotificationDto);
      }
    } catch (error) {
      this.logger.error('Error creating staff notifications:', error);
    }
  }

  /**
   * Tạo thông báo cho admin khi có booking mới
   */
  async createAdminNewBookingNotification(
    booking: Booking,
    listing: ListingInfo,
    finalAmount: number,
    options?: AdminNotificationOptions,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8).toUpperCase();

      // Get guest information for detailed notification
      const guestInfo = (await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({
          _id: booking.guestId,
        })) as unknown as Partial<UserInfo> | null;

      const checkInDate = new Date(booking.checkInDate).toLocaleDateString(
        'vi-VN',
      );
      const checkOutDate = new Date(booking.check_out_date).toLocaleDateString(
        'vi-VN',
      );
      const guestName = guestInfo?.name || 'Khách hàng';
      const guestEmail = guestInfo?.email || '';
      const guestPhone = guestInfo?.phone || '';
      const propertyName = listing.title || 'Property';

      // Check if admin notification should be skipped
      if (
        options?.skipAdminNotification ||
        options?.adminNotificationType === 'none'
      ) {
        this.logger.log(
          '[ADMIN NOTIFICATION] Skipping admin notification as requested',
        );
        return;
      }

      // Get all admin users
      const adminUsers = (await this.bookingRepo
        .getModel()
        .db.collection('users')
        .find({ role: 'admin' })
        .toArray()) as unknown as UserInfo[];

      // Create notification for admin based on type
      if (adminUsers.length > 0) {
        const notificationType =
          options?.adminNotificationType || 'representative';

        if (notificationType === 'all') {
          // Send to all admins (not recommended for performance)
          this.logger.log(
            `[ADMIN NOTIFICATION] Sending to all ${adminUsers.length} admins`,
          );
          for (const admin of adminUsers) {
            const adminId = this.idToString(admin._id)!;
            const notificationData: CreateNotificationDto = {
              user_id: adminId,
              recipient_type: RecipientType.ADMIN,
              title: `📊 Booking mới hệ thống - ${propertyName}`,
              message: `Khách hàng ${guestName}${guestEmail ? ` (${guestEmail})` : ''}${guestPhone ? ` - ${guestPhone}` : ''} đã đặt phòng từ ${checkInDate} đến ${checkOutDate}. Số khách: ${booking.guests} người. Doanh thu: ${finalAmount.toLocaleString('vi-VN')}đ. Mã: #${bookingCode}`,
              type: NotificationType.BOOKING,
              status: NotificationStatus.SENT,
              sent_method: [SentMethod.IN_APP],
              metadata: {
                bookingId: bookingId,
                propertyId: booking.propertyId?.toString(),
                listingId: this.idToString(listing._id),
                amount: finalAmount,
                bookingStatus: BookingStatus.PENDING,
                guestName,
                guestEmail,
                guestPhone,
                checkInDate: booking.checkInDate,
                checkOutDate: booking.check_out_date,
                guests: booking.guests,
                bookingCode,
                nights: booking.nights,
                allAdminEmails: adminUsers.map((a) => a.email).join(', '),
                propertyName: propertyName,
                listingTitle: listing.title || '',
                paymentStatus: booking.payment_status,
                finalAmount: booking.final_amount,
                totalPrice: booking.total_price,
                serviceFee: booking.service_fee,
                taxAmount: booking.tax_amount,
              },
            };
            await this.notificationsService.create(notificationData);
          }
        } else {
          // Send to representative admin only (default behavior)
          const representativeAdmin = adminUsers[0] as UserInfo;
          const adminId = this.idToString(representativeAdmin._id)!;

          this.logger.log(
            `[ADMIN NOTIFICATION] Sending to representative admin: ${representativeAdmin.email} (${adminId})`,
          );

          const notificationData: CreateNotificationDto = {
            user_id: adminId,
            recipient_type: RecipientType.ADMIN,
            title: `📊 Booking mới hệ thống - ${propertyName}`,
            message: `Khách hàng ${guestName}${guestEmail ? ` (${guestEmail})` : ''}${guestPhone ? ` - ${guestPhone}` : ''} đã đặt phòng từ ${checkInDate} đến ${checkOutDate}. Số khách: ${booking.guests} người. Doanh thu: ${finalAmount.toLocaleString('vi-VN')}đ. Mã: #${bookingCode}`,
            type: NotificationType.BOOKING,
            status: NotificationStatus.SENT,
            sent_method: [SentMethod.IN_APP],
            metadata: {
              bookingId: bookingId,
              propertyId: booking.propertyId?.toString(),
              listingId: this.idToString(listing._id),
              amount: finalAmount,
              bookingStatus: BookingStatus.PENDING,
              guestName,
              guestEmail,
              guestPhone,
              checkInDate: booking.checkInDate,
              checkOutDate: booking.check_out_date,
              guests: booking.guests,
              bookingCode,
              nights: booking.nights,
              allAdminEmails: adminUsers.map((a) => a.email).join(', '), // Store all admin emails for reference
              propertyName: propertyName,
              listingTitle: listing.title || '',
              paymentStatus: booking.payment_status,
              finalAmount: booking.final_amount,
              totalPrice: booking.total_price,
              serviceFee: booking.service_fee,
              taxAmount: booking.tax_amount,
            },
          };

          await this.createAdminNotificationSafely(
            bookingId,
            adminId,
            notificationData,
            'new_booking',
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Error creating admin new booking notification:',
        error,
      );
    }
  }

  /**
   * Helper method to create admin notification and avoid duplicates
   */
  private async createAdminNotificationSafely(
    bookingId: string,
    adminId: string,
    notificationData: CreateNotificationDto,
    notificationType: 'new_booking' | 'status_change' | 'summary',
  ): Promise<void> {
    const cacheKey = `${bookingId}-${notificationType}`;

    if (!this.adminNotificationCache.has(cacheKey)) {
      this.adminNotificationCache.set(cacheKey, new Set());
    }

    const processedAdmins = this.adminNotificationCache.get(cacheKey)!;

    if (processedAdmins.has(adminId)) {
      this.logger.warn(
        `[DUPLICATE PREVENTION] Skipping duplicate ${notificationType} notification for admin ${adminId} on booking ${bookingId}`,
      );
      return;
    }

    processedAdmins.add(adminId);
    await this.notificationsService.create(notificationData);

    // Clean up cache after 5 minutes to prevent memory leak
    setTimeout(
      () => {
        this.adminNotificationCache.delete(cacheKey);
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Helper method to check if user is actual staff (not admin)
   */
  private async isActualStaff(userId: Types.ObjectId): Promise<boolean> {
    try {
      const userInfo = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({ _id: userId });

      return !!(userInfo && userInfo.role === 'staff');
    } catch {
      return false;
    }
  }
}

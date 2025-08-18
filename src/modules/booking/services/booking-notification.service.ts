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

  /**
   * Tạo thông báo cho khách hàng khi có booking mới
   */
  async createGuestNewBookingNotification(
    booking: Booking,
    listing: any,
    finalAmount: number,
    user: any,
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8);
      const roomName = listing.title || listing.propertyId?.name || 'Căn hộ';

      await this.notificationsService.create({
        user_id: user._id,
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
          listingId: listing._id?.toString(),
          amount: finalAmount,
          bookingStatus: BookingStatus.PENDING,
          roomName: roomName,
          propertyName: listing.propertyId?.name,
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
      });
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
    listing: any,
    finalAmount: number,
  ): Promise<void> {
    try {
      // Lấy danh sách staff của property từ PropertyStaffAssignmentService
      const staffAssignments =
        await this.propertyStaffAssignmentService.getStaffByProperty(
          new Types.ObjectId(propertyId),
        );

      if (staffAssignments.length === 0) {
        return;
      }

      // Get guest information for detailed notification
      const guestInfo = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({ _id: booking.guestId });

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
      let representativeStaff: any = null;
      const allStaffEmails: string[] = [];

      for (const assignment of staffAssignments) {
        if (
          assignment.status === AssignmentStatus.ACTIVE &&
          assignment.staffId
        ) {
          // Check if this is actual staff, not admin
          const isStaff = await this.isActualStaff(assignment.staffId._id);

          if (isStaff) {
            const staffUser = assignment.staffId as any;
            allStaffEmails.push(staffUser.email || staffUser._id.toString());

            // Use first actual staff as representative
            if (!representativeStaff) {
              representativeStaff = staffUser;
            }
          }
        }
      }

      // Create ONE staff notification if we found any staff
      if (representativeStaff) {
        const createNotificationDto = {
          user_id: representativeStaff._id.toString(),
          recipient_type: RecipientType.STAFF,
          title: `🏨 Đặt phòng mới - ${propertyName}`,
          message: `Khách hàng ${guestName}${guestPhone ? ` (${guestPhone})` : ''} đã đặt phòng từ ${checkInDate} đến ${checkOutDate}. Số khách: ${booking.guests} người. Tổng tiền: ${finalAmount.toLocaleString('vi-VN')}đ. Mã booking: #${bookingCode}`,
          type: NotificationType.BOOKING,
          status: NotificationStatus.SENT,
          sent_method: [SentMethod.IN_APP],
          metadata: {
            bookingId: booking._id,
            propertyId: propertyId,
            listingId: listing._id,
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
    booking: any,
    listing: any,
    finalAmount: number,
    options?: {
      skipAdminNotification?: boolean;
      adminNotificationType?: 'all' | 'representative' | 'none';
    },
  ): Promise<void> {
    try {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const bookingCode = bookingId.slice(-8).toUpperCase();

      // Get guest information for detailed notification
      const guestInfo = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .findOne({ _id: booking.guestId });

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
      const adminUsers = await this.bookingRepo
        .getModel()
        .db.collection('users')
        .find({ role: 'admin' })
        .toArray();

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
            const adminId = admin._id.toString();
            const notificationData = {
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
                listingId: listing._id?.toString(),
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
                allAdminEmails: adminUsers
                  .map((admin) => admin.email)
                  .join(', '),
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
          const representativeAdmin = adminUsers[0];
          const adminId = representativeAdmin._id.toString();

          this.logger.log(
            `[ADMIN NOTIFICATION] Sending to representative admin: ${representativeAdmin.email} (${adminId})`,
          );

          const notificationData = {
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
              listingId: listing._id?.toString(),
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
              allAdminEmails: adminUsers.map((admin) => admin.email).join(', '), // Store all admin emails for reference
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
    notificationData: any,
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
    } catch (error) {
      return false;
    }
  }
}

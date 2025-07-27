import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReservationData } from './interfaces/reservation-data.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Property } from '../properties/schemas/property.schema';
import { PropertyStaffAssignmentService } from '../property-staff-assignment/property-staff-assignment.service';
import { Types } from 'mongoose';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Property.name)
    private readonly propertyStaffAssignmentService: PropertyStaffAssignmentService,
  ) {}

  /**
   * Lấy email của tất cả staff được gán cho property
   * @param propertyId ID của property
   * @returns Array of staff emails
   */
  async getStaffEmails(propertyId: string): Promise<string[]> {
    try {
      // Lấy danh sách staff assignments từ PropertyStaffAssignmentService
      const assignments =
        await this.propertyStaffAssignmentService.getStaffByProperty(
          new Types.ObjectId(propertyId),
        );

      if (assignments.length === 0) {
        return [];
      }

      // Lấy staffIds từ assignments
      const staffIds = assignments.map((assignment) => assignment.staffId);

      // Lấy email của tất cả staff
      const staffUsers = await this.userModel
        .find({
          _id: { $in: staffIds },
          role: 'staff',
          isDeleted: false,
          is_verified: true,
        })
        .select('email')
        .exec();

      return staffUsers.map((user) => user.email);
    } catch (error) {
      console.error(
        `Error getting staff emails for property ${propertyId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Gửi email xác minh tài khoản
   * @param email Email người nhận
   * @param token Token xác minh
   * @param otp OTP code
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    otp?: string,
  ): Promise<void> {
    const verifyUrl = `${this.configService.get<string>('CLIENT_URL')}/verify-email?token=${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Xác minh tài khoản Vinaside',
      template: 'verification-email',
      context: {
        name: email.split('@')[0], // Lấy tên từ email
        verifyUrl,
        otp,
        year: new Date().getFullYear(),
      },
    });
  }

  /**
   * Gửi email đặt lại mật khẩu
   * @param email Email người nhận
   * @param token Token đặt lại mật khẩu
   */
  async sendResetPasswordEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.configService.get<string>('CLIENT_URL')}/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Đặt lại mật khẩu Vinaside',
      template: 'reset-password',
      context: {
        name: email.split('@')[0],
        resetUrl,
      },
    });
  }

  /**
   * Gửi email xác nhận đặt phòng
   * @param email Email người nhận
   * @param reservationData Thông tin đặt phòng
   */
  async sendReservationConfirmation(
    email: string,
    reservationData: ReservationData,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Xác nhận đặt phòng thành công',
      template: 'reservation-confirmation',
      context: {
        name: reservationData.userName || email.split('@')[0],
        reservationId: reservationData.id,
        checkIn: reservationData.checkIn,
        checkOut: reservationData.checkOut,
        roomInfo: reservationData.roomInfo,
        totalPrice: reservationData.totalPrice,
      },
    });
  }

  /**
   * Gửi email thông báo cho nhân viên khi có đặt phòng mới
   * @param staffEmails Danh sách email nhân viên
   * @param reservationData Thông tin đặt phòng
   */
  async sendStaffReservationNotification(
    staffEmails: string[],
    reservationData: ReservationData,
  ): Promise<void> {
    // Gửi email đến tất cả nhân viên được gán
    const emailPromises = staffEmails.map(async (staffEmail) => {
      await this.mailerService.sendMail({
        to: staffEmail,
        subject: 'Có đặt phòng mới cần xử lý',
        template: 'staff-reservation-notification',
        context: {
          staffEmail,
          guestName: reservationData.userName,
          propertyName: reservationData.propertyName,
          checkIn: reservationData.checkIn,
          checkOut: reservationData.checkOut,
          totalPrice: reservationData.totalPrice,
          reservationId: reservationData.id,
        },
      });
    });

    await Promise.all(emailPromises);
  }

  /**
   * Gửi email thông báo chung
   * @param to Email người nhận
   * @param subject Tiêu đề email
   * @param template Tên template
   * @param context Dữ liệu cho template
   */
  async sendEmail<T extends Record<string, any>>(
    to: string,
    subject: string,
    template: string,
    context: T,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
    });
  }

  /**
   * Gửi thông báo đến tất cả staff của một property
   * @param propertyId ID của property
   * @param reservationData Dữ liệu đặt phòng
   */
  async sendStaffNotificationByProperty(
    propertyId: string,
    reservationData: ReservationData,
  ): Promise<void> {
    const staffEmails = await this.getStaffEmails(propertyId);

    if (staffEmails.length > 0) {
      await this.sendStaffReservationNotification(staffEmails, reservationData);
    }
  }
}

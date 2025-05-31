import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { ReservationData } from './interfaces/reservation-data.interface';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

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
   * Gửi email thông báo cho chủ nhà khi có đặt phòng mới
   * @param hostEmail Email chủ nhà
   * @param reservationData Thông tin đặt phòng
   */
  async sendHostReservationNotification(
    hostEmail: string,
    reservationData: ReservationData,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: hostEmail,
      subject: 'Có đặt phòng mới',
      template: 'host-reservation-notification',
      context: {
        hostName: reservationData.hostName,
        guestName: reservationData.userName,
        propertyName: reservationData.propertyName,
        checkIn: reservationData.checkIn,
        checkOut: reservationData.checkOut,
        totalPrice: reservationData.totalPrice,
      },
    });
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
}

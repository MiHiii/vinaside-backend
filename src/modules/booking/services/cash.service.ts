import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  PaymentServiceInterface,
  PaymentResponse,
  CreatePaymentRequest,
  PaymentVerificationResult,
} from '../interfaces/payment-service.interface';
import {
  PaymentMethod,
  PaymentProvider,
} from '../../transactions/schemas/transaction.schema';
import { BookingRepo } from '../booking.repo';

@Injectable()
export class CashService extends PaymentServiceInterface {
  private readonly logger = new Logger(CashService.name);

  constructor(private readonly bookingRepo: BookingRepo) {
    super();
  }

  getPaymentMethod(): PaymentMethod {
    return PaymentMethod.CASH;
  }

  getPaymentProvider(): PaymentProvider {
    return PaymentProvider.INTERNAL;
  }

  handleCallback(): Promise<PaymentVerificationResult> {
    // Không áp dụng cho tiền mặt
    return Promise.resolve({
      success: true,
      paymentMethod: PaymentMethod.CASH,
      bookingId: '',
      orderId: '',
      amount: 0,
      transactionId: '',
      message: 'Cash payment callback not applicable',
    });
  }

  handleIPN(): Promise<{ success: boolean; message: string }> {
    // Không áp dụng cho tiền mặt
    return Promise.resolve({ success: true, message: 'No IPN for cash' });
  }

  async createPaymentUrl(
    request: CreatePaymentRequest & { note?: string },
  ): Promise<PaymentResponse> {
    const { bookingId, amount } = request;
    const note = request.note;
    this.logger.log(
      `Creating cash payment for booking ${bookingId}, amount: ${amount}`,
    );

    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Cập nhật trạng thái booking sang paid
    await this.bookingRepo.updateById(
      bookingId,
        {
          payment_method: 'cash',
        payment_status: 'paid',
        deposit_paid_amount: (booking.deposit_paid_amount || 0) + amount,
        paid_at: new Date(),
        note: note || undefined,
      },
      booking.guestId?.toString() || '',
    );

    this.logger.log(`Cash payment confirmed for booking ${bookingId}`);

    return {
      success: true,
      paymentMethod: PaymentMethod.CASH,
      paymentUrl: undefined,
      orderId: `CASH_${Date.now()}`,
      amount: amount,
      message: 'Thanh toán tiền mặt đã được xác nhận',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  getPaymentStatus(orderId: string) {
    return Promise.resolve({
      success: true,
      paymentMethod: PaymentMethod.CASH,
      bookingId: orderId.replace('CASH_', ''),
      orderId,
      paymentStatus: 'paid',
      amount: 0,
      gatewayTransactionId: undefined,
      paidAt: new Date(),
      metadata: {},
      transactionId: orderId,
      message: 'Thanh toán tiền mặt đã được xác nhận',
    });
  }

  isValidSignature(): boolean {
    return true;
  }
}

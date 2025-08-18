import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingRepo } from '../booking.repo';
import { VNPayUtil, VNPayParams } from '../utils/vnpay.util';
import {
  // CreateVNPayPaymentDto,
  // VNPayPaymentResponseDto,
  VNPayCallbackDto,
  // VNPayVerificationResponseDto,
} from '../dto/vnpay-payment.dto';
import { PaymentStatus } from '../schemas/booking.schema';
import {
  PaymentMethod,
  PaymentProvider,
  TransactionType,
  TransactionDirection,
  ReferenceType,
} from '../../transactions/schemas/transaction.schema';
import { TransactionsService } from '../../transactions/services/transactions.service';
import { Types } from 'mongoose';
import { Booking } from '../schemas/booking.schema';
import {
  PaymentServiceInterface,
  PaymentResponse,
  PaymentVerificationResult,
  CreatePaymentRequest,
} from '../interfaces/payment-service.interface';

@Injectable()
export class VNPayService extends PaymentServiceInterface {
  private readonly logger = new Logger(VNPayService.name);

  private readonly vnpTmnCode: string;
  private readonly vnpHashSecret: string;
  private readonly vnpPaymentUrl: string;
  private readonly vnpVersion: string;
  private readonly vnpCommand: string;
  private readonly vnpCurrCode: string;
  private readonly clientUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly bookingRepo: BookingRepo,
    private readonly transactionsService: TransactionsService,
  ) {
    super();
    this.vnpTmnCode = this.configService.get<string>('VNP_TMNCODE') || '';
    this.vnpHashSecret =
      this.configService.get<string>('VNP_HASH_SECRET') || '';
    this.vnpPaymentUrl =
      this.configService.get<string>('VNP_PAYMENT_URL') || '';
    this.vnpVersion = this.configService.get<string>('VNP_VERSION', '2.1.0');
    this.vnpCommand = this.configService.get<string>('VNP_COMMAND', 'pay');
    this.vnpCurrCode = this.configService.get<string>('VNP_CURR_CODE', 'VND');
    this.clientUrl = this.configService.get<string>('CLIENT_URL') || '';

    // Validate required config
    if (!this.vnpTmnCode || !this.vnpHashSecret || !this.vnpPaymentUrl) {
      throw new Error('Missing required VNPay configuration');
    }
  }

  getPaymentMethod(): PaymentMethod {
    return PaymentMethod.VNPAY;
  }

  getPaymentProvider(): PaymentProvider {
    return PaymentProvider.VNPAY;
  }

  /**
   * Tạo URL thanh toán VNPay (implement interface)
   */
  async createPaymentUrl(
    request: CreatePaymentRequest,
  ): Promise<PaymentResponse> {
    const { bookingId, description, paymentType } = request;

    // Lấy thông tin booking
    const booking = (await this.bookingRepo.findById(bookingId)) as Booking;
    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking với ID ${bookingId}`);
    }

    // Kiểm tra trạng thái booking
    if (booking.payment_status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Booking này đã được hoàn tiền');
    }

    // Kiểm tra FAILED status - cho phép thanh toán lại nhưng cần reset trạng thái
    if (booking.payment_status === PaymentStatus.FAILED) {
      this.logger.log(
        `[VNPay] Booking ${bookingId} có trạng thái FAILED, cho phép thanh toán lại`,
      );

      // Reset trạng thái về UNPAID để tránh race condition
      await this.bookingRepo.updateById(
        bookingId,
        {
          payment_status: PaymentStatus.UNPAID,
          vnpay_response_code: null,
          vnpay_transaction_no: null,
          vnpay_bank_tran_no: null,
          vnpay_card_type: null,
          vnpay_pay_date: null,
          payment_id: null,
        },
        booking.guestId?.toString() || '',
      );

      // Lấy booking đã được cập nhật
      const updatedBooking = (await this.bookingRepo.findById(
        bookingId,
      )) as Booking;
      if (!updatedBooking) {
        throw new NotFoundException(
          `Không tìm thấy booking với ID ${bookingId} sau khi reset`,
        );
      }
    }

    // Kiểm tra PAID và PARTIALLY_PAID status - chỉ cho phép thanh toán nếu có outstanding amount
    if (
      booking.payment_status === PaymentStatus.PAID ||
      booking.payment_status === PaymentStatus.PARTIALLY_PAID
    ) {
      const depositPaidAmount = booking.deposit_paid_amount || 0;
      const outstandingAmount = booking.final_amount - depositPaidAmount;

      if (outstandingAmount <= 0) {
        throw new BadRequestException('Booking này đã được thanh toán');
      }
    }

    // Tính số tiền cần thanh toán
    let amountToPay: number;

    if (request.amount && request.amount > 0) {
      // Sử dụng số tiền được chỉ định (cho trường hợp thanh toán phần còn lại)
      amountToPay = request.amount;
    } else {
      // Tính toán theo logic cũ cho trường hợp tạo booking mới
      amountToPay = booking.final_amount;
      const roomTotal = booking.price_per_night * booking.nights;
      const servicesAmount = booking.services_total_amount || 0;
      const subtotalAmount = roomTotal + servicesAmount;

      // Tính discount từ voucher
      const voucherDiscount = booking.voucher_discount_percent
        ? Math.round((subtotalAmount * booking.voucher_discount_percent) / 100)
        : 0;
      const amountAfterDiscount = subtotalAmount - voucherDiscount;

      // Tính phí và thuế dựa trên amountAfterDiscount (sau khi trừ voucher) - nhất quán với booking.service.ts
      const serviceFee = Math.round(amountAfterDiscount * 0.1);
      const tax = Math.round(amountAfterDiscount * 0.08);
      const baseTotal = amountAfterDiscount + serviceFee + tax;

      if (paymentType === 'deposit') {
        // Lần 1: 50% tổng tiền (giá phòng + dịch vụ + phí + thuế - voucher)
        amountToPay = Math.round(baseTotal * 0.5);
      } else if (paymentType === 'remaining') {
        // Lần 2: Số tiền còn lại thực tế (không phải 50%)
        const depositPaidAmount = booking.deposit_paid_amount || 0;
        amountToPay = Math.round(baseTotal - depositPaidAmount);
        if (amountToPay <= 0) {
          throw new BadRequestException('Không còn số tiền nào cần thanh toán');
        }
      }
    }
    // Nếu cần, có thể cập nhật booking để bỏ dịch vụ/voucher ở đây

    // Tạo order ID unique
    const orderId = VNPayUtil.generateOrderId(bookingId);
    const createDate = VNPayUtil.formatDate(new Date());
    const amount = VNPayUtil.formatAmount(amountToPay);

    // Debug: Log amount information
    this.logger.log(`Original amountToPay: ${amountToPay}`);
    this.logger.log(`Formatted amount for VNPay: ${amount}`);

    // Tạo parameters cho VNPay (chỉ những parameters cần thiết như official code)
    const vnpParams: VNPayParams = {
      vnp_Version: this.vnpVersion,
      vnp_Command: this.vnpCommand,
      vnp_TmnCode: this.vnpTmnCode,
      vnp_Amount: amount,
      vnp_CurrCode: this.vnpCurrCode,
      vnp_TxnRef: orderId,
      vnp_OrderInfo: description || `Thanh toan booking ${String(booking._id)}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: 'http://localhost:5173/payment/return',
      vnp_IpAddr: '127.0.0.1', // Sẽ được cập nhật từ request IP
      vnp_CreateDate: createDate,
    };

    // Debug: Log parameters trước khi tạo hash
    this.logger.debug('VNPay Parameters:', JSON.stringify(vnpParams, null, 2));
    this.logger.debug(
      'Return URL from config:',
      this.configService.get<string>('VNP_RETURN_URL'),
    );
    this.logger.debug('Final Return URL:', vnpParams.vnp_ReturnUrl);

    // Tạo secure hash với debug
    const debugResult = VNPayUtil.createSecureHashWithDebug(
      vnpParams,
      this.vnpHashSecret,
    );
    const secureHash = debugResult.hash;

    this.logger.debug('VNPay Debug Info:', debugResult.debug);

    // Debug: Log secure hash
    this.logger.debug('VNPay Secure Hash:', secureHash);

    vnpParams.vnp_SecureHash = secureHash;

    // Tạo payment URL
    const paymentUrl = VNPayUtil.createPaymentUrl(
      this.vnpPaymentUrl,
      vnpParams,
    );

    // Cập nhật booking với VNPay order ID
    await this.bookingRepo.updateById(
      bookingId,
      {
        vnpay_order_id: orderId,
        payment_method: 'vnpay',
      },
      booking.guestId?.toString() || '',
    );

    // Tạo transaction record
    const transaction = await this.transactionsService.createTransaction({
      type: TransactionType.PAYMENT,
      propertyId: booking.propertyId?.toString(),
      reference_id: bookingId,
      reference_type: ReferenceType.BOOKING,
      user_id: booking.guestId?.toString() || '',
      direction: TransactionDirection.IN,
      amount: amountToPay, // Use amountToPay for transaction amount
      currency: 'VND',
      method: PaymentMethod.VNPAY,
      provider: PaymentProvider.VNPAY,
      provider_order_id: orderId,
      note: `VNPay payment for booking ${bookingId}`,
      created_by: booking.guestId?.toString() || '',
    });

    this.logger.log(
      `Created VNPay payment URL for booking ${bookingId}, order ID: ${orderId}, transaction ID: ${(transaction._id as Types.ObjectId).toString()}`,
    );

    return {
      success: true,
      paymentMethod: PaymentMethod.VNPAY,
      paymentUrl,
      orderId,
      amount: amountToPay,
      message: 'Tạo URL thanh toán VNPay thành công',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };
  }

  /**
   * Xử lý callback từ VNPay (implement interface)
   */
  async handleCallback(
    callbackData: VNPayCallbackDto,
  ): Promise<PaymentVerificationResult> {
    // paidAt sẽ được khai báo const trong từng nhánh bên dưới
    let bookingId: string = '';
    let vnpayAmount: number = 0;
    try {
      // Log mỗi lần return được gọi
      bookingId = VNPayUtil.extractBookingId(callbackData.vnp_TxnRef);
      this.logger.log(
        `[VNPay RETURN][START] bookingId: ${bookingId}, vnp_Amount: ${callbackData.vnp_Amount}, vnp_ResponseCode: ${callbackData.vnp_ResponseCode}`,
      );
      // Kiểm tra responseCode, chỉ xử lý khi thành công
      if (callbackData.vnp_ResponseCode !== '00') {
        this.logger.error(
          `[VNPay RETURN] Giao dịch thất bại (responseCode: ${callbackData.vnp_ResponseCode}), cập nhật trạng thái booking thành FAILED.`,
        );

        // Cập nhật trạng thái booking thành FAILED khi thanh toán thất bại
        await this.bookingRepo.updateById(bookingId, {
          payment_status: PaymentStatus.FAILED,
          vnpay_response_code: callbackData.vnp_ResponseCode,
        });

        return {
          success: false,
          paymentMethod: PaymentMethod.VNPAY,
          bookingId,
          orderId: callbackData.vnp_TxnRef,
          amount: 0,
          transactionId: '',
          message: 'Giao dịch thất bại',
          metadata: {
            responseCode: callbackData.vnp_ResponseCode,
          },
        };
      }
      // Xác thực secure hash
      this.logger.log(`[VNPay RETURN] Received callback data:`, callbackData);
      this.logger.log(
        `[VNPay RETURN] Secure hash from VNPay: ${callbackData.vnp_SecureHash}`,
      );
      this.logger.log(`[VNPay RETURN] Hash secret key: ${this.vnpHashSecret}`);

      // Trong môi trường development, có thể bypass việc kiểm tra hash
      const isDevelopment = process.env.NODE_ENV === 'development';
      let isValidSignature = true;

      if (!isDevelopment) {
        isValidSignature = VNPayUtil.verifySecureHash(
          callbackData as unknown as VNPayParams,
          callbackData.vnp_SecureHash,
          this.vnpHashSecret,
        );
      } else {
        this.logger.warn(
          `[VNPay RETURN] Development mode: Bypassing hash verification`,
        );
      }

      this.logger.log(`[VNPay RETURN] isValidSignature: ${isValidSignature}`);
      if (!isValidSignature) {
        this.logger.error(
          `[VNPay RETURN] Sai chữ ký hash cho bookingId: ${bookingId}`,
        );
        return {
          success: false,
          paymentMethod: PaymentMethod.VNPAY,
          bookingId,
          orderId: callbackData.vnp_TxnRef,
          amount: 0,
          transactionId: '',
          message: 'Sai chữ ký hash',
          metadata: {
            responseCode: callbackData.vnp_ResponseCode,
          },
        };
      }
      // Lấy thông tin booking
      const booking = (await this.bookingRepo.findById(bookingId)) as Booking;
      if (!booking) {
        this.logger.error(
          `[VNPay RETURN] Không tìm thấy booking: ${bookingId}`,
        );
        return {
          success: false,
          paymentMethod: PaymentMethod.VNPAY,
          bookingId,
          orderId: callbackData.vnp_TxnRef,
          amount: 0,
          transactionId: '',
          message: 'Không tìm thấy booking',
          metadata: {
            responseCode: callbackData.vnp_ResponseCode,
          },
        };
      }
      // Parse amount từ VNPay
      vnpayAmount = VNPayUtil.parseAmount(callbackData.vnp_Amount);
      // Kiểm tra idempotency: Chỉ bỏ qua nếu đây là callback lặp lại của cùng một transaction
      // Cho phép thanh toán lại với transaction mới
      if (booking.vnpay_transaction_no === callbackData.vnp_TransactionNo) {
        this.logger.warn(
          `[VNPay RETURN] Giao dịch đã xử lý, bỏ qua callback lặp lại.`,
        );
        return {
          success: true,
          paymentMethod: PaymentMethod.VNPAY,
          bookingId,
          orderId: callbackData.vnp_TxnRef,
          amount: 0,
          transactionId: callbackData.vnp_TransactionNo,
          message: 'Giao dịch đã xử lý',
          metadata: {},
        };
      }
      // Xác định số tiền mong đợi
      const depositPaidAmount =
        booking.deposit_paid_amount || booking.deposit_amount || 0;
      const remainingAmount = booking.final_amount - depositPaidAmount;
      this.logger.log(
        `[VNPay LOG] bookingId: ${bookingId}, vnpayAmount: ${vnpayAmount}, final_amount: ${booking.final_amount}, deposit_paid_amount: ${booking.deposit_paid_amount}, deposit_amount: ${booking.deposit_amount}, remainingAmount: ${remainingAmount}, payment_status: ${booking.payment_status}`,
      );
      // Cộng dồn số tiền đã trả bằng cách tính toán thủ công
      const currentDepositPaidAmount = booking.deposit_paid_amount || 0;
      const newDepositPaidAmount = currentDepositPaidAmount + vnpayAmount;

      this.logger.log(
        `[VNPay LOG] Cập nhật deposit_paid_amount: ${currentDepositPaidAmount} + ${vnpayAmount} = ${newDepositPaidAmount}`,
      );

      await this.bookingRepo.updateById(bookingId, {
        deposit_paid_amount: newDepositPaidAmount,
      });

      // Lấy booking mới nhất
      const updatedBooking = await this.bookingRepo.findById(bookingId);
      if (!updatedBooking) {
        this.logger.error(
          `[VNPay LOG] Không tìm thấy booking sau khi cộng dồn.`,
        );
        return {
          success: false,
          paymentMethod: PaymentMethod.VNPAY,
          bookingId,
          orderId: callbackData.vnp_TxnRef,
          amount: vnpayAmount,
          transactionId: callbackData.vnp_TransactionNo,
          message: 'Không tìm thấy booking sau khi cộng dồn',
          metadata: {
            responseCode: callbackData.vnp_ResponseCode,
          },
        };
      }

      this.logger.log(
        `[VNPay LOG] Sau khi cập nhật: deposit_paid_amount = ${updatedBooking.deposit_paid_amount}, payment_status = ${updatedBooking.payment_status}`,
      );
      if (
        (updatedBooking.deposit_paid_amount ?? 0) >=
        (updatedBooking.final_amount ?? 0)
      ) {
        this.logger.log(
          `[VNPay LOG] bookingId: ${bookingId} vào nhánh ĐÃ TRẢ ĐỦ (cộng dồn)`,
        );
        await this.bookingRepo.updateById(bookingId, {
          payment_status: PaymentStatus.PAID,
          deposit_paid: true,
          // Không ghi đè deposit_paid_amount vì đã cộng dồn ở trên
          vnpay_transaction_no: callbackData.vnp_TransactionNo,
          vnpay_bank_tran_no: callbackData.vnp_BankTranNo,
          vnpay_card_type: callbackData.vnp_CardType,
          vnpay_pay_date: this.parseVNPayDate(callbackData.vnp_PayDate),
          vnpay_response_code: callbackData.vnp_ResponseCode,
          payment_id: callbackData.vnp_TransactionNo,
          // Giữ nguyên status PENDING để admin xác nhận lại
          // status: BookingStatus.CONFIRMED, // Commented out - để admin xác nhận
        });
        const finalBooking = await this.bookingRepo.findById(bookingId);
        this.logger.log(
          `[VNPay LOG][SAU UPDATE] bookingId: ${bookingId}, payment_status: ${finalBooking?.payment_status}, deposit_paid: ${finalBooking?.deposit_paid}, deposit_paid_amount: ${finalBooking?.deposit_paid_amount}`,
        );
        return {
          success: true,
          paymentMethod: PaymentMethod.VNPAY,
          bookingId,
          orderId: callbackData.vnp_TxnRef,
          amount: vnpayAmount,
          transactionId: callbackData.vnp_TransactionNo,
          gatewayTransactionId: callbackData.vnp_TransactionNo,
          paidAt: this.parseVNPayDate(callbackData.vnp_PayDate),
          message: 'Thanh toán thành công',
          metadata: {
            bankTranNo: callbackData.vnp_BankTranNo,
            cardType: callbackData.vnp_CardType,
            responseCode: callbackData.vnp_ResponseCode,
          },
        };
      } else {
        this.logger.log(
          `[VNPay LOG] bookingId: ${bookingId} vào nhánh CHƯA ĐỦ (cộng dồn)`,
        );
        await this.bookingRepo.updateById(bookingId, {
          payment_status: PaymentStatus.PARTIALLY_PAID,
          deposit_paid: true,
          // deposit_paid_amount đã cộng dồn ở trên
          vnpay_transaction_no: callbackData.vnp_TransactionNo,
          vnpay_bank_tran_no: callbackData.vnp_BankTranNo,
          vnpay_card_type: callbackData.vnp_CardType,
          vnpay_pay_date: this.parseVNPayDate(callbackData.vnp_PayDate),
          vnpay_response_code: callbackData.vnp_ResponseCode,
          payment_id: callbackData.vnp_TransactionNo,
          // Giữ nguyên status PENDING để admin xác nhận lại
          // status: BookingStatus.CONFIRMED, // Commented out - để admin xác nhận
        });
        const finalBooking = await this.bookingRepo.findById(bookingId);
        this.logger.log(
          `[VNPay LOG][SAU UPDATE] bookingId: ${bookingId}, payment_status: ${finalBooking?.payment_status}, deposit_paid: ${finalBooking?.deposit_paid}, deposit_paid_amount: ${finalBooking?.deposit_paid_amount}`,
        );
        return {
          success: true,
          paymentMethod: PaymentMethod.VNPAY,
          bookingId,
          orderId: callbackData.vnp_TxnRef,
          amount: vnpayAmount,
          transactionId: callbackData.vnp_TransactionNo,
          gatewayTransactionId: callbackData.vnp_TransactionNo,
          paidAt: this.parseVNPayDate(callbackData.vnp_PayDate),
          message: 'Thanh toán thành công',
          metadata: {
            bankTranNo: callbackData.vnp_BankTranNo,
            cardType: callbackData.vnp_CardType,
            responseCode: callbackData.vnp_ResponseCode,
          },
        };
      }
    } catch (error) {
      this.logger.error('[VNPay RETURN] Lỗi xử lý callback', error);
      return {
        success: false,
        paymentMethod: PaymentMethod.VNPAY,
        bookingId: '',
        orderId: '',
        amount: 0,
        transactionId: '',
        message: 'Lỗi không xác định',
      };
    }
    // Trả về trạng thái booking mới nhất
    const updatedBooking = await this.bookingRepo.findById(bookingId);
    this.logger.log(
      `[VNPay RETURN][END] bookingId: ${bookingId}, payment_status: ${updatedBooking?.payment_status}, deposit_paid: ${updatedBooking?.deposit_paid}, final_amount: ${updatedBooking?.final_amount}`,
    );
    return {
      success: true,
      paymentMethod: PaymentMethod.VNPAY,
      bookingId,
      orderId: callbackData.vnp_TxnRef,
      amount: vnpayAmount,
      transactionId: callbackData.vnp_TransactionNo,
      gatewayTransactionId: callbackData.vnp_TransactionNo,
      paidAt: this.parseVNPayDate(callbackData.vnp_PayDate),
      message: 'Thanh toán thành công',
      metadata: {
        bankTranNo: callbackData.vnp_BankTranNo,
        cardType: callbackData.vnp_CardType,
        responseCode: callbackData.vnp_ResponseCode,
      },
    };
  }

  /**
   * Xử lý IPN (implement interface)
   */
  async handleIPN(
    callbackData: VNPayCallbackDto,
  ): Promise<{ success: boolean; message: string }> {
    let bookingId: string | undefined;
    try {
      bookingId = VNPayUtil.extractBookingId(callbackData.vnp_TxnRef);
      this.logger.log(
        `[VNPay IPN][START] bookingId: ${bookingId}, vnp_Amount: ${callbackData.vnp_Amount}, vnp_ResponseCode: ${callbackData.vnp_ResponseCode}`,
      );
      // Chỉ log lại, không cập nhật trạng thái booking
      return { success: true, message: 'IPN received (no-op)' };
    } catch (error) {
      this.logger.error('[VNPay IPN] Error handling VNPay IPN', error);
      return { success: false, message: 'Unknown error' };
    } finally {
      if (bookingId) {
        const updatedBooking = await this.bookingRepo.findById(bookingId);
        this.logger.log(
          `[VNPay IPN][END] bookingId: ${bookingId}, payment_status: ${updatedBooking?.payment_status}, deposit_paid: ${updatedBooking?.deposit_paid}, final_amount: ${updatedBooking?.final_amount}`,
        );
      }
    }
  }

  /**
   * Lấy trạng thái thanh toán (implement interface)
   */
  async getPaymentStatus(orderId: string): Promise<PaymentVerificationResult> {
    const bookingId = VNPayUtil.extractBookingId(orderId);
    const booking = (await this.bookingRepo.findById(bookingId)) as Booking;

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking với ID ${bookingId}`);
    }

    const isSuccess = booking.payment_status === PaymentStatus.PAID;

    return {
      success: isSuccess,
      paymentMethod: PaymentMethod.VNPAY,
      bookingId,
      orderId,
      amount: booking.final_amount,
      transactionId: booking.vnpay_transaction_no || '',
      gatewayTransactionId: booking.vnpay_transaction_no,
      paidAt: booking.vnpay_pay_date,
      message: isSuccess ? 'Thanh toán thành công' : 'Chưa thanh toán',
      metadata: {
        bankTranNo: booking.vnpay_bank_tran_no,
        cardType: booking.vnpay_card_type,
        responseCode: booking.vnpay_response_code,
      },
    };
  }

  /**
   * Validate signature (implement interface)
   */
  isValidSignature(data: VNPayCallbackDto, signature: string): boolean {
    return VNPayUtil.verifySecureHash(
      data as unknown as VNPayParams,
      signature,
      this.vnpHashSecret,
    );
  }

  /**
   * Xử lý trường hợp người dùng bấm back từ trang VNPay
   */
  async handleUserCancellation(
    orderId: string,
  ): Promise<PaymentVerificationResult> {
    const bookingId = VNPayUtil.extractBookingId(orderId);

    this.logger.log(
      `[VNPay CANCELLATION] User cancelled payment for bookingId: ${bookingId}`,
    );

    // Cập nhật trạng thái booking thành FAILED
    await this.bookingRepo.updateById(
      bookingId,
      {
        payment_status: PaymentStatus.FAILED,
        vnpay_response_code: 'USER_CANCELLED',
      },
      '',
    );

    return {
      success: false,
      paymentMethod: PaymentMethod.VNPAY,
      bookingId,
      orderId,
      amount: 0,
      transactionId: '',
      message: 'Người dùng đã hủy giao dịch thanh toán',
      metadata: {
        responseCode: 'USER_CANCELLED',
      },
    };
  }

  /**
   * Parse VNPay date format (yyyyMMddHHmmss) to Date
   */
  private parseVNPayDate(vnpayDate: string): Date {
    const year = parseInt(vnpayDate.substring(0, 4));
    const month = parseInt(vnpayDate.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(vnpayDate.substring(6, 8));
    const hour = parseInt(vnpayDate.substring(8, 10));
    const minute = parseInt(vnpayDate.substring(10, 12));
    const second = parseInt(vnpayDate.substring(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }
}

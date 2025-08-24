# Staff Payment Endpoint Fix

## Vấn đề

Endpoint `POST /bookings/:id/payment/staff` bị lỗi "returnUrl must be a URL address" khi admin/staff tạo payment URL.

## Nguyên nhân

1. **Logic sai**: Endpoint không sử dụng `bookingService.createStaffRemainingPayment()`
2. **Thiếu propertyId**: Endpoint không có propertyId trong URL hoặc request body
3. **Permission sai**: Sử dụng `booking.create` thay vì `booking.update`
4. **Thiếu user context**: Không có `req.user` parameter

## Giải pháp

### 1. Sửa Controller Logic

**Trước:**

```typescript
@Post(':id/payment/staff')
@RequirePermission('booking.create') // ❌ Sai permission
async createPaymentForStaff(
  @Param('id') bookingId: string,
  @Body() createPaymentDto: CreatePaymentDto, // ❌ Không có user context
): Promise<PaymentResponseDto> {
  // ❌ Logic sai - gọi trực tiếp payment service
  const paymentService = this.paymentFactory.getPaymentService(
    createPaymentDto.paymentMethod,
  );
  const result = await paymentService.createPaymentUrl(request);
  return result;
}
```

**Sau:**

```typescript
@Post(':id/payment/staff')
@RequirePermission('booking.update') // ✅ Đúng permission
async createPaymentForStaff(
  @Param('id') bookingId: string,
  @Body() createPaymentDto: CreatePaymentDto,
  @Request() req: RequestWithUser, // ✅ Có user context
): Promise<PaymentResponseDto> {
  // ✅ Yêu cầu propertyId
  if (!createPaymentDto.propertyId) {
    throw new BadRequestException('propertyId là bắt buộc cho staff payment');
  }

  // ✅ Sử dụng logic đã có sẵn
  return await this.bookingService.createStaffRemainingPayment(
    createPaymentDto.propertyId,
    bookingId,
    createPaymentDto,
    req.user as any as JwtPayload,
  );
}
```

### 2. Thêm propertyId vào DTO

```typescript
export class CreatePaymentDto {
  // ... existing fields

  @ApiProperty({
    description: 'ID của property (cần thiết cho staff payment)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsString()
  propertyId?: string;
}
```

## Cách sử dụng

### Frontend Code

```javascript
// Tạo payment URL cho staff
const createStaffPayment = async (bookingId, propertyId) => {
  try {
    const paymentResponse = await api.post(
      `/bookings/${bookingId}/payment/staff`,
      {
        paymentMethod: 'vnpay',
        propertyId: propertyId, // ✅ Bắt buộc
        returnUrl: `${window.location.origin}/admin/bookings?payment=success&bookingId=${bookingId}`,
        cancelUrl: `${window.location.origin}/admin/bookings?payment=cancel&bookingId=${bookingId}`,
        note: 'Admin tạo booking với VNPay',
      },
    );

    const paymentUrl =
      paymentResponse.data?.data?.paymentUrl ||
      paymentResponse.data?.paymentUrl;
    if (paymentUrl) {
      window.location.href = paymentUrl;
    }
  } catch (error) {
    console.error('Error creating payment:', error);
  }
};
```

### cURL Example

```bash
curl -X POST \
  http://localhost:3000/api/v1/bookings/bookingId/payment/staff \
  -H 'Authorization: Bearer your_jwt_token' \
  -H 'Content-Type: application/json' \
  -d '{
    "paymentMethod": "vnpay",
    "propertyId": "propertyId",
    "amount": 500000,
    "returnUrl": "http://localhost:5173/admin/bookings?payment=success",
    "cancelUrl": "http://localhost:5173/admin/bookings?payment=cancel",
    "note": "Admin tạo booking với VNPay"
  }'
```

## Files Modified

### `src/modules/booking/booking.controller.ts`

- Sửa permission từ `booking.create` thành `booking.update`
- Thêm `req.user` parameter
- Sử dụng `bookingService.createStaffRemainingPayment()`
- Yêu cầu `propertyId` trong request body

### `src/modules/booking/dto/payment.dto.ts`

- Thêm field `propertyId` vào `CreatePaymentDto`

### `test/staff-payment-fix.test.http`

- Test cases cho endpoint đã sửa

## Validation

- ✅ `propertyId` là bắt buộc
- ✅ User phải có permission `booking.update`
- ✅ Booking phải tồn tại
- ✅ Staff phải có quyền access property

## Expected Results

- ✅ Không còn lỗi "returnUrl must be a URL address"
- ✅ Payment URL được tạo thành công
- ✅ Hỗ trợ cả VNPay và MoMo
- ✅ Return URL sử dụng config đúng

## Testing

Sử dụng test file `test/staff-payment-fix.test.http`:

1. **Test với propertyId** - Should succeed
2. **Test không có propertyId** - Should fail
3. **Test với MoMo** - Should succeed

## Related Issues

- **VNPay Return URL**: Đã fix trong `docs/VNPAY_RETURN_URL_FIX.md`
- **Staff Payment**: Endpoint này sử dụng logic đã fix
- **Permission Control**: Đảm bảo staff chỉ access property được assign

## Impact

- ✅ Admin/Staff có thể tạo payment URL thành công
- ✅ Không còn lỗi returnUrl
- ✅ Consistent với endpoint `payment/remaining/staff`
- ✅ Proper validation và error handling

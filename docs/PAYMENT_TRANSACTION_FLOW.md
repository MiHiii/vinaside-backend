# Payment Transaction Flow Documentation

## 🔄 Transaction Creation Timeline

### **1. Khi tạo Payment URL**

**Thời điểm:** User gọi `POST /bookings/:id/payment/vnpay`

```typescript
// ✅ Tự động tạo Transaction record
{
  type: 'payment',           // TransactionType.PAYMENT
  direction: 'in',           // TransactionDirection.IN (tiền vào)
  status: 'pending',         // TransactionStatus.PENDING
  method: 'vnpay',          // PaymentMethod.VNPAY
  provider: 'vnpay',        // PaymentProvider.VNPAY
  reference_type: 'booking', // ReferenceType.BOOKING
  reference_id: 'booking_id',
  user_id: 'guest_id',
  amount: 2500000,          // Số tiền từ booking
  provider_order_id: 'booking_123_1703123456789',
  note: 'VNPay payment for booking 123'
}

// ✅ Tự động tạo TransactionLog
{
  transaction_id: 'transaction_id',
  from_status: null,        // Lần đầu tạo
  to_status: 'pending',
  changed_by: 'system',     // ChangedBy.SYSTEM
  note: 'Transaction created'
}
```

### **2. Khi nhận VNPay Callback Success**

**Thời điểm:** VNPay gọi callback về hệ thống với kết quả thành công

```typescript
// ✅ Tự động update Transaction
{
  status: 'success',        // TransactionStatus.SUCCESS
  provider_transaction_id: 'vnpay_txn_14073556',
  raw_response: { /* VNPay callback data */ }
}

// ✅ Tự động tạo TransactionLog
{
  transaction_id: 'transaction_id',
  from_status: 'pending',
  to_status: 'success',
  changed_by: 'system',     // ChangedBy.SYSTEM
  note: 'VNPay callback: Giao dịch thành công',
  metadata: {
    vnpay_response_code: '00',
    vnpay_transaction_no: '14073556'
  }
}
```

### **3. Khi nhận VNPay Callback Failed**

**Thời điểm:** VNPay gọi callback về hệ thống với kết quả thất bại

```typescript
// ✅ Tự động update Transaction
{
  status: 'failed',         // TransactionStatus.FAILED
  raw_response: { /* VNPay callback data */ }
}

// ✅ Tự động tạo TransactionLog
{
  transaction_id: 'transaction_id',
  from_status: 'pending',
  to_status: 'failed',
  changed_by: 'system',
  note: 'VNPay callback: Tài khoản không đủ số dư',
  metadata: {
    vnpay_response_code: '51'
  }
}
```

### **4. Khi hoàn tiền (Refund)**

**Thời điểm:** Admin/Staff thực hiện hoàn tiền booking

```typescript
// ✅ Tạo Transaction mới với type REFUND
{
  type: 'refund',           // TransactionType.REFUND
  direction: 'out',         // TransactionDirection.OUT (tiền ra)
  status: 'pending',        // Chờ xử lý hoàn tiền
  method: 'vnpay',
  provider: 'vnpay',
  reference_type: 'booking',
  reference_id: 'booking_id',
  user_id: 'guest_id',
  amount: 2500000,          // Số tiền hoàn lại
  note: 'Refund for cancelled booking'
}

// ✅ Tạo TransactionLog cho refund
{
  from_status: null,
  to_status: 'pending',
  changed_by: 'admin',      // ChangedBy.ADMIN
  note: 'Refund requested by admin'
}
```

## 📊 Tracking & Monitoring

### **Query Transaction by Booking**

```typescript
// Lấy tất cả transactions của một booking
const transactions = await transactionsService.getTransactionsByReference(
  'booking',
  'booking_id',
);

// Kết quả: [payment_transaction, refund_transaction, ...]
```

### **Query Transaction Logs**

```typescript
// Lấy history của một transaction
const logs = await transactionsService.getTransactionLogs('transaction_id');

// Kết quả: Full audit trail từ pending → success/failed
```

### **Statistics & Analytics**

```typescript
// Revenue tracking
const stats = await transactionsService.getTransactionStats({
  from_date: '2023-12-01',
  to_date: '2023-12-31',
});

// Property revenue
const propertyStats = await transactionsService.getTransactionStats({
  propertyId: 'property_id',
});
```

## 🔧 Integration Points

### **Booking Module ↔ Transaction Module**

- ✅ **Auto-sync:** Mọi payment tự động tạo transaction
- ✅ **Status tracking:** Realtime update transaction status
- ✅ **Audit trail:** Full history trong transaction logs
- ✅ **Revenue reporting:** Tích hợp với transaction statistics

### **Payment Gateway ↔ Transaction System**

- ✅ **VNPay integration:** Đã tích hợp đầy đủ
- 🔄 **MoMo integration:** Sẵn sàng (cùng pattern)
- 🔄 **ZaloPay/Others:** Dễ dàng mở rộng

### **Error Handling**

```typescript
// Nếu transaction creation fails
try {
  await transactionsService.createTransaction(...)
} catch (error) {
  logger.warn('Transaction creation failed, payment continues');
  // Payment flow vẫn hoạt động bình thường
}
```

## 🎯 Benefits

### **1. Complete Audit Trail**

- Track mọi thay đổi từ pending → success/failed
- Biết ai, khi nào, vì sao thay đổi status
- Full metadata từ payment gateways

### **2. Real-time Revenue Tracking**

- Tự động sync revenue khi thanh toán thành công
- Separate tracking cho payments vs refunds
- Property-level và system-level statistics

### **3. Compliance & Reconciliation**

- Raw response từ payment gateways được lưu
- Dễ dàng reconcile với bank statements
- Audit-ready transaction history

### **4. Business Intelligence**

```sql
-- Revenue by payment method
SELECT method, SUM(amount) FROM transactions
WHERE type='payment' AND status='success'
GROUP BY method;

-- Failed payment analysis
SELECT provider, COUNT(*) FROM transactions
WHERE type='payment' AND status='failed'
GROUP BY provider;
```

## 🚀 Next Steps

### **Ready for MoMo Integration**

Transaction system đã sẵn sàng cho MoMo và các payment gateways khác:

```typescript
// MoMo sẽ follow cùng pattern
await transactionsService.createTransaction({
  type: TransactionType.PAYMENT,
  method: PaymentMethod.MOMO,
  provider: PaymentProvider.MOMO,
  // ... same structure
});
```

### **Advanced Features**

- 🔄 **Automated reconciliation** với bank statements
- 📊 **Advanced analytics** dashboard
- 🔔 **Transaction alerts** cho failed payments
- 📈 **Revenue forecasting** based on transaction history

---

**Transaction system giờ đã được tích hợp hoàn toàn với payment flow, đảm bảo mọi giao dịch được track và audit đầy đủ!** ✅

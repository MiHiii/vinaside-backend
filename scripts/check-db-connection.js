const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabaseConnection() {
  try {
    console.log('🔍 Kiểm tra kết nối database...');
    
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vinaside';
    console.log('📡 URI:', uri);
    
    await mongoose.connect(uri);
    console.log('✅ Kết nối database thành công!');
    
    // Kiểm tra collection bookings
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const bookingCollection = collections.find(col => col.name === 'bookings');
    
    if (bookingCollection) {
      console.log('✅ Collection "bookings" tồn tại');
      
      // Kiểm tra schema của một document
      const sampleBooking = await db.collection('bookings').findOne({});
      if (sampleBooking) {
        console.log('📋 Sample booking fields:', Object.keys(sampleBooking));
        
        // Kiểm tra các trường cancellation
        if ('cancellationDetails' in sampleBooking) {
          console.log('✅ Trường cancellationDetails tồn tại');
          console.log('📝 Giá trị:', sampleBooking.cancellationDetails);
        } else {
          console.log('❌ Trường cancellationDetails KHÔNG tồn tại');
        }
        
        if ('cancellationDetailsUpdatedAt' in sampleBooking) {
          console.log('✅ Trường cancellationDetailsUpdatedAt tồn tại');
        } else {
          console.log('❌ Trường cancellationDetailsUpdatedAt KHÔNG tồn tại');
        }
        
        if ('cancellationDetailsUpdatedBy' in sampleBooking) {
          console.log('✅ Trường cancellationDetailsUpdatedBy tồn tại');
        } else {
          console.log('❌ Trường cancellationDetailsUpdatedBy KHÔNG tồn tại');
        }
      } else {
        console.log('⚠️ Không có booking nào trong database');
      }
    } else {
      console.log('❌ Collection "bookings" KHÔNG tồn tại');
    }
    
    // Test query với ObjectId
    const { Types } = mongoose;
    try {
      const testId = new Types.ObjectId();
      console.log('✅ ObjectId creation thành công:', testId.toString());
    } catch (error) {
      console.log('❌ Lỗi tạo ObjectId:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Lỗi kết nối database:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối database');
  }
}

// Chạy kiểm tra
checkDatabaseConnection();

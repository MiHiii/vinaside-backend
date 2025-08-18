/**
 * Script để debug staff notification
 * Chạy: node scripts/debug-staff-notification.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/vinaside';

async function debugStaffNotification() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();

    // 1. Kiểm tra property
    const propertyId = '68a1577ceebed1cbdf09c9fb'; // Thay bằng propertyId thực
    const property = await db
      .collection('properties')
      .findOne({ _id: new ObjectId(propertyId) });
    console.log('\n1. Property Info:', {
      id: propertyId,
      name: property?.name,
      exists: !!property,
    });

    // 2. Kiểm tra staff assignments
    const staffAssignments = await db
      .collection('propertystaffassignments')
      .find({ propertyId: new ObjectId(propertyId) })
      .toArray();

    console.log('\n2. Staff Assignments:', {
      count: staffAssignments.length,
      assignments: staffAssignments.map((a) => ({
        id: a._id,
        propertyId: a.propertyId,
        staffId: a.staffId,
        status: a.status,
      })),
    });

    // 3. Kiểm tra staff users
    for (const assignment of staffAssignments) {
      if (assignment.staffId) {
        const staffUser = await db
          .collection('users')
          .findOne({ _id: assignment.staffId });
        console.log('\n3. Staff User:', {
          staffId: assignment.staffId,
          email: staffUser?.email,
          role: staffUser?.role,
          name: staffUser?.name,
          isStaff: staffUser?.role === 'staff',
        });
      }
    }

    // 4. Kiểm tra notifications
    const notifications = await db
      .collection('notifications')
      .find({
        'metadata.propertyId': propertyId,
        type: 'booking',
      })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    console.log('\n4. Recent Notifications:', {
      count: notifications.length,
      notifications: notifications.map((n) => ({
        id: n._id,
        recipient_type: n.recipient_type,
        user_id: n.user_id,
        title: n.title,
        created_at: n.created_at,
        metadata: {
          bookingId: n.metadata?.bookingId,
          propertyId: n.metadata?.propertyId,
          guestName: n.metadata?.guestName,
        },
      })),
    });

    // 5. Kiểm tra booking mới nhất
    const latestBooking = await db
      .collection('bookings')
      .find({ propertyId: new ObjectId(propertyId) })
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();

    if (latestBooking.length > 0) {
      console.log('\n5. Latest Booking:', {
        id: latestBooking[0]._id,
        guestId: latestBooking[0].guestId,
        propertyId: latestBooking[0].propertyId,
        status: latestBooking[0].status,
        created_at: latestBooking[0].created_at,
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Helper function để tạo ObjectId
function ObjectId(id) {
  return require('mongodb').ObjectId(id);
}

debugStaffNotification();

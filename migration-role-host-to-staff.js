// Migration script: Update role from 'host' to 'staff'
// Run: node migration-role-host-to-staff.js

const { MongoClient } = require('mongodb');

// Database configuration
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/vinaside';

async function migrateRoles() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();

    // 1. Update users collection: role 'host' -> 'staff'
    console.log('Updating users collection...');
    const usersResult = await db
      .collection('users')
      .updateMany({ role: 'host' }, { $set: { role: 'staff' } });
    console.log(`Users updated: ${usersResult.modifiedCount}`);

    // 2. Update notifications collection: recipient_type 'host' -> 'staff'
    console.log('Updating notifications collection...');
    const notificationsResult = await db
      .collection('notifications')
      .updateMany(
        { recipient_type: 'host' },
        { $set: { recipient_type: 'staff' } },
      );
    console.log(`Notifications updated: ${notificationsResult.modifiedCount}`);

    // 3. Update any other collections that might have role fields
    // Add more collections here if needed

    // Example: Update any logs or audit tables
    if ((await db.collection('audit_logs').countDocuments()) > 0) {
      console.log('Updating audit_logs collection...');
      const auditResult = await db
        .collection('audit_logs')
        .updateMany(
          { 'user.role': 'host' },
          { $set: { 'user.role': 'staff' } },
        );
      console.log(`Audit logs updated: ${auditResult.modifiedCount}`);
    }

    // Example: Update any cached user data
    if ((await db.collection('user_sessions').countDocuments()) > 0) {
      console.log('Updating user_sessions collection...');
      const sessionsResult = await db
        .collection('user_sessions')
        .updateMany(
          { 'user.role': 'host' },
          { $set: { 'user.role': 'staff' } },
        );
      console.log(`User sessions updated: ${sessionsResult.modifiedCount}`);
    }

    console.log('Migration completed successfully!');

    // Verify the migration
    console.log('\n=== Verification ===');
    const hostUsers = await db
      .collection('users')
      .countDocuments({ role: 'host' });
    const staffUsers = await db
      .collection('users')
      .countDocuments({ role: 'staff' });
    const hostNotifications = await db
      .collection('notifications')
      .countDocuments({ recipient_type: 'host' });
    const staffNotifications = await db
      .collection('notifications')
      .countDocuments({ recipient_type: 'staff' });

    console.log(`Users with role 'host': ${hostUsers} (should be 0)`);
    console.log(`Users with role 'staff': ${staffUsers}`);
    console.log(
      `Notifications with recipient_type 'host': ${hostNotifications} (should be 0)`,
    );
    console.log(
      `Notifications with recipient_type 'staff': ${staffNotifications}`,
    );

    if (hostUsers === 0 && hostNotifications === 0) {
      console.log('✅ Migration verification passed!');
    } else {
      console.log(
        '❌ Migration verification failed! Some records still have old role values.',
      );
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

// Run the migration
console.log('Starting role migration: host -> staff');
console.log(
  'Database URI:',
  MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'),
);

migrateRoles()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

// Instructions:
// 1. Make sure MongoDB is running
// 2. Set MONGODB_URI environment variable if needed
// 3. Run: node migration-role-host-to-staff.js
// 4. Verify results in your application

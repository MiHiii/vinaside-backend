import { Injectable } from '@nestjs/common';
import { RbacService } from '../../modules/auth/services/rbac.service';

interface MongoError extends Error {
  code?: number;
}

@Injectable()
export class RbacSeedService {
  constructor(private rbacService: RbacService) {}

  async seedRbacData() {
    console.log('🌱 Seeding RBAC data...');

    try {
      // Create permissions
      const permissions = [
        {
          key: 'listing.verify',
          module: 'listing',
          action: 'verify',
          description: 'Duyệt bài đăng phòng',
        },
        {
          key: 'listing.view',
          module: 'listing',
          action: 'view',
          description: 'Xem bài đăng phòng',
        },
        {
          key: 'listing.create',
          module: 'listing',
          action: 'create',
          description: 'Tạo bài đăng phòng',
        },
        {
          key: 'listing.edit',
          module: 'listing',
          action: 'edit',
          description: 'Chỉnh sửa bài đăng phòng',
        },
        {
          key: 'listing.delete',
          module: 'listing',
          action: 'delete',
          description: 'Xóa bài đăng phòng',
        },
        {
          key: 'ticket.reply',
          module: 'ticket',
          action: 'reply',
          description: 'Trả lời ticket hỗ trợ',
        },
        {
          key: 'ticket.view',
          module: 'ticket',
          action: 'view',
          description: 'Xem ticket hỗ trợ',
        },
        {
          key: 'ticket.close',
          module: 'ticket',
          action: 'close',
          description: 'Đóng ticket hỗ trợ',
        },
        {
          key: 'payment.refund',
          module: 'payment',
          action: 'refund',
          description: 'Hoàn tiền thanh toán',
        },
        {
          key: 'payment.view',
          module: 'payment',
          action: 'view',
          description: 'Xem thông tin thanh toán',
        },
        {
          key: 'user.view',
          module: 'user',
          action: 'view',
          description: 'Xem thông tin người dùng',
        },
        {
          key: 'user.edit',
          module: 'user',
          action: 'edit',
          description: 'Chỉnh sửa thông tin người dùng',
        },
        {
          key: 'user.ban',
          module: 'user',
          action: 'ban',
          description: 'Khóa tài khoản người dùng',
        },
        {
          key: 'booking.view',
          module: 'booking',
          action: 'view',
          description: 'Xem thông tin đặt phòng',
        },
        {
          key: 'booking.cancel',
          module: 'booking',
          action: 'cancel',
          description: 'Hủy đặt phòng',
        },
        {
          key: 'analytics.view',
          module: 'analytics',
          action: 'view',
          description: 'Xem báo cáo thống kê',
        },
        {
          key: 'notification.send',
          module: 'notification',
          action: 'send',
          description: 'Gửi thông báo',
        },
        {
          key: 'property.view',
          module: 'property',
          action: 'view',
          description: 'View properties and property details',
        },
        {
          key: 'property.create',
          module: 'property',
          action: 'create',
          description: 'Create new properties',
        },
        {
          key: 'property.edit',
          module: 'property',
          action: 'edit',
          description: 'Edit existing properties',
        },
        {
          key: 'property.delete',
          module: 'property',
          action: 'delete',
          description: 'Delete and restore properties',
        },
        {
          key: 'property.verify',
          module: 'property',
          action: 'verify',
          description: 'Verify properties for public listing',
        },
      ];

      console.log('Creating permissions...');
      for (const permission of permissions) {
        try {
          await this.rbacService.createPermission(
            permission.key,
            permission.module,
            permission.action,
            permission.description,
          );
          console.log(`✅ Permission created: ${permission.key}`);
        } catch (error) {
          const mongoError = error as MongoError;
          if (mongoError.code === 11000) {
            console.log(`⚠️  Permission already exists: ${permission.key}`);
          } else {
            throw error;
          }
        }
      }

      // Create custom roles
      const customRoles = [
        {
          key: 'support_staff',
          name: 'Nhân viên CSKH',
          description: 'Nhân viên chăm sóc khách hàng, xử lý ticket hỗ trợ',
          permissions: [
            'ticket.reply',
            'ticket.view',
            'ticket.close',
            'user.view',
            'notification.send',
          ],
        },
        {
          key: 'reviewer',
          name: 'Kiểm duyệt viên',
          description: 'Nhân viên kiểm duyệt bài đăng phòng',
          permissions: [
            'listing.verify',
            'listing.view',
            'listing.edit',
            'user.view',
          ],
        },
        {
          key: 'accounting',
          name: 'Kế toán viên',
          description: 'Nhân viên kế toán, xử lý thanh toán và hoàn tiền',
          permissions: [
            'payment.refund',
            'payment.view',
            'booking.view',
            'user.view',
            'analytics.view',
          ],
        },
        {
          key: 'content_manager',
          name: 'Quản lý nội dung',
          description: 'Quản lý toàn bộ nội dung bài đăng',
          permissions: [
            'listing.verify',
            'listing.create',
            'listing.edit',
            'listing.delete',
            'listing.view',
            'user.view',
            'user.edit',
            'analytics.view',
          ],
        },
        {
          key: 'moderator',
          name: 'Điều hành viên',
          description: 'Điều hành và quản lý người dùng',
          permissions: [
            'user.view',
            'user.edit',
            'user.ban',
            'ticket.reply',
            'ticket.view',
            'ticket.close',
            'booking.view',
            'booking.cancel',
            'listing.view',
            'notification.send',
          ],
        },
        {
          key: 'analyst',
          name: 'Chuyên viên phân tích',
          description: 'Chuyên viên phân tích dữ liệu và báo cáo',
          permissions: [
            'analytics.view',
            'user.view',
            'booking.view',
            'listing.view',
            'payment.view',
          ],
        },
      ];

      console.log('Creating custom roles...');
      for (const role of customRoles) {
        try {
          await this.rbacService.createCustomRole(
            role.key,
            role.name,
            role.description,
          );
          console.log(`✅ Custom role created: ${role.key}`);

          // Assign permissions to the role
          for (const permissionKey of role.permissions) {
            try {
              await this.rbacService.assignPermissionToRole(
                role.key,
                permissionKey,
              );
              console.log(
                `   ✅ Permission ${permissionKey} assigned to ${role.key}`,
              );
            } catch {
              console.log(
                `   ⚠️  Permission assignment already exists: ${permissionKey} -> ${role.key}`,
              );
            }
          }
        } catch (error) {
          const mongoError = error as MongoError;
          if (mongoError.code === 11000) {
            console.log(`⚠️  Custom role already exists: ${role.key}`);
          } else {
            throw error;
          }
        }
      }

      console.log('🎉 RBAC seeding completed successfully!');
    } catch (error) {
      console.error('❌ Error seeding RBAC data:', error);
      throw error;
    }
  }
}

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
      // Create permissions theo modules thực tế của dự án
      const permissions = [
        // === PROPERTY MANAGEMENT ===
        {
          key: 'property.view',
          module: 'property',
          action: 'view',
          description: 'Xem thông tin tài sản/bất động sản',
        },
        {
          key: 'property.create',
          module: 'property',
          action: 'create',
          description: 'Tạo mới tài sản/bất động sản',
        },
        {
          key: 'property.edit',
          module: 'property',
          action: 'edit',
          description: 'Chỉnh sửa thông tin tài sản',
        },
        {
          key: 'property.delete',
          module: 'property',
          action: 'delete',
          description: 'Xóa/khôi phục tài sản',
        },
        {
          key: 'property.verify',
          module: 'property',
          action: 'verify',
          description: 'Duyệt tài sản hiển thị công khai',
        },
        {
          key: 'property.manage_staff',
          module: 'property',
          action: 'manage_staff',
          description: 'Quản lý nhân viên của tài sản',
        },

        // === LISTING MANAGEMENT ===
        {
          key: 'listing.view',
          module: 'listing',
          action: 'view',
          description: 'Xem danh sách listing',
        },
        {
          key: 'listing.create',
          module: 'listing',
          action: 'create',
          description: 'Tạo listing mới',
        },
        {
          key: 'listing.edit',
          module: 'listing',
          action: 'edit',
          description: 'Chỉnh sửa listing',
        },
        {
          key: 'listing.delete',
          module: 'listing',
          action: 'delete',
          description: 'Xóa listing',
        },
        {
          key: 'listing.verify',
          module: 'listing',
          action: 'verify',
          description: 'Duyệt listing',
        },
        {
          key: 'listing.manage_status',
          module: 'listing',
          action: 'manage_status',
          description: 'Quản lý trạng thái listing (active/inactive)',
        },

        // === BOOKING MANAGEMENT ===
        {
          key: 'booking.view',
          module: 'booking',
          action: 'view',
          description: 'Xem thông tin đặt phòng',
        },
        {
          key: 'booking.create',
          module: 'booking',
          action: 'create',
          description: 'Tạo booking mới (khách hàng)',
        },
        {
          key: 'booking.edit',
          module: 'booking',
          action: 'edit',
          description: 'Chỉnh sửa thông tin booking',
        },
        {
          key: 'booking.cancel',
          module: 'booking',
          action: 'cancel',
          description: 'Hủy booking',
        },
        {
          key: 'booking.confirm',
          module: 'booking',
          action: 'confirm',
          description: 'Xác nhận booking',
        },
        {
          key: 'booking.manage_payment',
          module: 'booking',
          action: 'manage_payment',
          description: 'Quản lý thanh toán booking',
        },

        // === USER MANAGEMENT ===
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
          key: 'user.delete',
          module: 'user',
          action: 'delete',
          description: 'Xóa/khóa tài khoản người dùng',
        },
        {
          key: 'user.manage_roles',
          module: 'user',
          action: 'manage_roles',
          description: 'Quản lý vai trò người dùng',
        },
        {
          key: 'user.view_private_info',
          module: 'user',
          action: 'view_private_info',
          description: 'Xem thông tin cá nhân nhạy cảm',
        },

        // === REVIEW MANAGEMENT ===
        {
          key: 'review.view',
          module: 'review',
          action: 'view',
          description: 'Xem đánh giá/nhận xét',
        },
        {
          key: 'review.moderate',
          module: 'review',
          action: 'moderate',
          description: 'Kiểm duyệt đánh giá',
        },
        {
          key: 'review.delete',
          module: 'review',
          action: 'delete',
          description: 'Xóa đánh giá vi phạm',
        },

        // === MESSAGE MANAGEMENT ===
        {
          key: 'message.view',
          module: 'message',
          action: 'view',
          description: 'Xem tin nhắn',
        },
        {
          key: 'message.moderate',
          module: 'message',
          action: 'moderate',
          description: 'Kiểm duyệt tin nhắn',
        },
        {
          key: 'message.send_admin',
          module: 'message',
          action: 'send_admin',
          description: 'Gửi tin nhắn với quyền admin',
        },

        // === NOTIFICATION MANAGEMENT ===
        {
          key: 'notification.send',
          module: 'notification',
          action: 'send',
          description: 'Gửi thông báo',
        },
        {
          key: 'notification.broadcast',
          module: 'notification',
          action: 'broadcast',
          description: 'Gửi thông báo đến nhiều người',
        },

        // === CONTENT MANAGEMENT ===
        {
          key: 'amenity.manage',
          module: 'amenity',
          action: 'manage',
          description: 'Quản lý tiện ích',
        },
        {
          key: 'safety_feature.manage',
          module: 'safety_feature',
          action: 'manage',
          description: 'Quản lý tính năng an toàn',
        },
        {
          key: 'house_rule.manage',
          module: 'house_rule',
          action: 'manage',
          description: 'Quản lý nội quy',
        },

        // === ANALYTICS & REPORTS ===
        {
          key: 'analytics.view',
          module: 'analytics',
          action: 'view',
          description: 'Xem báo cáo thống kê',
        },
        {
          key: 'analytics.export',
          module: 'analytics',
          action: 'export',
          description: 'Xuất báo cáo',
        },

        // === SYSTEM MANAGEMENT ===
        {
          key: 'system.manage',
          module: 'system',
          action: 'manage',
          description: 'Quản lý hệ thống',
        },
        {
          key: 'upload.manage',
          module: 'upload',
          action: 'manage',
          description: 'Quản lý upload file',
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

      // Create custom roles theo cấu trúc thực tế
      const customRoles = [
        // === ROLES CHO STAFF ===
        {
          key: 'property_manager',
          name: 'Quản lý Tài sản',
          description: 'Quản lý toàn bộ tài sản và listing',
          permissions: [
            'property.view',
            'property.create',
            'property.edit',
            'property.manage_staff',
            'listing.view',
            'listing.create',
            'listing.edit',
            'listing.manage_status',
            'booking.view',
            'booking.confirm',
            'booking.cancel',
            'user.view',
            'analytics.view',
          ],
        },
        {
          key: 'booking_manager',
          name: 'Quản lý Đặt phòng',
          description: 'Chuyên viên xử lý booking và thanh toán',
          permissions: [
            'booking.view',
            'booking.edit',
            'booking.confirm',
            'booking.cancel',
            'booking.manage_payment',
            'property.view',
            'listing.view',
            'user.view',
            'analytics.view',
            'notification.send',
          ],
        },
        {
          key: 'content_moderator',
          name: 'Kiểm duyệt Nội dung',
          description: 'Kiểm duyệt listing, review, tin nhắn',
          permissions: [
            'listing.view',
            'listing.verify',
            'property.view',
            'property.verify',
            'review.view',
            'review.moderate',
            'review.delete',
            'message.view',
            'message.moderate',
            'user.view',
          ],
        },
        {
          key: 'customer_service',
          name: 'Chăm sóc Khách hàng',
          description: 'Hỗ trợ khách hàng, xử lý khiếu nại',
          permissions: [
            'user.view',
            'user.edit',
            'booking.view',
            'booking.edit',
            'property.view',
            'listing.view',
            'message.view',
            'message.send_admin',
            'notification.send',
            'review.view',
          ],
        },
        {
          key: 'operations_staff',
          name: 'Nhân viên Vận hành',
          description: 'Vận hành hàng ngày, báo cáo',
          permissions: [
            'property.view',
            'listing.view',
            'booking.view',
            'user.view',
            'analytics.view',
            'notification.send',
          ],
        },
        {
          key: 'content_manager',
          name: 'Quản lý Nội dung',
          description: 'Quản lý nội dung trang web, tiện ích, nội quy',
          permissions: [
            'amenity.manage',
            'safety_feature.manage',
            'house_rule.manage',
            'property.view',
            'listing.view',
            'user.view',
          ],
        },
        {
          key: 'analyst',
          name: 'Chuyên viên Phân tích',
          description: 'Phân tích dữ liệu, tạo báo cáo',
          permissions: [
            'analytics.view',
            'analytics.export',
            'property.view',
            'listing.view',
            'booking.view',
            'user.view',
          ],
        },
        {
          key: 'admin_assistant',
          name: 'Trợ lý Quản trị',
          description: 'Hỗ trợ quản trị viên, quyền hạn mở rộng',
          permissions: [
            'property.view',
            'property.edit',
            'property.verify',
            'listing.view',
            'listing.edit',
            'listing.verify',
            'booking.view',
            'booking.edit',
            'booking.confirm',
            'booking.cancel',
            'user.view',
            'user.edit',
            'review.view',
            'review.moderate',
            'message.view',
            'message.moderate',
            'notification.send',
            'notification.broadcast',
            'analytics.view',
            'analytics.export',
          ],
        },
        {
          key: 'support_staff',
          name: 'Nhân viên CSKH',
          description: 'Nhân viên chăm sóc khách hàng cơ bản',
          permissions: [
            'user.view',
            'booking.view',
            'booking.edit',
            'property.view',
            'listing.view',
            'message.view',
            'message.send_admin',
            'notification.send',
            'review.view',
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
      console.log('\n📋 SUMMARY:');
      console.log(`   • ${permissions.length} permissions created`);
      console.log(`   • ${customRoles.length} custom roles created`);
      console.log('\n🔐 ROLES OVERVIEW:');
      customRoles.forEach((role) => {
        console.log(
          `   • ${role.key}: ${role.name} (${role.permissions.length} permissions)`,
        );
      });
    } catch (error) {
      console.error('❌ Error seeding RBAC data:', error);
      throw error;
    }
  }
}

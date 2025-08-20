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
          description: 'Tạo booking mới',
        },
        {
          key: 'booking.edit',
          module: 'booking',
          action: 'edit',
          description: 'Chỉnh sửa thông tin booking',
        },
        {
          key: 'booking.update',
          module: 'booking',
          action: 'update',
          description:
            'Cập nhật thông tin booking (note, additional cost, cancellation details)',
        },
        {
          key: 'booking.delete',
          module: 'booking',
          action: 'delete',
          description: 'Xóa booking',
        },
        {
          key: 'booking.manage_payment',
          module: 'booking',
          action: 'manage_payment',
          description: 'Quản lý thanh toán booking',
        },
        {
          key: 'booking.view_statistics',
          module: 'booking',
          action: 'view_statistics',
          description: 'Xem thống kê booking',
        },

        // ===PROPERTY STAFF ASSIGNMENT MANAGEMENT ===
        {
          key: 'property_staff.edit',
          module: 'property_staff_assignment',
          action: 'view',
          description: 'Xem thông tin phân công nhân viên cho tài sản',
        },
        {
          key: 'property_staff.view',
          module: 'property_staff_assignment',
          action: 'view',
          description: 'Xem danh sách nhân viên được phân công cho tài sản',
        },

        // === USER MANAGEMENT ===
        {
          key: 'user.view',
          module: 'user',
          action: 'view',
          description: 'Xem thông tin người dùng',
        },
        {
          key: 'user.create',
          module: 'user',
          action: 'create',
          description: 'Tạo người dùng mới',
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

        // === REVIEW MANAGEMENT ===
        {
          key: 'review.view',
          module: 'review',
          action: 'view',
          description: 'Xem đánh giá/nhận xét',
        },
        {
          key: 'review.create',
          module: 'review',
          action: 'create',
          description: 'Tạo đánh giá mới',
        },
        {
          key: 'review.edit',
          module: 'review',
          action: 'edit',
          description: 'Chỉnh sửa đánh giá',
        },
        {
          key: 'review.delete',
          module: 'review',
          action: 'delete',
          description: 'Xóa đánh giá',
        },

        // === MESSAGE MANAGEMENT ===
        {
          key: 'message.view',
          module: 'message',
          action: 'view',
          description: 'Xem tin nhắn',
        },
        {
          key: 'message.create',
          module: 'message',
          action: 'create',
          description: 'Tạo tin nhắn mới',
        },
        {
          key: 'message.edit',
          module: 'message',
          action: 'edit',
          description: 'Chỉnh sửa tin nhắn',
        },
        {
          key: 'message.delete',
          module: 'message',
          action: 'delete',
          description: 'Xóa tin nhắn',
        },

        // === DASHBOARD MANAGEMENT ===
        {
          key: 'dashboard.view',
          module: 'dashboard',
          action: 'view',
          description: 'Xem thống kê dashboard',
        },

        // === NOTIFICATION MANAGEMENT ===
        {
          key: 'notification.view',
          module: 'notification',
          action: 'view',
          description: 'Xem thông báo',
        },
        {
          key: 'notification.create',
          module: 'notification',
          action: 'create',
          description: 'Tạo thông báo mới',
        },
        {
          key: 'notification.edit',
          module: 'notification',
          action: 'edit',
          description: 'Chỉnh sửa thông báo',
        },
        {
          key: 'notification.delete',
          module: 'notification',
          action: 'delete',
          description: 'Xóa thông báo',
        },

        // === AMENITY MANAGEMENT ===
        {
          key: 'amenity.view',
          module: 'amenity',
          action: 'view',
          description: 'Xem tiện ích',
        },
        {
          key: 'amenity.create',
          module: 'amenity',
          action: 'create',
          description: 'Tạo tiện ích mới',
        },
        {
          key: 'amenity.edit',
          module: 'amenity',
          action: 'edit',
          description: 'Chỉnh sửa tiện ích',
        },
        {
          key: 'amenity.delete',
          module: 'amenity',
          action: 'delete',
          description: 'Xóa tiện ích',
        },

        // === SAFETY FEATURE MANAGEMENT ===
        {
          key: 'safety_feature.view',
          module: 'safety_feature',
          action: 'view',
          description: 'Xem tính năng an toàn',
        },
        {
          key: 'safety_feature.create',
          module: 'safety_feature',
          action: 'create',
          description: 'Tạo tính năng an toàn mới',
        },
        {
          key: 'safety_feature.edit',
          module: 'safety_feature',
          action: 'edit',
          description: 'Chỉnh sửa tính năng an toàn',
        },
        {
          key: 'safety_feature.delete',
          module: 'safety_feature',
          action: 'delete',
          description: 'Xóa tính năng an toàn',
        },

        // === HOUSE RULE MANAGEMENT ===
        {
          key: 'house_rule.view',
          module: 'house_rule',
          action: 'view',
          description: 'Xem nội quy',
        },
        {
          key: 'house_rule.create',
          module: 'house_rule',
          action: 'create',
          description: 'Tạo nội quy mới',
        },
        {
          key: 'house_rule.edit',
          module: 'house_rule',
          action: 'edit',
          description: 'Chỉnh sửa nội quy',
        },
        {
          key: 'house_rule.delete',
          module: 'house_rule',
          action: 'delete',
          description: 'Xóa nội quy',
        },

        // === VOUCHER MANAGEMENT ===
        {
          key: 'voucher.view',
          module: 'voucher',
          action: 'view',
          description: 'Xem voucher',
        },
        {
          key: 'voucher.create',
          module: 'voucher',
          action: 'create',
          description: 'Tạo voucher mới',
        },
        {
          key: 'voucher.edit',
          module: 'voucher',
          action: 'edit',
          description: 'Chỉnh sửa voucher',
        },
        {
          key: 'voucher.delete',
          module: 'voucher',
          action: 'delete',
          description: 'Xóa voucher',
        },

        // === TRANSACTION MANAGEMENT ===
        {
          key: 'transaction.view',
          module: 'transaction',
          action: 'view',
          description: 'Xem giao dịch',
        },
        {
          key: 'transaction.create',
          module: 'transaction',
          action: 'create',
          description: 'Tạo giao dịch mới',
        },
        {
          key: 'transaction.edit',
          module: 'transaction',
          action: 'edit',
          description: 'Chỉnh sửa giao dịch',
        },
        {
          key: 'transaction.delete',
          module: 'transaction',
          action: 'delete',
          description: 'Xóa giao dịch',
        },

        // === WISHLIST MANAGEMENT ===
        {
          key: 'wishlist.view',
          module: 'wishlist',
          action: 'view',
          description: 'Xem danh sách yêu thích',
        },
        {
          key: 'wishlist.create',
          module: 'wishlist',
          action: 'create',
          description: 'Tạo danh sách yêu thích mới',
        },
        {
          key: 'wishlist.edit',
          module: 'wishlist',
          action: 'edit',
          description: 'Chỉnh sửa danh sách yêu thích',
        },
        {
          key: 'wishlist.delete',
          module: 'wishlist',
          action: 'delete',
          description: 'Xóa danh sách yêu thích',
        },

        // === SERVICE MANAGEMENT ===
        {
          key: 'service.view',
          module: 'service',
          action: 'view',
          description: 'Xem dịch vụ',
        },
        {
          key: 'service.create',
          module: 'service',
          action: 'create',
          description: 'Tạo dịch vụ mới',
        },
        {
          key: 'service.edit',
          module: 'service',
          action: 'edit',
          description: 'Chỉnh sửa dịch vụ',
        },
        {
          key: 'service.delete',
          module: 'service',
          action: 'delete',
          description: 'Xóa dịch vụ',
        },

        // === SPECIAL PERMISSIONS ===
        {
          key: 'analytics.manage',
          module: 'analytics',
          action: 'manage',
          description: 'Quản lý báo cáo thống kê',
        },
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
            'property_staff.edit',
            'property_staff.view',
            'listing.view',
            'listing.create',
            'listing.edit',
            'booking.view',
            'user.view',
            'analytics.manage',
            'upload.manage',
            'dashboard.view',
          ],
        },
        {
          key: 'booking_manager',
          name: 'Quản lý Đặt phòng',
          description: 'Chuyên viên xử lý booking và thanh toán',
          permissions: [
            'booking.view',
            'booking.create',
            'booking.edit',
            'booking.update',
            'booking.manage_payment',
            'property.view',
            'listing.view',
            'user.view',
            'analytics.manage',
            'notification.create',
            'dashboard.view',
          ],
        },
        {
          key: 'content_moderator',
          name: 'Kiểm duyệt Nội dung',
          description: 'Kiểm duyệt listing, review, tin nhắn',
          permissions: [
            'listing.view',
            'listing.edit',
            'property.view',
            'review.view',
            'review.edit',
            'review.delete',
            'message.view',
            'message.edit',
            'message.delete',
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
            'booking.update',
            'property.view',
            'listing.view',
            'message.view',
            'message.create',
            'notification.create',
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
            'analytics.manage',
            'notification.create',
            'upload.manage',
            'dashboard.view',
          ],
        },
        {
          key: 'content_manager',
          name: 'Quản lý Nội dung',
          description: 'Quản lý nội dung trang web, tiện ích, nội quy',
          permissions: [
            'amenity.view',
            'amenity.create',
            'amenity.edit',
            'amenity.delete',
            'safety_feature.view',
            'safety_feature.create',
            'safety_feature.edit',
            'safety_feature.delete',
            'house_rule.view',
            'house_rule.create',
            'house_rule.edit',
            'house_rule.delete',
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
            'analytics.manage',
            'property.view',
            'listing.view',
            'booking.view',
            'user.view',
            'transaction.view',
          ],
        },
        {
          key: 'admin_assistant',
          name: 'Trợ lý Quản trị',
          description: 'Hỗ trợ quản trị viên, quyền hạn mở rộng',
          permissions: [
            'property.view',
            'property.edit',
            'listing.view',
            'listing.edit',
            'booking.view',
            'booking.edit',
            'user.view',
            'user.create',
            'user.edit',
            'review.view',
            'review.edit',
            'review.delete',
            'message.view',
            'message.edit',
            'message.delete',
            'notification.view',
            'notification.create',
            'notification.edit',
            'analytics.manage',
            'upload.manage',
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

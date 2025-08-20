import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomRole, CustomRoleDocument } from '../schemas/custom-role.schema';
import { Permission, PermissionDocument } from '../schemas/permission.schema';
import {
  CustomRolePermission,
  CustomRolePermissionDocument,
} from '../schemas/custom-role-permission.schema';
import {
  UserCustomRole,
  UserCustomRoleDocument,
} from '../schemas/user-custom-role.schema';

// Danh sách permissions bị cấm - không cho phép gán cho custom roles
const FORBIDDEN_PERMISSIONS = [
  'system.manage', // Quản lý hệ thống - chỉ dành cho super admin
  'upload.manage', // Quản lý upload file - quyền hệ thống
  'user.manage_roles', // Quản lý vai trò người dùng - quyền cao cấp
  'user.view_private_info', // Xem thông tin cá nhân nhạy cảm
] as string[];

// Helper interfaces for populated documents
interface PopulatedPermission {
  key: string;
  module: string;
  action: string;
  description?: string;
  isDeleted?: boolean;
}

interface PopulatedCustomRole {
  key: string;
  name: string;
  description?: string;
  isDeleted?: boolean;
}

// Response interfaces (without database-specific fields)
export interface CustomRoleResponse {
  key: string;
  name: string;
  description?: string;
}

@Injectable()
export class RbacService {
  constructor(
    @InjectModel(CustomRole.name)
    private customRoleModel: Model<CustomRoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    @InjectModel(CustomRolePermission.name)
    private customRolePermissionModel: Model<CustomRolePermissionDocument>,
    @InjectModel(UserCustomRole.name)
    private userCustomRoleModel: Model<UserCustomRoleDocument>,
  ) {}

  // Get all permissions for a user based on their custom roles
  async getUserPermissions(userId: string): Promise<string[]> {
    // Find all custom roles assigned to the user (not deleted)
    const userRoles = await this.userCustomRoleModel
      .find({ userId: new Types.ObjectId(userId), isDeleted: false })
      .populate('customRoleId');

    if (!userRoles.length) {
      return [];
    }

    // Extract ObjectIds from populated roles
    const roleIds = userRoles
      .map((ur) => {
        if (
          ur.customRoleId &&
          typeof ur.customRoleId === 'object' &&
          '_id' in ur.customRoleId
        ) {
          return ur.customRoleId._id;
        }
        return ur.customRoleId; // fallback if not populated
      })
      .filter(Boolean);

    // Find all permissions for these roles (not deleted)
    const rolePermissions = await this.customRolePermissionModel
      .find({ customRoleId: { $in: roleIds }, isDeleted: false })
      .populate('permissionId');

    // Extract permission keys with safe checking
    const permissions: string[] = [];
    for (const rp of rolePermissions) {
      if (
        rp.permissionId &&
        typeof rp.permissionId === 'object' &&
        'key' in rp.permissionId
      ) {
        const permission = rp.permissionId as unknown as PopulatedPermission;
        // Only include non-deleted permissions
        if (!permission.isDeleted) {
          permissions.push(permission.key);
        }
      }
    }

    // Remove duplicates
    return [...new Set(permissions)];
  }

  // Assign a custom role to a user
  async assignRoleToUser(userId: string, roleKey: string): Promise<void> {
    const role = await this.customRoleModel.findOne({
      key: roleKey,
      isDeleted: false,
    });
    if (!role) {
      throw new Error(`Role with key "${roleKey}" not found`);
    }

    const existingAssignment = await this.userCustomRoleModel.findOne({
      userId: new Types.ObjectId(userId),
      customRoleId: role._id,
      isDeleted: false,
    });

    if (!existingAssignment) {
      await this.userCustomRoleModel.create({
        userId: new Types.ObjectId(userId),
        customRoleId: role._id,
      });
    }
  }

  // Remove a custom role from a user (soft delete)
  async removeRoleFromUser(userId: string, roleKey: string): Promise<void> {
    const role = await this.customRoleModel.findOne({
      key: roleKey,
      isDeleted: false,
    });
    if (!role) {
      throw new Error(`Role with key "${roleKey}" not found`);
    }

    await this.userCustomRoleModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        customRoleId: role._id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );
  }

  // Create a new custom role
  async createCustomRole(
    key: string,
    name: string,
    description?: string,
  ): Promise<CustomRole> {
    return this.customRoleModel.create({ key, name, description });
  }

  // Create a new permission
  async createPermission(
    key: string,
    module: string,
    action: string,
    description?: string,
  ): Promise<Permission> {
    return this.permissionModel.create({ key, module, action, description });
  }

  // Assign permission to a custom role
  async assignPermissionToRole(
    roleKey: string,
    permissionKey: string,
  ): Promise<void> {
    // Kiểm tra permission có bị cấm không
    if (FORBIDDEN_PERMISSIONS.includes(permissionKey)) {
      throw new Error(`Permission "${permissionKey}" is forbidden and cannot be assigned to custom roles`);
    }

    const role = await this.customRoleModel.findOne({
      key: roleKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });
    const permission = await this.permissionModel.findOne({
      key: permissionKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });

    if (!role || !permission) {
      throw new Error('Role or Permission not found');
    }

    // Kiểm tra xem có assignment nào đã tồn tại (kể cả đã bị soft delete)
    const existingAssignment = await this.customRolePermissionModel.findOne({
      customRoleId: role._id,
      permissionId: permission._id,
    });

    if (existingAssignment) {
      // Nếu assignment đã tồn tại và chưa bị soft delete, không làm gì
      if (!existingAssignment.isDeleted) {
        return; // Assignment đã tồn tại và active
      }

      // Nếu assignment đã bị soft delete, restore nó
      await this.customRolePermissionModel.updateOne(
        { _id: existingAssignment._id },
        {
          isDeleted: false,
          deletedAt: undefined,
          updatedAt: new Date(),
        },
      );
    } else {
      // Tạo assignment mới
      await this.customRolePermissionModel.create({
        customRoleId: role._id,
        permissionId: permission._id,
      });
    }
  }

  // Remove permission from a custom role (soft delete)
  async removePermissionFromRole(
    roleKey: string,
    permissionKey: string,
  ): Promise<void> {
    console.log(`Attempting to remove permission ${permissionKey} from role ${roleKey}`);
    
    const role = await this.customRoleModel.findOne({
      key: roleKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });
    
    if (!role) {
      console.log(`Role with key "${roleKey}" not found`);
      throw new Error(`Role with key "${roleKey}" not found`);
    }
    
    const permission = await this.permissionModel.findOne({
      key: permissionKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });
    
    if (!permission) {
      console.log(`Permission with key "${permissionKey}" not found`);
      throw new Error(`Permission with key "${permissionKey}" not found`);
    }

    console.log(`Found role: ${role.key}, permission: ${permission.key}`);

    // Kiểm tra xem assignment có tồn tại không
    const existingAssignment = await this.customRolePermissionModel.findOne({
      customRoleId: role._id,
      permissionId: permission._id,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });

    if (!existingAssignment) {
      console.log(`No assignment found for role ${roleKey} and permission ${permissionKey}`);
      // Trả về success thay vì throw error vì mục đích cuối cùng đã đạt được (permission không được gán)
      return;
    }

    const result = await this.customRolePermissionModel.updateOne(
      {
        customRoleId: role._id,
        permissionId: permission._id,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    console.log(`Update result: ${result.modifiedCount} documents modified`);
    
    if (result.modifiedCount === 0) {
      console.log(`No assignment found for role ${roleKey} and permission ${permissionKey}`);
      // Trả về success thay vì throw error
      return;
    }
  }

  // Get all custom roles (not deleted)
  async getAllCustomRoles(): Promise<CustomRole[]> {
    return this.customRoleModel.find({
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });
  }

  // Get all permissions (not deleted) - filtered for regular users
  async getAllPermissions(): Promise<Permission[]> {
    const allPermissions = await this.permissionModel.find({
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });

    // Lọc bỏ permissions bị cấm
    return allPermissions.filter(permission => 
      !FORBIDDEN_PERMISSIONS.includes(permission.key)
    );
  }

  // Get all permissions including forbidden ones - for admin only
  async getAllPermissionsForAdmin(): Promise<Permission[]> {
    return this.permissionModel.find({
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });
  }

  // Get user's custom roles
  async getUserCustomRoles(userId: string): Promise<CustomRoleResponse[]> {
    const userRoles = await this.userCustomRoleModel
      .find({ userId: new Types.ObjectId(userId), isDeleted: false })
      .populate('customRoleId');

    const roles: CustomRoleResponse[] = [];
    for (const ur of userRoles) {
      if (
        ur.customRoleId &&
        typeof ur.customRoleId === 'object' &&
        'key' in ur.customRoleId
      ) {
        const role = ur.customRoleId as unknown as PopulatedCustomRole;
        // Only include non-deleted roles
        if (!role.isDeleted) {
          roles.push({
            key: role.key,
            name: role.name,
            description: role.description,
          });
        }
      }
    }

    return roles;
  }

  // Get permissions for a specific role
  async getRolePermissions(roleKey: string): Promise<string[]> {
    const role = await this.customRoleModel.findOne({
      key: roleKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });
    if (!role) {
      throw new Error(`Role with key "${roleKey}" not found`);
    }

    const rolePermissions = await this.customRolePermissionModel
      .find({
        customRoleId: role._id,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      })
      .populate('permissionId');

    const permissions: string[] = [];
    for (const rp of rolePermissions) {
      if (
        rp.permissionId &&
        typeof rp.permissionId === 'object' &&
        'key' in rp.permissionId
      ) {
        const permission = rp.permissionId as unknown as PopulatedPermission;
        // Only include non-deleted permissions (including those without isDeleted field)
        if (!permission.isDeleted) {
          permissions.push(permission.key);
        }
      }
    }

    return permissions;
  }

  // Check if user has specific permission
  async userHasPermission(
    userId: string,
    permissionKey: string,
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return userPermissions.includes(permissionKey);
  }

  // Get all users with a specific role
  async getUsersWithRole(roleKey: string): Promise<string[]> {
    const role = await this.customRoleModel.findOne({
      key: roleKey,
      isDeleted: false,
    });
    if (!role) {
      throw new Error(`Role with key "${roleKey}" not found`);
    }

    const userRoles = await this.userCustomRoleModel.find({
      customRoleId: role._id,
      isDeleted: false,
    });

    return userRoles.map((ur) => ur.userId.toString());
  }

  // Update custom role
  async updateCustomRole(
    roleKey: string,
    updateData: { name?: string; description?: string },
  ): Promise<CustomRole> {
    const role = await this.customRoleModel.findOne({
      key: roleKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });

    if (!role) {
      throw new Error(`Role with key "${roleKey}" not found`);
    }

    const updatedRole = await this.customRoleModel.findByIdAndUpdate(
      role._id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    );

    if (!updatedRole) {
      throw new Error('Failed to update role');
    }

    return updatedRole;
  }

  // Delete custom role (soft delete)
  async deleteCustomRole(roleKey: string): Promise<void> {
    const role = await this.customRoleModel.findOne({
      key: roleKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });

    if (!role) {
      throw new Error(`Role with key "${roleKey}" not found`);
    }

    // Check if role is assigned to any users
    const userRolesCount = await this.userCustomRoleModel.countDocuments({
      customRoleId: role._id,
      isDeleted: false,
    });

    if (userRolesCount > 0) {
      throw new Error(
        `Cannot delete role "${roleKey}" as it is assigned to ${userRolesCount} user(s)`,
      );
    }

    // Soft delete the role
    await this.customRoleModel.findByIdAndUpdate(role._id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    // Also soft delete all role-permission assignments
    await this.customRolePermissionModel.updateMany(
      { customRoleId: role._id, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );
  }

  // Update permission
  async updatePermission(
    permissionKey: string,
    updateData: { module?: string; action?: string; description?: string },
  ): Promise<Permission> {
    const permission = await this.permissionModel.findOne({
      key: permissionKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });

    if (!permission) {
      throw new Error(`Permission with key "${permissionKey}" not found`);
    }

    const updatedPermission = await this.permissionModel.findByIdAndUpdate(
      permission._id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    );

    if (!updatedPermission) {
      throw new Error('Failed to update permission');
    }

    return updatedPermission;
  }

  // Delete permission (soft delete)
  async deletePermission(permissionKey: string): Promise<void> {
    const permission = await this.permissionModel.findOne({
      key: permissionKey,
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    });

    if (!permission) {
      throw new Error(`Permission with key "${permissionKey}" not found`);
    }

    // Check if permission is assigned to any roles
    const rolePermissionsCount =
      await this.customRolePermissionModel.countDocuments({
        permissionId: permission._id,
        isDeleted: false,
      });

    if (rolePermissionsCount > 0) {
      throw new Error(
        `Cannot delete permission "${permissionKey}" as it is assigned to ${rolePermissionsCount} role(s)`,
      );
    }

    // Soft delete the permission
    await this.permissionModel.findByIdAndUpdate(permission._id, {
      isDeleted: true,
      deletedAt: new Date(),
    });
  }
}

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RbacService, CustomRoleResponse } from './rbac.service';
import { CustomRole } from '../schemas/custom-role.schema';
import { Permission } from '../schemas/permission.schema';
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import {
  AssignRoleDto,
  BulkAssignRolesDto,
  AssignPermissionToRoleDto,
} from '../dto/assign-role.dto';

export interface RoleAssignmentResult {
  roleKey: string;
  status: string;
}

export interface ApiResponse<T> {
  message: string;
  data?: T;
  [key: string]: any;
}

@Injectable()
export class RbacManagementService {
  constructor(private rbacService: RbacService) {}

  async getAllCustomRoles(): Promise<CustomRole[]> {
    try {
      return await this.rbacService.getAllCustomRoles();
    } catch {
      throw new HttpException(
        'Failed to fetch custom roles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllPermissions(): Promise<Permission[]> {
    try {
      return await this.rbacService.getAllPermissions();
    } catch {
      throw new HttpException(
        'Failed to fetch permissions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getRolePermissions(roleKey: string): Promise<string[]> {
    try {
      return await this.rbacService.getRolePermissions(roleKey);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to fetch role permissions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserRoles(userId: string): Promise<CustomRoleResponse[]> {
    try {
      return await this.rbacService.getUserCustomRoles(userId);
    } catch {
      throw new HttpException(
        'Failed to fetch user roles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserPermissions(userId: string): Promise<ApiResponse<string[]>> {
    try {
      const permissions = await this.rbacService.getUserPermissions(userId);
      return {
        message: 'User permissions fetched successfully',
        permissions,
      };
    } catch {
      throw new HttpException(
        'Failed to fetch user permissions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async assignRoleToUser(
    userId: string,
    assignRoleDto: AssignRoleDto,
  ): Promise<ApiResponse<any>> {
    try {
      await this.rbacService.assignRoleToUser(userId, assignRoleDto.roleKey);
      return {
        message: 'Role assigned successfully',
        userId,
        roleKey: assignRoleDto.roleKey,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to assign role to user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async bulkAssignRolesToUser(
    userId: string,
    bulkAssignDto: BulkAssignRolesDto,
  ): Promise<ApiResponse<RoleAssignmentResult[]>> {
    try {
      const results: RoleAssignmentResult[] = [];
      for (const roleKey of bulkAssignDto.roleKeys) {
        await this.rbacService.assignRoleToUser(userId, roleKey);
        results.push({ roleKey, status: 'assigned' });
      }
      return {
        message: 'Roles assigned successfully',
        userId,
        results,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to assign roles to user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeRoleFromUser(
    userId: string,
    roleKey: string,
  ): Promise<ApiResponse<any>> {
    try {
      await this.rbacService.removeRoleFromUser(userId, roleKey);
      return {
        message: 'Role removed successfully',
        userId,
        roleKey,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to remove role from user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createCustomRole(
    createRoleDto: CreateRoleDto,
  ): Promise<ApiResponse<CustomRole>> {
    try {
      const role = await this.rbacService.createCustomRole(
        createRoleDto.key,
        createRoleDto.name,
        createRoleDto.description,
      );
      return {
        message: 'Role created successfully',
        role,
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new HttpException(
          'Role with this key already exists',
          HttpStatus.CONFLICT,
        );
      }
      throw new HttpException(
        'Failed to create role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createPermission(
    createPermissionDto: CreatePermissionDto,
  ): Promise<ApiResponse<Permission>> {
    try {
      const permission = await this.rbacService.createPermission(
        createPermissionDto.key,
        createPermissionDto.module,
        createPermissionDto.action,
        createPermissionDto.description,
      );
      return {
        message: 'Permission created successfully',
        permission,
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: number }).code === 11000
      ) {
        throw new HttpException(
          'Permission with this key already exists',
          HttpStatus.CONFLICT,
        );
      }
      throw new HttpException(
        'Failed to create permission',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async assignPermissionToRole(
    roleKey: string,
    assignPermissionDto: AssignPermissionToRoleDto,
  ): Promise<ApiResponse<any>> {
    try {
      await this.rbacService.assignPermissionToRole(
        roleKey,
        assignPermissionDto.permissionKey,
      );
      return {
        message: 'Permission assigned to role successfully',
        roleKey,
        permissionKey: assignPermissionDto.permissionKey,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to assign permission to role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removePermissionFromRole(
    roleKey: string,
    permissionKey: string,
  ): Promise<ApiResponse<any>> {
    try {
      await this.rbacService.removePermissionFromRole(roleKey, permissionKey);
      return {
        message: 'Permission removed from role successfully',
        roleKey,
        permissionKey,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to remove permission from role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUsersWithRole(roleKey: string): Promise<ApiResponse<string[]>> {
    try {
      const userIds = await this.rbacService.getUsersWithRole(roleKey);
      return {
        message: 'Users with role fetched successfully',
        roleKey,
        userIds,
        count: userIds.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to fetch users with role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkUserPermission(
    userId: string,
    permissionKey: string,
  ): Promise<ApiResponse<boolean>> {
    try {
      const hasPermission = await this.rbacService.userHasPermission(
        userId,
        permissionKey,
      );
      return {
        message: 'Permission check completed',
        userId,
        permissionKey,
        hasPermission,
      };
    } catch {
      throw new HttpException(
        'Failed to check user permission',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

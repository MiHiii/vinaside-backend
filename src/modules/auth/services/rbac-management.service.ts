import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RbacService, CustomRoleResponse } from './rbac.service';
import { CustomRole } from '../schemas/custom-role.schema';
import { Permission } from '../schemas/permission.schema';
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import {
  AssignRoleDto,
  BulkAssignRolesDto,
  AssignPermissionToRoleDto,
} from '../dto/assign-role.dto';
import { UsersService } from '../../users/users.service';

export interface RoleAssignmentResult {
  roleKey: string;
  status: string;
}

@Injectable()
export class RbacManagementService {
  constructor(
    private rbacService: RbacService,
    private usersService: UsersService,
  ) {}

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

  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      return await this.rbacService.getUserPermissions(userId);
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
  ): Promise<{ success: boolean }> {
    try {
      await this.rbacService.assignRoleToUser(userId, assignRoleDto.roleKey);
      // Update the user's role field in the user collection
      await this.usersService.updateUserRoleById(userId, assignRoleDto.roleKey);
      return { success: true };
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
  ): Promise<RoleAssignmentResult[]> {
    try {
      const results: RoleAssignmentResult[] = [];
      for (const roleKey of bulkAssignDto.roleKeys) {
        await this.rbacService.assignRoleToUser(userId, roleKey);
        results.push({ roleKey, status: 'assigned' });
      }
      return results;
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
  ): Promise<{ success: boolean }> {
    try {
      await this.rbacService.removeRoleFromUser(userId, roleKey);
      return { success: true };
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

  async createCustomRole(createRoleDto: CreateRoleDto): Promise<CustomRole> {
    try {
      return await this.rbacService.createCustomRole(
        createRoleDto.key,
        createRoleDto.name,
        createRoleDto.description,
      );
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
  ): Promise<Permission> {
    try {
      return await this.rbacService.createPermission(
        createPermissionDto.key,
        createPermissionDto.module,
        createPermissionDto.action,
        createPermissionDto.description,
      );
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
  ): Promise<{ success: boolean }> {
    try {
      await this.rbacService.assignPermissionToRole(
        roleKey,
        assignPermissionDto.permissionKey,
      );
      return { success: true };
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
  ): Promise<{ success: boolean }> {
    try {
      await this.rbacService.removePermissionFromRole(roleKey, permissionKey);
      return { success: true };
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

  async getUsersWithRole(roleKey: string): Promise<string[]> {
    try {
      return await this.rbacService.getUsersWithRole(roleKey);
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
  ): Promise<boolean> {
    try {
      return await this.rbacService.userHasPermission(userId, permissionKey);
    } catch {
      throw new HttpException(
        'Failed to check user permission',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateCustomRole(
    roleKey: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<CustomRole> {
    try {
      return await this.rbacService.updateCustomRole(roleKey, updateRoleDto);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to update role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteCustomRole(roleKey: string): Promise<{ success: boolean }> {
    try {
      await this.rbacService.deleteCustomRole(roleKey);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      if (errorMessage.includes('Cannot delete role')) {
        throw new HttpException(errorMessage, HttpStatus.CONFLICT);
      }
      throw new HttpException(
        'Failed to delete role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updatePermission(
    permissionKey: string,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    try {
      return await this.rbacService.updatePermission(
        permissionKey,
        updatePermissionDto,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to update permission',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deletePermission(permissionKey: string): Promise<{ success: boolean }> {
    try {
      await this.rbacService.deletePermission(permissionKey);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        throw new HttpException(errorMessage, HttpStatus.NOT_FOUND);
      }
      if (errorMessage.includes('Cannot delete permission')) {
        throw new HttpException(errorMessage, HttpStatus.CONFLICT);
      }
      throw new HttpException(
        'Failed to delete permission',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

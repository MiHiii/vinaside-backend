import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { RbacManagementService } from '../services/rbac-management.service';
import { RequirePermission } from '../../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import {
  AssignRoleDto,
  BulkAssignRolesDto,
  AssignPermissionToRoleDto,
} from '../dto/assign-role.dto';

@ApiTags('RBAC Management')
@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true }))
export class RbacController {
  constructor(private rbacManagementService: RbacManagementService) {}

  @Get('roles')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Get all custom roles' })
  @ApiResponse({ status: 200, description: 'List of custom roles' })
  async getAllCustomRoles() {
    return this.rbacManagementService.getAllCustomRoles();
  }

  @Get('permissions')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, description: 'List of permissions' })
  async getAllPermissions() {
    return this.rbacManagementService.getAllPermissions();
  }

  @Get('roles/:roleKey/permissions')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Get permissions for a specific role' })
  @ApiResponse({ status: 200, description: 'List of role permissions' })
  async getRolePermissions(@Param('roleKey') roleKey: string) {
    return this.rbacManagementService.getRolePermissions(roleKey);
  }

  @Get('users/:userId/roles')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Get user roles' })
  @ApiResponse({ status: 200, description: 'List of user roles' })
  async getUserRoles(@Param('userId') userId: string) {
    return this.rbacManagementService.getUserRoles(userId);
  }

  @Get('users/:userId/permissions')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Get user permissions' })
  @ApiResponse({ status: 200, description: 'List of user permissions' })
  async getUserPermissions(@Param('userId') userId: string) {
    return this.rbacManagementService.getUserPermissions(userId);
  }

  @Post('users/:userId/roles')
  @RequirePermission('user.edit')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    return this.rbacManagementService.assignRoleToUser(userId, assignRoleDto);
  }

  @Post('users/:userId/roles/bulk')
  @RequirePermission('user.edit')
  @ApiOperation({ summary: 'Assign multiple roles to user' })
  @ApiResponse({ status: 201, description: 'Roles assigned successfully' })
  async bulkAssignRolesToUser(
    @Param('userId') userId: string,
    @Body() bulkAssignDto: BulkAssignRolesDto,
  ) {
    return this.rbacManagementService.bulkAssignRolesToUser(
      userId,
      bulkAssignDto,
    );
  }

  @Delete('users/:userId/roles/:roleKey')
  @RequirePermission('user.edit')
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleKey') roleKey: string,
  ) {
    return this.rbacManagementService.removeRoleFromUser(userId, roleKey);
  }

  @Post('roles')
  @RequirePermission('user.edit')
  @ApiOperation({ summary: 'Create new custom role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  async createCustomRole(@Body() createRoleDto: CreateRoleDto) {
    return this.rbacManagementService.createCustomRole(createRoleDto);
  }

  @Post('permissions')
  @RequirePermission('user.edit')
  @ApiOperation({ summary: 'Create new permission' })
  @ApiResponse({ status: 201, description: 'Permission created successfully' })
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return this.rbacManagementService.createPermission(createPermissionDto);
  }

  @Post('roles/:roleKey/permissions')
  @RequirePermission('user.edit')
  @ApiOperation({ summary: 'Assign permission to role' })
  @ApiResponse({ status: 201, description: 'Permission assigned successfully' })
  async assignPermissionToRole(
    @Param('roleKey') roleKey: string,
    @Body() assignPermissionDto: AssignPermissionToRoleDto,
  ) {
    return this.rbacManagementService.assignPermissionToRole(
      roleKey,
      assignPermissionDto,
    );
  }

  @Delete('roles/:roleKey/permissions/:permissionKey')
  @RequirePermission('user.edit')
  @ApiOperation({ summary: 'Remove permission from role' })
  @ApiResponse({ status: 200, description: 'Permission removed successfully' })
  async removePermissionFromRole(
    @Param('roleKey') roleKey: string,
    @Param('permissionKey') permissionKey: string,
  ) {
    return this.rbacManagementService.removePermissionFromRole(
      roleKey,
      permissionKey,
    );
  }

  @Get('roles/:roleKey/users')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Get users with specific role' })
  @ApiResponse({ status: 200, description: 'List of user IDs with the role' })
  async getUsersWithRole(@Param('roleKey') roleKey: string) {
    return this.rbacManagementService.getUsersWithRole(roleKey);
  }

  @Get('users/:userId/permissions/:permissionKey/check')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Check if user has specific permission' })
  @ApiResponse({ status: 200, description: 'Permission check result' })
  async checkUserPermission(
    @Param('userId') userId: string,
    @Param('permissionKey') permissionKey: string,
  ) {
    return this.rbacManagementService.checkUserPermission(
      userId,
      permissionKey,
    );
  }
}

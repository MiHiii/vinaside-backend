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
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('RBAC Management')
@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true }))
export class RbacController {
  constructor(private rbacManagementService: RbacManagementService) {}

  @Get('roles')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Lấy tất cả vai trò tùy chỉnh' })
  @ApiResponse({ status: 200, description: 'Danh sách vai trò' })
  async getAllRoles() {
    return this.rbacManagementService.getAllCustomRoles();
  }

  @Get('permissions')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Lấy tất cả quyền' })
  @ApiResponse({ status: 200, description: 'Danh sách quyền' })
  async getAllPermissions() {
    return this.rbacManagementService.getAllPermissions();
  }

  @Get('roles/:roleId/permissions')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Lấy quyền cho một vai trò cụ thể' })
  @ApiResponse({ status: 200, description: 'Danh sách quyền của vai trò' })
  async getRolePermissions(@Param('roleId') roleId: string) {
    return this.rbacManagementService.getRolePermissions(roleId);
  }

  @Get('users/:userId/roles')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Lấy vai trò của người dùng' })
  @ApiResponse({ status: 200, description: 'Danh sách vai trò của người dùng' })
  async getUserRoles(@Param('userId') userId: string) {
    return this.rbacManagementService.getUserRoles(userId);
  }

  @Get('users/:userId/permissions')
  @RequirePermission('user.view')
  @ApiOperation({ summary: 'Lấy quyền của người dùng' })
  @ApiResponse({ status: 200, description: 'Danh sách quyền của người dùng' })
  async getUserPermissions(@Param('userId') userId: string) {
    return this.rbacManagementService.getUserPermissions(userId);
  }

  @Post('users/:userId/roles')
  @RequirePermission('user.manage_roles')
  @ApiOperation({ summary: 'Gán vai trò cho người dùng' })
  @ApiResponse({ status: 200, description: 'Vai trò được gán thành công' })
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() body: { roleKey: string },
  ) {
    return this.rbacManagementService.assignRoleToUser(userId, {
      roleKey: body.roleKey,
    });
  }

  @Delete('users/:userId/roles/:roleKey')
  @RequirePermission('user.manage_roles')
  @ApiOperation({ summary: 'Gỡ bỏ vai trò khỏi người dùng' })
  @ApiResponse({ status: 200, description: 'Vai trò được gỡ bỏ thành công' })
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleKey') roleKey: string,
  ) {
    return this.rbacManagementService.removeRoleFromUser(userId, roleKey);
  }

  @Post('roles')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Tạo vai trò tùy chỉnh mới' })
  @ApiResponse({ status: 201, description: 'Vai trò được tạo thành công' })
  async createRole(@Body() roleData: CreateRoleDto) {
    return this.rbacManagementService.createCustomRole(roleData);
  }

  @Post('permissions')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Tạo quyền mới' })
  @ApiResponse({ status: 201, description: 'Quyền được tạo thành công' })
  async createPermission(@Body() permissionData: CreatePermissionDto) {
    return this.rbacManagementService.createPermission(permissionData);
  }

  @Post('roles/:roleKey/permissions')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Gán quyền cho vai trò' })
  @ApiResponse({
    status: 200,
    description: 'Quyền được gán cho vai trò thành công',
  })
  async assignPermissionToRole(
    @Param('roleKey') roleKey: string,
    @Body() body: { permissionKey: string },
  ) {
    return this.rbacManagementService.assignPermissionToRole(roleKey, {
      permissionKey: body.permissionKey,
    });
  }

  @Delete('roles/:roleKey/permissions/:permissionKey')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Gỡ bỏ quyền khỏi vai trò' })
  @ApiResponse({
    status: 200,
    description: 'Quyền được gỡ bỏ khỏi vai trò thành công',
  })
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
  @ApiOperation({ summary: 'Lấy người dùng có vai trò cụ thể' })
  @ApiResponse({ status: 200, description: 'Danh sách người dùng có vai trò' })
  async getUsersWithRole(@Param('roleKey') roleKey: string) {
    return this.rbacManagementService.getUsersWithRole(roleKey);
  }

  @Get('check-permission/:userId/:permissionKey')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Kiểm tra người dùng có quyền cụ thể không' })
  @ApiResponse({ status: 200, description: 'Kết quả kiểm tra quyền' })
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

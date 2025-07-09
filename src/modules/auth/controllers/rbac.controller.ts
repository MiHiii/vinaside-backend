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
  BadRequestException,
} from '@nestjs/common';
import { RbacManagementService } from '../services/rbac-management.service';
import { RequirePermission } from '../../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CreateRoleDto } from '../dto/create-role.dto';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import {
  AssignRoleToUserDto,
  AssignPermissionToRoleDto,
} from '../dto/assign-role.dto';
import { ResponseMessage } from '../../../decorators/response-message.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
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
  @ResponseMessage('Lấy danh sách vai trò thành công.')
  async getAllRoles() {
    return this.rbacManagementService.getAllCustomRoles();
  }

  @Get('permissions')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Lấy tất cả quyền' })
  @ApiResponse({ status: 200, description: 'Danh sách quyền' })
  @ResponseMessage('Lấy danh sách quyền thành công.')
  async getAllPermissions() {
    return this.rbacManagementService.getAllPermissions();
  }

  @Get('permissions/admin')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Lấy tất cả quyền (bao gồm quyền hệ thống) - chỉ dành cho admin' })
  @ApiResponse({ status: 200, description: 'Danh sách quyền đầy đủ' })
  @ResponseMessage('Lấy danh sách quyền đầy đủ thành công.')
  async getAllPermissionsForAdmin() {
    return this.rbacManagementService.getAllPermissionsForAdmin();
  }

  @Get('roles/:roleId/permissions')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Lấy quyền cho một vai trò cụ thể' })
  @ApiResponse({ status: 200, description: 'Danh sách quyền của vai trò' })
  @ResponseMessage('Lấy quyền của vai trò thành công.')
  async getRolePermissions(@Param('roleId') roleId: string) {
    return this.rbacManagementService.getRolePermissions(roleId);
  }

  @Get('users/:userId/roles')
  @RequirePermission('user.view_private_info')
  @ApiOperation({ summary: 'Lấy vai trò của người dùng' })
  @ApiResponse({ status: 200, description: 'Danh sách vai trò của người dùng' })
  @ResponseMessage('Lấy vai trò của người dùng thành công.')
  async getUserRoles(@Param('userId') userId: string) {
    return this.rbacManagementService.getUserRoles(userId);
  }

  @Get('users/:userId/permissions')
  @RequirePermission('user.view_private_info')
  @ApiOperation({ summary: 'Lấy quyền của người dùng' })
  @ApiResponse({ status: 200, description: 'Danh sách quyền của người dùng' })
  @ResponseMessage('Lấy quyền của người dùng thành công.')
  async getUserPermissions(@Param('userId') userId: string) {
    return this.rbacManagementService.getUserPermissions(userId);
  }

  @Post('users/:userId/roles')
  @RequirePermission('user.manage_roles')
  @ApiOperation({ summary: 'Gán vai trò cho người dùng' })
  @ApiResponse({ status: 200, description: 'Vai trò được gán thành công' })
  @ApiBody({ type: AssignRoleToUserDto })
  @ResponseMessage('Gán vai trò cho người dùng thành công.')
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() assignRoleDto: AssignRoleToUserDto,
  ) {
    try {
      if (!assignRoleDto?.roleKey) {
        throw new BadRequestException('roleKey là bắt buộc');
      }

      return this.rbacManagementService.assignRoleToUser(userId, assignRoleDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Lỗi khi gán vai trò cho người dùng',
      );
    }
  }

  @Delete('users/:userId/roles/:roleKey')
  @RequirePermission('user.manage_roles')
  @ApiOperation({ summary: 'Gỡ bỏ vai trò khỏi người dùng' })
  @ApiResponse({ status: 200, description: 'Vai trò được gỡ bỏ thành công' })
  @ResponseMessage('Gỡ bỏ vai trò khỏi người dùng thành công.')
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
  @ResponseMessage('Tạo vai trò thành công.')
  async createRole(@Body() roleData: CreateRoleDto) {
    return this.rbacManagementService.createCustomRole(roleData);
  }

  @Post('permissions')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Tạo quyền mới' })
  @ApiResponse({ status: 201, description: 'Quyền được tạo thành công' })
  @ResponseMessage('Tạo quyền thành công.')
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
  @ApiBody({ type: AssignPermissionToRoleDto })
  @ResponseMessage('Gán quyền cho vai trò thành công.')
  async assignPermissionToRole(
    @Param('roleKey') roleKey: string,
    @Body() assignPermissionDto: AssignPermissionToRoleDto,
  ) {
    try {
      if (!assignPermissionDto?.permissionKey) {
        throw new BadRequestException('permissionKey là bắt buộc');
      }

      return this.rbacManagementService.assignPermissionToRole(
        roleKey,
        assignPermissionDto,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Lỗi khi gán quyền cho vai trò',
      );
    }
  }

  @Delete('roles/:roleKey/permissions/:permissionKey')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Gỡ bỏ quyền khỏi vai trò' })
  @ApiResponse({
    status: 200,
    description: 'Quyền được gỡ bỏ khỏi vai trò thành công',
  })
  @ResponseMessage('Gỡ bỏ quyền khỏi vai trò thành công.')
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
  @ResponseMessage('Lấy người dùng có vai trò thành công.')
  async getUsersWithRole(@Param('roleKey') roleKey: string) {
    return this.rbacManagementService.getUsersWithRole(roleKey);
  }

  @Get('check-permission/:userId/:permissionKey')
  @RequirePermission('system.manage')
  @ApiOperation({ summary: 'Kiểm tra người dùng có quyền cụ thể không' })
  @ApiResponse({ status: 200, description: 'Kết quả kiểm tra quyền' })
  @ResponseMessage('Kiểm tra quyền thành công.')
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

import { IsString, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({
    description: 'Key của vai trò cần gán',
    example: 'property_manager',
  })
  @IsString()
  @IsNotEmpty()
  roleKey: string;
}

export class AssignRoleToUserDto {
  @ApiProperty({
    description: 'Key của vai trò cần gán cho user',
    example: 'property_manager',
  })
  @IsString()
  @IsNotEmpty()
  roleKey: string;
}

export class BulkAssignRolesDto {
  @ApiProperty({
    description: 'Danh sách keys của các vai trò cần gán',
    example: ['property_manager', 'booking_manager'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  roleKeys: string[];
}

export class AssignPermissionToRoleDto {
  @ApiProperty({
    description: 'Key của quyền cần gán cho vai trò',
    example: 'property.create',
  })
  @IsString()
  @IsNotEmpty()
  permissionKey: string;
}

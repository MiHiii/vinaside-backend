import { IsString, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({
    description: 'Role key to assign',
    example: 'reviewer',
  })
  @IsString()
  @IsNotEmpty()
  roleKey: string;
}

export class BulkAssignRolesDto {
  @ApiProperty({
    description: 'Array of role keys to assign',
    example: ['reviewer', 'support_staff'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  roleKeys: string[];
}

export class AssignPermissionToRoleDto {
  @ApiProperty({
    description: 'Permission key to assign',
    example: 'listing.verify',
  })
  @IsString()
  @IsNotEmpty()
  permissionKey: string;
}

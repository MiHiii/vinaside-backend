import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'ID người dùng' })
  _id: string;

  @ApiProperty({ description: 'Tên đăng nhập', required: false })
  username?: string;

  @ApiProperty({ description: 'Email người dùng' })
  email: string;

  @ApiProperty({ description: 'Tên hiển thị', required: false })
  name?: string;

  @ApiProperty({ description: 'URL ảnh đại diện', required: false })
  avatar_url?: string;

  @ApiProperty({ description: 'Vai trò người dùng', required: false })
  role?: string;

  @ApiProperty({ description: 'Số điện thoại', required: false })
  phone?: string;

  @ApiProperty({ description: 'Thời gian tin nhắn cuối', required: false })
  lastMessageAt?: Date;

  @ApiProperty({ description: 'Trạng thái xác thực', required: false })
  is_verified?: boolean;

  @ApiProperty({ description: 'Có lịch sử chat hay không', required: false })
  hasMessageHistory?: boolean;

  @ApiProperty({ description: 'Thời gian tạo tài khoản', required: false })
  createdAt?: Date;

  @ApiProperty({ description: 'Thời gian cập nhật', required: false })
  updatedAt?: Date;
}

export class UserProfileResponseDto extends UserResponseDto {
  @ApiProperty({ description: 'Có lịch sử chat với user hiện tại' })
  declare hasMessageHistory: boolean;
}

export class ConversationUserDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ description: 'Tin nhắn cuối cùng' })
  lastMessage: any;

  @ApiProperty({ description: 'Số tin nhắn chưa đọc' })
  unreadCount: number;
}

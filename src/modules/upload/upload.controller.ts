import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  MaxFileSizeValidator,
  HttpStatus,
  BadRequestException,
  Query,
  HttpCode,
  ParseFilePipe,
  Request,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../decorators/roles.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('File Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('admin')
  @RequirePermission('upload.manage')
  @ApiOperation({ summary: 'Tải lên tệp (Admin)' })
  @ApiResponse({ status: 200, description: 'Tệp được tải lên thành công' })
  @ApiResponse({ status: 400, description: 'Lỗi xác thực' })
  async uploadAdminFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: Record<string, any>,
  ) {
    if (!files?.length) {
      throw new BadRequestException('Không tìm thấy tệp nào');
    }

    return this.uploadService.uploadFiles(files, body);
  }

  @Post('room')
  @RequirePermission('listing.edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tải lên hình ảnh phòng/listing' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Hình ảnh phòng được tải lên thành công',
  })
  @ResponseMessage('Tải lên ảnh phòng thành công')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadRoomImages(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
      }),
    )
    files: Express.Multer.File[],
    @Query('roomId') roomId: string,
    @Request() req: RequestWithUser,
  ) {
    if (!roomId) {
      throw new BadRequestException('roomId là bắt buộc');
    }

    // Lấy userId từ JWT token
    const userId = req.user._id;

    return this.uploadService.uploadRoomImages(files, roomId, userId);
  }

  @Post('user')
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tải lên hình ảnh avatar/profile người dùng' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Hình ảnh người dùng được tải lên thành công',
  })
  @ResponseMessage('Tải lên ảnh người dùng thành công')
  @UseInterceptors(FilesInterceptor('files', 1))
  async uploadUserImages(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
      }),
    )
    files: Express.Multer.File[],
    @Request() req: RequestWithUser,
  ) {
    // Lấy userId từ JWT token
    const userId = req.user._id;

    return this.uploadService.uploadUserImages(files, userId);
  }
}

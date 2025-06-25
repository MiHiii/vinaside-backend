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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { UploadMetadataDto } from './dto/upload-response.dto';
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

  @Post()
  @RequirePermission('upload.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload files (Admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Files uploaded successfully' })
  @ResponseMessage('Tải lên ảnh thành công')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadFiles(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 15 * 1024 * 1024 })],
      }),
    )
    files: Express.Multer.File[],
    @Query('prefix') prefix?: string,
    @Query('userId') userId?: string,
    @Query('roomId') roomId?: string,
  ) {
    // Create metadata object if any query params are provided
    let metadata: UploadMetadataDto | undefined;
    if (prefix || userId || roomId) {
      metadata = { prefix, userId, roomId };
    }

    return this.uploadService.uploadFiles(files, metadata);
  }

  @Post('room')
  @RequirePermission('listing.edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload room/listing images' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Room images uploaded successfully',
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
      throw new BadRequestException('roomId is required');
    }

    // Lấy userId từ JWT token
    const userId = req.user._id;

    return this.uploadService.uploadRoomImages(files, roomId, userId);
  }

  @Post('user')
  @Roles('guest', 'staff', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload user avatar/profile images' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'User images uploaded successfully',
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

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  UploadResponseDto,
  UploadMetadataDto,
  UserFileResponseDto,
} from './dto/upload-response.dto';
import * as AWS from 'aws-sdk';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { UploadRepository } from './repositories/upload.repository';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly tempDir = path.join(process.cwd(), 'temp');
  private readonly s3: AWS.S3;
  private readonly bucketName: string;
  private readonly cdnUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadRepository: UploadRepository,
  ) {
    // Đảm bảo thư mục temp tồn tại
    fs.ensureDirSync(this.tempDir);

    // Lấy các giá trị cấu hình từ environment
    const region = this.configService.get<string>('DO_SPACES_REGION', 'sgp1');
    const accessKey = this.configService.get<string>('DO_SPACES_KEY');
    const secretKey = this.configService.get<string>('DO_SPACES_SECRET');
    this.bucketName = this.configService.get<string>(
      'DO_SPACES_BUCKET',
      'vinaside',
    );

    // Log cấu hình (masked) để debug
    this.logger.log(
      `Configuring S3 client with region: ${region}, bucket: ${this.bucketName}`,
    );
    this.logger.log(`Access key provided: ${accessKey ? 'Yes' : 'No'}`);
    this.logger.log(`Secret key provided: ${secretKey ? 'Yes' : 'No'}`);

    // Khởi tạo S3 client cho Digital Ocean Spaces
    const spacesEndpoint = new AWS.Endpoint(`${region}.digitaloceanspaces.com`);

    this.s3 = new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    this.cdnUrl = this.configService.get<string>(
      'DO_SPACES_CDN_URL',
      `https://${this.bucketName}.${region}.cdn.digitaloceanspaces.com`,
    );

    this.logger.log(
      `S3 client configured with endpoint: ${region}.digitaloceanspaces.com`,
    );
    this.logger.log(`CDN URL: ${this.cdnUrl}`);
  }

  /**
   * Cấu hình Multer cho upload ảnh
   */
  getMulterConfig(maxFiles: number = 50, maxSize: number = 15): MulterOptions {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'temp');
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: maxSize * 1024 * 1024,
        files: maxFiles,
      },
    };
  }

  /**
   * Upload nhiều file cùng lúc
   * @param files Danh sách file cần upload
   * @param metadata Metadata tùy chọn (prefix, userId, roomId, category)
   */
  async uploadFiles(
    files: Express.Multer.File[],
    metadata?: UploadMetadataDto,
  ): Promise<UploadResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    try {
      this.logger.log(`Uploading ${files.length} files...`);

      // Upload file song song để tăng hiệu suất
      const uploadPromises = files.map((file) =>
        this.uploadToS3(file, metadata),
      );
      const results = await Promise.all(uploadPromises);

      this.logger.log(`Successfully uploaded ${results.length} files`);

      return {
        urls: results.map((result) => result.url),
        keys: results.map((result) => result.key),
        originalNames: files.map((file) => file.originalname),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tải lên các file: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Lỗi không xác định khi tải lên các file');
      }
      throw new InternalServerErrorException('Không thể tải lên các file');
    } finally {
      // Dọn dẹp file tạm
      await this.cleanupTempFiles(files);
    }
  }

  /**
   * Upload file cho phòng
   */
  async uploadRoomImages(
    files: Express.Multer.File[],
    roomId: string,
    userId?: string,
  ): Promise<UploadResponseDto> {
    if (!roomId) {
      throw new BadRequestException('Room ID là bắt buộc');
    }

    return this.uploadFiles(files, {
      prefix: 'room_',
      roomId,
      userId,
    });
  }

  /**
   * Upload file cho người dùng
   */
  async uploadUserImages(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<UploadResponseDto> {
    if (!userId) {
      throw new BadRequestException('User ID là bắt buộc');
    }

    return this.uploadFiles(files, {
      prefix: 'user_',
      userId,
    });
  }

  /**
   * Dọn dẹp file tạm sau khi upload
   */
  private async cleanupTempFiles(files: Express.Multer.File[]): Promise<void> {
    if (!files || !Array.isArray(files)) return;

    for (const file of files) {
      try {
        if (!file || !file.path) continue;
        if (fs.existsSync(file.path)) {
          await fs.remove(file.path);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.warn(
            `Không thể xóa file tạm ${file?.path || 'unknown'}: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Upload một file lên S3
   */
  private async uploadToS3(
    file: Express.Multer.File,
    metadata?: UploadMetadataDto,
  ): Promise<{ url: string; key: string }> {
    if (!file || !file.path) {
      throw new BadRequestException(
        `File không hợp lệ hoặc thiếu path: ${file?.originalname || 'unknown'}`,
      );
    }

    if (!fs.existsSync(file.path)) {
      throw new BadRequestException(`File path không tồn tại: ${file.path}`);
    }

    try {
      this.logger.log(
        `Uploading file ${file.originalname} (${file.size} bytes)`,
      );

      // Tạo key cho file dựa trên category
      const category = metadata?.category || 'general';
      const prefix = metadata?.prefix || '';

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      const key = `${category}/${prefix}${uniqueSuffix}${ext}`;

      // Đọc file để upload
      const fileContent = await fs.readFile(file.path);

      // Upload file lên S3
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileContent,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };

      this.logger.log(
        `Uploading to S3 bucket: ${this.bucketName}, key: ${key}`,
      );
      await this.s3.upload(params).promise();

      const fileUrl = `${this.cdnUrl}/${key}`;
      this.logger.log(`File uploaded successfully, URL: ${fileUrl}`);

      // Trả về URL và key
      return { url: fileUrl, key };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tải lên file ${file.originalname}: ${error.message}`,
          error.stack,
        );

        // Kiểm tra lỗi AWS cụ thể
        const awsError = error as AWS.AWSError;
        if (awsError.code) {
          this.logger.error(
            `AWS Error code: ${awsError.code}, message: ${awsError.message}`,
          );

          if (
            awsError.code === 'AccessDenied' ||
            awsError.code === 'CredentialsError'
          ) {
            throw new ServiceUnavailableException(
              'Không thể kết nối đến Digital Ocean Spaces - Lỗi xác thực',
            );
          }

          if (awsError.code === 'NoSuchBucket') {
            throw new ServiceUnavailableException(
              `Bucket "${this.bucketName}" không tồn tại`,
            );
          }
        }
      }

      throw new InternalServerErrorException(
        `Không thể tải lên file ${file.originalname}`,
      );
    }
  }

  /**
   * Xóa file từ S3 bucket
   * @param key Key của file trên S3
   */
  async deleteFile(key: string): Promise<void> {
    if (!key) {
      throw new BadRequestException('Key file là bắt buộc');
    }

    try {
      this.logger.log(`Deleting file with key: ${key}`);

      const params = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi xóa file ${key}: ${error.message}`,
          error.stack,
        );

        const awsError = error as AWS.AWSError;
        if (awsError.code === 'NoSuchKey') {
          throw new BadRequestException('File không tồn tại');
        }
      }
      throw new InternalServerErrorException(`Không thể xóa file ${key}`);
    }
  }

  /**
   * Upload file data (Excel/CSV) với validation riêng
   * @param file File Excel/CSV
   * @param metadata Metadata tùy chọn
   */
  async uploadDataFile(
    file: Express.Multer.File,
    metadata?: UploadMetadataDto,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Chỉ chấp nhận file Excel (.xls, .xlsx) hoặc CSV',
      );
    }

    try {
      this.logger.log(`Uploading data file: ${file.originalname}`);

      const result = await this.uploadToS3(file, {
        ...metadata,
        category: 'document',
        prefix: 'data_',
      });

      return {
        urls: [result.url],
        keys: [result.key],
        originalNames: [file.originalname],
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Lỗi khi tải lên file data: ${error.message}`,
          error.stack,
        );
      }
      throw new InternalServerErrorException('Không thể tải lên file data');
    } finally {
      // Dọn dẹp file tạm
      await this.cleanupTempFiles([file]);
    }
  }

  /**
   * Cấu hình Multer cho upload file data (Excel/CSV)
   */
  getDataFileMulterConfig(): MulterOptions {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'temp');
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `data_${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Chỉ chấp nhận file Excel (.xls, .xlsx) hoặc CSV',
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1,
      },
    };
  }

  // ===== BUSINESS LOGIC METHODS =====

  /**
   * Xử lý upload 1 ảnh với validation
   */
  async handleSingleImageUpload(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    // Validate file type
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      throw new BadRequestException(
        'Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif, webp)',
      );
    }

    const result = await this.uploadFiles([file], {
      category: 'avatar',
      userId,
    });

    // Save metadata to repository
    await this.saveFileMetadata(file, result.urls[0], userId, 'image');

    return result;
  }

  /**
   * Xử lý upload nhiều ảnh với validation
   */
  async handleMultipleImagesUpload(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<UploadResponseDto> {
    if (!files?.length) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    if (files.length > 50) {
      throw new BadRequestException('Không được tải lên quá 50 ảnh cùng lúc');
    }

    // Validate file types
    for (const file of files) {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        throw new BadRequestException(
          `File ${file.originalname} không phải là ảnh hợp lệ`,
        );
      }
    }

    const result = await this.uploadFiles(files, {
      category: 'listing',
      userId,
    });

    // Save metadata for all files
    for (let i = 0; i < files.length; i++) {
      await this.saveFileMetadata(files[i], result.urls[i], userId, 'image');
    }

    return result;
  }

  /**
   * Xử lý upload file data với validation đặc biệt
   */
  async handleDataFileUpload(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    const result = await this.uploadDataFile(file, { userId });

    // Save metadata
    await this.saveFileMetadata(file, result.urls[0], userId, 'data');

    return result;
  }

  /**
   * Xử lý upload ảnh banner với validation
   */
  async handleBannerImageUpload(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    // Validate file type
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      throw new BadRequestException(
        'Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif, webp)',
      );
    }

    const result = await this.uploadFiles([file], {
      category: 'banner',
      userId,
    });

    // Save metadata to repository
    await this.saveFileMetadata(file, result.urls[0], userId, 'image');

    return result;
  }

  /**
   * Xử lý xóa file với validation quyền
   */
  async handleDeleteFile(
    key: string,
    userId: string,
    userRole: string,
  ): Promise<{ message: string; deletedKey: string }> {
    if (!key) {
      throw new BadRequestException('Key file là bắt buộc');
    }

    // Decode URL key
    const decodedKey = decodeURIComponent(key);

    // Validate quyền xóa (chỉ được xóa file của mình hoặc admin)
    if (userRole !== 'admin' && !decodedKey.includes(`users/${userId}/`)) {
      throw new BadRequestException('Bạn chỉ được xóa file của chính mình');
    }

    // Check if file exists in our repository
    const fileMetadata = await this.uploadRepository.findFileByKey(decodedKey);
    if (!fileMetadata) {
      this.logger.warn(`File metadata not found for key: ${decodedKey}`);
    }

    // Delete from S3
    await this.deleteFile(decodedKey);

    // Mark as deleted in repository
    if (fileMetadata) {
      await this.uploadRepository.markAsDeleted(decodedKey);
    }

    return {
      message: 'File đã được xóa thành công',
      deletedKey: decodedKey,
    };
  }

  /**
   * Lưu metadata file vào repository
   */
  private async saveFileMetadata(
    file: Express.Multer.File,
    url: string,
    userId: string,
    fileType: 'image' | 'data',
  ): Promise<void> {
    try {
      // Extract S3 key from URL
      const s3Key = url.replace(this.cdnUrl + '/', '');

      await this.uploadRepository.saveFileMetadata({
        fileName: file.filename || `${Date.now()}_${file.originalname}`,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        s3Key,
        url,
        userId,
        fileType,
        uploadedAt: new Date(),
      });

      this.logger.log(`File metadata saved for: ${file.originalname}`);
    } catch (error) {
      // Log error but don't fail the upload
      this.logger.error(
        `Failed to save file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Lấy danh sách file của user
   */
  async getUserFiles(userId: string): Promise<UserFileResponseDto[]> {
    const files = await this.uploadRepository.findFilesByUserId(userId);
    return files.map((file) => ({
      id: file.id!,
      fileName: file.fileName,
      originalName: file.originalName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      url: file.url,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,
    }));
  }

  /**
   * Lấy tất cả files (chỉ dành cho admin/manager)
   */
  async getAllFiles(): Promise<UserFileResponseDto[]> {
    const files = await this.uploadRepository.findAllFiles();

    return files.map((file) => ({
      id: file.id!,
      fileName: file.fileName,
      originalName: file.originalName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      url: file.url,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,
    }));
  }

  // ===== CONTROLLER WRAPPER METHODS =====

  /**
   * Wrapper method cho controller - xử lý upload single image với đầy đủ validation
   */
  async uploadSingleImageFromController(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    // Validate file existence
    if (!file) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File quá lớn. Kích thước tối đa: ${maxSize / 1024 / 1024}MB`,
      );
    }

    return this.handleSingleImageUpload(file, userId);
  }

  /**
   * Wrapper method cho controller - xử lý upload multiple images với đầy đủ validation
   */
  async uploadMultipleImagesFromController(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<UploadResponseDto> {
    // Validate files existence
    if (!files?.length) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    // Validate file count
    if (files.length > 50) {
      throw new BadRequestException('Không được tải lên quá 50 ảnh cùng lúc');
    }

    // Validate each file size (15MB)
    const maxSize = 15 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} quá lớn. Kích thước tối đa: ${maxSize / 1024 / 1024}MB`,
        );
      }
    }

    return this.handleMultipleImagesUpload(files, userId);
  }

  /**
   * Wrapper method cho controller - xử lý upload data file với đầy đủ validation
   */
  async uploadDataFileFromController(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    // Validate file existence
    if (!file) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File quá lớn. Kích thước tối đa: ${maxSize / 1024 / 1024}MB`,
      );
    }

    return this.handleDataFileUpload(file, userId);
  }

  /**
   * Wrapper method cho controller - xử lý upload banner image với đầy đủ validation
   */
  async uploadBannerImageFromController(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    // Validate file existence
    if (!file) {
      throw new BadRequestException('Không tìm thấy file nào');
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File quá lớn. Kích thước tối đa: ${maxSize / 1024 / 1024}MB`,
      );
    }

    return this.handleBannerImageUpload(file, userId);
  }

  /**
   * Wrapper method cho controller - xử lý delete file với đầy đủ validation
   */
  async deleteFileFromController(
    key: string,
    userId: string,
    userRole: string,
  ): Promise<{ message: string; deletedKey: string }> {
    // Validate key existence
    if (!key?.trim()) {
      throw new BadRequestException('Key file là bắt buộc');
    }

    return this.handleDeleteFile(key, userId, userRole);
  }

  /**
   * Wrapper method cho controller - lấy danh sách file với validation
   */
  async getUserFilesFromController(
    userId: string,
  ): Promise<UserFileResponseDto[]> {
    // Validate userId
    if (!userId?.trim()) {
      throw new BadRequestException('User ID là bắt buộc');
    }

    return this.getUserFiles(userId);
  }

  /**
   * Wrapper method cho controller - lấy tất cả files
   * Permission đã được validate ở controller level với @RequirePermission('upload.manage')
   */
  async getAllFilesFromController(): Promise<UserFileResponseDto[]> {
    return this.getAllFiles();
  }
}

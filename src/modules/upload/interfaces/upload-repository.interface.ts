export interface FileMetadata {
  id?: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  url: string;
  userId: string;
  fileType: 'image' | 'data';
  uploadedAt: Date;
  deletedAt?: Date;
}

export interface IUploadRepository {
  saveFileMetadata(metadata: Omit<FileMetadata, 'id'>): Promise<FileMetadata>;
  findFileByKey(s3Key: string): Promise<FileMetadata | null>;
  findFilesByUserId(userId: string): Promise<FileMetadata[]>;
  findAllFiles(): Promise<FileMetadata[]>;
  markAsDeleted(s3Key: string): Promise<void>;
  deleteFileMetadata(s3Key: string): Promise<void>;
}

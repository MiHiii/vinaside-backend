export interface FileUploadResult {
  url: string;
  key: string;
  originalName: string;
}

export class UploadResponseDto {
  urls: string[];
  keys: string[];
  originalNames: string[];
}

export type FileCategory =
  | 'listing'
  | 'avatar'
  | 'banner'
  | 'document'
  | 'general';

export class UploadMetadataDto {
  category?: FileCategory;
  prefix?: string;
  userId?: string;
  roomId?: string;
}

export interface UserFileResponseDto {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  fileType: string;
  uploadedAt: Date;
}

export class FileServerResponseDto {
  filenames: string[];
}

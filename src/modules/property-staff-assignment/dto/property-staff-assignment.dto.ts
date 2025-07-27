import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class AssignStaffDto {
  @IsMongoId()
  @IsNotEmpty()
  propertyId: Types.ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  staffId: Types.ObjectId;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UnassignStaffDto {
  @IsMongoId()
  @IsNotEmpty()
  propertyId: Types.ObjectId;

  @IsMongoId()
  @IsNotEmpty()
  staffId: Types.ObjectId;

  @IsOptional()
  @IsString()
  unassignNotes?: string;
}

export class GetStaffAssignmentsDto {
  @IsOptional()
  @IsMongoId()
  propertyId?: Types.ObjectId;

  @IsOptional()
  @IsMongoId()
  staffId?: Types.ObjectId;

  @IsOptional()
  @IsString()
  status?: string;
}

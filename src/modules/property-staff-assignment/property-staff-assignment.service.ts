import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PropertyStaffAssignmentRepo } from './property-staff-assignment.repo';
import {
  AssignStaffDto,
  UnassignStaffDto,
  GetStaffAssignmentsDto,
} from './dto/property-staff-assignment.dto';
import { PropertyStaffAssignmentDocument } from './schemas/property-staff-assignment.schema';

@Injectable()
export class PropertyStaffAssignmentService {
  constructor(
    private readonly propertyStaffAssignmentRepo: PropertyStaffAssignmentRepo,
  ) {}

  async assignStaff(
    assignStaffDto: AssignStaffDto,
    assignedById: string,
  ): Promise<PropertyStaffAssignmentDocument> {
    try {
      const assignment = await this.propertyStaffAssignmentRepo.assignStaff({
        propertyId: assignStaffDto.propertyId,
        staffId: assignStaffDto.staffId,
        assignedBy: new Types.ObjectId(assignedById),
        notes: assignStaffDto.notes,
      });

      return assignment;
    } catch (error: any) {
      if (
        error instanceof Error &&
        error.message === 'Staff đã được assign cho property này'
      ) {
        throw new BadRequestException('Staff đã được assign cho property này');
      }
      throw new BadRequestException(
        'Không thể assign staff: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }

  async unassignStaff(
    unassignStaffDto: UnassignStaffDto,
    unassignedById: string,
  ): Promise<PropertyStaffAssignmentDocument> {
    try {
      const assignment = await this.propertyStaffAssignmentRepo.unassignStaff({
        propertyId: unassignStaffDto.propertyId,
        staffId: unassignStaffDto.staffId,
        unassignedBy: new Types.ObjectId(unassignedById),
        unassignNotes: unassignStaffDto.unassignNotes,
      });

      if (!assignment) {
        throw new NotFoundException('Không tìm thấy assignment để unassign');
      }

      return assignment;
    } catch (error: any) {
      if (
        error instanceof Error &&
        error.message === 'Không tìm thấy assignment đang active'
      ) {
        throw new NotFoundException('Không tìm thấy assignment đang active');
      }
      throw new BadRequestException(
        'Không thể unassign staff: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  }

  async getStaffByProperty(
    propertyId: Types.ObjectId,
  ): Promise<PropertyStaffAssignmentDocument[]> {
    return this.propertyStaffAssignmentRepo.getStaffByProperty(propertyId);
  }

  async getStaffInfoByProperty(propertyId: Types.ObjectId): Promise<any[]> {
    const assignments =
      await this.propertyStaffAssignmentRepo.getStaffByProperty(propertyId);

    // Transform assignments to staff info format with avatar_url
    const staffInfoPromises = assignments.map(async (assignment) => {
      const staff = assignment.staffId as {
        _id?: Types.ObjectId;
        toString(): string;
      };
      const staffId = staff._id ? staff._id.toString() : staff.toString();

      // Lấy thông tin chi tiết từ collection users để có avatar_url
      const userInfo =
        await this.propertyStaffAssignmentRepo.getUserInfo(staffId);

      return {
        _id: staffId,
        name: userInfo?.name || 'Unknown',
        email: userInfo?.email || '',
        phone: userInfo?.phone || '',
        role: userInfo?.role || 'staff',
        avatar_url: userInfo?.avatar_url || '',
        is_online: false, // Có thể tích hợp với online status sau
        last_seen: new Date(),
      };
    });

    return Promise.all(staffInfoPromises);
  }

  async getPrimaryStaffByProperty(propertyId: Types.ObjectId): Promise<any> {
    const assignments =
      await this.propertyStaffAssignmentRepo.getStaffByProperty(propertyId);

    if (assignments.length === 0) {
      return null;
    }

    // Lấy staff đầu tiên (có thể sửa logic sau để lấy staff chính)
    const firstAssignment = assignments[0];
    const staff = firstAssignment.staffId as {
      _id?: Types.ObjectId;
      toString(): string;
    };
    const staffId = staff._id ? staff._id.toString() : staff.toString();

    // Lấy thông tin chi tiết từ collection users
    const userInfo =
      await this.propertyStaffAssignmentRepo.getUserInfo(staffId);

    return {
      _id: staffId,
      name: userInfo?.name || 'Unknown',
      email: userInfo?.email || '',
      phone: userInfo?.phone || '',
      role: userInfo?.role || 'staff',
      avatar_url: userInfo?.avatar_url || '',
      is_online: false,
      last_seen: new Date(),
      is_primary: true, // Đánh dấu là staff chính
    };
  }

  async getPropertiesByStaff(
    staffId: Types.ObjectId,
  ): Promise<PropertyStaffAssignmentDocument[]> {
    return this.propertyStaffAssignmentRepo.getPropertiesByStaff(staffId);
  }

  async getAssignmentHistory(
    queryDto: GetStaffAssignmentsDto,
  ): Promise<PropertyStaffAssignmentDocument[]> {
    return this.propertyStaffAssignmentRepo.getAssignmentHistory(
      queryDto.propertyId,
      queryDto.staffId,
    );
  }

  async isStaffAssignedToProperty(
    staffId: Types.ObjectId,
    propertyId: Types.ObjectId,
  ): Promise<boolean> {
    return this.propertyStaffAssignmentRepo.isStaffAssignedToProperty(
      staffId,
      propertyId,
    );
  }

  async getAllAssignments(): Promise<PropertyStaffAssignmentDocument[]> {
    return this.propertyStaffAssignmentRepo.getAssignmentHistory();
  }
}

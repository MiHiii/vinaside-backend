import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepo } from 'src/database/repo/base.repo';
import {
  PropertyStaffAssignment,
  PropertyStaffAssignmentDocument,
  AssignmentStatus,
} from './schemas/property-staff-assignment.schema';
import {
  IAssignStaffPayload,
  IUnassignStaffPayload,
} from './property-staff-assignment.interface';

@Injectable()
export class PropertyStaffAssignmentRepo extends BaseRepo<PropertyStaffAssignmentDocument> {
  constructor(
    @InjectModel(PropertyStaffAssignment.name)
    private readonly propertyStaffAssignmentModel: Model<PropertyStaffAssignmentDocument>,
  ) {
    super(propertyStaffAssignmentModel);
  }

  async assignStaff(
    payload: IAssignStaffPayload,
  ): Promise<PropertyStaffAssignmentDocument> {
    // Kiểm tra xem staff đã được assign cho property này chưa (với status active)
    const existingAssignment = await this.propertyStaffAssignmentModel.findOne({
      propertyId: payload.propertyId,
      staffId: payload.staffId.toString(), // Convert to string
      status: AssignmentStatus.ACTIVE,
    });

    if (existingAssignment) {
      throw new Error('Staff đã được assign cho property này');
    }

    const assignment = new this.propertyStaffAssignmentModel({
      propertyId: payload.propertyId,
      staffId: payload.staffId.toString(), // Convert to string
      assignedBy: payload.assignedBy,
      status: AssignmentStatus.ACTIVE,
      assignedAt: new Date(),
      notes: payload.notes,
    });

    return assignment.save();
  }

  async unassignStaff(
    payload: IUnassignStaffPayload,
  ): Promise<PropertyStaffAssignmentDocument | null> {
    const assignment = await this.propertyStaffAssignmentModel.findOne({
      propertyId: payload.propertyId,
      staffId: payload.staffId.toString(), // Convert to string
      status: AssignmentStatus.ACTIVE,
    });

    if (!assignment) {
      throw new Error('Không tìm thấy assignment đang active');
    }

    assignment.status = AssignmentStatus.INACTIVE;
    assignment.unassignedAt = new Date();
    assignment.unassignedBy = payload.unassignedBy;
    assignment.unassignNotes = payload.unassignNotes;

    return assignment.save();
  }

  async getStaffByProperty(
    propertyId: Types.ObjectId,
  ): Promise<PropertyStaffAssignmentDocument[]> {
    return this.propertyStaffAssignmentModel
      .find({
        propertyId,
        status: AssignmentStatus.ACTIVE,
      })
      .populate('staffId', 'name email phone')
      .populate('assignedBy', 'name email')
      .exec();
  }

  async getPropertiesByStaff(
    staffId: Types.ObjectId,
  ): Promise<PropertyStaffAssignmentDocument[]> {
    const query = {
      staffId: staffId.toString(), // Convert ObjectId to string to match database
      status: AssignmentStatus.ACTIVE,
    };

    const result = await this.propertyStaffAssignmentModel
      .find(query)
      .populate('propertyId', 'name type')
      .populate('assignedBy', 'name email')
      .exec();

    return result;

  }

  async getAssignmentHistory(
    propertyId?: Types.ObjectId,
    staffId?: Types.ObjectId,
  ): Promise<PropertyStaffAssignmentDocument[]> {
    const filter: Record<string, any> = {};
    if (propertyId) filter.propertyId = propertyId;
    if (staffId) filter.staffId = staffId;

    return this.propertyStaffAssignmentModel
      .find(filter)
      .populate('propertyId', 'name type')
      .populate('staffId', 'name email phone')
      .populate('assignedBy', 'name email')
      .populate('unassignedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async isStaffAssignedToProperty(
    staffId: Types.ObjectId,
    propertyId: Types.ObjectId,
  ): Promise<boolean> {
    const assignment = await this.propertyStaffAssignmentModel.findOne({
      staffId: staffId.toString(), // Convert to string
      propertyId,
      status: AssignmentStatus.ACTIVE,
    });
    return !!assignment;
  }
}

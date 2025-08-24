import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Service } from './schemas/service.schema';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import { ServicesRepo } from './services.repo';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { PaginatedServices } from './service.interface';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly servicesRepo: ServicesRepo) {}

  // =================== VALIDATION METHODS ===================

  /**
   * Validate giá cả hợp lệ
   */
  private validatePrice(price: number): void {
    if (price < 0) {
      throw new BadRequestException('Giá dịch vụ không được âm');
    }
  }

  /**
   * Validate khoảng giá
   */
  private validatePriceRange(minPrice?: number, maxPrice?: number): void {
    if (minPrice !== undefined && minPrice < 0) {
      throw new BadRequestException('Giá tối thiểu phải từ 0 trở lên');
    }

    if (maxPrice !== undefined && maxPrice < 0) {
      throw new BadRequestException('Giá tối đa phải từ 0 trở lên');
    }

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('Giá tối thiểu phải nhỏ hơn giá tối đa');
    }
  }

  /**
   * Validate tên service không trùng
   */
  private async validateServiceName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const exists = await this.servicesRepo.checkNameExists(name, excludeId);
    if (exists) {
      throw new ConflictException(
        `Dịch vụ với tên "${name}" đã tồn tại trong hệ thống`,
      );
    }
  }

  /**
   * Validate danh sách IDs
   */
  private validateIds(ids: string[]): void {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Danh sách IDs không được rỗng');
    }

    const invalidIds = ids.filter((id) => !Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Các ID không hợp lệ: ${invalidIds.join(', ')}`,
      );
    }
  }

  /**
   * Validate pagination parameters
   */
  private validatePagination(page?: number, limit?: number): void {
    if (page !== undefined && page < 1) {
      throw new BadRequestException('Trang phải từ 1 trở lên');
    }

    if (limit !== undefined && (limit < 1 || limit > 100)) {
      throw new BadRequestException('Limit phải từ 1 đến 100');
    }
  }

  /**
   * Validate unit
   */
  private validateUnit(unit: string): void {
    if (!unit || unit.trim().length === 0) {
      throw new BadRequestException('Đơn vị không được để trống');
    }

    // List of valid units
    const validUnits = [
      '/ngày',
      '/giờ',
      '/phút',
      '/tuần',
      '/tháng',
      '/năm',
      '/lần',
      '/người',
      '/phòng',
      '/kg',
      '/lít',
      '/m2',
      '/m3',
      '/bộ',
      '/cái',
      '/gói',
      '/hộp',
      '/chai',
      '/ly',
      '/suất',
      '/tour',
      '/chuyến',
      '/đêm',
    ];

    if (!validUnits.includes(unit)) {
      throw new BadRequestException(
        `Đơn vị "${unit}" không hợp lệ. Các đơn vị hợp lệ: ${validUnits.join(', ')}`,
      );
    }
  }

  /**
   * Validate similar price search parameters
   */
  private validateSimilarPriceSearch(targetPrice: number, limit: number): void {
    if (targetPrice < 0) {
      throw new BadRequestException('Giá tham chiếu phải từ 0 trở lên');
    }

    if (limit < 1 || limit > 50) {
      throw new BadRequestException('Limit phải từ 1 đến 50');
    }
  }

  /**
   * Validate sort order
   */
  private validateOrder(order: string): 'asc' | 'desc' {
    if (!['asc', 'desc'].includes(order)) {
      throw new BadRequestException(
        'Thứ tự sắp xếp chỉ có thể là "asc" hoặc "desc"',
      );
    }
    return order as 'asc' | 'desc';
  }

  /**
   * Sanitize service name
   */
  private sanitizeServiceName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  /**
   * Validate description
   */
  private validateDescription(description?: string): void {
    if (description && description.length > 500) {
      throw new BadRequestException('Mô tả không được vượt quá 500 ký tự');
    }
  }

  // =================== MAIN CRUD METHODS ===================

  /**
   * Tạo service mới
   */
  async create(
    createServiceDto: CreateServiceDto,
    user?: JwtPayload,
  ): Promise<Service> {
    // Validation
    this.validatePrice(createServiceDto.default_price);
    this.validateUnit(createServiceDto.unit || '/ngày');
    this.validateDescription(createServiceDto.description);

    // Sanitize name
    const sanitizedName = this.sanitizeServiceName(createServiceDto.name);
    await this.validateServiceName(sanitizedName);

    // Create service
    const serviceData = {
      ...createServiceDto,
      name: sanitizedName,
      unit: createServiceDto.unit || '/ngày',
      is_active: createServiceDto.is_active ?? true,
      ...(user && { createdBy: new Types.ObjectId(user._id) }),
    };

    return this.servicesRepo.create(serviceData);
  }

  /**
   * Lấy danh sách services với pagination và filter
   */
  async findAll(queryDto: QueryServiceDto): Promise<PaginatedServices> {
    // Validation
    this.validatePagination(queryDto.page, queryDto.limit);
    this.validatePriceRange(queryDto.minPrice, queryDto.maxPrice);

    return this.servicesRepo.findAllWithFilters(queryDto);
  }

  /**
   * Lấy service theo ID
   */
  async findOne(id: string): Promise<Service> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const service = await this.servicesRepo.findById(id);
    if (!service) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID: ${id}`);
    }

    return service;
  }

  /**
   * Tìm service theo tên
   */
  async findByName(name: string): Promise<Service> {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Tên dịch vụ không được để trống');
    }

    const service = await this.servicesRepo.findByName(name.trim());
    if (!service) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với tên: ${name}`);
    }

    return service;
  }

  /**
   * Cập nhật service
   */
  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    user?: JwtPayload,
  ): Promise<Service> {
    // Validation
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    if (updateServiceDto.default_price !== undefined) {
      this.validatePrice(updateServiceDto.default_price);
    }

    if (updateServiceDto.unit) {
      this.validateUnit(updateServiceDto.unit);
    }

    this.validateDescription(updateServiceDto.description);

    // Check if service exists
    const existingService = await this.servicesRepo.findById(id);
    if (!existingService) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID: ${id}`);
    }

    // Validate name if provided
    if (updateServiceDto.name) {
      const sanitizedName = this.sanitizeServiceName(updateServiceDto.name);
      await this.validateServiceName(sanitizedName, id);
      updateServiceDto.name = sanitizedName;
    }

    // Update service
    const updateData = {
      ...updateServiceDto,
      ...(user && { updatedBy: new Types.ObjectId(user._id) }),
    };

    const updatedService = await this.servicesRepo.updateById(
      id,
      updateData,
      user?._id,
    );
    if (!updatedService) {
      throw new NotFoundException(`Không thể cập nhật dịch vụ với ID: ${id}`);
    }

    return updatedService;
  }

  /**
   * Xóa service (soft delete)
   */
  async remove(id: string, user?: JwtPayload): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    // Use user._id if available, otherwise use a default value
    const userId = user?._id || 'system';
    await this.servicesRepo.softDelete(id, userId);
    return { success: true };
  }

  /**
   * Khôi phục service đã xóa
   */
  async restore(id: string): Promise<Service> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const restoredService = await this.servicesRepo.restore(id);
    if (!restoredService) {
      throw new NotFoundException(`Không thể khôi phục dịch vụ với ID: ${id}`);
    }

    return restoredService;
  }

  /**
   * Lấy tất cả services đang hoạt động
   */
  async getActiveServices(): Promise<Service[]> {
    return this.servicesRepo.getActiveServices();
  }

  /**
   * Lấy services theo khoảng giá
   */
  async getServicesByPriceRange(
    minPrice?: number,
    maxPrice?: number,
  ): Promise<Service[]> {
    this.validatePriceRange(minPrice, maxPrice);
    return this.servicesRepo.findByPriceRange(minPrice, maxPrice);
  }

  /**
   * Toggle trạng thái service
   */
  async toggleStatus(id: string, user?: JwtPayload): Promise<Service> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const service = await this.servicesRepo.toggleServiceStatus(id, user?._id);
    if (!service) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID: ${id}`);
    }

    return service;
  }

  /**
   * Toggle trạng thái allow_quantity của service
   */
  async toggleAllowQuantity(id: string, user?: JwtPayload): Promise<Service> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID không hợp lệ');
    }

    const service = await this.servicesRepo.toggleAllowQuantity(id, user?._id);
    if (!service) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID: ${id}`);
    }

    return service;
  }

  /**
   * Lấy thống kê services theo unit
   */
  async getStatsByUnit(): Promise<
    {
      _id: string;
      count: number;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      activeCount: number;
    }[]
  > {
    return this.servicesRepo.getStatsByUnit();
  }

  /**
   * Lấy thống kê services theo trạng thái
   */
  async getStatusStats(): Promise<{
    active: number;
    inactive: number;
    total: number;
  }> {
    return this.servicesRepo.countByStatus();
  }

  /**
   * Tìm services theo unit
   */
  async findByUnit(unit: string): Promise<Service[]> {
    if (!unit || unit.trim().length === 0) {
      throw new BadRequestException('Đơn vị không được để trống');
    }

    return this.servicesRepo.findByUnit(unit.trim());
  }

  /**
   * Lấy services theo thứ tự giá
   */
  async getServicesByPriceOrder(
    order: 'asc' | 'desc' = 'asc',
  ): Promise<Service[]> {
    // Validation
    const validOrder = this.validateOrder(order);
    return this.servicesRepo.getServicesByPriceOrder(validOrder);
  }

  /**
   * Tìm services có giá gần giá target
   */
  async findSimilarPriceServices(
    targetPrice: number,
    limit: number = 5,
  ): Promise<Service[]> {
    // Validation
    this.validateSimilarPriceSearch(targetPrice, limit);
    return this.servicesRepo.findSimilarPriceServices(targetPrice, limit);
  }

  /**
   * Bulk update trạng thái services
   */
  async bulkUpdateStatus(
    ids: string[],
    isActive: boolean,
    user?: JwtPayload,
  ): Promise<{
    acknowledged: boolean;
    modifiedCount: number;
    upsertedId: unknown;
    upsertedCount: number;
    matchedCount: number;
  }> {
    this.validateIds(ids);
    return this.servicesRepo.bulkUpdateStatus(ids, isActive, user?._id);
  }

  /**
   * Lấy thống kê chi tiết cho service cụ thể
   */
  async getServiceDetailedStats(
    serviceId: string,
    user?: JwtPayload,
    request?: { staffPropertyIds?: string[] },
  ): Promise<{
    _id: string;
    service_name: string;
    service_price: number;
    total_bookings: number;
    total_revenue: number;
    average_price: number;
  } | null> {
    // Validate serviceId
    if (!Types.ObjectId.isValid(serviceId)) {
      throw new BadRequestException('Service ID không hợp lệ');
    }

    const stats = await this.servicesRepo.getServiceDetailedStats(
      serviceId,
      user,
      request,
    );
    return stats.length > 0 ? stats[0] : null;
  }
}

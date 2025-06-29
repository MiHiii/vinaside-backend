import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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
      throw new BadRequestException(
        'Giá tối thiểu không được lớn hơn giá tối đa',
      );
    }
  }

  /**
   * Validate tên dịch vụ và kiểm tra trùng lặp
   */
  private async validateServiceName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('Tên dịch vụ không được để trống');
    }

    const nameExists = await this.servicesRepo.checkNameExists(
      name.trim(),
      excludeId,
    );
    if (nameExists) {
      throw new ConflictException(`Dịch vụ ${name} đã tồn tại`);
    }
  }

  /**
   * Validate danh sách IDs
   */
  private validateIds(ids: string[]): void {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Danh sách ID không được để trống');
    }

    // Validate MongoDB ObjectId format
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    const invalidIds = ids.filter((id) => !objectIdPattern.test(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `ID không hợp lệ: ${invalidIds.join(', ')}`,
      );
    }
  }

  /**
   * Validate limit và page parameters
   */
  private validatePagination(page?: number, limit?: number): void {
    if (page !== undefined && (page < 1 || !Number.isInteger(page))) {
      throw new BadRequestException('Trang phải là số nguyên dương');
    }

    if (
      limit !== undefined &&
      (limit < 1 || limit > 100 || !Number.isInteger(limit))
    ) {
      throw new BadRequestException('Limit phải là số nguyên từ 1 đến 100');
    }
  }

  /**
   * Validate service unit
   */
  private validateUnit(unit: string): void {
    if (!unit || unit.trim().length === 0) {
      throw new BadRequestException('Đơn vị không được để trống');
    }

    const validUnits = [
      '/ngày',
      '/người',
      '/lần',
      '/giờ',
      '/tháng',
      '/năm',
      '/km',
      '/kg',
    ];
    const isValidUnit = validUnits.some((validUnit) =>
      unit.toLowerCase().includes(validUnit.toLowerCase()),
    );

    if (!isValidUnit) {
      throw new BadRequestException(
        `Đơn vị không hợp lệ. Các đơn vị được chấp nhận: ${validUnits.join(', ')}`,
      );
    }
  }

  /**
   * Validate similar price search parameters
   */
  private validateSimilarPriceSearch(targetPrice: number, limit: number): void {
    if (targetPrice < 0) {
      throw new BadRequestException('Giá phải là số dương');
    }

    if (limit < 1 || limit > 20) {
      throw new BadRequestException('Limit phải từ 1 đến 20');
    }
  }

  /**
   * Validate order parameter
   */
  private validateOrder(order: string): 'asc' | 'desc' {
    if (order !== 'asc' && order !== 'desc') {
      throw new BadRequestException('Thứ tự phải là asc hoặc desc');
    }
    return order;
  }

  /**
   * Sanitize và validate tên dịch vụ
   */
  private sanitizeServiceName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  /**
   * Validate description length
   */
  private validateDescription(description?: string): void {
    if (description && description.length > 500) {
      throw new BadRequestException('Mô tả không được vượt quá 500 ký tự');
    }
  }

  // =================== SERVICE METHODS ===================

  /**
   * Tạo dịch vụ mới
   */
  async create(
    createServiceDto: CreateServiceDto,
    user?: JwtPayload,
  ): Promise<Service> {
    const { name, description, default_price, unit, ...rest } =
      createServiceDto;

    // Validation
    await this.validateServiceName(name);
    this.validatePrice(default_price);
    this.validateUnit(unit);
    this.validateDescription(description);

    const serviceData = {
      ...rest,
      name: this.sanitizeServiceName(name),
      description,
      default_price,
      unit,
    };

    return this.servicesRepo.create(serviceData, user?._id);
  }

  /**
   * Lấy danh sách dịch vụ với phân trang và bộ lọc
   */
  async findAll(queryDto: QueryServiceDto): Promise<PaginatedServices> {
    // Validation
    this.validatePagination(queryDto.page, queryDto.limit);

    return this.servicesRepo.findAllWithFilters(queryDto);
  }

  /**
   * Lấy dịch vụ theo ID
   */
  async findOne(id: string): Promise<Service> {
    const service = await this.servicesRepo.findById(id);

    if (!service || service.isDeleted) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID ${id}`);
    }

    return service;
  }

  /**
   * Lấy dịch vụ theo tên
   */
  async findByName(name: string): Promise<Service> {
    const service = await this.servicesRepo.findByName(name);

    if (!service) {
      throw new NotFoundException(`Không tìm thấy dịch vụ với tên ${name}`);
    }

    return service;
  }

  /**
   * Cập nhật dịch vụ
   */
  async update(
    id: string,
    updateServiceDto: UpdateServiceDto,
    user?: JwtPayload,
  ): Promise<Service> {
    await this.findOne(id);

    // Validation
    if (updateServiceDto.name) {
      await this.validateServiceName(updateServiceDto.name, id);
    }

    if (updateServiceDto.default_price !== undefined) {
      this.validatePrice(updateServiceDto.default_price);
    }

    if (updateServiceDto.unit) {
      this.validateUnit(updateServiceDto.unit);
    }

    if (updateServiceDto.description !== undefined) {
      this.validateDescription(updateServiceDto.description);
    }

    const serviceData = {
      ...updateServiceDto,
      name: updateServiceDto.name
        ? this.sanitizeServiceName(updateServiceDto.name)
        : undefined,
    };

    const updated = await this.servicesRepo.updateById(
      id,
      serviceData,
      user?._id,
    );
    if (!updated) {
      throw new NotFoundException(`Không thể cập nhật dịch vụ với ID ${id}`);
    }
    return updated;
  }

  /**
   * Xóa mềm dịch vụ
   */
  async remove(id: string, user?: JwtPayload): Promise<{ success: boolean }> {
    await this.findOne(id);
    if (user?._id) {
      await this.servicesRepo.softDelete(id, user._id);
    }
    return { success: true };
  }

  /**
   * Khôi phục dịch vụ đã xóa
   */
  async restore(id: string): Promise<Service> {
    const restored = await this.servicesRepo.restore(id);
    if (!restored) {
      throw new NotFoundException(`Không thể khôi phục dịch vụ với ID ${id}`);
    }
    return restored;
  }

  /**
   * Lấy danh sách dịch vụ đang hoạt động
   */
  async getActiveServices(): Promise<Service[]> {
    return this.servicesRepo.getActiveServices();
  }

  /**
   * Lấy dịch vụ theo khoảng giá với validation
   */
  async getServicesByPriceRange(
    minPrice?: number,
    maxPrice?: number,
  ): Promise<Service[]> {
    // Validation
    this.validatePriceRange(minPrice, maxPrice);

    return this.servicesRepo.findByPriceRange(minPrice, maxPrice);
  }

  /**
   * Thay đổi trạng thái hoạt động của dịch vụ
   */
  async toggleStatus(id: string, user?: JwtPayload): Promise<Service> {
    await this.findOne(id);
    const toggled = await this.servicesRepo.toggleServiceStatus(id, user?._id);
    if (!toggled) {
      throw new NotFoundException(
        `Không thể thay đổi trạng thái dịch vụ với ID ${id}`,
      );
    }
    return toggled;
  }

  /**
   * Lấy thống kê service theo đơn vị
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
   * Lấy thống kê số lượng theo trạng thái
   */
  async getStatusStats(): Promise<{
    active: number;
    inactive: number;
    total: number;
  }> {
    return this.servicesRepo.countByStatus();
  }

  /**
   * Tìm service theo đơn vị
   */
  async findByUnit(unit: string): Promise<Service[]> {
    // Validation
    this.validateUnit(unit);

    return this.servicesRepo.findByUnit(unit);
  }

  /**
   * Lấy service theo thứ tự giá
   */
  async getServicesByPriceOrder(
    order: 'asc' | 'desc' = 'asc',
  ): Promise<Service[]> {
    // Validation
    this.validateOrder(order);

    return this.servicesRepo.getServicesByPriceOrder(order);
  }

  /**
   * Tìm service có giá tương tự
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
   * Cập nhật trạng thái hàng loạt
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
    // Validation
    this.validateIds(ids);

    return this.servicesRepo.bulkUpdateStatus(ids, isActive, user?._id);
  }
}

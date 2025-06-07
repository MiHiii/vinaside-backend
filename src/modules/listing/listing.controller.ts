import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  // UseGuards,  // Uncomment when auth module is ready
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ListingService } from './listing.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
// Import these when auth module is ready
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
// import { Role } from '../auth/enums/role.enum';
import { ListingStatus } from './schemas/listing.schema';
// import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';

@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Post()
  @Roles('host', 'admin')
  @ResponseMessage('Tạo listing thành công')
  create(@Body() createListingDto: CreateListingDto) {
    // Temporary mock user until auth is implemented
    const user: JwtPayload = { _id: '123', email: 'test@example.com' };
    return this.listingService.create(createListingDto, user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách listings thành công')
  findAll(@Query() queryDto: QueryListingDto) {
    return this.listingService.findAll(queryDto);
  }

  @Get(':id')
  @ResponseMessage('Lấy thông tin listing thành công')
  findOne(@Param('id') id: string) {
    return this.listingService.findOne(id);
  }

  @Patch(':id')
  @Roles('host', 'admin')
  @ResponseMessage('Cập nhật listing thành công')
  update(@Param('id') id: string, @Body() updateListingDto: UpdateListingDto) {
    // Temporary mock user until auth is implemented
    const user: JwtPayload = { _id: '123', email: 'test@example.com' };
    return this.listingService.update(id, updateListingDto, user);
  }

  @Delete(':id')
  @Roles('host', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa listing thành công')
  remove(@Param('id') id: string) {
    // Temporary mock user until auth is implemented
    const user: JwtPayload = { _id: '123', email: 'test@example.com' };
    return this.listingService.remove(id, user);
  }

  @Patch(':id/restore')
  @Roles('host', 'admin')
  @ResponseMessage('Khôi phục listing thành công')
  restore(@Param('id') id: string) {
    return this.listingService.restore(id);
  }

  @Patch(':id/verify')
  @Roles('admin')
  @ResponseMessage('Cập nhật trạng thái xác minh listing thành công')
  verify(@Param('id') id: string, @Body('is_verified') isVerified: boolean) {
    // Temporary mock user until auth is implemented
    const user: JwtPayload = { _id: '123', email: 'test@example.com' };
    return this.listingService.verifyListing(id, isVerified, user);
  }

  @Patch(':id/status')
  @Roles('host', 'admin')
  @ResponseMessage('Cập nhật trạng thái listing thành công')
  updateStatus(@Param('id') id: string, @Body('status') status: ListingStatus) {
    // Temporary mock user until auth is implemented
    const user: JwtPayload = { _id: '123', email: 'test@example.com' };
    return this.listingService.updateStatus(id, status, user);
  }

  @Get('host/:hostId')
  @ResponseMessage('Lấy danh sách listings của host thành công')
  findByHost(
    @Param('hostId') hostId: string,
    @Query() queryDto: QueryListingDto,
  ) {
    return this.listingService.findByHost(hostId, queryDto);
  }
}

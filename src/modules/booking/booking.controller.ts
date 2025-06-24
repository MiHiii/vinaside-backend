import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { BookingStatus } from './schemas/booking.schema';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { UserWithPermissions } from 'src/interfaces/user-with-permissions.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @Roles('guest')
  @ResponseMessage('Tạo booking thành công')
  create(
    @Body() createBookingDto: CreateBookingDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.create(
      createBookingDto,
      req.user as any as UserWithPermissions,
    );
  }

  @Get()
  @Roles('admin')
  @ResponseMessage('Lấy danh sách bookings thành công')
  findAll(@Query() queryDto: QueryBookingDto) {
    return this.bookingService.findAll(queryDto);
  }

  @Get('my-bookings')
  @Roles('guest')
  @ResponseMessage('Lấy danh sách booking của tôi thành công')
  getMyBookings(
    @Query() query: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findByGuest(req.user._id, query);
  }

  @Get('my-history')
  @Roles('guest', 'admin')
  @ResponseMessage('Lấy lịch sử booking của tôi thành công')
  findMyHistory(
    @Query() queryDto: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findMyBookingsAsGuest(req.user, queryDto);
  }

  @Get('guest/:guestId')
  @Roles('guest', 'admin')
  @ResponseMessage('Lấy danh sách bookings của guest thành công')
  findByGuest(
    @Param('guestId') guestId: string,
    @Query() queryDto: QueryBookingDto,
  ) {
    return this.bookingService.findByGuest(guestId, queryDto);
  }

  @Get('staff/:staffId')
  @Roles('staff', 'admin')
  @ResponseMessage('Lấy danh sách bookings của staff thành công')
  findByStaff(
    @Param('staffId') staffId: string,
    @Query() queryDto: QueryBookingDto,
  ) {
    return this.bookingService.findByHost(staffId, queryDto);
  }

  @Get('listing/:listingId')
  @Roles('staff', 'admin')
  @ResponseMessage('Lấy danh sách bookings của listing thành công')
  findByListing(
    @Param('listingId') listingId: string,
    @Query() queryDto: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findByListing(listingId, queryDto, req.user);
  }

  @Get('check-availability/:listingId')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Kiểm tra tính khả dụng thành công')
  checkAvailability(
    @Param('listingId') listingId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.bookingService.checkAvailability(listingId, checkIn, checkOut);
  }

  @Public()
  @Get('booked-dates/:listingId')
  @ResponseMessage('Lấy ngày đã đặt thành công')
  getBookedDates(@Param('listingId') listingId: string) {
    return this.bookingService.getBookedDates(listingId);
  }

  @Get(':id')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Lấy thông tin booking thành công')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.findOne(
      id,
      req.user as any as UserWithPermissions,
    );
  }

  @Patch(':id')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Cập nhật booking thành công')
  update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Request() req: RequestWithUser,
  ) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.update(
      id,
      updateBookingDto,
      req.user as any as UserWithPermissions,
    );
  }

  @Delete(':id')
  @Roles('guest', 'staff', 'admin')
  @ResponseMessage('Hủy booking thành công')
  cancel(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.remove(
      id,
      req.user as any as UserWithPermissions,
    );
  }

  @Patch(':id/confirm')
  @Roles('staff', 'admin')
  @ResponseMessage('Xác nhận booking thành công')
  confirm(@Param('id') id: string, @Request() req: RequestWithUser) {
    if (!req.user.role) {
      throw new BadRequestException('Thiếu thông tin vai trò người dùng');
    }
    return this.bookingService.update(
      id,
      { status: BookingStatus.CONFIRMED },
      req.user as any as UserWithPermissions,
    );
  }
}

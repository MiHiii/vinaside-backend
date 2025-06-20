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
    return this.bookingService.create(createBookingDto, req.user);
  }

  @Get()
  @Roles('admin')
  @ResponseMessage('Lấy danh sách bookings thành công')
  findAll(@Query() queryDto: QueryBookingDto) {
    return this.bookingService.findAll(queryDto);
  }

  @Get('my-bookings')
  @Roles('host', 'admin')
  @ResponseMessage('Lấy danh sách bookings của tôi thành công')
  findMyBookings(
    @Query() queryDto: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findMyBookingsAsHost(req.user, queryDto);
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

  @Get('host/:hostId')
  @Roles('host', 'admin')
  @ResponseMessage('Lấy danh sách bookings của host thành công')
  findByHost(
    @Param('hostId') hostId: string,
    @Query() queryDto: QueryBookingDto,
  ) {
    return this.bookingService.findByHost(hostId, queryDto);
  }

  @Get('listing/:listingId')
  @Roles('host', 'admin')
  @ResponseMessage('Lấy danh sách bookings của listing thành công')
  findByListing(
    @Param('listingId') listingId: string,
    @Query() queryDto: QueryBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.findByListing(listingId, queryDto, req.user);
  }

  @Get('check-availability/:listingId')
  @Roles('guest', 'host', 'admin')
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
  // @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy ngày đã đặt thành công')
  getBookedDates(@Param('listingId') listingId: string) {
    return this.bookingService.getBookedDates(listingId);
  }

  @Get(':id')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Lấy thông tin booking thành công')
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch(':id')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Cập nhật booking thành công')
  update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.update(id, updateBookingDto, req.user);
  }

  @Delete(':id')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Xóa booking thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.bookingService.remove(id, req.user);
  }

  @Patch(':id/restore')
  @Roles('guest', 'host', 'admin')
  @ResponseMessage('Khôi phục booking thành công')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.bookingService.restore(id, req.user);
  }

  @Patch(':id/status')
  @Roles('host', 'admin')
  @ResponseMessage('Cập nhật trạng thái booking thành công')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: BookingStatus,
    @Request() req: RequestWithUser,
  ) {
    return this.bookingService.updateStatus(id, status, req.user);
  }
}

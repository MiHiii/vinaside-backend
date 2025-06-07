import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { ResponseMessage } from '../../decorators/response-message.decorator';
import { ParseMongoIdPipe } from '../../pipes/parse-mongo-id.pipe';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Đặt phòng thành công')
  async create(@Body(ValidationPipe) createBookingDto: CreateBookingDto) {
    return {
      data: await this.bookingService.create(createBookingDto),
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Lấy danh sách đặt phòng thành công')
  async findAll(@Query(ValidationPipe) query: QueryBookingDto) {
    return await this.bookingService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Lấy thông tin đặt phòng thành công')
  async findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return {
      data: await this.bookingService.findOne(id),
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Cập nhật đặt phòng thành công')
  async update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body(ValidationPipe) updateBookingDto: UpdateBookingDto,
  ) {
    return {
      data: await this.bookingService.update(id, updateBookingDto),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Xóa đặt phòng thành công')
  async remove(@Param('id', ParseMongoIdPipe) id: string) {
    return {
      data: await this.bookingService.remove(id),
    };
  }

  @Put('restore/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Khôi phục đặt phòng thành công')
  async restore(@Param('id', ParseMongoIdPipe) id: string) {
    return {
      data: await this.bookingService.restore(id),
    };
  }
}

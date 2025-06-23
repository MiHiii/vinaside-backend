import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Request,
  RawBody,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  // =========================== MAIN ROUTES ===========================

  @Post()
  @ResponseMessage('Tạo đánh giá thành công')
  create(
    @Body() createReviewDto: CreateReviewDto,
    @Request() req: RequestWithUser,
  ) {
    console.log(createReviewDto);
    return this.reviewsService.create(createReviewDto, req.user);
  }

  @Get()
  @ResponseMessage('Lấy danh sách đánh giá của tôi thành công')
  findMyReviews(
    @Query() queryDto: QueryReviewDto,
    @Request() req: RequestWithUser,
  ) {
    return this.reviewsService.findMyReviews(queryDto, req.user);
  }

  @Public()
  @Get('rooms/:roomId')
  @ResponseMessage('Lấy danh sách đánh giá của phòng thành công')
  findRoomReviews(
    @Param('roomId') roomId: string,
    @Query() queryDto: QueryReviewDto,
  ) {
    return this.reviewsService.findRoomReviews(roomId, queryDto);
  }

  @Get(':id')
  @ResponseMessage('Lấy chi tiết đánh giá thành công')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  // =========================== ADMIN ROUTES ===========================

  @Get('admin/search')
  @Roles('admin')
  @ResponseMessage('Tìm kiếm đánh giá thành công')
  searchForAdmin(
    @Query() queryDto: QueryReviewDto,
    @Request() req: RequestWithUser,
  ) {
    return this.reviewsService.searchForAdmin(queryDto, req.user);
  }

  @Get('admin/statistics')
  @Roles('admin')
  @ResponseMessage('Lấy thống kê đánh giá thành công')
  getStatistics(@Request() req: RequestWithUser) {
    return this.reviewsService.getStatistics(req.user);
  }

  @Get('admin/all')
  @Roles('admin')
  @ResponseMessage('Lấy tất cả đánh giá thành công')
  findAllForAdmin(
    @Query() queryDto: QueryReviewDto,
    @Request() req: RequestWithUser,
  ) {
    return this.reviewsService.findAllForAdmin(queryDto, req.user);
  }

  @Delete('admin/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Xóa đánh giá thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.reviewsService.remove(id, req.user);
  }
}

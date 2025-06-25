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
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // =========================== MAIN ROUTES ===========================

  @Post()
  @Roles('guest')
  @ApiOperation({ summary: 'Tạo đánh giá mới' })
  @ApiResponse({ status: 201, description: 'Đánh giá được tạo thành công' })
  @ResponseMessage('Tạo đánh giá thành công')
  create(
    @Body() createReviewDto: CreateReviewDto,
    @Request() req: RequestWithUser,
  ) {
    console.log(createReviewDto);
    return this.reviewsService.create(createReviewDto, req.user);
  }

  @Get()
  @Roles('guest', 'staff', 'admin')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của tôi' })
  @ApiResponse({ status: 200, description: 'Danh sách đánh giá của user' })
  @ResponseMessage('Lấy danh sách đánh giá của tôi thành công')
  findMyReviews(
    @Query() queryDto: QueryReviewDto,
    @Request() req: RequestWithUser,
  ) {
    return this.reviewsService.findMyReviews(queryDto, req.user);
  }

  @Public()
  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của phòng' })
  @ApiResponse({ status: 200, description: 'Danh sách đánh giá của phòng' })
  @ResponseMessage('Lấy danh sách đánh giá của phòng thành công')
  findRoomReviews(
    @Param('roomId') roomId: string,
    @Query() queryDto: QueryReviewDto,
  ) {
    return this.reviewsService.findRoomReviews(roomId, queryDto);
  }

  @Get(':id')
  @RequirePermission('review.view')
  @ApiOperation({ summary: 'Lấy chi tiết đánh giá' })
  @ApiResponse({ status: 200, description: 'Chi tiết đánh giá' })
  @ResponseMessage('Lấy chi tiết đánh giá thành công')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  // =========================== ADMIN ROUTES ===========================

  @Get('admin/search')
  @RequirePermission('review.view')
  @ApiOperation({ summary: 'Tìm kiếm đánh giá (Admin)' })
  @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm đánh giá' })
  @ResponseMessage('Tìm kiếm đánh giá thành công')
  searchForAdmin(
    @Query() queryDto: QueryReviewDto,
    @Request() req: RequestWithUser,
  ) {
    return this.reviewsService.searchForAdmin(queryDto, req.user);
  }

  @Get('admin/statistics')
  @RequirePermission('review.view')
  @ApiOperation({ summary: 'Lấy thống kê đánh giá' })
  @ApiResponse({ status: 200, description: 'Thống kê đánh giá' })
  @ResponseMessage('Lấy thống kê đánh giá thành công')
  getStatistics(@Request() req: RequestWithUser) {
    return this.reviewsService.getStatistics(req.user);
  }

  @Get('admin/all')
  @RequirePermission('review.view')
  @ApiOperation({ summary: 'Lấy tất cả đánh giá (Admin)' })
  @ApiResponse({ status: 200, description: 'Danh sách tất cả đánh giá' })
  @ResponseMessage('Lấy tất cả đánh giá thành công')
  findAllForAdmin(
    @Query() queryDto: QueryReviewDto,
    @Request() req: RequestWithUser,
  ) {
    return this.reviewsService.findAllForAdmin(queryDto, req.user);
  }

  @Delete('admin/:id')
  @RequirePermission('review.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa đánh giá vi phạm' })
  @ApiResponse({ status: 204, description: 'Đánh giá được xóa thành công' })
  @ResponseMessage('Xóa đánh giá thành công')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.reviewsService.remove(id, req.user);
  }
}

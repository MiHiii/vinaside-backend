import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export interface ListingStatistics {
  listingId: string;
  listingTitle: string;
  businessPerformance: {
    totalBookings: number;
    occupancyRate: number;
    monthlyRevenue: number;
    cancellationRate: number;
    returningGuests: number;
  };
  reviews: {
    averageRating: number;
    totalReviews: number;
  };
  engagement: {
    viewCount: number;
    wishlistCount: number;
  };
  voucherImpact: {
    totalDiscountAmount: number;
    mostPopularVoucher: string;
  };
}

export class ListingStatisticsDto {
  @ApiProperty({ description: 'ID của listing', required: false })
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiProperty({ description: 'ID của property', required: false })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty({ description: 'Ngày bắt đầu thống kê', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Ngày kết thúc thống kê', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ListingStatisticsResponseDto implements ListingStatistics {
  @ApiProperty({ description: 'ID của listing' })
  listingId: string;

  @ApiProperty({ description: 'Tên listing' })
  listingTitle: string;

  @ApiProperty({ description: 'Hiệu suất kinh doanh' })
  businessPerformance: {
    totalBookings: number;
    occupancyRate: number;
    monthlyRevenue: number;
    cancellationRate: number;
    returningGuests: number;
  };

  @ApiProperty({ description: 'Đánh giá' })
  reviews: {
    averageRating: number;
    totalReviews: number;
  };

  @ApiProperty({ description: 'Mức độ quan tâm & chuyển đổi' })
  engagement: {
    viewCount: number;
    wishlistCount: number;
  };

  @ApiProperty({ description: 'Tác động từ Voucher' })
  voucherImpact: {
    totalDiscountAmount: number;
    mostPopularVoucher: string;
  };
}

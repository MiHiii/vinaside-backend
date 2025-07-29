import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Listing } from '../listing/schemas/listing.schema';
import { Property } from '../properties/schemas/property.schema';
import { Booking } from '../booking/schemas/booking.schema';
import { Voucher } from '../vouchers/schemas/voucher.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Service } from '../services/schemas/service.schema';
import { Wishlist } from '../wishlist/schemas/wishlist.schema';
import { VoucherUsage } from '../vouchers/schemas/voucher-usage.schema';

@Controller('internal-data')
export class InternalDataController {
  constructor(
    @InjectModel(Listing.name) private listingModel: Model<Listing>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Voucher.name) private voucherModel: Model<Voucher>,
    @InjectModel(Review.name) private reviewModel: Model<Review>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Wishlist.name) private wishlistModel: Model<Wishlist>,
    @InjectModel(VoucherUsage.name)
    private voucherUsageModel: Model<VoucherUsage>,
  ) {}

  @Get()
  async getData() {
    const listings = await this.listingModel.find();
    const properties = await this.propertyModel.find();
    const bookings = await this.bookingModel.find();
    const vouchers = await this.voucherModel.find();
    const reviews = await this.reviewModel.find();
    const services = await this.serviceModel.find();
    const wishlists = await this.wishlistModel.find();
    const voucherUsages = await this.voucherUsageModel.find();
    return {
      listings,
      properties,
      bookings,
      vouchers,
      reviews,
      services,
      wishlists,
      voucherUsages,
    };
  }
}

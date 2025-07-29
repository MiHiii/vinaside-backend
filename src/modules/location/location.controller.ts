import { Controller, Get, Query, Logger } from '@nestjs/common';
import { GooglePlacesService } from './google-places.service';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';

@Controller('locations')
export class LocationController {
  private readonly logger = new Logger(LocationController.name);

  constructor(private readonly googlePlacesService: GooglePlacesService) {}

  @Public()
  @Get('autocomplete')
  @ResponseMessage('Lấy gợi ý địa điểm thành công')
  async autocomplete(@Query('input') input: string) {
    if (!input || input.trim().length < 2) {
      return { suggestions: [] };
    }

    const suggestions = await this.googlePlacesService.autocomplete(
      input.trim(),
    );
    return { suggestions };
  }

  @Public()
  @Get('details')
  @ResponseMessage('Lấy chi tiết địa điểm thành công')
  async getDetails(@Query('place_id') placeId: string) {
    this.logger.log(`Getting details for place_id: ${placeId}`);

    if (!placeId) {
      this.logger.warn('No place_id provided');
      return { location: null };
    }

    const location = await this.googlePlacesService.getPlaceDetails(placeId);

    this.logger.log(
      `Result: ${location ? 'Found location' : 'No location found'}`,
    );
    if (location) {
      this.logger.log(`Location has geometry: ${!!location.geometry}`);
    }

    return { location };
  }

  @Public()
  @Get('cities')
  @ResponseMessage('Lấy danh sách thành phố thành công')
  async getCities(@Query('input') input: string) {
    const suggestions = await this.googlePlacesService.autocomplete(
      input?.trim() || '',
      'cities',
    );
    return { suggestions };
  }
}

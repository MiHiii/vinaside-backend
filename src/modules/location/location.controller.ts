import { Controller, Get, Query } from '@nestjs/common';
import { GooglePlacesService } from './google-places.service';
import { ResponseMessage } from 'src/decorators/response-message.decorator';
import { Public } from 'src/decorators/public.decorator';

@Controller('locations')
export class LocationController {
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
    if (!placeId) {
      return { location: null };
    }

    const location = await this.googlePlacesService.getPlaceDetails(placeId);
    return { location };
  }
}

import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';

@ApiTags('Mail')
@Controller('mail')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class MailController {
  constructor(
    private readonly mailService: MailService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  @Post('send')
  @RequirePermission('mail.send')
  @ApiOperation({ summary: 'Gửi email tùy chỉnh' })
  @ApiResponse({ status: 200, description: 'Email đã được gửi thành công' })
  async sendMail(@Body() sendMailDto: SendMailDto) {
    await this.mailService.sendEmail(
      sendMailDto.to,
      sendMailDto.subject,
      sendMailDto.template,
      sendMailDto.context || {},
    );
    return { message: 'Email đã được gửi thành công' };
  }

  @Get('staff-emails/property/:propertyId')
  @RequirePermission('property.view')
  @ApiOperation({ summary: 'Lấy danh sách email nhân viên theo property ID' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách email nhân viên',
    schema: {
      type: 'object',
      properties: {
        propertyId: { type: 'string' },
        staffEmails: { type: 'array', items: { type: 'string' } },
        count: { type: 'number' },
      },
    },
  })
  async getStaffEmailsByProperty(@Param('propertyId') propertyId: string) {
    const staffEmails = await this.mailService.getStaffEmails(propertyId);
    return {
      propertyId,
      staffEmails,
      count: staffEmails.length,
    };
  }

  /**
   * Helper method để lấy email của staff từ staffIds
   * @param staffIds Array of staff IDs
   * @returns Array of staff emails
   */
  async getStaffEmailsByIds(staffIds: string[]): Promise<string[]> {
    const staffUsers = await this.userModel
      .find({
        _id: { $in: staffIds },
        role: 'staff',
        isDeleted: false,
        is_verified: true,
      })
      .select('email')
      .exec();

    return staffUsers.map((user) => user.email);
  }
}

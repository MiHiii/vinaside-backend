import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// import { Roles } from '../../decorators/roles.decorator';

@Controller('mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  // @Roles('admin')
  async sendEmail(@Body() sendMailDto: SendMailDto) {
    await this.mailService.sendEmail(
      sendMailDto.to,
      sendMailDto.subject,
      sendMailDto.template,
      sendMailDto.context || {},
    );

    return {
      message: 'Email đã được gửi thành công',
    };
  }
}

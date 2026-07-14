import { Body, Controller, MaxFileSizeValidator, ParseFilePipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { MediaService } from '../../media/media.service';
import { ManualPaymentService } from './manual-payment.service';
import { SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // 8MB

// Customer-facing: "I paid to your bKash/Nagad/Rocket number, here's my trx
// id" (spec §7.12). Anyone can submit for any orderId — not a security
// hole, since a bogus submission just sits SUBMITTED until staff verifies
// it against their own gateway account statement.
@ApiTags('net-profit/manual-payment')
@Controller('net-profit/manual-payments')
export class ManualPaymentPublicController {
  constructor(
    private readonly manualPayment: ManualPaymentService,
    private readonly media: MediaService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  submit(@Body() dto: SubmitManualPaymentDto) {
    return this.manualPayment.submit(dto);
  }

  @Post('screenshot')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadScreenshot(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_SCREENSHOT_BYTES })] }))
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const url = await this.media.uploadTransient(file);
    return { url };
  }
}

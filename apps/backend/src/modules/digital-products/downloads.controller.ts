import { Controller, Get, Logger, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { DownloadsService } from './downloads.service';

@ApiTags('downloads')
@Controller()
export class DownloadsController {
  private readonly logger = new Logger(DownloadsController.name);

  constructor(private readonly downloads: DownloadsService) {}

  // Token-gated rather than session-gated, so the emailed link works for a
  // buyer who never signs in.
  /**
   * `?inline=1` renders the PDF in the browser instead of saving it.
   *
   * Same token, same entitlement check, same stream — only the
   * Content-Disposition differs, because "read it" and "save it" are the same
   * file and gating them differently would mean two ways to be entitled.
   * The browser's own PDF viewer is the reader; shipping a JS PDF renderer to
   * do what every target browser already does natively would be a lot of
   * bytes for no capability.
   */
  @Get('downloads/:token')
  async download(
    @Param('token') token: string,
    @Res() res: Response,
    @Query('inline') inline?: string,
  ) {
    const { stream, filename } = await this.downloads.streamByToken(token);
    const disposition = inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(filename)}"`,
    );
    // pipe() does not forward source errors — an unhandled 'error' on a
    // Readable crashes the process. A mid-transfer R2 failure must instead
    // just end the response (partially or, if nothing was sent yet, as a
    // plain empty failure) and get logged.
    stream.on('error', (err) => {
      this.logger.error(`Download stream failed for token ${token}`, err as Error);
      res.end();
    });
    stream.pipe(res);
  }
}

@ApiTags('downloads')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('customers/me/downloads')
export class CustomerDownloadsController {
  constructor(private readonly downloads: DownloadsService) {}

  @Get()
  list(@CurrentCustomer() customer: { id: number }) {
    return this.downloads.listForCustomer(customer.id);
  }
}

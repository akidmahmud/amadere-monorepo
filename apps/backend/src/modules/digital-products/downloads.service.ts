import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MEDIA_STORAGE } from '../media/storage/media-storage.interface';
import type { MediaStorage } from '../media/storage/media-storage.interface';
import { OrderEmailsService } from '../order-emails/order-emails.service';

@Injectable()
export class DownloadsService {
  private readonly logger = new Logger(DownloadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    private readonly orderEmails: OrderEmailsService,
  ) {}

  /** One locked entitlement per digital line, created when the order is placed.
   * Locked because the buyer has not paid yet — see unlockForOrder. */
  async createForOrder(orderId: number): Promise<void> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    // productId is nullable on OrderItem (SetNull if the product is later
    // deleted) but required on DigitalDownload — a line that has already
    // lost its product can't get an entitlement, so it's excluded rather
    // than crashing the whole order's download creation.
    const digitalLines = order.items.filter(
      (i): i is typeof i & { productId: number } =>
        i.productTypeSnapshot === 'DIGITAL' && i.productId !== null,
    );
    if (digitalLines.length === 0) return;

    await this.prisma.client.digitalDownload.createMany({
      data: digitalLines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        customerId: order.customerId,
        // 48 hex chars. Emailed, so it must be unguessable on its own — it is
        // the only credential a guest presents.
        token: randomBytes(24).toString('hex'),
        unlockedAt: null,
      })),
    });
  }

  /** Called on payment confirmation — immediately for a ৳0 order, and when
   * staff verify a manual bKash payment otherwise. Swapping in a real gateway
   * later changes only who calls this. */
  async unlockForOrder(orderId: number): Promise<void> {
    // Our own timestamp rather than letting the DB pick one: it is reused
    // below as the exact marker for "the rows THIS call unlocked".
    const unlockedAt = new Date();
    const { count } = await this.prisma.client.digitalDownload.updateMany({
      where: { orderId, unlockedAt: null },
      data: { unlockedAt },
    });
    // Three call sites reach this method (checkout's free-order path,
    // ManualPaymentService.verify, OrdersService.updateStatus -> COMPLETED)
    // and it is deliberately idempotent, so a repeat call unlocks nothing —
    // and must therefore email nothing. Without this guard a staff member
    // re-saving a COMPLETED order would re-send the buyer's download mail.
    if (count === 0) return;

    // Delivery, not entitlement. The unlock above has already committed, and
    // is deliberately NOT inside a transaction with what follows: an SMTP
    // outage must never leave a paid customer locked out of their purchase.
    // OrderEmailsService is contractually non-throwing, but this catch is the
    // guarantee that does not depend on that contract holding.
    try {
      const rows = await this.prisma.client.digitalDownload.findMany({
        // Matching on the timestamp we just wrote, not on `unlockedAt: not
        // null`, so this only ever emails the rows this call unlocked — a
        // second digital purchase on the same order (or a concurrent unlock)
        // cannot cause a duplicate mail for an already-delivered token.
        //
        // `select`, never `include: { product: true }`: the R2 bucket is
        // fully public, so Product.digitalFileKey must not be read anywhere
        // except streamByToken.
        where: { orderId, unlockedAt },
        select: { token: true, productId: true },
      });
      await this.orderEmails.sendDigitalDownload(orderId, rows);
    } catch (err) {
      this.logger.error(
        `Download email failed for order ${orderId} — the unlock itself stands: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async streamByToken(token: string) {
    const download = await this.prisma.client.digitalDownload.findUnique({
      where: { token },
      include: { product: true },
    });
    if (!download) throw new NotFoundException('Download not found');
    if (!download.unlockedAt) {
      throw new ForbiddenException(
        'This download unlocks once your payment is confirmed.',
      );
    }
    if (!download.product.digitalFileKey) throw new NotFoundException('File is no longer available');

    // Stream obtained BEFORE the count is touched — a failed R2 read (object
    // missing, network error) must not count against the buyer's download
    // history when they never actually received a byte.
    const stream = await this.storage.getObjectStream(download.product.digitalFileKey);

    await this.prisma.client.digitalDownload.update({
      where: { id: download.id },
      // increment, not read-modify-write: two concurrent downloads of the
      // same token must not race and undercount.
      data: { downloadCount: { increment: 1 }, lastDownloadAt: new Date() },
    });

    return {
      stream,
      filename: download.product.digitalFileName ?? 'download.pdf',
    };
  }

  listForCustomer(customerId: number) {
    return this.prisma.client.digitalDownload.findMany({
      where: { customerId, unlockedAt: { not: null } },
      // `select`, not `include` — the bucket is fully public (see
      // Product.digitalFileKey's comment), so this response must never
      // carry digitalFileKey out to the client. The download endpoint is
      // the only thing allowed to read it.
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            digitalFileName: true,
            digitalFileSize: true,
            digitalPageCount: true,
            translations: true,
            // Cover image for the storefront downloads list. Same
            // primary-media shape cart.service.ts uses; a public Media.url,
            // so nothing private is added to this response.
            media: {
              where: { isPrimary: true },
              include: { media: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

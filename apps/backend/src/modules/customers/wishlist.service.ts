import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WISHLIST_PRODUCT_INCLUDE, toWishlistItemDto } from './wishlist.mapper';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: number, locale: Locale) {
    const items = await this.prisma.client.wishlistItem.findMany({
      where: { customerId },
      include: WISHLIST_PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => toWishlistItemDto(item, locale));
  }

  async add(customerId: number, productId: number) {
    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.prisma.client.wishlistItem.findUnique({
      where: { customerId_productId: { customerId, productId } },
    });
    if (existing) throw new ConflictException('Product already in wishlist');

    await this.prisma.client.wishlistItem.create({
      data: { customerId, productId },
    });
    return { success: true };
  }

  async remove(customerId: number, productId: number) {
    await this.prisma.client.wishlistItem
      .delete({ where: { customerId_productId: { customerId, productId } } })
      .catch(() => {
        throw new NotFoundException('Product not in wishlist');
      });
    return { success: true };
  }
}

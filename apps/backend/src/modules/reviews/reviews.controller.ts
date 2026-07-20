import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { PaginatedResult } from '@amader/shared';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { MediaService } from '../media/media.service';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProductReviewsPageDto, ReviewDto } from './reviews.mapper';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly media: MediaService,
  ) {}

  @Get('products/:productId/reviews')
  @ApiOkResponse({ type: ProductReviewsPageDto })
  publicList(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<ProductReviewsPageDto> {
    return this.reviews.publicListForProduct(
      productId,
      page ?? 1,
      pageSize ?? 20,
    );
  }

  // Public/unauthenticated — same reasoning as the manual-payment screenshot
  // upload (ManualPaymentPublicController): this only turns a file into a
  // storage URL, it never creates a Review row, so there's no real security
  // boundary to enforce here. The actual authorization (must be logged in,
  // must have a completed order for this product) happens at POST /reviews.
  @Post('reviews/upload')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadImage(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_IMAGE_BYTES })] }))
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const url = await this.media.uploadTransient(file);
    return { url };
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Post('reviews')
  @ApiOkResponse({ type: ReviewDto })
  create(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.create(customer.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Get('reviews/mine')
  @ApiPaginatedResponse(ReviewDto)
  mine(
    @CurrentCustomer() customer: { id: number },
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<ReviewDto>> {
    return this.reviews.myReviews(customer.id, page ?? 1, pageSize ?? 20);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProductReviewsPageDto, ReviewDto } from './reviews.mapper';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

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

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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('products/:productId/reviews')
  publicList(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.reviews.publicListForProduct(
      productId,
      page ?? 1,
      pageSize ?? 20,
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Post('reviews')
  create(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(customer.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Get('reviews/mine')
  mine(
    @CurrentCustomer() customer: { id: number },
    @Query() { page, pageSize }: PaginationQueryDto,
  ) {
    return this.reviews.myReviews(customer.id, page ?? 1, pageSize ?? 20);
  }
}

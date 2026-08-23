import { Module } from '@nestjs/common';
import { AdminAuthorsController } from './admin-authors.controller';
import { AuthorsService } from './authors.service';

// Admin-only on purpose: authors are read by the storefront through the
// product detail payload (PublicProductDetailDto.author), not through an
// author browse page — there are no /authors/:slug routes to serve yet.
@Module({
  controllers: [AdminAuthorsController],
  providers: [AuthorsService],
})
export class AuthorsModule {}

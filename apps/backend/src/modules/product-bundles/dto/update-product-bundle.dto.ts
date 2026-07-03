import { PartialType } from '@nestjs/swagger';
import { CreateProductBundleDto } from './create-product-bundle.dto';

export class UpdateProductBundleDto extends PartialType(
  CreateProductBundleDto,
) {}

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateUpsellStagesDto } from './dto/update-upsell-stages.dto';

// Full replace — the admin page always submits the complete stage set (max
// 6, enforced by the DTO), mirroring CustomerTiersService.replace().
@Injectable()
export class UpsellStagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.client.upsellStage.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async replace(stages: UpdateUpsellStagesDto['stages']) {
    for (const s of stages) {
      // Explicit null tests, not truthiness: 0 is a legal value for both
      // @Min(0) fields, so `discountPercent: 0` still means "the percent
      // field was set" — with truthiness, {discountPercent: 0,
      // discountFixedAmount: 500} slipped past both checks and persisted a
      // stage the pricing engine then had to disambiguate.
      if (s.discountPercent != null && s.discountFixedAmount != null) {
        throw new BadRequestException(`Stage "${s.label}" cannot set both a percentage and a fixed discount`);
      }
      if (s.discountPercent == null && s.discountFixedAmount == null && !s.freeShipping) {
        throw new BadRequestException(`Stage "${s.label}" must set a discount, free shipping, or both`);
      }
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.upsellStage.deleteMany({});
      if (stages.length > 0) {
        await tx.upsellStage.createMany({ data: stages });
      }
    });
    return this.list();
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { UpsertPaymentMethodConfigDto } from './dto/upsert-payment-method-config.dto';
import { PaymentMethodConfigDto, toPaymentMethodConfigDto } from './payment-method-config.mapper';

@Injectable()
export class PaymentMethodConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PaymentMethodConfigDto[]> {
    const rows = await this.prisma.client.paymentMethodConfig.findMany({ orderBy: { provider: 'asc' } });
    return rows.map(toPaymentMethodConfigDto);
  }

  async upsert(dto: UpsertPaymentMethodConfigDto): Promise<PaymentMethodConfigDto> {
    const row = await this.prisma.client.paymentMethodConfig.upsert({
      where: { provider: dto.provider },
      create: dto,
      update: dto,
    });
    return toPaymentMethodConfigDto(row);
  }

  // Public — what the storefront checkout renders for each manual method
  // (merchant number + instructions), only active configs.
  async publicList(): Promise<PaymentMethodConfigDto[]> {
    const rows = await this.prisma.client.paymentMethodConfig.findMany({
      where: { isActive: true },
      orderBy: { provider: 'asc' },
    });
    return rows.map(toPaymentMethodConfigDto);
  }
}

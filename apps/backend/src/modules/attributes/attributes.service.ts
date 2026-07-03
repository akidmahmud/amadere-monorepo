import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';
import { AttributeDto, toAttributeDto } from './attributes.mapper';

const WITH_RELATIONS = {
  translations: true,
  values: {
    include: { translations: true },
    orderBy: { sortOrder: 'asc' as const },
  },
};

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AttributeDto[]> {
    const attributes = await this.prisma.client.attribute.findMany({
      include: WITH_RELATIONS,
      orderBy: { sortOrder: 'asc' },
    });
    return attributes.map(toAttributeDto);
  }

  async get(id: number): Promise<AttributeDto> {
    const attribute = await this.prisma.client.attribute.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });
    if (!attribute) throw new NotFoundException('Attribute not found');
    return toAttributeDto(attribute);
  }

  async create(dto: CreateAttributeDto): Promise<AttributeDto> {
    await this.assertSlugAvailable(dto.slug);
    const attribute = await this.prisma.client.attribute.create({
      data: {
        slug: dto.slug,
        sortOrder: dto.sortOrder,
        translations: { create: dto.translations },
      },
      include: WITH_RELATIONS,
    });
    return toAttributeDto(attribute);
  }

  async update(id: number, dto: UpdateAttributeDto): Promise<AttributeDto> {
    await this.get(id);
    if (dto.slug) await this.assertSlugAvailable(dto.slug, id);

    if (dto.translations) {
      await this.prisma.client.attributeTranslation.deleteMany({
        where: { attributeId: id },
      });
    }

    const attribute = await this.prisma.client.attribute.update({
      where: { id },
      data: {
        slug: dto.slug,
        sortOrder: dto.sortOrder,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
      include: WITH_RELATIONS,
    });
    return toAttributeDto(attribute);
  }

  async delete(id: number): Promise<void> {
    await this.get(id);
    const usage = await this.prisma.client.productAttribute.count({
      where: { attributeId: id },
    });
    if (usage > 0)
      throw new ConflictException(
        'Attribute is still in use by one or more products',
      );
    await this.prisma.client.attribute.delete({ where: { id } });
  }

  async addValue(
    attributeId: number,
    dto: CreateAttributeValueDto,
  ): Promise<AttributeDto> {
    await this.get(attributeId);
    await this.prisma.client.attributeValue.create({
      data: {
        attributeId,
        colorHex: dto.colorHex,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder,
        translations: { create: dto.translations },
      },
    });
    return this.get(attributeId);
  }

  async updateValue(
    attributeId: number,
    valueId: number,
    dto: UpdateAttributeValueDto,
  ): Promise<AttributeDto> {
    await this.assertValueBelongsToAttribute(attributeId, valueId);

    if (dto.translations) {
      await this.prisma.client.attributeValueTranslation.deleteMany({
        where: { attributeValueId: valueId },
      });
    }

    await this.prisma.client.attributeValue.update({
      where: { id: valueId },
      data: {
        colorHex: dto.colorHex,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder,
        translations: dto.translations
          ? { create: dto.translations }
          : undefined,
      },
    });
    return this.get(attributeId);
  }

  async removeValue(
    attributeId: number,
    valueId: number,
  ): Promise<AttributeDto> {
    await this.assertValueBelongsToAttribute(attributeId, valueId);
    const usage = await this.prisma.client.productVariantAttributeValue.count({
      where: { attributeValueId: valueId },
    });
    if (usage > 0)
      throw new ConflictException(
        'Attribute value is still in use by one or more product variants',
      );
    await this.prisma.client.attributeValue.delete({ where: { id: valueId } });
    return this.get(attributeId);
  }

  private async assertValueBelongsToAttribute(
    attributeId: number,
    valueId: number,
  ): Promise<void> {
    const value = await this.prisma.client.attributeValue.findFirst({
      where: { id: valueId, attributeId },
    });
    if (!value) throw new NotFoundException('Attribute value not found');
  }

  private async assertSlugAvailable(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.attribute.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}

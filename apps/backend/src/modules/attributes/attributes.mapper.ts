import {
  Attribute,
  AttributeTranslation,
  AttributeValue,
  AttributeValueTranslation,
  Locale,
} from '@amader/db';

type AttributeValueWithTranslations = AttributeValue & {
  translations: AttributeValueTranslation[];
};
type AttributeWithRelations = Attribute & {
  translations: AttributeTranslation[];
  values: AttributeValueWithTranslations[];
};

export class AttributeValueTranslationDto {
  locale!: Locale;
  value!: string;
}

export class AttributeValueDto {
  id!: number;
  colorHex!: string | null;
  imageUrl!: string | null;
  sortOrder!: number;
  translations!: AttributeValueTranslationDto[];
}

export function toAttributeValueDto(
  value: AttributeValueWithTranslations,
): AttributeValueDto {
  return {
    id: value.id,
    colorHex: value.colorHex,
    imageUrl: value.imageUrl,
    sortOrder: value.sortOrder,
    translations: value.translations.map((t) => ({
      locale: t.locale,
      value: t.value,
    })),
  };
}

export class AttributeTranslationDto {
  locale!: Locale;
  name!: string;
}

export class AttributeDto {
  id!: number;
  slug!: string;
  sortOrder!: number;
  translations!: AttributeTranslationDto[];
  values!: AttributeValueDto[];
}

export function toAttributeDto(
  attribute: AttributeWithRelations,
): AttributeDto {
  return {
    id: attribute.id,
    slug: attribute.slug,
    sortOrder: attribute.sortOrder,
    translations: attribute.translations.map((t) => ({
      locale: t.locale,
      name: t.name,
    })),
    values: attribute.values.map(toAttributeValueDto),
  };
}

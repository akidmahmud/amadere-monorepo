import { Locale } from '@amader/db';

export class SynonymTermDto {
  locale!: Locale;
  term!: string;
}

export class SynonymGroupDto {
  id!: number;
  terms!: SynonymTermDto[];
}

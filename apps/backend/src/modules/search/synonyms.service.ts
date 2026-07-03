import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateSynonymGroupDto,
  UpdateSynonymGroupDto,
} from './dto/synonym-group.dto';

const WITH_TERMS = { terms: true } as const;

@Injectable()
export class SynonymsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.client.synonymGroup.findMany({
      include: WITH_TERMS,
      orderBy: { id: 'asc' },
    });
    return groups.map((g) => ({
      id: g.id,
      terms: g.terms.map((t) => ({ locale: t.locale, term: t.term })),
    }));
  }

  async create(dto: CreateSynonymGroupDto) {
    await this.assertTermsAvailable(dto.terms);
    const group = await this.prisma.client.synonymGroup.create({
      data: { terms: { create: dto.terms } },
      include: WITH_TERMS,
    });
    return {
      id: group.id,
      terms: group.terms.map((t) => ({ locale: t.locale, term: t.term })),
    };
  }

  async update(id: number, dto: UpdateSynonymGroupDto) {
    await this.assertExists(id);
    await this.assertTermsAvailable(dto.terms, id);

    await this.prisma.client.synonymTerm.deleteMany({ where: { groupId: id } });
    const group = await this.prisma.client.synonymGroup.update({
      where: { id },
      data: { terms: { create: dto.terms } },
      include: WITH_TERMS,
    });
    return {
      id: group.id,
      terms: group.terms.map((t) => ({ locale: t.locale, term: t.term })),
    };
  }

  async delete(id: number): Promise<void> {
    await this.assertExists(id);
    await this.prisma.client.synonymGroup.delete({ where: { id } });
  }

  // Given a raw query term, find every other term that shares its synonym
  // group (across locales) — e.g. "chatu" -> ["chatu", "sattu", "ছাতু"].
  async expand(rawTerm: string): Promise<string[]> {
    const normalized = rawTerm.trim().toLowerCase();
    const matches = await this.prisma.client.synonymTerm.findMany({
      where: { term: { equals: normalized, mode: 'insensitive' } },
    });
    if (matches.length === 0) return [normalized];

    const groupIds = [...new Set(matches.map((m) => m.groupId))];
    const allTerms = await this.prisma.client.synonymTerm.findMany({
      where: { groupId: { in: groupIds } },
    });
    return [
      ...new Set([normalized, ...allTerms.map((t) => t.term.toLowerCase())]),
    ];
  }

  private async assertExists(id: number): Promise<void> {
    const group = await this.prisma.client.synonymGroup.findUnique({
      where: { id },
    });
    if (!group) throw new NotFoundException('Synonym group not found');
  }

  private async assertTermsAvailable(
    terms: { term: string; locale: Locale }[],
    excludeGroupId?: number,
  ): Promise<void> {
    for (const t of terms) {
      const existing = await this.prisma.client.synonymTerm.findFirst({
        where: { term: t.term, locale: t.locale },
      });
      if (existing && existing.groupId !== excludeGroupId) {
        throw new ConflictException(
          `Term "${t.term}" (${t.locale}) is already in another synonym group`,
        );
      }
    }
  }
}

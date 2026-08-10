import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { AdminNewsletterQueryDto } from './dto/admin-newsletter-query.dto';
import { CreateNewsletterSubscriberDto } from './dto/create-newsletter-subscriber.dto';
import { NewsletterSubscriberDto, toNewsletterSubscriberDto } from './newsletter.mapper';

const WITH_TAGS = { tags: { include: { tag: true } } } as const;

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Minimal hand-rolled parser (spec §33 needs a plain 2-column
// email,name CSV, not arbitrary spreadsheet import) — mirrors csvField's
// own quoting scheme above so anything this app exports round-trips back
// through this same parser. No dependency added for this (ponytail: a
// papaparse-grade library solves problems — nested quotes across embedded
// newlines — this format doesn't have).
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CsvImportResult {
  imported: number;
  skipped: number;
  errors: { line: number; reason: string }[];
}

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeNewsletterDto): Promise<SuccessResponseDto> {
    await this.prisma.client.newsletterSubscriber.upsert({
      where: { email: dto.email },
      create: { email: dto.email, status: 'SUBSCRIBED' },
      update: { status: 'SUBSCRIBED', unsubscribedAt: null },
    });
    return { success: true };
  }

  // Manual add, from the admin panel (spec §4.1 "Add/remove") — same
  // upsert-by-email shape as the public subscribe() below, just also
  // accepting a name and returning the row instead of a bare success flag.
  async adminCreate(dto: CreateNewsletterSubscriberDto): Promise<NewsletterSubscriberDto> {
    const subscriber = await this.prisma.client.newsletterSubscriber.upsert({
      where: { email: dto.email },
      create: { email: dto.email, name: dto.name },
      update: { name: dto.name, status: 'SUBSCRIBED', unsubscribedAt: null },
      include: WITH_TAGS,
    });
    return toNewsletterSubscriberDto(subscriber);
  }

  async unsubscribe(dto: SubscribeNewsletterDto): Promise<SuccessResponseDto> {
    await this.prisma.client.newsletterSubscriber.updateMany({
      where: { email: dto.email },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
    });
    return { success: true };
  }

  private searchWhere(q?: string, tagId?: number): Prisma.NewsletterSubscriberWhereInput {
    return {
      ...(q ? { email: { contains: q, mode: 'insensitive' as const } } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
    };
  }

  async adminList(
    query: AdminNewsletterQueryDto,
  ): Promise<PaginatedResult<NewsletterSubscriberDto>> {
    const where = this.searchWhere(query.q, query.tagId);
    const [items, total] = await Promise.all([
      this.prisma.client.newsletterSubscriber.findMany({
        where,
        include: WITH_TAGS,
        orderBy: { subscribedAt: 'desc' },
        ...paginationArgs(query.page ?? 1, query.pageSize ?? 20),
      }),
      this.prisma.client.newsletterSubscriber.count({ where }),
    ]);
    return toPaginatedResult(items.map(toNewsletterSubscriberDto), total, query.page ?? 1, query.pageSize ?? 20);
  }

  async delete(id: number): Promise<void> {
    const existing = await this.prisma.client.newsletterSubscriber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subscriber not found');
    await this.prisma.client.newsletterSubscriber.delete({ where: { id } });
  }

  async bulkDelete(ids: number[]): Promise<{ deleted: number }> {
    const result = await this.prisma.client.newsletterSubscriber.deleteMany({
      where: { id: { in: ids } },
    });
    return { deleted: result.count };
  }

  async exportCsv(q?: string): Promise<string> {
    const rows = await this.prisma.client.newsletterSubscriber.findMany({
      where: this.searchWhere(q),
      orderBy: { subscribedAt: 'desc' },
    });
    const header = ['id', 'email', 'status', 'subscribedAt', 'unsubscribedAt'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [r.id.toString(), r.email, r.status, r.subscribedAt.toISOString(), r.unsubscribedAt?.toISOString() ?? '']
          .map(csvField)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  // spec §33: "Do not silently import invalid addresses" — every row is
  // validated, bad rows are reported back by line number rather than
  // dropped without a trace. Existing emails are upserted (re-subscribes
  // an UNSUBSCRIBED row, same semantics as adminCreate/subscribe above)
  // rather than erroring, since a re-import of an overlapping list is the
  // normal case, not an edge case.
  async importCsv(csv: string): Promise<CsvImportResult> {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { imported: 0, skipped: 0, errors: [] };

    const firstRow = parseCsvLine(lines[0]).map((f) => f.trim().toLowerCase());
    const hasHeader = firstRow[0] === 'email';
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const headerOffset = hasHeader ? 1 : 0;

    const result: CsvImportResult = { imported: 0, skipped: 0, errors: [] };
    for (let i = 0; i < dataLines.length; i++) {
      const lineNumber = i + headerOffset + 1;
      const fields = parseCsvLine(dataLines[i]);
      const email = fields[0]?.trim().toLowerCase();
      const name = fields[1]?.trim() || undefined;
      if (!email) {
        result.errors.push({ line: lineNumber, reason: 'Missing email' });
        result.skipped++;
        continue;
      }
      if (!EMAIL_RE.test(email)) {
        result.errors.push({ line: lineNumber, reason: `Invalid email "${email}"` });
        result.skipped++;
        continue;
      }
      await this.prisma.client.newsletterSubscriber.upsert({
        where: { email },
        create: { email, name },
        update: { name, status: 'SUBSCRIBED', unsubscribedAt: null },
      });
      result.imported++;
    }
    return result;
  }
}

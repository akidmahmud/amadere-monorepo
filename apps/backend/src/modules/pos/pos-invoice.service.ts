import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Staff paste their own receipt HTML, and the receipt page renders it with
 * dangerouslySetInnerHTML for every cashier — so it is sanitised once, at
 * write time (same approach as sanitize-campaign-html.util.ts). {{tags}} are
 * plain text and survive; values substituted into them are escaped client-side.
 */
export function sanitizeTemplate(html: string): string {
  return restoreRowTags(
    DOMPurify.sanitize(protectRowTags(html), {
      ADD_TAGS: ['style'],
      FORCE_BODY: true, // keep a leading <style> block
      FORBID_TAGS: [
        'script',
        'iframe',
        'object',
        'embed',
        'form',
        'base',
        'meta',
      ],
    }),
  );
}

/**
 * An HTML parser moves bare text that sits directly inside a <table> (between
 * rows) to before the table ("foster parenting") — so `{{vatRow}}` placed
 * between <tr>s would jump above the table on save. Before sanitising, such
 * tags become placeholder rows the parser leaves in place; afterwards they are
 * turned back into tags. Tags inside cells or outside tables are left alone.
 */
function protectRowTags(html: string): string {
  let table = 0;
  let cell = 0;
  return html.replace(
    /<\/?(table|td|th)\b[^>]*>|\{\{(\w+)\}\}/gi,
    (m, el: string | undefined, tag: string | undefined) => {
      if (el) {
        const closing = m.startsWith('</');
        if (el.toLowerCase() === 'table') table += closing ? -1 : 1;
        else cell += closing ? -1 : 1;
        return m;
      }
      return table > 0 && cell <= 0 ? `<tr data-pos-tag="${tag}"></tr>` : m;
    },
  );
}

function restoreRowTags(html: string): string {
  return html.replace(/<tr data-pos-tag="(\w+)"><\/tr>/g, '{{$1}}');
}

@Injectable()
export class PosInvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const [stores, rows] = await Promise.all([
      this.prisma.client.store.findMany({
        orderBy: [{ isOnlineStore: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true },
      }),
      this.prisma.client.posInvoiceTemplate.findMany({
        select: { storeId: true, updatedAt: true },
      }),
    ]);
    const saved = new Map(rows.map((r) => [r.storeId, r.updatedAt]));
    return [
      {
        storeId: null as number | null,
        storeName: 'Default',
        hasOwn: saved.has(null),
        updatedAt: saved.get(null) ?? null,
      },
      ...stores.map((s) => ({
        storeId: s.id,
        storeName: s.name,
        hasOwn: saved.has(s.id),
        updatedAt: saved.get(s.id) ?? null,
      })),
    ];
  }

  /** The exact saved HTML for one slot (null = Default), for the editor. */
  async get(storeId: number | null) {
    return (
      (
        await this.prisma.client.posInvoiceTemplate.findFirst({
          where: { storeId },
        })
      )?.html ?? null
    );
  }

  /** What a store's receipt prints: its own, else Default, else the built-in (html null). */
  async resolve(
    storeId: number,
  ): Promise<{ html: string | null; source: 'store' | 'default' | 'builtin' }> {
    const own = await this.prisma.client.posInvoiceTemplate.findFirst({
      where: { storeId },
    });
    if (own) return { html: own.html, source: 'store' };
    const def = await this.prisma.client.posInvoiceTemplate.findFirst({
      where: { storeId: null },
    });
    if (def) return { html: def.html, source: 'default' };
    return { html: null, source: 'builtin' };
  }

  async save(
    storeId: number | null,
    html: string,
    adminId: number,
  ): Promise<void> {
    const clean = sanitizeTemplate(html);
    if (storeId !== null) {
      await this.prisma.client.posInvoiceTemplate.upsert({
        where: { storeId },
        create: { storeId, html: clean, updatedById: adminId },
        update: { html: clean, updatedById: adminId },
      });
      return;
    }
    // A unique index can't upsert on NULL; the Default row is found by hand.
    const existing = await this.prisma.client.posInvoiceTemplate.findFirst({
      where: { storeId: null },
    });
    if (existing) {
      await this.prisma.client.posInvoiceTemplate.update({
        where: { id: existing.id },
        data: { html: clean, updatedById: adminId },
      });
    } else {
      await this.prisma.client.posInvoiceTemplate.create({
        data: { storeId: null, html: clean, updatedById: adminId },
      });
    }
  }

  async reset(storeId: number | null): Promise<void> {
    await this.prisma.client.posInvoiceTemplate.deleteMany({
      where: { storeId },
    });
  }
}

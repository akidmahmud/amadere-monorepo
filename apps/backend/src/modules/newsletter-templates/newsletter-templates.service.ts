import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sanitizeCampaignHtml } from '../../common/newsletter/sanitize-campaign-html.util';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { AdminNewsletterTemplateDto, toAdminNewsletterTemplateDto } from './newsletter-templates.mapper';

@Injectable()
export class NewsletterTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminNewsletterTemplateDto[]> {
    const templates = await this.prisma.client.newsletterTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
    return templates.map(toAdminNewsletterTemplateDto);
  }

  async get(id: number): Promise<AdminNewsletterTemplateDto> {
    return toAdminNewsletterTemplateDto(await this.getOrThrow(id));
  }

  async create(dto: CreateTemplateDto): Promise<AdminNewsletterTemplateDto> {
    const template = await this.prisma.client.newsletterTemplate.create({
      data: { name: dto.name, description: dto.description, contentJson: this.toContentJson(dto.blocks, dto.mode, dto.html) },
    });
    return toAdminNewsletterTemplateDto(template);
  }

  async update(id: number, dto: UpdateTemplateDto): Promise<AdminNewsletterTemplateDto> {
    await this.getOrThrow(id);
    const contentChanged = dto.blocks !== undefined || dto.mode !== undefined || dto.html !== undefined;
    const template = await this.prisma.client.newsletterTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        contentJson: contentChanged ? this.toContentJson(dto.blocks, dto.mode, dto.html) : undefined,
      },
    });
    return toAdminNewsletterTemplateDto(template);
  }

  async delete(id: number): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.client.newsletterTemplate.delete({ where: { id } });
  }

  async duplicate(id: number): Promise<AdminNewsletterTemplateDto> {
    const existing = await this.getOrThrow(id);
    const copy = await this.prisma.client.newsletterTemplate.create({
      data: { name: `${existing.name} (copy)`, description: existing.description, contentJson: existing.contentJson as Prisma.InputJsonValue },
    });
    return toAdminNewsletterTemplateDto(copy);
  }

  private toContentJson(
    blocks: CreateTemplateDto['blocks'],
    mode: CreateTemplateDto['mode'],
    html: CreateTemplateDto['html'],
  ): Prisma.InputJsonValue {
    return {
      version: 1,
      mode: mode ?? 'blocks',
      blocks: blocks ?? [],
      html: mode === 'html' && html ? sanitizeCampaignHtml(html) : undefined,
    } as unknown as Prisma.InputJsonValue;
  }

  private async getOrThrow(id: number) {
    const template = await this.prisma.client.newsletterTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }
}

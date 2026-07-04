import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  paginationArgs,
  toPaginatedResult,
} from '../../common/pagination.util';
import { CreateRedirectDto } from './dto/create-redirect.dto';
import { UpdateRedirectDto } from './dto/update-redirect.dto';
import { toRedirectDto } from './redirects.mapper';

@Injectable()
export class RedirectsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminList(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.client.redirect.findMany({
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(page, pageSize),
      }),
      this.prisma.client.redirect.count(),
    ]);
    return toPaginatedResult(items.map(toRedirectDto), total, page, pageSize);
  }

  async adminGet(id: number) {
    const redirect = await this.prisma.client.redirect.findUnique({
      where: { id },
    });
    if (!redirect) throw new NotFoundException('Redirect not found');
    return toRedirectDto(redirect);
  }

  async create(dto: CreateRedirectDto) {
    this.assertNotSelfLoop(dto.fromPath, dto.toPath);
    await this.assertFromPathAvailable(dto.fromPath);
    await this.assertNoTwoHopLoop(dto.fromPath, dto.toPath);

    const redirect = await this.prisma.client.redirect.create({
      data: {
        fromPath: dto.fromPath,
        toPath: dto.toPath,
        statusCode: dto.statusCode,
        isActive: dto.isActive,
      },
    });
    return toRedirectDto(redirect);
  }

  async update(id: number, dto: UpdateRedirectDto) {
    const existing = await this.adminGet(id);
    const fromPath = dto.fromPath ?? existing.fromPath;
    const toPath = dto.toPath ?? existing.toPath;
    this.assertNotSelfLoop(fromPath, toPath);
    if (dto.fromPath) await this.assertFromPathAvailable(dto.fromPath, id);
    await this.assertNoTwoHopLoop(fromPath, toPath, id);

    const redirect = await this.prisma.client.redirect.update({
      where: { id },
      data: {
        fromPath: dto.fromPath,
        toPath: dto.toPath,
        statusCode: dto.statusCode,
        isActive: dto.isActive,
      },
    });
    return toRedirectDto(redirect);
  }

  async delete(id: number): Promise<void> {
    await this.adminGet(id);
    await this.prisma.client.redirect.delete({ where: { id } });
  }

  // Public lookup for a headless frontend/proxy to consult before rendering
  // a 404 (AGENTS.md §9: "zero critical 404s"). Single-hop only — resolve()
  // does not chase multi-step redirect chains, so the create/update guards
  // below are what actually keep the data loop-free.
  async resolve(path: string) {
    const redirect = await this.prisma.client.redirect.findFirst({
      where: { fromPath: path, isActive: true },
    });
    if (!redirect) return { redirect: false as const };
    return {
      redirect: true as const,
      toPath: redirect.toPath,
      statusCode: redirect.statusCode,
    };
  }

  private assertNotSelfLoop(fromPath: string, toPath: string): void {
    if (fromPath === toPath) {
      throw new BadRequestException('fromPath and toPath cannot be the same');
    }
  }

  private async assertFromPathAvailable(
    fromPath: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.client.redirect.findUnique({
      where: { fromPath },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A redirect from "${fromPath}" already exists`,
      );
    }
  }

  private async assertNoTwoHopLoop(
    fromPath: string,
    toPath: string,
    excludeId?: number,
  ): Promise<void> {
    const reverse = await this.prisma.client.redirect.findUnique({
      where: { fromPath: toPath },
    });
    if (reverse && reverse.toPath === fromPath && reverse.id !== excludeId) {
      throw new ConflictException(
        `This would create a redirect loop with existing redirect #${reverse.id}`,
      );
    }
  }
}

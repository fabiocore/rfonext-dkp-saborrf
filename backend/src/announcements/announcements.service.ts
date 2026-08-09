import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(title: string, body: string, createdById: string) {
    if (!title?.trim() || !body?.trim()) {
      throw new BadRequestException('Título e mensagem são obrigatórios.');
    }
    const count = await this.prisma.announcement.count();
    if (count >= 2) {
      throw new BadRequestException(
        'Só é possível ter 2 avisos ao mesmo tempo. Edite ou remova um antes de criar outro.',
      );
    }
    return this.prisma.announcement.create({ data: { title, body, createdById } });
  }

  update(id: string, data: { title?: string; body?: string }) {
    return this.prisma.announcement.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }
}

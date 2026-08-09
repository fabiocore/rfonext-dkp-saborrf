import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProtectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.protection.findMany({ orderBy: { minLevel: 'asc' } });
  }

  create(data: { name: string; description: string; minBid: number; minLevel: number }) {
    return this.prisma.protection.create({ data });
  }

  update(
    id: string,
    data: Partial<{ name: string; description: string; minBid: number; minLevel: number; isActive: boolean }>,
  ) {
    return this.prisma.protection.update({ where: { id }, data });
  }
}

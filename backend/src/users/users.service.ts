import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { generateNumericPassword } from '../auth/password.util';

function sanitize(user: User) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCouncil() {
    const users = await this.prisma.user.findMany({
      where: { role: 'COUNCIL' },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(sanitize);
  }

  /**
   * Cria uma conta de conselho com senha numérica aleatória de 10 dígitos,
   * gerada pelo sistema — só o GM vê essa senha aqui, uma vez (PREMISSAS.md
   * seção 8). Não há self-service de reset pro conselheiro.
   */
  async createCouncil(username: string, createdById: string) {
    const generatedPassword = generateNumericPassword(10);
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const user = await this.prisma.user.create({
      data: { username, passwordHash, role: 'COUNCIL', createdById },
    });
    return { user: sanitize(user), generatedPassword };
  }

  async resetCouncilPassword(id: string) {
    await this.assertIsCouncil(id);
    const generatedPassword = generateNumericPassword(10);
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const user = await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { user: sanitize(user), generatedPassword };
  }

  async setCouncilActive(id: string, isActive: boolean) {
    await this.assertIsCouncil(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive } });
    return sanitize(user);
  }

  private async assertIsCouncil(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.role !== 'COUNCIL') {
      throw new ForbiddenException('Esta ação só se aplica a contas de conselho.');
    }
    return user;
  }
}

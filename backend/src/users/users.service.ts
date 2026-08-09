import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { generateNumericPassword } from '../auth/password.util';

const STAFF_ROLES: UserRole[] = ['COUNCIL', 'VICE_GM'];

function sanitize(user: User) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Conselho + Vice-GM — contas que o GM/Vice-GM gerencia (PREMISSAS.md seção 8). */
  async listStaff() {
    const users = await this.prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      orderBy: { createdAt: 'asc' },
    });
    return users.map(sanitize);
  }

  /** Todas as contas (GM/Vice-GM/Conselho) — só id/username/role, pra popular o dropdown de vínculo em Personagens. */
  async listAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, role: true },
    });
    return users;
  }

  /**
   * Cria conta de Conselho ou Vice-GM com senha numérica aleatória de 10
   * dígitos, gerada pelo sistema — só GM/Vice-GM vê essa senha aqui, uma vez
   * (PREMISSAS.md seção 8). Não há self-service de reset. Sem limite de
   * quantidade — o número de vagas (1 Vice-GM, 6 conselheiros) é só
   * planejamento da guild, não uma trava do sistema.
   */
  async createStaff(username: string, role: 'COUNCIL' | 'VICE_GM', createdById: string) {
    if (!STAFF_ROLES.includes(role)) {
      throw new BadRequestException('Papel inválido.');
    }
    const generatedPassword = generateNumericPassword(10);
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const user = await this.prisma.user.create({
      data: { username, passwordHash, role, createdById },
    });
    return { user: sanitize(user), generatedPassword };
  }

  async resetStaffPassword(id: string) {
    await this.assertIsStaff(id);
    const generatedPassword = generateNumericPassword(10);
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const user = await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { user: sanitize(user), generatedPassword };
  }

  async setStaffActive(id: string, isActive: boolean) {
    await this.assertIsStaff(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive } });
    return sanitize(user);
  }

  private async assertIsStaff(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException('Esta ação só se aplica a contas de Conselho ou Vice-GM.');
    }
    return user;
  }
}

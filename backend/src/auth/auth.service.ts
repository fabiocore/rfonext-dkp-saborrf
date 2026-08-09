import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { generateNumericPassword } from './password.util';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Bootstrap do GM: se ainda não existir nenhuma conta com papel GM no
   * banco, cria uma a partir das variáveis de ambiente (PREMISSAS.md seção
   * 8 — GM não é criado pela UI).
   */
  async onModuleInit() {
    const existingGm = await this.prisma.user.findFirst({ where: { role: 'GM' } });
    if (existingGm) return;

    const username = this.config.get<string>('GM_BOOTSTRAP_USERNAME') ?? 'guildmaster';
    const password = this.config.get<string>('GM_BOOTSTRAP_PASSWORD') ?? generateNumericPassword(10);
    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.user.create({
      data: { username, passwordHash, role: 'GM' },
    });

    this.logger.warn(
      `Conta de GM criada automaticamente (usuário: "${username}"). ` +
        `Troque a senha assim que possível — ela veio de GM_BOOTSTRAP_PASSWORD.`,
    );
  }

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Usuário ou senha inválidos.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      accessToken,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }
}

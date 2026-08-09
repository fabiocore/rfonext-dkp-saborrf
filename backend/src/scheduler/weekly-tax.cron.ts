import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class WeeklyTaxCronService {
  private readonly logger = new Logger(WeeklyTaxCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  // Roda a cada 5 minutos e só executa de fato quando o dia da semana E o
  // horário batem com GuildSettings.weeklyTaxWeekday/weeklyTaxTimeUtcMinutes
  // (ambos em UTC — o GM configura em horário local, convertido na tela de
  // Configurações). Janela de 5min alinhada ao próprio tick do cron, pra não
  // perder o horário exato se o container reiniciar bem naquela hora.
  @Cron('*/5 * * * *')
  async handleCron() {
    const settings = await this.prisma.guildSettings.findUnique({ where: { id: 1 } });
    if (!settings) return;

    const now = new Date();
    if (now.getUTCDay() !== settings.weeklyTaxWeekday) return;

    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const target = settings.weeklyTaxTimeUtcMinutes;
    if (nowMinutes < target || nowMinutes >= target + 5) return;

    const recentRun = await this.prisma.weeklyTaxRun.findFirst({
      where: { executedAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) } },
      orderBy: { executedAt: 'desc' },
    });
    if (recentRun) return; // já rodou nas últimas 20h, evita duplicar em caso de reinício do container

    this.logger.log('Executando corte semanal automático...');
    const run = await this.ledgerService.runWeeklyTax();
    this.logger.log(
      `Corte semanal concluído: ${run.totalCharactersTaxed} personagem(ns) taxado(s), ${run.totalAmountBurned} queimado(s).`,
    );
  }
}

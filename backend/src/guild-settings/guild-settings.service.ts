import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 1;

@Injectable()
export class GuildSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Configurações da guild são uma linha única (id fixo). Criada com valores
   * padrão na primeira leitura, caso ainda não exista (evita depender de seed).
   */
  async getSettings() {
    return this.prisma.guildSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: {
        id: SETTINGS_ID,
        guildName: 'Minha Guild',
      },
    });
  }

  async updateSettings(data: {
    guildName?: string;
    currencyName?: string;
    currencyAbbr?: string;
    defaultLocale?: string;
    weeklyTaxPercent?: number;
    weeklyTaxWeekday?: number;
    weeklyTaxTimeUtcMinutes?: number;
    defaultMinBid?: number;
    logoUrl?: string | null;
  }) {
    if (data.weeklyTaxPercent !== undefined) {
      if (data.weeklyTaxPercent < 1 || data.weeklyTaxPercent > 20) {
        throw new Error('weeklyTaxPercent deve estar entre 1 e 20');
      }
    }
    if (data.weeklyTaxWeekday !== undefined) {
      if (data.weeklyTaxWeekday < 0 || data.weeklyTaxWeekday > 6) {
        throw new Error('weeklyTaxWeekday deve estar entre 0 (domingo) e 6 (sábado)');
      }
    }
    if (data.weeklyTaxTimeUtcMinutes !== undefined) {
      if (data.weeklyTaxTimeUtcMinutes < 0 || data.weeklyTaxTimeUtcMinutes > 1439) {
        throw new Error('weeklyTaxTimeUtcMinutes deve estar entre 0 e 1439');
      }
    }
    if (data.defaultMinBid !== undefined && data.defaultMinBid < 0) {
      throw new Error('defaultMinBid não pode ser negativo');
    }

    await this.getSettings(); // garante que a linha exista

    // Monta o patch explicitamente (em vez de repassar `data` cru) pra
    // `pinnedAnnouncementText` nunca vazar por aqui — esse campo só pode ser
    // alterado por `updatePinnedAnnouncement`, que é GM-only; esta rota
    // aceita GM e Conselho.
    const {
      guildName,
      currencyName,
      currencyAbbr,
      defaultLocale,
      weeklyTaxPercent,
      weeklyTaxWeekday,
      weeklyTaxTimeUtcMinutes,
      defaultMinBid,
      logoUrl,
    } = data;

    return this.prisma.guildSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        guildName,
        currencyName,
        currencyAbbr,
        defaultLocale,
        weeklyTaxPercent,
        weeklyTaxWeekday,
        weeklyTaxTimeUtcMinutes,
        defaultMinBid,
        logoUrl,
      },
    });
  }

  /** Aviso fixo em destaque na home pública — exclusivo do GM (nunca o Conselho). */
  async updatePinnedAnnouncement(text: string) {
    await this.getSettings();
    return this.prisma.guildSettings.update({
      where: { id: SETTINGS_ID },
      data: { pinnedAnnouncementText: text?.trim() || null },
    });
  }
}

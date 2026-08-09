import { Body, Controller, Get, Put } from '@nestjs/common';
import { GuildSettingsService } from './guild-settings.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

// GET é intencionalmente público — a marca/moeda da guild aparece nas páginas públicas.
@Controller('guild-settings')
export class GuildSettingsController {
  constructor(private readonly guildSettingsService: GuildSettingsService) {}

  @Public()
  @Get()
  getSettings() {
    return this.guildSettingsService.getSettings();
  }

  @Roles('GM', 'COUNCIL')
  @Put()
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.guildSettingsService.updateSettings(body);
  }

  // GM-only: aviso fixo em destaque na home pública — "somente eu" (o GM),
  // nunca o Conselho.
  @Roles('GM')
  @Put('pinned-announcement')
  updatePinnedAnnouncement(@Body('text') text: string) {
    return this.guildSettingsService.updatePinnedAnnouncement(text);
  }
}

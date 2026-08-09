import { Module } from '@nestjs/common';
import { GuildSettingsService } from './guild-settings.service';
import { GuildSettingsController } from './guild-settings.controller';

@Module({
  providers: [GuildSettingsService],
  controllers: [GuildSettingsController],
  exports: [GuildSettingsService],
})
export class GuildSettingsModule {}

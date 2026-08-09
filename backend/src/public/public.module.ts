import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AnnouncementsModule } from '../announcements/announcements.module';

@Module({
  imports: [LedgerModule, ActivitiesModule, AnnouncementsModule],
  controllers: [PublicController],
})
export class PublicModule {}

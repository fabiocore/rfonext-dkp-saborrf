import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { GuildSettingsModule } from './guild-settings/guild-settings.module';
import { CharactersModule } from './characters/characters.module';
import { ActivitiesModule } from './activities/activities.module';
import { ImportModule } from './import/import.module';
import { LedgerModule } from './ledger/ledger.module';
import { PublicModule } from './public/public.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProtectionsModule } from './protections/protections.module';
import { UploadsModule } from './uploads/uploads.module';
import { AuctionsModule } from './auctions/auctions.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { BackupModule } from './backup/backup.module';
import { ProfileModule } from './profile/profile.module';
import { VotingModule } from './voting/voting.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    GuildSettingsModule,
    CharactersModule,
    ActivitiesModule,
    ProtectionsModule,
    ImportModule,
    LedgerModule,
    UploadsModule,
    AuctionsModule,
    SchedulerModule,
    AnnouncementsModule,
    BackupModule,
    ProfileModule,
    VotingModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

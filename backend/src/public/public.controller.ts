import { Controller, Get, Query } from '@nestjs/common';
import { LedgerService } from '../ledger/ledger.service';
import { ActivitiesService } from '../activities/activities.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Endpoints de transparência total — sem login, sem código (PREMISSAS.md
 * seção 9).
 */
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly activitiesService: ActivitiesService,
    private readonly announcementsService: AnnouncementsService,
  ) {}

  // Saldo de todo mundo — não é ranking/disputa, por isso vem em ordem
  // alfabética (ver LedgerService.getBalances).
  @Get('balances')
  getBalances(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.ledgerService.getBalances({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('feed')
  getFeed(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('characterId') characterId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.ledgerService.getPublicFeed({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      characterId,
      fromDate,
      toDate,
    });
  }

  @Get('events')
  getEvents() {
    return this.activitiesService.listPublicEvents();
  }

  @Get('announcements')
  getAnnouncements() {
    return this.announcementsService.list();
  }
}

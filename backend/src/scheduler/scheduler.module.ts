import { Module } from '@nestjs/common';
import { WeeklyTaxCronService } from './weekly-tax.cron';
import { AuctionExpiryCronService } from './auction-expiry.cron';
import { LedgerModule } from '../ledger/ledger.module';
import { AuctionsModule } from '../auctions/auctions.module';

@Module({
  imports: [LedgerModule, AuctionsModule],
  providers: [WeeklyTaxCronService, AuctionExpiryCronService],
})
export class SchedulerModule {}

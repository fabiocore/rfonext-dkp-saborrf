import { Module } from '@nestjs/common';
import { WeeklyTaxCronService } from './weekly-tax.cron';
import { AuctionExpiryCronService } from './auction-expiry.cron';
import { VotingExpiryCronService } from './voting-expiry.cron';
import { LedgerModule } from '../ledger/ledger.module';
import { AuctionsModule } from '../auctions/auctions.module';
import { VotingModule } from '../voting/voting.module';

@Module({
  imports: [LedgerModule, AuctionsModule, VotingModule],
  providers: [WeeklyTaxCronService, AuctionExpiryCronService, VotingExpiryCronService],
})
export class SchedulerModule {}

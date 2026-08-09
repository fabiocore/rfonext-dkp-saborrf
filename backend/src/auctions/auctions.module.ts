import { Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { PublicAuctionsController } from './public-auctions.controller';
import { PlayerAuctionsController } from './player-auctions.controller';

@Module({
  providers: [AuctionsService],
  controllers: [AuctionsController, PublicAuctionsController, PlayerAuctionsController],
  exports: [AuctionsService],
})
export class AuctionsModule {}

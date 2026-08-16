import { Module } from '@nestjs/common';
import { VotingService } from './voting.service';
import { VotingController } from './voting.controller';
import { PublicVotingController } from './public-voting.controller';

@Module({
  providers: [VotingService],
  controllers: [VotingController, PublicVotingController],
  exports: [VotingService],
})
export class VotingModule {}

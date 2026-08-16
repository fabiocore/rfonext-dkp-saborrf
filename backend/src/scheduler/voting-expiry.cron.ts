import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VotingService } from '../voting/voting.service';

@Injectable()
export class VotingExpiryCronService {
  private readonly logger = new Logger(VotingExpiryCronService.name);

  constructor(private readonly votingService: VotingService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const { closed } = await this.votingService.resolveExpiredTopics();
    if (closed > 0) {
      this.logger.log(`${closed} votação(ões) encerrada(s) automaticamente por prazo.`);
    }
  }
}

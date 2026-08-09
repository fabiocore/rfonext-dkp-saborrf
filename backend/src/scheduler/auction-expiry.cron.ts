import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuctionsService } from '../auctions/auctions.service';

@Injectable()
export class AuctionExpiryCronService {
  private readonly logger = new Logger(AuctionExpiryCronService.name);

  constructor(private readonly auctionsService: AuctionsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    const { resolvedAuctions } = await this.auctionsService.resolveExpiredAuctions();
    if (resolvedAuctions > 0) {
      this.logger.log(`${resolvedAuctions} leilão(ões) expirado(s) resolvido(s).`);
    }
  }
}

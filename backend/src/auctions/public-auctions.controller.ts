import { Controller, Get, Param } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { Public } from '../auth/decorators/public.decorator';

// Painel público de leilões — em andamento e histórico, sem login nem código (PREMISSAS.md seção 7/9).
@Public()
@Controller('public/auctions')
export class PublicAuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Get()
  list() {
    return this.auctionsService.getPublicList();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.auctionsService.getPublicDetail(id);
  }
}

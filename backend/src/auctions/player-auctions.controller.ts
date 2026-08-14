import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { Public } from '../auth/decorators/public.decorator';

// Acesso do jogador via código — sem conta, sem login (PREMISSAS.md seção 7/8).
// O código em si é a credencial; por isso essas rotas ficam @Public() (fora do JWT).
@Public()
@Controller('player-auctions')
export class PlayerAuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  // Central pessoal: lista os leilões abertos em que o dono do código
  // (fixo, por personagem) participa.
  @Get(':code')
  getMyAuctions(@Param('code') code: string) {
    return this.auctionsService.getMyAuctions(code);
  }

  @Get(':code/:auctionId')
  getView(@Param('code') code: string, @Param('auctionId') auctionId: string) {
    return this.auctionsService.getParticipantView(code, auctionId);
  }

  @Post(':code/items/:itemId/bids')
  placeBid(@Param('code') code: string, @Param('itemId') itemId: string, @Body('amount') amount: number) {
    return this.auctionsService.placeBid(code, itemId, Number(amount));
  }

  @Post(':code/items/:itemId/withdraw')
  withdraw(@Param('code') code: string, @Param('itemId') itemId: string) {
    return this.auctionsService.withdrawFromItem(code, itemId);
  }
}

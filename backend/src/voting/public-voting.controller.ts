import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { VotingService } from './voting.service';
import { Public } from '../auth/decorators/public.decorator';

// Acesso do jogador é pelo código de PERFIL (o mesmo do /perfil, não um
// código novo) — sem login (PREMISSAS.md seção 3/9).
@Public()
@Controller('public/voting-topics')
export class PublicVotingController {
  constructor(private readonly votingService: VotingService) {}

  // Usado pela home/menu pra decidir se mostra o link "Votação" — só existe
  // no máximo 1 tópico OPEN por vez.
  @Get('current')
  getCurrentOpenTopic() {
    return this.votingService.getCurrentOpenTopic();
  }

  @Get(':id')
  getTopicForVoting(@Param('id') id: string) {
    return this.votingService.getTopicForVoting(id);
  }

  @Post(':id/vote')
  vote(
    @Param('id') id: string,
    @Body('code') code: string,
    @Body('optionIds') optionIds: string[],
    @Body('message') message?: string,
  ) {
    return this.votingService.vote(id, code, optionIds ?? [], message);
  }

  @Get(':id/results')
  getResults(@Param('id') id: string, @Query('code') code?: string) {
    return this.votingService.getResults(id, code);
  }
}

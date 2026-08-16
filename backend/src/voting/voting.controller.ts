import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { VotingService } from './voting.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

// Conselho tem acesso de leitura (mesmo padrão do resto do admin), mas
// criar/publicar/encerrar/ocultar mensagem é GM/Vice-GM só — decisão
// explícita do GM, diferente do leilão (onde Conselho também publica,
// com aprovação dupla).
@Roles('GM', 'VICE_GM', 'COUNCIL')
@Controller('voting-topics')
export class VotingController {
  constructor(private readonly votingService: VotingService) {}

  @Get()
  listForStaff() {
    return this.votingService.listForStaff();
  }

  @Get(':id')
  getForStaff(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.votingService.getForStaff(id, user.role);
  }

  @Roles('GM', 'VICE_GM')
  @Post()
  createDraft(@Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.votingService.createDraft(body, user.id);
  }

  @Roles('GM', 'VICE_GM')
  @Delete(':id')
  deleteDraft(@Param('id') id: string) {
    return this.votingService.deleteDraft(id);
  }

  @Roles('GM', 'VICE_GM')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.votingService.publish(id);
  }

  @Roles('GM', 'VICE_GM')
  @Post(':id/close')
  close(@Param('id') id: string, @Body('reason') reason: string) {
    return this.votingService.closeManually(id, reason);
  }

  @Roles('GM', 'VICE_GM')
  @Post(':id/votes/:characterId/hide-message')
  hideMessage(@Param('id') id: string, @Param('characterId') characterId: string) {
    return this.votingService.hideMessage(id, characterId);
  }

  @Roles('GM', 'VICE_GM')
  @Post(':id/votes/:characterId/unhide-message')
  unhideMessage(@Param('id') id: string, @Param('characterId') characterId: string) {
    return this.votingService.unhideMessage(id, characterId);
  }
}

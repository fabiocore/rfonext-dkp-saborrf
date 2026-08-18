import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Roles('GM', 'VICE_GM', 'COUNCIL')
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Post()
  createDraft(@Body('title') title: string, @CurrentUser() user: AuthenticatedUser) {
    return this.auctionsService.createDraft(title, user.id);
  }

  @Get()
  listForStaff() {
    return this.auctionsService.listForStaff();
  }

  @Get(':id')
  getForStaff(@Param('id') id: string) {
    return this.auctionsService.getForStaff(id);
  }

  // Só apaga rascunho/aguardando aprovação — um leilão já publicado usa
  // closeAuction (com motivo) em vez de ser apagado.
  @Delete(':id')
  deleteDraft(@Param('id') id: string) {
    return this.auctionsService.deleteDraft(id);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() body: any) {
    return this.auctionsService.addItem(id, body);
  }

  @Patch(':id/items/:itemId')
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: any) {
    return this.auctionsService.updateItem(id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.auctionsService.removeItem(id, itemId);
  }

  @Put(':id/participants')
  setParticipants(@Param('id') id: string, @Body('characterIds') characterIds: string[]) {
    return this.auctionsService.setParticipants(id, characterIds ?? []);
  }

  @Put(':id/schedule')
  setSchedule(@Param('id') id: string, @Body('scheduledEndAt') scheduledEndAt: string) {
    return this.auctionsService.setSchedule(id, scheduledEndAt);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.auctionsService.approve(id, user);
  }

  // GM-only: encerrar item/leilão antes da hora exige justificativa (PREMISSAS.md seção 7).
  @Roles('GM', 'VICE_GM')
  @Post(':id/items/:itemId/cancel')
  cancelItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body('reason') reason: string) {
    return this.auctionsService.cancelItem(id, itemId, reason);
  }

  @Roles('GM', 'VICE_GM')
  @Post(':id/close')
  closeAuction(@Param('id') id: string, @Body('reason') reason: string) {
    return this.auctionsService.closeAuction(id, reason);
  }

  // GM-only: controle total — apaga um leilão/item em QUALQUER status
  // (rascunho, aberto ou encerrado), sempre com motivo obrigatório. Se
  // algum item já tinha sido vencido (queima real), a queima nunca é
  // apagada — uma reversão é criada (ver AuctionsService.forceDeleteItem).
  @Roles('GM', 'VICE_GM')
  @Delete(':id/force')
  forceDeleteAuction(@Param('id') id: string, @Body('reason') reason: string) {
    return this.auctionsService.forceDeleteAuction(id, reason);
  }

  @Roles('GM', 'VICE_GM')
  @Delete(':id/items/:itemId/force')
  forceDeleteItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body('reason') reason: string) {
    return this.auctionsService.forceDeleteItem(id, itemId, reason);
  }

  // GM-only: desfaz uma vitória automática prematura (só sobrou 1
  // concorrente ativo após desistências, com o leilão ainda bem aberto) —
  // reverte a queima e volta o item pra PENDING (ver AuctionsService.reopenItem).
  @Roles('GM', 'VICE_GM')
  @Post(':id/items/:itemId/reopen')
  reopenItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body('reason') reason: string) {
    return this.auctionsService.reopenItem(id, itemId, reason);
  }
}

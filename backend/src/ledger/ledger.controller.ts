import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Roles('GM', 'COUNCIL')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('character/:characterId')
  getTransactions(@Param('characterId') characterId: string) {
    return this.ledgerService.getTransactionsForCharacter(characterId);
  }

  @Get('character/:characterId/balance')
  async getBalance(@Param('characterId') characterId: string) {
    return { balance: await this.ledgerService.getBalance(characterId) };
  }

  @Post('manual-event')
  recordManualEvent(@Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.ledgerService.recordManualEventBatch({ ...body, createdById: user.id });
  }

  @Post('transfer')
  recordTransfer(@Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.ledgerService.recordTransfer({ ...body, createdById: user.id });
  }

  // GM-only: Emissão Manual (crédito ou queima avulsa) — PREMISSAS.md seção 8.
  @Roles('GM')
  @Post('manual-adjustment')
  recordManualAdjustment(@Body() body: any, @CurrentUser() user: AuthenticatedUser) {
    return this.ledgerService.recordGmManualAdjustment({ ...body, createdById: user.id });
  }

  @Get('weekly-tax/runs')
  listWeeklyTaxRuns() {
    return this.ledgerService.listWeeklyTaxRuns();
  }

  // GM-only: dispara o corte semanal fora do horário automático (ex: pra
  // recuperar uma semana em que o cron não rodou) — sempre com motivo
  // obrigatório, guardado no WeeklyTaxRun e em cada transação gerada.
  @Roles('GM')
  @Post('weekly-tax/run-now')
  runWeeklyTaxNow(@Body('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ledgerService.runWeeklyTax({ manual: true, reason, triggeredById: user.id });
  }
}

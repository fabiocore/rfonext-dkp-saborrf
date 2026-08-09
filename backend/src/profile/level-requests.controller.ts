import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

// Fila de aprovação de mudança de nível pedida pelo próprio membro via
// /perfil — GM e conselho revisam (mesmo nível de acesso que o resto do
// cadastro de personagens, PREMISSAS.md seção 8).
@Roles('GM', 'VICE_GM', 'COUNCIL')
@Controller('level-requests')
export class LevelRequestsController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  list(@Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.profileService.listLevelRequests(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.profileService.approveLevelRequest(id, user.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.profileService.rejectLevelRequest(id, user.id, reason);
  }
}

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GM/Vice-GM: gestão de contas de Conselho e Vice-GM (PREMISSAS.md seção 8).
  @Roles('GM', 'VICE_GM')
  @Get('staff')
  listStaff() {
    return this.usersService.listStaff();
  }

  @Roles('GM', 'VICE_GM')
  @Post('staff')
  create(@Body('username') username: string, @Body('role') role: 'COUNCIL' | 'VICE_GM', @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.createStaff(username, role, actor.id);
  }

  @Roles('GM', 'VICE_GM')
  @Post('staff/:id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetStaffPassword(id);
  }

  @Roles('GM', 'VICE_GM')
  @Patch('staff/:id/active')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.setStaffActive(id, isActive);
  }

  // GM/Vice-GM/Conselho: lista mínima de todas as contas, pra vincular um
  // personagem a uma conta na tela de Personagens.
  @Roles('GM', 'VICE_GM', 'COUNCIL')
  @Get('all')
  listAll() {
    return this.usersService.listAll();
  }
}

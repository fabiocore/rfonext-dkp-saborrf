import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

// GM-only: gestão de contas de conselho (PREMISSAS.md seção 8).
@Roles('GM')
@Controller('users/council')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.listCouncil();
  }

  @Post()
  create(@Body('username') username: string, @CurrentUser() gm: AuthenticatedUser) {
    return this.usersService.createCouncil(username, gm.id);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetCouncilPassword(id);
  }

  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.setCouncilActive(id, isActive);
  }
}

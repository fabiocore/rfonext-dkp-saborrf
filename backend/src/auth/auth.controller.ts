import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.changePassword(user.id, currentPassword, newPassword);
    return { success: true };
  }

  @Post('recovery-code')
  async setRecoveryCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body('currentPassword') currentPassword: string,
    @Body('recoveryCode') recoveryCode: string,
  ) {
    await this.authService.setRecoveryCode(user.id, currentPassword, recoveryCode);
    return { success: true };
  }

  @Get('recovery-code')
  async getRecoveryCodeStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getRecoveryCodeStatus(user.id);
  }

  @Public()
  @Post('recover-password')
  async recoverPassword(
    @Body('username') username: string,
    @Body('recoveryCode') recoveryCode: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.recoverPassword(username, recoveryCode, newPassword);
    return { success: true };
  }
}

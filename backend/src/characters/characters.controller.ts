import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('GM', 'VICE_GM', 'COUNCIL')
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  findAll() {
    return this.charactersService.findAll();
  }

  @Patch(':id')
  updateProfile(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.charactersService.updateProfile(id, body);
  }

  @Post(':id/regenerate-profile-code')
  regenerateProfileCode(@Param('id') id: string) {
    return this.charactersService.regenerateProfileAccessCode(id);
  }
}

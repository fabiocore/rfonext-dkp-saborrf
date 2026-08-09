import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ProtectionsService } from './protections.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('GM', 'COUNCIL')
@Controller('protections')
export class ProtectionsController {
  constructor(private readonly protectionsService: ProtectionsService) {}

  @Get()
  findAll() {
    return this.protectionsService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; description: string; minBid: number; minLevel: number }) {
    return this.protectionsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.protectionsService.update(id, body as any);
  }
}

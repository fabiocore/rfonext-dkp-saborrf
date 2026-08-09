import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('GM', 'VICE_GM', 'COUNCIL')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll() {
    return this.activitiesService.findAll();
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return this.activitiesService.createManual(body as any);
  }

  // Pré-cadastra uma atividade que ainda não veio de nenhum import (ver
  // ActivitiesService.createKnownActivity) — nome precisa bater exato com a
  // futura coluna do XML.
  @Post('known')
  createKnown(@Body('name') name: string, @Body('brcValue') brcValue: number) {
    return this.activitiesService.createKnownActivity(name, Number(brcValue) || 0);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.activitiesService.update(id, body as any);
  }

  @Put(':id/components')
  setComponents(@Param('id') id: string, @Body('componentActivityIds') componentActivityIds: string[]) {
    return this.activitiesService.setComponents(id, componentActivityIds ?? []);
  }
}

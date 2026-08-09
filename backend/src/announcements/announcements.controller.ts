import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Roles('GM', 'VICE_GM', 'COUNCIL')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  list() {
    return this.announcementsService.list();
  }

  @Post()
  create(@Body('title') title: string, @Body('body') body: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.create(title, body, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { title?: string; body?: string }) {
    return this.announcementsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.announcementsService.remove(id);
  }
}

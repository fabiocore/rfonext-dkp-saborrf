import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportService } from './import.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Roles('GM', 'VICE_GM', 'COUNCIL')
@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get()
  findAll() {
    return this.importService.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado (campo esperado: "file").');
    }
    return this.importService.importXmlFile(file.originalname, file.buffer, user.id);
  }
}

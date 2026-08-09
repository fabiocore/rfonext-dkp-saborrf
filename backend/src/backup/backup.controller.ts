import { BadRequestException, Body, Controller, Get, Post, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { BackupService } from './backup.service';
import { Roles } from '../auth/decorators/roles.decorator';

// Exclusivo do GM — backup/restore afeta o banco inteiro, não só a guild
// visível na UI (não existe conceito de "escopo por guild" nesse projeto,
// PREMISSAS.md seção 8: cada guild é um deploy próprio).
@Roles('GM', 'VICE_GM')
@Controller('admin/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  async download(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const buffer = await this.backupService.createBackup();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.set({
      'Content-Type': 'application/sql',
      'Content-Disposition': `attachment; filename="rfonext-dkp-backup-${timestamp}.sql"`,
    });
    return new StreamableFile(buffer);
  }

  @Post('restore')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  async restore(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('confirmText') confirmText: string,
  ): Promise<{ success: true }> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado (campo esperado: "file").');
    }
    await this.backupService.restoreFromUpload(file.buffer, confirmText);
    return { success: true };
  }
}

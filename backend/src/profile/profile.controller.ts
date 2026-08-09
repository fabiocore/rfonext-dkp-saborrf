import { BadRequestException, Body, Controller, Get, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { ProfileService } from './profile.service';
import { Public } from '../auth/decorators/public.decorator';
import { AVATAR_PRESETS, resolveAvatarPresetUrl } from './avatar-presets';

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const imageUploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: process.env.UPLOADS_DIR || './uploads',
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(new BadRequestException('Só são aceitas imagens (png, jpg, webp, gif).'), false);
      return;
    }
    cb(null, true);
  },
});

// Perfil do membro por código de 12 caracteres — sem login, sem JWT (o
// código em si é a credencial, mesma lógica das rotas de leilão via código).
@Public()
@Controller('public/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Precisa vir antes de `:code` — senão o Nest casa "avatar-presets" como
  // se fosse um código de perfil.
  @Get('avatar-presets')
  listAvatarPresets() {
    return AVATAR_PRESETS.map((preset) => ({ key: preset.key, url: preset.url }));
  }

  @Get(':code')
  getProfile(@Param('code') code: string) {
    return this.profileService.getProfile(code);
  }

  @Put(':code/discord')
  updateDiscordId(@Param('code') code: string, @Body('discordId') discordId: string) {
    return this.profileService.updateDiscordId(code, discordId);
  }

  @Put(':code/avatar')
  @UseInterceptors(imageUploadInterceptor)
  async updateAvatar(@Param('code') code: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Nenhuma imagem enviada (campo esperado: "file").');
    return this.profileService.updateAvatar(code, `/uploads/${file.filename}`);
  }

  @Put(':code/avatar-preset')
  selectAvatarPreset(@Param('code') code: string, @Body('presetKey') presetKey: string) {
    const url = resolveAvatarPresetUrl(presetKey);
    if (!url) throw new BadRequestException('Avatar inválido.');
    return this.profileService.updateAvatar(code, url);
  }

  @Post(':code/level-request')
  @UseInterceptors(imageUploadInterceptor)
  async submitLevelChangeRequest(
    @Param('code') code: string,
    @Body('requestedLevel') requestedLevel: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Print de comprovação é obrigatório (campo esperado: "file").');
    return this.profileService.submitLevelChangeRequest(code, Number(requestedLevel), `/uploads/${file.filename}`);
  }
}

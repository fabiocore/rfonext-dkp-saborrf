import { Module } from '@nestjs/common';
import { ProtectionsService } from './protections.service';
import { ProtectionsController } from './protections.controller';

@Module({
  providers: [ProtectionsService],
  controllers: [ProtectionsController],
  exports: [ProtectionsService],
})
export class ProtectionsModule {}

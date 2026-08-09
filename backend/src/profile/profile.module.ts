import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { LevelRequestsController } from './level-requests.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController, LevelRequestsController],
  providers: [ProfileService],
})
export class ProfileModule {}

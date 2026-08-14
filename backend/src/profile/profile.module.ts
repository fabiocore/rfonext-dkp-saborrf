import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { CharactersModule } from '../characters/characters.module';

@Module({
  imports: [CharactersModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}

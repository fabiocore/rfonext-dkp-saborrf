import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { CharactersModule } from '../characters/characters.module';
import { ActivitiesModule } from '../activities/activities.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [CharactersModule, ActivitiesModule, LedgerModule],
  providers: [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}

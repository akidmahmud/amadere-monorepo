import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { AdminSynonymsController } from './admin-synonyms.controller';
import { SynonymsService } from './synonyms.service';
import { SEARCH_PROVIDER } from './search-provider.interface';
import { PostgresSearchProvider } from './postgres-search.provider';

@Module({
  controllers: [SearchController, AdminSynonymsController],
  providers: [
    SynonymsService,
    { provide: SEARCH_PROVIDER, useClass: PostgresSearchProvider },
  ],
})
export class SearchModule {}

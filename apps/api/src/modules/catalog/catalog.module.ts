import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { CategoriesController } from "./categories.controller";
import { CatalogService } from "./catalog.service";
import { ProductsController } from "./products.controller";
import { PostgresSearchService } from "./search/postgres-search.service";
import { SEARCH_SERVICE } from "./search/search.types";

@Module({
  imports: [UsersModule],
  controllers: [CategoriesController, ProductsController],
  providers: [CatalogService, { provide: SEARCH_SERVICE, useClass: PostgresSearchService }],
  exports: [CatalogService],
})
export class CatalogModule {}

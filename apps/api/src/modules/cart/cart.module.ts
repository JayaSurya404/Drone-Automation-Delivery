import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { UsersModule } from "../users/users.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";

@Module({
  imports: [CatalogModule, UsersModule],
  controllers: [CartController, WishlistController],
  providers: [CartService, WishlistService],
  exports: [CartService, WishlistService],
})
export class CartModule {}

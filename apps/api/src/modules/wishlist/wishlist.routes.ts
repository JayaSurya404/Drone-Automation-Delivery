import type { FastifyPluginAsync } from "fastify";
import { addWishlistRequestSchema, uuidSchema } from "@skynav/contracts";
import type { WishlistService } from "./wishlist.service.js";
import { requireAuthenticated } from "../auth/rbac.js";

export function createWishlistRoutes(wishlistService: WishlistService): FastifyPluginAsync {
  return async function wishlistRoutes(app) {
    app.get("/api/v1/wishlist", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const wishlist = await wishlistService.getWishlist(request.user!);
      return reply.status(200).send({ data: wishlist });
    });

    app.post("/api/v1/wishlist/items", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const body = addWishlistRequestSchema.parse(request.body);
      const wishlist = await wishlistService.addToWishlist(request.user!, body);
      return reply.status(200).send({ data: wishlist });
    });

    app.delete<{ Params: { productId: string } }>("/api/v1/wishlist/items/:productId", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const productId = uuidSchema.parse(request.params.productId);
      const wishlist = await wishlistService.removeFromWishlist(request.user!, productId);
      return reply.status(200).send({ data: wishlist });
    });
  };
}

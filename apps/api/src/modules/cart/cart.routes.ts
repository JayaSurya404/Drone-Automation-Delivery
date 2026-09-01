import type { FastifyPluginAsync } from "fastify";
import { addToCartRequestSchema, updateCartItemRequestSchema, uuidSchema } from "@skynav/contracts";
import type { CartService } from "./cart.service.js";
import { requireAuthenticated } from "../auth/rbac.js";

export function createCartRoutes(cartService: CartService): FastifyPluginAsync {
  return async function cartRoutes(app) {
    app.get("/api/v1/cart", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const cart = await cartService.getCart(request.user!);
      return reply.status(200).send({ data: cart });
    });

    app.post("/api/v1/cart/items", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const body = addToCartRequestSchema.parse(request.body);
      const cart = await cartService.addToCart(request.user!, body);
      return reply.status(200).send({ data: cart });
    });

    app.patch<{ Params: { id: string } }>("/api/v1/cart/items/:id", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const itemId = uuidSchema.parse(request.params.id);
      const body = updateCartItemRequestSchema.parse(request.body);
      const cart = await cartService.updateCartItem(request.user!, itemId, body);
      return reply.status(200).send({ data: cart });
    });

    app.delete<{ Params: { id: string } }>("/api/v1/cart/items/:id", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const itemId = uuidSchema.parse(request.params.id);
      const cart = await cartService.removeCartItem(request.user!, itemId);
      return reply.status(200).send({ data: cart });
    });

    app.delete("/api/v1/cart", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const cart = await cartService.clearCart(request.user!);
      return reply.status(200).send({ data: cart });
    });
  };
}

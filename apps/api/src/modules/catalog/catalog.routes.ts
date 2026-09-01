import type { FastifyPluginAsync } from "fastify";
import { productListQuerySchema } from "@skynav/contracts";
import type { CatalogService } from "./catalog.service.js";

export function createCatalogRoutes(catalogService: CatalogService): FastifyPluginAsync {
  return async function catalogRoutes(app) {
    app.get("/api/v1/products", async (request, reply) => {
      const query = productListQuerySchema.parse(request.query);
      const result = await catalogService.listProducts(query);
      return reply.status(200).send(result);
    });

    app.get("/api/v1/products/categories", async (_request, reply) => {
      const categories = await catalogService.getCategories();
      return reply.status(200).send({ data: categories });
    });

    app.get<{ Params: { id: string } }>("/api/v1/products/:id", async (request, reply) => {
      const product = await catalogService.getProduct(request.params.id);
      return reply.status(200).send({ data: product });
    });
  };
}

import type { FastifyPluginAsync } from "fastify";
import { createCustomerAddressRequestSchema, updateCustomerAddressRequestSchema, uuidSchema } from "@skynav/contracts";
import type { AddressService } from "./address.service.js";
import { requireAuthenticated } from "../auth/rbac.js";

export function createAddressRoutes(addressService: AddressService): FastifyPluginAsync {
  return async function addressRoutes(app) {
    app.get("/api/v1/addresses", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const list = await addressService.listAddresses(request.user!);
      return reply.status(200).send({ data: list });
    });

    app.post("/api/v1/addresses", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const body = createCustomerAddressRequestSchema.parse(request.body);
      const address = await addressService.createAddress(request.user!, body);
      return reply.status(201).send({ data: address });
    });

    app.patch<{ Params: { id: string } }>("/api/v1/addresses/:id", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const id = uuidSchema.parse(request.params.id);
      const body = updateCustomerAddressRequestSchema.parse(request.body);
      const address = await addressService.updateAddress(request.user!, id, body);
      return reply.status(200).send({ data: address });
    });

    app.delete<{ Params: { id: string } }>("/api/v1/addresses/:id", { preHandler: [requireAuthenticated] }, async (request, reply) => {
      const id = uuidSchema.parse(request.params.id);
      await addressService.deleteAddress(request.user!, id);
      return reply.status(200).send({ success: true });
    });
  };
}

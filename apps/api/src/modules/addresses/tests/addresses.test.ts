import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAddressService } from "../address.service.js";

describe("Addresses / Customer Landing Address Management", () => {
  const user = {
    id: "55555555-5555-5555-5555-555555555555",
    email: "customer@example.com",
    name: "Jane Doe",
    organizationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    organizationName: "Jane's Org",
    role: "CUSTOMER" as const,
    permissions: ["addresses:manage" as const]
  };

  let addressDb: any[] = [];

  const mockAddressRepo = {
    async list(userId: string) {
      return addressDb.filter((a) => a.user_id === userId);
    },
    async findById(userId: string, id: string) {
      return addressDb.find((a) => a.user_id === userId && a.id === id) || null;
    },
    async create(userId: string, data: any) {
      const addr = { id: "addr-1", user_id: userId, ...data, created_at: new Date(), updated_at: new Date() };
      addressDb.push(addr);
      return addr;
    },
    async update(userId: string, id: string, data: any) {
      const addr = addressDb.find((a) => a.user_id === userId && a.id === id);
      if (!addr) return null;
      Object.assign(addr, data, { updated_at: new Date() });
      return addr;
    },
    async delete(userId: string, id: string) {
      const initLen = addressDb.length;
      addressDb = addressDb.filter((a) => !(a.user_id === userId && a.id === id));
      return addressDb.length < initLen;
    }
  };

  const service = createAddressService(mockAddressRepo as any);

  it("creates, updates, and lists customer addresses", async () => {
    const created = await service.createAddress(user, {
      recipientName: "Jane Doe",
      phone: "+1-555-0100",
      addressLine1: "100 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      latitude: 37.7937,
      longitude: -122.3965,
      deliveryInstructions: "Leave on rooftop pad.",
      isDefault: true
    });

    assert.equal(created.recipientName, "Jane Doe");
    assert.equal(created.latitude, 37.7937);

    const list = await service.listAddresses(user);
    assert.equal(list.length, 1);

    const updated = await service.updateAddress(user, "addr-1", { phone: "+1-555-0199" });
    assert.equal(updated.phone, "+1-555-0199");

    await service.deleteAddress(user, "addr-1");
    const emptyList = await service.listAddresses(user);
    assert.equal(emptyList.length, 0);
  });
});

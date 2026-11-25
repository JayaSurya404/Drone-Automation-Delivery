import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "./rbac.service";

describe("RbacService.resolvePermissions", () => {
  let service: RbacService;
  let prisma: { role: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { role: { findMany: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RbacService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(RbacService);
  });

  it("returns an empty array for no role names without querying the database", async () => {
    const result = await service.resolvePermissions([]);
    expect(result).toEqual([]);
    expect(prisma.role.findMany).not.toHaveBeenCalled();
  });

  it("flattens permissions across multiple roles into module.action strings", async () => {
    prisma.role.findMany.mockResolvedValue([
      {
        name: "fleet_manager",
        permissions: [
          { permission: { module: "drones", action: "read" } },
          { permission: { module: "drones", action: "update" } },
        ],
      },
      {
        name: "analyst",
        permissions: [{ permission: { module: "analytics", action: "read" } }],
      },
    ]);

    const result = await service.resolvePermissions(["fleet_manager", "analyst"]);

    expect(result).toEqual(["analytics.read", "drones.read", "drones.update"]);
  });

  it("deduplicates a permission granted by more than one role", async () => {
    prisma.role.findMany.mockResolvedValue([
      {
        name: "role_a",
        permissions: [{ permission: { module: "orders", action: "read" } }],
      },
      {
        name: "role_b",
        permissions: [{ permission: { module: "orders", action: "read" } }],
      },
    ]);

    const result = await service.resolvePermissions(["role_a", "role_b"]);

    expect(result).toEqual(["orders.read"]);
  });

  it("queries only for the requested role names", async () => {
    prisma.role.findMany.mockResolvedValue([]);
    await service.resolvePermissions(["customer"]);

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { in: ["customer"] } } }),
    );
  });
});

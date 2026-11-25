import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AnalyticsController } from "../analytics/analytics.controller";
import { CartController } from "../cart/cart.controller";
import { WishlistController } from "../cart/wishlist.controller";
import { CategoriesController } from "../catalog/categories.controller";
import { ProductsController } from "../catalog/products.controller";
import { DeliveryController } from "../delivery/delivery.controller";
import { DigitalTwinController } from "../digital-twin/digital-twin.controller";
import { DronesController } from "../drones/drones.controller";
import { GeofencingController } from "../geofencing/geofencing.controller";
import { InventoryController } from "../inventory/inventory.controller";
import { MissionsController } from "../missions/missions.controller";
import { OrdersController } from "../orders/orders.controller";
import { PaymentsController } from "../payments/payments.controller";
import { RouteIntelligenceController } from "../route-intelligence/route-intelligence.controller";
import { SwarmController } from "../swarm/swarm.controller";
import { TelemetryController } from "../telemetry/telemetry.controller";
import { AddressesController } from "../users/addresses.controller";
import { AuthController } from "../users/auth.controller";
import { UsersController } from "../users/users.controller";
import { VisionController } from "../vision/vision.controller";
import { WeatherController } from "../weather/weather.controller";
import { REQUIRE_PERMISSION_KEY } from "./decorators/require-permission.decorator";
import { PermissionsGuard } from "./guards/permissions.guard";

/**
 * Phase 12 regression test for a latent RBAC footgun the security audit
 * flagged: `@RequirePermission(...)` is inert metadata on its own —
 * `PermissionsGuard.canActivate()` only enforces anything on a route that
 * *also* has `PermissionsGuard` attached via `@UseGuards` (class- or
 * method-level). Nest raises no error if an engineer adds the decorator but
 * forgets the guard on a new controller — it would silently ship a fully
 * public mutating endpoint. This is a pure reflection check (no Nest app,
 * no database) over every controller class in the app, so it runs as a
 * fast unit test and fails loudly the moment that ever happens, rather than
 * relying on every future code reviewer to notice by eye.
 */
const CONTROLLERS = [
  AnalyticsController,
  CartController,
  WishlistController,
  CategoriesController,
  ProductsController,
  DeliveryController,
  DigitalTwinController,
  DronesController,
  GeofencingController,
  InventoryController,
  MissionsController,
  OrdersController,
  PaymentsController,
  RouteIntelligenceController,
  SwarmController,
  TelemetryController,
  AddressesController,
  AuthController,
  UsersController,
  VisionController,
  WeatherController,
];

function guardsInclude(target: object, guard: unknown): boolean {
  const guards = (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];
  return guards.includes(guard);
}

function methodNamesOf(prototype: object): string[] {
  return Object.getOwnPropertyNames(prototype).filter((name) => name !== "constructor" && typeof (prototype as Record<string, unknown>)[name] === "function");
}

describe("PermissionsGuard coverage (Phase 12 RBAC regression)", () => {
  it("attaches PermissionsGuard wherever @RequirePermission is declared, at class or method level", () => {
    const violations: string[] = [];

    for (const controller of CONTROLLERS) {
      const prototype = controller.prototype as object;
      const classHasPermission = Reflect.hasMetadata(REQUIRE_PERMISSION_KEY, controller);
      const classHasGuard = guardsInclude(controller, PermissionsGuard);

      for (const methodName of methodNamesOf(prototype)) {
        const handler = (prototype as Record<string, unknown>)[methodName] as object;
        const methodHasPermission = Reflect.hasMetadata(REQUIRE_PERMISSION_KEY, handler);
        if (!methodHasPermission && !classHasPermission) {
          continue;
        }
        const methodHasGuard = guardsInclude(handler, PermissionsGuard);
        if (!methodHasGuard && !classHasGuard) {
          violations.push(`${controller.name}.${methodName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("sanity-checks the test itself: a handler with @RequirePermission and no guard is actually caught", () => {
    // Guards against this test silently passing because the reflection
    // approach itself stopped working (e.g. a NestJS metadata-key rename).
    const markRequiresFakePermission: MethodDecorator = (_target, _key, descriptor) => {
      Reflect.defineMetadata(REQUIRE_PERMISSION_KEY, "fake.permission", descriptor.value as object);
      return descriptor;
    };

    class FakeController {
      @markRequiresFakePermission
      unguarded(): void {
        /* no-op */
      }
    }

    const hasPermission = Reflect.hasMetadata(REQUIRE_PERMISSION_KEY, FakeController.prototype.unguarded);
    const hasGuard = guardsInclude(FakeController.prototype.unguarded, PermissionsGuard);
    expect(hasPermission).toBe(true);
    expect(hasGuard).toBe(false);
  });
});

// Seeds the 11 roles from docs/PROJECT_BLUEPRINT.md Section F with a
// reasonable starting permission matrix, plus a bootstrap Super Admin
// account so the admin console is reachable on a fresh database. Idempotent
// — safe to re-run (upserts throughout).
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ module: string; action: string; description: string }> = [
  { module: "users", action: "read", description: "View user accounts" },
  { module: "users", action: "create", description: "Create user accounts" },
  { module: "users", action: "update", description: "Update user accounts and roles" },
  { module: "users", action: "delete", description: "Deactivate user accounts" },
  { module: "roles", action: "manage", description: "Manage roles and the permission matrix" },
  { module: "audit", action: "read", description: "View the audit log" },
  { module: "catalog", action: "read", description: "View catalog products/categories" },
  { module: "catalog", action: "create", description: "Create catalog products/categories" },
  { module: "catalog", action: "update", description: "Update catalog products/categories" },
  { module: "catalog", action: "delete", description: "Delete catalog products/categories" },
  { module: "inventory", action: "read", description: "View inventory levels" },
  { module: "inventory", action: "update", description: "Adjust inventory levels" },
  { module: "cart", action: "manage", description: "Manage own cart" },
  { module: "wishlist", action: "manage", description: "Manage own wishlist" },
  { module: "orders", action: "read", description: "View all orders" },
  { module: "orders", action: "read_own", description: "View own orders" },
  { module: "orders", action: "create", description: "Place orders" },
  { module: "orders", action: "update", description: "Update order status" },
  { module: "orders", action: "cancel", description: "Cancel orders" },
  { module: "orders", action: "refund", description: "Issue refunds" },
  { module: "delivery", action: "read", description: "View deliveries" },
  { module: "delivery", action: "assign", description: "Assign deliveries to hubs/drones" },
  { module: "delivery", action: "update", description: "Update delivery status" },
  { module: "delivery", action: "cancel", description: "Cancel a delivery" },
  { module: "drones", action: "read", description: "View drone fleet" },
  { module: "drones", action: "create", description: "Register drones" },
  { module: "drones", action: "update", description: "Update drone status" },
  { module: "drones", action: "maintenance", description: "Flag drones for maintenance" },
  { module: "missions", action: "read", description: "View missions" },
  { module: "missions", action: "create", description: "Create a mission from an assigned delivery" },
  { module: "missions", action: "assign", description: "Assign/unassign a drone and operator to a mission" },
  { module: "missions", action: "update", description: "Start a mission and advance its simulated progress" },
  { module: "missions", action: "override", description: "Manually override an active mission (RTH, abort, force-land)" },
  { module: "telemetry", action: "read", description: "View live telemetry" },
  { module: "telemetry", action: "ingest", description: "Submit telemetry (service accounts)" },
  { module: "geofencing", action: "read", description: "View geofences" },
  { module: "geofencing", action: "update", description: "Manage geofences" },
  { module: "weather", action: "read", description: "View weather/safety data" },
  { module: "incidents", action: "read", description: "View incident reports" },
  { module: "analytics", action: "read", description: "View analytics dashboards" },
  { module: "system", action: "configure", description: "Change system configuration" },
  // Advanced Drone Intelligence (Phase 11)
  { module: "vision", action: "read", description: "View computer-vision analyses and landing-zone evaluations" },
  { module: "vision", action: "analyze", description: "Trigger a simulated computer-vision frame analysis or landing-zone evaluation" },
  { module: "swarm", action: "read", description: "View swarms, membership, and swarm plans" },
  { module: "swarm", action: "manage", description: "Create/disband swarms and manage drone membership" },
  { module: "swarm", action: "plan", description: "Create swarm task-allocation plans and reassign assignments" },
  { module: "simulation", action: "read", description: "View digital-twin scenarios, runs, and risk findings" },
  { module: "simulation", action: "run", description: "Create scenarios and run digital-twin simulations" },
  { module: "route_intel", action: "read", description: "View shared route-intelligence observations" },
];

const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => `${p.module}.${p.action}`);

// --- Demo catalog data (Phase 3) --------------------------------------
// Realistic seed data so every later phase (checkout, delivery, drone
// assignment...) has real products/hubs/stock to build against. Parent
// categories must precede their children in this array.

interface DemoCategory {
  slug: string;
  name: string;
  description: string;
  parentSlug?: string;
}

const DEMO_CATEGORIES: DemoCategory[] = [
  { slug: "groceries", name: "Groceries", description: "Everyday food and pantry staples" },
  { slug: "snacks", name: "Snacks", description: "Chips, bars, and other snacks", parentSlug: "groceries" },
  { slug: "beverages", name: "Beverages", description: "Drinks, coffee, and tea", parentSlug: "groceries" },
  { slug: "pharmacy", name: "Pharmacy", description: "Over-the-counter health essentials" },
  { slug: "electronics", name: "Electronics", description: "Small electronics and accessories" },
];

interface DemoVariant {
  sku: string;
  name: string;
  priceOverride?: number;
  stock: number;
}

interface DemoProduct {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  categorySlug: string;
  variants: DemoVariant[];
}

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    slug: "sea-salt-tortilla-chips",
    name: "Sea Salt Tortilla Chips",
    description: "Crunchy corn tortilla chips, lightly salted. Family size bag.",
    basePrice: 3.49,
    categorySlug: "snacks",
    variants: [{ sku: "SNK-CHIP-001", name: "12 oz bag", stock: 42 }],
  },
  {
    slug: "classic-trail-mix",
    name: "Classic Trail Mix",
    description: "Peanuts, raisins, and chocolate chips — a classic on-the-go mix.",
    basePrice: 4.29,
    categorySlug: "snacks",
    variants: [{ sku: "SNK-TRAIL-001", name: "16 oz bag", stock: 25 }],
  },
  {
    slug: "dark-roast-coffee-beans",
    name: "Dark Roast Coffee Beans",
    description: "Whole bean dark roast with notes of cocoa and toasted almond.",
    basePrice: 11.99,
    categorySlug: "beverages",
    variants: [
      { sku: "BEV-COFF-12", name: "12 oz bag", stock: 30 },
      { sku: "BEV-COFF-32", name: "32 oz bag", priceOverride: 24.99, stock: 12 },
    ],
  },
  {
    slug: "sparkling-water-lime",
    name: "Sparkling Water — Lime",
    description: "Zero-sugar sparkling water with natural lime flavor. 8-pack cans.",
    basePrice: 5.99,
    categorySlug: "beverages",
    variants: [{ sku: "BEV-SPKL-LIME", name: "8-pack, 12 oz cans", stock: 60 }],
  },
  {
    slug: "ibuprofen-pain-reliever",
    name: "Ibuprofen Pain Reliever, 200mg",
    description: "Fast-acting pain reliever and fever reducer. 100 coated tablets.",
    basePrice: 8.49,
    categorySlug: "pharmacy",
    variants: [{ sku: "PHM-IBU-100", name: "100 tablets", stock: 50 }],
  },
  {
    slug: "digital-thermometer",
    name: "Digital Thermometer",
    description: "Fast 10-second oral/underarm digital thermometer with fever alert.",
    basePrice: 12.99,
    categorySlug: "pharmacy",
    variants: [{ sku: "PHM-THERM-01", name: "Standard", stock: 18 }],
  },
  {
    slug: "wireless-earbuds",
    name: "Wireless Earbuds",
    description: "Bluetooth 5.3 earbuds with charging case. 24-hour battery life.",
    basePrice: 39.99,
    categorySlug: "electronics",
    variants: [
      { sku: "ELC-EARBUD-BLK", name: "Black", stock: 20 },
      { sku: "ELC-EARBUD-WHT", name: "White", stock: 0 },
    ],
  },
  {
    slug: "usb-c-charging-cable",
    name: "USB-C Charging Cable",
    description: "Braided 6ft USB-C to USB-C fast-charging cable.",
    basePrice: 9.99,
    categorySlug: "electronics",
    variants: [{ sku: "ELC-CABLE-6FT", name: "6 ft", stock: 75 }],
  },
];

const ROLES: Array<{ name: string; description: string; permissions: string[] }> = [
  { name: "guest", description: "Unauthenticated visitor", permissions: [] },
  {
    name: "customer",
    description: "Registered storefront customer",
    permissions: ["cart.manage", "wishlist.manage", "orders.read_own", "orders.create", "orders.cancel"],
  },
  {
    name: "catalog_manager",
    description: "Store/Catalog Manager",
    permissions: ["catalog.read", "catalog.create", "catalog.update", "catalog.delete", "inventory.read", "inventory.update"],
  },
  {
    name: "order_support_agent",
    description: "Order/Support Agent",
    permissions: ["orders.read", "orders.update", "orders.cancel", "orders.refund"],
  },
  {
    name: "delivery_coordinator",
    description: "Delivery Coordinator",
    permissions: [
      "delivery.read",
      "delivery.assign",
      "delivery.update",
      "delivery.cancel",
      "missions.read",
      "missions.create",
      "missions.assign",
      "missions.update",
    ],
  },
  {
    name: "fleet_manager",
    description: "Fleet Manager",
    permissions: [
      "drones.read",
      "drones.create",
      "drones.update",
      "drones.maintenance",
      "missions.read",
      "missions.assign",
      "missions.update",
      "vision.read",
      "vision.analyze",
      "swarm.read",
      "swarm.manage",
      "swarm.plan",
      "simulation.read",
      "simulation.run",
      "route_intel.read",
    ],
  },
  {
    name: "drone_operator",
    description: "Drone Operator",
    permissions: [
      "drones.read",
      "missions.read",
      "missions.update",
      "missions.override",
      "telemetry.read",
      "vision.read",
      "vision.analyze",
      "swarm.read",
      "simulation.read",
      "simulation.run",
      "route_intel.read",
    ],
  },
  {
    name: "compliance_safety_officer",
    description: "Compliance/Safety Officer",
    permissions: ["geofencing.read", "geofencing.update", "weather.read", "incidents.read", "audit.read", "vision.read", "simulation.read", "route_intel.read"],
  },
  {
    name: "analyst",
    description: "Read-only analytics/reporting",
    permissions: ["analytics.read"],
  },
  {
    name: "super_admin",
    description: "Full access including users/roles/permissions and system configuration",
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    name: "system_service_account",
    description: "Internal service-to-service calls (e.g. drone simulator)",
    permissions: ["telemetry.ingest"],
  },
];

async function main() {
  console.log("Seeding permissions...");
  const permissionIdByKey = new Map<string, string>();
  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { module_action: { module: permission.module, action: permission.action } },
      update: { description: permission.description },
      create: permission,
    });
    permissionIdByKey.set(`${row.module}.${row.action}`, row.id);
  }

  console.log("Seeding roles...");
  for (const role of ROLES) {
    const roleRow = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: roleRow.id } });
    if (role.permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: role.permissions.map((key) => ({
          roleId: roleRow.id,
          permissionId: permissionIdByKey.get(key)!,
        })),
        skipDuplicates: true,
      });
    }
  }

  const bootstrapEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL ?? "admin@skynav.local";
  const bootstrapPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  console.log(`Ensuring bootstrap Super Admin (${bootstrapEmail})...`);
  const existingAdmin = await prisma.user.findUnique({ where: { email: bootstrapEmail } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(bootstrapPassword, { type: argon2.argon2id });
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
    await prisma.user.create({
      data: {
        email: bootstrapEmail,
        passwordHash,
        firstName: "Super",
        lastName: "Admin",
        isActive: true,
        isEmailVerified: true,
        roles: { create: [{ roleId: superAdminRole.id }] },
      },
    });
    console.log("Bootstrap Super Admin created.");
  } else {
    console.log("Bootstrap Super Admin already exists — skipping.");
  }

  console.log("Ensuring demo fulfillment hub...");
  const hubCode = "HUB-DOWNTOWN";
  let hub = await prisma.fulfillmentHub.findUnique({ where: { code: hubCode } });
  if (!hub) {
    // FulfillmentHub.location is an Unsupported("geography(Point, 4326)")
    // column — Prisma Client has no field for it, so it's written via raw SQL.
    await prisma.$executeRaw`
      INSERT INTO fulfillment_hubs (id, name, code, address, location, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Downtown Hub', ${hubCode}, '100 Main St, Springfield',
        ST_SetSRID(ST_MakePoint(-93.2650, 44.9778), 4326)::geography,
        true, now(), now()
      )
    `;
    hub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: hubCode } });
    console.log("Demo fulfillment hub created.");
  } else {
    console.log("Demo fulfillment hub already exists — skipping.");
  }

  console.log("Seeding demo catalog (categories, products, variants, stock)...");
  const categoryIdBySlug = new Map<string, string>();
  for (const category of DEMO_CATEGORIES) {
    const parentId = category.parentSlug ? categoryIdBySlug.get(category.parentSlug) : undefined;
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description, parentId },
      create: { slug: category.slug, name: category.name, description: category.description, parentId },
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  for (const demoProduct of DEMO_PRODUCTS) {
    const categoryId = categoryIdBySlug.get(demoProduct.categorySlug);
    const product = await prisma.product.upsert({
      where: { slug: demoProduct.slug },
      update: {
        name: demoProduct.name,
        description: demoProduct.description,
        basePrice: demoProduct.basePrice,
        categoryId,
      },
      create: {
        slug: demoProduct.slug,
        name: demoProduct.name,
        description: demoProduct.description,
        basePrice: demoProduct.basePrice,
        categoryId,
      },
    });

    for (const demoVariant of demoProduct.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: demoVariant.sku },
        update: { name: demoVariant.name, priceOverride: demoVariant.priceOverride, productId: product.id },
        create: {
          sku: demoVariant.sku,
          name: demoVariant.name,
          priceOverride: demoVariant.priceOverride,
          productId: product.id,
        },
      });

      await prisma.inventoryItem.upsert({
        where: { variantId_hubId: { variantId: variant.id, hubId: hub.id } },
        update: { quantityOnHand: demoVariant.stock },
        create: {
          variantId: variant.id,
          hubId: hub.id,
          quantityOnHand: demoVariant.stock,
          lowStockThreshold: 5,
        },
      });
    }
  }

  console.log("Seeding demo fleet drones...");
  const [hubCoords] = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
    SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
    FROM fulfillment_hubs WHERE id = ${hub.id}
  `;
  const DEMO_DRONES = [
    { serialNumber: "SKN-DRN-001", name: "Falcon One", model: "SkyNav X1" },
    { serialNumber: "SKN-DRN-002", name: "Falcon Two", model: "SkyNav X1" },
  ];
  for (const demoDrone of DEMO_DRONES) {
    await prisma.drone.upsert({
      where: { serialNumber: demoDrone.serialNumber },
      update: {},
      create: {
        serialNumber: demoDrone.serialNumber,
        name: demoDrone.name,
        model: demoDrone.model,
        adapterType: "SIMULATED",
        status: "IDLE",
        homeHubId: hub.id,
        batteryPercent: 100,
        currentLat: hubCoords.lat,
        currentLng: hubCoords.lng,
      },
    });
  }

  console.log("Seeding demo geofences...");
  // Self-contained WKT construction (not imported from `src/modules/geofencing`)
  // — same "seed.ts stays independent of the Nest app source" convention
  // `services/drone-simulator`'s duplicated simulation math already
  // established in Phase 6, so this script keeps running under plain
  // `ts-node --transpile-only` with no extra path/bundler config.
  function squareWkt(center: { lat: number; lng: number }, halfWidthDeg: number): string {
    const { lat, lng } = center;
    const points = [
      [lng - halfWidthDeg, lat - halfWidthDeg],
      [lng + halfWidthDeg, lat - halfWidthDeg],
      [lng + halfWidthDeg, lat + halfWidthDeg],
      [lng - halfWidthDeg, lat + halfWidthDeg],
      [lng - halfWidthDeg, lat - halfWidthDeg],
    ];
    return `POLYGON((${points.map((p) => p.join(" ")).join(", ")}))`;
  }

  const existingGeofences = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint as count FROM geofences`;
  if (Number(existingGeofences[0]?.count ?? 0) === 0) {
    // Comfortably contains every demo destination — resolveDeterministicDestination()
    // (missions/route.util.ts) offsets at most ±0.02 degrees from the hub.
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_by_id, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Metro Service Area', 'SERVICE_AREA'::"GeofenceType",
        'The default deliverable area around the downtown hub.',
        ST_GeomFromText(${squareWkt(hubCoords, 0.05)}, 4326), true, NULL, now(), now()
      )
    `;
    // Offset well outside the ±0.02 degree demo-destination range so it
    // never blocks the default happy-path demo mission — it exists to
    // demonstrate the geofence-blocking behavior on request (see
    // docs/SETUP.md), not to interfere with it.
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_by_id, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'North Airfield No-Fly Zone', 'NO_FLY'::"GeofenceType",
        'Demo no-fly zone — north of the demo delivery range, safe to test geofence blocking against.',
        ST_GeomFromText(${squareWkt({ lat: hubCoords.lat + 0.08, lng: hubCoords.lng }, 0.01)}, 4326), true, NULL, now(), now()
      )
    `;
    console.log("Demo geofences created (Metro Service Area, North Airfield No-Fly Zone).");
  } else {
    console.log("Geofences already exist — skipping.");
  }

  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

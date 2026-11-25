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

interface SeedCategory {
  slug: string;
  name: string;
  description: string;
  parentSlug?: string;
}

const CATEGORIES: SeedCategory[] = [
  // ── TARGET Master Categories (Indian Catalog) ──
  { slug: "food", name: "Hot Meals & Food", description: "Fresh chef-crafted meals, authentic South Indian breakfast, and hot specialties delivered in 65°C thermal pods." },
  { slug: "medicine", name: "Medicine & Health", description: "Emergency trauma response kits, analgesics, test strips, inhalers, and urgent medical supplies." },
  { slug: "groceries", name: "Fresh Groceries", description: "Fresh farm pasteurized milk, aromatic Coimbatore filter coffee, pantry staples, and kitchen essentials." },
  { slug: "electronics", name: "Tech & Electronics", description: "Ultra-fast GaN chargers, heavy-duty emergency power banks, and certified durable cables." },
  { slug: "documents", name: "Instant Documents", description: "Tamper-evident biometric sealed pouches for urgent contracts, certificates, and notarized deeds." },
  { slug: "daily-essentials", name: "Daily Essentials", description: "Traditional cold-pressed cooking oils, home lifestyle goods, and urgent daily convenience items." },
  // Backward compatibility aliases/subcategories
  { slug: "snacks", name: "Snacks", description: "Chips, bars, and other snacks", parentSlug: "groceries" },
  { slug: "beverages", name: "Beverages", description: "Drinks, coffee, and tea", parentSlug: "groceries" },
  { slug: "pharmacy", name: "Pharmacy", description: "Over-the-counter health essentials", parentSlug: "medicine" },
];

interface SeedVariant {
  sku: string;
  name: string;
  priceOverride?: number;
  stock: number;
}

interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  currency?: string;
  categorySlug: string;
  variants: SeedVariant[];
}

const PRODUCTS: SeedProduct[] = [
  // ── TARGET 14 Indian Products from shared/contracts/catalog.ts ──
  {
    slug: "kovai-crispy-masala-dosa-breakfast-box",
    name: "Kovai Crispy Masala Dosa & Sambar Breakfast Box",
    description: "Crisp golden brown dosa filled with spiced potato masala, served steaming hot at 65°C with coconut chutney and piping hot drumstick sambar.",
    basePrice: 180.0,
    currency: "INR",
    categorySlug: "food",
    variants: [{ sku: "SKU-FOOD-002", name: "Hot In-Flight Pod 65°C (550g)", stock: 50 }],
  },
  {
    slug: "sri-krishna-ghee-roast-plain-dosa-set",
    name: "Sri Krishna Pure Ghee Roast Plain Dosa & Chutney Set",
    description: "Paper-thin golden crepe roasted with pure desi cow ghee on cast iron, accompanied by coconut chutney, tomato chutney, and aromatic sambar.",
    basePrice: 140.0,
    currency: "INR",
    categorySlug: "food",
    variants: [{ sku: "SKU-FOOD-DOSA-PLAIN", name: "Fresh Ghee Roast Set", stock: 45 }],
  },
  {
    slug: "thalappakatti-dindigul-chicken-biryani-mini-bucket",
    name: "Thalappakatti Dindigul Chicken Biryani Mini Bucket",
    description: "Authentic Seeraga Samba rice chicken biryani infused with 17 freshly ground hill spices, tender chicken pieces, served with boiled egg and curd raita.",
    basePrice: 360.0,
    currency: "INR",
    categorySlug: "food",
    variants: [{ sku: "SKU-FOOD-BIRYANI", name: "Single Diner Mini Bucket (650g)", stock: 35 }],
  },
  {
    slug: "annapoorna-steamed-soft-button-idlis",
    name: "Annapoorna Steamed Soft Button Idlis with 3 Chutneys",
    description: "14 mini fluffy button idlis immersed in hot signature Kovai tiffin sambar with pure ghee drizzle, accompanied by fresh coconut and coriander chutneys.",
    basePrice: 120.0,
    currency: "INR",
    categorySlug: "food",
    variants: [{ sku: "SKU-FOOD-001", name: "14 Mini Idlis + 3 Chutneys", stock: 60 }],
  },
  {
    slug: "trauma-first-aid-burn-emergency-flight-kit",
    name: "Trauma First Aid & Burn Emergency Flight Kit",
    description: "Hospital-grade sterile emergency kit featuring sterile burn hydrogel dressings, hemostatic gauze, pressure tourniquet, antiseptic wipes, and trauma shears.",
    basePrice: 650.0,
    currency: "INR",
    categorySlug: "medicine",
    variants: [{ sku: "SKU-MED-001", name: "Complete Drone Trauma Pack (420g)", stock: 40 }],
  },
  {
    slug: "dolo-650-paracetamol-antipyretic-strips",
    name: "Dolo-650 Paracetamol Antipyretic Strips (15 Tabs)",
    description: "Fast-acting Paracetamol 650mg tablets for rapid relief of high fever, headaches, body pain, and influenza symptoms.",
    basePrice: 45.0,
    currency: "INR",
    categorySlug: "medicine",
    variants: [{ sku: "SKU-MED-DOLO", name: "15 Tablets Foil Strip", stock: 100 }],
  },
  {
    slug: "asthalin-100mcg-salbutamol-emergency-rescue-inhaler",
    name: "Asthalin 100mcg Salbutamol Emergency Rescue Inhaler",
    description: "Fast-acting bronchodilator inhaler providing urgent relief from bronchospasm in asthma, chronic bronchitis, and respiratory distress.",
    basePrice: 185.0,
    currency: "INR",
    categorySlug: "medicine",
    variants: [{ sku: "SKU-MED-INHALER", name: "200 Metered Doses", stock: 30 }],
  },
  {
    slug: "electral-who-formula-oral-rehydration-salts",
    name: "Electral WHO-Formula Oral Rehydration Salts (Pack of 5)",
    description: "Scientifically formulated oral electrolyte and glucose replacement powder restoring vital salts and fluids lost during dehydration and heat exhaustion.",
    basePrice: 35.0,
    currency: "INR",
    categorySlug: "medicine",
    variants: [{ sku: "SKU-MED-ORS", name: "5 Sachet Value Pack", stock: 80 }],
  },
  {
    slug: "coimbatore-specialty-fresh-ground-filter-coffee",
    name: "Coimbatore Specialty Fresh Ground Filter Coffee (500g)",
    description: "80:20 Arabica-Robusta blend enriched with premium chicory, freshly roasted and micro-ground in Coimbatore for rich aromatic South Indian filter decoction.",
    basePrice: 240.0,
    currency: "INR",
    categorySlug: "groceries",
    variants: [{ sku: "SKU-GROC-001", name: "500g Vacuum Sealed Pack", stock: 55 }],
  },
  {
    slug: "aavin-daily-farm-fresh-whole-milk",
    name: "Aavin Daily Farm Fresh Whole Milk (1 Litre Pouch)",
    description: "Pasteurized homogenized full-cream cow milk delivered fresh chilled under 4°C in insulated cargo bay.",
    basePrice: 52.0,
    currency: "INR",
    categorySlug: "groceries",
    variants: [{ sku: "SKU-GROC-MILK", name: "1 Litre Chilled Pouch", stock: 75 }],
  },
  {
    slug: "65w-fast-gan-multi-port-quick-charger",
    name: "65W Fast GaN Multi-Port Drone-Delivered Quick Charger",
    description: "Compact gallium nitride (GaN) high-efficiency charger with dual USB-C and USB-A ports supporting 65W Power Delivery for laptops, tablets, and phones.",
    basePrice: 1899.0,
    currency: "INR",
    categorySlug: "electronics",
    variants: [{ sku: "SKU-ELEC-001", name: "Matte Black 65W GaN Pod", stock: 25 }],
  },
  {
    slug: "heavy-duty-20000mah-rapid-charge-power-bank",
    name: "Heavy-Duty 20000mAh Rapid Charge Power Bank (22.5W)",
    description: "High-capacity aviation-safe Li-Polymer emergency portable power station with bi-directional fast charging and LED percentage display.",
    basePrice: 1499.0,
    currency: "INR",
    categorySlug: "electronics",
    variants: [{ sku: "SKU-ELEC-PBANK", name: "20,000mAh Power Reserve", stock: 20 }],
  },
  {
    slug: "biometric-tamper-evident-contract-pouch",
    name: "Biometric Tamper-Evident High-Priority Contract Pouch",
    description: "Reinforced water-resistant security pouch with numeric tamper seal, digital tracking tag, and tear-proof ballistic nylon for urgent legal documents.",
    basePrice: 450.0,
    currency: "INR",
    categorySlug: "documents",
    variants: [{ sku: "SKU-DOC-001", name: "Legal Document Pouch (A4/Legal)", stock: 50 }],
  },
  {
    slug: "cold-pressed-groundnut-cooking-oil",
    name: "Cold-Pressed Traditional Groundnut Cooking Oil (1 Litre)",
    description: "100% pure traditional wooden-cold-pressed (Mara Chekku) groundnut oil from Pollachi peanuts. Unrefined, unbleached, retaining natural antioxidants.",
    basePrice: 320.0,
    currency: "INR",
    categorySlug: "daily-essentials",
    variants: [{ sku: "SKU-OTHER-OIL", name: "1 Litre Glass Bottle", stock: 40 }],
  },
  // Reference demo products for test backward compatibility
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
    description: "Internal service-to-service calls (e.g. drone simulator, Gazebo bridge)",
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
  }

  const customerEmail = process.env.CUSTOMER_SEED_EMAIL ?? "customer@skynav.local";
  const customerPassword = process.env.CUSTOMER_SEED_PASSWORD ?? "ChangeMe123!";
  console.log(`Ensuring bootstrap Customer (${customerEmail})...`);
  const existingCustomer = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!existingCustomer) {
    const passwordHash = await argon2.hash(customerPassword, { type: argon2.argon2id });
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash,
        firstName: "Priya",
        lastName: "Sundaram",
        isActive: true,
        isEmailVerified: true,
        roles: { create: [{ roleId: customerRole.id }] },
      },
    });
    console.log("Bootstrap Customer created.");
  }

  console.log("Ensuring fulfillment hubs (SkyHub Kurumbapalayam & Downtown)...");
  // SkyHub Kurumbapalayam, Coimbatore (11.1132°N, 77.0277°E)
  const kurumbaCode = "HUB-KURUMBAPALAYAM";
  let kurumbaHub = await prisma.fulfillmentHub.findUnique({ where: { code: kurumbaCode } });
  if (!kurumbaHub) {
    await prisma.$executeRaw`
      INSERT INTO fulfillment_hubs (id, name, code, address, location, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'SkyHub Kurumbapalayam', ${kurumbaCode},
        'SF No. 120/1, Avinashi Road, Kurumbapalayam, Coimbatore, Tamil Nadu 641107',
        ST_SetSRID(ST_MakePoint(77.0277, 11.1132), 4326)::geography,
        true, now(), now()
      )
    `;
    kurumbaHub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: kurumbaCode } });
    console.log("SkyHub Kurumbapalayam created.");
  }

  // Downtown Hub alias for backward test compatibility
  const downtownCode = "HUB-DOWNTOWN";
  let downtownHub = await prisma.fulfillmentHub.findUnique({ where: { code: downtownCode } });
  if (!downtownHub) {
    await prisma.$executeRaw`
      INSERT INTO fulfillment_hubs (id, name, code, address, location, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Downtown Hub', ${downtownCode}, '100 Main St, Springfield',
        ST_SetSRID(ST_MakePoint(-93.2650, 44.9778), 4326)::geography,
        true, now(), now()
      )
    `;
    downtownHub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: downtownCode } });
    console.log("Downtown Hub created.");
  }

  const primaryHub = kurumbaHub;

  console.log("Seeding catalog (categories, products, variants, stock)...");
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const parentId = category.parentSlug ? categoryIdBySlug.get(category.parentSlug) : undefined;
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description, parentId },
      create: { slug: category.slug, name: category.name, description: category.description, parentId },
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  for (const productData of PRODUCTS) {
    const categoryId = categoryIdBySlug.get(productData.categorySlug);
    const product = await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {
        name: productData.name,
        description: productData.description,
        basePrice: productData.basePrice,
        currency: productData.currency ?? "INR",
        categoryId,
      },
      create: {
        slug: productData.slug,
        name: productData.name,
        description: productData.description,
        basePrice: productData.basePrice,
        currency: productData.currency ?? "INR",
        categoryId,
      },
    });

    for (const variantData of productData.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: variantData.sku },
        update: { name: variantData.name, priceOverride: variantData.priceOverride, productId: product.id },
        create: {
          sku: variantData.sku,
          name: variantData.name,
          priceOverride: variantData.priceOverride,
          productId: product.id,
        },
      });

      // Stock at primary hub (Kurumbapalayam)
      await prisma.inventoryItem.upsert({
        where: { variantId_hubId: { variantId: variant.id, hubId: primaryHub.id } },
        update: { quantityOnHand: variantData.stock },
        create: {
          variantId: variant.id,
          hubId: primaryHub.id,
          quantityOnHand: variantData.stock,
          lowStockThreshold: 5,
        },
      });

      // Stock at secondary hub (Downtown)
      await prisma.inventoryItem.upsert({
        where: { variantId_hubId: { variantId: variant.id, hubId: downtownHub.id } },
        update: { quantityOnHand: variantData.stock },
        create: {
          variantId: variant.id,
          hubId: downtownHub.id,
          quantityOnHand: variantData.stock,
          lowStockThreshold: 5,
        },
      });
    }
  }

  console.log("Seeding 40 drones at SkyHub Kurumbapalayam (D-001 through D-040)...");
  const [hubCoords] = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
    SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
    FROM fulfillment_hubs WHERE id = ${primaryHub.id}
  `;

  // 40 Drones assigned to SkyHub Kurumbapalayam
  for (let i = 1; i <= 40; i++) {
    const pad = i.toString().padStart(3, "0");
    const droneName = `D-${pad}`;
    const serialNumber = `SKN-DRN-${pad}`;
    const isMaintenance = i === 40; // Drone D-040 flagged for maintenance as demo

    await prisma.drone.upsert({
      where: { serialNumber },
      update: {
        name: droneName,
        currentLat: hubCoords.lat,
        currentLng: hubCoords.lng,
        batteryPercent: isMaintenance ? 12 : 100,
        maxPayloadKg: 5.0,
        maxSpeedMps: 13.889, // 50 km/h cruise
        maxAltitudeMeters: 120,
        maxRangeKm: 25.0,
        homeHubId: primaryHub.id,
        status: isMaintenance ? "MAINTENANCE" : "IDLE",
        isMaintenanceMode: isMaintenance,
        maintenanceNote: isMaintenance ? "Scheduled 100-cycle motor bearing inspection" : null,
      },
      create: {
        serialNumber,
        name: droneName,
        model: "SkyNav X-Hexacopter Pro",
        adapterType: "SIMULATED",
        status: isMaintenance ? "MAINTENANCE" : "IDLE",
        homeHubId: primaryHub.id,
        batteryPercent: isMaintenance ? 12 : 100,
        currentLat: hubCoords.lat,
        currentLng: hubCoords.lng,
        maxPayloadKg: 5.0,
        maxSpeedMps: 13.889,
        maxAltitudeMeters: 120,
        maxRangeKm: 25.0,
        isMaintenanceMode: isMaintenance,
        maintenanceNote: isMaintenance ? "Scheduled 100-cycle motor bearing inspection" : null,
      },
    });
  }
  console.log("40 Drones seeded successfully at Kurumbapalayam.");

  console.log("Seeding Coimbatore DGCA No-Fly Zones & Airspace boundaries...");
  function circularPolygonWkt(center: { lat: number; lng: number }, radiusMeters: number, points = 24): string {
    const coords: string[] = [];
    const latDegPerMeter = 1 / 111320;
    const lngDegPerMeter = 1 / (111320 * Math.cos((center.lat * Math.PI) / 180));
    for (let i = 0; i <= points; i++) {
      const angle = (i * 2 * Math.PI) / points;
      const dLat = radiusMeters * Math.sin(angle) * latDegPerMeter;
      const dLng = radiusMeters * Math.cos(angle) * lngDegPerMeter;
      coords.push(`${(center.lng + dLng).toFixed(6)} ${(center.lat + dLat).toFixed(6)}`);
    }
    return `POLYGON((${coords.join(", ")}))`;
  }

  function squareWkt(center: { lat: number; lng: number }, halfWidthDeg: number): string {
    const { lat, lng } = center;
    const pts = [
      [lng - halfWidthDeg, lat - halfWidthDeg],
      [lng + halfWidthDeg, lat - halfWidthDeg],
      [lng + halfWidthDeg, lat + halfWidthDeg],
      [lng - halfWidthDeg, lat + halfWidthDeg],
      [lng - halfWidthDeg, lat - halfWidthDeg],
    ];
    return `POLYGON((${pts.map((p) => p.join(" ")).join(", ")}))`;
  }

  // Check if Coimbatore zones exist
  const existingZ = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint as count FROM geofences WHERE name LIKE '%Coimbatore%' OR name LIKE '%Sulur%'
  `;

  if (Number(existingZ[0]?.count ?? 0) === 0) {
    // 1. VOCB-RED-RUNWAY: Coimbatore International Airport Runway Security Zone
    const vocbWkt = "POLYGON((77.0305 11.0385, 77.0560 11.0425, 77.0590 11.0245, 77.0335 11.0205, 77.0305 11.0385))";
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Coimbatore International Airport Runway Security Zone (VOCB-RED-RUNWAY)',
        'NO_FLY'::"GeofenceType",
        'Active commercial runway 05/23 and primary terminal boundary. Prohibited Red Zone under DGCA Drone Rules 2021.',
        ST_GeomFromText(${vocbWkt}, 4326), true, now(), now()
      )
    `;

    // 2. VO47-RED-MIL: Sulur Air Force Station Military Airspace Red Zone
    const vo47Wkt = "POLYGON((77.1425 11.02528, 77.17222 11.02861, 77.17556 11.00194, 77.14583 10.99861, 77.1425 11.02528))";
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Sulur Air Force Station Military Airspace (VO47-RED-MIL)',
        'NO_FLY'::"GeofenceType",
        'Indian Air Force Fighter Base & Military Flight Training Area. Red Zone: Strictly prohibited without Ministry of Defence clearance.',
        ST_GeomFromText(${vo47Wkt}, 4326), true, now(), now()
      )
    `;

    // 3. CMCH-HELI-CORR: Coimbatore Medical College Hospital Trauma Heliport Corridor (1200m radius around 10.9996, 76.9664)
    const cmchWkt = circularPolygonWkt({ lat: 10.9996, lng: 76.9664 }, 1200);
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Coimbatore Medical College Hospital Heliport Corridor (CMCH-HELI-CORR)',
        'RESTRICTED'::"GeofenceType",
        'Emergency Medevac helicopter transit corridor. Drones must maintain safe lateral separation and max 35m altitude.',
        ST_GeomFromText(${cmchWkt}, 4326), true, now(), now()
      )
    `;

    // 4. CBE-GOV-SEC: Coimbatore District Collectorate Security Enclave (800m radius around 11.0018, 76.9629)
    const cbeGovWkt = circularPolygonWkt({ lat: 11.0018, lng: 76.9629 }, 800);
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Coimbatore District Collectorate & Police Commissionerate (CBE-GOV-SEC)',
        'RESTRICTED'::"GeofenceType",
        'Dense municipal government & law enforcement complex. Speed limit 30 km/h mandatory.',
        ST_GeomFromText(${cbeGovWkt}, 4326), true, now(), now()
      )
    `;

    // 5. PSG-MED-CORR: PSG Hospitals Air Corridor (1000m radius around 11.0250, 77.0300)
    const psgWkt = circularPolygonWkt({ lat: 11.0250, lng: 77.0300 }, 1000);
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'PSG Hospitals & Health Campus Air Corridor (PSG-MED-CORR)',
        'RESTRICTED'::"GeofenceType",
        'Hospital quiet zone & ambulance transit corridor. Acoustic optimization active.',
        ST_GeomFromText(${psgWkt}, 4326), true, now(), now()
      )
    `;

    // 6. Coimbatore Metro & Kurumbapalayam Service Area
    const serviceAreaWkt = squareWkt({ lat: 11.1132, lng: 77.0277 }, 0.12);
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Coimbatore Metro & Kurumbapalayam Air Corridor',
        'SERVICE_AREA'::"GeofenceType",
        'Authoritative operational service area for autonomous drone deliveries from SkyHub Kurumbapalayam.',
        ST_GeomFromText(${serviceAreaWkt}, 4326), true, now(), now()
      )
    `;

    // Demo zones for test backward compatibility
    const demoCenter = { lat: 44.9778, lng: -93.265 };
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Metro Service Area', 'SERVICE_AREA'::"GeofenceType",
        'Demo deliverable area around the downtown hub.',
        ST_GeomFromText(${squareWkt(demoCenter, 0.05)}, 4326), true, now(), now()
      )
    `;
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'North Airfield No-Fly Zone', 'NO_FLY'::"GeofenceType",
        'Demo no-fly zone north of delivery range.',
        ST_GeomFromText(${squareWkt({ lat: demoCenter.lat + 0.08, lng: demoCenter.lng }, 0.01)}, 4326), true, now(), now()
      )
    `;
    console.log("Coimbatore DGCA no-fly zones and service areas created.");
  } else {
    console.log("Geofences already seeded — skipping.");
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

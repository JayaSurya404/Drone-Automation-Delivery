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
  imageUrl?: string;
  variants: SeedVariant[];
}

const PRODUCTS: SeedProduct[] = [
  // ── 1. FOOD & HOT MEALS (South Indian Specialties in thermal pods) ──
  {
    slug: "kovai-crispy-masala-dosa-breakfast-box",
    name: "Kovai Crispy Masala Dosa & Sambar Breakfast Box",
    description: "Crisp golden brown dosa filled with spiced potato masala, served steaming hot at 65°C with coconut chutney and piping hot drumstick sambar.",
    basePrice: 180.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/masala_dosa.jpg",
    variants: [{ sku: "SKU-FOOD-002", name: "Hot In-Flight Pod 65°C (550g)", stock: 50 }],
  },
  {
    slug: "sri-krishna-ghee-roast-plain-dosa-set",
    name: "Sri Krishna Pure Ghee Roast Plain Dosa & Chutney Set",
    description: "Paper-thin golden crepe roasted with pure desi cow ghee on cast iron, accompanied by coconut chutney, tomato chutney, and aromatic sambar.",
    basePrice: 140.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/plain_dosa.jpg",
    variants: [{ sku: "SKU-FOOD-DOSA-PLAIN", name: "Fresh Ghee Roast Set", stock: 45 }],
  },
  {
    slug: "thalappakatti-dindigul-chicken-biryani-mini-bucket",
    name: "Thalappakatti Dindigul Chicken Biryani Mini Bucket",
    description: "Authentic Seeraga Samba rice chicken biryani infused with 17 freshly ground hill spices, tender chicken pieces, served with boiled egg and curd raita.",
    basePrice: 360.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/dindigul_biryani.svg",
    variants: [{ sku: "SKU-FOOD-BIRYANI", name: "Single Diner Mini Bucket (650g)", stock: 35 }],
  },
  {
    slug: "annapoorna-steamed-soft-button-idlis",
    name: "Annapoorna Steamed Soft Button Idlis with 3 Chutneys",
    description: "14 mini fluffy button idlis immersed in hot signature Kovai tiffin sambar with pure ghee drizzle, accompanied by fresh coconut and coriander chutneys.",
    basePrice: 120.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/steamed_idli.jpg",
    variants: [{ sku: "SKU-FOOD-001", name: "14 Mini Idlis + 3 Chutneys", stock: 60 }],
  },
  {
    slug: "crispy-golden-medu-vada-4-pack",
    name: "Crispy Golden Medu Vada (4-Pack with Sambar & Chutney)",
    description: "Deep-golden crispy black gram lentil donuts flavored with crushed peppercorns, curry leaves, and ginger. Served piping hot.",
    basePrice: 130.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/medu_vada.jpg",
    variants: [{ sku: "SKU-FOOD-VADA-4", name: "4 Vadas + Podi & Sambar (400g)", stock: 40 }],
  },
  {
    slug: "kovai-traditional-sambar-pot-1-litre",
    name: "Kovai Traditional Sambar Pot (1 Litre Thermal Pack)",
    description: "Slow-cooked lentil stew simmered with shallots, drumsticks, and freshly roasted Coimbatore coriander-cumin masala in an insulated flask.",
    basePrice: 160.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/sambar_pot.jpg",
    variants: [{ sku: "SKU-FOOD-SAMBAR-POT", name: "1L Thermal Flask (1.1kg)", stock: 30 }],
  },
  {
    slug: "royal-south-indian-meals-thali-box",
    name: "Royal South Indian Meals Thali Box",
    description: "Full traditional lunch with ponni rice, sambar, rasam, kootu, poriyal, curd, papad, and payasam packed in sealed partitioned tray.",
    basePrice: 220.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/south_indian_thali.jpg",
    variants: [{ sku: "SKU-FOOD-THALI", name: "Complete Executive Meal Box (850g)", stock: 25 }],
  },
  {
    slug: "ambur-mutton-dum-biryani-portion",
    name: "Ambur Mutton Dum Biryani (Single Portion)",
    description: "Arcot-style wood-fired mutton dum biryani made with fragrant Seeraga Samba rice and tender goat meat, served with brinjal dalcha.",
    basePrice: 420.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/ambur_biryani.svg",
    variants: [{ sku: "SKU-FOOD-AMBUR-MUTTON", name: "Single Portion with Dalcha (600g)", stock: 25 }],
  },
  {
    slug: "chettinad-pepper-chicken-gravy",
    name: "Chettinad Pepper Chicken Gravy with Malabar Parotta",
    description: "Fiery Karaikudi black pepper and shallot chicken curry served with two layered flaky Kerala parottas.",
    basePrice: 290.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/chettinad_chicken.svg",
    variants: [{ sku: "SKU-FOOD-CHETTINAD", name: "Curry + 2 Flaky Parottas (620g)", stock: 30 }],
  },
  {
    slug: "paneer-butter-masala-parotta-combo",
    name: "Paneer Butter Masala & Malabar Parotta Set",
    description: "Rich creamy cashew-tomato makhani gravy with tender fresh paneer cubes, served with 3 soft wheat parottas.",
    basePrice: 260.0,
    currency: "INR",
    categorySlug: "food",
    imageUrl: "/images/products/paneer_parotta.svg",
    variants: [{ sku: "SKU-FOOD-PANEER-PAROTTA", name: "Paneer Gravy + 3 Parottas (580g)", stock: 35 }],
  },

  // ── 2. MEDICINE & EMERGENCY HEALTH (Urgent first-aid, analgesics, diagnostic) ──
  {
    slug: "trauma-first-aid-burn-emergency-flight-kit",
    name: "Trauma First Aid & Burn Emergency Flight Kit",
    description: "Hospital-grade sterile emergency kit featuring sterile burn hydrogel dressings, hemostatic gauze, pressure tourniquet, antiseptic wipes, and trauma shears.",
    basePrice: 650.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/first_aid_kit.jpg",
    variants: [{ sku: "SKU-MED-001", name: "Complete Drone Trauma Pack (420g)", stock: 40 }],
  },
  {
    slug: "dolo-650-paracetamol-antipyretic-strips",
    name: "Dolo-650 Paracetamol Antipyretic Strips (15 Tabs)",
    description: "Fast-acting Paracetamol 650mg tablets for rapid relief of high fever, headaches, body pain, and influenza symptoms.",
    basePrice: 45.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/dolo_650.svg",
    variants: [{ sku: "SKU-MED-DOLO", name: "15 Tablets Foil Strip", stock: 100 }],
  },
  {
    slug: "asthalin-100mcg-salbutamol-emergency-rescue-inhaler",
    name: "Asthalin 100mcg Salbutamol Emergency Rescue Inhaler",
    description: "Fast-acting bronchodilator inhaler providing urgent relief from bronchospasm in asthma, chronic bronchitis, and respiratory distress.",
    basePrice: 185.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/asthalin_inhaler.svg",
    variants: [{ sku: "SKU-MED-INHALER", name: "200 Metered Doses", stock: 30 }],
  },
  {
    slug: "electral-who-formula-oral-rehydration-salts",
    name: "Electral WHO-Formula Oral Rehydration Salts (Pack of 5)",
    description: "Scientifically formulated oral electrolyte and glucose replacement powder restoring vital salts and fluids lost during dehydration and heat exhaustion.",
    basePrice: 35.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/electral_ors.svg",
    variants: [{ sku: "SKU-MED-ORS", name: "5 Sachet Value Pack", stock: 80 }],
  },
  {
    slug: "amrutanjan-fast-acting-headache-pain-balm",
    name: "Amrutanjan Fast-Acting Headache & Cold Pain Balm (50g)",
    description: "Ayurvedic pain-relieving formulation containing wintergreen oil, menthol, and eucalyptus for rapid relief of severe tension headaches and nasal congestion.",
    basePrice: 110.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/pain_relief_balm.jpg",
    variants: [{ sku: "SKU-MED-BALM", name: "50g Glass Jar", stock: 60 }],
  },
  {
    slug: "betadine-10-percent-antiseptic-ointment",
    name: "Betadine 10% Antiseptic Ointment (20g Tube)",
    description: "Microbicidal water-soluble iodine ointment for prompt prevention and treatment of surface wound, cut, scrape, and burn infections.",
    basePrice: 78.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/betadine_ointment.svg",
    variants: [{ sku: "SKU-MED-BETADINE", name: "20g Sterile Tube", stock: 55 }],
  },
  {
    slug: "volini-rapid-pain-relief-spray-100g",
    name: "Volini Rapid Pain Relief Spray (100g Can)",
    description: "Quick-absorbing micro-droplet analgesic spray with diclofenac, methyl salicylate, and menthol for fast musculoskeletal and joint pain relief.",
    basePrice: 195.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/volini_spray.svg",
    variants: [{ sku: "SKU-MED-VOLINI", name: "100g Aerosol Can", stock: 45 }],
  },
  {
    slug: "omeprazole-20mg-delayed-release-capsules",
    name: "Omeprazole 20mg Delayed-Release Antacid Capsules (14 Caps)",
    description: "Proton pump inhibitor (PPI) capsules providing 24-hour relief from severe heartburn, acid reflux, and hyperacidity.",
    basePrice: 65.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/omeprazole_capsules.svg",
    variants: [{ sku: "SKU-MED-OMEPRAZOLE", name: "14 Capsules Strip", stock: 70 }],
  },
  {
    slug: "accu-chek-instant-glucose-strips-25s",
    name: "Accu-Chek Instant Blood Glucose Monitoring Strips (25 Strips)",
    description: "High-accuracy diagnostic test strips requiring just 0.6 micro-litres of capillary whole blood for 4-second instant glucose reading.",
    basePrice: 720.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/glucose_strips.svg",
    variants: [{ sku: "SKU-MED-ACCUCHEK", name: "25 Test Strips Vial", stock: 35 }],
  },
  {
    slug: "n95-certified-surgical-respirator-masks-5s",
    name: "N95 Certified Surgical Respirator Masks (Pack of 5)",
    description: "5-layer electrostatically charged meltblown filter respirators filtering >= 95% particulate matter, aerosols, and airborne pathogens.",
    basePrice: 175.0,
    currency: "INR",
    categorySlug: "medicine",
    imageUrl: "/images/products/n95_masks.svg",
    variants: [{ sku: "SKU-MED-N95-5PK", name: "5 Sealed Respirator Masks", stock: 90 }],
  },

  // ── 3. GROCERIES & PANTRY ESSENTIALS ──
  {
    slug: "coimbatore-specialty-fresh-ground-filter-coffee",
    name: "Coimbatore Specialty Fresh Ground Filter Coffee (500g)",
    description: "80:20 Arabica-Robusta blend enriched with premium chicory, freshly roasted and micro-ground in Coimbatore for rich aromatic South Indian filter decoction.",
    basePrice: 240.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/filter_coffee.jpg",
    variants: [{ sku: "SKU-GROC-001", name: "500g Vacuum Sealed Pack", stock: 55 }],
  },
  {
    slug: "aavin-daily-farm-fresh-whole-milk",
    name: "Aavin Daily Farm Fresh Whole Milk (1 Litre Pouch)",
    description: "Pasteurized homogenized full-cream cow milk delivered fresh chilled under 4°C in insulated cargo bay.",
    basePrice: 52.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/aavin_milk.jpg",
    variants: [{ sku: "SKU-GROC-MILK", name: "1 Litre Chilled Pouch", stock: 75 }],
  },
  {
    slug: "crispy-handmade-kovai-butter-murukku",
    name: "Crispy Handmade Kovai Butter Murukku (250g)",
    description: "Mouth-watering spiral snack handcrafted using roasted rice flour, fragrant white butter, sesame seeds, and asafetida. Crispy and light.",
    basePrice: 95.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/butter_murukku.jpg",
    variants: [{ sku: "SKU-GROC-MURUKKU", name: "250g Nitrogen Flush Pouch", stock: 65 }],
  },
  {
    slug: "sri-krishna-ghee-mysore-pak-box",
    name: "Sri Krishna Sweets Ghee Mysore Pak (500g Box)",
    description: "Legendary melt-in-mouth golden sweet crafted with slow-simmered pure desi ghee, gram flour, and fine sugar crystals from RS Puram.",
    basePrice: 380.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/ghee_mysore_pak.jpg",
    variants: [{ sku: "SKU-GROC-MYSOREPAK", name: "500g Gift Box", stock: 40 }],
  },
  {
    slug: "cold-pressed-groundnut-cooking-oil",
    name: "Cold-Pressed Traditional Groundnut Cooking Oil (1 Litre)",
    description: "100% pure traditional wooden-cold-pressed (Mara Chekku) groundnut oil from Pollachi peanuts. Unrefined, unbleached, retaining natural antioxidants.",
    basePrice: 320.0,
    currency: "INR",
    categorySlug: "daily-essentials",
    imageUrl: "/images/products/cold_pressed_oil.jpg",
    variants: [{ sku: "SKU-OTHER-OIL", name: "1 Litre Glass Bottle", stock: 40 }],
  },
  {
    slug: "organic-ponni-boiled-rice-2kg",
    name: "Organic Ponni Boiled Rice (2kg Bag)",
    description: "Premium aged Thanjavur delta Ponni boiled rice, naturally rich in dietary fibre, non-sticky, perfect for daily meals.",
    basePrice: 145.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/ponni_rice.svg",
    variants: [{ sku: "SKU-GROC-PONNI-2KG", name: "2kg Sealed Bag", stock: 50 }],
  },
  {
    slug: "royal-organic-unpolished-toor-dal-1kg",
    name: "Royal Organic Unpolished Toor Dal (1kg Pack)",
    description: "Naturally farm-grown unpolished pigeon pea lentils rich in vegetable protein, ideal for South Indian sambar and kootu.",
    basePrice: 175.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/toor_dal.svg",
    variants: [{ sku: "SKU-GROC-TOORDAL-1KG", name: "1kg Vacuum Pack", stock: 60 }],
  },
  {
    slug: "aachi-madras-sambar-powder-200g",
    name: "Aachi Madras Sambar Powder (200g Pouch)",
    description: "Traditional spice blend roasted with red chilies, coriander, fenugreek, cumin, and curry leaves for genuine home-style sambar aroma.",
    basePrice: 58.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/sambar_powder.svg",
    variants: [{ sku: "SKU-GROC-SAMBARPODI", name: "200g Pouch", stock: 80 }],
  },
  {
    slug: "nilgiri-tea-fresh-garden-dust-250g",
    name: "Nilgiri Tea Fresh Garden Dust (250g Pouch)",
    description: "High-grown Nilgiri blue mountain black tea dust offering strong brisk liquor and refreshing floral notes.",
    basePrice: 125.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/nilgiri_tea.svg",
    variants: [{ sku: "SKU-GROC-NILGIRITEA", name: "250g Foil Pouch", stock: 70 }],
  },
  {
    slug: "haldirams-nagpur-bhujia-sev-400g",
    name: "Haldiram's Nagpur Bhujia Sev (400g Pack)",
    description: "Classic spicy crispy snack made from moth bean and gram flour seasoned with red chili, black pepper, and clove oil.",
    basePrice: 110.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/bhujia_sev.svg",
    variants: [{ sku: "SKU-GROC-BHUJIA", name: "400g Value Pack", stock: 55 }],
  },
  {
    slug: "tirunelveli-ghee-wheat-halwa-250g",
    name: "Tirunelveli Desi Ghee Wheat Halwa (250g Pack)",
    description: "Authentic dark caramel Thamirabarani river wheat milk halwa cooked with pure cow ghee and crushed cashews.",
    basePrice: 190.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/tirunelveli_halwa.svg",
    variants: [{ sku: "SKU-GROC-HALWA", name: "250g Sealed Tray", stock: 45 }],
  },
  {
    slug: "kerala-nendran-spicy-banana-chips-200g",
    name: "Kerala Nendran Spicy Banana Chips (200g Pouch)",
    description: "Wafer-thin raw Nendran bananas kettle-fried in pure coconut oil and tossed with rock salt and Kashmiri chili powder.",
    basePrice: 85.0,
    currency: "INR",
    categorySlug: "groceries",
    imageUrl: "/images/products/banana_chips.svg",
    variants: [{ sku: "SKU-GROC-BANANACHIPS", name: "200g Stand-up Pouch", stock: 65 }],
  },

  // ── 4. TECH & ELECTRONICS ACCESSORIES ──
  {
    slug: "65w-fast-gan-multi-port-quick-charger",
    name: "65W Fast GaN Multi-Port Drone-Delivered Quick Charger",
    description: "Compact gallium nitride (GaN) high-efficiency charger with dual USB-C and USB-A ports supporting 65W Power Delivery for laptops, tablets, and phones.",
    basePrice: 1899.0,
    currency: "INR",
    categorySlug: "electronics",
    imageUrl: "/images/products/gan_charger.jpg",
    variants: [{ sku: "SKU-ELEC-001", name: "Matte Black 65W GaN Pod", stock: 25 }],
  },
  {
    slug: "heavy-duty-20000mah-rapid-charge-power-bank",
    name: "Heavy-Duty 20000mAh Rapid Charge Power Bank (22.5W)",
    description: "High-capacity aviation-safe Li-Polymer emergency portable power station with bi-directional fast charging and LED percentage display.",
    basePrice: 1499.0,
    currency: "INR",
    categorySlug: "electronics",
    imageUrl: "/images/products/power_bank.jpg",
    variants: [{ sku: "SKU-ELEC-PBANK", name: "20,000mAh Power Reserve", stock: 20 }],
  },
  {
    slug: "braided-100w-usb-c-to-usb-c-charging-cable",
    name: "Braided 100W USB-C to USB-C Fast-Charging Cable (2m)",
    description: "Heavy-duty ballistic nylon braided fast-charging cable with reinforced strain relief and 5A E-Marker smart chip.",
    basePrice: 399.0,
    currency: "INR",
    categorySlug: "electronics",
    imageUrl: "/images/products/usbc_cable.svg",
    variants: [{ sku: "SKU-ELEC-USBC-2M", name: "2 Metre Space Gray Cable", stock: 60 }],
  },
  {
    slug: "lightning-to-usb-c-apple-fast-charging-cable",
    name: "Lightning to USB-C Fast Charging Apple Cable (1.2m)",
    description: "Apple MFi certified high-speed sync and PD fast-charging cable for iPhone, iPad, and AirPods.",
    basePrice: 499.0,
    currency: "INR",
    categorySlug: "electronics",
    imageUrl: "/images/products/lightning_cable.svg",
    variants: [{ sku: "SKU-ELEC-LIGHTNING-1M", name: "1.2m White Shielded Cable", stock: 50 }],
  },
  {
    slug: "bluetooth-5-3-low-latency-wireless-earbuds",
    name: "Bluetooth 5.3 Low-Latency True Wireless Earbuds",
    description: "Ultra-compact IPX5 water-resistant wireless earbuds with environmental noise cancellation (ENC) and 28-hour playback case.",
    basePrice: 1299.0,
    currency: "INR",
    categorySlug: "electronics",
    imageUrl: "/images/products/tws_earbuds.svg",
    variants: [{ sku: "SKU-ELEC-TWS-BLK", name: "Matte Black Earbuds with Charging Case", stock: 30 }],
  },
  {
    slug: "sandisk-ultra-128gb-microsdxc-high-speed-card",
    name: "SanDisk Ultra 128GB MicroSDXC High-Speed Memory Card",
    description: "Class 10 A1 rated 140MB/s micro SD card suitable for action cameras, drones, smartphones, and surveillance cams.",
    basePrice: 849.0,
    currency: "INR",
    categorySlug: "electronics",
    imageUrl: "/images/products/microsd_card.svg",
    variants: [{ sku: "SKU-ELEC-SD128", name: "128GB Card + SD Adapter", stock: 45 }],
  },

  // ── 5. DAILY ESSENTIALS & EMERGENCY DOCUMENTS ──
  {
    slug: "biometric-tamper-evident-contract-pouch",
    name: "Biometric Tamper-Evident High-Priority Contract Pouch",
    description: "Reinforced water-resistant security pouch with numeric tamper seal, digital tracking tag, and tear-proof ballistic nylon for urgent legal documents.",
    basePrice: 450.0,
    currency: "INR",
    categorySlug: "documents",
    imageUrl: "/images/products/legal_document_pouch.jpg",
    variants: [{ sku: "SKU-DOC-001", name: "Legal Document Pouch (A4/Legal)", stock: 50 }],
  },
  {
    slug: "dettol-germ-protection-antiseptic-liquid-250ml",
    name: "Dettol Germ Protection Antiseptic Liquid (250ml Bottle)",
    description: "Household disinfectant and personal hygiene antiseptic liquid for first aid, cuts, insect bites, and bathing.",
    basePrice: 135.0,
    currency: "INR",
    categorySlug: "daily-essentials",
    imageUrl: "/images/products/dettol_liquid.svg",
    variants: [{ sku: "SKU-ESS-DETTOL", name: "250ml Antiseptic Bottle", stock: 65 }],
  },
  {
    slug: "himalaya-purifying-neem-face-wash-150ml",
    name: "Himalaya Purifying Neem Face Wash (150ml Tube)",
    description: "Soap-free herbal formulation that clears impurities, controls acne and pimples with neem and turmeric.",
    basePrice: 165.0,
    currency: "INR",
    categorySlug: "daily-essentials",
    imageUrl: "/images/products/neem_facewash.svg",
    variants: [{ sku: "SKU-ESS-NEEMWASH", name: "150ml Tube", stock: 55 }],
  },
  {
    slug: "gillette-fusion5-cartridge-blades-4-pack",
    name: "Gillette Fusion5 Precision Cartridge Razor Blades (Pack of 4)",
    description: "5 anti-friction blades with precision trimmer on back and lubrication strip for closest comfortable shave.",
    basePrice: 699.0,
    currency: "INR",
    categorySlug: "daily-essentials",
    imageUrl: "/images/products/gillette_blades.svg",
    variants: [{ sku: "SKU-ESS-GILLETTE-4", name: "4 Replacement Cartridges", stock: 40 }],
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
  const adminPasswordHash = await argon2.hash(bootstrapPassword, { type: argon2.argon2id });
  if (!existingAdmin) {
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
    await prisma.user.create({
      data: {
        email: bootstrapEmail,
        passwordHash: adminPasswordHash,
        firstName: "Super",
        lastName: "Admin",
        isActive: true,
        isEmailVerified: true,
        roles: { create: [{ roleId: superAdminRole.id }] },
      },
    });
    console.log("Bootstrap Super Admin created.");
  } else {
    await prisma.user.update({
      where: { email: bootstrapEmail },
      data: { passwordHash: adminPasswordHash },
    });
    console.log("Bootstrap Super Admin password verified/updated.");
  }

  const customerEmail = process.env.CUSTOMER_SEED_EMAIL ?? "customer@skynav.local";
  const customerPassword = process.env.CUSTOMER_SEED_PASSWORD ?? "ChangeMe123!";
  console.log(`Ensuring bootstrap Customer (${customerEmail})...`);
  let customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });
  const customerPasswordHash = await argon2.hash(customerPassword, { type: argon2.argon2id });
  if (!customerUser) {
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    customerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash: customerPasswordHash,
        firstName: "Priya",
        lastName: "Sundaram",
        isActive: true,
        isEmailVerified: true,
        roles: { create: [{ roleId: customerRole.id }] },
      },
    });
    console.log("Bootstrap Customer created.");
  } else {
    customerUser = await prisma.user.update({
      where: { email: customerEmail },
      data: { passwordHash: customerPasswordHash },
    });
    console.log("Bootstrap Customer password verified/updated.");
  }

  // Ensure Coimbatore default delivery address for bootstrap customer
  const existingAddress = await prisma.customerAddress.findFirst({
    where: { userId: customerUser.id },
  });
  if (!existingAddress) {
    await prisma.customerAddress.create({
      data: {
        userId: customerUser.id,
        recipientName: "Priya Sundaram",
        label: "Home",
        line1: "SF No. 120/1, Avinashi Road, Kurumbapalayam",
        line2: "Near SkyHub Operational Corridor",
        city: "Coimbatore",
        state: "Tamil Nadu",
        postalCode: "641107",
        country: "IN",
        phone: "+91 98765 43210",
        isDefault: true,
      },
    });
    console.log("Bootstrap Customer Coimbatore address created.");
  } else {
    await prisma.customerAddress.update({
      where: { id: existingAddress.id },
      data: { isDefault: true },
    });
    console.log("Bootstrap Customer default address verified.");
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

    if (productData.imageUrl) {
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      await prisma.productImage.create({
        data: {
          productId: product.id,
          storageKey: productData.imageUrl,
          altText: productData.name,
          position: 0,
        },
      });
    }

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

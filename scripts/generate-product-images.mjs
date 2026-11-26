import fs from 'node:fs';
import path from 'node:path';

const items = [
  {
    filename: 'dindigul_biryani.svg',
    title: 'Dindigul Biryani',
    subtitle: 'Seeraga Samba Chicken Pot',
    category: 'HOT MEAL',
    bg1: '#7c2d12',
    bg2: '#ea580c',
    accent: '#fbbf24',
    icon: '🍗',
  },
  {
    filename: 'ambur_biryani.svg',
    title: 'Ambur Dum Biryani',
    subtitle: 'Tender Mutton Biryani',
    category: 'HOT MEAL',
    bg1: '#831843',
    bg2: '#db2777',
    accent: '#fbcfe8',
    icon: '🥘',
  },
  {
    filename: 'chettinad_chicken.svg',
    title: 'Chettinad Chicken',
    subtitle: 'Spicy Pepper Masala Gravy',
    category: 'HOT MEAL',
    bg1: '#431407',
    bg2: '#9a3412',
    accent: '#fdba74',
    icon: '🍲',
  },
  {
    filename: 'paneer_parotta.svg',
    title: 'Paneer & Parotta',
    subtitle: 'Butter Masala with 3 Parottas',
    category: 'HOT MEAL',
    bg1: '#713f12',
    bg2: '#d97706',
    accent: '#fef08a',
    icon: '🫓',
  },
  {
    filename: 'ponni_rice.svg',
    title: 'Ponni Boiled Rice',
    subtitle: 'Organic Thanjavur Rice (2kg)',
    category: 'GROCERIES',
    bg1: '#064e3b',
    bg2: '#059669',
    accent: '#a7f3d0',
    icon: '🌾',
  },
  {
    filename: 'toor_dal.svg',
    title: 'Royal Toor Dal',
    subtitle: 'Unpolished Protein Dal (1kg)',
    category: 'GROCERIES',
    bg1: '#78350f',
    bg2: '#b45309',
    accent: '#fde68a',
    icon: '🥣',
  },
  {
    filename: 'sambar_powder.svg',
    title: 'Madras Sambar Podi',
    subtitle: 'Aromatic Spice Blend (200g)',
    category: 'GROCERIES',
    bg1: '#7f1d1d',
    bg2: '#dc2626',
    accent: '#fecaca',
    icon: '🌶️',
  },
  {
    filename: 'nilgiri_tea.svg',
    title: 'Nilgiri CTC Tea',
    subtitle: 'Fresh Hill Garden Dust (250g)',
    category: 'BEVERAGES',
    bg1: '#14532d',
    bg2: '#16a34a',
    accent: '#bbf7d0',
    icon: '🍵',
  },
  {
    filename: 'bhujia_sev.svg',
    title: 'Nagpur Bhujia Sev',
    subtitle: 'Crunchy Tepary Bean Snack (400g)',
    category: 'SNACKS',
    bg1: '#854d0e',
    bg2: '#ca8a04',
    accent: '#fef9c3',
    icon: '🥨',
  },
  {
    filename: 'tirunelveli_halwa.svg',
    title: 'Tirunelveli Halwa',
    subtitle: 'Desi Ghee Wheat Halwa (250g)',
    category: 'SWEETS',
    bg1: '#581c87',
    bg2: '#9333ea',
    accent: '#e9d5ff',
    icon: '🍮',
  },
  {
    filename: 'banana_chips.svg',
    title: 'Kerala Banana Chips',
    subtitle: 'Crisp Coconut Oil Nendran (200g)',
    category: 'SNACKS',
    bg1: '#713f12',
    bg2: '#eab308',
    accent: '#fef08a',
    icon: '🍌',
  },
  {
    filename: 'dolo_650.svg',
    title: 'Dolo-650 Tablets',
    subtitle: 'Paracetamol 650mg (15 Tabs)',
    category: 'MEDICINE',
    bg1: '#1e3a8a',
    bg2: '#2563eb',
    accent: '#bfdbfe',
    icon: '💊',
  },
  {
    filename: 'asthalin_inhaler.svg',
    title: 'Asthalin Inhaler',
    subtitle: 'Salbutamol 100mcg (200 Doses)',
    category: 'EMERGENCY MED',
    bg1: '#0e7490',
    bg2: '#06b6d4',
    accent: '#cffafe',
    icon: '🫁',
  },
  {
    filename: 'electral_ors.svg',
    title: 'Electral WHO ORS',
    subtitle: 'Oral Rehydration Pack (5x)',
    category: 'HEALTHCARE',
    bg1: '#047857',
    bg2: '#10b981',
    accent: '#a7f3d0',
    icon: '💧',
  },
  {
    filename: 'betadine_ointment.svg',
    title: 'Betadine Ointment',
    subtitle: 'Povidone Iodine 10% (20g)',
    category: 'FIRST AID',
    bg1: '#881337',
    bg2: '#e11d48',
    accent: '#fecdd3',
    icon: '🩹',
  },
  {
    filename: 'volini_spray.svg',
    title: 'Volini Pain Spray',
    subtitle: 'Rapid Joint & Muscle Relief (100g)',
    category: 'HEALTHCARE',
    bg1: '#1e1b4b',
    bg2: '#4f46e5',
    accent: '#c7d2fe',
    icon: '⚡',
  },
  {
    filename: 'omeprazole_capsules.svg',
    title: 'Omeprazole 20mg',
    subtitle: 'Delayed-Release Antacid (14 Caps)',
    category: 'MEDICINE',
    bg1: '#134e4a',
    bg2: '#14b8a6',
    accent: '#ccfbf1',
    icon: '💊',
  },
  {
    filename: 'glucose_strips.svg',
    title: 'Accu-Chek Strips',
    subtitle: 'Instant Blood Glucose (25 Strips)',
    category: 'DIAGNOSTICS',
    bg1: '#312e81',
    bg2: '#6366f1',
    accent: '#e0e7ff',
    icon: '🩸',
  },
  {
    filename: 'n95_masks.svg',
    title: 'N95 Respirators',
    subtitle: 'Surgical Filter Masks (Pack of 5)',
    category: 'PROTECTION',
    bg1: '#1f2937',
    bg2: '#4b5563',
    accent: '#e5e7eb',
    icon: '😷',
  },
  {
    filename: 'usbc_cable.svg',
    title: 'Braided USB-C Cable',
    subtitle: '100W Fast Power Delivery (2m)',
    category: 'TECH ACCESSORY',
    bg1: '#0f172a',
    bg2: '#0284c7',
    accent: '#bae6fd',
    icon: '🔌',
  },
  {
    filename: 'lightning_cable.svg',
    title: 'Apple Fast Cable',
    subtitle: 'MFi Lightning to USB-C (1.2m)',
    category: 'TECH ACCESSORY',
    bg1: '#1e293b',
    bg2: '#475569',
    accent: '#f1f5f9',
    icon: '⚡',
  },
  {
    filename: 'tws_earbuds.svg',
    title: 'TWS Air Earbuds',
    subtitle: 'Bluetooth 5.3 Low-Latency',
    category: 'AUDIO',
    bg1: '#18181b',
    bg2: '#3f3f46',
    accent: '#fafafa',
    icon: '🎧',
  },
  {
    filename: 'microsd_card.svg',
    title: 'SanDisk 128GB MicroSD',
    subtitle: '140MB/s A1 Class 10 Card',
    category: 'STORAGE',
    bg1: '#831843',
    bg2: '#be123c',
    accent: '#ffe4e6',
    icon: '💾',
  },
  {
    filename: 'dettol_liquid.svg',
    title: 'Dettol Antiseptic',
    subtitle: 'Germ Defense Liquid (250ml)',
    category: 'HYGIENE',
    bg1: '#14532d',
    bg2: '#15803d',
    accent: '#bbf7d0',
    icon: '🧴',
  },
  {
    filename: 'neem_facewash.svg',
    title: 'Himalaya Neem Wash',
    subtitle: 'Purifying Herbal Wash (150ml)',
    category: 'DAILY ESSENTIALS',
    bg1: '#064e3b',
    bg2: '#10b981',
    accent: '#d1fae5',
    icon: '🌿',
  },
  {
    filename: 'gillette_blades.svg',
    title: 'Gillette Fusion5',
    subtitle: 'Anti-Friction Cartridges (4-Pack)',
    category: 'GROOMING',
    bg1: '#0369a1',
    bg2: '#0284c7',
    accent: '#e0f2fe',
    icon: '🪒',
  },
];

function createSvg(item) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="100%" height="100%">
  <defs>
    <linearGradient id="grad-${item.filename}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${item.bg1}" />
      <stop offset="100%" stop-color="${item.bg2}" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="450" fill="url(#grad-${item.filename})" />

  <!-- Subtle background grid pattern -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="1.5">
    <line x1="0" y1="90" x2="600" y2="90" />
    <line x1="0" y1="180" x2="600" y2="180" />
    <line x1="0" y1="270" x2="600" y2="270" />
    <line x1="0" y1="360" x2="600" y2="360" />
    <line x1="120" y1="0" x2="120" y2="450" />
    <line x1="240" y1="0" x2="240" y2="450" />
    <line x1="360" y1="0" x2="360" y2="450" />
    <line x1="480" y1="0" x2="480" y2="450" />
  </g>

  <!-- Central Card -->
  <g filter="url(#shadow)">
    <rect x="70" y="55" width="460" height="340" rx="20" fill="rgba(15, 23, 42, 0.72)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1.5" />
  </g>

  <!-- Category Badge -->
  <g>
    <rect x="95" y="80" width="160" height="30" rx="8" fill="${item.accent}" />
    <text x="175" y="100" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="800" fill="#0f172a" text-anchor="middle" letter-spacing="1.2">
      ${item.category}
    </text>
  </g>

  <!-- Drone Delivery Badge -->
  <g>
    <rect x="360" y="80" width="145" height="30" rx="8" fill="rgba(255, 255, 255, 0.12)" stroke="rgba(255, 255, 255, 0.3)" />
    <text x="432" y="100" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="600" fill="#ffffff" text-anchor="middle">
      ⚡ DRONE READY
    </text>
  </g>

  <!-- Center Emoji / Icon -->
  <text x="300" y="225" font-size="76" text-anchor="middle" dominant-baseline="middle">
    ${item.icon}
  </text>

  <!-- Title -->
  <text x="300" y="305" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="800" fill="#ffffff" text-anchor="middle">
    ${item.title}
  </text>

  <!-- Subtitle -->
  <text x="300" y="340" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="500" fill="rgba(255, 255, 255, 0.75)" text-anchor="middle">
    ${item.subtitle}
  </text>

  <!-- Verified Safe Stamp -->
  <text x="300" y="372" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="${item.accent}" text-anchor="middle">
    ★ SkyNav Coimbatore Air-Corridor Certified
  </text>
</svg>
`;
}

const targetDirs = [
  path.resolve('apps/customer-web/public/images/products'),
  path.resolve('apps/admin-web/public/images/products'),
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  for (const item of items) {
    const filePath = path.join(dir, item.filename);
    fs.writeFileSync(filePath, createSvg(item), 'utf8');
  }
}

console.log(`Generated ${items.length} distinct product SVGs in ${targetDirs.length} directories.`);

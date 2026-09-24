const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../customer/frontend/src/services/mockData.ts');
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('export const INITIAL_PRODUCTS: Product[] = [');
const endIdx = content.indexOf('export const INITIAL_ORDERS: CustomerOrder[] = [');

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const replacement = `export const INITIAL_PRODUCTS: Product[] = MASTER_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  brand: p.brand,
  category: (['Food', 'Groceries', 'Medicine', 'Documents', 'Electronics', 'Other'].includes(p.categoryName)
    ? p.categoryName
    : (p.categoryId === 'cat_food' ? 'Food'
      : p.categoryId === 'cat_med' ? 'Medicine'
      : p.categoryId === 'cat_groc' ? 'Groceries'
      : p.categoryId === 'cat_elec' ? 'Electronics'
      : p.categoryId === 'cat_doc' ? 'Documents'
      : 'Other')) as any,
  category_id: p.categoryId,
  subCategory: p.subCategory,
  description: p.description,
  price: p.price,
  originalPrice: p.originalPrice,
  discountPercent: p.discountPercent,
  currency: p.currency || 'INR',
  rating: p.rating,
  reviewCount: p.reviewCount,
  image: p.image,
  images: p.images,
  isDroneEligible: p.isDroneEligible,
  maxPayloadKg: +(p.weightGrams / 1000).toFixed(2),
  estimatedDeliveryMins: p.deliveryMins,
  inStock: p.inStock,
  stockCount: p.stockCount,
  badge: p.badge,
  features: p.features,
  specifications: p.specs,
  dimensions: p.dimensions,
  weightGrams: p.weightGrams,
  weight: \`\${p.weightGrams}g\`,
  tags: p.tags,
}));

`;

const newContent = content.slice(0, startIdx) + replacement + content.slice(endIdx);
fs.writeFileSync(file, newContent, 'utf8');
console.log('Successfully updated mockData.ts with MASTER_PRODUCTS mapping.');

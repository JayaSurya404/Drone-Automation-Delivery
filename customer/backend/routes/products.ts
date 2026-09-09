import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db/database.js';

const router = Router();

// Helper to format database product row to frontend Product object
const formatProduct = (p: any, reviews: any[] = []) => {
  let images = [p.image];
  try {
    if (p.images_json) images = JSON.parse(p.images_json);
  } catch {}

  let features: string[] = [];
  try {
    if (p.features_json) features = JSON.parse(p.features_json);
  } catch {}

  let specifications: Record<string, string> = {};
  try {
    if (p.specifications_json) specifications = JSON.parse(p.specifications_json);
  } catch {}

  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category_slug || p.category_name,
    subCategory: p.sub_category,
    description: p.description,
    price: p.price,
    originalPrice: p.original_price,
    discountPercent: p.discount_percent,
    rating: p.rating,
    reviewCount: p.review_count,
    image: p.image,
    images,
    isDroneEligible: Boolean(p.is_drone_eligible),
    maxPayloadKg: p.max_payload_kg,
    estimatedDeliveryMins: p.estimated_delivery_mins,
    inStock: Boolean(p.in_stock && p.stock_count > 0),
    stockCount: p.stock_count,
    badge: p.badge,
    features,
    specifications,
    dimensions: p.dimensions,
    weightGrams: p.weight_grams,
    customerReviews: reviews.map((r) => ({
      id: r.id,
      author: r.author_name,
      avatar: r.author_avatar,
      rating: r.rating,
      date: r.created_at,
      title: r.title,
      comment: r.comment,
      verifiedPurchase: Boolean(r.verified_purchase),
      helpfulCount: r.helpful_count,
    })),
  };
};

// 1. GET ALL PRODUCTS WITH FILTERS, SEARCH, SORT, PAGINATION
router.get('/', (req: Request, res: Response): void => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      rating,
      droneOnly,
      deals,
      sort = 'popular',
      limit = 50,
      offset = 0,
    } = req.query;

    let sql = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Category filter (supports slug e.g. "Food" or "Medicine" or category ID)
    if (category && category !== 'All' && category !== 'all') {
      sql += ` AND (c.slug = ? OR c.id = ? OR c.name = ?)`;
      params.push(category, category, category);
    }

    // Search query
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      sql += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ? OR p.sub_category LIKE ?)`;
      params.push(term, term, term, term);
    }

    // Price range
    if (minPrice) {
      sql += ` AND p.price >= ?`;
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      sql += ` AND p.price <= ?`;
      params.push(Number(maxPrice));
    }

    // Rating filter
    if (rating) {
      sql += ` AND p.rating >= ?`;
      params.push(Number(rating));
    }

    // Drone eligibility
    if (droneOnly === 'true' || droneOnly === '1') {
      sql += ` AND p.is_drone_eligible = 1`;
    }

    // Deals filter
    if (deals === 'true' || deals === '1') {
      sql += ` AND p.discount_percent > 0`;
    }

    // Sorting
    switch (sort) {
      case 'newest':
        sql += ` ORDER BY p.created_at DESC`;
        break;
      case 'price_asc':
      case 'price-asc':
        sql += ` ORDER BY p.price ASC`;
        break;
      case 'price_desc':
      case 'price-desc':
        sql += ` ORDER BY p.price DESC`;
        break;
      case 'rating':
        sql += ` ORDER BY p.rating DESC, p.review_count DESC`;
        break;
      case 'speed':
        sql += ` ORDER BY p.estimated_delivery_mins ASC`;
        break;
      case 'popular':
      default:
        sql += ` ORDER BY p.review_count DESC, p.rating DESC`;
        break;
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = queryAll<any>(sql, params);
    const products = rows.map((p) => formatProduct(p));

    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products from database.' });
  }
});

// 2. GET SINGLE PRODUCT BY ID OR SLUG
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const productRow = queryOne<any>(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? OR p.slug = ?
    `, [id, id]);

    if (!productRow) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    // Fetch verified customer reviews for this product
    const reviews = queryAll<any>(`
      SELECT * FROM reviews
      WHERE product_id = ?
      ORDER BY created_at DESC
    `, [productRow.id]);

    const product = formatProduct(productRow, reviews);
    res.json(product);
  } catch (err) {
    console.error('Error fetching product detail:', err);
    res.status(500).json({ error: 'Failed to fetch product details.' });
  }
});

export default router;

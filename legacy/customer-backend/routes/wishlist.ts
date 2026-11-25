import { Router, Response } from 'express';
import { queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Helper to format product
const formatProduct = (p: any) => ({
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
  isDroneEligible: Boolean(p.is_drone_eligible),
  maxPayloadKg: p.max_payload_kg,
  estimatedDeliveryMins: p.estimated_delivery_mins,
  inStock: Boolean(p.in_stock && p.stock_count > 0),
  stockCount: p.stock_count,
  weightGrams: p.weight_grams,
  badge: p.badge,
});

// 1. GET WISHLIST (AUTHENTICATED)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    let wishlist = queryOne<any>('SELECT id FROM wishlists WHERE customer_id = ?', [userId]);
    if (!wishlist) {
      const newWishlistId = `wish_${userId}`;
      runCommand('INSERT INTO wishlists (id, customer_id) VALUES (?, ?)', [newWishlistId, userId]);
      wishlist = { id: newWishlistId };
    }

    const rows = queryAll<any>(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM wishlist_items wi
      JOIN products p ON p.id = wi.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE wi.wishlist_id = ?
      ORDER BY wi.created_at DESC
    `, [wishlist.id]);

    const items = rows.map((r) => formatProduct(r));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wishlist.' });
  }
});

// 2. ADD PRODUCT TO WISHLIST (AUTHENTICATED)
router.post('/:productId', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { productId } = req.params;
    const userId = req.user!.id;

    const product = queryOne<any>('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    let wishlist = queryOne<any>('SELECT id FROM wishlists WHERE customer_id = ?', [userId]);
    if (!wishlist) {
      const newWishlistId = `wish_${userId}`;
      runCommand('INSERT INTO wishlists (id, customer_id) VALUES (?, ?)', [newWishlistId, userId]);
      wishlist = { id: newWishlistId };
    }

    runCommand(`
      INSERT OR IGNORE INTO wishlist_items (id, wishlist_id, product_id)
      VALUES (?, ?, ?)
    `, [`wi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, wishlist.id, productId]);

    res.json({ success: true, message: 'Added to wishlist.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item to wishlist.' });
  }
});

// 3. REMOVE PRODUCT FROM WISHLIST (AUTHENTICATED)
router.delete('/:productId', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { productId } = req.params;
    const userId = req.user!.id;

    const wishlist = queryOne<any>('SELECT id FROM wishlists WHERE customer_id = ?', [userId]);
    if (wishlist) {
      runCommand('DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?', [wishlist.id, productId]);
    }

    res.json({ success: true, message: 'Removed from wishlist.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item from wishlist.' });
  }
});

export default router;

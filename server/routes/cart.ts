import { Router, Response } from 'express';
import { db, queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Helper to calculate server-authoritative cart totals
const computeCartDetails = (userId: string, promoCode?: string | null, deliverySpeed: string = 'standard') => {
  // Ensure cart exists
  let cart = queryOne<any>('SELECT id FROM carts WHERE customer_id = ?', [userId]);
  if (!cart) {
    const newCartId = `cart_${userId}`;
    runCommand('INSERT OR IGNORE INTO carts (id, customer_id) VALUES (?, ?)', [newCartId, userId]);
    cart = { id: newCartId };
  }

  // Get items with real DB product data
  const rows = queryAll<any>(`
    SELECT ci.quantity, ci.id as cart_item_id, p.*, c.name as category_name, c.slug as category_slug
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE ci.cart_id = ?
    ORDER BY ci.created_at ASC
  `, [cart.id]);

  const items = rows.map((r) => ({
    product: {
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category_slug || r.category_name,
      subCategory: r.sub_category,
      description: r.description,
      price: r.price,
      originalPrice: r.original_price,
      discountPercent: r.discount_percent,
      rating: r.rating,
      reviewCount: r.review_count,
      image: r.image,
      isDroneEligible: Boolean(r.is_drone_eligible),
      maxPayloadKg: r.max_payload_kg,
      estimatedDeliveryMins: r.estimated_delivery_mins,
      inStock: Boolean(r.in_stock && r.stock_count > 0),
      stockCount: r.stock_count,
      weightGrams: r.weight_grams,
      badge: r.badge,
    },
    quantity: r.quantity,
  }));

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalWeightGrams = items.reduce((sum, i) => sum + i.product.weightGrams * i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  // Dynamic drone delivery fee
  let baseDeliveryFee = items.length > 0 ? 3.99 : 0;
  if (deliverySpeed === 'express') baseDeliveryFee += 3.50;
  if (totalWeightGrams > 1500) baseDeliveryFee += 2.00; // Payload surcharge

  const deliveryFee = parseFloat(baseDeliveryFee.toFixed(2));

  // Server-side promo calculation
  let promoDiscountPct = 0;
  let validPromo: string | null = null;

  if (promoCode) {
    const clean = promoCode.trim().toUpperCase();
    if (clean === 'DRONE10' || clean === 'SKYFIRST') {
      promoDiscountPct = 10;
      validPromo = clean;
    } else if (clean === 'AERO20' && subtotal >= 50) {
      promoDiscountPct = 20;
      validPromo = clean;
    }
  }

  const discount = parseFloat(((subtotal * promoDiscountPct) / 100).toFixed(2));
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = items.length > 0 ? parseFloat((taxableAmount * 0.085).toFixed(2)) : 0;
  const total = items.length > 0 ? parseFloat((taxableAmount + deliveryFee + tax).toFixed(2)) : 0;

  return {
    items,
    itemCount,
    totalWeightGrams,
    subtotal: parseFloat(subtotal.toFixed(2)),
    deliveryFee,
    tax,
    discount,
    total,
    appliedPromo: validPromo,
    deliverySpeed,
  };
};

// 1. GET CART (AUTHENTICATED)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { promo, speed } = req.query;
    const cartData = computeCartDetails(req.user!.id, promo as string, speed as string);
    res.json(cartData);
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart.' });
  }
});

// 2. ADD ITEM TO CART (AUTHENTICATED)
router.post('/items', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user!.id;

    if (!productId) {
      res.status(400).json({ error: 'Product ID is required.' });
      return;
    }

    // Verify product exists and check stock in DB
    const product = queryOne<any>('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    if (product.stock_count < 1 || !product.in_stock) {
      res.status(400).json({ error: 'This item is currently out of stock.' });
      return;
    }

    // Ensure cart exists
    let cart = queryOne<any>('SELECT id FROM carts WHERE customer_id = ?', [userId]);
    if (!cart) {
      const newCartId = `cart_${userId}`;
      runCommand('INSERT INTO carts (id, customer_id) VALUES (?, ?)', [newCartId, userId]);
      cart = { id: newCartId };
    }

    db.transaction(() => {
      const existing = queryOne<any>(
        'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cart.id, productId]
      );

      if (existing) {
        const newQty = existing.quantity + Number(quantity);
        if (newQty > product.stock_count) {
          throw new Error(`Only ${product.stock_count} units available in stock.`);
        }
        runCommand(
          "UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?",
          [newQty, existing.id]
        );
      } else {
        if (Number(quantity) > product.stock_count) {
          throw new Error(`Only ${product.stock_count} units available in stock.`);
        }
        runCommand(
          'INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)',
          [`ci_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, cart.id, productId, Number(quantity)]
        );
      }
    })();

    const cartData = computeCartDetails(userId);
    res.json(cartData);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to add item to cart.' });
  }
});

// 3. UPDATE ITEM QUANTITY (AUTHENTICATED)
router.patch('/items/:productId', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user!.id;

    const cart = queryOne<any>('SELECT id FROM carts WHERE customer_id = ?', [userId]);
    if (!cart) {
      res.status(404).json({ error: 'Cart not found.' });
      return;
    }

    if (Number(quantity) <= 0) {
      runCommand('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, productId]);
    } else {
      const product = queryOne<any>('SELECT stock_count FROM products WHERE id = ?', [productId]);
      if (product && Number(quantity) > product.stock_count) {
        res.status(400).json({ error: `Cannot exceed available stock (${product.stock_count}).` });
        return;
      }

      runCommand(
        "UPDATE cart_items SET quantity = ?, updated_at = datetime('now') WHERE cart_id = ? AND product_id = ?",
        [Number(quantity), cart.id, productId]
      );
    }

    const cartData = computeCartDetails(userId);
    res.json(cartData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item quantity.' });
  }
});

// 4. REMOVE ITEM FROM CART (AUTHENTICATED)
router.delete('/items/:productId', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { productId } = req.params;
    const userId = req.user!.id;

    const cart = queryOne<any>('SELECT id FROM carts WHERE customer_id = ?', [userId]);
    if (cart) {
      runCommand('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, productId]);
    }

    const cartData = computeCartDetails(userId);
    res.json(cartData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item.' });
  }
});

// 5. CLEAR CART (AUTHENTICATED)
router.delete('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const cart = queryOne<any>('SELECT id FROM carts WHERE customer_id = ?', [userId]);
    if (cart) {
      runCommand('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    }

    res.json(computeCartDetails(userId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear cart.' });
  }
});

// 6. APPLY PROMO CODE (AUTHENTICATED)
router.post('/promo', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  const { code } = req.body;
  const userId = req.user!.id;

  if (!code) {
    res.status(400).json({ error: 'Promo code is required.' });
    return;
  }

  const clean = code.trim().toUpperCase();
  const cartData = computeCartDetails(userId, clean);

  if (cartData.appliedPromo) {
    res.json({
      success: true,
      message: `${clean === 'AERO20' ? '20% VIP' : '10%'} aerial discount applied!`,
      cart: cartData,
    });
  } else {
    res.status(400).json({
      success: false,
      error: clean === 'AERO20' ? 'AERO20 requires minimum subtotal of $50.' : 'Invalid promo code. Try "DRONE10" or "SKYFIRST".',
    });
  }
});

export default router;

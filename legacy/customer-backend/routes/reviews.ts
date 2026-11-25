import { Router, Response } from 'express';
import { db, queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// 1. GET REVIEWS FOR A PRODUCT
router.get('/:productId', (req, res): void => {
  try {
    const { productId } = req.params;
    const reviews = queryAll<any>(`
      SELECT * FROM reviews
      WHERE product_id = ?
      ORDER BY created_at DESC
    `, [productId]);

    const formatted = reviews.map((r) => ({
      id: r.id,
      author: r.author_name,
      avatar: r.author_avatar,
      rating: r.rating,
      date: r.created_at,
      title: r.title,
      comment: r.comment,
      verifiedPurchase: Boolean(r.verified_purchase),
      helpfulCount: r.helpful_count,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// 2. SUBMIT REVIEW (AUTHENTICATED)
router.post('/:productId', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { productId } = req.params;
    const { rating, title, comment, orderId } = req.body;
    const userId = req.user!.id;
    const userName = req.user!.name;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      res.status(400).json({ error: 'Please provide a valid rating between 1 and 5 stars.' });
      return;
    }

    if (!comment || comment.trim().length === 0) {
      res.status(400).json({ error: 'Please write your review comment.' });
      return;
    }

    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    db.transaction(() => {
      runCommand(`
        INSERT INTO reviews (id, product_id, customer_id, order_id, author_name, author_avatar, rating, title, comment, verified_purchase)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        reviewId,
        productId,
        userId,
        orderId || null,
        userName,
        null,
        Number(rating),
        title || 'Customer Review',
        comment.trim(),
      ]);

      // Recompute and update product rating and review count
      const stats = queryOne<any>(`
        SELECT AVG(rating) as avg_rating, COUNT(id) as count
        FROM reviews
        WHERE product_id = ?
      `, [productId]);

      if (stats) {
        runCommand(`
          UPDATE products SET
            rating = ?,
            review_count = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `, [parseFloat(Number(stats.avg_rating).toFixed(2)), stats.count, productId]);
      }
    })();

    res.status(201).json({ success: true, message: 'Review submitted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

export default router;

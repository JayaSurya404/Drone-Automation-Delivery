import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db/database.js';

const router = Router();

// 1. GET ALL CATEGORIES WITH DYNAMIC PRODUCT COUNT
router.get('/', (req: Request, res: Response): void => {
  try {
    const categories = queryAll<any>(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.display_order ASC
    `);

    const formatted = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      icon: c.icon,
      productCount: c.product_count,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// 2. GET CATEGORY BY SLUG
router.get('/:slug', (req: Request, res: Response): void => {
  try {
    const { slug } = req.params;
    const category = queryOne<any>(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      WHERE c.slug = ? OR c.id = ?
      GROUP BY c.id
    `, [slug, slug]);

    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    res.json({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      icon: category.icon,
      productCount: category.product_count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch category details.' });
  }
});

export default router;

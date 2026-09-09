import { Router, Request, Response } from 'express';
import { queryAll, queryOne, runCommand } from '../db/database.js';
import { customerIntegrationClient } from '../services/customerIntegrationClient.js';
import { SharedProduct } from '../../../shared/contracts/types.js';

const router = Router();

// GET all products
router.get('/', (req: Request, res: Response) => {
  try {
    const products = queryAll<any>(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC
    `);
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET categories
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = queryAll('SELECT * FROM categories ORDER BY display_order ASC');
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE Product (Admin Source of Truth -> Syncs to Customer Backend)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      slug,
      brand,
      categoryId,
      subCategory,
      description,
      price,
      stockCount,
      weightGrams,
      isDroneEligible,
      image,
      badge,
    } = req.body;

    const rawCat = categoryId || req.body.category_id || req.body.category;
    let resolvedCategoryId = 'cat_med';
    if (rawCat) {
      const foundCat = queryOne<any>('SELECT id FROM categories WHERE id = ? OR slug = ? OR name = ?', [rawCat, rawCat, rawCat]);
      if (foundCat) resolvedCategoryId = foundCat.id;
      else resolvedCategoryId = rawCat;
    }

    if (!name || !price || !rawCat) {
      res.status(400).json({ error: 'Name, price, and category are required.' });
      return;
    }

    const finalCategoryId = resolvedCategoryId;

    const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const prodSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    runCommand(`
      INSERT INTO products (
        id, name, slug, brand, category_id, sub_category, description,
        price, stock_count, weight_grams, is_drone_eligible, is_active, image, badge
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      id,
      name,
      prodSlug,
      brand || 'SkyNav Direct',
      finalCategoryId,
      subCategory || 'General',
      description || '',
      parseFloat(price),
      parseInt(stockCount) || 50,
      parseInt(weightGrams) || 350,
      isDroneEligible !== false ? 1 : 0,
      image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600',
      badge || null,
    ]);

    const created = queryOne<any>('SELECT p.*, c.name as category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?', [id]);

    const sharedProduct: SharedProduct = {
      id: created.id,
      name: created.name,
      slug: created.slug,
      brand: created.brand,
      categoryId: created.category_id,
      categoryName: created.category_name,
      subCategory: created.sub_category,
      description: created.description,
      price: created.price,
      stockCount: created.stock_count,
      weightGrams: created.weight_grams,
      isDroneEligible: Boolean(created.is_drone_eligible),
      image: created.image,
      badge: created.badge,
      inStock: created.stock_count > 0,
    };

    // Synchronize to Customer Backend
    await customerIntegrationClient.syncProduct({
      action: 'create',
      product: sharedProduct,
    });

    res.status(201).json(created);
  } catch (err: any) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE Product
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      price,
      stockCount,
      weightGrams,
      isDroneEligible,
      isActive,
      description,
      badge,
    } = req.body;

    runCommand(`
      UPDATE products SET
        name = COALESCE(?, name),
        price = COALESCE(?, price),
        stock_count = COALESCE(?, stock_count),
        weight_grams = COALESCE(?, weight_grams),
        is_drone_eligible = COALESCE(?, is_drone_eligible),
        is_active = COALESCE(?, is_active),
        description = COALESCE(?, description),
        badge = COALESCE(?, badge),
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      name,
      price !== undefined ? parseFloat(price) : null,
      stockCount !== undefined ? parseInt(stockCount) : null,
      weightGrams !== undefined ? parseInt(weightGrams) : null,
      isDroneEligible !== undefined ? (isDroneEligible ? 1 : 0) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      description,
      badge,
      id,
    ]);

    const updated = queryOne<any>('SELECT p.*, c.name as category_name FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?', [id]);
    if (!updated) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const sharedProduct: SharedProduct = {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      brand: updated.brand,
      categoryId: updated.category_id,
      categoryName: updated.category_name,
      subCategory: updated.sub_category,
      description: updated.description,
      price: updated.price,
      stockCount: updated.stock_count,
      weightGrams: updated.weight_grams,
      isDroneEligible: Boolean(updated.is_drone_eligible),
      image: updated.image,
      badge: updated.badge,
      inStock: updated.stock_count > 0,
    };

    // Synchronize to Customer Backend
    await customerIntegrationClient.syncProduct({
      action: 'update',
      product: sharedProduct,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ARCHIVE / DELETE Product
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const prod = queryOne<any>('SELECT * FROM products WHERE id = ?', [id]);
    if (!prod) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    runCommand('UPDATE products SET is_active = 0, stock_count = 0 WHERE id = ?', [id]);

    await customerIntegrationClient.syncProduct({
      action: 'delete',
      product: {
        id: prod.id,
        name: prod.name,
        slug: prod.slug,
        brand: prod.brand,
        categoryId: prod.category_id,
        categoryName: 'General',
        subCategory: prod.sub_category,
        description: prod.description,
        price: prod.price,
        stockCount: 0,
        weightGrams: prod.weight_grams,
        isDroneEligible: Boolean(prod.is_drone_eligible),
        image: prod.image,
        inStock: false,
      },
    });

    res.json({ success: true, message: 'Product archived and removed from customer catalog.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

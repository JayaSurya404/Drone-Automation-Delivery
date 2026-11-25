import { Router, Response } from 'express';
import { db, queryAll, queryOne, runCommand } from '../db/database.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const formatAddress = (a: any) => ({
  id: a.id,
  customerId: a.customer_id,
  label: a.label,
  name: a.name,
  phone: a.phone,
  building: a.building,
  street: a.street,
  area: a.area,
  city: a.city,
  state: a.state,
  postalCode: a.postal_code,
  latitude: a.latitude,
  longitude: a.longitude,
  instructions: a.instructions,
  isDefault: Boolean(a.is_default),
  dropZoneType: a.drop_zone_type,
});

// 1. GET ALL ADDRESSES (AUTHENTICATED)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const rows = queryAll<any>(
      'SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    res.json(rows.map(formatAddress));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved addresses.' });
  }
});

// 2. SAVE NEW ADDRESS (AUTHENTICATED)
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user!.id;
    const {
      label = 'Home',
      name,
      phone,
      building,
      street,
      area,
      city,
      state,
      postalCode,
      latitude,
      longitude,
      instructions,
      isDefault,
      dropZoneType = 'Lawn',
    } = req.body;

    if (!name || !phone || !street || !city || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: 'Please provide all required address fields and delivery coordinates.' });
      return;
    }

    const addrId = `addr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    db.transaction(() => {
      if (isDefault) {
        runCommand('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', [userId]);
      }

      runCommand(`
        INSERT INTO addresses (
          id, customer_id, label, name, phone, building, street, area, city, state,
          postal_code, latitude, longitude, instructions, is_default, drop_zone_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        addrId,
        userId,
        label,
        name.trim(),
        phone.trim(),
        building || '',
        street.trim(),
        area || '',
        city.trim(),
        state || 'CA',
        postalCode || '94107',
        Number(latitude),
        Number(longitude),
        instructions || '',
        isDefault ? 1 : 0,
        dropZoneType,
      ]);
    })();

    const created = queryOne<any>('SELECT * FROM addresses WHERE id = ?', [addrId]);
    res.status(201).json(formatAddress(created));
  } catch (err: any) {
    console.error('Save address error:', err);
    res.status(500).json({ error: 'Failed to save address.' });
  }
});

// 3. UPDATE ADDRESS (AUTHENTICATED)
router.put('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = queryOne<any>('SELECT * FROM addresses WHERE id = ? AND customer_id = ?', [id, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Address not found.' });
      return;
    }

    const {
      label,
      name,
      phone,
      building,
      street,
      area,
      city,
      state,
      postalCode,
      latitude,
      longitude,
      instructions,
      isDefault,
      dropZoneType,
    } = req.body;

    db.transaction(() => {
      if (isDefault) {
        runCommand('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', [userId]);
      }

      runCommand(`
        UPDATE addresses SET
          label = COALESCE(?, label),
          name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          building = COALESCE(?, building),
          street = COALESCE(?, street),
          area = COALESCE(?, area),
          city = COALESCE(?, city),
          state = COALESCE(?, state),
          postal_code = COALESCE(?, postal_code),
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          instructions = COALESCE(?, instructions),
          is_default = COALESCE(?, is_default),
          drop_zone_type = COALESCE(?, drop_zone_type),
          updated_at = datetime('now')
        WHERE id = ? AND customer_id = ?
      `, [
        label || null,
        name || null,
        phone || null,
        building !== undefined ? building : null,
        street || null,
        area !== undefined ? area : null,
        city || null,
        state || null,
        postalCode || null,
        latitude !== undefined ? Number(latitude) : null,
        longitude !== undefined ? Number(longitude) : null,
        instructions !== undefined ? instructions : null,
        isDefault !== undefined ? (isDefault ? 1 : 0) : null,
        dropZoneType || null,
        id,
        userId,
      ]);
    })();

    const updated = queryOne<any>('SELECT * FROM addresses WHERE id = ?', [id]);
    res.json(formatAddress(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update address.' });
  }
});

// 4. DELETE ADDRESS (AUTHENTICATED)
router.delete('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    runCommand('DELETE FROM addresses WHERE id = ? AND customer_id = ?', [id, userId]);
    res.json({ success: true, message: 'Address removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete address.' });
  }
});

// 5. SET DEFAULT ADDRESS (AUTHENTICATED)
router.patch('/:id/default', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    db.transaction(() => {
      runCommand('UPDATE addresses SET is_default = 0 WHERE customer_id = ?', [userId]);
      runCommand('UPDATE addresses SET is_default = 1 WHERE id = ? AND customer_id = ?', [id, userId]);
    })();

    const updated = queryOne<any>('SELECT * FROM addresses WHERE id = ?', [id]);
    res.json(formatAddress(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to set default address.' });
  }
});

export default router;

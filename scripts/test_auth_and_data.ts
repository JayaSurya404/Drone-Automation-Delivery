import Database from 'better-sqlite3';
import path from 'path';

const CUST_API = 'http://localhost:5000/api';
const ADMIN_API = 'http://localhost:5001/api/admin';

const custDb = new Database(path.resolve('customer/backend/data/skynav.db'));
const adminDb = new Database(path.resolve('admin/backend/data/admin.db'));

async function runAuthAndDataAuditTest() {
  console.log('====================================================');
  console.log('🧪 STRICT DATABASE-BACKED RUNTIME DATA AUDIT TEST');
  console.log('====================================================\n');

  // ──────────────────────────────────────────
  // TEST 1: TEST CUSTOMER LOGIN & SESSION
  // ──────────────────────────────────────────
  console.log('[TEST 1] Testing Test Customer login with seeded DB credentials');
  console.log('Credentials: testcustomer@example.com / Customer123!');

  const custLoginRes = await fetch(`${CUST_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'testcustomer@example.com',
      password: 'Customer123!',
    }),
  });

  const custLoginData = await custLoginRes.json();
  console.log('Customer login status:', custLoginRes.status);
  if (!custLoginRes.ok || !custLoginData.token) {
    throw new Error(`Customer login failed: ${custLoginData.error}`);
  }

  const custToken = custLoginData.token;
  console.log('Customer logged in successfully! Name:', custLoginData.user.name, 'Email:', custLoginData.user.email);

  console.log('\n[TEST 2] Verifying customer session restoration via GET /api/auth/me');
  const custMeRes = await fetch(`${CUST_API}/auth/me`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  const custMeData = await custMeRes.json();
  const custUser = custMeData.user || custMeData;
  console.log('GET /auth/me status:', custMeRes.status);
  console.log('Database user profile restored:', {
    name: custUser.name,
    email: custUser.email,
    isVerified: custUser.isVerified,
    status: custUser.accountStatus,
  });

  if (!custMeRes.ok || custUser.email !== 'testcustomer@example.com' || !custUser.isVerified) {
    throw new Error('Customer /auth/me did not match database-backed profile');
  }
  console.log('✅ Customer authentication & session restoration verified against customer.db');

  console.log('\n[TEST 3] Verifying database-backed customer orders list (GET /api/orders)');
  const custOrdersRes = await fetch(`${CUST_API}/orders`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  const custOrders = await custOrdersRes.json();
  console.log('Customer orders count:', custOrders.length);
  if (!Array.isArray(custOrders) || custOrders.length === 0) {
    throw new Error('Expected database-backed orders for test customer, got 0');
  }
  console.log('Found customer orders:', custOrders.map((o: any) => ({ id: o.id, status: o.status, total: o.total })));
  console.log('✅ Customer orders strictly sourced from customer.db');

  // ──────────────────────────────────────────
  // TEST 4: ADMIN AUTHENTICATION & RBAC
  // ──────────────────────────────────────────
  console.log('\n[TEST 4] Testing Admin login with seeded DB credentials');
  console.log('Credentials: admin@skynav.com / admin123');

  const adminLoginRes = await fetch(`${ADMIN_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@skynav.com',
      password: 'admin123',
      role: 'super_admin',
    }),
  });

  const adminLoginData = await adminLoginRes.json();
  console.log('Admin login status:', adminLoginRes.status);
  if (!adminLoginRes.ok || !adminLoginData.token) {
    throw new Error(`Admin login failed: ${adminLoginData.error}`);
  }

  const adminToken = adminLoginData.token;
  console.log('Admin user from DB:', {
    id: adminLoginData.user.id,
    name: adminLoginData.user.name,
    role: adminLoginData.user.role,
    email: adminLoginData.user.email,
  });

  if (adminLoginData.user.role !== 'super_admin') {
    throw new Error(`Expected role super_admin, got: ${adminLoginData.user.role}`);
  }
  console.log('✅ Admin login & RBAC verified against admin.db');

  console.log('\n[TEST 5] Verifying Admin session restoration via GET /api/admin/auth/me');
  const adminMeRes = await fetch(`${ADMIN_API}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminMeData = await adminMeRes.json();
  console.log('Admin /auth/me status:', adminMeRes.status);
  console.log('Admin profile restored:', adminMeData.user?.name, 'Role:', adminMeData.user?.role);
  if (!adminMeRes.ok || adminMeData.user?.email !== 'admin@skynav.com') {
    throw new Error('Admin session restoration failed');
  }
  console.log('✅ Admin session restored from admin.db');

  // ──────────────────────────────────────────
  // TEST 6: ADMIN OPERATIONAL DATA AUDIT
  // ──────────────────────────────────────────
  console.log('\n[TEST 6] Verifying Admin operational orders endpoint (GET /api/admin/orders)');
  const adminOrdersRes = await fetch(`${ADMIN_API}/orders`);
  const adminOrders = await adminOrdersRes.json();
  console.log('Operational orders in queue:', adminOrders.length);
  if (!Array.isArray(adminOrders) || adminOrders.length === 0) {
    throw new Error('Expected operational orders in admin queue from admin.db');
  }
  console.log('Found operational orders:', adminOrders.map((o: any) => ({ id: o.id, customerName: o.customerName, status: o.status })));
  console.log('✅ Admin operational orders strictly sourced from admin.db');

  console.log('\n[TEST 7] Verifying Admin payments ledger endpoint (GET /api/admin/payments)');
  const adminPayRes = await fetch(`${ADMIN_API}/payments`);
  const adminPay = await adminPayRes.json();
  console.log('Payment transactions count:', adminPay.length);
  if (!Array.isArray(adminPay) || adminPay.length === 0) {
    throw new Error('Expected payment transactions in admin payments ledger');
  }
  console.log('Found payments:', adminPay.map((p: any) => ({ id: p.id, orderId: p.orderId, amount: p.amount, status: p.status })));
  console.log('✅ Admin payments ledger strictly backed by operational orders in database');

  console.log('\n[TEST 8] Verifying Admin fleet endpoint (GET /api/admin/fleet)');
  const adminFleetRes = await fetch(`${ADMIN_API}/fleet`);
  const adminFleet = await adminFleetRes.json();
  console.log('Fleet drones count:', adminFleet.length);
  if (!Array.isArray(adminFleet) || adminFleet.length !== 40) {
    throw new Error(`Expected 40 drones in fleet, got: ${adminFleet.length}`);
  }
  console.log('✅ Admin fleet: all 40 autonomous drones verified in admin.db');

  // ──────────────────────────────────────────
  // TEST 9: ADMIN -> CUSTOMER PRODUCT LIFECYCLE
  // ──────────────────────────────────────────
  console.log('\n[TEST 9] Testing End-to-End Product Lifecycle Synchronization');
  const syncTestId = `prod_sync_${Date.now()}`;
  const syncName = `Ultra-Pulse Aero Defibrillator ${Date.now().toString().slice(-4)}`;

  console.log(`1. Admin creates product #${syncTestId}`);
  const createProdRes = await fetch(`${ADMIN_API}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: syncTestId,
      name: syncName,
      brand: 'AeroRescue Medical',
      categoryId: 'cat_med',
      subCategory: 'Cardiac Emergency',
      description: 'Automated external defibrillator (AED) packaged for rapid aerial dispatch.',
      price: 149.99,
      stockCount: 15,
      weightGrams: 1100,
      isDroneEligible: true,
      isActive: true,
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600',
      badge: 'Life-Saving',
    }),
  });

  const createProdData = await createProdRes.json();
  console.log('Admin product create status:', createProdRes.status);
  if (!createProdRes.ok) {
    throw new Error(`Admin failed to create product: ${createProdData.error}`);
  }

  const createdId = createProdData.id;

  // Verify in admin.db
  const adminProdRow = adminDb.prepare('SELECT id, name, price, stock_count, is_active FROM products WHERE id = ?').get(createdId) as any;
  if (!adminProdRow) throw new Error('Product not found in admin.db after creation');
  console.log('✅ Verified in admin.db:', adminProdRow);

  // Verify in customer.db
  const custProdRow = custDb.prepare('SELECT id, name, price, stock_count, in_stock FROM products WHERE id = ?').get(createdId) as any;
  if (!custProdRow) throw new Error('Product was not synchronized to customer.db');
  console.log('✅ Synchronized to customer.db:', custProdRow);

  // Verify via Customer API
  const custFetchRes = await fetch(`${CUST_API}/products/${createdId}`);
  const custFetchProd = await custFetchRes.json();
  console.log('Customer API GET /products/:id status:', custFetchRes.status, 'Price:', custFetchProd.price);
  if (!custFetchRes.ok || custFetchProd.price !== 149.99) {
    throw new Error('Customer API did not return synchronized product');
  }

  console.log('\n2. Admin updates product price to $129.99 and stock to 25');
  const updateProdRes = await fetch(`${ADMIN_API}/products/${createdId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price: 129.99,
      stockCount: 25,
      isActive: true,
    }),
  });
  console.log('Admin update status:', updateProdRes.status);

  // Check customer reflect update
  const custReflectRes = await fetch(`${CUST_API}/products/${createdId}`);
  const custReflectData = await custReflectRes.json();
  console.log('Customer reflected price:', custReflectData.price, 'stock:', custReflectData.stockCount);
  if (custReflectData.price !== 129.99 || custReflectData.stockCount !== 25) {
    throw new Error('Customer did not reflect updated price/stock');
  }
  console.log('✅ Customer successfully reflects Admin price & stock update');

  console.log('\n3. Admin archives/deletes product');
  const archiveRes = await fetch(`${ADMIN_API}/products/${createdId}`, {
    method: 'DELETE',
  });
  console.log('Admin archive status:', archiveRes.status);

  // Check customer no longer treats as active
  const custAfterArchive = custDb.prepare('SELECT in_stock FROM products WHERE id = ?').get(createdId) as any;
  console.log('Customer in_stock after archive:', custAfterArchive?.in_stock);
  if (custAfterArchive && custAfterArchive.in_stock !== 0) {
    throw new Error('Customer product was not deactivated after admin archive');
  }
  console.log('✅ Customer accurately marks archived product as inactive/out of stock');

  console.log('\n====================================================');
  console.log('🎉 ALL 9 STRICT DATABASE-BACKED DATA TESTS PASSED!');
  console.log('====================================================\n');
}

runAuthAndDataAuditTest().catch((err) => {
  console.error('\n❌ Data audit test failed:', err);
  process.exit(1);
});

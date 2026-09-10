import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const CUST_API = 'http://localhost:5000/api';
const dbPath = path.resolve('customer/backend/data/skynav.db');
const db = new Database(dbPath);

async function runCustomerAuthFlowTest() {
  console.log('====================================================');
  console.log('🧪 INSTANT CUSTOMER SIGNUP & DIRECT LOGIN TEST');
  console.log('====================================================');

  const uniqueId = Date.now();
  const testEmail = `instant.customer.${uniqueId}@skynav.io`;
  const testName = `Aero Voyager ${uniqueId.toString().slice(-4)}`;
  const testPhone = '+1 (555) 349-8800';
  const testPassword = 'Password123!';

  console.log(`\n[STEP 1] Registering brand new customer: ${testEmail}`);
  const startTime = Date.now();
  const regRes = await fetch(`${CUST_API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      confirmPassword: testPassword,
      acceptTerms: true,
    }),
  });

  const durationMs = Date.now() - startTime;
  const regData = await regRes.json();
  console.log(`Registration response status: ${regRes.status} (took ${durationMs}ms)`);
  console.log('Registration response body:', JSON.stringify(regData, null, 2));

  if (!regRes.ok || !regData.token) {
    throw new Error(`Registration failed: ${regData.error || 'Expected token in response'}`);
  }
  if (regData.requiresVerification) {
    throw new Error('Expected requiresVerification: false (email verification should be bypassed)');
  }
  if (!regData.user || !regData.user.isVerified) {
    throw new Error('Expected user.isVerified to be true');
  }

  console.log('✅ Instant registration succeeded without email verification blocking!');

  console.log('\n[STEP 2] Verifying user record in customer.db');
  const userRow = db.prepare('SELECT id, name, email, password_hash, is_verified, account_status FROM users WHERE email = ?').get(testEmail) as any;
  if (!userRow) {
    throw new Error(`User not found in database for email: ${testEmail}`);
  }
  console.log('Database user row:', {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    is_verified: userRow.is_verified,
    account_status: userRow.account_status,
  });

  if (userRow.is_verified !== 1) {
    throw new Error(`Expected is_verified to be 1, got: ${userRow.is_verified}`);
  }
  if (userRow.account_status !== 'active') {
    throw new Error(`Expected account_status to be 'active', got: ${userRow.account_status}`);
  }

  console.log('\n[STEP 3] Verifying bcrypt password hashing');
  const passwordValid = await bcrypt.compare(testPassword, userRow.password_hash);
  if (!passwordValid) {
    throw new Error('Database password hash does not match plaintext password via bcrypt');
  }
  console.log('✅ Password hash verified using bcrypt');

  console.log('\n[STEP 4] Restoring session immediately using registration token via GET /api/auth/me');
  const meRes = await fetch(`${CUST_API}/auth/me`, {
    headers: { Authorization: `Bearer ${regData.token}` },
  });
  const meData = await meRes.json();
  const currentUser = meData.user || meData;
  console.log('GET /auth/me status:', meRes.status);
  console.log('GET /auth/me user:', currentUser?.email, 'verified:', currentUser?.isVerified, 'status:', currentUser?.accountStatus);
  if (!meRes.ok || currentUser?.email !== testEmail || !currentUser?.isVerified) {
    throw new Error('Session restore failed or user verification mismatch');
  }
  console.log('✅ Immediate session restored from database via GET /api/auth/me');

  console.log('\n[STEP 5] Logging in again with email and password');
  const loginRes = await fetch(`${CUST_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  console.log('Login response user:', loginData.user?.email, 'verified:', loginData.user?.isVerified);
  if (!loginRes.ok || !loginData.token || !loginData.user?.isVerified) {
    throw new Error(`Login failed: ${loginData.error}`);
  }
  console.log('✅ Direct login successful with fresh JWT issued and no verification prompts');

  console.log('\n====================================================');
  console.log('🎉 ALL INSTANT CUSTOMER AUTHENTICATION TESTS PASSED!');
  console.log('====================================================\n');
}

runCustomerAuthFlowTest().catch((err) => {
  console.error('\n❌ Customer auth test failed:', err);
  process.exit(1);
});

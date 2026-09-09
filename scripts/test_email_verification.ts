import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const CUST_API = 'http://localhost:5000/api';
const dbPath = path.resolve('customer/backend/data/skynav.db');
const db = new Database(dbPath);

async function runEmailVerificationTest() {
  console.log('====================================================');
  console.log('🧪 REAL CUSTOMER EMAIL VERIFICATION END-TO-END TEST');
  console.log('====================================================');

  const uniqueId = Date.now();
  const testEmail = `live.test.${uniqueId}@skynav.io`;
  const testName = `Captain Aeroway ${uniqueId.toString().slice(-4)}`;
  const testPhone = '+1 (555) 349-8800';
  const testPassword = 'Password123!';

  console.log(`\n[STEP 1] Registering brand new customer: ${testEmail}`);
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

  const regData = await regRes.json();
  console.log(`Registration response status: ${regRes.status}`);
  console.log('Registration response body:', JSON.stringify(regData, null, 2));

  if (!regRes.ok || !regData.requiresVerification) {
    throw new Error(`Registration failed: ${regData.error || 'Expected requiresVerification: true'}`);
  }

  console.log('✅ Registration returned requiresVerification: true');

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

  if (userRow.is_verified !== 0) {
    throw new Error(`Expected is_verified to be 0 before verification, got: ${userRow.is_verified}`);
  }
  if (userRow.account_status !== 'pending_verification') {
    throw new Error(`Expected account_status to be pending_verification, got: ${userRow.account_status}`);
  }

  console.log('\n[STEP 3] Verifying bcrypt password hashing');
  const passwordValid = await bcrypt.compare(testPassword, userRow.password_hash);
  if (!passwordValid) {
    throw new Error('Database password hash does not match plaintext password via bcrypt');
  }
  console.log('✅ Password hash verified using bcrypt');

  console.log('\n[STEP 4] Verifying verification token record in database');
  const tokenRow = db.prepare('SELECT id, user_id, type, code_hash, expires_at, attempt_count FROM verification_tokens WHERE user_id = ?').get(userRow.id) as any;
  if (!tokenRow) {
    throw new Error(`Verification token not found in database for user: ${userRow.id}`);
  }
  console.log('Database verification token row:', {
    id: tokenRow.id,
    user_id: tokenRow.user_id,
    type: tokenRow.type,
    expires_at: tokenRow.expires_at,
    attempt_count: tokenRow.attempt_count,
  });

  console.log('\n[STEP 5] Verifying delivered code matches database bcrypt code_hash');
  const validCode = regData.devVerificationCode;
  if (!validCode || typeof validCode !== 'string' || validCode.length !== 6) {
    throw new Error(`Expected valid 6-digit verification code from dispatch, got: ${validCode}`);
  }

  const codeMatchesHash = await bcrypt.compare(validCode, tokenRow.code_hash);
  if (!codeMatchesHash) {
    throw new Error(`Delivered verification code ${validCode} does not match token code_hash in database!`);
  }
  console.log(`✅ Delivered 6-digit code [${validCode}] cryptographically matches database verification_tokens.code_hash!`);
  if (regData.previewUrl) {
    console.log(`📧 Ethereal Web Preview URL: ${regData.previewUrl}`);
  }

  console.log('\n[STEP 6] Testing invalid verification code rejection');
  const badRes = await fetch(`${CUST_API}/auth/verify-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: '000000',
    }),
  });
  console.log(`Invalid code response status: ${badRes.status} (expected 400)`);
  if (badRes.status !== 400) {
    throw new Error(`Expected status 400 for bad code, got: ${badRes.status}`);
  }
  console.log('✅ Invalid verification code properly rejected');

  console.log('\n[STEP 7] Submitting real 6-digit verification code to /api/auth/verify-account');
  const verifyRes = await fetch(`${CUST_API}/auth/verify-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: validCode,
    }),
  });

  const verifyData = await verifyRes.json();
  console.log(`Verify response status: ${verifyRes.status}`);
  console.log('Verify response body:', JSON.stringify(verifyData, null, 2));

  if (!verifyRes.ok || !verifyData.token) {
    throw new Error(`Verification failed: ${verifyData.error || 'Expected token in response'}`);
  }
  console.log('✅ Account successfully verified with JWT token issued');

  console.log('\n[STEP 8] Verifying user row updated in customer.db');
  const updatedUserRow = db.prepare('SELECT id, is_verified, account_status FROM users WHERE id = ?').get(userRow.id) as any;
  console.log('Updated user row:', updatedUserRow);
  if (updatedUserRow.is_verified !== 1 || updatedUserRow.account_status !== 'active') {
    throw new Error(`Expected is_verified=1 and account_status='active', got: ${JSON.stringify(updatedUserRow)}`);
  }
  console.log('✅ customer.db confirmed: is_verified = 1, account_status = "active"');

  console.log('\n[STEP 9] Restoring session via GET /api/auth/me');
  const meRes = await fetch(`${CUST_API}/auth/me`, {
    headers: { Authorization: `Bearer ${verifyData.token}` },
  });
  const meData = await meRes.json();
  const currentUser = meData.user || meData;
  console.log('GET /auth/me status:', meRes.status);
  console.log('GET /auth/me user:', currentUser?.email, 'verified:', currentUser?.isVerified);
  if (!meRes.ok || currentUser?.email !== testEmail || !currentUser?.isVerified) {
    throw new Error(`Session restore failed or user verification mismatch`);
  }
  console.log('✅ Session restored from database via GET /api/auth/me');

  console.log('\n[STEP 10] Logging in again with email and password');
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
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Login failed: ${loginData.error}`);
  }
  console.log('✅ Login successful with fresh JWT issued');

  console.log('\n====================================================');
  console.log('🎉 ALL 10 STEPS OF EMAIL VERIFICATION PASSED PERFECTLY!');
  console.log('====================================================\n');
}

runEmailVerificationTest().catch((err) => {
  console.error('\n❌ Email verification test failed:', err);
  process.exit(1);
});

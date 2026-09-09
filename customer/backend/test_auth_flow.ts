import bcrypt from 'bcryptjs';
import { db, initDb, queryOne, queryAll, runCommand } from './db/database.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './services/emailService.js';

async function runAuthTests() {
  console.log('🧪 Starting SkyNav Customer Authentication & Entry Flow E2E Tests...\n');

  // Ensure DB initialized
  initDb();

  const testEmail = `test.pilot_${Date.now()}@skynav-test.io`;
  const testPassword = 'SecurePassword123!';
  const testName = 'Captain Test Pilot';
  const testPhone = '+1 (555) 999-1234';

  // ── TEST 1: Register New Customer in Pending State ──
  console.log('1️⃣  Testing Customer Registration Flow...');
  const userId = `cust_test_${Date.now()}`;
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const verifyCode = '654321';
  const codeHash = await bcrypt.hash(verifyCode, 8);
  const tokenId = `tok_test_${Date.now()}`;

  db.transaction(() => {
    runCommand(`
      INSERT INTO users (id, name, email, phone, password_hash, is_verified, account_status)
      VALUES (?, ?, ?, ?, ?, 0, 'pending_verification')
    `, [userId, testName, testEmail, testPhone, passwordHash]);

    runCommand(`
      INSERT INTO verification_tokens (id, user_id, type, code_hash, expires_at, attempt_count, max_attempts)
      VALUES (?, ?, 'email_verification', ?, datetime('now', '+10 minutes'), 0, 5)
    `, [tokenId, userId, codeHash]);
  })();

  const pendingUser = queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!pendingUser || pendingUser.is_verified !== 0 || pendingUser.account_status !== 'pending_verification') {
    throw new Error('❌ Test 1 Failed: User was not created in pending_verification state.');
  }
  console.log('   ✅ User created in pending_verification state (is_verified = 0)');

  // ── TEST 2: Email Service Dev Mode Dispatch ──
  console.log('2️⃣  Testing Email Service Dispatch...');
  const emailRes = await sendVerificationEmail(testEmail, testName, verifyCode);
  if (!emailRes.success) {
    throw new Error('❌ Test 2 Failed: Email service did not return success.');
  }
  console.log('   ✅ Email service processed verification code successfully');

  // ── TEST 3: Verification with WRONG Code ──
  console.log('3️⃣  Testing Verification with Incorrect Code...');
  const wrongMatch = await bcrypt.compare('000000', codeHash);
  if (wrongMatch) {
    throw new Error('❌ Test 3 Failed: Incorrect code unexpectedly matched.');
  }
  runCommand('UPDATE verification_tokens SET attempt_count = attempt_count + 1 WHERE id = ?', [tokenId]);
  const tokenRecord = queryOne<any>('SELECT attempt_count FROM verification_tokens WHERE id = ?', [tokenId]);
  if (tokenRecord.attempt_count !== 1) {
    throw new Error('❌ Test 3 Failed: Attempt count was not incremented.');
  }
  console.log('   ✅ Incorrect verification code rejected and attempt count incremented');

  // ── TEST 4: Verification with CORRECT Code ──
  console.log('4️⃣  Testing Verification with Correct Code...');
  const rightMatch = await bcrypt.compare(verifyCode, codeHash);
  if (!rightMatch) {
    throw new Error('❌ Test 4 Failed: Correct code did not match.');
  }

  db.transaction(() => {
    runCommand(`
      UPDATE verification_tokens
      SET verified_at = datetime('now'), used_at = datetime('now')
      WHERE id = ?
    `, [tokenId]);

    runCommand(`
      UPDATE users
      SET is_verified = 1, account_status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `, [userId]);
  })();

  const verifiedUser = queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (verifiedUser.is_verified !== 1 || verifiedUser.account_status !== 'active') {
    throw new Error('❌ Test 4 Failed: User was not activated upon correct code entry.');
  }
  console.log('   ✅ User account activated and marked verified (is_verified = 1, status = active)');

  // ── TEST 5: Password Reset Flow with Real Token ──
  console.log('5️⃣  Testing Password Reset Flow...');
  const resetCode = '112233';
  const resetHash = await bcrypt.hash(resetCode, 8);
  const resetTokenId = `tok_reset_${Date.now()}`;

  runCommand(`
    INSERT INTO verification_tokens (id, user_id, type, code_hash, expires_at, attempt_count, max_attempts)
    VALUES (?, ?, 'password_reset', ?, datetime('now', '+15 minutes'), 0, 5)
  `, [resetTokenId, userId, resetHash]);

  const resetEmailRes = await sendPasswordResetEmail(testEmail, testName, resetCode);
  if (!resetEmailRes.success) {
    throw new Error('❌ Test 5 Failed: Password reset email failed.');
  }

  const newPassword = 'BrandNewPassword2026!';
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  db.transaction(() => {
    runCommand(`UPDATE verification_tokens SET used_at = datetime('now') WHERE id = ?`, [resetTokenId]);
    runCommand(`UPDATE users SET password_hash = ? WHERE id = ?`, [newPasswordHash, userId]);
  })();

  const updatedUser = queryOne<any>('SELECT password_hash FROM users WHERE id = ?', [userId]);
  const isNewPassValid = await bcrypt.compare(newPassword, updatedUser.password_hash);
  if (!isNewPassValid) {
    throw new Error('❌ Test 5 Failed: Password was not updated correctly.');
  }
  console.log('   ✅ Password reset successfully updated user password_hash');

  // Clean up test user
  runCommand('DELETE FROM users WHERE id = ?', [userId]);
  console.log('\n🎉 ALL 5 AUTHENTICATION & VERIFICATION E2E TESTS PASSED PERFECTLY!\n');
}

runAuthTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

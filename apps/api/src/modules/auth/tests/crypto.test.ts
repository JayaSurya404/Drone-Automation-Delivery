import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  validatePasswordPolicy
} from "../crypto.js";

describe("Auth / Crypto & Password Security", () => {
  it("hashes password with Argon2id and verifies successfully", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    assert.ok(hash.startsWith("$argon2id$"), "Hash must be in Argon2id format");
    assert.notEqual(hash, password, "Hash must never match plaintext");

    const isValid = await verifyPassword(hash, password);
    assert.equal(isValid, true, "Valid password must verify");

    const isInvalid = await verifyPassword(hash, "WrongPassword123!");
    assert.equal(isInvalid, false, "Invalid password must not verify");
  });

  it("handles empty or malformed hashes safely", async () => {
    assert.equal(await verifyPassword("", "password"), false);
    assert.equal(await verifyPassword("invalid-hash", "password"), false);
  });

  it("generates high-entropy random tokens and hashes them deterministically with SHA-256", () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    assert.notEqual(token1, token2);
    assert.equal(token1.length, 64); // 32 bytes in hex = 64 characters

    const hash1 = hashToken(token1);
    const hash2 = hashToken(token1);
    assert.equal(hash1, hash2, "Hashing the same token must be deterministic");
    assert.notEqual(hash1, token1);
  });

  it("validates password policy rules correctly", () => {
    assert.equal(validatePasswordPolicy("ValidPass123!").valid, true);
    assert.equal(validatePasswordPolicy("short").valid, false);
    assert.equal(validatePasswordPolicy("alllowercase123").valid, false);
    assert.equal(validatePasswordPolicy("ALLUPPERCASE123").valid, false);
    assert.equal(validatePasswordPolicy("NoNumbersHere!").valid, false);
  });
});

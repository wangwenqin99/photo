import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionCookie,
  hashPassword,
  sessionCookie,
  verifyAdminCredentials,
} from "../lib/auth.ts";

test("verifies configured administrator credentials", async () => {
  const salt = "test-salt";
  const hash = await hashPassword("correct horse", salt);
  const env = {
    ADMIN_EMAIL: "admin@example.com",
    ADMIN_PASSWORD_HASH: hash,
    ADMIN_PASSWORD_SALT: salt,
  };
  assert.equal(await verifyAdminCredentials("admin@example.com", "correct horse", env), true);
  assert.equal(await verifyAdminCredentials("admin@example.com", "wrong", env), false);
  assert.equal(await verifyAdminCredentials("other@example.com", "correct horse", env), false);
});

test("uses a Worker-friendly salted SHA-256 password hash", async () => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("test-salt:correct horse"),
  );
  const expected = Buffer.from(digest).toString("base64");
  assert.equal(await hashPassword("correct horse", "test-salt"), expected);
});

test("creates a hardened session cookie", () => {
  const cookie = sessionCookie("secret", new Date("2030-01-01T00:00:00Z"));
  assert.match(cookie, /^album_admin=secret;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
});

test("clears the administrator cookie", () => {
  assert.match(clearSessionCookie(), /Max-Age=0/);
});

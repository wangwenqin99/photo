import { createSession, deleteSession, findSession } from "./db.ts";
import type { AppEnv } from "./runtime.ts";

const COOKIE_NAME = "album_admin";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: new TextEncoder().encode(salt),
    iterations: 120_000,
  }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export async function verifyAdminCredentials(
  email: string,
  password: string,
  env: Pick<AppEnv, "ADMIN_EMAIL" | "ADMIN_PASSWORD_HASH" | "ADMIN_PASSWORD_SALT">,
): Promise<boolean> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_SALT) return false;
  const submittedHash = await hashPassword(password, env.ADMIN_PASSWORD_SALT);
  return safeEqual(email.trim().toLowerCase(), env.ADMIN_EMAIL.trim().toLowerCase())
    && safeEqual(submittedHash, env.ADMIN_PASSWORD_HASH);
}

export function sessionCookie(token: string, expiresAt: Date): string {
  return `${COOKIE_NAME}=${token}; Path=/; Expires=${expiresAt.toUTCString()}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function cookieToken(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const entry of header.split(";")) {
    const [name, ...rest] = entry.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=") || null;
  }
  return null;
}

export async function createAdminSession(db: D1Database) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await createSession(db, crypto.randomUUID(), tokenHash, expiresAt.getTime());
  return { token, expiresAt };
}

export async function isAdmin(request: Request, env: Pick<AppEnv, "DB">): Promise<boolean> {
  const token = cookieToken(request);
  if (!token) return false;
  return Boolean(await findSession(env.DB, await sha256(token)));
}

export async function requireAdmin(request: Request, env: Pick<AppEnv, "DB">): Promise<void> {
  if (!(await isAdmin(request, env))) throw new Response("未登录或登录已失效", { status: 401 });
}

export async function destroyAdminSession(request: Request, db: D1Database): Promise<void> {
  const token = cookieToken(request);
  if (token) await deleteSession(db, await sha256(token));
}

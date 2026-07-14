# Cloud Photo Album Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a responsive React cloud album with public page-turn browsing and a protected single-admin management/upload workflow.

**Architecture:** Use the Sites vinext React starter with App Router pages and route handlers. D1 stores albums, photo metadata, ordering, and sessions; R2 stores image bytes. Domain helpers isolate validation, pagination, authentication, and persistence so they can be tested without rendering the full application.

**Tech Stack:** React 19, TypeScript, vinext/Next App Router, Cloudflare Workers, D1, R2, Drizzle schema, Node test runner, CSS.

---

## File structure

- `app/page.tsx`: public album index.
- `app/albums/[albumId]/page.tsx`: album reader route.
- `app/admin/page.tsx`: admin login/management shell.
- `app/components/AlbumGrid.tsx`: public album cards.
- `app/components/AlbumReader.tsx`: desktop spread and mobile swipe reader.
- `app/components/AdminDashboard.tsx`: album/photo management state.
- `app/components/UploadQueue.tsx`: validation, progress, retry UI.
- `app/api/**/route.ts`: public and protected APIs.
- `lib/domain.ts`: page indices, cover fallback, ordering, upload validation.
- `lib/auth.ts`: password verification and session cookie helpers.
- `lib/db.ts`: D1 queries behind focused functions.
- `lib/storage.ts`: R2 object operations.
- `db/schema.ts`: D1 schema.
- `worker/index.ts`: runtime bindings including `DB` and `PHOTOS`.
- `tests/*.test.mjs`: domain and rendered-output regression tests.

### Task 1: Scaffold the Sites React project

**Files:**
- Create from Sites starter: `package.json`, `app/`, `db/`, `worker/`, `.openai/hosting.json`, build configuration.
- Preserve: `docs/superpowers/specs/2026-07-14-photo-album-design.md`, this plan, `.git/`.
- Modify: `.gitignore`, `package.json`, `app/layout.tsx`.

- [ ] **Step 1: Preserve design artifacts, run the official initializer, and restore the artifacts**

Move only `docs/` and `.superpowers/` to verified sibling temporary paths, run the Sites `scripts/init-site.sh` against `D:/myProject`, then restore `docs/`. Confirm every resolved move target stays under `D:/myProject` or its explicitly created sibling temporary directory.

- [ ] **Step 2: Remove starter-only dependencies and metadata**

Remove `react-loading-skeleton`, `app/_sites-preview`, its imports, and the temporary preview marker. Set metadata to:

```ts
export const metadata = {
  title: "拾光册",
  description: "翻阅值得珍藏的每一刻",
};
```

- [ ] **Step 3: Configure durable storage**

Set `.openai/hosting.json` to:

```json
{
  "d1": "DB",
  "r2": "PHOTOS"
}
```

Add `.superpowers/`, `.env`, `.wrangler/`, `.next/`, and `dist/` to `.gitignore`.

- [ ] **Step 4: Verify the starter**

Run `npm run build`. Expected: exit code 0 with a Cloudflare Worker-compatible ESM build.

- [ ] **Step 5: Commit**

```bash
git add . ':!.superpowers'
git commit -m "chore: scaffold React album application"
```

### Task 2: Define and test album domain behavior

**Files:**
- Create: `lib/domain.ts`
- Create: `tests/domain.test.mjs`

- [ ] **Step 1: Write failing domain tests**

Cover the desired public API:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { pageSpread, normalizeOrder, nextCover, validateImage } from "../lib/domain.ts";

test("desktop spread returns two adjacent photos", () => {
  assert.deepEqual(pageSpread(2, ["a", "b", "c", "d"]), ["c", "d"]);
});
test("mobile spread returns one photo", () => {
  assert.deepEqual(pageSpread(2, ["a", "b", "c"], true), ["c"]);
});
test("orders ids without duplicates", () => {
  assert.deepEqual(normalizeOrder(["b", "b", "a"], ["a", "b", "c"]), ["b", "a", "c"]);
});
test("cover falls back to the first remaining photo", () => {
  assert.equal(nextCover("a", ["b", "c"]), "b");
});
test("rejects files over 20MB", () => {
  assert.equal(validateImage({ type: "image/jpeg", size: 20 * 1024 * 1024 + 1 }).ok, false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run `node --experimental-strip-types --test tests/domain.test.mjs`. Expected: FAIL because `lib/domain.ts` does not exist.

- [ ] **Step 3: Implement the minimal domain helpers**

Export typed functions with these signatures:

```ts
export function pageSpread(index: number, ids: string[], mobile = false): string[];
export function normalizeOrder(requested: string[], existing: string[]): string[];
export function nextCover(current: string | null, remaining: string[]): string | null;
export function validateImage(file: { type: string; size: number }): { ok: true } | { ok: false; message: string };
```

Allowed MIME types are `image/jpeg`, `image/png`, `image/webp`, and `image/gif`; maximum size is `20 * 1024 * 1024` bytes.

- [ ] **Step 4: Run the test and verify GREEN**

Run the same test command. Expected: 5 passing tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/domain.ts tests/domain.test.mjs
git commit -m "feat: add album domain rules"
```

### Task 3: Add D1 schema and persistence helpers

**Files:**
- Modify: `db/schema.ts`
- Create: `lib/runtime.ts`
- Create: `lib/db.ts`
- Create: `tests/schema.test.mjs`
- Generate: `drizzle/*.sql`

- [ ] **Step 1: Write a failing schema contract test**

Assert the generated SQL contains `albums`, `photos`, and `admin_sessions`, an album foreign key on photos, an album/order index, and unique object keys.

- [ ] **Step 2: Run RED**

Run `node --test tests/schema.test.mjs`. Expected: FAIL because the required schema is absent.

- [ ] **Step 3: Define the schema**

Use these columns:

```ts
albums: id, name, coverPhotoId, createdAt, updatedAt
photos: id, albumId, objectKey, originalName, contentType, sizeBytes, sortOrder, createdAt
adminSessions: id, tokenHash, expiresAt, createdAt
```

Create `photos_album_order_idx` on `(albumId, sortOrder)` and a unique index on `photos.objectKey`.

- [ ] **Step 4: Implement persistence boundaries**

`lib/db.ts` exports `listAlbums`, `getAlbum`, `createAlbum`, `renameAlbum`, `deleteAlbumRecords`, `insertPhoto`, `deletePhotoRecord`, `setCover`, `reorderPhotos`, `createSession`, `findSession`, and `deleteSession`. Each function accepts `D1Database`; route handlers never contain raw SQL.

- [ ] **Step 5: Generate and inspect migration**

Run `npm run db:generate`, inspect the SQL, and verify each `prepare()` operation later receives exactly one statement.

- [ ] **Step 6: Run GREEN and commit**

Run `node --test tests/schema.test.mjs` and `npm run build`; then commit with `feat: add album persistence schema`.

### Task 4: Implement administrator authentication

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/admin/login/route.ts`
- Create: `app/api/admin/logout/route.ts`
- Create: `tests/auth.test.mjs`
- Modify: `.env.example`, `worker/index.ts`

- [ ] **Step 1: Write failing authentication tests**

Tests verify correct credentials create a session, incorrect email/password returns the same `登录信息不正确` message, expired sessions are rejected, and cookies include `HttpOnly; Secure; SameSite=Lax`.

- [ ] **Step 2: Run RED**

Run `node --experimental-strip-types --test tests/auth.test.mjs`. Expected: FAIL because auth helpers are missing.

- [ ] **Step 3: Implement auth helpers**

Expose:

```ts
verifyAdminCredentials(email: string, password: string, env: Env): Promise<boolean>
createAdminSession(db: D1Database): Promise<{ token: string; expiresAt: Date }>
requireAdmin(request: Request, env: Env): Promise<void>
sessionCookie(token: string, expiresAt: Date): string
clearSessionCookie(): string
```

Use Web Crypto PBKDF2/SHA-256 for the configured password hash and SHA-256 for stored session token hashes. `.env.example` contains names only: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`.

- [ ] **Step 4: Add login/logout routes and runtime env types**

Login accepts JSON `{ email, password }`, returns 204 on success, 401 with the unified Chinese message on failure. Logout invalidates the session and clears the cookie.

- [ ] **Step 5: Run GREEN and commit**

Run auth tests plus `npm run build`; commit with `feat: secure administrator access`.

### Task 5: Build public and protected album APIs

**Files:**
- Create: `lib/storage.ts`
- Create: `app/api/albums/route.ts`
- Create: `app/api/albums/[albumId]/route.ts`
- Create: `app/api/photos/[photoId]/route.ts`
- Create: `app/api/admin/albums/[albumId]/photos/route.ts`
- Create: `app/api/admin/photos/[photoId]/route.ts`
- Create: `app/api/admin/albums/[albumId]/order/route.ts`
- Create: `tests/api-contract.test.mjs`

- [ ] **Step 1: Write failing API contract tests**

Assert public GET routes do not require a session; every POST/PATCH/DELETE route rejects missing sessions; invalid types and files over 20MB return 400; a metadata failure after R2 upload deletes the new object; deleting a photo updates its album cover fallback.

- [ ] **Step 2: Run RED**

Run `node --test tests/api-contract.test.mjs`. Expected: FAIL for missing handlers.

- [ ] **Step 3: Implement storage operations**

`lib/storage.ts` exports `putPhoto`, `getPhoto`, and `deletePhoto` accepting an `R2Bucket`. Object keys use `albums/{albumId}/{crypto.randomUUID()}` and never trust the original filename as a path.

- [ ] **Step 4: Implement CRUD and upload handlers**

Public responses use:

```ts
type AlbumSummary = { id: string; name: string; coverPhotoId: string | null; photoCount: number; updatedAt: string };
type AlbumDetail = AlbumSummary & { photos: Array<{ id: string; originalName: string; width?: number; height?: number }> };
```

The upload handler accepts `multipart/form-data` with repeated `files`, validates every file server-side, processes files independently, and returns `{ uploaded, failed }` so one failure does not cancel successful uploads.

- [ ] **Step 5: Run GREEN and commit**

Run contract tests and build; commit with `feat: add album and photo APIs`.

### Task 6: Build the public album experience

**Files:**
- Modify: `app/page.tsx`, `app/globals.css`
- Create: `app/albums/[albumId]/page.tsx`
- Create: `app/components/AlbumGrid.tsx`
- Create: `app/components/AlbumReader.tsx`
- Create: `tests/public-ui.test.mjs`

- [ ] **Step 1: Write failing rendered UI tests**

Assert the home page includes the Chinese heading `把日子，装订成册`, album count/update labels, an empty state, and accessible album links. Assert the reader renders previous/next controls, position text, keyboard labels, and a mobile swipe region.

- [ ] **Step 2: Run RED**

Run `node --test tests/public-ui.test.mjs`. Expected: FAIL while starter content remains.

- [ ] **Step 3: Implement the warm family album homepage**

Use CSS colors `#F4EBDD` (paper), `#8C4638` (terracotta), `#59362E` (leather), and `#2E2925` (ink). Use CSS gradients/noise-like patterns rather than generated SVG decoration. Album cards show cover, name, photo count, and update time.

- [ ] **Step 4: Implement responsive page turning**

`AlbumReader` maintains one logical photo index. At `min-width: 768px`, it renders a two-photo spread and advances by two; below it renders one photo and advances by one. Support buttons, `ArrowLeft`/`ArrowRight`, pointer swipe threshold 48px, reduced-motion preference, adjacent-image preload, and `aria-live` position updates.

- [ ] **Step 5: Run GREEN and commit**

Run UI tests and build; commit with `feat: add responsive album browsing`.

### Task 7: Build the administrator dashboard and upload queue

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/components/AdminDashboard.tsx`
- Create: `app/components/UploadQueue.tsx`
- Create: `app/components/PhotoOrganizer.tsx`
- Create: `tests/admin-ui.test.mjs`

- [ ] **Step 1: Write failing admin component tests**

Cover login, create/rename/delete confirmation, album selection, multiple file selection, client validation, independent progress, failed-item retry, cover selection, photo removal, and ordering payloads.

- [ ] **Step 2: Run RED**

Run `node --test tests/admin-ui.test.mjs`. Expected: FAIL because admin components are absent.

- [ ] **Step 3: Implement login and album management**

Use a single admin page that renders the login card for 401 responses and the dashboard after authentication. Desktop layout is album sidebar plus photo workspace; mobile layout is one column with a sticky bottom action area.

- [ ] **Step 4: Implement upload queue**

Queue items use states `queued | uploading | uploaded | failed`, store per-file progress, limit concurrency to three, remove successful items, and keep failed items with a retry button. Never store `File` objects outside live component state.

- [ ] **Step 5: Implement photo organization**

Provide keyboard-accessible move earlier/later controls in addition to drag-and-drop. Persist one complete ordered ID array, allow cover selection, and use confirmation dialogs for destructive actions.

- [ ] **Step 6: Run GREEN and commit**

Run admin tests, lint, and build; commit with `feat: add album administration and uploads`.

### Task 8: Final integration, accessibility, and deployment readiness

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`, `tests/rendered-html.test.mjs`
- Create: `public/og.png` only if the single generated social card passes text inspection.

- [ ] **Step 1: Add integration assertions**

The rendered HTML test checks title/description, no starter markers, semantic landmarks, labeled controls, responsive viewport metadata, and no links to removed starter assets.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0 with no test failures or TypeScript errors.

- [ ] **Step 3: Perform browser acceptance checks**

Verify desktop home, desktop double-page reader, keyboard navigation, admin upload queue, and a mobile-width single-photo swipe layout. Confirm reduced motion, focus visibility, empty states, and Chinese errors.

- [ ] **Step 4: Configure hosted secrets and publish**

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `ADMIN_PASSWORD_SALT` through Sites environment management; never commit the raw password. Provision D1/R2 from `.openai/hosting.json`, deploy, and smoke-test the published URL.

- [ ] **Step 5: Commit final polish**

```bash
git add app public tests package.json package-lock.json
git commit -m "feat: complete responsive cloud photo album"
```

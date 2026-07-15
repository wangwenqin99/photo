# Cloudinary Photo Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the R2 photo binding with signed Cloudinary storage while keeping the existing React UI, Cloudflare Worker, D1 data model, and administrator authorization.

**Architecture:** The Worker signs Cloudinary Upload API requests with secrets stored in the runtime, saves the returned public ID in the existing `photos.object_key` column, and redirects public photo reads to Cloudinary's CDN. Cloudflare D1 remains the single metadata store; Cloudinary cleanup is best-effort after D1 deletion and compensating after failed D1 insertion.

**Tech Stack:** React 19, TypeScript, vinext, Cloudflare Workers, Cloudflare D1, Cloudinary Upload API, Web Crypto, Node test runner

---

## File map

- Modify `lib/domain.ts`: enforce the Cloudinary Free image limit.
- Modify `tests/domain.test.mjs`: specify the new 10 MB boundary.
- Replace `lib/storage.ts`: implement Cloudinary signing, upload, delivery URL, and delete.
- Replace `tests/storage.test.mjs`: test storage behavior without network access.
- Modify `lib/runtime.ts`: replace the R2 binding with Cloudinary runtime variables.
- Modify photo upload/read/delete routes: call the Cloudinary adapter.
- Modify `tests/api-contract.test.mjs`: assert Cloudinary cleanup and redirect contracts.
- Modify `app/components/UploadQueue.tsx`: display the 10 MB user-facing limit.
- Modify `.openai/hosting.json`: remove the unused logical R2 binding.
- Create `.dev.vars.example`: document safe local configuration names.
- Create `wrangler.deploy.jsonc`: define the direct Cloudflare Worker and D1 binding.
- Create `scripts/configure-production.ps1`: provide an interactive, non-logging secret setup.

### Task 1: Align image validation with the Cloudinary Free plan

**Files:**
- Modify: `tests/domain.test.mjs`
- Modify: `lib/domain.ts`
- Modify: `app/components/UploadQueue.tsx`

- [ ] **Step 1: Write the failing 10 MB boundary tests**

Replace the two size tests with:

```js
test("accepts supported image types up to 10MB", () => {
  assert.deepEqual(validateImage({ type: "image/jpeg", size: 10 * 1024 * 1024 }), { ok: true });
});

test("rejects unsupported types and files over 10MB", () => {
  assert.equal(validateImage({ type: "image/svg+xml", size: 20 }).ok, false);
  assert.equal(validateImage({ type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }).ok, false);
});
```

- [ ] **Step 2: Run the domain test and verify RED**

Run:

```powershell
$env:PATH='C:\Program Files\nvm\v24.9.0;'+$env:PATH
node --experimental-strip-types --test tests/domain.test.mjs
```

Expected: the over-10-MB assertion fails because the implementation still allows 20 MB.

- [ ] **Step 3: Implement the 10 MB limit**

Set:

```ts
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
```

Change the validation message and upload panel copy from `20MB` to `10MB`.

- [ ] **Step 4: Run the domain and admin UI tests**

Run:

```powershell
node --experimental-strip-types --test tests/domain.test.mjs tests/admin-ui.test.mjs
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/domain.ts tests/domain.test.mjs app/components/UploadQueue.tsx
git commit -m "fix: align uploads with Cloudinary free limit"
```

### Task 2: Implement the signed Cloudinary storage adapter

**Files:**
- Replace: `tests/storage.test.mjs`
- Replace: `lib/storage.ts`

- [ ] **Step 1: Write failing adapter tests**

The new tests must import:

```js
import {
  cloudinarySignature,
  deletePhoto,
  photoDeliveryUrl,
  putPhoto,
} from "../lib/storage.ts";
```

Cover these concrete behaviors:

```js
const config = {
  CLOUDINARY_CLOUD_NAME: "demo cloud",
  CLOUDINARY_API_KEY: "key-123",
  CLOUDINARY_API_SECRET: "secret-456",
};

test("signs sorted Cloudinary parameters with SHA-1", async () => {
  assert.equal(
    await cloudinarySignature({ timestamp: 1700000000, public_id: "albums/a/photo" }, "secret-456"),
    "059e73c9aeaffd5c1ec0cd4bfaf060633e219095",
  );
});

test("uploads under an album-scoped opaque public id", async () => {
  let request;
  const fetcher = async (url, init) => {
    request = { url, init };
    return Response.json({ public_id: "albums/album-1/fixed-id" });
  };
  const publicId = await putPhoto(
    config,
    "album-1",
    new File(["photo"], "one.jpg", { type: "image/jpeg" }),
    { fetcher, now: () => 1700000000000, randomUUID: () => "fixed-id" },
  );
  assert.equal(publicId, "albums/album-1/fixed-id");
  assert.equal(request.url, "https://api.cloudinary.com/v1_1/demo%20cloud/image/upload");
  assert.equal(request.init.method, "POST");
  assert.equal((request.init.body).get("api_key"), "key-123");
  assert.equal((request.init.body).get("public_id"), publicId);
  assert.equal((request.init.body).get("file").name, "one.jpg");
});

test("builds an encoded CDN delivery URL", () => {
  assert.equal(
    photoDeliveryUrl(config, "albums/家庭/photo id"),
    "https://res.cloudinary.com/demo%20cloud/image/upload/albums/%E5%AE%B6%E5%BA%AD/photo%20id",
  );
});

test("sends a signed destroy request", async () => {
  let form;
  await deletePhoto(config, "albums/a/photo", {
    now: () => 1700000000000,
    fetcher: async (_url, init) => {
      form = init.body;
      return Response.json({ result: "ok" });
    },
  });
  assert.equal(form.get("public_id"), "albums/a/photo");
  assert.equal(form.get("api_key"), "key-123");
  assert.match(form.get("signature"), /^[0-9a-f]{40}$/);
});
```

Also assert that invalid album IDs, non-2xx responses, missing `public_id`, and non-`ok`/`not found` destroy responses reject.

- [ ] **Step 2: Run the storage test and verify RED**

Run:

```powershell
node --experimental-strip-types --test tests/storage.test.mjs
```

Expected: import/export or assertion failures because the R2 adapter does not implement the Cloudinary API.

- [ ] **Step 3: Implement minimal Cloudinary signing and requests**

Define these public types and functions:

```ts
export interface CloudinaryConfig {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

type StorageDeps = {
  fetcher?: typeof fetch;
  now?: () => number;
  randomUUID?: () => string;
};

export async function cloudinarySignature(
  params: Record<string, string | number | boolean>,
  secret: string,
): Promise<string>;

export async function putPhoto(
  config: CloudinaryConfig,
  albumId: string,
  file: File | Blob,
  deps?: StorageDeps,
): Promise<string>;

export function photoDeliveryUrl(config: CloudinaryConfig, publicId: string): string;

export async function deletePhoto(
  config: CloudinaryConfig,
  publicId: string,
  deps?: Pick<StorageDeps, "fetcher" | "now">,
): Promise<void>;
```

Implementation rules:

- Validate all three config values before a request.
- Sort signature parameter keys, join them as `key=value&key=value`, append the API secret, SHA-1 digest with Web Crypto, and encode lowercase hexadecimal.
- Upload `timestamp`, `public_id`, `api_key`, `signature`, and `file` in `FormData`.
- Delete with `timestamp`, `public_id`, `api_key`, and `signature`.
- Throw generic Chinese errors without including Cloudinary response bodies or credentials.
- Encode the cloud name and each public-ID path segment independently for delivery URLs.

- [ ] **Step 4: Run the storage tests**

Run:

```powershell
node --experimental-strip-types --test tests/storage.test.mjs
```

Expected: all Cloudinary storage tests pass.

- [ ] **Step 5: Commit**

```powershell
git add lib/storage.ts tests/storage.test.mjs
git commit -m "feat: add signed Cloudinary photo storage"
```

### Task 3: Wire Cloudinary through runtime and API routes

**Files:**
- Modify: `lib/runtime.ts`
- Modify: `app/api/admin/albums/[albumId]/photos/route.ts`
- Modify: `app/api/photos/[photoId]/route.ts`
- Modify: `app/api/admin/photos/[photoId]/route.ts`
- Modify: `app/api/albums/[albumId]/route.ts`
- Modify: `tests/api-contract.test.mjs`

- [ ] **Step 1: Write failing API contract assertions**

Update the cleanup contract test to require Cloudinary configuration rather than `env.PHOTOS`, and add:

```js
test("public photo reads redirect to Cloudinary delivery", async () => {
  const photo = await source("app/api/photos/[photoId]/route.ts");
  assert.match(photo, /photoDeliveryUrl\(env, photo\.objectKey\)/);
  assert.match(photo, /status:\s*302/);
});

test("runtime uses Cloudinary secrets and no R2 binding", async () => {
  const runtime = await source("lib/runtime.ts");
  assert.match(runtime, /CLOUDINARY_CLOUD_NAME/);
  assert.match(runtime, /CLOUDINARY_API_KEY/);
  assert.match(runtime, /CLOUDINARY_API_SECRET/);
  assert.doesNotMatch(runtime, /PHOTOS:\s*R2Bucket/);
});
```

Rename `R2 deletion failures are recorded` to `Cloudinary deletion failures are recorded` and assert the log labels contain `Cloudinary`.

- [ ] **Step 2: Run API contracts and verify RED**

Run:

```powershell
node --experimental-strip-types --test tests/api-contract.test.mjs
```

Expected: Cloudinary runtime and redirect assertions fail.

- [ ] **Step 3: Replace the runtime binding**

Use:

```ts
export interface AppEnv {
  DB: D1Database;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_PASSWORD_SALT: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}
```

- [ ] **Step 4: Update upload, read, and delete routes**

Apply these exact call shapes:

```ts
objectKey = await putPhoto(env, albumId, file);
if (objectKey) await deletePhoto(env, objectKey).catch(() => undefined);
```

```ts
const url = photoDeliveryUrl(env, photo.objectKey);
return new Response(null, {
  status: 302,
  headers: {
    Location: url,
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  },
});
```

```ts
await deletePhoto(env, deleted.objectKey).catch((error) => {
  console.error("Cloudinary photo cleanup failed", { key: deleted.objectKey, error });
});
```

For album deletion, map keys through `deletePhoto(env, key)` and rename the cleanup log to `Cloudinary album cleanup failed`.

- [ ] **Step 5: Run API, auth, and storage tests**

Run:

```powershell
node --experimental-strip-types --test tests/api-contract.test.mjs tests/auth.test.mjs tests/storage.test.mjs
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```powershell
git add lib/runtime.ts app/api tests/api-contract.test.mjs
git commit -m "refactor: route photo APIs through Cloudinary"
```

### Task 4: Add safe deployment configuration

**Files:**
- Modify: `.openai/hosting.json`
- Create: `.dev.vars.example`
- Create: `wrangler.deploy.jsonc`
- Create: `scripts/configure-production.ps1`
- Modify: `.gitignore`
- Test: `tests/hosting-config.test.mjs`

- [ ] **Step 1: Write a failing hosting configuration test**

Create `tests/hosting-config.test.mjs` that parses both JSON files and asserts:

```js
test("direct deployment binds D1 without R2", async () => {
  const deploy = JSON.parse(await readFile(new URL("../wrangler.deploy.jsonc", import.meta.url), "utf8"));
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  assert.equal(deploy.main, "dist/server/index.js");
  assert.equal(deploy.d1_databases[0].binding, "DB");
  assert.equal(deploy.d1_databases[0].database_id, "d93a38a5-8ad0-49d0-af7e-3d29f2e4c950");
  assert.equal("r2_buckets" in deploy, false);
  assert.equal("r2" in hosting, false);
});
```

- [ ] **Step 2: Run the configuration test and verify RED**

Run:

```powershell
node --test tests/hosting-config.test.mjs
```

Expected: missing `wrangler.deploy.jsonc`.

- [ ] **Step 3: Add direct Worker configuration**

Create valid JSON in `wrangler.deploy.jsonc`:

```json
{
  "name": "shiguang-photo-album",
  "main": "dist/server/index.js",
  "compatibility_date": "2026-05-15",
  "compatibility_flags": ["nodejs_compat"],
  "no_bundle": true,
  "assets": { "directory": "dist/client" },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "shiguang-photo-album-db",
      "database_id": "d93a38a5-8ad0-49d0-af7e-3d29f2e4c950"
    }
  ],
  "observability": { "enabled": true }
}
```

Remove `"r2": "PHOTOS"` from `.openai/hosting.json`.

Create `.dev.vars.example` with blank example values for all six admin and Cloudinary keys. Add `.dev.vars.local` to `.gitignore` only if the interactive helper uses it; never add real values to the example.

- [ ] **Step 4: Add an interactive secret helper**

`scripts/configure-production.ps1` must:

- prepend Node 24 to PATH;
- set the configured local proxy for Wrangler requests;
- call `npx wrangler secret put <KEY> --config wrangler.deploy.jsonc` separately for `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`;
- never echo secret values, persist them, or accept them as command-line arguments.

- [ ] **Step 5: Run the configuration test**

Run:

```powershell
node --test tests/hosting-config.test.mjs
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add .openai/hosting.json .dev.vars.example .gitignore wrangler.deploy.jsonc scripts/configure-production.ps1 tests/hosting-config.test.mjs
git commit -m "chore: configure Cloudflare deployment without R2"
```

### Task 5: Full verification and production deployment

**Files:**
- No source change expected

- [ ] **Step 1: Run the complete verification suite**

Run:

```powershell
$env:PATH='C:\Program Files\nvm\v24.9.0;'+$env:PATH
npm test
npm run lint
npm run build
```

Expected: all tests pass, lint exits 0, and production build exits 0.

- [ ] **Step 2: Configure secrets interactively**

Run the helper in a visible PowerShell window. The user obtains Cloud name, API Key, and API Secret from the Cloudinary dashboard and types them only into the Wrangler prompts. The user must not paste the API Secret into chat.

Expected: Wrangler confirms that each secret was uploaded.

- [ ] **Step 3: Apply the D1 migration**

Run:

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7890'
$env:HTTP_PROXY='http://127.0.0.1:7890'
npx wrangler d1 execute shiguang-photo-album-db --remote --file drizzle/0000_gorgeous_turbo.sql
```

Expected: all migration statements succeed.

- [ ] **Step 4: Deploy the Worker**

Run:

```powershell
npx wrangler deploy --config wrangler.deploy.jsonc
```

Expected: Wrangler returns a public `workers.dev` URL.

- [ ] **Step 5: Verify anonymous and administrator paths**

Verify with fresh HTTP requests:

- `GET /` returns 200 without a Cloudflare account session.
- `GET /api/albums` returns 200 and an empty album array.
- `POST /api/admin/login` with the configured administrator credentials returns 204.
- An authenticated test album can upload one image under 10 MB.
- `GET /api/photos/<id>` returns a 302 Cloudinary CDN redirect.
- The test photo and album can be deleted successfully.

- [ ] **Step 6: Push the completed source**

```powershell
git status --short
git push origin main
```

Expected: clean working tree and `main` synchronized with GitHub.

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("direct deployment binds D1 without R2", async () => {
  const deploy = JSON.parse(await readFile(new URL("wrangler.deploy.jsonc", root), "utf8"));
  const hosting = JSON.parse(await readFile(new URL(".openai/hosting.json", root), "utf8"));
  assert.equal(deploy.main, "dist/server/index.js");
  assert.deepEqual(deploy.rules, [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"] }]);
  assert.equal(deploy.d1_databases[0].binding, "DB");
  assert.equal(deploy.d1_databases[0].database_id, "d93a38a5-8ad0-49d0-af7e-3d29f2e4c950");
  assert.equal(deploy.d1_databases[0].migrations_dir, "drizzle");
  assert.equal("r2_buckets" in deploy, false);
  assert.equal("r2" in hosting, false);
});

test("example environment documents every required value without secrets", async () => {
  const example = await readFile(new URL(".dev.vars.example", root), "utf8");
  for (const key of [
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD_HASH",
    "ADMIN_PASSWORD_SALT",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ]) {
    assert.match(example, new RegExp(`^${key}=$`, "m"));
  }
  assert.doesNotMatch(example, /476875372|Hm!txeCm|secret-456/);
});

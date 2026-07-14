import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("build emits the application worker", async () => {
  await access(new URL("dist/server/index.js", root));
  await access(new URL("dist/client", root));
});

test("application shell contains final album metadata and content", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(layout, /title:\s*"拾光册"/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(page, /把日子，装订成册/);
  assert.match(page, /<main/);
  assert.doesNotMatch(layout + page + packageJson, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

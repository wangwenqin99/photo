import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public album routes expose read methods", async () => {
  const albums = await source("app/api/albums/route.ts");
  const album = await source("app/api/albums/[albumId]/route.ts");
  const photo = await source("app/api/photos/[photoId]/route.ts");
  assert.match(albums, /export async function GET/);
  assert.match(album, /export async function GET/);
  assert.match(photo, /export async function GET/);
});

test("every modifying route requires administrator access", async () => {
  const files = [
    "app/api/albums/route.ts",
    "app/api/albums/[albumId]/route.ts",
    "app/api/admin/albums/[albumId]/photos/route.ts",
    "app/api/admin/photos/[photoId]/route.ts",
    "app/api/admin/albums/[albumId]/order/route.ts",
  ];
  for (const file of files) assert.match(await source(file), /requireAdmin\(/, file);
});

test("upload validates images and cleans up failed metadata writes", async () => {
  const upload = await source("app/api/admin/albums/[albumId]/photos/route.ts");
  assert.match(upload, /validateImage\(/);
  assert.match(upload, /deletePhoto\(/);
  assert.match(upload, /failed/);
});

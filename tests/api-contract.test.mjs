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

test("photo metadata and default cover update use one D1 batch", async () => {
  const db = await source("lib/db.ts");
  assert.match(db, /export async function insertPhoto[\s\S]*?db\.batch\(/);
});

test("cover changes validate photo ownership", async () => {
  const album = await source("app/api/albums/[albumId]/route.ts");
  assert.match(album, /getPhotoRecord/);
  assert.match(album, /coverPhoto\.albumId !== albumId/);
});

test("Cloudinary deletion failures are recorded", async () => {
  const album = await source("app/api/albums/[albumId]/route.ts");
  const photo = await source("app/api/admin/photos/[photoId]/route.ts");
  assert.match(album, /Cloudinary album cleanup failed/);
  assert.match(photo, /Cloudinary photo cleanup failed/);
});

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

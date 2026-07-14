import test from "node:test";
import assert from "node:assert/strict";
import { deletePhoto, getPhoto, putPhoto } from "../lib/storage.ts";

function fakeBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value, options) { objects.set(key, { value, options }); },
    async get(key) {
      const item = objects.get(key);
      return item ? { body: item.value, httpMetadata: item.options?.httpMetadata } : null;
    },
    async delete(key) { objects.delete(key); },
  };
}

test("stores photos under an album-scoped opaque key", async () => {
  const bucket = fakeBucket();
  const key = await putPhoto(bucket, "album-1", new Blob(["photo"], { type: "image/jpeg" }));
  assert.match(key, /^albums\/album-1\/[0-9a-f-]{36}$/);
  assert.equal(bucket.objects.has(key), true);
});

test("reads and deletes stored photos", async () => {
  const bucket = fakeBucket();
  const key = await putPhoto(bucket, "album-2", new Blob(["photo"], { type: "image/png" }));
  assert.ok(await getPhoto(bucket, key));
  await deletePhoto(bucket, key);
  assert.equal(await getPhoto(bucket, key), null);
});

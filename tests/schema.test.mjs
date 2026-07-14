import test from "node:test";
import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { albums, photos, adminSessions } from "../db/schema.ts";

test("defines album, photo, and admin session tables", () => {
  assert.equal(albums.id.name, "id");
  assert.equal(albums.coverPhotoId.name, "cover_photo_id");
  assert.equal(photos.albumId.name, "album_id");
  assert.equal(photos.objectKey.name, "object_key");
  assert.equal(adminSessions.tokenHash.name, "token_hash");
});

test("indexes photo ordering and object keys", () => {
  const config = getTableConfig(photos);
  const indexNames = config.indexes.map((index) => index.config.name);
  assert.ok(indexNames.includes("photos_album_order_idx"));
  assert.ok(indexNames.includes("photos_object_key_unique"));
});

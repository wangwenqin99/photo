import test from "node:test";
import assert from "node:assert/strict";
import {
  cloudinarySignature,
  deletePhoto,
  photoDeliveryUrl,
  putPhoto,
} from "../lib/storage.ts";

const config = {
  CLOUDINARY_CLOUD_NAME: "demo cloud",
  CLOUDINARY_API_KEY: "key-123",
  CLOUDINARY_API_SECRET: "secret-456",
};

test("signs sorted Cloudinary parameters with SHA-1", async () => {
  assert.equal(
    await cloudinarySignature(
      { timestamp: 1700000000, public_id: "albums/a/photo" },
      "secret-456",
    ),
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
  assert.equal(request.init.body.get("api_key"), "key-123");
  assert.equal(request.init.body.get("public_id"), publicId);
  assert.equal(request.init.body.get("timestamp"), "1700000000");
  assert.equal(request.init.body.get("file").name, "one.jpg");
  assert.match(request.init.body.get("signature"), /^[0-9a-f]{40}$/);
});

test("rejects invalid albums and malformed upload responses", async () => {
  const file = new File(["photo"], "one.jpg", { type: "image/jpeg" });
  await assert.rejects(() => putPhoto(config, "../", file), /相册标识无效/);
  await assert.rejects(
    () => putPhoto(config, "album-1", file, {
      fetcher: async () => Response.json({ error: "nope" }, { status: 400 }),
    }),
    /图片上传失败/,
  );
  await assert.rejects(
    () => putPhoto(config, "album-1", file, {
      fetcher: async () => Response.json({ secure_url: "missing public id" }),
    }),
    /图片上传失败/,
  );
});

test("requires complete Cloudinary configuration", async () => {
  const file = new File(["photo"], "one.jpg", { type: "image/jpeg" });
  await assert.rejects(
    () => putPhoto({ ...config, CLOUDINARY_API_SECRET: "" }, "album-1", file),
    /Cloudinary 配置不完整/,
  );
});

test("builds an encoded CDN delivery URL", () => {
  assert.equal(
    photoDeliveryUrl(config, "albums/家庭/photo id"),
    "https://res.cloudinary.com/demo%20cloud/image/upload/albums/%E5%AE%B6%E5%BA%AD/photo%20id",
  );
});

test("sends a signed destroy request", async () => {
  let request;
  await deletePhoto(config, "albums/a/photo", {
    now: () => 1700000000000,
    fetcher: async (url, init) => {
      request = { url, init };
      return Response.json({ result: "ok" });
    },
  });
  assert.equal(request.url, "https://api.cloudinary.com/v1_1/demo%20cloud/image/destroy");
  assert.equal(request.init.body.get("public_id"), "albums/a/photo");
  assert.equal(request.init.body.get("api_key"), "key-123");
  assert.match(request.init.body.get("signature"), /^[0-9a-f]{40}$/);
});

test("accepts already missing deletes and rejects failed deletes", async () => {
  await deletePhoto(config, "albums/a/missing", {
    fetcher: async () => Response.json({ result: "not found" }),
  });
  await assert.rejects(
    () => deletePhoto(config, "albums/a/photo", {
      fetcher: async () => Response.json({ result: "failed" }),
    }),
    /图片删除失败/,
  );
  await assert.rejects(
    () => deletePhoto(config, "albums/a/photo", {
      fetcher: async () => Response.json({ error: "nope" }, { status: 503 }),
    }),
    /图片删除失败/,
  );
});

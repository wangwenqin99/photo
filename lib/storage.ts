export async function putPhoto(bucket: R2Bucket, albumId: string, file: Blob): Promise<string> {
  const safeAlbumId = albumId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeAlbumId) throw new Error("相册标识无效");
  const key = `albums/${safeAlbumId}/${crypto.randomUUID()}`;
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });
  return key;
}

export function getPhoto(bucket: R2Bucket, key: string) {
  return bucket.get(key);
}

export async function deletePhoto(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

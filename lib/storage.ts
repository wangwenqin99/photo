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

function requireConfig(config: CloudinaryConfig): void {
  if (
    !config.CLOUDINARY_CLOUD_NAME?.trim()
    || !config.CLOUDINARY_API_KEY?.trim()
    || !config.CLOUDINARY_API_SECRET?.trim()
  ) {
    throw new Error("Cloudinary 配置不完整");
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function cloudinarySignature(
  params: Record<string, string | number | boolean>,
  secret: string,
): Promise<string> {
  const payload = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`${payload}${secret}`),
  );
  return bytesToHex(new Uint8Array(digest));
}

function endpoint(config: CloudinaryConfig, action: "upload" | "destroy"): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.CLOUDINARY_CLOUD_NAME)}/image/${action}`;
}

export async function putPhoto(
  config: CloudinaryConfig,
  albumId: string,
  file: File | Blob,
  deps: StorageDeps = {},
): Promise<string> {
  requireConfig(config);
  const safeAlbumId = albumId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeAlbumId) throw new Error("相册标识无效");

  const now = deps.now ?? Date.now;
  const randomUUID = deps.randomUUID ?? (() => crypto.randomUUID());
  const fetcher = deps.fetcher ?? fetch;
  const timestamp = Math.floor(now() / 1000);
  const publicId = `albums/${safeAlbumId}/${randomUUID()}`;
  const signature = await cloudinarySignature(
    { public_id: publicId, timestamp },
    config.CLOUDINARY_API_SECRET,
  );
  const form = new FormData();
  form.set("api_key", config.CLOUDINARY_API_KEY);
  form.set("public_id", publicId);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  form.set("file", file);

  try {
    const response = await fetcher(endpoint(config, "upload"), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json().catch(() => null) as { public_id?: unknown } | null;
    if (!response.ok || typeof result?.public_id !== "string" || !result.public_id) {
      throw new Error("invalid upload response");
    }
    return result.public_id;
  } catch {
    throw new Error("图片上传失败，请重试");
  }
}

export function photoDeliveryUrl(config: CloudinaryConfig, publicId: string): string {
  requireConfig(config);
  const encodedId = publicId.split("/").map(encodeURIComponent).join("/");
  if (!encodedId) throw new Error("图片标识无效");
  return `https://res.cloudinary.com/${encodeURIComponent(config.CLOUDINARY_CLOUD_NAME)}/image/upload/${encodedId}`;
}

export async function deletePhoto(
  config: CloudinaryConfig,
  publicId: string,
  deps: Pick<StorageDeps, "fetcher" | "now"> = {},
): Promise<void> {
  requireConfig(config);
  if (!publicId) throw new Error("图片标识无效");
  const now = deps.now ?? Date.now;
  const fetcher = deps.fetcher ?? fetch;
  const timestamp = Math.floor(now() / 1000);
  const signature = await cloudinarySignature(
    { public_id: publicId, timestamp },
    config.CLOUDINARY_API_SECRET,
  );
  const form = new FormData();
  form.set("api_key", config.CLOUDINARY_API_KEY);
  form.set("public_id", publicId);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);

  try {
    const response = await fetcher(endpoint(config, "destroy"), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json().catch(() => null) as { result?: unknown } | null;
    if (!response.ok || (result?.result !== "ok" && result?.result !== "not found")) {
      throw new Error("invalid delete response");
    }
  } catch {
    throw new Error("图片删除失败，请稍后重试");
  }
}

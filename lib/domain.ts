export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function pageSpread(index: number, ids: string[], mobile = false): string[] {
  if (ids.length === 0) return [];
  const size = mobile ? 1 : 2;
  const maxStart = Math.max(0, ids.length - size);
  const requested = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const aligned = mobile ? requested : requested - (requested % 2);
  const start = Math.min(aligned, maxStart - (mobile ? 0 : maxStart % 2));
  return ids.slice(Math.max(0, start), Math.max(0, start) + size);
}

export function normalizeOrder(requested: string[], existing: string[]): string[] {
  const available = new Set(existing);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of requested) {
    if (available.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of existing) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

export function nextCover(current: string | null, remaining: string[]): string | null {
  if (current && remaining.includes(current)) return current;
  return remaining[0] ?? null;
}

export function validateImage(file: { type: string; size: number }):
  | { ok: true }
  | { ok: false; message: string } {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, message: "仅支持 JPG、PNG、WebP 和 GIF 图片" };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, message: "图片文件为空或无效" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "单张图片不能超过 20MB" };
  }
  return { ok: true };
}

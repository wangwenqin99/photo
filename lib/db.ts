export interface AlbumSummary {
  id: string;
  name: string;
  coverPhotoId: string | null;
  photoCount: number;
  updatedAt: number;
}

export interface PhotoRecord {
  id: string;
  albumId: string;
  objectKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  sortOrder: number;
  createdAt: number;
}

function albumFromRow(row: Record<string, unknown>): AlbumSummary {
  return {
    id: String(row.id),
    name: String(row.name),
    coverPhotoId: row.cover_photo_id ? String(row.cover_photo_id) : null,
    photoCount: Number(row.photo_count ?? 0),
    updatedAt: Number(row.updated_at),
  };
}

function photoFromRow(row: Record<string, unknown>): PhotoRecord {
  return {
    id: String(row.id),
    albumId: String(row.album_id),
    objectKey: String(row.object_key),
    originalName: String(row.original_name),
    contentType: String(row.content_type),
    sizeBytes: Number(row.size_bytes),
    sortOrder: Number(row.sort_order),
    createdAt: Number(row.created_at),
  };
}

export async function listAlbums(db: D1Database): Promise<AlbumSummary[]> {
  const result = await db.prepare(`
    SELECT a.id, a.name, a.cover_photo_id, a.updated_at, COUNT(p.id) AS photo_count
    FROM albums a LEFT JOIN photos p ON p.album_id = a.id
    GROUP BY a.id ORDER BY a.updated_at DESC
  `).all();
  return result.results.map((row) => albumFromRow(row as Record<string, unknown>));
}

export async function getAlbum(db: D1Database, albumId: string) {
  const album = await db.prepare(`
    SELECT a.id, a.name, a.cover_photo_id, a.updated_at, COUNT(p.id) AS photo_count
    FROM albums a LEFT JOIN photos p ON p.album_id = a.id
    WHERE a.id = ? GROUP BY a.id
  `).bind(albumId).first();
  if (!album) return null;
  const photos = await db.prepare(`
    SELECT id, album_id, object_key, original_name, content_type, size_bytes, sort_order, created_at
    FROM photos WHERE album_id = ? ORDER BY sort_order ASC, created_at ASC
  `).bind(albumId).all();
  return {
    ...albumFromRow(album as Record<string, unknown>),
    photos: photos.results.map((row) => photoFromRow(row as Record<string, unknown>)),
  };
}

export async function createAlbum(db: D1Database, name: string): Promise<AlbumSummary> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.prepare("INSERT INTO albums (id, name, cover_photo_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)")
    .bind(id, name, now, now).run();
  return { id, name, coverPhotoId: null, photoCount: 0, updatedAt: now };
}

export async function renameAlbum(db: D1Database, albumId: string, name: string): Promise<boolean> {
  const result = await db.prepare("UPDATE albums SET name = ?, updated_at = ? WHERE id = ?")
    .bind(name, Date.now(), albumId).run();
  return result.meta.changes > 0;
}

export async function deleteAlbumRecords(db: D1Database, albumId: string): Promise<string[]> {
  const objects = await db.prepare("SELECT object_key FROM photos WHERE album_id = ?").bind(albumId).all();
  await db.prepare("DELETE FROM albums WHERE id = ?").bind(albumId).run();
  return objects.results.map((row) => String((row as Record<string, unknown>).object_key));
}

export async function insertPhoto(db: D1Database, input: Omit<PhotoRecord, "createdAt">): Promise<PhotoRecord> {
  const createdAt = Date.now();
  await db.prepare(`
    INSERT INTO photos (id, album_id, object_key, original_name, content_type, size_bytes, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(input.id, input.albumId, input.objectKey, input.originalName, input.contentType, input.sizeBytes, input.sortOrder, createdAt).run();
  await db.prepare(`
    UPDATE albums SET cover_photo_id = COALESCE(cover_photo_id, ?), updated_at = ? WHERE id = ?
  `).bind(input.id, createdAt, input.albumId).run();
  return { ...input, createdAt };
}

export async function deletePhotoRecord(db: D1Database, photoId: string) {
  const photo = await db.prepare("SELECT id, album_id, object_key FROM photos WHERE id = ?").bind(photoId).first();
  if (!photo) return null;
  await db.prepare("DELETE FROM photos WHERE id = ?").bind(photoId).run();
  const remaining = await db.prepare("SELECT id FROM photos WHERE album_id = ? ORDER BY sort_order ASC")
    .bind(String(photo.album_id)).all();
  return {
    albumId: String(photo.album_id),
    objectKey: String(photo.object_key),
    remainingIds: remaining.results.map((row) => String((row as Record<string, unknown>).id)),
  };
}

export async function setCover(db: D1Database, albumId: string, photoId: string | null): Promise<void> {
  await db.prepare("UPDATE albums SET cover_photo_id = ?, updated_at = ? WHERE id = ?")
    .bind(photoId, Date.now(), albumId).run();
}

export async function reorderPhotos(db: D1Database, albumId: string, ids: string[]): Promise<void> {
  const statements = ids.map((id, index) => db.prepare(
    "UPDATE photos SET sort_order = ? WHERE id = ? AND album_id = ?",
  ).bind(index, id, albumId));
  if (statements.length) await db.batch(statements);
  await db.prepare("UPDATE albums SET updated_at = ? WHERE id = ?").bind(Date.now(), albumId).run();
}

export async function createSession(db: D1Database, id: string, tokenHash: string, expiresAt: number): Promise<void> {
  await db.prepare("INSERT INTO admin_sessions (id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, tokenHash, expiresAt, Date.now()).run();
}

export async function findSession(db: D1Database, tokenHash: string) {
  return db.prepare("SELECT id, expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, Date.now()).first<{ id: string; expires_at: number }>();
}

export async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
}

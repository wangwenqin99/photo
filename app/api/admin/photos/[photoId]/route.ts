import { requireAdmin } from "@/lib/auth";
import { deletePhotoRecord, getPhotoRecord, setCover } from "@/lib/db";
import { nextCover } from "@/lib/domain";
import { getRuntimeEnv } from "@/lib/runtime";
import { deletePhoto } from "@/lib/storage";

type Context = { params: Promise<{ photoId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  try { await requireAdmin(request, env); } catch { return Response.json({ error: "请先登录" }, { status: 401 }); }
  const photo = await getPhotoRecord(env.DB, (await params).photoId);
  if (!photo) return Response.json({ error: "照片不存在" }, { status: 404 });
  await setCover(env.DB, photo.albumId, photo.id);
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  try { await requireAdmin(request, env); } catch { return Response.json({ error: "请先登录" }, { status: 401 }); }
  const photoId = (await params).photoId;
  const deleted = await deletePhotoRecord(env.DB, photoId);
  if (!deleted) return Response.json({ error: "照片不存在" }, { status: 404 });
  const album = await (await import("@/lib/db")).getAlbum(env.DB, deleted.albumId);
  await setCover(env.DB, deleted.albumId, nextCover(album?.coverPhotoId ?? null, deleted.remainingIds));
  await deletePhoto(env.PHOTOS, deleted.objectKey).catch((error) => {
    console.error("R2 photo cleanup failed", { key: deleted.objectKey, error });
  });
  return new Response(null, { status: 204 });
}

import { requireAdmin } from "@/lib/auth";
import { deleteAlbumRecords, getAlbum, getPhotoRecord, renameAlbum, setCover } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime";
import { deletePhoto } from "@/lib/storage";

type Context = { params: Promise<{ albumId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { albumId } = await params;
  const album = await getAlbum(getRuntimeEnv().DB, albumId);
  return album ? Response.json({ album }) : Response.json({ error: "相册不存在" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  try { await requireAdmin(request, env); } catch { return Response.json({ error: "请先登录" }, { status: 401 }); }
  const { albumId } = await params;
  const input = await request.json().catch(() => ({})) as { name?: string; coverPhotoId?: string | null };
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name || name.length > 80) return Response.json({ error: "相册名称无效" }, { status: 400 });
    if (!(await renameAlbum(env.DB, albumId, name))) return Response.json({ error: "相册不存在" }, { status: 404 });
  }
  if ("coverPhotoId" in input) {
    if (input.coverPhotoId) {
      const coverPhoto = await getPhotoRecord(env.DB, input.coverPhotoId);
      if (!coverPhoto || coverPhoto.albumId !== albumId) {
        return Response.json({ error: "封面照片不属于当前相册" }, { status: 400 });
      }
    }
    await setCover(env.DB, albumId, input.coverPhotoId ?? null);
  }
  return Response.json({ album: await getAlbum(env.DB, albumId) });
}

export async function DELETE(request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  try { await requireAdmin(request, env); } catch { return Response.json({ error: "请先登录" }, { status: 401 }); }
  const { albumId } = await params;
  const keys = await deleteAlbumRecords(env.DB, albumId);
  const deleted = await Promise.allSettled(keys.map((key) => deletePhoto(env, key)));
  deleted.forEach((result, index) => {
    if (result.status === "rejected") console.error("Cloudinary album cleanup failed", { key: keys[index], error: result.reason });
  });
  return new Response(null, { status: 204 });
}

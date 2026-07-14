import { requireAdmin } from "@/lib/auth";
import { getAlbum, reorderPhotos } from "@/lib/db";
import { normalizeOrder } from "@/lib/domain";
import { getRuntimeEnv } from "@/lib/runtime";

type Context = { params: Promise<{ albumId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  try { await requireAdmin(request, env); } catch { return Response.json({ error: "请先登录" }, { status: 401 }); }
  const { albumId } = await params;
  const album = await getAlbum(env.DB, albumId);
  if (!album) return Response.json({ error: "相册不存在" }, { status: 404 });
  const input = await request.json().catch(() => ({})) as { ids?: unknown };
  if (!Array.isArray(input.ids) || !input.ids.every((id) => typeof id === "string")) {
    return Response.json({ error: "照片顺序无效" }, { status: 400 });
  }
  const order = normalizeOrder(input.ids, album.photos.map((photo) => photo.id));
  await reorderPhotos(env.DB, albumId, order);
  return Response.json({ ids: order });
}

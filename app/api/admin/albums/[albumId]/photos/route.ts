import { requireAdmin } from "@/lib/auth";
import { getAlbum, insertPhoto } from "@/lib/db";
import { validateImage } from "@/lib/domain";
import { getRuntimeEnv } from "@/lib/runtime";
import { deletePhoto, putPhoto } from "@/lib/storage";

type Context = { params: Promise<{ albumId: string }> };

export async function POST(request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  try { await requireAdmin(request, env); } catch { return Response.json({ error: "请先登录" }, { status: 401 }); }
  const { albumId } = await params;
  const album = await getAlbum(env.DB, albumId);
  if (!album) return Response.json({ error: "相册不存在" }, { status: 404 });
  const form = await request.formData();
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) return Response.json({ error: "请选择图片" }, { status: 400 });

  const uploaded: Array<{ id: string; originalName: string }> = [];
  const failed: Array<{ originalName: string; error: string }> = [];
  let sortOrder = album.photos.length;

  for (let offset = 0; offset < files.length; offset += 3) {
    await Promise.all(files.slice(offset, offset + 3).map(async (file) => {
      const validation = validateImage(file);
      if (!validation.ok) {
        failed.push({ originalName: file.name, error: validation.message });
        return;
      }
      let objectKey: string | null = null;
      try {
        objectKey = await putPhoto(env.PHOTOS, albumId, file);
        const id = crypto.randomUUID();
        await insertPhoto(env.DB, {
          id,
          albumId,
          objectKey,
          originalName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          sortOrder: sortOrder++,
        });
        uploaded.push({ id, originalName: file.name });
      } catch {
        if (objectKey) await deletePhoto(env.PHOTOS, objectKey).catch(() => undefined);
        failed.push({ originalName: file.name, error: "上传失败，请重试" });
      }
    }));
  }
  return Response.json({ uploaded, failed }, { status: failed.length ? 207 : 201 });
}

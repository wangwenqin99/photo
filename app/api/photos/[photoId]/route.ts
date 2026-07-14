import { getPhotoRecord } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime";
import { getPhoto } from "@/lib/storage";

type Context = { params: Promise<{ photoId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  const photo = await getPhotoRecord(env.DB, (await params).photoId);
  if (!photo) return new Response("照片不存在", { status: 404 });
  const object = await getPhoto(env.PHOTOS, photo.objectKey);
  if (!object) return new Response("照片文件不存在", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(photo.sizeBytes),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

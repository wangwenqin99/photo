import { getPhotoRecord } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime";
import { photoDeliveryUrl } from "@/lib/storage";

type Context = { params: Promise<{ photoId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const env = getRuntimeEnv();
  const photo = await getPhotoRecord(env.DB, (await params).photoId);
  if (!photo) return new Response("照片不存在", { status: 404 });
  const url = photoDeliveryUrl(env, photo.objectKey);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

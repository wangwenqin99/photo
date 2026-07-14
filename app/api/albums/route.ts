import { requireAdmin } from "@/lib/auth";
import { createAlbum, listAlbums } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime";

export async function GET() {
  return Response.json({ albums: await listAlbums(getRuntimeEnv().DB) });
}

export async function POST(request: Request) {
  const env = getRuntimeEnv();
  try { await requireAdmin(request, env); } catch { return Response.json({ error: "请先登录" }, { status: 401 }); }
  const input = await request.json().catch(() => ({})) as { name?: string };
  const name = input.name?.trim();
  if (!name || name.length > 80) return Response.json({ error: "请输入 1 至 80 个字的相册名称" }, { status: 400 });
  return Response.json({ album: await createAlbum(env.DB, name) }, { status: 201 });
}

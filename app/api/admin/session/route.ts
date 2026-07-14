import { isAdmin } from "@/lib/auth";
import { getRuntimeEnv } from "@/lib/runtime";

export async function GET(request: Request) {
  return Response.json({ authenticated: await isAdmin(request, getRuntimeEnv()) });
}

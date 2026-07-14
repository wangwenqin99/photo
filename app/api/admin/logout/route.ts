import { clearSessionCookie, destroyAdminSession } from "../../../../lib/auth";
import { getRuntimeEnv } from "../../../../lib/runtime";

export async function POST(request: Request) {
  const env = getRuntimeEnv();
  await destroyAdminSession(request, env.DB);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

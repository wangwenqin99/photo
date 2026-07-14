import { createAdminSession, sessionCookie, verifyAdminCredentials } from "../../../../lib/auth";
import { getRuntimeEnv } from "../../../../lib/runtime";

export async function POST(request: Request) {
  const env = getRuntimeEnv();
  let input: { email?: string; password?: string };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "登录信息不正确" }, { status: 401 });
  }
  const valid = await verifyAdminCredentials(input.email ?? "", input.password ?? "", env);
  if (!valid) return Response.json({ error: "登录信息不正确" }, { status: 401 });

  const { token, expiresAt } = await createAdminSession(env.DB);
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": sessionCookie(token, expiresAt) },
  });
}

import { env } from "cloudflare:workers";

export interface AppEnv {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_PASSWORD_SALT: string;
}

export function getRuntimeEnv(): AppEnv {
  return env as unknown as AppEnv;
}

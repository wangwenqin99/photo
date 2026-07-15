import { env } from "cloudflare:workers";

export interface AppEnv {
  DB: D1Database;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD_HASH: string;
  ADMIN_PASSWORD_SALT: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

export function getRuntimeEnv(): AppEnv {
  return env as unknown as AppEnv;
}

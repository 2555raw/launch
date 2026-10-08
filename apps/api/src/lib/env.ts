import { loadEnv, type Env } from '@launch/config';

let env: Env | null = null;
export function getEnv(): Env {
  if (!env) env = loadEnv();
  return env;
}

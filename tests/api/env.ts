import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../../.env.test', import.meta.url));

/** Reads TEST_DATABASE_URL from .env.test when it is not already set in the environment. */
export function loadTestEnv() {
  if (!process.env.TEST_DATABASE_URL && existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}

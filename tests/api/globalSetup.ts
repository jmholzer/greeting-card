import { execFileSync } from 'node:child_process';

/** Creates a fresh schema in the test database once, before any API test runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. The API tests need a throwaway Postgres database, ' +
        'see "Running tests" in README.md.',
    );
  }
  // The schema is reset on every run, so refuse anything that is not clearly a test database.
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL must point at a database whose name ends in "_test", got "${name}".`);
  }

  process.env.POSTGRES_PRISMA_URL = url;
  process.env.POSTGRES_URL_NON_POOLING = url;
  execFileSync('npx', ['prisma', 'db', 'push', '--force-reset', '--skip-generate'], {
    stdio: 'inherit',
    env: process.env,
  });
}

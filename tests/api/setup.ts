import { afterAll, afterEach, beforeEach, vi } from 'vitest';
import { loadTestEnv } from './env';

loadTestEnv();
// Set before lib/prisma.ts is first imported, so the client connects to the test database.
process.env.POSTGRES_PRISMA_URL = process.env.TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = process.env.TEST_DATABASE_URL;
// On Vercel the client address comes from x-vercel-forwarded-for, which the tests set per request.
process.env.VERCEL = '1';
process.env.ADMIN_TOKEN = 'test-admin-token';

// after() only works inside a Next request. Run each callback straight away instead, and keep
// its promise so every test waits for it before the database is wiped for the next one.
const pending = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => {
    pending.push(Promise.resolve().then(callback));
  },
}));

const { default: prisma } = await import('@/lib/prisma');

async function settleAfterCallbacks() {
  await Promise.allSettled(pending.splice(0));
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Message", "RateLimit" RESTART IDENTITY');
});

afterEach(settleAfterCallbacks);

afterAll(async () => {
  await settleAfterCallbacks();
  await prisma.$disconnect();
});

import { afterAll, beforeEach, vi } from 'vitest';

// Set before lib/prisma.ts is first imported, so the client connects to the test database.
process.env.POSTGRES_PRISMA_URL = process.env.TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = process.env.TEST_DATABASE_URL;
// On Vercel the client address comes from x-vercel-forwarded-for, which the tests set per request.
process.env.VERCEL = '1';
process.env.ADMIN_TOKEN = 'test-admin-token';

// after() only works inside a Next request, so run the callback straight away.
vi.mock('next/server', () => ({
  after: (callback: () => unknown) => {
    void callback();
  },
}));

const { default: prisma } = await import('@/lib/prisma');

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE "Message", "RateLimit" RESTART IDENTITY');
});

afterAll(async () => {
  await prisma.$disconnect();
});

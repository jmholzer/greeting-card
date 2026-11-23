import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        // Pure modules, no database. Fast enough to run on every save.
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: ['node_modules/**', '.next/**', 'tests/api/**'],
        },
      },
      {
        // Route handlers called directly against a real Postgres (TEST_DATABASE_URL).
        extends: true,
        test: {
          name: 'api',
          environment: 'node',
          include: ['tests/api/**/*.test.ts'],
          globalSetup: ['tests/api/globalSetup.ts'],
          setupFiles: ['tests/api/setup.ts'],
          // The files share one database, so they run one after another.
          fileParallelism: false,
          hookTimeout: 30000,
        },
      },
    ],
  },
});

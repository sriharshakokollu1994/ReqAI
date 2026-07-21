import type { Config } from 'jest';

const config: Config = {
  preset:              'ts-jest',
  testEnvironment:     'node',
  rootDir:             '.',
  testMatch:           ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        // Relax strict settings for tests to reduce fixture boilerplate
        strict: true,
        esModuleInterop: true,
      },
    }],
  },
  // Collect coverage from source (not tests, not generated files)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/server.ts',
    '!src/infrastructure/database/migrations/**',
  ],
  coverageReporters:   ['text', 'lcov', 'html'],
  coverageDirectory:   'coverage',
  // Each test file runs in its own VM context — prevents state leakage
  resetMocks:          true,
  restoreMocks:        true,
  clearMocks:          true,
  // Increase timeout for async tests that exercise promise chains
  testTimeout:         10_000,
  // Suppress Winston console output in tests
  setupFiles:          ['<rootDir>/src/__tests__/setup/env.setup.ts'],
  verbose:             true,
};

export default config;

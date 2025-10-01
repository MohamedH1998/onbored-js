/** @type {import('jest').Config} */
export default {
  // Test environment - custom environment with fetch polyfills
  testEnvironment: './jest-environment-with-fetch.cjs',

  // Test environment options to fix MSW module resolution
  testEnvironmentOptions: {
    customExportConditions: [''],
    url: 'http://localhost',
    userAgent: 'Mozilla/5.0 (jsdom)',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  // Module name mapping for clean imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@react/(.*)$': '<rootDir>/src/react/$1',
  },

  // Resolve package exports properly
  resolver: 'ts-jest-resolver',

  // Test file patterns - only match .test and .spec files
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],

  // Explicitly ignore utility and setup files
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/mocks/',
    '/__tests__/utils/',
    '/__tests__/setup\\.ts$',
    '\\.d\\.ts$',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/index.ts',
  ],

  // Coverage thresholds - focused on core functionality
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Transform configuration - updated to modern format
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true,
      },
    ],
    // Transform ESM JS files from node_modules
    '^.+\\.js$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true,
      },
    ],
  },

  // Transform ESM modules from node_modules (needed for MSW and its dependencies)
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|msw|@mswjs|@bundled-es-modules|until-async|strict-event-emitter|uuid))',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for better debugging
  verbose: true,

  // Test timeout
  testTimeout: 10000,

  // Extensions to treat as ESM
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

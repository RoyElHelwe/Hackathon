module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.(spec|test)\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  moduleNameMapper: { '^@tajriba/shared$': '<rootDir>/../../packages/shared/src' },
  transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: { warnOnly: true } }] },
  testTimeout: 30000,
};

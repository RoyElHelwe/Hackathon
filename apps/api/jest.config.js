module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*\\.(spec|test)\\.ts$',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  moduleNameMapper: { '^@tajriba/shared$': '<rootDir>/../../packages/shared/src' },
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  testTimeout: 30000,
};

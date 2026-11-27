// Jest settings for the security rules tests (plain Node, no transforms).
// Run with: npm run test:rules
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  transform: {},
  testTimeout: 30000,
};

// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests/ui',
  timeout: 30000,
  reporter: 'list',
  use: {
    headless: true,
    navigationTimeout: 15000,
  },
};

module.exports = config;

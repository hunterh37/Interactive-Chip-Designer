import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 1,
  workers: 1, fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_WEB || 'https://chipdesigner-web.onrender.com',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'host-desktop', testMatch: /host\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-15', testMatch: /phone\.spec\.js/, use: { ...devices['iPhone 15'] } },
    { name: 'pixel-7', testMatch: /phone\.spec\.js/, use: { ...devices['Pixel 7'] } },
    { name: 'multi', testMatch: /multi\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'paint6', testMatch: /paint6\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'crowd', testMatch: /crowd\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'console-desktop', testMatch: /console\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
  ],
});

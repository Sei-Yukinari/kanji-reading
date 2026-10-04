import { defineConfig, devices } from "@playwright/test";

// static export の成果物(out/)を配信してテストする。事前に npm run build が必要
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npx serve out -l 4173 --no-clipboard",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] }, testIgnore: /ios\.spec\.ts/ },
    { name: "tablet-landscape", use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 }, hasTouch: true }, testIgnore: /ios\.spec\.ts/ },
    // iOS Safari 相当(NFR-004)。iOS 固有の起動フローのみ
    { name: "iphone", use: { ...devices["iPhone 15"] }, testMatch: /ios\.spec\.ts/ },
  ],
});

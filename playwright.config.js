const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

const PORT = 3100; // different from the dev server (3000) so they never clash
const SUBS_FILE = path.join(__dirname, "e2e", ".tmp", "subscribers.json");

module.exports = defineConfig({
  testDir: "./e2e",
  globalSetup: require.resolve("./e2e/global-setup.js"),
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Starts the real production server. Run `npm run build` first so client/dist exists.
  webServer: {
    command: "node server/index.js",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      SUBS_FILE,
      MONGODB_URI: "", // always use the file store, never a real database
      RESEND_API_KEY: "", // never send real email
      MAIL_FROM: "",
      ADMIN_TOKEN: "",
    },
  },
});
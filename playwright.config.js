// Playwright config — e2e tests for the practice app.
// Uses the locally installed Chrome (channel: 'chrome'), zero extra browsers.
module.exports = {
  testDir: 'tests',
  timeout: 45000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8461',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'python3 serve.py',
    url: 'http://127.0.0.1:8461',
    reuseExistingServer: true,
    timeout: 10000,
  },
};

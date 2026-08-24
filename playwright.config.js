module.exports = {
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:8791",
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 900 }
  }
};

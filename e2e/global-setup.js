const fs = require("fs");
const path = require("path");

// Start every run with an empty subscriber list
module.exports = async () => {
  const dir = path.join(__dirname, ".tmp");
  fs.mkdirSync(dir, { recursive: true });
  fs.rmSync(path.join(dir, "subscribers.json"), { force: true });
};
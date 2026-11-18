const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "rad",
      script: "./node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3010",
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "900M",
      kill_timeout: 5000,
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "3010",
      },
    },
  ],
};

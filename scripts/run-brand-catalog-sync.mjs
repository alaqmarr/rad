import { spawnSync } from "node:child_process";

const extraArgs = process.argv.slice(2);
const args = ["tsx", "scripts/sync-catalog.ts", ...(extraArgs.length ? extraArgs : ["--full"])];
const res = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(res.status ?? 0);

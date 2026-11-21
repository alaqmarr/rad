import { spawnSync } from "node:child_process";

const steps = [
  ["npx", ["tsx", "scripts/load-brand-logos.ts"]],
  ["npx", ["tsx", "scripts/load-taparia-toolbuy.ts"]],
  ["npx", ["tsx", "scripts/load-stanley-tools.ts"]],
  ["npx", ["tsx", "scripts/load-tb-brands.ts"]],
  ["npx", ["tsx", "scripts/load-bostik.ts"]],
  ["npx", ["tsx", "scripts/load-loctite.ts"]],
  ["npx", ["tsx", "scripts/load-jindal-stainless.ts"]],
  ["npx", ["tsx", "scripts/load-godrej-storage.ts"]],
  ["npx", ["tsx", "scripts/load-supreme-industries.ts"]],
  ["npx", ["tsx", "scripts/load-polycab.ts"]],
  ["npx", ["tsx", "scripts/load-havells.ts"]],
  ["npx", ["tsx", "scripts/load-festo.ts"]],
  ["npx", ["tsx", "scripts/load-kirloskar.ts"]],
  ["npx", ["tsx", "scripts/load-honeywell-safety.ts"]],
  ["npx", ["tsx", "scripts/load-ntn.ts"]],
  ["npx", ["tsx", "scripts/load-lt-brands.ts"]],
  ["npx", ["tsx", "scripts/load-agri-brands.ts"]],
  ["npx", ["tsx", "scripts/load-fasteners-seals-adhesives.ts"]],
  ["npx", ["tsx", "scripts/import-catalog-bundle.ts"]],
  ["npx", ["tsx", "scripts/clean-db-text-and-leadtime.ts"]],
  ["npx", ["tsx", "scripts/enrich-buyer-seo.ts"]],
  ["npx", ["tsx", "scripts/optimize-db.ts"]],
  ["npx", ["tsx", "scripts/verify-catalog.ts"]],
];

for (const [cmd, args] of steps) {
  console.log(`\n>>> Running: ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.warn(`Step exited with code ${res.status}: ${args.join(" ")}`);
  }
}

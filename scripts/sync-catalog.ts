import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { eq, sql } from "drizzle-orm";
import { brands, db, products } from "../src/db";

interface StepSpec {
  id: string;
  script: string;
  args?: string[];
  brands: string[]; // "*" means global/multi-brand
  tier: "fast" | "full";
}

const LOADER_STEPS: StepSpec[] = [
  { id: "brand-logos", script: "scripts/load-brand-logos.ts", brands: ["*"], tier: "fast" },
  {
    id: "online-expansion",
    script: "scripts/load-online-catalog-expansion.ts",
    brands: [
      "fevicol",
      "feviseal",
      "fevibond",
      "dowsil",
      "fevi-quick",
      "3m-industrial",
      "unbrako",
      "dowty",
    ],
    tier: "fast",
  },
  {
    id: "fasteners-seals-adhesives",
    script: "scripts/load-fasteners-seals-adhesives.ts",
    brands: ["unbrako", "dowty", "fevicol", "3m-industrial", "esab"],
    tier: "fast",
  },
  { id: "jindal-stainless", script: "scripts/load-jindal-stainless.ts", brands: ["jindal-stainless"], tier: "fast" },
  { id: "taparia", script: "scripts/load-taparia-toolbuy.ts", brands: ["taparia"], tier: "full" },
  { id: "stanley", script: "scripts/load-stanley-tools.ts", brands: ["stanley-black-decker"], tier: "full" },
  {
    id: "tb-brands",
    script: "scripts/load-tb-brands.ts",
    brands: [
      "fluke",
      "norton-abrasives",
      "fenner-india",
      "skf",
      "esab",
      "3m-industrial",
      "bosch-professional",
      "makita",
      "mitutoyo",
      "black-decker",
      "dewalt",
      "hikoki",
      "addison",
      "freemans",
      "alko-plus",
      "tooltech",
      "ecodrive",
      "poly-f-plus",
      "dowsil",
      "fevicol",
      "feviseal",
      "fevi-quick",
      "mseal",
      "fevibond",
    ],
    tier: "full",
  },
  { id: "bostik", script: "scripts/load-bostik.ts", brands: ["bostik"], tier: "full" },
  { id: "loctite", script: "scripts/load-loctite.ts", brands: ["loctite-henkel"], tier: "full" },
  { id: "godrej-storage", script: "scripts/load-godrej-storage.ts", brands: ["godrej-storage"], tier: "full" },
  { id: "supreme", script: "scripts/load-supreme-industries.ts", brands: ["supreme-industries"], tier: "full" },
  { id: "polycab", script: "scripts/load-polycab.ts", brands: ["polycab"], tier: "full" },
  { id: "havells", script: "scripts/load-havells.ts", brands: ["havells"], tier: "full" },
  { id: "festo", script: "scripts/load-festo.ts", brands: ["festo"], tier: "full" },
  { id: "kirloskar", script: "scripts/load-kirloskar.ts", brands: ["kirloskar"], tier: "full" },
  { id: "honeywell", script: "scripts/load-honeywell-safety.ts", brands: ["honeywell-safety"], tier: "full" },
  { id: "ntn", script: "scripts/load-ntn.ts", brands: ["ntn"], tier: "full" },
  { id: "lt-brands", script: "scripts/load-lt-brands.ts", brands: ["lt-valves", "lt-switchgear"], tier: "full" },
  {
    id: "agri-brands",
    script: "scripts/load-agri-brands.ts",
    brands: ["netafim", "falcon-agri", "jain-irrigation"],
    tier: "full",
  },
  { id: "dmc-tools", script: "scripts/load-dmc-tools.ts", brands: ["dmc-tools"], tier: "full" },
  { id: "gazelle", script: "scripts/load-gazelle-industrial.ts", brands: ["gazelle-industrial"], tier: "full" },
  { id: "karam", script: "scripts/load-karam-safety.ts", brands: ["karam"], tier: "full" },
  { id: "udyogi", script: "scripts/load-udyogi-safety.ts", brands: ["udyogi"], tier: "full" },
  { id: "sterila", script: "scripts/load-sterila-tools.ts", brands: ["sterila"], tier: "full" },
  { id: "catalog-bundle", script: "scripts/import-catalog-bundle.ts", brands: ["*"], tier: "full" },
];

const POST_STEPS = [
  { id: "clean-text", script: "scripts/clean-db-text-and-leadtime.ts", args: [] as string[] },
  { id: "enrich-seo", script: "scripts/enrich-buyer-seo.ts", args: [] as string[] },
  { id: "optimize-db", script: "scripts/optimize-db.ts", args: [] as string[] },
  { id: "verify-catalog", script: "scripts/verify-catalog.ts", args: ["--strict"] },
];

async function snapshotBrandCounts(): Promise<Map<string, { name: string; count: number }>> {
  const rows = await db
    .select({
      slug: brands.slug,
      name: brands.name,
      count: sql<number>`count(${products.id})`,
    })
    .from(brands)
    .leftJoin(products, sql`${products.brandId} = ${brands.id} AND ${products.isActive} = 1`)
    .where(eq(brands.isActive, true))
    .groupBy(brands.id);

  const map = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    map.set(r.slug, { name: r.name, count: Number(r.count || 0) });
  }
  return map;
}

function runTsxStep(script: string, extraArgs: string[] = []): { ok: boolean; code: number; ms: number } {
  const t0 = performance.now();
  const cmdArgs = ["tsx", script, ...extraArgs];
  console.log(`\n>>> [sync-catalog] Running: npx ${cmdArgs.join(" ")}`);
  const res = spawnSync("npx", cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const ms = Math.round(performance.now() - t0);
  const code = res.status ?? 1;
  if (code !== 0) {
    console.warn(`WARN: Step '${script}' exited with code ${code} (${(ms / 1000).toFixed(1)}s)`);
  }
  return { ok: code === 0, code, ms };
}

async function pingSitemaps(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  for (const p of ["/sitemap.xml", "/sitemap/core.xml"]) {
    const url = `${cleanBase}${p}`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      console.log(`[sync-catalog] Sitemap warm-up ${url} -> HTTP ${r.status}`);
    } catch (e: any) {
      console.warn(`[sync-catalog] Sitemap warm-up failed for ${url}: ${e?.message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isFull = args.includes("--full");
  const isPostOnly = args.includes("--post-only");
  const skipPost = args.includes("--skip-post");
  const brandArg = args.find((a) => a.startsWith("--brands="));
  const pingArg = args.find((a) => a.startsWith("--ping="));
  const targetBrands = brandArg
    ? new Set(
        brandArg
          .slice("--brands=".length)
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      )
    : null;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const lockPath = path.join(dataDir, ".catalog-sync.lock");

  if (fs.existsSync(lockPath)) {
    const stat = fs.statSync(lockPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 3 * 60 * 60 * 1000) {
      console.error(`[sync-catalog] Another sync is already running (lock: ${lockPath}). Exiting.`);
      process.exit(1);
    }
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));

  const startedAt = new Date();
  const stepResults: Array<{ id: string; script: string; ok: boolean; code: number; seconds: number }> = [];

  try {
    const before = await snapshotBrandCounts();
    const beforeTotal = [...before.values()].reduce((acc, v) => acc + v.count, 0);

    // Auto-detect any OEM brand currently under 10 products so fast mode repairs them automatically
    const houseBrands = new Set(["radiant", "siddhi", "sterila"]);
    const lowCountSlugs = new Set(
      [...before.entries()]
        .filter(([slug, info]) => !houseBrands.has(slug) && info.count < 10)
        .map(([slug]) => slug)
    );

    if (!isPostOnly) {
      const selectedLoaders = LOADER_STEPS.filter((step) => {
        if (targetBrands) {
          return step.brands.some((b) => targetBrands.has(b));
        }
        if (isFull) return true;
        if (step.tier === "fast") return true;
        return step.brands.some((b) => lowCountSlugs.has(b));
      });

      console.log(
        `[sync-catalog] Mode=${
          targetBrands ? `brands(${[...targetBrands].join(",")})` : isFull ? "FULL" : "FAST+LOW_REPAIR"
        } | Loaders=${selectedLoaders.length} | LowCountDetected=${lowCountSlugs.size}`
      );

      for (const step of selectedLoaders) {
        const extra =
          step.id === "online-expansion" && targetBrands
            ? [`--brands=${[...targetBrands].join(",")}`]
            : step.args || [];
        const r = runTsxStep(step.script, extra);
        stepResults.push({
          id: step.id,
          script: step.script,
          ok: r.ok,
          code: r.code,
          seconds: Number((r.ms / 1000).toFixed(1)),
        });
      }
    }

    if (!skipPost) {
      for (const post of POST_STEPS) {
        const r = runTsxStep(post.script, post.args);
        stepResults.push({
          id: post.id,
          script: post.script,
          ok: r.ok,
          code: r.code,
          seconds: Number((r.ms / 1000).toFixed(1)),
        });
      }
    }

    const after = await snapshotBrandCounts();
    const afterTotal = [...after.values()].reduce((acc, v) => acc + v.count, 0);

    const diffs: Array<{ Brand: string; Slug: string; Before: number; After: number; Added: number }> = [];
    for (const [slug, info] of after.entries()) {
      const prev = before.get(slug)?.count ?? 0;
      if (info.count !== prev) {
        diffs.push({
          Brand: info.name,
          Slug: slug,
          Before: prev,
          After: info.count,
          Added: info.count - prev,
        });
      }
    }
    diffs.sort((a, b) => b.Added - a.Added);

    console.log("\n=== CATALOG SYNC DIFF SUMMARY ===");
    console.log(`Active Products: ${beforeTotal.toLocaleString("en-IN")} -> ${afterTotal.toLocaleString("en-IN")} (${afterTotal >= beforeTotal ? "+" : ""}${afterTotal - beforeTotal})`);
    if (diffs.length > 0) {
      console.table(diffs);
    } else {
      console.log("No net product count changes (existing products checked/updated in place).");
    }

    if (pingArg) {
      await pingSitemaps(pingArg.slice("--ping=".length));
    }

    const report = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      elapsedSeconds: Number(((Date.now() - startedAt.getTime()) / 1000).toFixed(1)),
      mode: targetBrands ? `brands:${[...targetBrands].join(",")}` : isFull ? "full" : "fast",
      beforeTotal,
      afterTotal,
      netAdded: afterTotal - beforeTotal,
      brandChanges: diffs,
      steps: stepResults,
    };
    fs.writeFileSync(path.join(dataDir, "last-sync-report.json"), JSON.stringify(report, null, 2));
    console.log(`[sync-catalog] Saved run report to data/last-sync-report.json`);

    const verifyStep = stepResults.find((s) => s.id === "verify-catalog");
    if (verifyStep && !verifyStep.ok) {
      process.exit(1);
    }
  } finally {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[sync-catalog] Fatal error:", err);
    process.exit(1);
  });

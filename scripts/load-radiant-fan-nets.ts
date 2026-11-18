import { loadRadiantFanNetProducts } from "../src/db/radiant-fan-nets";

async function main() {
  console.log("Adding Radiant Industrial Fan Safety Net Covers (preserving all existing products)...");
  const result = await loadRadiantFanNetProducts();
  console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Radiant Fan Safety Net Covers:", err);
  process.exit(1);
});

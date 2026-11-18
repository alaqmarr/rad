import { loadSiddhiProducts } from "../src/db/siddhi-products";

async function main() {
  console.log("Adding Siddhi metal detectors & access control products (preserving all existing products)...");
  const result = await loadSiddhiProducts();
  console.log(JSON.stringify({ status: "ok", ...result }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Siddhi products:", err);
  process.exit(1);
});

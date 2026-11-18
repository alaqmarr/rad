import { replaceCatalogWithTapariaPdf } from "../src/db/taparia-catalog";

async function main() {
  console.log("Replacing product catalog with Taparia Tools Price List (April 2026)...");
  const result = await replaceCatalogWithTapariaPdf({ clearExisting: true });
  console.log(
    JSON.stringify(
      {
        status: "ok",
        deletedProducts: result.deletedCount,
        insertedProducts: result.insertedCount,
        sectionsLoaded: result.sectionCount,
        categoryBreakdown: result.categoryCounts,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to load Taparia catalog:", err);
  process.exit(1);
});

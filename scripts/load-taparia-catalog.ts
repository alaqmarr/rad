import { replaceCatalogWithTapariaPdf } from "../src/db/taparia-catalog";

async function main() {
  console.log(
    "Adding/updating Taparia Tools Price List (April 2026) while keeping all existing server products..."
  );
  const result = await replaceCatalogWithTapariaPdf({ clearExisting: false });
  console.log(
    JSON.stringify(
      {
        status: "ok",
        existingProductsBefore: result.existingBeforeCount,
        deletedProducts: result.deletedCount,
        insertedTapariaProducts: result.insertedCount,
        updatedTapariaProducts: result.updatedCount,
        totalProductsAfter: result.totalAfterCount,
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

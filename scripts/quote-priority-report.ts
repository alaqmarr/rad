import { getQuotePriorityReport } from "../src/lib/quote-priority";

async function main() {
  const report = await getQuotePriorityReport(25);

  console.log("=".repeat(72));
  console.log("Radiant Industrial — Quote-Driven SEO & Spec Priority Report");
  console.log(`Enquiries analyzed : ${report.totalEnquiriesAnalyzed}`);
  console.log(`WhatsApp logs read : ${report.totalWhatsappMessagesAnalyzed}`);
  console.log("=".repeat(72));

  console.log("\nTop Categories (by RFQ volume, then catalog depth):");
  for (const c of report.topCategories) {
    console.log(
      `  - ${c.name.padEnd(42)} | /categories/${c.slug.padEnd(32)} | RFQs: ${String(c.enquiryCount).padStart(3)} | SKUs: ${c.productCount}`
    );
  }

  console.log("\nPriority Products (MPN | Source | Readiness | Missing Gaps):");
  for (const p of report.topProducts) {
    const gaps = p.gaps.length ? p.gaps.join("; ") : "OK";
    console.log(
      `  - ${p.mpn.padEnd(18)} | ${p.sku.padEnd(20)} | ${p.source.padEnd(17)} | ${String(p.readinessScore).padStart(3)}% | specs=${p.specCount} | ${gaps}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

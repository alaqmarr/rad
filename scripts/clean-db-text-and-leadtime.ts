import { eq, sql } from "drizzle-orm";
import { client, db, pageBlocks, products } from "../src/db";
import { htmlToCleanText } from "../src/lib/sanitize-text";

/**
 * Cleans HTML tags & HTML entities from all products (name, shortDescription, description,
 * specificationsJson, seoTitle, seoDescription) and standardizes lead_time everywhere to
 * "Confirmed Upon Order". Rebuilds FTS5 index if present.
 */
function cleanField(raw: string | null | undefined, singleLine = false): string {
  const cleaned = htmlToCleanText(raw, singleLine)
    .replace(/Please Note\s+that Product may differ[\s\S]*?(?:without notice\.?|purchase decision\.?)/gi, "")
    .replace(/\s*\n{3,}/g, "\n\n")
    .trim();
  return singleLine ? cleaned.replace(/\s+/g, " ").trim() : cleaned;
}

async function main() {
  console.log("[clean-db] Scanning products for HTML tags/entities and non-standard lead times...");

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      shortDescription: products.shortDescription,
      description: products.description,
      specificationsJson: products.specificationsJson,
      seoTitle: products.seoTitle,
      seoDescription: products.seoDescription,
      leadTime: products.leadTime,
    })
    .from(products);

  let textCleanedCount = 0;
  const nowIso = new Date().toISOString();

  for (const r of rows) {
    const cleanName = cleanField(r.name, true) || r.name;
    const cleanShort = cleanField(r.shortDescription, true);
    const cleanDesc = cleanField(r.description, false);
    const cleanSeoTitle = cleanField(r.seoTitle, true);
    const cleanSeoDesc = cleanField(r.seoDescription, true);

    let cleanSpecsJson = r.specificationsJson;
    if (r.specificationsJson && r.specificationsJson !== "[]") {
      try {
        const parsed = JSON.parse(r.specificationsJson);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map((item: any) => ({
            label: cleanField(String(item?.label || ""), true),
            value: cleanField(String(item?.value || ""), true),
          }));
          cleanSpecsJson = JSON.stringify(sanitized);
        }
      } catch {
        // leave unparseable JSON untouched
      }
    }

    const changed =
      cleanName !== r.name ||
      cleanShort !== r.shortDescription ||
      cleanDesc !== r.description ||
      cleanSpecsJson !== r.specificationsJson ||
      cleanSeoTitle !== r.seoTitle ||
      cleanSeoDesc !== r.seoDescription;

    if (changed) {
      await db
        .update(products)
        .set({
          name: cleanName,
          shortDescription: cleanShort,
          description: cleanDesc,
          specificationsJson: cleanSpecsJson,
          seoTitle: cleanSeoTitle,
          seoDescription: cleanSeoDesc,
          updatedAt: nowIso,
        })
        .where(eq(products.id, r.id));
      textCleanedCount++;
    }
  }

  // Standardize all product lead times in a single indexed batch update
  const leadRes = await client.execute(
    `UPDATE products SET lead_time = 'Confirmed Upon Order', updated_at = ? WHERE lead_time != 'Confirmed Upon Order'`,
    [nowIso]
  );

  // Update commercial terms page blocks if they contain legacy working days wording
  const blocks = await db.select().from(pageBlocks);
  let updatedBlocks = 0;
  for (const b of blocks) {
    let nextContent = b.content;
    if (/working days/i.test(nextContent)) {
      if (b.pageSlug === "about" && b.blockKey === "mission_body") {
        nextContent =
          "Every quote clearly states the brand, model, delivery timeline (confirmed upon order), and 7-day price validity so there are zero surprises.";
      } else if (b.pageSlug === "contact" && b.blockKey === "commercial_terms") {
        nextContent =
          "1. Price quotes stay valid for 7 days. 2. Delivery & dispatch lead times are confirmed upon order. 3. GST is added as applicable. 4. Orders begin as soon as you send a Purchase Order or advance payment.";
      } else {
        nextContent = nextContent.replace(
          /\d+\s*(?:to|[-–])\s*\d+\s*working days/gi,
          "confirmed upon order"
        );
      }
    }
    if (nextContent !== b.content) {
      await db
        .update(pageBlocks)
        .set({ content: nextContent, updatedAt: nowIso })
        .where(eq(pageBlocks.id, b.id));
      updatedBlocks++;
    }
  }

  // Rebuild FTS5 index if present so search hits clean text immediately
  try {
    const ftsCheck = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='products_fts' LIMIT 1`
    );
    if (ftsCheck.rows.length > 0) {
      await client.execute(`INSERT INTO products_fts(products_fts) VALUES('rebuild');`);
      await client.execute(`ANALYZE;`);
      await client.execute(`PRAGMA optimize;`);
    }
  } catch {
    // ignore if FTS table is absent
  }

  const remainingHtml = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(
      sql`description LIKE '%<p>%' OR description LIKE '%&nbsp;%' OR description LIKE '%<strong>%' OR short_description LIKE '%<p>%'`
    );

  const distinctLeads = await client.execute(
    `SELECT lead_time, COUNT(*) as cnt FROM products GROUP BY lead_time`
  );

  console.log(
    JSON.stringify(
      {
        totalScanned: rows.length,
        textCleanedCount,
        leadTimesUpdated: leadRes.rowsAffected ?? 0,
        updatedPageBlocks: updatedBlocks,
        remainingHtmlMatches: remainingHtml[0]?.count ?? 0,
        distinctLeadTimes: distinctLeads.rows,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[clean-db] Error:", err);
    process.exit(1);
  });

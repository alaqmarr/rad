import { client } from "../src/db";

/**
 * Repeatable SQLite performance & indexing optimizer.
 * - Enables WAL mode + memory/mmap tuning
 * - Creates composite DESC covering indexes matching actual app ORDER BY plans
 * - Creates/rebuilds FTS5 virtual table + automatic triggers on products
 * - Runs ANALYZE, VACUUM, and PRAGMA optimize
 */
async function main() {
  const t0 = performance.now();
  console.log("[optimize-db] Applying SQLite engine PRAGMAs...");

  await client.executeMultiple(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -65536;
    PRAGMA mmap_size = 268435456;
    PRAGMA busy_timeout = 10000;
    PRAGMA foreign_keys = ON;
  `);

  console.log("[optimize-db] Creating composite & covering indexes...");
  await client.executeMultiple(`
    -- Products composite covering indexes with exact (is_featured DESC, name ASC) sort order
    CREATE INDEX IF NOT EXISTS idx_products_active_feat_desc_name
      ON products(is_active, is_featured DESC, name ASC);
    CREATE INDEX IF NOT EXISTS idx_products_brand_active_feat_name
      ON products(brand_id, is_active, is_featured DESC, name ASC);
    CREATE INDEX IF NOT EXISTS idx_products_cat_active_feat_name
      ON products(category_id, is_active, is_featured DESC, name ASC);
    CREATE INDEX IF NOT EXISTS idx_products_div_active_feat_name
      ON products(division_id, is_active, is_featured DESC, name ASC);
    CREATE INDEX IF NOT EXISTS idx_products_pricing_active_feat_name
      ON products(pricing_mode, is_active, is_featured DESC, name ASC);

    -- Matching Drizzle schema index names (for clean drizzle-kit compatibility)
    CREATE INDEX IF NOT EXISTS idx_products_brand_active_name
      ON products(brand_id, is_active, is_featured, name);
    CREATE INDEX IF NOT EXISTS idx_products_cat_active_name
      ON products(category_id, is_active, is_featured, name);
    CREATE INDEX IF NOT EXISTS idx_products_div_active_name
      ON products(division_id, is_active, is_featured, name);
    CREATE INDEX IF NOT EXISTS idx_products_active_feat_name
      ON products(is_active, is_featured, name);
    CREATE INDEX IF NOT EXISTS idx_products_pricing_active
      ON products(pricing_mode, is_active, is_featured, name);

    CREATE INDEX IF NOT EXISTS idx_products_updated_at_desc
      ON products(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_products_updated_at
      ON products(updated_at);
    CREATE INDEX IF NOT EXISTS idx_products_name_nocase
      ON products(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_products_sku_nocase
      ON products(sku COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_products_hsn_code
      ON products(hsn_code);
    CREATE INDEX IF NOT EXISTS idx_products_primary_image_url
      ON products(primary_image_url);

    -- Supporting taxonomy, documents, enquiries, AI logs
    CREATE INDEX IF NOT EXISTS idx_brands_active_sort
      ON brands(is_active, is_featured, sort_order, name);
    CREATE INDEX IF NOT EXISTS idx_categories_active_div_sort
      ON categories(is_active, division_id, sort_order, name);
    CREATE INDEX IF NOT EXISTS idx_divisions_active_sort
      ON divisions(is_active, sort_order, name);
    CREATE INDEX IF NOT EXISTS idx_documents_public_prod
      ON documents(is_public, product_id);
    CREATE INDEX IF NOT EXISTS idx_documents_public_cat_created
      ON documents(is_public, category, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_enquiries_status_created
      ON enquiries(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_month_day
      ON ai_usage_logs(month_key, day_key, endpoint);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_created
      ON whatsapp_logs(created_at DESC);
  `);

  // Drop old redundant single-dir index name if Drizzle wanted exact name vs DESC variant
  console.log("[optimize-db] Setting up FTS5 full-text search & triggers on products...");
  await client.executeMultiple(`
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      sku,
      name,
      short_description,
      description,
      specifications_json,
      hsn_code,
      content='products',
      content_rowid='id',
      tokenize='unicode61'
    );

    DROP TRIGGER IF EXISTS products_fts_ai;
    CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
      INSERT INTO products_fts(rowid, sku, name, short_description, description, specifications_json, hsn_code)
      VALUES (new.id, new.sku, new.name, new.short_description, new.description, new.specifications_json, new.hsn_code);
    END;

    DROP TRIGGER IF EXISTS products_fts_ad;
    CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, sku, name, short_description, description, specifications_json, hsn_code)
      VALUES ('delete', old.id, old.sku, old.name, old.short_description, old.description, old.specifications_json, old.hsn_code);
    END;

    DROP TRIGGER IF EXISTS products_fts_au;
    CREATE TRIGGER products_fts_au AFTER UPDATE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, sku, name, short_description, description, specifications_json, hsn_code)
      VALUES ('delete', old.id, old.sku, old.name, old.short_description, old.description, old.specifications_json, old.hsn_code);
      INSERT INTO products_fts(rowid, sku, name, short_description, description, specifications_json, hsn_code)
      VALUES (new.id, new.sku, new.name, new.short_description, new.description, new.specifications_json, new.hsn_code);
    END;
  `);

  console.log("[optimize-db] Rebuilding FTS5 index across all products...");
  await client.execute(`INSERT INTO products_fts(products_fts) VALUES('rebuild');`);

  console.log("[optimize-db] Running ANALYZE, VACUUM, and PRAGMA optimize...");
  await client.execute(`ANALYZE;`);
  await client.execute(`VACUUM;`);
  await client.execute(`PRAGMA optimize;`);
  await client.execute(`PRAGMA wal_checkpoint(TRUNCATE);`);

  const stats = await client.execute(`
    SELECT
      (SELECT COUNT(*) FROM products) AS total_products,
      (SELECT COUNT(*) FROM products_fts) AS fts_rows,
      (SELECT COUNT(*) FROM sqlite_master WHERE type='index') AS total_indexes
  `);

  console.log(
    JSON.stringify(
      {
        status: "ok",
        elapsedSeconds: Number(((performance.now() - t0) / 1000).toFixed(2)),
        totalProducts: Number(stats.rows[0].total_products),
        ftsRows: Number(stats.rows[0].fts_rows),
        totalIndexes: Number(stats.rows[0].total_indexes),
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[optimize-db] Error:", err);
    process.exit(1);
  });

import crypto from "node:crypto";
import { eq, like } from "drizzle-orm";
import {
  brands,
  categories,
  db,
  divisions,
  documents,
  ensureDbReady,
  pageBlocks,
  products,
  siteSettings,
} from "@/db";
import { getR2Config, uploadBufferToR2FixedKey } from "./r2";

export interface ExternalHostStat {
  host: string;
  uniqueUrls: number;
  totalRefs: number;
  sampleUrls: string[];
  sampledCount?: number;
  reachableCount?: number;
  avgBytes?: number;
  minBytes?: number;
  maxBytes?: number;
  estimatedTotalBytes?: number;
}

export interface MigrationEstimateSnapshot {
  scannedAt: string;
  samplePerHost: number;
  totalUniqueUrls: number;
  totalExternalRefs: number;
  measuredSamples: number;
  reachableSamples: number;
  estimatedDeduplicatedBytes: number;
  estimatedWithBufferBytes: number;
  estimatedWithoutDedupBytes: number;
  r2FreeTierBytes: number;
  freeTierPercent: number;
  estimatedMonthlyUsd: number;
  hosts: ExternalHostStat[];
}

export interface StorageAuditSummary {
  generatedAt: string;
  r2Configured: boolean;
  r2PublicHost: string | null;
  counts: {
    totalProducts: number;
    productsWithExternalPrimary: number;
    productsMissingPrimary: number;
    productsOnR2Primary: number;
    productsOnLocalPrimary: number;
    totalExternalImageRefs: number;
    uniqueExternalImageUrls: number;
    alreadyOnR2Refs: number;
    localStaticRefs: number;
    documentsInR2Count: number;
    documentsInR2Bytes: number;
    otherTablesExternalCount: number;
  };
  hosts: ExternalHostStat[];
  estimate: MigrationEstimateSnapshot | null;
}

const R2_FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB/month
const R2_PRICE_PER_GB_USD = 0.015;
const ESTIMATE_SETTING_KEY = "r2_migration_estimate_json";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
};

type UrlClassification = "empty" | "local" | "r2" | "external";

function classifyUrl(
  rawUrl: string | null | undefined,
  configuredPublicHost: string | null
): { kind: UrlClassification; normalized: string; host: string } {
  const s = (rawUrl || "").trim();
  if (!s) return { kind: "empty", normalized: "", host: "" };
  if (!s.startsWith("http://") && !s.startsWith("https://")) {
    return { kind: "local", normalized: s, host: "" };
  }
  try {
    const parsed = new URL(s);
    const host = parsed.hostname.toLowerCase();
    if (
      host.endsWith(".r2.dev") ||
      host.endsWith(".r2.cloudflarestorage.com") ||
      (configuredPublicHost && host === configuredPublicHost)
    ) {
      return { kind: "r2", normalized: s, host };
    }
    return { kind: "external", normalized: s, host };
  } catch {
    return { kind: "local", normalized: s, host: "" };
  }
}

async function scanDatabaseMediaInternal() {
  await ensureDbReady();
  const r2 = await getR2Config();
  let r2PublicHost: string | null = null;
  if (r2.publicUrl) {
    try {
      r2PublicHost = new URL(r2.publicUrl).hostname.toLowerCase();
    } catch {
      r2PublicHost = null;
    }
  }

  const [prodRows, brandRows, catRows, divRows, blockRows, docRows, estimateRow] = await Promise.all([
    db
      .select({
        id: products.id,
        primaryImageUrl: products.primaryImageUrl,
        galleryJson: products.galleryJson,
      })
      .from(products),
    db
      .select({ id: brands.id, logoUrl: brands.logoUrl, thumbnailUrl: brands.thumbnailUrl })
      .from(brands),
    db.select({ id: categories.id, thumbnailUrl: categories.thumbnailUrl }).from(categories),
    db.select({ id: divisions.id, heroImageUrl: divisions.heroImageUrl }).from(divisions),
    db.select({ id: pageBlocks.id, mediaUrl: pageBlocks.mediaUrl }).from(pageBlocks),
    db.select({ r2Key: documents.r2Key, fileSize: documents.fileSize, fileUrl: documents.fileUrl }).from(documents),
    db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, ESTIMATE_SETTING_KEY))
      .limit(1),
  ]);

  let productsWithExternalPrimary = 0;
  let productsMissingPrimary = 0;
  let productsOnR2Primary = 0;
  let productsOnLocalPrimary = 0;
  let totalExternalImageRefs = 0;
  let alreadyOnR2Refs = 0;
  let localStaticRefs = 0;
  let otherTablesExternalCount = 0;

  const uniqueExternalMap = new Map<string, string>(); // url -> host
  const hostRefCounts = new Map<string, number>();

  const recordUrl = (url: string | null | undefined, isOtherTable = false) => {
    const cls = classifyUrl(url, r2PublicHost);
    if (cls.kind === "external") {
      totalExternalImageRefs++;
      if (isOtherTable) otherTablesExternalCount++;
      uniqueExternalMap.set(cls.normalized, cls.host);
      hostRefCounts.set(cls.host, (hostRefCounts.get(cls.host) || 0) + 1);
    } else if (cls.kind === "r2") {
      alreadyOnR2Refs++;
    } else if (cls.kind === "local") {
      localStaticRefs++;
    }
    return cls.kind;
  };

  for (const p of prodRows) {
    const primaryKind = recordUrl(p.primaryImageUrl, false);
    if (primaryKind === "external") productsWithExternalPrimary++;
    else if (primaryKind === "empty") productsMissingPrimary++;
    else if (primaryKind === "r2") productsOnR2Primary++;
    else if (primaryKind === "local") productsOnLocalPrimary++;

    if (p.galleryJson && p.galleryJson !== "[]") {
      try {
        const gallery = JSON.parse(p.galleryJson);
        if (Array.isArray(gallery)) {
          for (const g of gallery) {
            if (typeof g === "string") recordUrl(g, false);
          }
        }
      } catch {
        // ignore invalid gallery JSON
      }
    }
  }

  for (const b of brandRows) {
    recordUrl(b.logoUrl, true);
    recordUrl(b.thumbnailUrl, true);
  }
  for (const c of catRows) recordUrl(c.thumbnailUrl, true);
  for (const d of divRows) recordUrl(d.heroImageUrl, true);
  for (const blk of blockRows) recordUrl(blk.mediaUrl, true);

  let documentsInR2Count = 0;
  let documentsInR2Bytes = 0;
  for (const doc of docRows) {
    if (doc.r2Key && !doc.r2Key.startsWith("local:")) {
      documentsInR2Count++;
      documentsInR2Bytes += Number(doc.fileSize || 0);
    }
  }

  const urlsByHost = new Map<string, string[]>();
  for (const [u, h] of uniqueExternalMap.entries()) {
    const list = urlsByHost.get(h);
    if (list) list.push(u);
    else urlsByHost.set(h, [u]);
  }

  const hosts: ExternalHostStat[] = [...urlsByHost.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([host, urls]) => ({
      host,
      uniqueUrls: urls.length,
      totalRefs: hostRefCounts.get(host) || urls.length,
      sampleUrls: urls,
    }));

  let cachedEstimate: MigrationEstimateSnapshot | null = null;
  if (estimateRow[0]?.value) {
    try {
      cachedEstimate = JSON.parse(estimateRow[0].value) as MigrationEstimateSnapshot;
    } catch {
      cachedEstimate = null;
    }
  }

  return {
    r2Configured: r2.isConfigured,
    r2PublicHost,
    counts: {
      totalProducts: prodRows.length,
      productsWithExternalPrimary,
      productsMissingPrimary,
      productsOnR2Primary,
      productsOnLocalPrimary,
      totalExternalImageRefs,
      uniqueExternalImageUrls: uniqueExternalMap.size,
      alreadyOnR2Refs,
      localStaticRefs,
      documentsInR2Count,
      documentsInR2Bytes,
      otherTablesExternalCount,
    },
    hosts,
    cachedEstimate,
    uniqueExternalUrls: [...uniqueExternalMap.keys()],
  };
}

export async function getStorageAuditSummary(): Promise<StorageAuditSummary> {
  const raw = await scanDatabaseMediaInternal();
  // Trim sampleUrls down to 3 per host for lightweight dashboard SSR payload
  const publicHosts: ExternalHostStat[] = raw.hosts.map((h) => {
    const cachedHost = raw.cachedEstimate?.hosts?.find((ch) => ch.host === h.host);
    return {
      host: h.host,
      uniqueUrls: h.uniqueUrls,
      totalRefs: h.totalRefs,
      sampleUrls: h.sampleUrls.slice(0, 3),
      sampledCount: cachedHost?.sampledCount,
      reachableCount: cachedHost?.reachableCount,
      avgBytes: cachedHost?.avgBytes,
      minBytes: cachedHost?.minBytes,
      maxBytes: cachedHost?.maxBytes,
      estimatedTotalBytes:
        cachedHost?.avgBytes !== undefined ? cachedHost.avgBytes * h.uniqueUrls : cachedHost?.estimatedTotalBytes,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    r2Configured: raw.r2Configured,
    r2PublicHost: raw.r2PublicHost,
    counts: raw.counts,
    hosts: publicHosts,
    estimate: raw.cachedEstimate,
  };
}

async function measureSingleExternalImageSize(url: string): Promise<number | null> {
  try {
    const headRes = await fetch(url, {
      method: "HEAD",
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    const headType = (headRes.headers.get("content-type") || "").toLowerCase();
    const headLen = Number(headRes.headers.get("content-length") || 0);
    if (headRes.ok && (headType.startsWith("image/") || headType.includes("octet-stream")) && headLen > 0) {
      return headLen;
    }
  } catch {
    // Fall through to GET
  }

  try {
    const getRes = await fetch(url, {
      method: "GET",
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    const getType = (getRes.headers.get("content-type") || "").toLowerCase();
    if (!getRes.ok || (!getType.startsWith("image/") && !getType.includes("octet-stream"))) {
      return null;
    }
    const cl = Number(getRes.headers.get("content-length") || 0);
    if (cl > 0) return cl;
    const buf = await getRes.arrayBuffer();
    return buf.byteLength > 0 ? buf.byteLength : null;
  } catch {
    return null;
  }
}

export async function runLiveExternalSizeEstimate(
  samplePerHost = 6
): Promise<MigrationEstimateSnapshot> {
  const raw = await scanDatabaseMediaInternal();
  const measuredHosts: ExternalHostStat[] = [];

  let measuredSamples = 0;
  let reachableSamples = 0;
  let estimatedDeduplicatedBytes = 0;
  let estimatedWithoutDedupBytes = 0;

  for (const h of raw.hosts) {
    const urls = h.sampleUrls;
    const targetCount = Math.min(samplePerHost, urls.length);
    const chosen: string[] = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.floor((i * urls.length) / targetCount);
      chosen.push(urls[idx]);
    }

    const results = await Promise.all(chosen.map((u) => measureSingleExternalImageSize(u)));
    const validSizes = results.filter((n): n is number => typeof n === "number" && n > 0);
    measuredSamples += chosen.length;
    reachableSamples += validSizes.length;

    const avgBytes =
      validSizes.length > 0
        ? Math.round(validSizes.reduce((a, b) => a + b, 0) / validSizes.length)
        : 45 * 1024; // Fallback average (45 KB) only if host blocked all sample probes
    const minBytes = validSizes.length > 0 ? Math.min(...validSizes) : 0;
    const maxBytes = validSizes.length > 0 ? Math.max(...validSizes) : 0;
    const estimatedTotalBytes = avgBytes * h.uniqueUrls;

    estimatedDeduplicatedBytes += estimatedTotalBytes;
    estimatedWithoutDedupBytes += avgBytes * h.totalRefs;

    measuredHosts.push({
      host: h.host,
      uniqueUrls: h.uniqueUrls,
      totalRefs: h.totalRefs,
      sampleUrls: chosen.slice(0, 3),
      sampledCount: chosen.length,
      reachableCount: validSizes.length,
      avgBytes,
      minBytes,
      maxBytes,
      estimatedTotalBytes,
    });
  }

  const estimatedWithBufferBytes = Math.round(estimatedDeduplicatedBytes * 1.15);
  const gbWithBuffer = estimatedWithBufferBytes / (1024 * 1024 * 1024);
  const billableGb = Math.max(0, gbWithBuffer - 10);
  const estimatedMonthlyUsd = Number((billableGb * R2_PRICE_PER_GB_USD).toFixed(2));
  const freeTierPercent = Number(((estimatedWithBufferBytes / R2_FREE_TIER_BYTES) * 100).toFixed(1));

  const snapshot: MigrationEstimateSnapshot = {
    scannedAt: new Date().toISOString(),
    samplePerHost,
    totalUniqueUrls: raw.counts.uniqueExternalImageUrls,
    totalExternalRefs: raw.counts.totalExternalImageRefs,
    measuredSamples,
    reachableSamples,
    estimatedDeduplicatedBytes,
    estimatedWithBufferBytes,
    estimatedWithoutDedupBytes,
    r2FreeTierBytes: R2_FREE_TIER_BYTES,
    freeTierPercent,
    estimatedMonthlyUsd,
    hosts: measuredHosts,
  };

  // Persist snapshot in site_settings so /admin/storage renders instantaneously on next visit
  const existing = await db
    .select({ key: siteSettings.key })
    .from(siteSettings)
    .where(eq(siteSettings.key, ESTIMATE_SETTING_KEY))
    .limit(1);

  const payload = JSON.stringify(snapshot);
  if (existing.length > 0) {
    await db
      .update(siteSettings)
      .set({ value: payload, updatedAt: new Date().toISOString() })
      .where(eq(siteSettings.key, ESTIMATE_SETTING_KEY));
  } else {
    await db.insert(siteSettings).values({
      key: ESTIMATE_SETTING_KEY,
      category: "storage_internal",
      label: "Cached External Media Migration Size Estimate",
      value: payload,
      valueType: "text",
      isSecret: false,
    });
  }

  return snapshot;
}

function guessExtFromMimeAndUrl(mimeType: string, url: string): string {
  const mt = mimeType.toLowerCase();
  if (mt.includes("webp")) return ".webp";
  if (mt.includes("png")) return ".png";
  if (mt.includes("svg")) return ".svg";
  if (mt.includes("gif")) return ".gif";
  if (mt.includes("jpeg") || mt.includes("jpg")) return ".jpg";
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.(jpg|jpeg|png|webp|svg|gif)$/);
    if (match) return `.${match[1]}`;
  } catch {
    // ignore
  }
  return ".jpg";
}

export async function migrateExternalImagesBatch(batchSize = 20): Promise<{
  attempted: number;
  migrated: number;
  failed: number;
  bytesUploaded: number;
  updatedProductRows: number;
  remainingUnique: number;
  errors: string[];
}> {
  const r2 = await getR2Config();
  if (!r2.isConfigured) {
    throw new Error("Connect Cloudflare R2 storage before running image migration.");
  }

  const raw = await scanDatabaseMediaInternal();
  const safeLimit = Math.max(1, Math.min(batchSize, 50));
  const batchUrls = raw.uniqueExternalUrls.slice(0, safeLimit);

  let attempted = 0;
  let migrated = 0;
  let failed = 0;
  let bytesUploaded = 0;
  let updatedProductRows = 0;
  const errors: string[] = [];

  const CONCURRENCY = 5;
  for (let i = 0; i < batchUrls.length; i += CONCURRENCY) {
    const chunk = batchUrls.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (srcUrl) => {
        attempted++;
        try {
          const res = await fetch(srcUrl, {
            headers: BROWSER_HEADERS,
            signal: AbortSignal.timeout(12000),
          });
          const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
          if (!res.ok || (!mime.startsWith("image/") && !mime.includes("octet-stream"))) {
            throw new Error(`HTTP ${res.status} (${mime})`);
          }
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 64) {
            throw new Error("Image payload too small");
          }

          const host = new URL(srcUrl).hostname.replace(/[^a-z0-9.-]/gi, "_");
          const sha = crypto.createHash("sha1").update(srcUrl).digest("hex").slice(0, 16);
          const ext = guessExtFromMimeAndUrl(mime, srcUrl);
          const key = `migrated/${host}/${sha}${ext}`;

          const uploaded = await uploadBufferToR2FixedKey({
            buffer: buf,
            key,
            mimeType: mime.startsWith("image/") ? mime : "image/jpeg",
            cfg: r2,
          });
          bytesUploaded += uploaded.size;

          // Update primaryImageUrl across matching product rows
          await db
            .update(products)
            .set({ primaryImageUrl: uploaded.url, updatedAt: new Date().toISOString() })
            .where(eq(products.primaryImageUrl, srcUrl));

          // Update galleryJson across products containing srcUrl
          const galleryMatches = await db
            .select({ id: products.id, galleryJson: products.galleryJson })
            .from(products)
            .where(like(products.galleryJson, `%${srcUrl}%`));

          for (const gRow of galleryMatches) {
            try {
              const arr = JSON.parse(gRow.galleryJson);
              if (Array.isArray(arr) && arr.includes(srcUrl)) {
                const updatedArr = arr.map((item) => (item === srcUrl ? uploaded.url : item));
                await db
                  .update(products)
                  .set({ galleryJson: JSON.stringify(updatedArr), updatedAt: new Date().toISOString() })
                  .where(eq(products.id, gRow.id));
                updatedProductRows++;
              }
            } catch {
              // skip invalid JSON
            }
          }

          await db.update(brands).set({ logoUrl: uploaded.url }).where(eq(brands.logoUrl, srcUrl));
          await db.update(brands).set({ thumbnailUrl: uploaded.url }).where(eq(brands.thumbnailUrl, srcUrl));
          await db.update(categories).set({ thumbnailUrl: uploaded.url }).where(eq(categories.thumbnailUrl, srcUrl));
          await db.update(divisions).set({ heroImageUrl: uploaded.url }).where(eq(divisions.heroImageUrl, srcUrl));
          await db.update(pageBlocks).set({ mediaUrl: uploaded.url }).where(eq(pageBlocks.mediaUrl, srcUrl));

          updatedProductRows++;
          migrated++;
        } catch (err) {
          failed++;
          if (errors.length < 8) {
            errors.push(`${srcUrl.slice(0, 60)}: ${err instanceof Error ? err.message : "Failed"}`);
          }
        }
      })
    );
  }

  const remainingUnique = Math.max(0, raw.counts.uniqueExternalImageUrls - migrated);
  return {
    attempted,
    migrated,
    failed,
    bytesUploaded,
    updatedProductRows,
    remainingUnique,
    errors,
  };
}

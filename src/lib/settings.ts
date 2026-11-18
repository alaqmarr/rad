import { db, siteSettings, pageBlocks } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type SiteSettingsMap = Record<string, string>;
export type PageBlocksMap = Record<
  string,
  { content: string; mediaUrl: string | null; label: string; contentType: string }
>;

/**
 * Direct LibSQL/SQLite reads ensure settings (API keys, SMTP, R2, prices visibility)
 * take effect immediately with zero stale-while-revalidate delay.
 */
export async function getSiteSettings(): Promise<SiteSettingsMap> {
  try {
    const rows = await db.select().from(siteSettings);
    const map: SiteSettingsMap = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  } catch {
    return {};
  }
}

export async function getPageBlocks(pageSlug: string): Promise<PageBlocksMap> {
  try {
    const rows = await db
      .select()
      .from(pageBlocks)
      .where(eq(pageBlocks.pageSlug, pageSlug));
    const map: PageBlocksMap = {};
    for (const row of rows) {
      map[row.blockKey] = {
        content: row.content,
        mediaUrl: row.mediaUrl,
        label: row.label,
        contentType: row.contentType,
      };
    }
    return map;
  } catch {
    return {};
  }
}

export async function getAllPageBlocks(): Promise<PageBlocksMap> {
  const rows = await db.select().from(pageBlocks);
  const map: PageBlocksMap = {};
  for (const row of rows) {
    map[`${row.pageSlug}.${row.blockKey}`] = {
      content: row.content,
      mediaUrl: row.mediaUrl,
      label: row.label,
      contentType: row.contentType,
    };
  }
  return map;
}

export async function getSettingValue(key: string, fallback = ""): Promise<string> {
  const settings = await getSiteSettings();
  return settings[key] || fallback;
}

export function revalidateCmsCache() {
  revalidatePath("/", "layout");
}

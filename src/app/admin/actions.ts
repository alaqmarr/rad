"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import {
  db,
  siteSettings,
  pageBlocks,
  products,
  brands,
  categories,
  divisions,
  documents,
  enquiries,
  aiConversations,
  whatsappLogs,
  aiUsageLogs,
} from "@/db";
import { revalidateCmsCache } from "@/lib/settings";
import { sendTestEmail } from "@/lib/mailer";
import { deleteFileFromStorage } from "@/lib/r2";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized: Admin session required.");
  }
  return session.user;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function updatePageBlockAction(params: {
  pageSlug: string;
  blockKey: string;
  label?: string;
  content: string;
  mediaUrl?: string | null;
}) {
  await requireAdmin();
  const existing = await db
    .select()
    .from(pageBlocks)
    .where(and(eq(pageBlocks.pageSlug, params.pageSlug), eq(pageBlocks.blockKey, params.blockKey)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pageBlocks)
      .set({
        content: params.content,
        mediaUrl: params.mediaUrl !== undefined ? params.mediaUrl : existing[0].mediaUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pageBlocks.id, existing[0].id));
  } else {
    await db.insert(pageBlocks).values({
      pageSlug: params.pageSlug,
      blockKey: params.blockKey,
      label: params.label || params.blockKey,
      content: params.content,
      mediaUrl: params.mediaUrl || null,
      contentType: "text",
    });
  }

  revalidateCmsCache();
  revalidatePath("/");
  revalidatePath(`/${params.pageSlug === "home" ? "" : params.pageSlug}`);
  return { success: true };
}

export async function updateSiteSettingsAction(updates: Record<string, string>) {
  await requireAdmin();
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(updates)) {
    const existing = await db
      .select({ key: siteSettings.key })
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(siteSettings)
        .set({ value, updatedAt: now })
        .where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({
        key,
        category: "general",
        label: key,
        value,
        valueType: "text",
      });
    }
  }
  revalidateCmsCache();
  revalidatePath("/", "layout");
  return { success: true };
}

export async function testSmtpAction(toEmail: string, account: "admin" | "customer" = "admin") {
  await requireAdmin();
  return sendTestEmail(toEmail, account);
}

export async function quickUpdateProductFieldAction(params: {
  id: number;
  name?: string;
  shortDescription?: string;
  description?: string;
  pricingMode?: "priced" | "rfq_only";
  basePrice?: number | null;
  priceUnit?: string;
  leadTime?: string;
  primaryImageUrl?: string | null;
}) {
  await requireAdmin();
  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (params.name !== undefined) updateData.name = params.name;
  if (params.shortDescription !== undefined) updateData.shortDescription = params.shortDescription;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.pricingMode !== undefined) updateData.pricingMode = params.pricingMode;
  if (params.basePrice !== undefined) updateData.basePrice = params.basePrice;
  if (params.priceUnit !== undefined) updateData.priceUnit = params.priceUnit;
  if (params.leadTime !== undefined) updateData.leadTime = params.leadTime;
  if (params.primaryImageUrl !== undefined) updateData.primaryImageUrl = params.primaryImageUrl;

  await db.update(products).set(updateData).where(eq(products.id, params.id));
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/products");
  return { success: true };
}

export async function upsertProductAction(data: {
  id?: number;
  sku: string;
  name: string;
  slug?: string;
  shortDescription: string;
  description: string;
  divisionId: number;
  categoryId: number;
  brandId: number | null;
  pricingMode: "priced" | "rfq_only";
  basePrice: number | null;
  priceUnit: string;
  gstPercent: number;
  moq: string;
  leadTime: string;
  hsnCode: string;
  specificationsJson: string;
  primaryImageUrl: string | null;
  galleryJson?: string;
  inStockStatus: string;
  isFeatured: boolean;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
}) {
  await requireAdmin();
  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(`${data.name}-${data.sku}`);

  if (data.id) {
    await db
      .update(products)
      .set({
        sku: data.sku.trim(),
        name: data.name.trim(),
        slug,
        shortDescription: data.shortDescription.trim(),
        description: data.description.trim(),
        divisionId: data.divisionId,
        categoryId: data.categoryId,
        brandId: data.brandId,
        pricingMode: data.pricingMode,
        basePrice: data.pricingMode === "priced" ? data.basePrice : null,
        priceUnit: data.priceUnit.trim() || "NOS",
        gstPercent: Number(data.gstPercent) || 18,
        moq: data.moq.trim() || "1 NOS",
        leadTime: data.leadTime.trim() || "3–7 Working Days",
        hsnCode: data.hsnCode.trim(),
        specificationsJson: data.specificationsJson || "[]",
        primaryImageUrl: data.primaryImageUrl,
        galleryJson: data.galleryJson || "[]",
        inStockStatus: data.inStockStatus.trim() || "Available to Order",
        isFeatured: data.isFeatured,
        isActive: data.isActive,
        seoTitle: data.seoTitle?.trim() || `${data.name.trim()} | Radiant Industrial Co.`,
        seoDescription: data.seoDescription?.trim() || data.shortDescription.trim(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(products.id, data.id));
  } else {
    await db.insert(products).values({
      sku: data.sku.trim(),
      name: data.name.trim(),
      slug,
      shortDescription: data.shortDescription.trim(),
      description: data.description.trim(),
      divisionId: data.divisionId,
      categoryId: data.categoryId,
      brandId: data.brandId,
      pricingMode: data.pricingMode,
      basePrice: data.pricingMode === "priced" ? data.basePrice : null,
      priceUnit: data.priceUnit.trim() || "NOS",
      gstPercent: Number(data.gstPercent) || 18,
      moq: data.moq.trim() || "1 NOS",
      leadTime: data.leadTime.trim() || "3–7 Working Days",
      hsnCode: data.hsnCode.trim(),
      specificationsJson: data.specificationsJson || "[]",
      primaryImageUrl: data.primaryImageUrl,
      galleryJson: data.galleryJson || "[]",
      inStockStatus: data.inStockStatus.trim() || "Available to Order",
      isFeatured: data.isFeatured,
      isActive: data.isActive,
      seoTitle: data.seoTitle?.trim() || `${data.name.trim()} | Radiant Industrial Co.`,
      seoDescription: data.seoDescription?.trim() || data.shortDescription.trim(),
    });
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/admin/products");
  return { success: true, slug };
}

export async function deleteProductAction(id: number) {
  await requireAdmin();
  await db.delete(products).where(eq(products.id, id));
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin/products");
  return { success: true };
}

export async function bulkDeleteProductsAction(ids: number[]) {
  await requireAdmin();
  const cleanIds = Array.from(new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)));
  if (cleanIds.length === 0) return { success: true, deleted: 0 };

  await db.delete(products).where(inArray(products.id, cleanIds));
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/divisions/[slug]", "page");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  return { success: true, deleted: cleanIds.length };
}

export async function upsertBrandAction(data: {
  id?: number;
  name: string;
  slug?: string;
  logoUrl: string | null;
  thumbnailUrl?: string | null;
  countryOfOrigin: string;
  sourcingType: "independent" | "authorized";
  sourcingNote: string;
  description: string;
  websiteUrl?: string;
  isFeatured: boolean;
  isActive: boolean;
}) {
  await requireAdmin();
  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.name);

  if (data.id) {
    await db
      .update(brands)
      .set({
        name: data.name.trim(),
        slug,
        logoUrl: data.logoUrl,
        thumbnailUrl: data.thumbnailUrl !== undefined ? data.thumbnailUrl : null,
        countryOfOrigin: data.countryOfOrigin.trim() || "India",
        sourcingType: data.sourcingType,
        sourcingNote: data.sourcingNote.trim(),
        description: data.description.trim(),
        websiteUrl: data.websiteUrl?.trim() || null,
        isFeatured: data.isFeatured,
        isActive: data.isActive,
      })
      .where(eq(brands.id, data.id));
  } else {
    await db.insert(brands).values({
      name: data.name.trim(),
      slug,
      logoUrl: data.logoUrl,
      thumbnailUrl: data.thumbnailUrl ?? null,
      countryOfOrigin: data.countryOfOrigin.trim() || "India",
      sourcingType: data.sourcingType,
      sourcingNote: data.sourcingNote.trim(),
      description: data.description.trim(),
      websiteUrl: data.websiteUrl?.trim() || null,
      isFeatured: data.isFeatured,
      isActive: data.isActive,
      seoTitle: `${data.name.trim()} Wholesale Procurement | Radiant Industrial Co.`,
      seoDescription: data.description.trim(),
    });
  }

  revalidatePath("/");
  revalidatePath("/brands");
  revalidatePath(`/brands/${slug}`);
  revalidatePath("/admin/brands");
  return { success: true };
}

export async function deleteBrandAction(id: number) {
  await requireAdmin();
  await db.delete(brands).where(eq(brands.id, id));
  revalidatePath("/");
  revalidatePath("/brands");
  revalidatePath("/products");
  revalidatePath("/admin");
  revalidatePath("/admin/brands");
  return { success: true };
}

export async function bulkDeleteBrandsAction(ids: number[]) {
  await requireAdmin();
  const cleanIds = Array.from(new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)));
  if (cleanIds.length === 0) return { success: true, deleted: 0 };

  await db.delete(brands).where(inArray(brands.id, cleanIds));
  revalidatePath("/");
  revalidatePath("/brands");
  revalidatePath("/products");
  revalidatePath("/admin");
  revalidatePath("/admin/brands");
  return { success: true, deleted: cleanIds.length };
}

export async function upsertCategoryAction(data: {
  id?: number;
  name: string;
  divisionId: number;
  description: string;
  thumbnailUrl?: string | null;
}) {
  await requireAdmin();
  const slug = slugify(data.name);
  if (data.id) {
    await db
      .update(categories)
      .set({
        name: data.name.trim(),
        slug,
        divisionId: data.divisionId,
        description: data.description.trim(),
        thumbnailUrl: data.thumbnailUrl !== undefined ? data.thumbnailUrl : null,
      })
      .where(eq(categories.id, data.id));
  } else {
    await db.insert(categories).values({
      name: data.name.trim(),
      slug,
      divisionId: data.divisionId,
      description: data.description.trim(),
      thumbnailUrl: data.thumbnailUrl ?? null,
    });
  }
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/divisions/[slug]", "page");
  revalidatePath("/admin/brands");
  return { success: true };
}

export async function deleteCategoryAction(id: number) {
  await requireAdmin();
  const [linked] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.categoryId, id));
  const linkedCount = Number(linked?.count || 0);
  if (linkedCount > 0) {
    throw new Error(
      `Cannot delete this category because ${linkedCount} product(s) still belong to it. Delete or move those products first.`
    );
  }
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/divisions/[slug]", "page");
  revalidatePath("/admin/brands");
  return { success: true };
}

export async function bulkDeleteCategoriesAction(ids: number[]) {
  await requireAdmin();
  const cleanIds = Array.from(new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)));
  if (cleanIds.length === 0) return { success: true, deleted: 0 };

  const [linked] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(inArray(products.categoryId, cleanIds));
  const linkedCount = Number(linked?.count || 0);
  if (linkedCount > 0) {
    throw new Error(
      `Cannot delete selected categories because ${linkedCount} product(s) are assigned to them. Delete or reassign those products first.`
    );
  }

  await db.delete(categories).where(inArray(categories.id, cleanIds));
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/divisions/[slug]", "page");
  revalidatePath("/admin/brands");
  return { success: true, deleted: cleanIds.length };
}

export async function upsertDivisionAction(data: {
  id: number;
  name: string;
  tagline: string;
  description: string;
  heroImageUrl?: string | null;
}) {
  await requireAdmin();
  await db
    .update(divisions)
    .set({
      name: data.name.trim(),
      tagline: data.tagline.trim(),
      description: data.description.trim(),
      heroImageUrl: data.heroImageUrl,
    })
    .where(eq(divisions.id, data.id));
  revalidatePath("/");
  revalidatePath("/divisions/[slug]", "page");
  return { success: true };
}

export async function createDocumentAction(data: {
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  r2Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  productId?: number | null;
  brandId?: number | null;
  divisionId?: number | null;
  isPublic: boolean;
}) {
  await requireAdmin();
  const slug = `${slugify(data.title)}-${String(Date.now()).slice(-4)}`;
  await db.insert(documents).values({
    title: data.title.trim(),
    slug,
    description: data.description.trim(),
    category: data.category,
    fileUrl: data.fileUrl,
    r2Key: data.r2Key,
    fileName: data.fileName,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    productId: data.productId || null,
    brandId: data.brandId || null,
    divisionId: data.divisionId || null,
    isPublic: data.isPublic,
  });

  revalidatePath("/documents");
  revalidatePath("/products");
  revalidatePath("/admin/documents");
  return { success: true };
}

export async function deleteDocumentAction(id: number) {
  await requireAdmin();
  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (doc?.r2Key) {
    await deleteFileFromStorage(doc.r2Key).catch(() => null);
  }
  await db.delete(documents).where(eq(documents.id, id));
  revalidatePath("/documents");
  revalidatePath("/products");
  revalidatePath("/admin/documents");
  return { success: true };
}

export async function bulkDeleteDocumentsAction(ids: number[]) {
  await requireAdmin();
  const cleanIds = Array.from(new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)));
  if (cleanIds.length === 0) return { success: true, deleted: 0 };

  const docsToDelete = await db
    .select({ id: documents.id, r2Key: documents.r2Key })
    .from(documents)
    .where(inArray(documents.id, cleanIds));

  await Promise.all(
    docsToDelete
      .filter((d) => Boolean(d.r2Key))
      .map((d) => deleteFileFromStorage(d.r2Key).catch(() => null))
  );

  await db.delete(documents).where(inArray(documents.id, cleanIds));
  revalidatePath("/documents");
  revalidatePath("/products");
  revalidatePath("/admin/documents");
  return { success: true, deleted: cleanIds.length };
}

export async function deleteEnquiryAction(id: number) {
  await requireAdmin();
  await db.delete(enquiries).where(eq(enquiries.id, id));
  revalidatePath("/admin");
  return { success: true };
}

export async function bulkDeleteEnquiriesAction(ids: number[]) {
  await requireAdmin();
  const cleanIds = Array.from(new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0)));
  if (cleanIds.length === 0) return { success: true, deleted: 0 };

  await db.delete(enquiries).where(inArray(enquiries.id, cleanIds));
  revalidatePath("/admin");
  return { success: true, deleted: cleanIds.length };
}

export type PurgeEntityType =
  | "products"
  | "brands"
  | "categories"
  | "documents"
  | "enquiries"
  | "ai_conversations"
  | "whatsapp_logs";

export async function purgeEntityDataAction(entity: PurgeEntityType) {
  await requireAdmin();
  let deleted = 0;

  if (entity === "products") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(products);
    deleted = Number(count || 0);
    await db.delete(products);
  } else if (entity === "brands") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(brands);
    deleted = Number(count || 0);
    await db.delete(brands);
  } else if (entity === "categories") {
    const [{ count: linked }] = await db.select({ count: sql<number>`count(*)` }).from(products);
    if (Number(linked || 0) > 0) {
      throw new Error(
        `Cannot clear all categories while ${linked} product(s) still exist. Clear or reassign products first.`
      );
    }
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(categories);
    deleted = Number(count || 0);
    await db.delete(categories);
  } else if (entity === "documents") {
    const docs = await db.select({ r2Key: documents.r2Key }).from(documents);
    deleted = docs.length;
    await Promise.all(
      docs.filter((d) => Boolean(d.r2Key)).map((d) => deleteFileFromStorage(d.r2Key).catch(() => null))
    );
    await db.delete(documents);
  } else if (entity === "enquiries") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(enquiries);
    deleted = Number(count || 0);
    await db.delete(enquiries);
  } else if (entity === "ai_conversations") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(aiConversations);
    deleted = Number(count || 0);
    await db.delete(aiConversations);
  } else if (entity === "whatsapp_logs") {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(whatsappLogs);
    deleted = Number(count || 0);
    await db.delete(whatsappLogs);
  }

  revalidatePath("/", "layout");
  return { success: true, deleted };
}

export async function clearAiUsageLogsAction() {
  await requireAdmin();
  await db.delete(aiUsageLogs);
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateEnquiryStatusAction(params: {
  id: number;
  status: string;
  adminNotes: string;
}) {
  await requireAdmin();
  await db
    .update(enquiries)
    .set({
      status: params.status,
      adminNotes: params.adminNotes,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(enquiries.id, params.id));

  revalidatePath("/admin");
  revalidatePath("/admin/enquiries");
  return { success: true };
}

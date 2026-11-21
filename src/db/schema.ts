import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  category: text("category").notNull().default("general"),
  label: text("label").notNull(),
  value: text("value").notNull().default(""),
  valueType: text("value_type").notNull().default("text"),
  isSecret: integer("is_secret", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const pageBlocks = sqliteTable(
  "page_blocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    pageSlug: text("page_slug").notNull(),
    blockKey: text("block_key").notNull(),
    label: text("label").notNull(),
    content: text("content").notNull().default(""),
    contentType: text("content_type").notNull().default("text"),
    mediaUrl: text("media_url"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("page_blocks_slug_key_idx").on(table.pageSlug, table.blockKey),
  ]
);

export const divisions = sqliteTable("divisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  heroImageUrl: text("hero_image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    thumbnailUrl: text("thumbnail_url"),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    index("idx_categories_active_div_sort").on(
      table.isActive,
      table.divisionId,
      table.sortOrder,
      table.name
    ),
  ]
);

export const brands = sqliteTable(
  "brands",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    thumbnailUrl: text("thumbnail_url"),
    countryOfOrigin: text("country_of_origin").notNull().default("India"),
    sourcingType: text("sourcing_type").notNull().default("independent"),
    sourcingNote: text("sourcing_note").notNull().default(""),
    description: text("description").notNull().default(""),
    websiteUrl: text("website_url"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    index("idx_brands_active_sort").on(
      table.isActive,
      table.isFeatured,
      table.sortOrder,
      table.name
    ),
  ]
);

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    brandId: integer("brand_id").references(() => brands.id, {
      onDelete: "set null",
    }),
    pricingMode: text("pricing_mode").notNull().default("rfq_only"),
    basePrice: real("base_price"),
    priceUnit: text("price_unit").notNull().default("NOS"),
    gstPercent: real("gst_percent").notNull().default(18),
    moq: text("moq").notNull().default("1 NOS"),
    leadTime: text("lead_time").notNull().default("3–7 Working Days"),
    hsnCode: text("hsn_code").notNull().default(""),
    specificationsJson: text("specifications_json").notNull().default("[]"),
    primaryImageUrl: text("primary_image_url"),
    galleryJson: text("gallery_json").notNull().default("[]"),
    inStockStatus: text("in_stock_status").notNull().default("Available to Order"),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_products_brand_active_name").on(table.brandId, table.isActive, table.isFeatured, table.name),
    index("idx_products_cat_active_name").on(table.categoryId, table.isActive, table.isFeatured, table.name),
    index("idx_products_div_active_name").on(table.divisionId, table.isActive, table.isFeatured, table.name),
    index("idx_products_active_feat_name").on(table.isActive, table.isFeatured, table.name),
    index("idx_products_pricing_active").on(table.pricingMode, table.isActive, table.isFeatured, table.name),
    index("idx_products_updated_at").on(table.updatedAt),
    index("idx_products_hsn_code").on(table.hsnCode),
    index("idx_products_primary_image_url").on(table.primaryImageUrl),
  ]
);

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("datasheet"),
    fileUrl: text("file_url").notNull(),
    r2Key: text("r2_key").notNull().default(""),
    fileName: text("file_name").notNull().default(""),
    fileSize: integer("file_size").notNull().default(0),
    mimeType: text("mime_type").notNull().default("application/pdf"),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    brandId: integer("brand_id").references(() => brands.id, {
      onDelete: "set null",
    }),
    divisionId: integer("division_id").references(() => divisions.id, {
      onDelete: "set null",
    }),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_documents_public_prod").on(table.isPublic, table.productId),
    index("idx_documents_public_cat_created").on(table.isPublic, table.category, table.createdAt),
  ]
);

export const enquiries = sqliteTable("enquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  referenceNo: text("reference_no").notNull().unique(),
  channel: text("channel").notNull().default("email"),
  customerName: text("customer_name").notNull(),
  companyName: text("company_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  gstNumber: text("gst_number").notNull().default(""),
  deliveryLocation: text("delivery_location").notNull().default(""),
  itemsJson: text("items_json").notNull().default("[]"),
  attachmentUrl: text("attachment_url"),
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("new"),
  emailSent: integer("email_sent", { mode: "boolean" }).notNull().default(false),
  whatsappDispatched: integer("whatsapp_dispatched", { mode: "boolean" })
    .notNull()
    .default(false),
  adminNotes: text("admin_notes").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const whatsappLogs = sqliteTable("whatsapp_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  direction: text("direction").notNull().default("outbound"),
  waMessageId: text("wa_message_id"),
  phoneNumber: text("phone_number").notNull(),
  messageType: text("message_type").notNull().default("text"),
  payloadJson: text("payload_json").notNull().default("{}"),
  status: text("status").notNull().default("logged"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const aiConversations = sqliteTable("ai_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull().unique(),
  messagesJson: text("messages_json").notNull().default("[]"),
  leadCaptured: integer("lead_captured", { mode: "boolean" })
    .notNull()
    .default(false),
  enquiryId: integer("enquiry_id").references(() => enquiries.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const aiUsageLogs = sqliteTable("ai_usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthKey: text("month_key").notNull(),
  dayKey: text("day_key").notNull(),
  endpoint: text("endpoint").notNull(),
  model: text("model").notNull().default("claude-haiku-5-5"),
  clientKey: text("client_key").notNull().default("anon"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  webSearches: integer("web_searches").notNull().default(0),
  estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type SpecRow = { label: string; value: string };
export type EnquiryItem = {
  productId?: number;
  sku?: string;
  name: string;
  brand?: string;
  qty: string;
  unit?: string;
  listedPrice?: number | null;
};

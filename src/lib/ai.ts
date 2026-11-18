import {
  db,
  products,
  brands,
  categories,
  divisions,
  documents,
  enquiries,
  siteSettings,
  aiConversations,
} from "@/db";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { getSiteSettings, revalidateCmsCache } from "./settings";
import { deleteFileFromStorage } from "./r2";
import {
  checkAiBudgetAllowed,
  parseBudgetPolicy,
  recordAiUsage,
  trimChatMessages,
} from "./ai-budget";
import { sendEnquiryEmails, sendDirectCustomerEmail } from "./mailer";
import {
  buildWhatsAppQuoteMessage,
  buildWhatsAppUrl,
  dispatchWhatsAppMessage,
} from "./whatsapp";
import type { EnquiryItem } from "@/db/schema";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantResponse {
  reply: string;
  matchedProducts?: Array<{
    name: string;
    sku: string;
    slug: string;
    brand: string | null;
    pricingMode: string;
    basePrice: number | null;
    priceUnit: string;
  }>;
  leadReferenceNo?: string;
  whatsappUrl?: string;
}

async function searchInternalProducts(query: string, includeInternalPrices: boolean, limit = 6) {
  const q = query.trim();
  const pattern = `%${q}%`;
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      name: products.name,
      shortDescription: products.shortDescription,
      pricingMode: products.pricingMode,
      basePrice: products.basePrice,
      priceUnit: products.priceUnit,
      gstPercent: products.gstPercent,
      leadTime: products.leadTime,
      moq: products.moq,
      hsnCode: products.hsnCode,
      brandName: brands.name,
      categoryName: categories.name,
      divisionName: divisions.name,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(divisions, eq(products.divisionId, divisions.id))
    .where(
      and(
        eq(products.isActive, true),
        or(
          like(products.name, pattern),
          like(products.sku, pattern),
          like(products.shortDescription, pattern),
          like(products.description, pattern),
          like(products.specificationsJson, pattern),
          like(products.hsnCode, pattern),
          like(brands.name, pattern),
          like(categories.name, pattern),
          like(divisions.name, pattern)
        )
      )
    )
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    shortDescription: r.shortDescription.slice(0, 140),
    publicPriceDisplay:
      includeInternalPrices && r.pricingMode === "priced" && r.basePrice != null
        ? `₹${r.basePrice.toLocaleString("en-IN")} / ${r.priceUnit} (+${r.gstPercent}% GST)`
        : "Ask for Price",
    basePrice: includeInternalPrices ? r.basePrice : null,
  }));
}

type MatchedProductRow = Awaited<ReturnType<typeof searchInternalProducts>>[number];

async function getProductByCodeOrSlug(identifier: string, includeInternalPrices: boolean) {
  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      name: products.name,
      shortDescription: products.shortDescription,
      description: products.description,
      specificationsJson: products.specificationsJson,
      pricingMode: products.pricingMode,
      basePrice: products.basePrice,
      priceUnit: products.priceUnit,
      gstPercent: products.gstPercent,
      leadTime: products.leadTime,
      moq: products.moq,
      hsnCode: products.hsnCode,
      inStockStatus: products.inStockStatus,
      brandName: brands.name,
      categoryName: categories.name,
      divisionName: divisions.name,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(divisions, eq(products.divisionId, divisions.id))
    .where(or(eq(products.sku, identifier.trim()), eq(products.slug, identifier.trim())))
    .limit(1);

  if (!row) return { found: false };
  return {
    found: true,
    ...row,
    basePrice: includeInternalPrices ? row.basePrice : null,
    publicPriceDisplay:
      includeInternalPrices && row.pricingMode === "priced" && row.basePrice != null
        ? `₹${row.basePrice.toLocaleString("en-IN")} / ${row.priceUnit}`
        : "Ask for Price",
  };
}

async function listCatalogTaxonomy() {
  const [divs, cats] = await Promise.all([
    db.select({ id: divisions.id, slug: divisions.slug, name: divisions.name, tagline: divisions.tagline }).from(divisions).where(eq(divisions.isActive, true)),
    db.select({ id: categories.id, slug: categories.slug, name: categories.name, divisionId: categories.divisionId }).from(categories).where(eq(categories.isActive, true)),
  ]);
  return { divisions: divs, categories: cats };
}

async function listSourcedBrands(query?: string) {
  const rows = await db
    .select({
      name: brands.name,
      slug: brands.slug,
      countryOfOrigin: brands.countryOfOrigin,
      sourcingType: brands.sourcingType,
    })
    .from(brands)
    .where(eq(brands.isActive, true));

  if (query && query.trim()) {
    const needle = query.toLowerCase();
    return rows.filter((b) => b.name.toLowerCase().includes(needle)).slice(0, 12);
  }
  return rows.slice(0, 35);
}

async function findPublicDocuments(query?: string) {
  const rows = await db
    .select({
      title: documents.title,
      category: documents.category,
      fileUrl: documents.fileUrl,
    })
    .from(documents)
    .where(eq(documents.isPublic, true))
    .limit(12);

  if (query && query.trim()) {
    const needle = query.toLowerCase();
    return rows.filter((d) => d.title.toLowerCase().includes(needle));
  }
  return rows;
}

async function captureLeadToDatabaseAndEmail(args: {
  customerName: string;
  companyName?: string;
  email?: string;
  phone: string;
  deliveryLocation?: string;
  requestedItems: string;
  notes?: string;
}) {
  const refNo = `AI-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  const items: EnquiryItem[] = [
    {
      name: args.requestedItems,
      qty: "As specified",
      unit: "REQ",
      listedPrice: null,
    },
  ];

  const [created] = await db
    .insert(enquiries)
    .values({
      referenceNo: refNo,
      channel: "ai_assistant",
      customerName: args.customerName,
      companyName: args.companyName || "",
      email: args.email || "",
      phone: args.phone,
      deliveryLocation: args.deliveryLocation || "",
      itemsJson: JSON.stringify(items),
      message: args.notes || args.requestedItems,
      status: "new",
    })
    .returning();

  const emailRes = await sendEnquiryEmails({
    referenceNo: refNo,
    channel: "AI Assistant Conversation",
    customerName: args.customerName,
    companyName: args.companyName,
    email: args.email,
    phone: args.phone,
    deliveryLocation: args.deliveryLocation,
    items,
    message: args.notes || args.requestedItems,
  });

  if (emailRes.sent && created) {
    await db.update(enquiries).set({ emailSent: true }).where(eq(enquiries.id, created.id));
  }

  const settings = await getSiteSettings();
  const waMsg = buildWhatsAppQuoteMessage({
    items,
    customerName: args.customerName,
    companyName: args.companyName,
    deliveryLocation: args.deliveryLocation,
    notes: `Ref: ${refNo}${args.notes ? ` | ${args.notes}` : ""}`,
    showPrices: settings["show_public_prices"] === "true",
  });
  const waUrl = buildWhatsAppUrl(settings["whatsapp_number"] || "918522095253", waMsg);

  return {
    referenceNo: refNo,
    enquiryId: created?.id,
    adminEmailSent: emailRes.sent,
    customerThankYouSent: emailRes.customerThankYouSent,
    whatsappUrl: waUrl,
  };
}

async function buildSiteContextPrompt(isAdminMode: boolean) {
  const [settings, allDivisions] = await Promise.all([
    getSiteSettings(),
    db
      .select({ name: divisions.name, slug: divisions.slug })
      .from(divisions)
      .where(eq(divisions.isActive, true)),
  ]);

  const showPrices = settings["show_public_prices"] === "true";
  const customInstructions = (settings["ai_system_prompt"] || "").slice(0, 400);

  if (isAdminMode) {
    return `Admin Operations Copilot for Radiant Industrial Co. (radiantindustrial.in).
Full DB access: search products (including saved rates/HSN/GST), list brands/categories, query/update enquiries, bulk delete records, send customer emails, send WhatsApp links, and update settings.
Keep answers concise, plain English, and factual.`;
  }

  return `Customer Procurement Assistant for Radiant Industrial Co. (${settings["contact_address"] || "Ranigunj, Secunderabad 500003, Telangana"}).
Tel/WhatsApp: ${settings["contact_phone"] || "+91 8522095253"} | Email: ${settings["contact_email"] || "info@radiantindustrial.in"} | Hours: ${settings["operating_hours"] || "Mon–Sat 9 AM–6 PM IST"}.

RULES:
- Use simple, friendly, plain English and concise replies (under 150 words unless listing specs).
- PRICING: ${showPrices ? "Share saved prices when listed." : "ALWAYS reply 'Ask for Price' — NEVER reveal internal prices. Offer WhatsApp or Email quote."}
- SOURCING: State honestly we are an independent wholesale buyer (not an official OEM dealer yet) sourcing genuine items on order.
- TOOLS: Check products/brands/documents with tools before answering. To send an email or capture a quote lead, collect Name + Phone/WhatsApp (+ Email if needed) and call capture_lead.
- Supply Scopes: ${allDivisions.map((d) => `${d.name} (/divisions/${d.slug})`).join(", ")}
${customInstructions ? `Notes: ${customInstructions}` : ""}`;
}

const CUSTOMER_TOOLS = [
  {
    name: "search_products",
    description: "Search the entire internal products database by product name, SKU, brand, category, HSN, or technical specs.",
    properties: {
      query: { type: "string", description: "Search keyword, model, brand, or product type" },
    },
    required: ["query"],
  },
  {
    name: "get_product_details",
    description: "Get complete technical specifications and details for a specific product by SKU or slug.",
    properties: {
      identifier: { type: "string", description: "SKU or product slug" },
    },
    required: ["identifier"],
  },
  {
    name: "list_taxonomy",
    description: "List all supply divisions and product categories in the database.",
    properties: {},
    required: [],
  },
  {
    name: "list_brands",
    description: "Check which industrial and farm brands Radiant Industrial Co. sources.",
    properties: {
      query: { type: "string", description: "Optional brand filter" },
    },
    required: [],
  },
  {
    name: "find_documents",
    description: "Look up downloadable company documents, order terms, and product brochures.",
    properties: {
      query: { type: "string", description: "Optional document keyword" },
    },
    required: [],
  },
  {
    name: "capture_lead",
    description: "Save a customer enquiry to the database, email admins, and send a thank-you email to the customer.",
    properties: {
      customerName: { type: "string", description: "Customer full name" },
      companyName: { type: "string", description: "Company name" },
      email: { type: "string", description: "Customer email address" },
      phone: { type: "string", description: "Customer phone or WhatsApp number" },
      deliveryLocation: { type: "string", description: "Delivery city/state" },
      requestedItems: { type: "string", description: "Products, specs, brands, and quantities requested" },
      notes: { type: "string", description: "Additional notes" },
    },
    required: ["customerName", "phone", "requestedItems"],
  },
  {
    name: "send_whatsapp_message",
    description: "Generate or send a pre-filled WhatsApp message for the customer or sales desk.",
    properties: {
      toPhone: { type: "string", description: "Target phone number (omit to open Radiant sales WhatsApp)" },
      message: { type: "string", description: "Plain text WhatsApp message" },
    },
    required: ["message"],
  },
  {
    name: "send_customer_email",
    description: "Send a helpful plain-English follow-up email to a customer using the Customer SMTP account.",
    properties: {
      toEmail: { type: "string", description: "Recipient email" },
      subject: { type: "string", description: "Email subject" },
      bodyText: { type: "string", description: "Plain text email body" },
    },
    required: ["toEmail", "subject", "bodyText"],
  },
];

const ADMIN_TOOLS = [
  ...CUSTOMER_TOOLS,
  {
    name: "query_enquiries",
    description: "List or filter recent customer enquiries and leads from the database.",
    properties: {
      status: { type: "string", description: "Optional status: new, in_progress, quoted, closed" },
    },
    required: [],
  },
  {
    name: "update_enquiry_status",
    description: "Update status and internal admin notes for a customer enquiry by ID or reference number.",
    properties: {
      id: { type: "string", description: "Numeric enquiry ID" },
      status: { type: "string", description: "new, in_progress, quoted, or closed" },
      adminNotes: { type: "string", description: "Internal notes to save" },
    },
    required: ["id", "status"],
  },
  {
    name: "update_site_setting",
    description: "Update a site setting key-value in SQLite.",
    properties: {
      key: { type: "string", description: "Setting key (e.g., contact_phone, operating_hours, show_public_prices)" },
      value: { type: "string", description: "New setting value" },
    },
    required: ["key", "value"],
  },
  {
    name: "bulk_delete_records",
    description: "Admin-only bulk delete by numeric IDs for products, brands, categories, documents, or enquiries.",
    properties: {
      entity: {
        type: "string",
        description: "One of: products, brands, categories, documents, enquiries",
      },
      ids: {
        type: "array",
        items: { type: "number" },
        description: "Numeric IDs to delete permanently",
      },
    },
    required: ["entity", "ids"],
  },
];

async function executeCustomerTool(
  name: string,
  args: Record<string, unknown>,
  includeInternalPrices: boolean
) {
  if (name === "search_products") {
    return searchInternalProducts(String(args.query || ""), includeInternalPrices, 10);
  }
  if (name === "get_product_details") {
    return getProductByCodeOrSlug(String(args.identifier || ""), includeInternalPrices);
  }
  if (name === "list_taxonomy") {
    return listCatalogTaxonomy();
  }
  if (name === "list_brands") {
    return listSourcedBrands(args.query ? String(args.query) : undefined);
  }
  if (name === "find_documents") {
    return findPublicDocuments(args.query ? String(args.query) : undefined);
  }
  if (name === "capture_lead") {
    return captureLeadToDatabaseAndEmail({
      customerName: String(args.customerName || "Buyer"),
      companyName: args.companyName ? String(args.companyName) : undefined,
      email: args.email ? String(args.email) : undefined,
      phone: String(args.phone || ""),
      deliveryLocation: args.deliveryLocation ? String(args.deliveryLocation) : undefined,
      requestedItems: String(args.requestedItems || ""),
      notes: args.notes ? String(args.notes) : undefined,
    });
  }
  if (name === "send_whatsapp_message") {
    return dispatchWhatsAppMessage({
      toPhone: args.toPhone ? String(args.toPhone) : undefined,
      message: String(args.message || ""),
    });
  }
  if (name === "send_customer_email") {
    return sendDirectCustomerEmail({
      toEmail: String(args.toEmail || ""),
      subject: String(args.subject || "Radiant Industrial Co. — Product Information"),
      bodyText: String(args.bodyText || ""),
    });
  }
  if (name === "query_enquiries" && includeInternalPrices) {
    const status = args.status ? String(args.status) : undefined;
    const rows = status
      ? await db.select().from(enquiries).where(eq(enquiries.status, status)).orderBy(desc(enquiries.createdAt)).limit(25)
      : await db.select().from(enquiries).orderBy(desc(enquiries.createdAt)).limit(25);
    return rows;
  }
  if (name === "update_enquiry_status" && includeInternalPrices) {
    const id = Number(args.id);
    if (!id) return { error: "Invalid enquiry ID" };
    await db
      .update(enquiries)
      .set({
        status: String(args.status || "quoted"),
        adminNotes: args.adminNotes ? String(args.adminNotes) : "",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(enquiries.id, id));
    return { updated: true, id };
  }
  if (name === "update_site_setting" && includeInternalPrices) {
    const key = String(args.key || "");
    const value = String(args.value || "");
    await db.update(siteSettings).set({ value, updatedAt: new Date().toISOString() }).where(eq(siteSettings.key, key));
    revalidateCmsCache();
    return { updated: true, key, value };
  }
  if (name === "bulk_delete_records" && includeInternalPrices) {
    const entity = String(args.entity || "");
    const rawIds = Array.isArray(args.ids) ? args.ids : [];
    const cleanIds = Array.from(new Set(rawIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)));
    if (cleanIds.length === 0) return { deleted: 0 };

    if (entity === "products") {
      await db.delete(products).where(inArray(products.id, cleanIds));
      return { deleted: cleanIds.length, entity };
    }
    if (entity === "brands") {
      await db.delete(brands).where(inArray(brands.id, cleanIds));
      return { deleted: cleanIds.length, entity };
    }
    if (entity === "categories") {
      const [linked] = await db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(inArray(products.categoryId, cleanIds));
      if (Number(linked?.count || 0) > 0) {
        return { error: `Cannot delete: ${linked.count} product(s) still reference those categories.` };
      }
      await db.delete(categories).where(inArray(categories.id, cleanIds));
      return { deleted: cleanIds.length, entity };
    }
    if (entity === "documents") {
      const docs = await db
        .select({ r2Key: documents.r2Key })
        .from(documents)
        .where(inArray(documents.id, cleanIds));
      await Promise.all(
        docs.filter((d) => Boolean(d.r2Key)).map((d) => deleteFileFromStorage(d.r2Key).catch(() => null))
      );
      await db.delete(documents).where(inArray(documents.id, cleanIds));
      return { deleted: cleanIds.length, entity };
    }
    if (entity === "enquiries") {
      await db.delete(enquiries).where(inArray(enquiries.id, cleanIds));
      return { deleted: cleanIds.length, entity };
    }
    return { error: `Unsupported entity: ${entity}` };
  }
  return { error: "Unknown or unauthorized tool" };
}

async function runLlmLoop(params: {
  messages: ChatMessage[];
  isAdminMode: boolean;
  clientKey?: string;
}): Promise<{
  reply: string;
  matchedProducts: AssistantResponse["matchedProducts"];
  leadReferenceNo?: string;
  whatsappUrl?: string;
}> {
  const settings = await getSiteSettings();
  const provider = (settings["ai_provider"] || "anthropic").toLowerCase();
  const apiKey = (settings["ai_api_key"] || "").trim();
  const model = (settings["ai_model"] || "claude-haiku-5-5").trim();
  const effort = (settings["ai_effort"] || "low").trim();
  const policy = parseBudgetPolicy(settings);
  const endpoint = params.isAdminMode ? "admin_chat" : "customer_chat";
  const includePrices = params.isAdminMode || settings["show_public_prices"] === "true";
  const toolSet = params.isAdminMode ? ADMIN_TOOLS : CUSTOMER_TOOLS;

  const trimmedMessages = trimChatMessages(
    params.messages,
    policy.maxHistoryMessages,
    params.isAdminMode ? 1500 : 800
  );

  let matchedProducts: AssistantResponse["matchedProducts"] = [];
  let leadReferenceNo: string | undefined;
  let whatsappUrl: string | undefined;
  let reply = "";
  let budgetBlockedReason: string | undefined;

  const budgetCheck = await checkAiBudgetAllowed({
    endpoint,
    clientKey: params.clientKey || (params.isAdminMode ? "admin" : "anon"),
    policy,
  });

  if (!budgetCheck.allowed) {
    budgetBlockedReason = budgetCheck.reason;
  }

  let accIn = 0;
  let accOut = 0;
  let accCacheRead = 0;
  let accCacheWrite = 0;
  let accWeb = 0;
  let madeBillableCall = false;

  const handleToolSideEffects = (name: string, toolResult: unknown) => {
    if (name === "search_products" && Array.isArray(toolResult)) {
      matchedProducts = (toolResult as MatchedProductRow[]).map((r) => ({
        name: r.name,
        sku: r.sku,
        slug: r.slug,
        brand: r.brandName,
        pricingMode: includePrices ? r.pricingMode : "rfq_only",
        basePrice: includePrices ? r.basePrice : null,
        priceUnit: r.priceUnit,
      }));
    }
    if (
      (name === "capture_lead" || name === "send_whatsapp_message") &&
      toolResult &&
      typeof toolResult === "object"
    ) {
      const obj = toolResult as { referenceNo?: string; whatsappUrl?: string; url?: string };
      if (obj.referenceNo) leadReferenceNo = obj.referenceNo;
      if (obj.whatsappUrl) whatsappUrl = obj.whatsappUrl;
      if (obj.url) whatsappUrl = obj.url;
    }
  };

  if (budgetCheck.allowed && apiKey && provider === "anthropic") {
    try {
      const systemPrompt = await buildSiteContextPrompt(params.isAdminMode);
      const anthropicTools: Array<Record<string, unknown>> = toolSet.map((t, idx) => ({
        name: t.name,
        description: t.description,
        input_schema: {
          type: "object",
          properties: t.properties,
          required: t.required,
        },
        // Mark the final custom tool for Anthropic prompt caching
        ...(idx === toolSet.length - 1 && !(params.isAdminMode && policy.adminChatWebSearch)
          ? { cache_control: { type: "ephemeral" } }
          : {}),
      }));

      // Only attach costly web_search ($0.01/search) inside Admin Chat if explicitly enabled in Settings
      if (params.isAdminMode && policy.adminChatWebSearch) {
        anthropicTools.push({
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 1,
        });
      }

      const anthropicMessages: Array<Record<string, unknown>> = trimmedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      for (let step = 0; step < policy.maxToolSteps; step++) {
        const body: Record<string, unknown> = {
          model,
          max_tokens: policy.maxOutputTokens,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: anthropicTools,
          messages: anthropicMessages,
        };
        if (effort === "high" || effort === "medium") {
          body.output_config = { effort };
        } else {
          body.thinking = { type: "disabled" };
        }

        let res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok && (body.output_config || body.thinking)) {
          delete body.output_config;
          delete body.thinking;
          res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
          });
        }

        const data = await res.json();
        if (data?.usage) {
          madeBillableCall = true;
          accIn += Number(data.usage.input_tokens || 0);
          accOut += Number(data.usage.output_tokens || 0);
          accCacheRead += Number(data.usage.cache_read_input_tokens || 0);
          accCacheWrite += Number(data.usage.cache_creation_input_tokens || 0);
          accWeb += Number(data.usage?.server_tool_use?.web_search_requests || 0);
        }

        const contentBlocks = Array.isArray(data?.content) ? data.content : [];
        if (contentBlocks.length === 0) break;

        const toolUses = contentBlocks.filter((b: { type?: string }) => b.type === "tool_use");
        if (toolUses.length > 0) {
          anthropicMessages.push({ role: "assistant", content: contentBlocks });
          const toolResults: Array<Record<string, unknown>> = [];
          for (const tu of toolUses) {
            const toolResult = await executeCustomerTool(tu.name, tu.input || {}, includePrices);
            handleToolSideEffects(tu.name, toolResult);
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(toolResult),
            });
          }
          anthropicMessages.push({ role: "user", content: toolResults });
          continue;
        }

        const textReply = contentBlocks
          .filter((b: { type?: string }) => b.type === "text")
          .map((b: { text?: string }) => b.text || "")
          .join("\n")
          .trim();

        if (textReply) {
          reply = textReply;
          break;
        }
      }
    } catch {
      // fallback below
    }
  } else if (budgetCheck.allowed && apiKey && provider === "openai") {
    try {
      const baseUrl = (settings["ai_base_url"] || "https://api.openai.com/v1").replace(/\/+$/, "");
      const systemInstruction = await buildSiteContextPrompt(params.isAdminMode);
      const openAiMessages: Array<Record<string, unknown>> = [
        { role: "system", content: systemInstruction },
        ...trimmedMessages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const tools = toolSet.map((f) => ({
        type: "function",
        function: {
          name: f.name,
          description: f.description,
          parameters: {
            type: "object",
            properties: f.properties,
            required: f.required,
          },
        },
      }));

      for (let step = 0; step < policy.maxToolSteps; step++) {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: policy.maxOutputTokens,
            messages: openAiMessages,
            tools,
          }),
        });
        const data = await res.json();
        if (data?.usage) {
          madeBillableCall = true;
          accIn += Number(data.usage.prompt_tokens || 0);
          accOut += Number(data.usage.completion_tokens || 0);
        }
        const choice = data?.choices?.[0]?.message;
        if (!choice) break;

        if (choice.tool_calls?.length) {
          openAiMessages.push(choice);
          for (const call of choice.tool_calls) {
            const parsedArgs = JSON.parse(call.function.arguments || "{}");
            const toolResult = await executeCustomerTool(call.function.name, parsedArgs, includePrices);
            handleToolSideEffects(call.function.name, toolResult);
            openAiMessages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(toolResult),
            });
          }
          continue;
        }
        if (choice.content) {
          reply = choice.content;
          break;
        }
      }
    } catch {
      // fallback below
    }
  } else if (budgetCheck.allowed && apiKey && provider === "gemini") {
    try {
      const systemInstruction = await buildSiteContextPrompt(params.isAdminMode);
      const geminiTools = [
        {
          functionDeclarations: toolSet.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: {
              type: "OBJECT",
              properties: Object.fromEntries(
                Object.entries(t.properties).map(([k, v]) => [
                  k,
                  { type: "STRING", description: (v as { description?: string }).description || "" },
                ])
              ),
              required: t.required,
            },
          })),
        },
      ];
      const contents: Array<Record<string, unknown>> = trimmedMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      for (let step = 0; step < policy.maxToolSteps; step++) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: { maxOutputTokens: policy.maxOutputTokens },
              contents,
              tools: geminiTools,
            }),
          }
        );

        const data = await res.json();
        if (data?.usageMetadata) {
          madeBillableCall = true;
          accIn += Number(data.usageMetadata.promptTokenCount || 0);
          accOut += Number(data.usageMetadata.candidatesTokenCount || 0);
        }
        const candidate = data?.candidates?.[0]?.content;
        if (!candidate?.parts) break;

        const fnCallPart = candidate.parts.find((p: { functionCall?: unknown }) => p.functionCall);
        if (fnCallPart?.functionCall) {
          const { name, args } = fnCallPart.functionCall as { name: string; args: Record<string, unknown> };
          const toolResult = await executeCustomerTool(name, args || {}, includePrices);
          handleToolSideEffects(name, toolResult);
          contents.push({ role: "model", parts: candidate.parts });
          contents.push({
            role: "user",
            parts: [{ functionResponse: { name, response: { result: toolResult } } }],
          });
          continue;
        }

        const textPart = candidate.parts.map((p: { text?: string }) => p.text || "").join("").trim();
        if (textPart) {
          reply = textPart;
          break;
        }
      }
    } catch {
      // fallback below
    }
  }

  if (madeBillableCall) {
    await recordAiUsage({
      endpoint,
      model,
      clientKey: params.clientKey || (params.isAdminMode ? "admin" : "anon"),
      inputTokens: accIn,
      outputTokens: accOut,
      cacheReadTokens: accCacheRead,
      cacheWriteTokens: accCacheWrite,
      webSearches: accWeb,
    });
  }

  // Deterministic zero-cost DB-backed fallback if no key, over monthly budget, or over daily session limit
  if (!reply) {
    const lastUserMessage = params.messages[params.messages.length - 1]?.content || "";
    const tokens = lastUserMessage
      .replace(/[^a-zA-Z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const searchTerm = tokens.slice(0, 3).join(" ") || lastUserMessage;
    const found = await searchInternalProducts(searchTerm, includePrices, 5);
    const allMatchedBrands = await listSourcedBrands(tokens[0]);

    if (found.length > 0) {
      matchedProducts = found.map((r) => ({
        name: r.name,
        sku: r.sku,
        slug: r.slug,
        brand: r.brandName,
        pricingMode: includePrices ? r.pricingMode : "rfq_only",
        basePrice: includePrices ? r.basePrice : null,
        priceUnit: r.priceUnit,
      }));
      const lines = found.map((item) => {
        const priceLabel =
          includePrices && item.basePrice != null
            ? `₹${item.basePrice.toLocaleString("en-IN")} / ${item.priceUnit}`
            : "Ask for Price";
        return `• **${item.name}** (${item.sku}${item.brandName ? ` • ${item.brandName}` : ""}) — ${priceLabel}, Delivery: ${item.leadTime}`;
      });
      reply = `Here are matching items from our catalog:\n\n${lines.join("\n")}\n\nClick any item below to open its full specifications, or switch to **Send Enquiry** to share your requirement with our sales team.`;
    } else if (allMatchedBrands.length > 0 && tokens.length > 0) {
      reply = `Yes — Radiant Industrial Co. sources genuine products from **${allMatchedBrands
        .slice(0, 5)
        .map((b) => b.name)
        .join(", ")}** (as an independent wholesale supplier). Share your required item or quantity via **Send Enquiry** and our team will quote right away.`;
    } else {
      reply = `I checked our catalog for "${lastUserMessage}" and our team can source this item for you.\n\nUse the **Send Enquiry** tab to forward your requirement directly to our Secunderabad team (+91 8522095253 / info@radiantindustrial.in), or ask about brands like SKF, NTN, Polycab, Godrej, ESAB, Udyogi, Dowty, or Jain Irrigation.`;
    }

    if (params.isAdminMode && budgetBlockedReason) {
      reply = `[Free DB Mode: ${budgetBlockedReason}]\n\n${reply}`;
    }
  }

  return { reply, matchedProducts, leadReferenceNo, whatsappUrl };
}

export async function runProcurementAssistant(params: {
  sessionId: string;
  messages: ChatMessage[];
  clientKey?: string;
}): Promise<AssistantResponse> {
  const result = await runLlmLoop({
    messages: params.messages,
    isAdminMode: false,
    clientKey: params.clientKey || params.sessionId,
  });

  const updatedHistory = [...params.messages, { role: "assistant" as const, content: result.reply }];
  const existing = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(eq(aiConversations.sessionId, params.sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(aiConversations)
      .set({
        messagesJson: JSON.stringify(updatedHistory),
        leadCaptured: Boolean(result.leadReferenceNo),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(aiConversations.sessionId, params.sessionId));
  } else {
    await db.insert(aiConversations).values({
      sessionId: params.sessionId,
      messagesJson: JSON.stringify(updatedHistory),
      leadCaptured: Boolean(result.leadReferenceNo),
    });
  }

  return result;
}

export async function runAdminAiAssistant(params: {
  messages: ChatMessage[];
}): Promise<AssistantResponse> {
  return runLlmLoop({ messages: params.messages, isAdminMode: true });
}

export async function forwardAiLead(payload: {
  sessionId: string;
  customerName: string;
  companyName?: string;
  email?: string;
  phone: string;
  deliveryLocation?: string;
  requestedItems: string;
  notes?: string;
}) {
  const result = await captureLeadToDatabaseAndEmail(payload);
  await db
    .update(aiConversations)
    .set({
      leadCaptured: true,
      enquiryId: result.enquiryId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(aiConversations.sessionId, payload.sessionId));
  return result;
}

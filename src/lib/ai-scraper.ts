import { db, divisions, categories, brands } from "@/db";
import { asc, eq } from "drizzle-orm";
import { getSiteSettings } from "./settings";
import {
  checkAiBudgetAllowed,
  parseBudgetPolicy,
  recordAiUsage,
} from "./ai-budget";

export interface ScrapedProductDraft {
  name: string;
  sku: string;
  shortDescription: string;
  description: string;
  divisionId: number;
  categoryId: number;
  brandId: number | null;
  hsnCode: string;
  priceUnit: string;
  gstPercent: number;
  moq: string;
  leadTime: string;
  specifications: Array<{ label: string; value: string }>;
  sourcesUsed: string[];
  usedAi: boolean;
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function scrapeAndStructureProduct(rawInput: string): Promise<ScrapedProductDraft> {
  const [settings, allDivisions, allCategories, allBrands] = await Promise.all([
    getSiteSettings(),
    db.select().from(divisions).where(eq(divisions.isActive, true)).orderBy(asc(divisions.sortOrder)),
    db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
    db.select().from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.name)),
  ]);

  const apiKey = (settings["ai_api_key"] || "").trim();
  const provider = (settings["ai_provider"] || "anthropic").toLowerCase();
  const model = (settings["ai_model"] || "claude-haiku-5-5").trim();
  const effort = (settings["ai_effort"] || "low").trim();
  const policy = parseBudgetPolicy(settings);

  if (!apiKey) {
    throw new Error(
      "AI API Key is not configured. Save your Anthropic API key in Admin → Settings → AI (Claude Haiku 5.5) first."
    );
  }

  const budgetCheck = await checkAiBudgetAllowed({
    endpoint: "product_lookup",
    clientKey: "admin",
    policy,
  });
  if (!budgetCheck.allowed) {
    throw new Error(budgetCheck.reason || "Monthly AI budget limit reached.");
  }

  const defaultDivId = allDivisions[0]?.id || 1;
  const defaultCatId = allCategories[0]?.id || 1;
  const matchedBrand = allBrands.find((b) =>
    rawInput.toLowerCase().includes(b.name.toLowerCase().split(" ")[0])
  );

  // Compact tabular lists save ~60% prompt tokens compared to verbose JSON arrays
  const divList = allDivisions.map((d) => `${d.id}:${d.slug}(${d.name})`).join(" | ");
  const catList = allCategories
    .map((c) => `${c.id}:div=${c.divisionId}:${c.slug}(${c.name})`)
    .join(" | ");
  const brandList = allBrands.map((b) => `${b.id}:${b.name}`).join(", ");

  const prompt = `Research exact specs & Indian HSN/GST for product: "${rawInput}"

Divisions: ${divList}
Categories: ${catList}
Brands: ${brandList}

Rules:
- Pick exact categoryId and matching divisionId from above (e.g. power tools go in tools-cutting-machining under industrial, NOT bearings/special-items).
- Plain English descriptions for Indian B2B buyers. Include 5-8 concrete technical specifications.
- Output ONLY valid JSON (no markdown):
{"name":"","sku":"RIC-CODE","shortDescription":"","description":"","divisionId":1,"categoryId":1,"brandId":null,"hsnCode":"","priceUnit":"NOS","gstPercent":18,"moq":"1 NOS","leadTime":"3-7 Working Days","specifications":[{"label":"","value":""}]}`;

  const sourcesUsed: string[] = [];

  if (provider === "anthropic") {
    const body: Record<string, unknown> = {
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    };

    if (policy.maxWebSearches > 0) {
      body.tools = [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: policy.maxWebSearches,
        },
      ];
    }

    if (effort && effort !== "none") {
      body.output_config = { effort };
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

    // Retry cleanly if output_config isn't accepted by a model alias
    if (!res.ok && body.output_config) {
      delete body.output_config;
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
    const usage = data?.usage || {};
    await recordAiUsage({
      endpoint: "product_lookup",
      model,
      clientKey: "admin",
      inputTokens: Number(usage.input_tokens || 0),
      outputTokens: Number(usage.output_tokens || 0),
      cacheReadTokens: Number(usage.cache_read_input_tokens || 0),
      cacheWriteTokens: Number(usage.cache_creation_input_tokens || 0),
      webSearches: Number(usage?.server_tool_use?.web_search_requests || 0),
    });

    if (!res.ok) {
      const msg = data?.error?.message || `Anthropic API error (${res.status})`;
      throw new Error(msg);
    }

    const blocks = Array.isArray(data?.content) ? data.content : [];
    for (const block of blocks) {
      if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item?.url && !sourcesUsed.includes(item.url)) {
            sourcesUsed.push(item.url);
          }
        }
      }
    }

    const textCombined = blocks
      .filter((b: { type?: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text || "")
      .join("\n");

    const parsed = extractJsonObject(textCombined);
    if (!parsed) {
      throw new Error("AI did not return structured JSON product data. Please try again.");
    }

    const chosenCatId = Number(parsed.categoryId) || defaultCatId;
    const chosenCat = allCategories.find((c) => c.id === chosenCatId);
    const chosenDivId = chosenCat?.divisionId || Number(parsed.divisionId) || defaultDivId;

    return {
      name: String(parsed.name || rawInput),
      sku: String(parsed.sku || `RIC-${String(Date.now()).slice(-5)}`),
      shortDescription: String(parsed.shortDescription || ""),
      description: String(parsed.description || ""),
      divisionId: chosenDivId,
      categoryId: chosenCatId,
      brandId: parsed.brandId ? Number(parsed.brandId) : matchedBrand?.id ?? null,
      hsnCode: String(parsed.hsnCode || ""),
      priceUnit: String(parsed.priceUnit || "NOS"),
      gstPercent: Number(parsed.gstPercent) || 18,
      moq: String(parsed.moq || "1 NOS"),
      leadTime: String(parsed.leadTime || "3–7 Working Days"),
      specifications: Array.isArray(parsed.specifications)
        ? (parsed.specifications as Array<{ label: string; value: string }>)
        : [],
      sourcesUsed: sourcesUsed.slice(0, 6),
      usedAi: true,
    };
  }

  // OpenAI or Gemini fallback if switched in Settings
  if (provider === "openai") {
    const baseUrl = (settings["ai_base_url"] || "https://api.openai.com/v1").replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    await recordAiUsage({
      endpoint: "product_lookup",
      model,
      clientKey: "admin",
      inputTokens: Number(data?.usage?.prompt_tokens || 0),
      outputTokens: Number(data?.usage?.completion_tokens || 0),
    });
    if (!res.ok) throw new Error(data?.error?.message || "OpenAI lookup failed");
    const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || "");
    if (!parsed) throw new Error("Could not parse structured JSON from OpenAI");

    const chosenCatId = Number(parsed.categoryId) || defaultCatId;
    const chosenCat = allCategories.find((c) => c.id === chosenCatId);
    return {
      name: String(parsed.name || rawInput),
      sku: String(parsed.sku || `RIC-${String(Date.now()).slice(-5)}`),
      shortDescription: String(parsed.shortDescription || ""),
      description: String(parsed.description || ""),
      divisionId: chosenCat?.divisionId || Number(parsed.divisionId) || defaultDivId,
      categoryId: chosenCatId,
      brandId: parsed.brandId ? Number(parsed.brandId) : matchedBrand?.id ?? null,
      hsnCode: String(parsed.hsnCode || ""),
      priceUnit: String(parsed.priceUnit || "NOS"),
      gstPercent: Number(parsed.gstPercent) || 18,
      moq: String(parsed.moq || "1 NOS"),
      leadTime: String(parsed.leadTime || "3–7 Working Days"),
      specifications: Array.isArray(parsed.specifications)
        ? (parsed.specifications as Array<{ label: string; value: string }>)
        : [],
      sourcesUsed,
      usedAi: true,
    };
  }

  throw new Error(`Unsupported AI provider "${provider}" for web product scraping.`);
}

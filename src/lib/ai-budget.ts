import { and, eq, sql } from "drizzle-orm";
import { db, aiUsageLogs, siteSettings } from "@/db";

export type AiEndpoint = "customer_chat" | "admin_chat" | "product_lookup";

export interface AiBudgetPolicy {
  enabled: boolean;
  monthlyBudgetUsd: number;
  maxOutputTokens: number;
  maxHistoryMessages: number;
  maxToolSteps: number;
  maxWebSearches: number;
  adminChatWebSearch: boolean;
  customerDailyLimit: number;
}

export interface MonthlyAiUsageSummary {
  monthKey: string;
  budgetUsd: number;
  totalCostUsd: number;
  remainingUsd: number;
  percentUsed: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalWebSearches: number;
  totalRequests: number;
}

export function getMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

export function getDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function parseBudgetPolicy(settings: Record<string, string>): AiBudgetPolicy {
  const num = (key: string, fallback: number, min: number, max: number) => {
    const parsed = Number(settings[key]);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  return {
    enabled: settings["ai_enabled"] !== "false",
    // Hard default at $8.50 so total monthly bill stays safely under $10
    monthlyBudgetUsd: num("ai_monthly_budget_usd", 8.5, 0.5, 100),
    maxOutputTokens: Math.round(num("ai_max_output_tokens", 512, 128, 2048)),
    maxHistoryMessages: Math.round(num("ai_max_history_messages", 8, 2, 20)),
    maxToolSteps: Math.round(num("ai_max_tool_steps", 3, 1, 6)),
    maxWebSearches: Math.round(num("ai_max_web_searches", 2, 0, 4)),
    adminChatWebSearch: settings["ai_admin_chat_web_search"] === "true",
    customerDailyLimit: Math.round(num("ai_customer_daily_limit", 20, 1, 200)),
  };
}

/**
 * Conservative USD cost calculation so tracked usage never underestimates spend.
 * Includes Anthropic Haiku / Sonnet / OpenAI / Gemini token pricing + $0.01/web search.
 */
export function estimateAiCostUsd(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  webSearches?: number;
}): number {
  const m = (params.model || "").toLowerCase();
  let inRate = 1.0 / 1_000_000;
  let outRate = 5.0 / 1_000_000;
  let cacheReadRate = 0.1 / 1_000_000;
  let cacheWriteRate = 1.25 / 1_000_000;

  if (m.includes("sonnet") || m.includes("gpt-4o") || m.includes("gpt-5")) {
    inRate = 3.0 / 1_000_000;
    outRate = 15.0 / 1_000_000;
    cacheReadRate = 0.3 / 1_000_000;
    cacheWriteRate = 3.75 / 1_000_000;
  } else if (m.includes("opus")) {
    inRate = 15.0 / 1_000_000;
    outRate = 75.0 / 1_000_000;
    cacheReadRate = 1.5 / 1_000_000;
    cacheWriteRate = 18.75 / 1_000_000;
  } else if (m.includes("gemini")) {
    inRate = 0.35 / 1_000_000;
    outRate = 2.5 / 1_000_000;
    cacheReadRate = 0.035 / 1_000_000;
    cacheWriteRate = 0.35 / 1_000_000;
  }

  const webSearchCost = (params.webSearches || 0) * 0.01;
  const tokenCost =
    (params.inputTokens || 0) * inRate +
    (params.outputTokens || 0) * outRate +
    (params.cacheReadTokens || 0) * cacheReadRate +
    (params.cacheWriteTokens || 0) * cacheWriteRate;

  return Number((tokenCost + webSearchCost).toFixed(6));
}

export async function getMonthlyAiUsageSummary(
  budgetUsdOverride?: number
): Promise<MonthlyAiUsageSummary> {
  const monthKey = getMonthKey();
  let budgetUsd = budgetUsdOverride;
  if (budgetUsd === undefined) {
    const [row] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, "ai_monthly_budget_usd"))
      .limit(1);
    const parsed = Number(row?.value);
    budgetUsd = Number.isFinite(parsed) && parsed > 0 ? parsed : 8.5;
  }

  const [agg] = await db
    .select({
      totalCost: sql<number>`coalesce(sum(${aiUsageLogs.estimatedCostUsd}), 0)`,
      totalInput: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)`,
      totalOutput: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)`,
      totalCacheRead: sql<number>`coalesce(sum(${aiUsageLogs.cacheReadTokens}), 0)`,
      totalWeb: sql<number>`coalesce(sum(${aiUsageLogs.webSearches}), 0)`,
      totalReqs: sql<number>`count(*)`,
    })
    .from(aiUsageLogs)
    .where(eq(aiUsageLogs.monthKey, monthKey));

  const totalCostUsd = Number(Number(agg?.totalCost || 0).toFixed(4));
  const remainingUsd = Math.max(0, Number((budgetUsd - totalCostUsd).toFixed(4)));
  const percentUsed = budgetUsd > 0 ? Math.min(100, Math.round((totalCostUsd / budgetUsd) * 100)) : 100;

  return {
    monthKey,
    budgetUsd,
    totalCostUsd,
    remainingUsd,
    percentUsed,
    totalInputTokens: Number(agg?.totalInput || 0),
    totalOutputTokens: Number(agg?.totalOutput || 0),
    totalCacheReadTokens: Number(agg?.totalCacheRead || 0),
    totalWebSearches: Number(agg?.totalWeb || 0),
    totalRequests: Number(agg?.totalReqs || 0),
  };
}

export async function checkAiBudgetAllowed(params: {
  endpoint: AiEndpoint;
  clientKey?: string;
  policy: AiBudgetPolicy;
}): Promise<{
  allowed: boolean;
  reason?: string;
  summary: MonthlyAiUsageSummary;
}> {
  const summary = await getMonthlyAiUsageSummary(params.policy.monthlyBudgetUsd);

  if (!params.policy.enabled) {
    return {
      allowed: false,
      reason: "AI Assistant is disabled in Admin Settings.",
      summary,
    };
  }

  if (summary.totalCostUsd >= summary.budgetUsd) {
    return {
      allowed: false,
      reason: `Monthly AI budget cap ($${summary.totalCostUsd.toFixed(2)} / $${summary.budgetUsd.toFixed(2)}) reached.`,
      summary,
    };
  }

  // Reserve the last 10% of the monthly budget for Admin product lookups & Admin operations
  if (
    params.endpoint === "customer_chat" &&
    summary.totalCostUsd >= summary.budgetUsd * 0.9
  ) {
    return {
      allowed: false,
      reason: "Monthly public AI allocation reserved; using free database lookup.",
      summary,
    };
  }

  if (params.endpoint === "customer_chat" && params.clientKey) {
    const dayKey = getDayKey();
    const [daily] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aiUsageLogs)
      .where(
        and(
          eq(aiUsageLogs.dayKey, dayKey),
          eq(aiUsageLogs.endpoint, "customer_chat"),
          eq(aiUsageLogs.clientKey, params.clientKey.slice(0, 64))
        )
      );
    if (Number(daily?.count || 0) >= params.policy.customerDailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit of ${params.policy.customerDailyLimit} AI replies reached for this session; using free database lookup.`,
        summary,
      };
    }
  }

  return { allowed: true, summary };
}

export async function recordAiUsage(params: {
  endpoint: AiEndpoint;
  model: string;
  clientKey?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  webSearches?: number;
}) {
  const estimatedCostUsd = estimateAiCostUsd(params);
  try {
    await db.insert(aiUsageLogs).values({
      monthKey: getMonthKey(),
      dayKey: getDayKey(),
      endpoint: params.endpoint,
      model: params.model,
      clientKey: (params.clientKey || "anon").slice(0, 64),
      inputTokens: Math.max(0, Math.round(params.inputTokens || 0)),
      outputTokens: Math.max(0, Math.round(params.outputTokens || 0)),
      cacheReadTokens: Math.max(0, Math.round(params.cacheReadTokens || 0)),
      cacheWriteTokens: Math.max(0, Math.round(params.cacheWriteTokens || 0)),
      webSearches: Math.max(0, Math.round(params.webSearches || 0)),
      estimatedCostUsd,
    });
  } catch (err) {
    console.warn("[ai-budget] failed to persist usage log:", err);
  }
}

export function trimChatMessages<T extends { role: string; content: string }>(
  messages: T[],
  maxMessages: number,
  maxCharsPerMessage: number
): T[] {
  const sliced = messages.slice(-Math.max(1, maxMessages));
  return sliced.map((m) => ({
    ...m,
    content:
      m.content.length > maxCharsPerMessage
        ? `${m.content.slice(0, maxCharsPerMessage)}…`
        : m.content,
  }));
}

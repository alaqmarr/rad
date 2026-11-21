import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  discoverCloudflareR2WithToken,
  getEnvR2Candidate,
  getR2Config,
  getR2RealtimeStatus,
  parseR2QuickPaste,
  saveR2SettingsToDb,
  verifyAndAutoCreateBucket,
  type R2Config,
} from "@/lib/r2";
import { revalidateCmsCache } from "@/lib/settings";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      mode?: "one_click_env" | "one_click_verify" | "smart_paste" | "cloudflare_token" | "manual";
      rawPaste?: string;
      cloudflareToken?: string;
      accountId?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      bucketName?: string;
      publicUrl?: string;
      createBucketIfMissing?: boolean;
    };

    const mode = body.mode || "one_click_verify";
    const existing = await getR2Config();
    const createIfMissing = body.createBucketIfMissing !== false;

    if (mode === "cloudflare_token") {
      const token = (body.cloudflareToken || "").trim();
      const disc = await discoverCloudflareR2WithToken({
        apiToken: token,
        preferredBucketName: body.bucketName?.trim() || existing.bucketName || "radiant-industrial-media",
      });

      await saveR2SettingsToDb({
        r2_account_id: disc.accountId,
        r2_bucket_name: disc.bucketName,
        r2_public_url: disc.publicUrl || existing.publicUrl || undefined,
        ...(body.accessKeyId?.trim() ? { r2_access_key_id: body.accessKeyId.trim() } : {}),
        ...(body.secretAccessKey?.trim() ? { r2_secret_access_key: body.secretAccessKey.trim() } : {}),
      });
      revalidateCmsCache();

      const updatedCfg = await getR2Config();
      if (!updatedCfg.isConfigured) {
        const status = await getR2RealtimeStatus();
        return NextResponse.json({
          ok: true,
          needsS3Keys: true,
          discovered: disc,
          message: `Discovered Cloudflare Account "${disc.accountName}" & bucket "${disc.bucketName}"${
            disc.bucketCreated ? " (created)" : ""
          }${disc.publicUrl ? ` with public CDN ${disc.publicUrl}` : ""}. Enter R2 Access Key ID + Secret Access Key to finish S3 binding.`,
          status,
        });
      }

      const probe = await verifyAndAutoCreateBucket(updatedCfg, { createIfMissing, runWriteProbe: true });
      const status = await getR2RealtimeStatus({ runWriteProbe: false });
      return NextResponse.json({ ok: probe.connected, probe, discovered: disc, status });
    }

    let nextCfg: R2Config = { ...existing };

    if (mode === "one_click_env") {
      const env = getEnvR2Candidate();
      if (!env.available) {
        return NextResponse.json(
          { error: "Server .env does not have complete R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY variables." },
          { status: 400 }
        );
      }
      nextCfg = {
        accountId: env.accountId,
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
        bucketName: env.bucketName,
        publicUrl: env.publicUrl,
        isConfigured: true,
      };
    } else if (mode === "smart_paste") {
      const parsed = parseR2QuickPaste(body.rawPaste || "");
      const accountId = (parsed.accountId || body.accountId || existing.accountId || "").trim();
      const accessKeyId = (parsed.accessKeyId || body.accessKeyId || existing.accessKeyId || "").trim();
      const secretAccessKey = (parsed.secretAccessKey || body.secretAccessKey || existing.secretAccessKey || "").trim();
      const bucketName = (parsed.bucketName || body.bucketName || existing.bucketName || "radiant-industrial-media").trim();
      const publicUrl = (parsed.publicUrl ?? body.publicUrl ?? existing.publicUrl ?? "").trim().replace(/\/+$/, "");
      nextCfg = {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl,
        isConfigured: Boolean(accountId && accessKeyId && secretAccessKey && bucketName),
      };
    } else if (mode === "manual") {
      const accountId = (body.accountId ?? existing.accountId).trim();
      const accessKeyId = (body.accessKeyId?.trim() ? body.accessKeyId : existing.accessKeyId).trim();
      const secretAccessKey = (body.secretAccessKey?.trim() ? body.secretAccessKey : existing.secretAccessKey).trim();
      const bucketName = (body.bucketName ?? existing.bucketName ?? "radiant-industrial-media").trim();
      const publicUrl = (body.publicUrl ?? existing.publicUrl).trim().replace(/\/+$/, "");
      nextCfg = {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl,
        isConfigured: Boolean(accountId && accessKeyId && secretAccessKey && bucketName),
      };
    }

    if (!nextCfg.isConfigured) {
      return NextResponse.json(
        {
          error:
            "Missing required R2 fields: Account ID, Access Key ID, Secret Access Key, and Bucket Name.",
        },
        { status: 400 }
      );
    }

    const probe = await verifyAndAutoCreateBucket(nextCfg, {
      createIfMissing,
      runWriteProbe: true,
    });

    if (!probe.connected) {
      return NextResponse.json(
        { error: probe.error || "Unable to connect to Cloudflare R2 bucket.", probe },
        { status: 400 }
      );
    }

    await saveR2SettingsToDb({
      r2_account_id: nextCfg.accountId,
      r2_access_key_id: nextCfg.accessKeyId,
      r2_secret_access_key: nextCfg.secretAccessKey,
      r2_bucket_name: nextCfg.bucketName,
      r2_public_url: nextCfg.publicUrl,
    });
    revalidateCmsCache();

    const status = await getR2RealtimeStatus();
    return NextResponse.json({
      ok: true,
      probe,
      status: {
        ...status,
        writable: probe.writable,
        bucketCreated: probe.bucketCreated,
        probeLatencyMs: probe.probeLatencyMs,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to connect Cloudflare R2" },
      { status: 500 }
    );
  }
}

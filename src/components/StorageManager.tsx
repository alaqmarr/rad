"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  HardDrive,
  Database,
  Globe,
  Loader2,
  Play,
  Square,
  ShieldCheck,
  KeyRound,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { sileo } from "sileo";
import type { R2RealtimeStatus } from "@/lib/r2";
import type { StorageAuditSummary } from "@/lib/storage-audit";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val >= 100 || idx === 0 ? val.toFixed(0) : val.toFixed(2)} ${units[idx]}`;
}

function formatNum(n: number): string {
  return Number(n || 0).toLocaleString("en-IN");
}

export function StorageManager({
  initialStatus,
  initialAudit,
  savedBucketName,
  savedPublicUrl,
}: {
  initialStatus: R2RealtimeStatus;
  initialAudit: StorageAuditSummary;
  savedBucketName: string;
  savedPublicUrl: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<R2RealtimeStatus>(initialStatus);
  const [audit, setAudit] = useState<StorageAuditSummary>(initialAudit);

  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [estimating, setEstimating] = useState(false);

  // Connect inputs
  const [connectTab, setConnectTab] = useState<"smart" | "token" | "manual">("smart");
  const [rawPaste, setRawPaste] = useState("");
  const [cfToken, setCfToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucketName, setBucketName] = useState(savedBucketName || "radiant-industrial-media");
  const [publicUrl, setPublicUrl] = useState(savedPublicUrl || "");

  // Migration batch state
  const [migrating, setMigrating] = useState(false);
  const autoMigrateRef = useRef(false);
  const [autoMigrating, setAutoMigrating] = useState(false);
  const [migrationSessionStats, setMigrationSessionStats] = useState({
    migrated: 0,
    failed: 0,
    bytesUploaded: 0,
    lastErrors: [] as string[],
  });

  const refreshStatus = async (runProbe = false, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/storage/status${runProbe ? "?probe=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setStatus(data.status);
      setAudit(data.audit);
      if (runProbe) {
        if (data.status.connected && data.status.writable) {
          sileo.success({
            title: "Cloudflare R2 Verified",
            description: `Bucket "${data.status.bucketName}" read/write probe succeeded in ${data.status.probeLatencyMs ?? data.status.latencyMs} ms.`,
          });
        } else {
          sileo.error({
            title: "R2 Probe Issue",
            description: data.status.error || "Check bucket permissions",
          });
        }
      }
    } catch (err) {
      if (!silent) {
        sileo.error({
          title: "Refresh Failed",
          description: err instanceof Error ? err.message : "Could not check storage status",
        });
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!autoPoll) return;
    const timer = setInterval(() => {
      if (!autoMigrateRef.current) {
        void refreshStatus(false, true);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [autoPoll]);

  const handleConnect = async (
    mode: "one_click_env" | "one_click_verify" | "smart_paste" | "cloudflare_token" | "manual"
  ) => {
    setConnecting(true);
    try {
      const res = await fetch("/api/admin/storage/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          rawPaste,
          cloudflareToken: cfToken,
          accountId,
          accessKeyId,
          secretAccessKey,
          bucketName,
          publicUrl,
          createBucketIfMissing: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "R2 connection failed");
      }
      if (data.status) setStatus(data.status);

      if (data.needsS3Keys && data.discovered) {
        setAccountId(data.discovered.accountId || "");
        setBucketName(data.discovered.bucketName || "radiant-industrial-media");
        if (data.discovered.publicUrl) setPublicUrl(data.discovered.publicUrl);
        setConnectTab("manual");
        sileo.success({
          title: "Account & Bucket Provisioned",
          description: data.message,
        });
      } else {
        setRawPaste("");
        router.refresh();
        sileo.success({
          title: "Cloudflare R2 Connected",
          description: data.probe?.bucketCreated
            ? `Created & verified bucket "${data.status?.bucketName}" (${data.probe?.probeLatencyMs} ms).`
            : `Live bucket "${data.status?.bucketName}" verified (${data.probe?.probeLatencyMs ?? data.status?.latencyMs} ms).`,
        });
      }
    } catch (err) {
      sileo.error({
        title: "Connection Failed",
        description: err instanceof Error ? err.message : "Could not connect to R2",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleRunEstimate = async () => {
    setEstimating(true);
    try {
      const res = await fetch("/api/admin/storage/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samplePerHost: 6 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setAudit(data.audit);
      sileo.success({
        title: "Live Image Storage Audit Complete",
        description: `Projected migration size: ${formatBytes(data.estimate.estimatedDeduplicatedBytes)} (${formatBytes(data.estimate.estimatedWithBufferBytes)} w/ buffer).`,
      });
    } catch (err) {
      sileo.error({
        title: "Estimate Scan Failed",
        description: err instanceof Error ? err.message : "Could not sample external image sizes",
      });
    } finally {
      setEstimating(false);
    }
  };

  const runSingleMigrationBatch = async (batchSize = 20): Promise<number> => {
    const res = await fetch("/api/admin/storage/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Migration batch failed");
    }
    if (data.status) setStatus(data.status);
    if (data.audit) setAudit(data.audit);
    setMigrationSessionStats((prev) => ({
      migrated: prev.migrated + Number(data.result.migrated || 0),
      failed: prev.failed + Number(data.result.failed || 0),
      bytesUploaded: prev.bytesUploaded + Number(data.result.bytesUploaded || 0),
      lastErrors: data.result.errors?.length ? data.result.errors : prev.lastErrors,
    }));
    return Number(data.result.remainingUnique || 0);
  };

  const handleSingleBatch = async () => {
    setMigrating(true);
    try {
      const remaining = await runSingleMigrationBatch(20);
      sileo.success({
        title: "Migration Batch Uploaded to R2",
        description: `${formatNum(remaining)} unique external images remaining.`,
      });
    } catch (err) {
      sileo.error({
        title: "Migration Error",
        description: err instanceof Error ? err.message : "Batch failed",
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleToggleAutoMigrate = async () => {
    if (autoMigrating) {
      autoMigrateRef.current = false;
      setAutoMigrating(false);
      return;
    }
    autoMigrateRef.current = true;
    setAutoMigrating(true);
    try {
      while (autoMigrateRef.current) {
        const remaining = await runSingleMigrationBatch(20);
        if (remaining <= 0) {
          sileo.success({
            title: "All External Images Migrated",
            description: "100% of reachable external images are now stored on Cloudflare R2.",
          });
          break;
        }
      }
    } catch (err) {
      sileo.error({
        title: "Auto-Migration Paused",
        description: err instanceof Error ? err.message : "Migration stopped",
      });
    } finally {
      autoMigrateRef.current = false;
      setAutoMigrating(false);
    }
  };

  const est = audit.estimate;
  const r2FreeGb = 10;
  const estBufferGb = est ? est.estimatedWithBufferBytes / (1024 * 1024 * 1024) : 0;

  return (
    <div className="space-y-6">
      {/* Live Status Banner */}
      <div className="rounded-md border border-[#E4E4E0] bg-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-md flex items-center justify-center ${
              status.connected
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : status.configured
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}
          >
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#141A21]">
                Cloudflare R2 Realtime Status
              </h2>
              {status.connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  CONNECTED {status.writable === true ? "• R/W VERIFIED" : ""}
                </span>
              ) : status.configured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                  <AlertTriangle className="w-3 h-3" />
                  CONNECTION ERROR
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                  NOT CONNECTED (USING LOCAL FALLBACK)
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1 font-mono">
              Bucket: <span className="text-[#141A21] font-semibold">{status.bucketName}</span>
              {status.latencyMs !== null && ` • S3 Ping: ${status.latencyMs} ms`}
              {status.effectivePublicUrl && ` • CDN: ${status.effectivePublicUrl}`}
            </p>
            {status.error && (
              <p className="text-xs text-red-600 mt-1">{status.error}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPoll}
              onChange={(e) => setAutoPoll(e.target.checked)}
              className="accent-[#EA6A12]"
            />
            Live Poll (10s)
          </label>
          <button
            type="button"
            onClick={() => refreshStatus(false, false)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-[#141A21] hover:border-[#141A21] cursor-pointer disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => refreshStatus(true, false)}
            disabled={refreshing || !status.configured}
            className="inline-flex items-center gap-1.5 rounded bg-[#141A21] px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Test R/W Probe
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-stone-500">
            <span>R2 Bucket Used</span>
            <HardDrive className="w-4 h-4 text-[#EA6A12]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#141A21]">
            {status.bucketStats ? formatBytes(status.bucketStats.totalBytes) : status.connected ? "0 B" : "Not Connected"}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {status.bucketStats
              ? `${formatNum(status.bucketStats.objectCount)}${status.bucketStats.truncated ? "+" : ""} objects stored in R2`
              : "Connect R2 to inspect live objects"}
          </div>
        </div>

        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-stone-500">
            <span>Est. Storage For Migration</span>
            <Sparkles className="w-4 h-4 text-[#EA6A12]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#141A21]">
            {est ? formatBytes(est.estimatedDeduplicatedBytes) : "Scan Required"}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {est
              ? `${formatBytes(est.estimatedWithBufferBytes)} w/ 15% buffer • ${est.freeTierPercent}% of 10 GB Free Tier`
              : `${formatNum(audit.counts.uniqueExternalImageUrls)} unique external URLs queued`}
          </div>
        </div>

        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-stone-500">
            <span>External DB Images</span>
            <Globe className="w-4 h-4 text-[#EA6A12]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#141A21]">
            {formatNum(audit.counts.uniqueExternalImageUrls)}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            Unique URLs across {formatNum(audit.counts.totalExternalImageRefs)} DB references
          </div>
        </div>

        <div className="rounded-md border border-[#E4E4E0] bg-white p-4">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-stone-500">
            <span>Local Server Disk</span>
            <Database className="w-4 h-4 text-[#EA6A12]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#141A21]">
            {formatBytes(
              status.localDisk.sqliteDbBytes +
                status.localDisk.uploadsBytes +
                status.localDisk.logosBytes
            )}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            SQLite: {formatBytes(status.localDisk.sqliteDbBytes)} • Logos ({status.localDisk.logosFiles}):{" "}
            {formatBytes(status.localDisk.logosBytes)}
          </div>
        </div>
      </div>

      {/* One-Click Cloudflare R2 Connect */}
      <div className="rounded-md border border-[#E4E4E0] bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#141A21] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#EA6A12]" />
              One-Click Cloudflare R2 Connect
            </h2>
            <p className="text-xs text-stone-600 mt-1">
              Connect in one click by importing server `.env`, verifying saved credentials, pasting any Cloudflare R2 `.env` / JSON / S3 endpoint snippet, or provisioning via Cloudflare API Token.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {status.envCandidate.available && (
              <button
                type="button"
                onClick={() => handleConnect("one_click_env")}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-4 py-2 text-xs font-bold text-white hover:bg-[#C95609] cursor-pointer disabled:opacity-60"
              >
                {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                1-Click Connect from Server .env ({status.envCandidate.bucketName})
              </button>
            )}
            {status.configured && (
              <button
                type="button"
                onClick={() => handleConnect("one_click_verify")}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
              >
                {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                1-Click Verify &amp; Auto-Create Bucket
              </button>
            )}
          </div>
        </div>

        {/* Sub-mode tabs */}
        <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
          {[
            { id: "smart", label: "Smart Paste (.env / JSON / S3)" },
            { id: "token", label: "Cloudflare API Token Discover" },
            { id: "manual", label: "Manual Keys & Bucket" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setConnectTab(t.id as "smart" | "token" | "manual")}
              className={`rounded px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                connectTab === t.id
                  ? "bg-[#141A21] text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {connectTab === "smart" && (
          <div className="space-y-3">
            <textarea
              rows={4}
              value={rawPaste}
              onChange={(e) => setRawPaste(e.target.value)}
              placeholder={`Paste your Cloudflare R2 details in any format (auto-detected) and click Connect:\nR2_ACCOUNT_ID=...\nR2_ACCESS_KEY_ID=...\nR2_SECRET_ACCESS_KEY=...\nR2_BUCKET_NAME=radiant-industrial-media\nR2_PUBLIC_URL=https://pub-xxxx.r2.dev`}
              className="w-full rounded border border-stone-300 bg-stone-50 p-3 font-mono text-xs outline-none focus:border-[#EA6A12]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-stone-500">
                Supports `.env` blocks, Cloudflare S3 endpoint URLs (`https://&lt;id&gt;.r2.cloudflarestorage.com`), or JSON objects. Auto-creates bucket if missing &amp; verifies live read/write.
              </span>
              <button
                type="button"
                onClick={() => handleConnect("smart_paste")}
                disabled={connecting || !rawPaste.trim()}
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#C95609] cursor-pointer disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                1-Click Parse, Save &amp; Connect R2
              </button>
            </div>
          </div>
        )}

        {connectTab === "token" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cloudflare API Token (Account Settings:Read + R2:Edit)
                </label>
                <input
                  type="password"
                  value={cfToken}
                  onChange={(e) => setCfToken(e.target.value)}
                  placeholder="Paste Cloudflare API Token to auto-discover Account ID, create bucket & enable r2.dev..."
                  className="w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#EA6A12]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Target Bucket Name
                </label>
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="radiant-industrial-media"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#EA6A12]"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-stone-500">
                Calls Cloudflare API v4 to detect your Account ID, create the bucket if needed, and enable managed `r2.dev` public delivery.
              </span>
              <button
                type="button"
                onClick={() => handleConnect("cloudflare_token")}
                disabled={connecting || !cfToken.trim()}
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#C95609] cursor-pointer disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Discover Account &amp; Provision Bucket
              </button>
            </div>
          </div>
        )}

        {connectTab === "manual" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Cloudflare Account ID
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder={status.accountIdMasked || "32-character Cloudflare Account ID"}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#EA6A12]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  R2 Access Key ID
                </label>
                <input
                  type="password"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder={status.accessKeyMasked || "R2 S3 Access Key ID"}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#EA6A12]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  R2 Secret Access Key
                </label>
                <input
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder={status.configured ? "Leave blank to keep saved key" : "R2 S3 Secret Access Key"}
                  className="w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#EA6A12]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  R2 Bucket Name
                </label>
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="radiant-industrial-media"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#EA6A12]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Public CDN URL (r2.dev or custom domain)
                </label>
                <input
                  type="text"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="https://pub-xxxxxxxxxxxx.r2.dev"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-xs font-mono outline-none focus:border-[#EA6A12]"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleConnect("manual")}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#C95609] cursor-pointer disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Save Credentials &amp; Connect Bucket
              </button>
            </div>
          </div>
        )}
      </div>

      {/* External Image Migration Storage Calculator */}
      <div className="rounded-md border border-[#E4E4E0] bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#141A21]">
              External Image Migration Storage Calculator
            </h2>
            <p className="text-xs text-stone-600 mt-1">
              Measures real file sizes across all external image hosts in SQLite ({formatNum(audit.counts.totalProducts)} products) to calculate exact R2 capacity needed after URL deduplication.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunEstimate}
              disabled={estimating}
              className="inline-flex items-center gap-2 rounded bg-[#141A21] px-4 py-2 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer disabled:opacity-60"
            >
              {estimating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {est ? "Re-Measure Live Image Sizes" : "Measure Live Image Sizes"}
            </button>
            <button
              type="button"
              onClick={handleSingleBatch}
              disabled={!status.connected || migrating || autoMigrating || audit.counts.uniqueExternalImageUrls === 0}
              className="inline-flex items-center gap-2 rounded border border-stone-300 bg-white px-3.5 py-2 text-xs font-bold text-[#141A21] hover:border-[#EA6A12] cursor-pointer disabled:opacity-50"
            >
              {migrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Migrate Batch (20)
            </button>
            <button
              type="button"
              onClick={handleToggleAutoMigrate}
              disabled={!status.connected || migrating || (audit.counts.uniqueExternalImageUrls === 0 && !autoMigrating)}
              className={`inline-flex items-center gap-2 rounded px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                autoMigrating ? "bg-red-600 hover:bg-red-700" : "bg-[#EA6A12] hover:bg-[#C95609]"
              }`}
            >
              {autoMigrating ? <Square className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
              {autoMigrating ? "Stop Migration" : "Auto-Migrate to R2"}
            </button>
          </div>
        </div>

        {/* R2 Capacity & Free Tier Meter */}
        {est && (
          <div className="rounded-md bg-[#F7F6F2] border border-[#E4E4E0] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#141A21]">
                Cloudflare R2 Free Tier Capacity Check (10 GB / month Free • Zero Egress Fees)
              </div>
              <div className="text-xs font-mono text-stone-700">
                <span className="font-bold text-[#EA6A12]">{formatBytes(est.estimatedWithBufferBytes)}</span> / {r2FreeGb} GB ({est.freeTierPercent}%)
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-stone-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  est.freeTierPercent <= 80 ? "bg-emerald-500" : est.freeTierPercent <= 100 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(2, est.freeTierPercent))}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
              <div>
                <span className="text-stone-500 block">Deduplicated Upload Size</span>
                <span className="font-bold text-[#141A21]">{formatBytes(est.estimatedDeduplicatedBytes)}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Without Deduplication</span>
                <span className="font-bold text-[#141A21]">{formatBytes(est.estimatedWithoutDedupBytes)}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Recommended (+15% Buffer)</span>
                <span className="font-bold text-[#141A21]">{estBufferGb.toFixed(2)} GB</span>
              </div>
              <div>
                <span className="text-stone-500 block">Projected Monthly R2 Cost</span>
                <span className="font-bold text-emerald-700">
                  {est.estimatedMonthlyUsd === 0 ? "$0.00 / mo (Fits Free Tier)" : `$${est.estimatedMonthlyUsd}/mo`}
                </span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-stone-500">
              Last scanned: {new Date(est.scannedAt).toLocaleString()} • Sampled {est.reachableSamples}/{est.measuredSamples} live images across {est.hosts.length} external domains
            </div>
          </div>
        )}

        {(migrationSessionStats.migrated > 0 || migrationSessionStats.failed > 0) && (
          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
            <span>
              Migration Session: <strong>{formatNum(migrationSessionStats.migrated)}</strong> unique images uploaded (
              {formatBytes(migrationSessionStats.bytesUploaded)}) • Failed:{" "}
              <strong>{migrationSessionStats.failed}</strong>
            </span>
            <span className="font-mono">
              Remaining external URLs: {formatNum(audit.counts.uniqueExternalImageUrls)}
            </span>
          </div>
        )}

        {/* Per-domain storage breakdown table */}
        <div className="overflow-x-auto rounded border border-[#E4E4E0]">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-[#E4E4E0] font-mono uppercase text-stone-500">
              <tr>
                <th className="py-2.5 px-4">External Domain</th>
                <th className="py-2.5 px-3 text-right">Unique Images</th>
                <th className="py-2.5 px-3 text-right">DB References</th>
                <th className="py-2.5 px-3 text-right">Avg Size</th>
                <th className="py-2.5 px-3 text-right">Reachable Sample</th>
                <th className="py-2.5 px-4 text-right">Est. Storage Needed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {audit.hosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-stone-500">
                    All database images are already migrated or hosted locally.
                  </td>
                </tr>
              ) : (
                audit.hosts.map((h) => (
                  <tr key={h.host} className="hover:bg-stone-50/70">
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#141A21]">{h.host}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatNum(h.uniqueUrls)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-stone-600">{formatNum(h.totalRefs)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {h.avgBytes !== undefined ? formatBytes(h.avgBytes) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                      {h.sampledCount ? `${h.reachableCount ?? 0}/${h.sampledCount}` : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#141A21]">
                      {h.estimatedTotalBytes !== undefined ? formatBytes(h.estimatedTotalBytes) : "Click Measure"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Bucket Contents & Folder Prefix Breakdown */}
      {status.connected && status.bucketStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-md border border-[#E4E4E0] bg-white p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#141A21] flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#EA6A12]" />
              R2 Prefixes Breakdown
            </h3>
            {Object.keys(status.bucketStats.prefixes).length === 0 ? (
              <p className="text-xs text-stone-500">Bucket is currently empty.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(status.bucketStats.prefixes)
                  .sort((a, b) => b[1].bytes - a[1].bytes)
                  .map(([prefix, info]) => (
                    <div key={prefix} className="flex items-center justify-between text-xs border-b border-stone-100 pb-1.5">
                      <span className="font-mono text-[#141A21]">{prefix}</span>
                      <span className="font-mono text-stone-600">
                        {formatNum(info.count)} files • <strong className="text-[#141A21]">{formatBytes(info.bytes)}</strong>
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-md border border-[#E4E4E0] bg-white p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#141A21]">Recent Objects in R2 Bucket</h3>
            {status.bucketStats.recentObjects.length === 0 ? (
              <p className="text-xs text-stone-500">No uploaded objects found yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-stone-200 font-mono text-stone-500 uppercase">
                    <tr>
                      <th className="py-2 pr-3">Object Key</th>
                      <th className="py-2 px-3 text-right">Size</th>
                      <th className="py-2 pl-3 text-right">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {status.bucketStats.recentObjects.map((o) => (
                      <tr key={o.key}>
                        <td className="py-2 pr-3 font-mono text-[#141A21] truncate max-w-xs">{o.key}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatBytes(o.size)}</td>
                        <td className="py-2 pl-3 text-right text-stone-500">
                          {o.lastModified ? new Date(o.lastModified).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

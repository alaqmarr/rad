import React from "react";
import { getR2Config, getR2RealtimeStatus } from "@/lib/r2";
import { getStorageAuditSummary } from "@/lib/storage-audit";
import { StorageManager } from "@/components/StorageManager";

export const dynamic = "force-dynamic";

export default async function AdminStoragePage() {
  const [status, audit, cfg] = await Promise.all([
    getR2RealtimeStatus({ runWriteProbe: false }),
    getStorageAuditSummary(),
    getR2Config(),
  ]);

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-extrabold text-[#141A21] tracking-tight">
          Cloudflare R2 Storage &amp; Media Migration
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          One-click Cloudflare R2 connection, live bucket storage telemetry, external image storage estimator, and direct external-to-R2 migration.
        </p>
      </div>

      <StorageManager
        initialStatus={status}
        initialAudit={audit}
        savedBucketName={cfg.bucketName}
        savedPublicUrl={cfg.publicUrl}
      />
    </div>
  );
}

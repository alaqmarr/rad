"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, Loader2, CheckCircle2, X } from "lucide-react";
import { sileo } from "sileo";

export interface UploadedFileMeta {
  url: string;
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storage: "r2" | "local";
}

interface DropzoneUploaderProps {
  folder?: string;
  scope?: "admin" | "rfq";
  accept?: Record<string, string[]>;
  label?: string;
  helperText?: string;
  currentUrl?: string | null;
  onUploaded: (meta: UploadedFileMeta) => void;
  onClear?: () => void;
}

export function DropzoneUploader({
  folder = "media",
  scope = "admin",
  accept,
  label = "Upload File to Cloudflare R2",
  helperText = "Drag & drop or click to select (Max 15 MB)",
  currentUrl,
  onUploaded,
  onClear,
}: DropzoneUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const res = await fetch(`/api/upload?scope=${scope}`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }

        onUploaded({
          url: data.url,
          key: data.key,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          storage: data.storage,
        });
        sileo.success({
          title: "File Uploaded",
          description: `${data.fileName} (${data.storage === "r2" ? "Cloudflare R2" : "Local Storage"})`,
        });
      } catch (err) {
        sileo.error({
          title: "Upload Failed",
          description: err instanceof Error ? err.message : "Could not upload file",
        });
      } finally {
        setUploading(false);
      }
    },
    [folder, scope, onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept,
  });

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`border border-dashed rounded-md p-4 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
          isDragActive
            ? "border-[#EA6A12] bg-orange-50/60"
            : "border-stone-300 bg-stone-50/60 hover:border-stone-400"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded border border-stone-200 bg-white flex items-center justify-center shrink-0 text-stone-600">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-[#EA6A12]" /> : <UploadCloud className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#141A21] truncate">
              {uploading ? "Uploading file..." : label}
            </p>
            <p className="text-xs text-stone-500 truncate">{helperText}</p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded border border-stone-200 bg-white text-stone-700 shrink-0">
          Browse
        </span>
      </div>

      {currentUrl && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-stone-200 bg-white text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-stone-700 hover:text-[#EA6A12] underline"
            >
              {currentUrl}
            </a>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-stone-400 hover:text-red-600 p-0.5 cursor-pointer"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React from "react";
import { Trash2, Loader2, CheckSquare, Square } from "lucide-react";

/**
 * Shared selection & bulk-delete bar for admin lists and grids.
 */
export function BulkSelectionBar({
  totalCount,
  selectedCount,
  entityLabel,
  allSelected,
  deleting,
  onToggleAll,
  onClear,
  onBulkDelete,
}: {
  totalCount: number;
  selectedCount: number;
  entityLabel: string;
  allSelected: boolean;
  deleting: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onBulkDelete: () => void;
}) {
  if (totalCount === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-2.5 text-xs transition-colors ${
        selectedCount > 0
          ? "border-red-200 bg-red-50/70"
          : "border-[#E4E4E0] bg-stone-50/70"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleAll}
          className="inline-flex items-center gap-1.5 font-semibold text-[#141A21] hover:text-[#EA6A12] cursor-pointer"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-[#EA6A12]" />
          ) : (
            <Square className="w-4 h-4 text-stone-400" />
          )}
          {allSelected ? `Deselect All (${totalCount})` : `Select All (${totalCount})`}
        </button>

        {selectedCount > 0 && (
          <span className="font-mono font-bold text-red-800">
            {selectedCount} {entityLabel} selected
          </span>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onClear}
            className="rounded border border-stone-300 bg-white px-2.5 py-1.5 font-medium text-stone-700 hover:border-stone-500 cursor-pointer disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onBulkDelete}
            className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 cursor-pointer disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Bulk Delete Selected ({selectedCount})
          </button>
        </div>
      )}
    </div>
  );
}

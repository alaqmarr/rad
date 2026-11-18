"use client";

import { useState, useCallback } from "react";

/**
 * Reusable multi-row checkbox selection state helper for admin bulk actions.
 */
export function useBulkSelection(visibleIds: number[]) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const selectedSet = new Set(selectedIds);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggleOne = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const current = new Set(prev);
      const everyVisible =
        visibleIds.length > 0 && visibleIds.every((id) => current.has(id));
      if (everyVisible) {
        const visibleSet = new Set(visibleIds);
        return prev.filter((id) => !visibleSet.has(id));
      }
      visibleIds.forEach((id) => current.add(id));
      return Array.from(current);
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  return {
    selectedIds,
    selectedSet,
    allVisibleSelected,
    bulkDeleting,
    setBulkDeleting,
    toggleOne,
    toggleAllVisible,
    clearSelection,
  };
}

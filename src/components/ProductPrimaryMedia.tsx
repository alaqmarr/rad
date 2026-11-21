"use client";

import React, { useState } from "react";
import { ProductFallbackVisual } from "./ProductFallbackVisual";

interface ProductPrimaryMediaProps {
  imageUrl: string | null;
  name: string;
  sku: string;
  brandName?: string | null;
  categoryName?: string | null;
}

/**
 * Renders the product primary image with strict no-referrer policy and
 * graceful fallback to ProductFallbackVisual if a remote image fails to load.
 */
export function ProductPrimaryMedia({
  imageUrl,
  name,
  sku,
  brandName,
  categoryName,
}: ProductPrimaryMediaProps) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain bg-white p-4"
      />
    );
  }

  return (
    <ProductFallbackVisual
      name={name}
      sku={sku}
      brandName={brandName}
      categoryName={categoryName}
      variant="detail"
    />
  );
}

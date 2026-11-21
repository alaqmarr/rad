"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === "undefined") return;
    const dl = (window as unknown as { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
    if (Array.isArray(dl)) {
      dl.push({
        event: "web_vitals",
        metric_id: metric.id,
        metric_name: metric.name,
        metric_value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
        metric_rating: metric.rating,
        metric_delta: Math.round(metric.name === "CLS" ? metric.delta * 1000 : metric.delta),
      });
    }
  });

  return null;
}

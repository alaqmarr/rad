"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Cog, Zap, Droplets, Package, Wrench, Shield, Flame, Gauge } from "lucide-react";

interface DivisionData {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  heroImageUrl: string | null;
}

interface CategoryData {
  id: number;
  slug: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  divisionId: number;
}

function getCatIcon(name: string) {
  const s = name.toLowerCase();
  if (s.includes("bearing") || s.includes("pneumatic")) return Cog;
  if (s.includes("weld")) return Flame;
  if (s.includes("safety")) return Shield;
  if (s.includes("electric")) return Zap;
  if (s.includes("precision") || s.includes("fitting")) return Gauge;
  if (s.includes("irrigation") || s.includes("tractor")) return Droplets;
  if (s.includes("tool")) return Wrench;
  return Package;
}

export function HomeDivisionExplorer({
  divisions,
  categories,
}: {
  divisions: DivisionData[];
  categories: CategoryData[];
}) {
  const [activeSlug, setActiveSlug] = useState(divisions[0]?.slug || "industrial");
  const activeDiv = divisions.find((d) => d.slug === activeSlug) || divisions[0];
  if (!activeDiv) return null;

  const activeCategories = categories.filter((c) => c.divisionId === activeDiv.id);

  return (
    <div className="space-y-6">
      {/* Compact, Well-Proportioned Tab Switcher */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap gap-1.5 rounded-md border border-stone-200 bg-white p-1.5">
          {divisions
            .filter((d) => d.slug !== "special-items")
            .map((div, index) => {
              const isActive = div.slug === activeDiv.slug;
              return (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => setActiveSlug(div.slug)}
                  className={`rounded px-4 py-2 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? "bg-[#141A21] text-white"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span className={`font-mono text-xs ${isActive ? "text-[#EA6A12]" : "text-stone-400"}`}>
                    0{index + 1}
                  </span>
                  <span>{div.name}</span>
                </button>
              );
            })}
        </div>

        {/* Dedicated Separate Scope Button for Special Items */}
        {divisions
          .filter((d) => d.slug === "special-items")
          .map((special) => {
            const isActive = special.slug === activeDiv.slug;
            return (
              <button
                key={special.id}
                type="button"
                onClick={() => setActiveSlug(special.slug)}
                className={`rounded-md border px-4 py-3 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? "bg-[#EA6A12] border-[#EA6A12] text-white"
                    : "bg-white border-[#EA6A12]/50 text-[#141A21] hover:border-[#EA6A12]"
                }`}
              >
                <span className={`font-mono text-xs ${isActive ? "text-white" : "text-[#EA6A12]"}`}>
                  SPECIAL
                </span>
                <span>{special.name}</span>
              </button>
            );
          })}
      </div>

      {/* Balanced Asymmetric Showcase: Left Hero Banner + Right Evenly Filled Category Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 rounded-md border border-stone-200 bg-[#0F141A] text-white overflow-hidden flex flex-col">
          <div className="aspect-[16/10] w-full overflow-hidden bg-stone-900 shrink-0">
            <img
              src={activeDiv.heroImageUrl || "/images/div-industrial.jpg"}
              alt={activeDiv.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-7 flex-1 flex flex-col justify-between gap-6">
            <div className="space-y-2.5">
              <h3 className="text-2xl font-bold tracking-tight">{activeDiv.name}</h3>
              <p className="text-sm text-stone-300 leading-relaxed">{activeDiv.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/divisions/${activeDiv.slug}`}
                className="inline-flex items-center gap-2 rounded bg-[#EA6A12] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C95609] transition-colors"
              >
                Open {activeDiv.name}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/products?division=${activeDiv.slug}`}
                className="inline-flex items-center gap-1.5 rounded border border-stone-700 px-4 py-2.5 text-sm font-medium text-stone-200 hover:border-white transition-colors"
              >
                All Items
              </Link>
            </div>
          </div>
        </div>

        {/* Categories Grid + View-All Action Card (No Orphan Slot!) */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeCategories.map((cat) => {
            const Icon = getCatIcon(cat.name);
            return (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="group rounded-md border border-stone-200 bg-white overflow-hidden hover:border-stone-400 transition-all flex flex-col justify-between"
              >
                {cat.thumbnailUrl && (
                  <div className="h-24 w-full overflow-hidden border-b border-stone-100 bg-stone-100">
                    <img
                      src={cat.thumbnailUrl}
                      alt={cat.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded border border-stone-200 bg-[#F7F7F4] flex items-center justify-center text-stone-700 group-hover:border-[#EA6A12] group-hover:text-[#EA6A12] shrink-0 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-[#141A21] group-hover:text-[#EA6A12] transition-colors">
                          {cat.name}
                        </h4>
                        <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#EA6A12] shrink-0" />
                      </div>
                      <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                        {cat.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {activeCategories.length % 2 === 1 && (
            <Link
              href={`/products?division=${activeDiv.slug}`}
              className="group rounded-md border border-dashed border-stone-300 bg-[#F9F9F7] p-5 flex flex-col justify-between hover:border-[#EA6A12] hover:bg-white transition-all"
            >
              <div>
                <div className="text-sm font-bold text-[#141A21] group-hover:text-[#EA6A12]">
                  Need a specific {activeDiv.name} item?
                </div>
                <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                  Browse every product in this area or send us your custom requirement list.
                </p>
              </div>
              <div className="mt-3 text-xs font-semibold text-[#EA6A12] inline-flex items-center gap-1">
                Browse {activeDiv.name} <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bot, X, Send, Loader2, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { useSiteRuntime } from "./Providers";
import { sileo } from "sileo";

interface MatchedProduct {
  name: string;
  sku: string;
  slug: string;
  brand: string | null;
  pricingMode: string;
  basePrice: number | null;
  priceUnit: string;
}

interface MessageItem {
  role: "user" | "assistant";
  content: string;
  products?: MatchedProduct[];
  leadReferenceNo?: string;
  whatsappUrl?: string;
}

export function AiProcurementDrawer() {
  const { showPublicPrices } = useSiteRuntime();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "lead">("chat");
  const [sessionId] = useState(() => `web-${Math.random().toString(36).slice(2, 10)}`);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      role: "assistant",
      content:
        "Hello. Ask me about products, SKUs, reference prices, sourced brands (SKF, NTN, Polycab, Godrej, ESAB, Udyogi, Dowty, Jain Irrigation, etc.), technical documents, or share your requirement so I can forward a lead to our desk.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Direct lead capture form inside AI widget
  const [leadName, setLeadName] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadLocation, setLeadLocation] = useState("");
  const [leadItems, setLeadItems] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState<{ ref: string; waUrl?: string } | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: MessageItem[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assistant error");

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: data.reply,
          products: data.matchedProducts,
          leadReferenceNo: data.leadReferenceNo,
          whatsappUrl: data.whatsappUrl,
        },
      ]);
    } catch (err) {
      sileo.error({
        title: "Assistant Unavailable",
        description: err instanceof Error ? err.message : "Could not reach procurement assistant",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customerName: leadName,
          companyName: leadCompany,
          phone: leadPhone,
          email: leadEmail,
          deliveryLocation: leadLocation,
          requestedItems: leadItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to forward lead");
      setLeadSubmitted({ ref: data.referenceNo, waUrl: data.whatsappUrl });
      sileo.success({
        title: "Lead Forwarded to Radiant",
        description: `Reference ${data.referenceNo} logged${data.emailForwarded ? " & emailed." : "."}`,
      });
    } catch (err) {
      sileo.error({
        title: "Could Not Forward Lead",
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-stone-700 bg-[#141A21]/95 backdrop-blur-sm px-4 py-2.5 text-xs font-semibold text-white shadow-xl hover:bg-[#EA6A12] hover:border-[#EA6A12] transition-colors cursor-pointer"
        aria-label="Open Assistant"
      >
        <Bot className="w-4 h-4 text-[#EA6A12]" />
        <span>Help &amp; Quotes</span>
      </button>

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] max-h-[85vh] w-[calc(100vw-2.5rem)] sm:w-[420px] flex-col rounded-lg border border-stone-300 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-[#141A21] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <Bot className="w-4 h-4 text-[#EA6A12]" />
              <div>
                <div className="text-sm font-semibold leading-tight">Radiant Quick Helper</div>
                <div className="text-[11px] text-stone-400">Find products, prices &amp; send enquiries</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-stone-400 hover:bg-stone-800 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 border-b border-stone-200 bg-stone-50 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={`py-2.5 border-b-2 transition-colors cursor-pointer ${
                tab === "chat"
                  ? "border-[#EA6A12] text-[#141A21] bg-white"
                  : "border-transparent text-stone-500 hover:text-[#141A21]"
              }`}
            >
              Product &amp; Brand Help
            </button>
            <button
              type="button"
              onClick={() => setTab("lead")}
              className={`py-2.5 border-b-2 transition-colors cursor-pointer ${
                tab === "lead"
                  ? "border-[#EA6A12] text-[#141A21] bg-white"
                  : "border-transparent text-stone-500 hover:text-[#141A21]"
              }`}
            >
              Send Enquiry
            </button>
          </div>

          {tab === "chat" ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FBFBFA]">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#141A21] text-white"
                          : "bg-white border border-stone-200 text-[#141A21]"
                      }`}
                    >
                      {m.content}
                    </div>

                    {m.products && m.products.length > 0 && (
                      <div className="mt-2 w-full space-y-1.5">
                        {m.products.map((p) => (
                          <Link
                            key={p.sku}
                            href={`/products/${p.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between gap-2 rounded border border-stone-200 bg-white px-3 py-2 text-xs hover:border-[#EA6A12] transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-[#141A21] truncate">{p.name}</div>
                              <div className="font-mono text-[11px] text-stone-500">
                                {p.sku} {p.brand ? `• ${p.brand}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 font-mono text-[#EA6A12] font-semibold">
                              {showPublicPrices && p.pricingMode === "priced" && p.basePrice != null
                                ? `₹${p.basePrice.toLocaleString("en-IN")}`
                                : "Ask Price"}
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {m.leadReferenceNo && (
                      <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 space-y-1">
                        <div className="font-semibold">Enquiry Logged: {m.leadReferenceNo}</div>
                        {m.whatsappUrl && (
                          <a
                            href={m.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#16A34A] font-semibold underline"
                          >
                            <WhatsAppIcon className="w-3 h-3" /> Continue on WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#EA6A12]" />
                    Checking catalog & sourcing database...
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form onSubmit={sendMessage} className="border-t border-stone-200 bg-white p-3 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about bearings, cables, PPE, brands..."
                  className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-[#141A21] px-3.5 py-2 text-white hover:bg-[#EA6A12] transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 bg-[#FBFBFA]">
              {leadSubmitted ? (
                <div className="rounded border border-emerald-200 bg-white p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    Enquiry Forwarded ({leadSubmitted.ref})
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Your sourcing request has been saved and forwarded to our Secunderabad team.
                  </p>
                  <div className="flex gap-2 pt-2">
                    {leadSubmitted.waUrl && (
                      <a
                        href={leadSubmitted.waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded bg-[#16A34A] px-3 py-2 text-xs font-semibold text-white"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        Open in WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setLeadSubmitted(null)}
                      className="rounded border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 cursor-pointer"
                    >
                      New Enquiry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitLead} className="space-y-3">
                  <p className="text-xs text-stone-600">
                    Share your required products, brands, or part numbers — our desk will source and quote via email/WhatsApp.
                  </p>
                  <input
                    required
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Your Full Name *"
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                  />
                  <input
                    required
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="Phone / WhatsApp Number *"
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={leadCompany}
                      onChange={(e) => setLeadCompany(e.target.value)}
                      placeholder="Company Name"
                      className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                    />
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="Email Address"
                      className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                    />
                  </div>
                  <input
                    value={leadLocation}
                    onChange={(e) => setLeadLocation(e.target.value)}
                    placeholder="Delivery City / State"
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#EA6A12]"
                  />
                  <textarea
                    required
                    rows={4}
                    value={leadItems}
                    onChange={(e) => setLeadItems(e.target.value)}
                    placeholder="Required items, specs, brands & quantities *"
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#EA6A12] resize-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded bg-[#EA6A12] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C95609] cursor-pointer"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Forward Lead to Sales Desk
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

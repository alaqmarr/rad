"use client";

import React, { useState } from "react";
import { Bot, X, Send, Loader2 } from "lucide-react";
import { sileo } from "sileo";

interface Msg {
  role: "user" | "assistant";
  content: string;
  whatsappUrl?: string;
}

export function AdminAiDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Admin AI Copilot ready. I have full access to products (with internal prices), customer enquiries, brands, and settings — and I can update enquiry statuses, send customer emails, or dispatch WhatsApp messages.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Admin AI error");
      setMessages([
        ...next,
        { role: "assistant", content: data.reply, whatsappUrl: data.whatsappUrl },
      ]);
    } catch (err) {
      sileo.error({
        title: "Admin AI Failed",
        description: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#141A21] border border-stone-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xl hover:bg-[#EA6A12] hover:border-[#EA6A12] cursor-pointer"
      >
        <Bot className="w-4 h-4 text-[#EA6A12]" />
        Admin AI Copilot
      </button>

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[560px] max-h-[85vh] w-[calc(100vw-2rem)] sm:w-[440px] flex-col rounded-lg border border-stone-300 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between bg-[#141A21] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#EA6A12]" />
              <div>
                <div className="text-sm font-bold">Admin AI Operations Copilot</div>
                <div className="text-[11px] text-stone-400">Full DB, WhatsApp &amp; Email actions</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F9F9F7]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-md px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#141A21] text-white"
                      : "bg-white border border-stone-200 text-[#141A21]"
                  }`}
                >
                  {m.content}
                </div>
                {m.whatsappUrl && (
                  <a
                    href={m.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 text-xs font-semibold text-[#16A34A] underline"
                  >
                    Open Generated WhatsApp Message →
                  </a>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#EA6A12]" />
                Running database operation...
              </div>
            )}
          </div>

          <form onSubmit={send} className="border-t border-stone-200 p-3 bg-white flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Show new enquiries or email customer..."
              className="flex-1 rounded border border-stone-300 px-3 py-2 text-xs sm:text-sm outline-none focus:border-[#EA6A12]"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-[#141A21] px-3.5 py-2 text-white hover:bg-[#EA6A12] cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

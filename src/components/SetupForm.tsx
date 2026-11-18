"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { sileo } from "sileo";

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      sileo.error({ title: "Passwords Do Not Match" });
      return;
    }
    if (password.length < 8) {
      sileo.error({ title: "Password Too Short", description: "Use at least 8 characters." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed");

      sileo.success({
        title: "Admin Account Created",
        description: "Redirecting to admin login...",
      });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      sileo.error({
        title: "Setup Failed",
        description: err instanceof Error ? err.message : "Could not create admin",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Full Name *</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Administrator Name"
          className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Admin Email *</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@radiantindustrial.in"
          className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Password (min 8 chars) *</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Confirm Password *</label>
        <input
          required
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded bg-[#141A21] py-3 text-sm font-semibold text-white hover:bg-[#EA6A12] transition-colors cursor-pointer"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Create Initial Admin Account
      </button>
    </form>
  );
}

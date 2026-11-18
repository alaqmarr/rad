"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { sileo } from "sileo";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        sileo.error({
          title: "Authentication Failed",
          description: "Invalid email or password.",
        });
        return;
      }
      sileo.success({ title: "Signed In", description: "Welcome to the Radiant Admin Console." });
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Admin Email</label>
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
        <label className="block text-xs font-medium text-stone-600 mb-1">Password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#EA6A12]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded bg-[#141A21] py-3 text-sm font-semibold text-white hover:bg-[#EA6A12] transition-colors cursor-pointer"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        Sign In to Console
      </button>
    </form>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EditableSettingText } from "./InlineEdit";

interface FooterProps {
  settings: Record<string, string>;
}

export function Footer({ settings }: FooterProps) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname === "/setup") {
    return null;
  }

  const companyName = settings["company_name"] || "Radiant Industrial Co.";
  const address =
    settings["contact_address"] ||
    "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India";
  const phone = settings["contact_phone"] || "+91 8522095253";
  const email = settings["contact_email"] || "info@radiantindustrial.in";
  const hours = settings["operating_hours"] || "Mon – Sat, 9:00 AM – 6:00 PM IST";
  const creditText = settings["credit_text"] || "Designed and powered by RapidShift Labs";
  const creditUrl = settings["credit_url"] || "https://rapidshiftlabs.com";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0B0F14] text-stone-300 border-t border-stone-800">
      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Native Dark Brand Lockup (No pasted white rectangle) */}
          <div className="md:col-span-5 space-y-5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <img
                src="/logos/logo-short.png"
                alt={companyName}
                className="h-10 w-10 object-contain"
              />
              <div className="flex flex-col">
                <span className="font-display text-lg font-extrabold tracking-tight text-white leading-none">
                  RADIANT
                </span>
                <span className="text-[10px] font-semibold tracking-[0.18em] text-stone-400 uppercase leading-none mt-1">
                  INDUSTRIAL CO.
                </span>
              </div>
            </Link>

            <p className="text-sm text-stone-400 leading-relaxed max-w-md">
              <EditableSettingText
                settingKey="company_tagline"
                label="Company Tagline"
                value={settings["company_tagline"] || "Powering Progress, from Field to Factory."}
              />{" "}
              Your wholesale supply partner for factory machinery parts, tools, safety gear, electrical components, and farm equipment across India.
            </p>

            <div className="text-xs text-stone-400 space-y-1.5 pt-1">
              <div>
                <span className="text-stone-500 font-medium mr-2">Office:</span>
                <EditableSettingText settingKey="contact_address" label="HQ Address" value={address} />
              </div>
              <div>
                <span className="text-stone-500 font-medium mr-2">Phone:</span>
                <EditableSettingText settingKey="contact_phone" label="Phone" value={phone} />
              </div>
              <div>
                <span className="text-stone-500 font-medium mr-2">Email:</span>
                <EditableSettingText settingKey="contact_email" label="Email" value={email} />
              </div>
              <div>
                <span className="text-stone-500 font-medium mr-2">Hours:</span>
                <EditableSettingText settingKey="operating_hours" label="Operating Hours" value={hours} />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-4">
              Catalog
            </h3>
            <ul className="space-y-2.5 text-sm text-stone-300">
              <li><Link href="/products" className="hover:text-white transition-colors">All Products</Link></li>
              <li><Link href="/brands" className="hover:text-white transition-colors">Brands We Source</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Ask for a Quote</Link></li>
            </ul>
          </div>

          {/* Divisions */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-4">
              Supply Areas
            </h3>
            <ul className="space-y-2.5 text-sm text-stone-300">
              <li><Link href="/divisions/industrial" className="hover:text-white transition-colors">Industrial &amp; MRO Supply</Link></li>
              <li><Link href="/divisions/agricultural" className="hover:text-white transition-colors">Agricultural Supply</Link></li>
              <li><Link href="/divisions/general" className="hover:text-white transition-colors">General &amp; Facility</Link></li>
              <li><Link href="/divisions/special-items" className="text-[#EA6A12] hover:text-white transition-colors">Special Items (Custom)</Link></li>
            </ul>
          </div>

          {/* Company & Help */}
          <div className="md:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-4">
              Company &amp; Help
            </h3>
            <ul className="space-y-2.5 text-sm text-stone-300">
              <li>
                <a
                  href={`https://wa.me/${(settings["whatsapp_number"] || "918522095253").replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  WhatsApp Sales
                </a>
              </li>
              <li>
                <Link href="/documents" className="hover:text-white transition-colors">
                  Company Documents
                </Link>
              </li>
              <li>
                <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                  Email Sales
                </a>
              </li>
              <li>
                <Link href="/admin" className="text-stone-400 hover:text-white transition-colors">
                  Staff Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-400">
          <p>&copy; {year} {companyName} All rights reserved.</p>
          <p>
            <a
              href={creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-300 hover:text-white transition-colors"
            >
              <EditableSettingText settingKey="credit_text" label="Developer Credit" value={creditText} />
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

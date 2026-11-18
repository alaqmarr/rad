import nodemailer from "nodemailer";
import { getSiteSettings } from "./settings";
import type { EnquiryItem } from "@/db/schema";

interface SmtpAccountConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

async function getAdminSmtpConfig(): Promise<(SmtpAccountConfig & { recipient: string }) | null> {
  const s = await getSiteSettings();
  const host = (s["smtp_admin_host"] || s["smtp_host"] || "").trim();
  const port = Number(s["smtp_admin_port"] || s["smtp_port"] || 587);
  const secure = (s["smtp_admin_secure"] || s["smtp_secure"]) === "true";
  const user = (s["smtp_admin_user"] || s["smtp_user"] || "").trim();
  const pass = (s["smtp_admin_pass"] || s["smtp_pass"] || "").trim();
  const from = (
    s["smtp_admin_from"] ||
    s["smtp_from"] ||
    "Radiant Enquiries <enquiries@radiantindustrial.in>"
  ).trim();
  const recipient = (s["rfq_recipient_email"] || s["contact_email"] || "info@radiantindustrial.in").trim();

  if (!host || !user || !pass) return null;
  return { host, port, secure, user, pass, from, recipient };
}

async function getCustomerSmtpConfig(): Promise<SmtpAccountConfig | null> {
  const s = await getSiteSettings();
  const host = (s["smtp_customer_host"] || s["smtp_admin_host"] || s["smtp_host"] || "").trim();
  const port = Number(s["smtp_customer_port"] || s["smtp_admin_port"] || s["smtp_port"] || 587);
  const secure =
    (s["smtp_customer_secure"] || s["smtp_admin_secure"] || s["smtp_secure"]) === "true";
  const user = (s["smtp_customer_user"] || s["smtp_admin_user"] || s["smtp_user"] || "").trim();
  const pass = (s["smtp_customer_pass"] || s["smtp_admin_pass"] || s["smtp_pass"] || "").trim();
  const from = (
    s["smtp_customer_from"] ||
    s["smtp_admin_from"] ||
    s["smtp_from"] ||
    "Radiant Industrial Co. <hello@radiantindustrial.in>"
  ).trim();

  if (!host || !user || !pass) return null;
  return { host, port, secure, user, pass, from };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEnquiryEmails(payload: {
  referenceNo: string;
  channel: string;
  customerName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  deliveryLocation?: string;
  items: EnquiryItem[];
  attachmentUrl?: string | null;
  message: string;
}): Promise<{ sent: boolean; customerThankYouSent: boolean; error?: string }> {
  const adminCfg = await getAdminSmtpConfig();
  const customerCfg = await getCustomerSmtpConfig();

  if (!adminCfg && !customerCfg) {
    return {
      sent: false,
      customerThankYouSent: false,
      error: "SMTP accounts are not configured in Admin Settings yet.",
    };
  }

  const adminItemsRows = payload.items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${idx + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${escapeHtml(item.sku || "CUSTOM")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(item.name)}${item.brand ? ` <span style="color:#64748b;font-weight:400;">(${escapeHtml(item.brand)})</span>` : ""}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(item.qty)} ${escapeHtml(item.unit || "NOS")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${
          item.listedPrice != null ? `₹${Number(item.listedPrice).toLocaleString("en-IN")}` : "Ask for Price"
        }</td>
      </tr>`
    )
    .join("");

  const customerItemsRows = payload.items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${idx + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;">${escapeHtml(item.name)}${item.brand ? ` (${escapeHtml(item.brand)})` : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${escapeHtml(item.qty)} ${escapeHtml(item.unit || "NOS")}</td>
      </tr>`
    )
    .join("");

  const adminHtml = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;color:#141a21;">
    <div style="background:#0B0F14;color:#ffffff;padding:24px 28px;border-bottom:3px solid #ea6a12;">
      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#ea6a12;font-weight:700;">New Customer Enquiry</div>
      <h1 style="margin:6px 0 0;font-size:22px;">${escapeHtml(payload.referenceNo)}</h1>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;width:160px;">Source</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(payload.channel)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Customer Name</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(payload.customerName)}</td></tr>
        ${payload.companyName ? `<tr><td style="padding:6px 0;color:#64748b;">Company</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(payload.companyName)}</td></tr>` : ""}
        ${payload.email ? `<tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></td></tr>` : ""}
        ${payload.phone ? `<tr><td style="padding:6px 0;color:#64748b;">Phone / WhatsApp</td><td style="padding:6px 0;">${escapeHtml(payload.phone)}</td></tr>` : ""}
        ${payload.gstNumber ? `<tr><td style="padding:6px 0;color:#64748b;">GSTIN</td><td style="padding:6px 0;font-family:monospace;">${escapeHtml(payload.gstNumber)}</td></tr>` : ""}
        ${payload.deliveryLocation ? `<tr><td style="padding:6px 0;color:#64748b;">Delivery Location</td><td style="padding:6px 0;">${escapeHtml(payload.deliveryLocation)}</td></tr>` : ""}
      </table>

      ${
        payload.items.length > 0
          ? `<h3 style="font-size:15px;margin:20px 0 10px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">Requested Products</h3>
             <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
               <thead>
                 <tr style="background:#f8fafc;text-align:left;">
                   <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">#</th>
                   <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">Code</th>
                   <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">Product</th>
                   <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">Qty</th>
                   <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">Internal Saved Rate</th>
                 </tr>
               </thead>
               <tbody>${adminItemsRows}</tbody>
             </table>`
          : ""
      }

      <h3 style="font-size:15px;margin:16px 0 8px;">Customer Notes</h3>
      <div style="background:#f8fafc;padding:14px 16px;border-left:3px solid #ea6a12;font-size:14px;white-space:pre-wrap;">${escapeHtml(payload.message || "No extra notes.")}</div>

      ${
        payload.attachmentUrl
          ? `<p style="margin-top:16px;font-size:13px;"><strong>Attached File:</strong> <a href="${escapeHtml(payload.attachmentUrl)}">${escapeHtml(payload.attachmentUrl)}</a></p>`
          : ""
      }
    </div>
  </div>`;

  let adminSent = false;
  let customerThankYouSent = false;
  let lastError: string | undefined;

  // Account 1 -> Send to Admin Team
  if (adminCfg) {
    try {
      const adminTransporter = nodemailer.createTransport({
        host: adminCfg.host,
        port: adminCfg.port,
        secure: adminCfg.secure,
        auth: { user: adminCfg.user, pass: adminCfg.pass },
      });

      await adminTransporter.sendMail({
        from: adminCfg.from,
        to: adminCfg.recipient,
        replyTo: payload.email || undefined,
        subject: `[${payload.referenceNo}] New Enquiry${payload.companyName ? ` — ${payload.companyName}` : ` from ${payload.customerName}`}`,
        html: adminHtml,
      });
      adminSent = true;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Admin SMTP failed";
    }
  }

  // Account 2 -> Send Thank-You Mail to Customer
  if (customerCfg && payload.email) {
    try {
      const customerTransporter = nodemailer.createTransport({
        host: customerCfg.host,
        port: customerCfg.port,
        secure: customerCfg.secure,
        auth: { user: customerCfg.user, pass: customerCfg.pass },
      });

      await customerTransporter.sendMail({
        from: customerCfg.from,
        to: payload.email,
        subject: `Thank you for your enquiry (${payload.referenceNo}) — Radiant Industrial Co.`,
        html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;color:#141a21;background:#ffffff;">
          <div style="background:#0B0F14;color:#fff;padding:22px 26px;border-bottom:3px solid #ea6a12;">
            <strong style="font-size:18px;">Radiant Industrial Co.</strong>
            <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">Powering Progress, from Field to Factory.</div>
          </div>
          <div style="padding:26px;">
            <p style="margin-top:0;">Dear ${escapeHtml(payload.customerName)},</p>
            <p>Thank you for reaching out to <strong>Radiant Industrial Co.</strong> We have received your product enquiry and logged it under reference number <strong>${escapeHtml(payload.referenceNo)}</strong>.</p>
            ${
              payload.items.length > 0
                ? `<p style="font-weight:600;margin-bottom:8px;">Items requested:</p>
                   <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
                     <thead>
                       <tr style="background:#f8fafc;text-align:left;font-size:12px;color:#64748b;">
                         <th style="padding:8px 12px;border-bottom:1px solid #cbd5e1;">#</th>
                         <th style="padding:8px 12px;border-bottom:1px solid #cbd5e1;">Product</th>
                         <th style="padding:8px 12px;border-bottom:1px solid #cbd5e1;">Quantity</th>
                       </tr>
                     </thead>
                     <tbody>${customerItemsRows}</tbody>
                   </table>`
                : ""
            }
            <p>Our sales team in Secunderabad is checking stock and pricing for your items and will reply shortly with a formal GST quotation and delivery schedule.</p>
            <p style="margin-top:20px;font-size:13px;color:#4e5d6c;border-top:1px solid #e2e8f0;padding-top:14px;">
              Need quick updates? Call or WhatsApp us at <strong>+91 8522095253</strong> or reply to this email.<br/>
              Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana
            </p>
          </div>
        </div>`,
      });
      customerThankYouSent = true;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Customer SMTP failed";
    }
  }

  return { sent: adminSent, customerThankYouSent, error: lastError };
}

export async function sendDirectCustomerEmail(params: {
  toEmail: string;
  subject: string;
  bodyText: string;
}): Promise<{ sent: boolean; error?: string }> {
  const cfg = await getCustomerSmtpConfig();
  if (!cfg) {
    return { sent: false, error: "Customer SMTP account is not configured in Admin Settings." };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: cfg.from,
      to: params.toEmail,
      subject: params.subject,
      text: params.bodyText,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Email failed" };
  }
}

export async function sendTestEmail(
  toEmail: string,
  account: "admin" | "customer" = "admin"
): Promise<{ sent: boolean; error?: string }> {
  const cfg =
    account === "customer" ? await getCustomerSmtpConfig() : await getAdminSmtpConfig();
  if (!cfg) {
    return {
      sent: false,
      error: `${account === "customer" ? "Customer Thank-You" : "Admin Alert"} SMTP host, user, and password must be configured first.`,
    };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: cfg.from,
      to: toEmail,
      subject: `SMTP Test (${account === "customer" ? "Customer Account" : "Admin Account"}) — Radiant Industrial Co.`,
      text: `Your ${account === "customer" ? "Customer Thank-You" : "Admin Notification"} Nodemailer SMTP account is configured and working properly.`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "SMTP test failed" };
  }
}

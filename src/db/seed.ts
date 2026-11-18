import { eq } from "drizzle-orm";
import { db, siteSettings, pageBlocks, divisions, categories, brands, products, documents } from "./index";

async function seed() {
  console.log("Seeding Radiant Industrial Co. comprehensive MRO, Agri, Facility & Special Items database...");

  // 1. Site Settings
  const defaultSettings = [
    { key: "company_name", category: "general", label: "Company Name", value: "Radiant Industrial Co.", valueType: "text", isSecret: false },
    { key: "company_tagline", category: "general", label: "Company Tagline", value: "Powering Progress, from Field to Factory.", valueType: "text", isSecret: false },
    { key: "site_url", category: "general", label: "Canonical Site URL", value: "https://radiantindustrial.in", valueType: "text", isSecret: false },
    { key: "show_public_prices", category: "general", label: "Show Public Product Prices (true/false)", value: "false", valueType: "boolean", isSecret: false },
    { key: "gstin", category: "general", label: "Company GSTIN", value: "Pending Verification / Registered in Telangana", valueType: "text", isSecret: false },
    { key: "logo_primary", category: "branding", label: "Primary Horizontal Logo", value: "/logos/logo-long.png", valueType: "image", isSecret: false },
    { key: "logo_dark_surface", category: "branding", label: "Logo for Dark Surfaces", value: "/logos/logo-long-white.png", valueType: "image", isSecret: false },
    { key: "logo_mark", category: "branding", label: "Brand Icon Mark", value: "/logos/logo-short.png", valueType: "image", isSecret: false },
    { key: "credit_text", category: "branding", label: "Developer Credit Text", value: "Designed and powered by RapidShift Labs", valueType: "text", isSecret: false },
    { key: "credit_url", category: "branding", label: "Developer Credit URL", value: "https://rapidshiftlabs.com", valueType: "text", isSecret: false },

    { key: "contact_phone", category: "contact", label: "Primary Phone", value: "+91 8522095253", valueType: "text", isSecret: false },
    { key: "contact_email", category: "contact", label: "Primary Email", value: "info@radiantindustrial.in", valueType: "text", isSecret: false },
    { key: "rfq_recipient_email", category: "contact", label: "RFQ Inbox Email", value: "info@radiantindustrial.in", valueType: "text", isSecret: false },
    { key: "contact_address", category: "contact", label: "Headquarters Address", value: "Sai Vaishnavi Complex, Ranigunj, Secunderabad 500003, Telangana, India", valueType: "textarea", isSecret: false },
    { key: "operating_hours", category: "contact", label: "Operating Hours", value: "Mon – Sat, 9:00 AM – 6:00 PM IST", valueType: "text", isSecret: false },

    { key: "seo_default_title", category: "seo", label: "Default Meta Title", value: "Radiant Industrial Co. | Wholesale Industrial MRO, Farm & Special Supplies India", valueType: "text", isSecret: false },
    { key: "seo_default_description", category: "seo", label: "Default Meta Description", value: "Wholesale MRO, factory hardware, fasteners, bearings, valves, safety gear, electricals, agricultural irrigation, facility equipment, and custom Special Items across India.", valueType: "textarea", isSecret: false },
    { key: "seo_keywords", category: "seo", label: "Global SEO Keywords", value: "industrial MRO supply India, wholesale fasteners bearings valves, safety PPE supplier Secunderabad, electrical cables switchgear, agricultural irrigation tractor implements, warehouse racking material handling, custom machined special items India", valueType: "textarea", isSecret: false },
    { key: "google_tag_id", category: "seo", label: "Google Tag / GTM Container ID", value: "GTM-N7CK5GLP", valueType: "text", isSecret: false },
    { key: "google_site_verification", category: "seo", label: "Google Search Console Verification Code (Optional)", value: "", valueType: "text", isSecret: false },

    { key: "r2_account_id", category: "r2", label: "Cloudflare R2 Account ID", value: "", valueType: "text", isSecret: false },
    { key: "r2_access_key_id", category: "r2", label: "R2 Access Key ID", value: "", valueType: "password", isSecret: true },
    { key: "r2_secret_access_key", category: "r2", label: "R2 Secret Access Key", value: "", valueType: "password", isSecret: true },
    { key: "r2_bucket_name", category: "r2", label: "R2 Bucket Name", value: "radiant-industrial-media", valueType: "text", isSecret: false },
    { key: "r2_public_url", category: "r2", label: "R2 Public CDN URL", value: "", valueType: "text", isSecret: false },

    { key: "smtp_admin_host", category: "smtp", label: "Admin Alert SMTP Host", value: "", valueType: "text", isSecret: false },
    { key: "smtp_admin_port", category: "smtp", label: "Admin Alert SMTP Port", value: "587", valueType: "text", isSecret: false },
    { key: "smtp_admin_secure", category: "smtp", label: "Admin Alert Use SSL/TLS (465)", value: "false", valueType: "boolean", isSecret: false },
    { key: "smtp_admin_user", category: "smtp", label: "Admin Alert SMTP Username", value: "", valueType: "text", isSecret: false },
    { key: "smtp_admin_pass", category: "smtp", label: "Admin Alert SMTP Password", value: "", valueType: "password", isSecret: true },
    { key: "smtp_admin_from", category: "smtp", label: "Admin Alert From Address", value: "Radiant Enquiries <enquiries@radiantindustrial.in>", valueType: "text", isSecret: false },

    { key: "smtp_customer_host", category: "smtp", label: "Customer Thank-You SMTP Host", value: "", valueType: "text", isSecret: false },
    { key: "smtp_customer_port", category: "smtp", label: "Customer Thank-You SMTP Port", value: "587", valueType: "text", isSecret: false },
    { key: "smtp_customer_secure", category: "smtp", label: "Customer Thank-You Use SSL/TLS (465)", value: "false", valueType: "boolean", isSecret: false },
    { key: "smtp_customer_user", category: "smtp", label: "Customer Thank-You SMTP Username", value: "", valueType: "text", isSecret: false },
    { key: "smtp_customer_pass", category: "smtp", label: "Customer Thank-You SMTP Password", value: "", valueType: "password", isSecret: true },
    { key: "smtp_customer_from", category: "smtp", label: "Customer Thank-You From Address", value: "Radiant Industrial Co. <hello@radiantindustrial.in>", valueType: "text", isSecret: false },

    { key: "ai_enabled", category: "ai", label: "Enable AI Assistant", value: "true", valueType: "boolean", isSecret: false },
    { key: "ai_provider", category: "ai", label: "AI Provider (anthropic / openai / gemini)", value: "anthropic", valueType: "text", isSecret: false },
    { key: "ai_model", category: "ai", label: "AI Model ID", value: "claude-haiku-5-5", valueType: "text", isSecret: false },
    { key: "ai_effort", category: "ai", label: "Reasoning Effort (low / medium / high)", value: "low", valueType: "text", isSecret: false },
    { key: "ai_api_key", category: "ai", label: "AI API Key", value: "", valueType: "password", isSecret: true },
    { key: "ai_base_url", category: "ai", label: "Custom Base URL (OpenAI-compatible only)", value: "", valueType: "text", isSecret: false },
    { key: "ai_monthly_budget_usd", category: "ai", label: "Monthly AI Spend Cap (USD, keeps bill under $10)", value: "8.50", valueType: "text", isSecret: false },
    { key: "ai_max_output_tokens", category: "ai", label: "Max Output Tokens per Chat Reply", value: "512", valueType: "text", isSecret: false },
    { key: "ai_max_history_messages", category: "ai", label: "Max Chat History Turns Sent per Request", value: "8", valueType: "text", isSecret: false },
    { key: "ai_max_tool_steps", category: "ai", label: "Max Tool Loops per Reply", value: "3", valueType: "text", isSecret: false },
    { key: "ai_max_web_searches", category: "ai", label: "Max Web Searches per Product Lookup ($0.01/search)", value: "2", valueType: "text", isSecret: false },
    { key: "ai_admin_chat_web_search", category: "ai", label: "Allow Web Search in Admin Chat ($0.01/search)", value: "false", valueType: "boolean", isSecret: false },
    { key: "ai_customer_daily_limit", category: "ai", label: "Max AI Replies per Customer / Day (falls back to $0 search)", value: "20", valueType: "text", isSecret: false },
    { key: "ai_system_prompt", category: "ai", label: "Additional AI Instructions", value: "Speak in clear, plain English. Explain that Special Items is a separate dedicated supply scope for bespoke, custom-made, calibration, and hard-to-find parts.", valueType: "textarea", isSecret: false },

    { key: "whatsapp_number", category: "whatsapp", label: "WhatsApp Business Number (with country code)", value: "918522095253", valueType: "text", isSecret: false },
    { key: "whatsapp_mode", category: "whatsapp", label: "Integration Mode (wa_link / cloud_api)", value: "wa_link", valueType: "text", isSecret: false },
    { key: "whatsapp_phone_number_id", category: "whatsapp", label: "Meta Phone Number ID (Cloud API)", value: "", valueType: "text", isSecret: false },
    { key: "whatsapp_business_account_id", category: "whatsapp", label: "Meta WABA ID (Cloud API)", value: "", valueType: "text", isSecret: false },
    { key: "whatsapp_access_token", category: "whatsapp", label: "Meta Permanent Access Token", value: "", valueType: "password", isSecret: true },
    { key: "whatsapp_verify_token", category: "whatsapp", label: "Webhook Verify Token", value: "", valueType: "password", isSecret: true },
  ];

  for (const s of defaultSettings) {
    await db.insert(siteSettings).values(s).onConflictDoNothing({ target: siteSettings.key });
  }

  // 2. Page Blocks
  const defaultBlocks = [
    { pageSlug: "home", blockKey: "hero_title", label: "Hero Headline", content: "Industrial MRO, Farm & Special Supplies Delivered Across India.", contentType: "text" },
    { pageSlug: "home", blockKey: "hero_lead", label: "Hero Description", content: "One dependable wholesale supplier for everyday factory maintenance (MRO), tools, safety gear, farm equipment, warehouse supplies, plus a dedicated Special Items desk for custom and hard-to-find parts.", contentType: "textarea" },
    { pageSlug: "home", blockKey: "divisions_heading", label: "Divisions Section Heading", content: "Our Four Supply Scopes", contentType: "text" },
    { pageSlug: "home", blockKey: "divisions_lead", label: "Divisions Section Intro", content: "From standard daily factory maintenance (MRO) and farm hardware to a separate dedicated Special Items desk for custom-made and precision components.", contentType: "textarea" },
    { pageSlug: "home", blockKey: "featured_heading", label: "Featured Catalog Heading", content: "Popular Products Across Our Catalog", contentType: "text" },
    { pageSlug: "home", blockKey: "featured_lead", label: "Featured Catalog Intro", content: "Click WhatsApp for an instant quote or send an Email enquiry — we reply quickly with current rates and delivery timelines.", contentType: "textarea" },
    { pageSlug: "home", blockKey: "brands_heading", label: "Brands Section Heading", content: "Brands We Source For You", contentType: "text" },
    { pageSlug: "home", blockKey: "brands_disclosure", label: "Independent Sourcing Disclosure", content: "We are not an official authorized dealer for these brands yet. Instead, we act as your independent wholesale buyer — sourcing genuine brand-name parts and equipment directly against your order.", contentType: "textarea" },
    { pageSlug: "home", blockKey: "workflow_heading", label: "Procurement Workflow Heading", content: "How Ordering Works", contentType: "text" },
    { pageSlug: "home", blockKey: "cta_heading", label: "Bottom CTA Heading", content: "Send Us Your Requirement List", contentType: "text" },
    { pageSlug: "home", blockKey: "cta_lead", label: "Bottom CTA Description", content: "Need standard MRO parts, farm tools, or a custom-made Special Item? Message us on WhatsApp or send an email — we will reply quickly with prices, GST details, and delivery dates.", contentType: "textarea" },
    { pageSlug: "about", blockKey: "hero_title", label: "About Headline", content: "One Trusted Supplier for Factories, Workshops & Farms.", contentType: "text" },
    { pageSlug: "about", blockKey: "hero_lead", label: "About Lead", content: "Based in Ranigunj, Secunderabad, Radiant Industrial Co. saves you the hassle of dealing with dozens of separate shops and vendors.", contentType: "textarea" },
    { pageSlug: "about", blockKey: "story_title", label: "Our Story Title", content: "Why Businesses Buy From Us", contentType: "text" },
    { pageSlug: "about", blockKey: "story_body", label: "Our Story Body", content: "Buying fasteners, bearings, valves, safety gear, cables, pumps, racks, farm tools, and custom Special Items usually means calling ten different dealers. We handle everything under one roof with one clean GST invoice.", contentType: "textarea" },
    { pageSlug: "about", blockKey: "mission_title", label: "Our Mission Title", content: "Honest Pricing & Fast Delivery", contentType: "text" },
    { pageSlug: "about", blockKey: "mission_body", label: "Our Mission Body", content: "Every quote clearly states the brand, model, delivery timeline (usually 2 to 14 working days), and 7-day price validity so there are zero surprises.", contentType: "textarea" },
    { pageSlug: "brands", blockKey: "page_title", label: "Brands Directory Title", content: "Brands We Source", contentType: "text" },
    { pageSlug: "brands", blockKey: "page_lead", label: "Brands Directory Intro", content: "We supply genuine products across 30+ Indian and international brands. Unless marked authorized, we source these as an independent wholesale supplier.", contentType: "textarea" },
    { pageSlug: "documents", blockKey: "page_title", label: "Documents Hub Title", content: "Company Documents & Product Brochures", contentType: "text" },
    { pageSlug: "documents", blockKey: "page_lead", label: "Documents Hub Intro", content: "Download our company vendor profile, standard order terms, and product specification sheets.", contentType: "textarea" },
    { pageSlug: "contact", blockKey: "page_title", label: "Contact Headline", content: "Ask for a Price Quote", contentType: "text" },
    { pageSlug: "contact", blockKey: "page_lead", label: "Contact Intro", content: "Message us directly on WhatsApp or send your item list / spreadsheet via Email.", contentType: "textarea" },
    { pageSlug: "contact", blockKey: "commercial_terms", label: "Standard Commercial Terms Summary", content: "1. Price quotes stay valid for 7 days. 2. Standard delivery takes 7–14 working days (or as listed per item). 3. GST is added as applicable. 4. Orders begin as soon as you send a Purchase Order or advance payment.", contentType: "textarea" },
  ];

  for (const b of defaultBlocks) {
    await db
      .insert(pageBlocks)
      .values(b)
      .onConflictDoUpdate({
        target: [pageBlocks.pageSlug, pageBlocks.blockKey],
        set: { content: b.content },
      });
  }

  // 3. Four Distinct Supply Scopes (Special Items cleanly separated from MRO, Agri, General)
  const divisionSeeds = [
    {
      slug: "industrial",
      name: "Industrial & MRO Supply",
      tagline: "Everyday plant maintenance, fasteners, bearings, valves, tools, welding, lubricants, abrasives, electrical & safety PPE.",
      description: "Complete Maintenance, Repair & Operations (MRO) supply for factories, workshops, and plants — fasteners, bearings, belts, valves, hand/power/cutting tools, welding consumables, safety PPE, adhesives, lubricants, abrasives, and electrical spares.",
      heroImageUrl: "/images/div-industrial.jpg",
      sortOrder: 1,
      seoTitle: "Industrial & MRO Supply | Fasteners, Bearings, Valves, Tools & Safety PPE",
      seoDescription: "Wholesale industrial MRO supply in India: fasteners, bearings, valves, hoses, power tools, cutting tools, welding gear, PPE, lubricants, abrasives, and electrical components.",
    },
    {
      slug: "agricultural",
      name: "Agricultural Supply",
      tagline: "Drip irrigation, water pumps, tractor implements, sprayers, greenhouse nets, and farm hardware.",
      description: "Practical supplies for farms, orchards, and agri-projects — drip & sprinkler irrigation, water pumps, rotavator & tillage implements, sprayers, brush cutters, shade/greenhouse nets, and farm hand tools.",
      heroImageUrl: "/images/div-agricultural.jpg",
      sortOrder: 2,
      seoTitle: "Agricultural Supply | Irrigation, Pumps, Tractor Implements & Sprayers",
      seoDescription: "Wholesale farm supplies in India: drip irrigation kits, Kirloskar water pumps, tractor rotavator blades, sprayers, brush cutters, greenhouse nets, and farm hardware.",
    },
    {
      slug: "general",
      name: "General & Facility Supply",
      tagline: "Warehouse storage racks, pallet trucks, packaging materials, industrial lighting, and cleaning supplies.",
      description: "Everything needed to run warehouses, godowns, offices, and plant facilities smoothly — heavy storage racks, pallet jacks, crates, packing tapes, stretch film, LED high-bay lights, and commercial cleaning machines & supplies.",
      heroImageUrl: "/images/div-general.jpg",
      sortOrder: 3,
      seoTitle: "General & Facility Supply | Storage Racks, Material Handling, Packaging & Cleaning",
      seoDescription: "Warehouse storage racks, pallet trucks, packaging tapes, LED industrial lighting, and janitorial facility maintenance supplies.",
    },
    {
      slug: "special-items",
      name: "Special Items (Custom & Technical)",
      tagline: "Separate dedicated scope for custom machined parts, calibration instruments, specialty alloys, and hard-to-find OEM spares.",
      description: "A completely separate sourcing desk built specifically for non-standard, bespoke, and specialized items: CNC machined parts, SS 316 instrumentation fittings, Mitutoyo/Fluke precision calibration meters, aerospace alloys & engineering plastics (PTFE/Delrin), and hard-to-find machine spares.",
      heroImageUrl: "/images/div-technical.jpg",
      sortOrder: 4,
      seoTitle: "Special Items Supply Scope | Custom Machined Parts, Calibration Instruments & Alloys",
      seoDescription: "Dedicated sourcing for Special Items in India: custom CNC fittings, Mitutoyo & Fluke precision instruments, Al 7075 / SS 316 alloys, PTFE rods, and hard-to-source OEM spares.",
    },
  ];

  // Cleanly rename legacy 'special-technical' row to 'special-items' if present so existing FKs stay intact!
  const [legacySpec] = await db.select().from(divisions).where(eq(divisions.slug, "special-technical")).limit(1);
  if (legacySpec) {
    await db
      .update(divisions)
      .set({
        slug: "special-items",
        name: divisionSeeds[3].name,
        tagline: divisionSeeds[3].tagline,
        description: divisionSeeds[3].description,
        heroImageUrl: divisionSeeds[3].heroImageUrl,
        sortOrder: 4,
        seoTitle: divisionSeeds[3].seoTitle,
        seoDescription: divisionSeeds[3].seoDescription,
      })
      .where(eq(divisions.id, legacySpec.id));
  }

  const divisionMap: Record<string, number> = {};
  for (const d of divisionSeeds) {
    await db
      .insert(divisions)
      .values(d)
      .onConflictDoUpdate({
        target: divisions.slug,
        set: {
          name: d.name,
          tagline: d.tagline,
          description: d.description,
          heroImageUrl: d.heroImageUrl,
          sortOrder: d.sortOrder,
          seoTitle: d.seoTitle,
          seoDescription: d.seoDescription,
        },
      });
    const [row] = await db.select().from(divisions).where(eq(divisions.slug, d.slug));
    if (row) divisionMap[d.slug] = row.id;
  }

  // 4. Comprehensive Categories Across All 4 Scopes
  const categorySeeds = [
    // Industrial & MRO Supply (8 categories)
    { slug: "fasteners-fixing", name: "Fasteners & Fixing Hardware", divisionSlug: "industrial", sortOrder: 1, description: "High-tensile hex bolts (8.8/10.9), SS 304/316 screws, nuts, washers, anchors, and rivets." },
    { slug: "bearings-transmission", name: "Bearings, Belts & Power Transmission", divisionSlug: "industrial", sortOrder: 2, description: "Ball & roller bearings, pillow blocks, V-belts, roller chains, sprockets, oil seals & O-rings." },
    { slug: "valves-pipes-flow", name: "Valves, Pipes & Flow Control", divisionSlug: "industrial", sortOrder: 3, description: "Ball, gate & butterfly valves, pneumatic cylinders, hydraulic pumps, hoses, flanges & clamps." },
    { slug: "tools-cutting-machining", name: "Hand, Power & Cutting Tools", divisionSlug: "industrial", sortOrder: 4, description: "Angle grinders, drills, spanners, torque wrenches, HSS drill bits, end mills & carbide inserts." },
    { slug: "welding-fabrication", name: "Welding & Fabrication", divisionSlug: "industrial", sortOrder: 5, description: "Welding machines, auto-darkening helmets, Kevlar leather aprons, electrodes & MIG wire." },
    { slug: "safety-ppe", name: "Safety Gear & PPE", divisionSlug: "industrial", sortOrder: 6, description: "Safety helmets, goggles, work gloves, steel-toe shoes, coveralls, harnesses & hazard tapes." },
    { slug: "lubricants-adhesives-abrasives", name: "Lubricants, Adhesives & Abrasives", divisionSlug: "industrial", sortOrder: 7, description: "Industrial greases, rust sprays, Loctite threadlockers, epoxy, grinding wheels & flap discs." },
    { slug: "electrical-pneumatic-mro", name: "Electrical & Pneumatic MRO", divisionSlug: "industrial", sortOrder: 8, description: "Industrial copper cables, MCBs, contactors, cable lugs/ties, FRL air units & LED floodlights." },

    // Agricultural Supply (4 categories)
    { slug: "irrigation-pumps", name: "Irrigation & Water Pumps", divisionSlug: "agricultural", sortOrder: 9, description: "Drip lateral kits, rain guns, disc filters, HDPE/PVC pipes, monoblock & borewell pumps." },
    { slug: "tractor-implements", name: "Tractor Implements & Tillage", divisionSlug: "agricultural", sortOrder: 10, description: "Boron steel rotavator blades, disc harrows, seed drills, cultivators, threshers & PTO shafts." },
    { slug: "sprayers-crop-care", name: "Sprayers & Yard Equipment", divisionSlug: "agricultural", sortOrder: 11, description: "Battery knapsack sprayers, tractor boom sprayers, brush cutters, earth augers & chainsaws." },
    { slug: "greenhouse-farm-hardware", name: "Greenhouse Nets & Farm Hardware", divisionSlug: "agricultural", sortOrder: 12, description: "200-micron UV polyhouse films, agro shade nets, insect mesh, secateurs, sickles & seed inputs." },

    // General & Facility Supply (4 categories)
    { slug: "storage-material-handling", name: "Warehouse Racks & Material Handling", divisionSlug: "general", sortOrder: 13, description: "Heavy-duty shelving & pallet racks, hand pallet trucks, stackers, trolleys, hoists & HDPE crates." },
    { slug: "packaging-shipping", name: "Packaging, Tapes & Shipping", divisionSlug: "general", sortOrder: 14, description: "Heavy duct tapes, BOPP packing tapes, stretch wrap, PET/steel strapping & weighing scales." },
    { slug: "janitorial-facility", name: "Janitorial & Facility Cleaning", divisionSlug: "general", sortOrder: 15, description: "Industrial floor scrubbers, pressure washers, degreasers, shop wipers, waste bins & dispensers." },
    { slug: "facility-lighting-fans", name: "Industrial Lighting & Facility Electrical", divisionSlug: "general", sortOrder: 16, description: "High-bay LED lights, emergency lighting, industrial exhaust/HVLS fans & junction boxes." },

    // Special Items — Separate Supply Scope (4 categories)
    { slug: "custom-machined-fittings", name: "Custom Machined Parts & Fittings", divisionSlug: "special-items", sortOrder: 17, description: "Bespoke CNC turned/milled components, SS 316 double-ferrule fittings, custom flanges & gaskets." },
    { slug: "precision-instruments", name: "Precision & Calibration Instruments", divisionSlug: "special-items", sortOrder: 18, description: "Mitutoyo vernier calipers & micrometers, Fluke True-RMS clamp meters, thermal cameras & gauges." },
    { slug: "specialty-alloys-plastics", name: "Specialty Metals, Alloys & Plastics", divisionSlug: "special-items", sortOrder: 19, description: "Aluminum 7075/6061 billets, SS 304/316 bright rods, brass bars, PTFE/Teflon, Delrin & Nylon sheets." },
    { slug: "hard-to-find-oem-spares", name: "Special & Hard-to-Source OEM Spares", divisionSlug: "special-items", sortOrder: 20, description: "Non-standard industrial spares, specialized sensors, custom power packs & import-substitute parts." },
  ];

  // Map legacy category slugs to new ones cleanly before upsert
  const legacyCatMap: Record<string, string> = {
    "pneumatics-hydraulics": "valves-pipes-flow",
    "power-tools-fasteners": "tools-cutting-machining",
    "electrical-cabling": "electrical-pneumatic-mro",
    "custom-fittings-sensors": "custom-machined-fittings",
    "tractor-harvesting": "tractor-implements",
    "tapes-janitorial-mro": "packaging-shipping",
  };

  for (const [oldSlug, newSlug] of Object.entries(legacyCatMap)) {
    const [oldCat] = await db.select().from(categories).where(eq(categories.slug, oldSlug)).limit(1);
    const seedTarget = categorySeeds.find((c) => c.slug === newSlug);
    if (oldCat && seedTarget && divisionMap[seedTarget.divisionSlug]) {
      await db
        .update(categories)
        .set({
          slug: seedTarget.slug,
          name: seedTarget.name,
          description: seedTarget.description,
          divisionId: divisionMap[seedTarget.divisionSlug],
          sortOrder: seedTarget.sortOrder,
        })
        .where(eq(categories.id, oldCat.id));
    }
  }

  const categoryMap: Record<string, number> = {};
  for (const c of categorySeeds) {
    const divisionId = divisionMap[c.divisionSlug];
    if (!divisionId) continue;
    await db
      .insert(categories)
      .values({
        slug: c.slug,
        name: c.name,
        description: c.description,
        divisionId,
        sortOrder: c.sortOrder,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: c.name,
          description: c.description,
          divisionId,
          sortOrder: c.sortOrder,
        },
      });
    const [row] = await db.select().from(categories).where(eq(categories.slug, c.slug));
    if (row) categoryMap[c.slug] = row.id;
  }

  // 5. Brands (30+ Trusted Brands)
  const brandSeeds = [
    { slug: "godrej-storage", name: "Godrej Storage Solutions", countryOfOrigin: "India", isFeatured: true, sortOrder: 1, description: "Heavy-duty industrial shelving, pallet racking, and warehouse storage systems." },
    { slug: "skf", name: "SKF", countryOfOrigin: "Sweden", isFeatured: true, sortOrder: 2, description: "Precision rolling bearings, seals, V-belts, and lubrication maintenance systems." },
    { slug: "ntn", name: "NTN", countryOfOrigin: "Japan", isFeatured: true, sortOrder: 3, description: "High-load pillow block units, tapered roller, and industrial mounted bearings." },
    { slug: "polycab", name: "Polycab", countryOfOrigin: "India", isFeatured: true, sortOrder: 4, description: "Industrial flexible copper cables, armoured power cables, and FRLS wiring." },
    { slug: "esab", name: "ESAB", countryOfOrigin: "Sweden / India", isFeatured: true, sortOrder: 5, description: "Welding machines, protective welding PPE, electrodes, and cutting consumables." },
    { slug: "udyogi", name: "Udyogi", countryOfOrigin: "India", isFeatured: true, sortOrder: 6, description: "Certified industrial safety eyewear, helmets, respiratory masks, and fall protection." },
    { slug: "bosch-professional", name: "Bosch Professional", countryOfOrigin: "Germany", isFeatured: true, sortOrder: 7, description: "Heavy-duty electric & cordless power tools, grinders, and laser measurement." },
    { slug: "dowty", name: "Dowty", countryOfOrigin: "UK / Global", isFeatured: true, sortOrder: 8, description: "High-pressure hydraulic gear pumps and fluid power components." },
    { slug: "festo", name: "Festo", countryOfOrigin: "Germany", isFeatured: false, sortOrder: 9, description: "Pneumatic actuators, solenoid valves, air prep units, and factory automation." },
    { slug: "karam", name: "Karam", countryOfOrigin: "India", isFeatured: true, sortOrder: 10, description: "Full-body safety harnesses, industrial helmets, safety shoes, and lifelines." },
    { slug: "3m-industrial", name: "3M Industrial", countryOfOrigin: "USA", isFeatured: true, sortOrder: 11, description: "Industrial abrasives, VHB/duct tapes, respirators, and hearing protection." },
    { slug: "honeywell-safety", name: "Honeywell Safety", countryOfOrigin: "USA", isFeatured: false, sortOrder: 12, description: "Gas detection, protective gloves, and enterprise PPE solutions." },
    { slug: "makita", name: "Makita", countryOfOrigin: "Japan", isFeatured: false, sortOrder: 13, description: "Industrial drills, demolition hammers, cut-off saws, and cordless tool kits." },
    { slug: "taparia", name: "Taparia", countryOfOrigin: "India", isFeatured: false, sortOrder: 14, description: "Forged hand tools, spanners, torque wrenches, pliers, and socket sets." },
    { slug: "lt-switchgear", name: "L&T Switchgear (Lauritz Knudsen)", countryOfOrigin: "India", isFeatured: true, sortOrder: 15, description: "MCBs, MCCBs, ACBs, contactors, overload relays, and motor starters." },
    { slug: "havells", name: "Havells", countryOfOrigin: "India", isFeatured: false, sortOrder: 16, description: "Industrial switchgear, motors, capacitors, and high-bay LED lighting." },
    { slug: "mitutoyo", name: "Mitutoyo", countryOfOrigin: "Japan", isFeatured: true, sortOrder: 17, description: "Precision digital calipers, micrometers, dial gauges, and surface testers." },
    { slug: "fluke", name: "Fluke", countryOfOrigin: "USA", isFeatured: true, sortOrder: 18, description: "True-RMS digital multimeters, clamp meters, thermal cameras, and calibrators." },
    { slug: "jindal-stainless", name: "Jindal Stainless", countryOfOrigin: "India", isFeatured: false, sortOrder: 19, description: "SS 304/316 bright bars, sheets, plates, and industrial pipes." },
    { slug: "jain-irrigation", name: "Jain Irrigation", countryOfOrigin: "India", isFeatured: true, sortOrder: 20, description: "Drip irrigation lines, sprinklers, filtration units, and HDPE agri pipes." },
    { slug: "netafim", name: "Netafim", countryOfOrigin: "Israel / India", isFeatured: false, sortOrder: 21, description: "Precision pressure-compensated drip systems and fertigation equipment." },
    { slug: "kirloskar", name: "Kirloskar", countryOfOrigin: "India", isFeatured: true, sortOrder: 22, description: "Industrial centrifugal pumps, agricultural borewell pumps, and valves." },
    { slug: "supreme-industries", name: "Supreme Industries", countryOfOrigin: "India", isFeatured: false, sortOrder: 23, description: "Industrial uPVC/CPVC piping, material handling crates, and agri fittings." },
    { slug: "falcon-agri", name: "Falcon Garden & Agri Tools", countryOfOrigin: "India", isFeatured: false, sortOrder: 24, description: "Commercial harvesting tools, pruning secateurs, brush cutters, and sprayers." },
    { slug: "loctite-henkel", name: "Loctite (Henkel)", countryOfOrigin: "Germany", isFeatured: false, sortOrder: 25, description: "Industrial threadlockers, retaining compounds, RTV sealants, and structural adhesives." },
    { slug: "norton-abrasives", name: "Norton Abrasives", countryOfOrigin: "USA / India", isFeatured: false, sortOrder: 26, description: "Grinding wheels, thin cut-off wheels, flap discs, and coated sanding belts." },
    { slug: "fenner-india", name: "Fenner India", countryOfOrigin: "India", isFeatured: false, sortOrder: 27, description: "Industrial V-belts, timing belts, taper-lock pulleys, couplings, and oil seals." },
    { slug: "unbrako", name: "Unbrako", countryOfOrigin: "India / Global", isFeatured: false, sortOrder: 28, description: "High-tensile 10.9 & 12.9 socket head cap screws, hex bolts, and alloy fasteners." },
    { slug: "lt-valves", name: "L&T Valves", countryOfOrigin: "India", isFeatured: false, sortOrder: 29, description: "Industrial ball valves, gate valves, globe valves, and butterfly flow-control valves." },
    { slug: "stanley-black-decker", name: "Stanley Tools", countryOfOrigin: "USA", isFeatured: false, sortOrder: 30, description: "Mechanics tool sets, measuring tapes, utility knives, and workshop storage." },
  ];

  const brandMap: Record<string, number> = {};
  for (const b of brandSeeds) {
    await db
      .insert(brands)
      .values({
        ...b,
        sourcingType: "independent",
        sourcingNote: "We are not an official authorized dealer yet; we source genuine items directly against your order.",
        seoTitle: `${b.name} Wholesale Supply | Radiant Industrial Co.`,
        seoDescription: `Source genuine ${b.name} products in India through Radiant Industrial Co.`,
      })
      .onConflictDoNothing({ target: brands.slug });
    const [row] = await db.select().from(brands).where(eq(brands.slug, b.slug));
    if (row) brandMap[b.slug] = row.id;
  }

  // 6. Product Catalog (Taparia Tools Price List — April 2026, non-destructive upsert)
  void categoryMap;
  void products;
  const { replaceCatalogWithTapariaPdf } = await import("./taparia-catalog");
  const tapariaResult = await replaceCatalogWithTapariaPdf({ clearExisting: false });
  console.log(
    `Loaded Taparia catalog: ${tapariaResult.insertedCount} inserted, ${tapariaResult.updatedCount} updated, ${tapariaResult.totalAfterCount} total products (Taparia brand ID: ${brandMap["taparia"] ?? "auto"}).`
  );

  // 7. Starter Documents
  const docSeeds = [
    {
      title: "Radiant Industrial Co. — Standard Commercial Terms & Conditions",
      slug: "standard-commercial-terms-conditions",
      description: "Official quotation validity (7 days), PO processing rules, pan-India freight terms, GST compliance, and lead-time guidelines.",
      category: "terms",
      fileUrl: "/api/documents/terms-summary",
      fileName: "radiant-commercial-terms.txt",
      fileSize: 2048,
      mimeType: "text/plain",
      isPublic: true,
    },
    {
      title: "B2B Vendor Capability & Multi-Brand Sourcing Profile",
      slug: "vendor-capability-multi-brand-profile",
      description: "Vendor registration summary covering Secunderabad HQ details, MRO/Agri/General/Special Items scopes, and independent multi-brand sourcing.",
      category: "company_profile",
      fileUrl: "/api/documents/company-profile",
      fileName: "radiant-vendor-profile.txt",
      fileSize: 2450,
      mimeType: "text/plain",
      isPublic: true,
    },
  ];

  for (const doc of docSeeds) {
    await db.insert(documents).values(doc).onConflictDoNothing({ target: documents.slug });
  }

  console.log("Seed completed successfully.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  thinsp: " ",
  ensp: " ",
  emsp: " ",
  shy: "",
  lrm: "",
  rlm: "",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  lsquo: "'",
  rsquo: "'",
  sbquo: ",",
  ldquo: '"',
  rdquo: '"',
  acute: "'",
  ndash: "–",
  mdash: "—",
  minus: "-",
  reg: "®",
  trade: "™",
  copy: "©",
  deg: "°",
  ordm: "°",
  times: "×",
  divide: "÷",
  plusmn: "±",
  bull: "•",
  middot: "·",
  diams: "♦",
  hellip: "…",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  frasl: "/",
  sup1: "¹",
  sup2: "²",
  sup3: "³",
  micro: "µ",
  mu: "µ",
  Omega: "Ω",
  Delta: "Δ",
  Pi: "π",
  phi: "φ",
  oslash: "ø",
  Oslash: "Ø",
  Prime: '"',
  asymp: "≈",
  le: "≤",
  ge: "≥",
  radic: "√",
  empty: "∅",
  macr: "¯",
  Auml: "Ä",
  auml: "ä",
  Ouml: "Ö",
  ouml: "ö",
  Uuml: "Ü",
  uuml: "ü",
  ccedil: "ç",
  Ccedil: "Ç",
  ocirc: "ô",
  szlig: "ß",
};

export function decodeHtmlEntities(input: string): string {
  if (!input) return "";
  const pass = (str: string) =>
    str
      .replace(/[\u200B-\u200F\uFEFF]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/&#(\d+);/g, (_, num) => {
        const code = Number(num);
        if (code === 160) return " ";
        if (code === 10 || code === 13) return "\n";
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        if (code === 0xa0) return " ";
        if (code === 0x0a || code === 0x0d) return "\n";
        if (code === 0x2011) return "-";
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
      })
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (full, name) =>
        Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
          ? NAMED_ENTITIES[name]
          : full
      );

  // Run two passes cleanly so double-encoded strings (&amp;nbsp; / &amp;ldquo;) resolve completely
  return pass(pass(input));
}

const HTML_TAG_REGEX =
  /<\/?(?:a|abbr|address|article|aside|b|bdi|bdo|blockquote|body|br|button|caption|center|cite|code|col|colgroup|data|dd|del|details|dfn|div|dl|dt|em|embed|figcaption|figure|font|footer|form|h[1-6]|head|header|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|link|main|map|mark|meta|nav|noscript|object|ol|optgroup|option|output|p|param|picture|pre|q|rp|rt|ruby|s|samp|script|section|select|small|source|span|strong|style|sub|summary|sup|svg|table|tbody|td|template|textarea|tfoot|th|thead|time|title|tr|track|u|ul|var|video|wbr)\b[^>]*>/gi;

export function htmlToCleanText(
  raw: string | null | undefined,
  singleLine = false
): string {
  if (!raw) return "";
  // Decode entities FIRST so escaped tags (&lt;p&gt;...&lt;/p&gt;) are converted and stripped cleanly
  let txt = decodeHtmlEntities(String(raw));
  txt = txt
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:style|script|noscript|svg|iframe|button)[\s\S]*?<\/(?:style|script|noscript|svg|iframe|button)>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote|table|ul|ol)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(?:td|th)\s*>/gi, " | ")
    .replace(HTML_TAG_REGEX, " ");

  // Decode one more time in case entities sat inside removed markup, then normalize whitespace
  txt = decodeHtmlEntities(txt);

  if (singleLine) {
    return txt
      .replace(/\s+/g, " ")
      .replace(/([A-Za-z0-9)\]"'®™°%])\s+([.,;:!?])(?=\s|$)/g, "$1$2")
      .replace(/^\s*\|+|\|+\s*$/g, "")
      .trim();
  }

  return txt
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([A-Za-z0-9)\]"'®™°%])[ \t]+([.,;:!?])(?=[ \t]|$)/gm, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Store display names are derived only from the URL hostname — scraped
// "siteName" values are unreliable (e.g. brand names on retailer pages).

const STORE_NAMES: Record<string, string> = {
  "mobiledokan.com": "MobileDokan.com",
  "mobiledokan.co": "MobileDokan.co",
  "dazzle.com.bd": "Dazzle",
  "smsgadget.com": "SMS Gadget",
  "applegadgetsbd.com": "Apple Gadgets",
  "pickaboo.com": "Pickaboo",
  "startech.com.bd": "Star Tech",
  "ryans.com": "Ryans",
  "sumashtech.com": "Sumash Tech",
  "daraz.com.bd": "Daraz",
  "techlandbd.com": "Tech Land",
  "bdstall.com": "BDStall",
  "tahamtech.com.bd": "Taham Tech",
  "gadgetandgear.com": "Gadget & Gear",
  "techdokan.com.bd": "TechDokan",
  "shajgoj.com": "Shajgoj",
  "chardike.com": "Chardike",
  "arogga.com": "Arogga",
};

const SECOND_LEVEL = new Set(["com", "co", "net", "org", "gov", "edu", "ac"]);

export function storeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function storeNameFromUrl(url: string): string {
  const host = storeHost(url);
  if (!host) return "Unknown";
  for (const [domain, name] of Object.entries(STORE_NAMES)) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  const parts = host.split(".");
  // Registrable label: skip ccTLD and second-level like "com" in "x.com.bd".
  let idx = parts.length - 2;
  if (idx > 0 && parts[parts.length - 1].length === 2 && SECOND_LEVEL.has(parts[idx])) idx--;
  const label = parts[Math.max(0, idx)] ?? host;
  return label
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CATEGORY_RETAILERS: Record<string, string[]> = {
  SMARTPHONES: [
    "mobiledokan.co",
    "dazzle.com.bd",
    "smsgadget.com",
    "applegadgetsbd.com",
    "pickaboo.com",
    "techlandbd.com",
    "bdstall.com",
    "tahamtech.com.bd",
    "gsm-bd.com",
    "mobiledokanbd.com",
  ],
  COMPUTERS: [
    "startech.com.bd",
    "ryans.com",
    "techlandbd.com",
    "bdstall.com",
    "pickaboo.com",
    "ultratech.com.bd",
    "daraz.com.bd",
    "computermania.com.bd",
  ],
  AUDIO: [
    "startech.com.bd",
    "ryans.com",
    "pickaboo.com",
    "daraz.com.bd",
    "dazzle.com.bd",
    "mobiledokan.co",
    "techlandbd.com",
  ],
  TV_DISPLAY: [
    "daraz.com.bd",
    "pickaboo.com",
    "ryans.com",
    "startech.com.bd",
    "bdstall.com",
    "dazzle.com.bd",
  ],
  CAMERAS: [
    "startech.com.bd",
    "ryans.com",
    "pickaboo.com",
    "daraz.com.bd",
    "bdstall.com",
  ],
  GAMING: [
    "startech.com.bd",
    "ryans.com",
    "pickaboo.com",
    "daraz.com.bd",
    "techlandbd.com",
  ],
  ACCESSORIES: [
    "mobiledokan.co",
    "daraz.com.bd",
    "pickaboo.com",
    "startech.com.bd",
    "dazzle.com.bd",
    "priyoshop.com",
  ],
  HEALTH_BEAUTY: [
    "shajgoj.com",
    "chardike.com",
    "arogga.com",
    "daraz.com.bd",
    "priyoshop.com",
    "othoba.com",
  ],
  MEDICINE: [
    "arogga.com",
    "daraz.com.bd",
    "priyoshop.com",
  ],
  GROCERY: [
    "chaldal.com",
    "shwapno.com.bd",
    "daraz.com.bd",
    "othoba.com",
    "priyoshop.com",
    "meena.com.bd",
  ],
  FASHION: [
    "daraz.com.bd",
    "bagdoom.com",
    "ajkerdeal.com",
    "priyoshop.com",
    "othoba.com",
    "fabrilife.com",
    "shajgoj.com",
  ],
  BOOKS: [
    "rokomari.com",
    "wafilife.com",
    "daraz.com.bd",
  ],
  HOME_APPLIANCES: [
    "daraz.com.bd",
    "othoba.com",
    "ajkerdeal.com",
    "priyoshop.com",
    "pickaboo.com",
    "bdstall.com",
  ],
  SPORTS: [
    "daraz.com.bd",
    "ajkerdeal.com",
    "priyoshop.com",
    "othoba.com",
  ],
  BABY_KIDS: [
    "daraz.com.bd",
    "priyoshop.com",
    "othoba.com",
    "ajkerdeal.com",
  ],
  GENERAL: [
    "daraz.com.bd",
    "pickaboo.com",
    "ajkerdeal.com",
    "priyoshop.com",
    "othoba.com",
    "shajgoj.com",
  ],
};

function detectCategory(query: string): {
  category: keyof typeof CATEGORY_RETAILERS;
  queryEnhancement: string;
} {
  const q = query.toLowerCase().trim();

  const smartphoneBrands = [
    "samsung galaxy", "iphone", "xiaomi", "redmi", "poco",
    "realme", "oppo", "vivo", "iqoo", "oneplus", "nokia",
    "motorola", "huawei", "honor", "nothing", "cmf",
    "tecno", "infinix", "symphony", "walton mobile",
  ];
  if (smartphoneBrands.some((b) => q.includes(b))) {
    return { category: "SMARTPHONES", queryEnhancement: "price Bangladesh buy official" };
  }

  const computerBrands = [
    "macbook", "thinkpad", "dell xps", "hp pavilion",
    "hp elitebook", "lenovo ideapad", "asus vivobook",
    "asus rog", "msi gaming", "acer nitro", "acer aspire",
    "rtx", "rx 6", "rx 7", "core i", "ryzen",
    "intel core", "amd ryzen",
  ];
  if (computerBrands.some((b) => q.includes(b))) {
    return { category: "COMPUTERS", queryEnhancement: "price Bangladesh buy" };
  }

  const audioBrands = [
    "airpods", "sony wh", "sony wf", "jabra", "jbl",
    "bose", "sennheiser", "anker soundcore", "soundcore",
    "marshall", "skullcandy", "oneplus buds", "galaxy buds",
    "pixel buds", "nothing ear",
  ];
  if (audioBrands.some((b) => q.includes(b))) {
    return { category: "AUDIO", queryEnhancement: "price Bangladesh" };
  }

  const beautBrands = [
    "cerave", "the ordinary", "neutrogena", "cetaphil",
    "garnier", "loreal", "l'oreal", "pond's", "ponds",
    "mamaearth", "biotique", "himalaya", "dove", "nivea",
    "vaseline", "fair & lovely", "glow & lovely",
    "clean & clear", "simple kind", "bioderma", "la roche",
    "cosrx", "innisfree", "skinfood", "some by mi",
  ];
  if (beautBrands.some((b) => q.includes(b))) {
    return { category: "HEALTH_BEAUTY", queryEnhancement: "price Bangladesh buy skincare" };
  }

  const categories: Array<{
    key: keyof typeof CATEGORY_RETAILERS;
    keywords: string[];
    queryEnhancement: string;
    maxTargeted: number;
  }> = [
    {
      key: "SMARTPHONES",
      keywords: [
        "phone", "smartphone", "mobile phone", "5g phone",
        "4g phone", "android phone", "ios phone", "tab",
        "tablet", "ipad", "s24", "s25", "a55", "a35",
        "note 14", "note 13", "a16", "a15", "13 pro",
        "14 pro", "15 pro", "flip", "fold",
      ],
      queryEnhancement: "price Bangladesh buy official",
      maxTargeted: 8,
    },
    {
      key: "COMPUTERS",
      keywords: [
        "laptop", "notebook", "pc", "desktop", "computer",
        "processor", "cpu", "gpu", "graphics card",
        "motherboard", "ram", "ssd", "hard drive", "hdd",
        "monitor", "keyboard", "mouse", "gaming laptop",
        "ultrabook", "workstation", "server",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 6,
    },
    {
      key: "AUDIO",
      keywords: [
        "headphone", "earphone", "earbuds", "speaker",
        "tws", "bluetooth audio", "soundbar", "microphone",
        "headset", "in-ear", "over-ear", "wireless earphone",
        "wired headphone", "gaming headset",
      ],
      queryEnhancement: "price Bangladesh",
      maxTargeted: 5,
    },
    {
      key: "TV_DISPLAY",
      keywords: [
        "tv", "television", "smart tv", "led tv", "oled",
        "qled", "4k tv", "android tv", "monitor", "display",
        "projector", "walton tv", "minister tv", "singer tv",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 5,
    },
    {
      key: "CAMERAS",
      keywords: [
        "camera", "dslr", "mirrorless", "action camera",
        "gopro", "drone", "lens", "tripod", "memory card",
        "flash", "studio light", "webcam", "dashcam",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 4,
    },
    {
      key: "GAMING",
      keywords: [
        "gaming", "playstation", "ps4", "ps5", "xbox",
        "nintendo", "switch", "controller", "joystick",
        "gaming chair", "gaming desk", "console", "game",
        "pc game", "steam deck",
      ],
      queryEnhancement: "price Bangladesh",
      maxTargeted: 4,
    },
    {
      key: "ACCESSORIES",
      keywords: [
        "case", "cover", "charger", "cable", "adapter",
        "power bank", "screen protector", "tempered glass",
        "stand", "holder", "mount", "usb hub", "type-c",
        "wireless charger", "data cable", "phone case",
        "laptop bag", "backpack", "phone stand",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 5,
    },
    {
      key: "HEALTH_BEAUTY",
      keywords: [
        "face wash", "moisturizer", "serum", "sunscreen",
        "spf", "toner", "cleanser", "makeup", "lipstick",
        "foundation", "mascara", "eyeshadow", "blush",
        "shampoo", "conditioner", "hair oil", "hair mask",
        "body lotion", "body wash", "perfume", "deodorant",
        "skincare", "beauty", "cosmetic", "face mask",
        "eye cream", "lip balm", "micellar water",
        "facial oil", "exfoliant", "aha bha", "retinol",
        "vitamin c serum", "niacinamide", "hyaluronic",
        "skin care", "hair care", "face cream",
      ],
      queryEnhancement: "price Bangladesh buy online",
      maxTargeted: 5,
    },
    {
      key: "MEDICINE",
      keywords: [
        "medicine", "tablet", "capsule", "syrup", "vitamin",
        "supplement", "protein powder", "paracetamol",
        "antibiotic", "antacid", "insulin", "pharmacy",
        "health supplement", "multivitamin", "omega",
        "probiotic", "calcium", "iron supplement",
      ],
      queryEnhancement: "price Bangladesh pharmacy",
      maxTargeted: 3,
    },
    {
      key: "GROCERY",
      keywords: [
        "rice", "flour", "oil", "sugar", "salt", "tea",
        "coffee", "milk", "butter", "cheese", "biscuit",
        "chips", "noodles", "pasta", "cereal", "spice",
        "masala", "dal", "lentil", "grocery", "food",
        "snack", "drink", "beverage", "juice", "mineral water",
        "cooking oil", "mustard oil", "soybean oil",
      ],
      queryEnhancement: "price Bangladesh delivery online",
      maxTargeted: 4,
    },
    {
      key: "FASHION",
      keywords: [
        "shirt", "t-shirt", "panjabi", "punjabi", "kurta",
        "saree", "salwar", "kameez", "dress", "trouser",
        "jeans", "pant", "jacket", "sweater", "hoodie",
        "coat", "hijab", "abaya", "shoes", "sandal",
        "sneaker", "boot", "bag", "purse", "wallet",
        "belt", "watch", "jewelry", "necklace", "bracelet",
        "ring", "earring", "clothing", "fashion", "apparel",
        "eid collection", "festive wear",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 5,
    },
    {
      key: "BOOKS",
      keywords: [
        "book", "novel", "textbook", "guide", "reference",
        "magazine", "comic", "stationery", "pen", "pencil",
        "notebook", "paper", "marker", "highlighter",
        "humayun ahmed", "zafar iqbal", "islamic book",
        "academic", "admission guide",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 3,
    },
    {
      key: "HOME_APPLIANCES",
      keywords: [
        "refrigerator", "fridge", "washing machine",
        "air conditioner", "ac", "fan", "blender", "mixer",
        "rice cooker", "microwave", "oven", "iron",
        "vacuum cleaner", "water purifier", "filter",
        "home appliance", "furniture", "sofa", "bed",
        "mattress", "pillow", "curtain", "blanket", "table",
        "chair", "kitchen", "cookware", "utensil", "pot",
        "pan", "walton", "singer", "rangs", "minister",
        "gree", "general ac", "samsung fridge",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 5,
    },
    {
      key: "SPORTS",
      keywords: [
        "gym", "fitness", "dumbbell", "barbell", "treadmill",
        "cycle", "bicycle", "yoga mat", "whey protein",
        "creatine", "pre-workout", "sports", "cricket",
        "football", "badminton", "tennis", "bat", "ball",
        "racket", "jersey", "running shoes", "sports wear",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 4,
    },
    {
      key: "BABY_KIDS",
      keywords: [
        "baby", "infant", "toddler", "diaper", "pampers",
        "baby food", "formula milk", "stroller", "pram",
        "baby clothing", "toy", "doll", "lego", "puzzle",
        "kids", "children", "baby lotion", "baby shampoo",
        "feeding bottle", "baby oil", "baby powder",
      ],
      queryEnhancement: "price Bangladesh buy",
      maxTargeted: 4,
    },
  ];

  let bestMatch: typeof categories[0] | null = null;
  let bestScore = 0;

  for (const cat of categories) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (q === kw) { score += 10; break; }
      if (q.startsWith(kw + " ")) score += 5;
      if (q.includes(kw)) score += kw.split(" ").length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }

  if (bestMatch && bestScore > 0) {
    return {
      category: bestMatch.key,
      queryEnhancement: bestMatch.queryEnhancement,
    };
  }

  return {
    category: "GENERAL",
    queryEnhancement: "price Bangladesh buy",
  };
}

const EXCLUDED_HOSTS = [
  // Social media — not retailers
  "facebook.com",
  "tiktok.com",
  "scribd.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "reddit.com",
  "quora.com",
  "wikipedia.org",
  "linkedin.com",
  // Classifieds — secondhand, not retail
  "bikroy.com",
  // Review/spec sites — not retailers
  "gsmarena.com",
  "gsmarena.com.bd",
  "kimovil.com",
  "nanoreview.net",
  "phonearena.com",
  "techradar.com",
  "gsmmobil.com",
  "mobiledokan.com.bd",
  // Indian retailers — wrong country
  "amazon.in",
  "flipkart.com",
  "myntra.com",
  "nykaa.com",
  "tirabeauty.com",
  "purplle.com",
  "meesho.com",
  "ajio.com",
  "bigbasket.com",
  "blinkit.com",
  "swiggy.com",
  "zomato.com",
  "gadgets360.com",
  "91mobiles.com",
  // Other non-BD non-retailers
  "gshopper.com",
  "aliexpress.com",
  "ebay.com",
];

type Offer = {
  url: string;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  siteName: string;
  description: string | null;
  suspiciousPrice?: boolean;
};

const scrapeJsonFormat = {
  type: "json" as const,
  prompt:
    "Extract the product information from this product page. Return the product title, the current price as a number (without currency symbols), the ISO currency code (BDT for Bangladeshi Taka, USD for US Dollar, etc — if the price is shown in Bangladeshi Taka or the site is a Bangladeshi retailer, ALWAYS return 'BDT'), the main product image URL, and the merchant/site name. If this is not a product page, return null for price.",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      price: { type: ["number", "null"] },
      currency: { type: "string" },
      imageUrl: { type: "string" },
      siteName: { type: "string" },
    },
  },
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isExcluded(url: string): boolean {
  const h = hostOf(url);
  return EXCLUDED_HOSTS.some((bad) => h === bad || h.endsWith(`.${bad}`));
}

async function runFirecrawlSearch(
  apiKey: string,
  query: string,
  limit: number,
): Promise<Offer[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { onlyMainContent: true, formats: [scrapeJsonFormat] },
    }),
  });
  if (!res.ok) {
    console.error(`Firecrawl search ${res.status}`, await res.text().catch(() => ""));
    return [];
  }
  const payload = (await res.json()) as {
    data?: {
      web?: Array<{
        url?: string;
        title?: string;
        description?: string;
        json?: {
          title?: string;
          price?: number | null;
          currency?: string;
          imageUrl?: string;
          siteName?: string;
        };
        metadata?: { title?: string; ogImage?: string };
      }>;
    };
  };
  const raw = payload.data?.web ?? [];
  return raw
    .map((r): Offer | null => {
      const url = r.url ?? "";
      if (!/^https?:\/\//i.test(url)) return null;
      if (isExcluded(url)) return null;
      const j = r.json ?? {};
      let siteName = j.siteName;
      if (!siteName) {
        const host = hostOf(url);
        siteName = host ? host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()) : "Unknown";
      }
      const isBDHost =
        url.includes(".bd/") ||
        url.includes(".bd?") ||
        url.endsWith(".bd") ||
        CATEGORY_RETAILERS["SMARTPHONES"].some(d => url.includes(d)) ||
        CATEGORY_RETAILERS["HEALTH_BEAUTY"].some(d => url.includes(d)) ||
        CATEGORY_RETAILERS["BOOKS"].some(d => url.includes(d)) ||
        CATEGORY_RETAILERS["GROCERY"].some(d => url.includes(d)) ||
        url.includes("mobiledokan") ||
        url.includes("shajgoj") ||
        url.includes("rokomari") ||
        url.includes("chaldal") ||
        url.includes("arogga") ||
        url.includes("priyoshop") ||
        url.includes("othoba") ||
        url.includes("bagdoom") ||
        url.includes("ajkerdeal") ||
        url.includes("smsgadget");
      const currency = (j.currency && j.currency.toUpperCase() !== "USD"
        ? j.currency
        : isBDHost ? "BDT" : (j.currency ?? "USD")
      ).toUpperCase().slice(0, 3);
      return {
        url,
        title: j.title ?? r.title ?? r.metadata?.title ?? "Untitled",
        price: typeof j.price === "number" ? j.price : null,
        currency,
        imageUrl: j.imageUrl ?? r.metadata?.ogImage ?? null,
        siteName,
        description: r.description ?? null,
      };
    })
    .filter((x): x is Offer => x !== null);
}

export const searchProductOffers = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ query: z.string().min(2).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Search is not configured." };

    try {
      const detected = detectCategory(data.query);
      const categoryRetailers = CATEGORY_RETAILERS[detected.category];

      const primaryQuery = `"${data.query}" ${detected.queryEnhancement}`;

      const primary = await runFirecrawlSearch(apiKey, primaryQuery, 8);

      const presentHosts = new Set(primary.map((o) => hostOf(o.url)));
      const topMissingRetailer = categoryRetailers.find(
        (d) => !Array.from(presentHosts).some((h) => h === d || h.endsWith(`.${d}`)),
      );

      let backup: Offer[] = [];
      if (topMissingRetailer) {
        backup = await runFirecrawlSearch(
          apiKey,
          `"${data.query}" site:${topMissingRetailer}`,
          3,
        );
      }

      const byUrl = new Map<string, Offer>();
      for (const o of [...primary, ...backup]) {
        if (!byUrl.has(o.url)) byUrl.set(o.url, o);
      }
      let offers = Array.from(byUrl.values());

      offers = offers.map((o) => ({
        ...o,
        price: typeof o.price === "number" && o.price > 0 ? o.price : null,
      }));

      offers = offers.filter((o) => o.currency !== "INR");




      const queryWords = data.query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4);

      if (queryWords.length > 0) {
        offers = offers.filter((o) => {
          const titleLower = o.title.toLowerCase();
          return queryWords.some((w) => titleLower.includes(w));
        });
      }

      const bySite = new Map<string, Offer>();
      for (const o of offers) {
        const siteKey = o.siteName.toLowerCase().trim();
        if (!bySite.has(siteKey)) {
          bySite.set(siteKey, o);
        } else {
          const existing = bySite.get(siteKey)!;
          const scoreOffer = queryWords.filter((w) =>
            o.title.toLowerCase().includes(w),
          ).length;
          const scoreExisting = queryWords.filter((w) =>
            existing.title.toLowerCase().includes(w),
          ).length;
          if (
            scoreOffer > scoreExisting ||
            (scoreOffer === scoreExisting && o.price !== null && existing.price === null)
          ) {
            bySite.set(siteKey, o);
          }
        }
      }
      offers = Array.from(bySite.values());

      const isCategoryTrusted = (o: Offer) => {
        const h = hostOf(o.url);
        return categoryRetailers.some((d) => h === d || h.endsWith(`.${d}`));
      };

      const priceKey = (o: Offer) =>
        typeof o.price === "number" && o.price > 0
          ? o.price
          : Number.POSITIVE_INFINITY;

      const trusted = offers
        .filter(isCategoryTrusted)
        .sort((a, b) => priceKey(a) - priceKey(b));
      const rest = offers
        .filter((o) => !isCategoryTrusted(o))
        .sort((a, b) => priceKey(a) - priceKey(b));

      return { ok: true as const, offers: [...trusted, ...rest] };
    } catch (err) {
      console.error("searchProductOffers error:", err);
      return { ok: false as const, error: "Search request failed." };
    }
  });

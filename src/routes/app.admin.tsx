import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Search, ShieldAlert, ExternalLink, CheckCircle2, X, Trash2, Wand2, Link as LinkIcon, AlertTriangle } from "lucide-react";
import {
  checkIsAdmin,
  listAdminData,
  saveCatalogEntry,
  setCatalogVerification,
  deleteCatalogEntry,
  saveCatalogSource,
  deleteCatalogSource,
  setSourceVerified,
  generateSearchKey,
  fetchProductLinks,
} from "@/lib/admin-catalog.functions";
import { scrapeProductFromUrl } from "@/lib/price-scraping.functions";
import { SafeImage } from "@/components/safe-image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Catalog admin — Price Tag" },
      { name: "description", content: "Review, edit and add verified Price Tag catalog products and store listings." },
      { property: "og:title", content: "Catalog admin — Price Tag" },
      { property: "og:description", content: "Review and edit the Price Tag product catalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Product = {
  id: string;
  search_key: string;
  display_name: string;
  category: string;
  image_url: string | null;
  is_active: boolean;
  verification_status: string;
};
type Listing = {
  id: string;
  catalog_id: string;
  site_name: string;
  url: string;
  title: string | null;
  description: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  in_stock: boolean;
  verified: boolean | null;
  last_checked_at: string;
};

const STORES = ["Star Tech", "Gadget & Gear", "MobileDokan.com", "MobileDokan.co", "Dazzle", "Pickaboo", "Ryans", "SMS Gadget"];

const fmtPrice = (p: number | null) => (p && p > 0 ? `৳${Math.round(p).toLocaleString("en-US")}` : "No price");
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
function officialOf(desc: string | null): "Official" | "Unofficial" | null {
  const d = (desc ?? "").toLowerCase();
  if (/\bunofficial\b/.test(d)) return "Unofficial";
  if (/\bofficial\b/.test(d)) return "Official";
  return null;
}
function withOfficial(desc: string, official: boolean): string {
  const clean = desc.replace(/\b(un)?official\b/gi, "").replace(/\s{2,}/g, " ").trim();
  return `${official ? "Official" : "Unofficial"}${clean ? ` · ${clean.replace(/^·\s*/, "")}` : ""}`;
}
const isListingVerified = (l: Listing, p?: Product) => l.verified ?? p?.verification_status === "verified";

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
const bigBtn = "min-h-12 rounded-2xl px-4 text-sm font-semibold disabled:opacity-60";
const primaryBtn = `${bigBtn} bg-primary text-primary-foreground`;
const ghostBtn = `${bigBtn} glass`;

function AdminPage() {
  const isAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listAdminData);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [tab, setTab] = useState<"listings" | "products">("listings");
  const [q, setQ] = useState("");
  const [vFilter, setVFilter] = useState<"all" | "verified" | "unverified">("all");
  const [store, setStore] = useState("");
  const [missingImage, setMissingImage] = useState(false);
  const [missingPrice, setMissingPrice] = useState(false);
  const [editListing, setEditListing] = useState<Listing | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [byLink, setByLink] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listFn();
      setProducts(r.products as Product[]);
      setListings(r.sources as Listing[]);
    } catch {
      toast.error("Could not load the catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    isAdminFn()
      .then((r) => {
        setAllowed(r.isAdmin);
        if (r.isAdmin) void reload();
      })
      .catch(() => setAllowed(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of listings) c[l.catalog_id] = (c[l.catalog_id] ?? 0) + 1;
    return c;
  }, [listings]);
  const storeNames = useMemo(() => Array.from(new Set(listings.map((l) => l.site_name))).sort(), [listings]);

  const needle = q.trim().toLowerCase();
  const filteredListings = listings.filter((l) => {
    const p = byId.get(l.catalog_id);
    if (needle && !`${l.title ?? ""} ${l.site_name} ${p?.display_name ?? ""} ${l.url}`.toLowerCase().includes(needle)) return false;
    const v = isListingVerified(l, p);
    if (vFilter === "verified" && !v) return false;
    if (vFilter === "unverified" && v) return false;
    if (store && l.site_name !== store) return false;
    if (missingImage && l.image_url) return false;
    if (missingPrice && l.price && l.price > 0) return false;
    return true;
  });
  const filteredProducts = products.filter((p) => {
    if (needle && !`${p.display_name} ${p.search_key}`.toLowerCase().includes(needle)) return false;
    if (vFilter === "verified" && p.verification_status !== "verified") return false;
    if (vFilter === "unverified" && p.verification_status === "verified") return false;
    if (missingImage && p.image_url) return false;
    return true;
  });

  if (allowed === null)
    return (
      <main className="grid min-h-[50vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  if (!allowed)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 font-display text-xl font-bold">Admins only</h1>
      </main>
    );

  return (
    <main className="page-enter mx-auto w-full max-w-2xl overflow-x-hidden px-4 pb-32 pt-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">Catalog admin</h1>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["listings", "products"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`${bigBtn} ${tab === t ? "bg-primary text-primary-foreground" : "glass"}`}
          >
            {t === "listings" ? `Store listings (${listings.length})` : `Products (${products.length})`}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-12 pl-9 text-base" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={vFilter}
            onChange={(e) => setVFilter(e.target.value as typeof vFilter)}
            className="h-12 min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
            aria-label="Verification filter"
          >
            <option value="all">All statuses</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
          {tab === "listings" ? (
            <select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="h-12 min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
              aria-label="Store filter"
            >
              <option value="">All stores</option>
              {storeNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <div />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip on={missingImage} onClick={() => setMissingImage((v) => !v)}>Missing image</Chip>
          {tab === "listings" && <Chip on={missingPrice} onClick={() => setMissingPrice((v) => !v)}>Missing price</Chip>}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "listings" ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">{filteredListings.length} listings</p>
          {filteredListings.map((l) => (
            <ListingCard
              key={l.id}
              l={l}
              product={byId.get(l.catalog_id)}
              onOpen={() => setEditListing(l)}
              onChanged={reload}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">{filteredProducts.length} products</p>
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} p={p} count={counts[p.id] ?? 0} onOpen={() => setEditProduct(p)} onChanged={reload} />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 p-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button onClick={() => setByLink(true)} className={`${ghostBtn} flex flex-1 items-center justify-center gap-2`}>
            <LinkIcon className="h-5 w-5" /> Add by link
          </button>
          <button onClick={() => setAdding(true)} className={`${primaryBtn} flex flex-1 items-center justify-center gap-2`}>
            <Plus className="h-5 w-5" /> Add listing
          </button>
        </div>
      </div>

      {editListing && (
        <ListingSheet
          products={products}
          listings={listings}
          initial={editListing}
          onClose={() => setEditListing(null)}
          onSaved={reload}
        />
      )}
      {adding && <ListingSheet products={products} listings={listings} onClose={() => setAdding(false)} onSaved={reload} />}
      {byLink && <LinkSheet products={products} listings={listings} onClose={() => setByLink(false)} onSaved={reload} />}
      {editProduct && <ProductSheet p={editProduct} onClose={() => setEditProduct(null)} onSaved={reload} />}
    </main>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-10 rounded-full px-4 text-sm font-medium ${on ? "bg-primary text-primary-foreground" : "glass"}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ verified, label }: { verified: boolean; label?: string }) {
  return (
    <span className={`${pill} ${verified ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
      {label ?? (verified ? "Verified" : "Unverified")}
    </span>
  );
}

function ListingCard({ l, product, onOpen, onChanged }: { l: Listing; product?: Product; onOpen: () => void; onChanged: () => void }) {
  const verifyFn = useServerFn(setSourceVerified);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const verified = isListingVerified(l, product);
  const official = officialOf(l.description);

  const toggleVerify = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await verifyFn({ data: { id: l.id, verified: !verified } });
      toast.success(verified ? "Unverified" : "Verified");
      onChanged();
    } catch {
      toast.error("Could not update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="button" tabIndex={0} onClick={onOpen} className="glass min-w-0 rounded-2xl p-3 text-left">
      <div className="flex min-w-0 gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/50 p-1">
          <SafeImage src={l.image_url} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-primary">{l.site_name}</span>
            <span className="shrink-0 font-display text-base font-bold">{fmtPrice(l.price)}</span>
          </div>
          <div className="line-clamp-2 break-words text-sm font-medium leading-snug">{l.title || "Untitled"}</div>
          {product && <div className="truncate text-xs text-muted-foreground">{product.display_name}</div>}
        </div>
      </div>
      {l.description && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={`mt-2 block w-full break-words text-left text-xs text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}
        >
          {l.description}
        </button>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`${pill} ${l.in_stock ? "bg-primary/10 text-primary" : "bg-destructive/15 text-destructive"}`}>
          {l.in_stock ? "In stock" : "Out of stock"}
        </span>
        {official && <span className={`${pill} bg-muted text-foreground`}>{official}</span>}
        <StatusPill verified={verified} />
        <span className="text-[11px] text-muted-foreground">Checked {fmtDate(l.last_checked_at)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`${ghostBtn} flex items-center justify-center gap-1.5`}
        >
          <ExternalLink className="h-4 w-4" /> Open link
        </a>
        <button disabled={busy} onClick={toggleVerify} className={`${verified ? ghostBtn : primaryBtn} flex items-center justify-center gap-1.5`}>
          <CheckCircle2 className="h-4 w-4" /> {verified ? "Unverify" : "Verify"}
        </button>
      </div>
    </div>
  );
}

function ProductCard({ p, count, onOpen, onChanged }: { p: Product; count: number; onOpen: () => void; onChanged: () => void }) {
  const verifyFn = useServerFn(setCatalogVerification);
  const [busy, setBusy] = useState(false);
  const verified = p.verification_status === "verified";
  const approve = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await verifyFn({ data: { id: p.id, status: verified ? "pending_review" : "verified" } });
      toast.success(verified ? "Moved to review" : "Approved");
      onChanged();
    } catch {
      toast.error("Could not update");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="button" tabIndex={0} onClick={onOpen} className="glass min-w-0 rounded-2xl p-3">
      <div className="flex min-w-0 gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/50 p-1">
          <SafeImage src={p.image_url} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 break-words font-medium">{p.display_name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`${pill} bg-muted text-foreground`}>{p.category}</span>
            <StatusPill verified={verified} label={p.verification_status.replace("_", " ")} />
            <span className="text-[11px] text-muted-foreground">{count} listings</span>
          </div>
        </div>
      </div>
      <button disabled={busy} onClick={approve} className={`${verified ? ghostBtn : primaryBtn} mt-3 flex w-full items-center justify-center gap-1.5`}>
        <CheckCircle2 className="h-4 w-4" /> {verified ? "Unverify" : "Approve"}
      </button>
    </div>
  );
}

function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="truncate font-display text-lg font-bold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full glass">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4">{children}</div>
      </div>
      <div className="border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">{footer}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function ImagePreview({ url }: { url: string }) {
  return (
    <div className="mt-2 h-32 w-32 overflow-hidden rounded-2xl bg-white/50 p-2">
      <SafeImage src={url || null} iconClassName="h-8 w-8" />
    </div>
  );
}

function ConfirmDelete({ open, onOpenChange, onConfirm, what }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void; what: string }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {what}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-12">Cancel</AlertDialogCancel>
          <AlertDialogAction className="min-h-12 bg-destructive text-destructive-foreground" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ListingSheet({
  products,
  listings,
  initial,
  onClose,
  onSaved,
}: {
  products: Product[];
  listings: Listing[];
  initial?: Listing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saveFn = useServerFn(saveCatalogSource);
  const saveProductFn = useServerFn(saveCatalogEntry);
  const deleteFn = useServerFn(deleteCatalogSource);
  const scrapeFn = useServerFn(scrapeProductFromUrl);

  const initialStore = initial?.site_name ?? STORES[0];
  const [productId, setProductId] = useState(initial?.catalog_id ?? "");
  const [productQ, setProductQ] = useState("");
  const [newProduct, setNewProduct] = useState(false);
  const [np, setNp] = useState({ name: "", image: "", category: "SMARTPHONES" });
  const [storeSel, setStoreSel] = useState(STORES.includes(initialStore) ? initialStore : "Other");
  const [otherStore, setOtherStore] = useState(STORES.includes(initialStore) ? "" : initialStore);
  const [url, setUrl] = useState(initial?.url ?? "");
  const [price, setPrice] = useState(initial?.price ? String(Math.round(initial.price)) : "");
  const [inStock, setInStock] = useState(initial?.in_stock ?? true);
  const [official, setOfficial] = useState(officialOf(initial?.description ?? null) !== "Unofficial");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [image, setImage] = useState(initial?.image_url ?? "");
  const [verified, setVerified] = useState(initial ? isListingVerified(initial, products.find((p) => p.id === initial.catalog_id)) : true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [firecrawlOn, setFirecrawlOn] = useState(false);
  const [confirmFetch, setConfirmFetch] = useState(false);
  const [fetching, setFetching] = useState(false);

  const productMatches = products
    .filter((p) => !productQ.trim() || p.display_name.toLowerCase().includes(productQ.trim().toLowerCase()))
    .slice(0, 8);
  const selectedProduct = products.find((p) => p.id === productId);
  const storeName = storeSel === "Other" ? otherStore.trim() : storeSel;
  const duplicate =
    !!productId &&
    url.trim() !== "" &&
    listings.some((l) => l.catalog_id === productId && l.url.trim() === url.trim() && l.id !== initial?.id);

  const save = async (addAnother: boolean) => {
    const priceNum = Number(price);
    if (!price.trim() || !Number.isFinite(priceNum) || priceNum <= 0) return toast.error("Enter a price above 0");
    if (!/^https?:\/\//i.test(url.trim())) return toast.error("Enter a link starting with https://");
    if (!storeName) return toast.error("Enter a store name");
    if (image && !/^https?:\/\//i.test(image.trim())) return toast.error("Image link must start with https://");
    setSaving(true);
    try {
      let catalogId = productId;
      if (!initial && newProduct) {
        if (np.name.trim().length < 2) {
          setSaving(false);
          return toast.error("Enter the product name");
        }
        const r = await saveProductFn({
          data: { displayName: np.name.trim(), category: np.category || "SMARTPHONES", imageUrl: np.image.trim(), isActive: true },
        });
        catalogId = r.id;
      }
      if (!catalogId) {
        setSaving(false);
        return toast.error("Choose a product");
      }
      await saveFn({
        data: {
          id: initial?.id,
          catalogId,
          siteName: storeName,
          url: url.trim(),
          title: title.trim() || null,
          description: withOfficial(description, official),
          price: priceNum,
          currency: "BDT",
          imageUrl: image.trim(),
          inStock,
          verified,
        },
      });
      toast.success("Saved");
      onSaved();
      if (addAnother) {
        setProductId(catalogId);
        setNewProduct(false);
        setUrl("");
        setPrice("");
        setTitle("");
        setDescription("");
        setImage("");
        setInStock(true);
      } else onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const runFetch = async () => {
    setConfirmFetch(false);
    setFetching(true);
    try {
      const r = await scrapeFn({ data: { url: url.trim(), confirmed: true } });
      if (!r.ok) return toast.error(r.error);
      if (r.title) setTitle(r.title);
      if (typeof r.price === "number" && r.price > 0) setPrice(String(Math.round(r.price)));
      if (r.imageUrl) setImage(r.imageUrl);
      toast.success("Fetched — check the details before saving");
    } catch {
      toast.error("Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  return (
    <Sheet
      title={initial ? "Edit listing" : "Add listing"}
      onClose={onClose}
      footer={
        initial ? (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmDelete(true)} className={`${ghostBtn} flex items-center justify-center gap-1.5 text-destructive`}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <button disabled={saving} onClick={() => save(false)} className={primaryBtn}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={saving} onClick={() => save(true)} className={ghostBtn}>
              Save & add another
            </button>
            <button disabled={saving} onClick={() => save(false)} className={primaryBtn}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )
      }
    >
      <section className="space-y-2">
        <div className="text-sm font-medium">Product</div>
        {selectedProduct && !newProduct ? (
          <div className="glass flex min-w-0 items-center gap-3 rounded-2xl p-2">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/50 p-1">
              <SafeImage src={selectedProduct.image_url} />
            </div>
            <div className="min-w-0 flex-1 truncate font-medium">{selectedProduct.display_name}</div>
            {!initial && (
              <button onClick={() => setProductId("")} className="min-h-11 shrink-0 rounded-xl px-3 text-sm text-primary">
                Change
              </button>
            )}
          </div>
        ) : !initial && newProduct ? (
          <div className="glass space-y-3 rounded-2xl p-3">
            <Field label="Product name">
              <Input className="h-12 text-base" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. CMF Phone 2 Pro" />
            </Field>
            {np.name.trim() && <p className="break-words text-xs text-muted-foreground">Search key: {generateSearchKey(np.name)}</p>}
            <Field label="Category">
              <Input className="h-12 text-base" value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Product image URL">
              <Input className="h-12 text-base" value={np.image} onChange={(e) => setNp({ ...np, image: e.target.value })} placeholder="https://…" />
              <ImagePreview url={np.image} />
            </Field>
            <button onClick={() => setNewProduct(false)} className="min-h-11 text-sm text-primary">
              Pick an existing product instead
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input className="h-12 text-base" value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Search products…" />
            <div className="space-y-1">
              {productMatches.map((p) => (
                <button key={p.id} onClick={() => setProductId(p.id)} className="glass flex min-h-12 w-full min-w-0 items-center gap-2 rounded-xl px-3 text-left">
                  <span className="min-w-0 flex-1 truncate text-sm">{p.display_name}</span>
                  {p.verification_status !== "verified" && <StatusPill verified={false} />}
                </button>
              ))}
            </div>
            <button onClick={() => setNewProduct(true)} className={`${ghostBtn} flex w-full items-center justify-center gap-1.5`}>
              <Plus className="h-4 w-4" /> New product
            </button>
          </div>
        )}
      </section>

      <Field label="Store">
        <select value={storeSel} onChange={(e) => setStoreSel(e.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base">
          {STORES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="Other">Other</option>
        </select>
        {storeSel === "Other" && (
          <Input className="mt-2 h-12 text-base" value={otherStore} onChange={(e) => setOtherStore(e.target.value)} placeholder="Store name" />
        )}
      </Field>

      <Field label="Product URL">
        <Input className="h-12 text-base" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        {duplicate && <p className="mt-1 text-xs font-medium text-destructive">This link already exists for this product.</p>}
      </Field>

      <Field label="Price (BDT ৳)">
        <Input className="h-12 text-base" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 32999" />
      </Field>

      <div className="glass flex min-h-14 items-center justify-between rounded-2xl px-4">
        <span className="text-sm font-medium">In stock</span>
        <Switch checked={inStock} onCheckedChange={setInStock} />
      </div>
      <div className="glass flex min-h-14 items-center justify-between rounded-2xl px-4">
        <span className="text-sm font-medium">{official ? "Official" : "Unofficial"}</span>
        <Switch checked={official} onCheckedChange={setOfficial} />
      </div>
      <div className="glass flex min-h-14 items-center justify-between rounded-2xl px-4">
        <span className="text-sm font-medium">Verified</span>
        <Switch checked={verified} onCheckedChange={setVerified} />
      </div>

      <Field label="Title">
        <Input className="h-12 text-base" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea className="min-h-24 text-base" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Image URL">
        <Input className="h-12 text-base" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
        <ImagePreview url={image} />
      </Field>

      <div className="glass space-y-3 rounded-2xl p-3">
        <div className="flex min-h-11 items-center justify-between">
          <span className="text-sm font-medium">Firecrawl tools (uses credits)</span>
          <Switch checked={firecrawlOn} onCheckedChange={setFirecrawlOn} />
        </div>
        {firecrawlOn && (
          <button
            disabled={fetching || !/^https?:\/\//i.test(url.trim())}
            onClick={() => setConfirmFetch(true)}
            className={`${ghostBtn} flex w-full items-center justify-center gap-1.5`}
          >
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Fetch with Firecrawl
          </button>
        )}
      </div>

      <AlertDialog open={confirmFetch} onOpenChange={setConfirmFetch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use Firecrawl credits?</AlertDialogTitle>
            <AlertDialogDescription>This fetches the page with Firecrawl and uses credits from your plan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction className="min-h-12" onClick={runFetch}>Use credits</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {initial && (
        <ConfirmDelete
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          what="this listing"
          onConfirm={async () => {
            try {
              await deleteFn({ data: { id: initial.id } });
              toast.success("Deleted");
              onSaved();
              onClose();
            } catch {
              toast.error("Could not delete");
            }
          }}
        />
      )}
    </Sheet>
  );
}

function ProductSheet({ p, onClose, onSaved }: { p: Product; onClose: () => void; onSaved: () => void }) {
  const saveFn = useServerFn(saveCatalogEntry);
  const verifyFn = useServerFn(setCatalogVerification);
  const deleteFn = useServerFn(deleteCatalogEntry);
  const [name, setName] = useState(p.display_name);
  const [category, setCategory] = useState(p.category);
  const [image, setImage] = useState(p.image_url ?? "");
  const [active, setActive] = useState(p.is_active);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const verified = p.verification_status === "verified";

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({ data: { id: p.id, searchKey: p.search_key, displayName: name.trim(), category, imageUrl: image.trim(), isActive: active } });
      toast.success("Saved");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Edit product"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setConfirmDelete(true)} className={`${ghostBtn} text-destructive`}>Delete</button>
          <button
            onClick={async () => {
              await verifyFn({ data: { id: p.id, status: verified ? "pending_review" : "verified" } });
              toast.success(verified ? "Unverified" : "Verified");
              onSaved();
              onClose();
            }}
            className={ghostBtn}
          >
            {verified ? "Unverify" : "Verify"}
          </button>
          <button disabled={saving} onClick={save} className={primaryBtn}>{saving ? "…" : "Save"}</button>
        </div>
      }
    >
      <Field label="Name">
        <Input className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <p className="break-words text-xs text-muted-foreground">Search key: {p.search_key}</p>
      <Field label="Category">
        <Input className="h-12 text-base" value={category} onChange={(e) => setCategory(e.target.value.toUpperCase())} />
      </Field>
      <Field label="Image URL">
        <Input className="h-12 text-base" value={image} onChange={(e) => setImage(e.target.value)} />
        <ImagePreview url={image} />
      </Field>
      <div className="glass flex min-h-14 items-center justify-between rounded-2xl px-4">
        <span className="text-sm font-medium">Shown in search</span>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>
      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        what="this product and all its listings"
        onConfirm={async () => {
          await deleteFn({ data: { id: p.id } });
          toast.success("Deleted");
          onSaved();
          onClose();
        }}
      />
    </Sheet>
  );
}

type LinkDraft = {
  url: string;
  error?: string;
  warning: string | null;
  productId: string;
  name: string;
  category: string;
  store: string;
  price: string;
  image: string;
  title: string;
  description: string;
  inStock: boolean;
  status?: { kind: "added" | "updated" | "skipped"; reason?: string };
};

function suggestProduct(products: Product[], title: string): string {
  const key = generateSearchKey(title);
  const exact = products.find((p) => p.search_key === key);
  if (exact) return exact.id;
  const tw = new Set(key.split(" "));
  let best = "";
  let bestScore = 0;
  for (const p of products) {
    const pw = p.search_key.split(" ").filter(Boolean);
    if (pw.length === 0 || !pw.every((w) => tw.has(w))) continue;
    if (pw.length > bestScore) {
      bestScore = pw.length;
      best = p.id;
    }
  }
  return best;
}

function LinkSheet({ products, listings, onClose, onSaved }: { products: Product[]; listings: Listing[]; onClose: () => void; onSaved: () => void }) {
  const fetchFn = useServerFn(fetchProductLinks);
  const saveProductFn = useServerFn(saveCatalogEntry);
  const saveFn = useServerFn(saveCatalogSource);
  const [text, setText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [drafts, setDrafts] = useState<LinkDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);

  // Keep work safe if the phone reloads the tab.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { text?: string; drafts?: LinkDraft[] };
        if (s.text) setText(s.text);
        if (s.drafts?.length) setDrafts(s.drafts);
      }
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      if (!text && drafts.length === 0) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, drafts }));
    } catch {
      /* ignore */
    }
  }, [text, drafts, restored]);

  const pasteClip = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) return toast.error("Clipboard is empty");
      setText((t) => (t.trim() ? `${t.trim()}\n${clip.trim()}` : clip.trim()));
    } catch {
      toast.error("Allow clipboard access, or long-press to paste");
    }
  };

  const urls = text.split(/\s+/).map((s) => s.trim()).filter(Boolean);

  const runFetch = async () => {
    if (urls.length === 0) return toast.error("Paste at least one link");
    if (urls.length > 10) return toast.error("Up to 10 links per run");
    setFetching(true);
    try {
      const { results } = await fetchFn({ data: { urls } });
      setDrafts(
        results.map((r: any): LinkDraft => {
          if (!r.ok) {
            return { url: r.url, error: r.error, warning: null, productId: "", name: "", category: "SMARTPHONES", store: "", price: "", image: "", title: "", description: "", inStock: true };
          }
          const warning = r.looksListing
            ? "Looks like a category or search page"
            : r.expectedPrice
              ? "Price is labelled expected/upcoming"
              : !r.price
                ? "No price found"
                : null;
          const desc = [r.official, (r.variants as string[]).join(", ")].filter(Boolean).join(" · ");
          return {
            url: r.url,
            warning,
            productId: suggestProduct(products, r.title),
            name: r.title,
            category: "SMARTPHONES",
            store: r.store,
            price: warning || !r.price ? "" : String(r.price),
            image: r.imageUrl,
            title: r.title,
            description: desc,
            inStock: r.inStock,
          };
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  const update = (i: number, patch: Partial<LinkDraft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const canSave = (d: LinkDraft) => !d.error && !d.status && Number(d.price) > 0 && (!!d.productId || d.name.trim().length >= 2) && !!d.store.trim();

  const saveOne = async (i: number, d: LinkDraft) => {
    try {
      let catalogId = d.productId;
      if (!catalogId) {
        const key = generateSearchKey(d.name);
        const existing = products.find((p) => p.search_key === key);
        catalogId = existing
          ? existing.id
          : (await saveProductFn({ data: { displayName: d.name.trim(), category: d.category || "SMARTPHONES", imageUrl: d.image, isActive: true } })).id;
      }
      const dup = listings.find((l) => l.catalog_id === catalogId && l.url === d.url);
      await saveFn({
        data: {
          id: dup?.id,
          catalogId,
          siteName: d.store.trim(),
          url: d.url,
          title: d.title || null,
          description: d.description || null,
          inStock: d.inStock,
          verified: true,
          price: Number(d.price),
          currency: "BDT",
          imageUrl: d.image,
        },
      });
      update(i, { status: { kind: dup ? "updated" : "added" }, productId: catalogId });
      const next = drafts.findIndex((x, j) => j > i && !x.status && !x.error);
      if (next >= 0) setTimeout(() => document.getElementById(`draft-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) {
      update(i, { status: { kind: "skipped", reason: e instanceof Error ? e.message : "Could not save" } });
    }
  };

  const saveAll = async () => {
    setBusy(true);
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (d.status) continue;
      if (!canSave(d)) {
        update(i, { status: { kind: "skipped", reason: d.error ?? d.warning ?? "Missing price, product or store" } });
        continue;
      }
      await saveOne(i, d);
    }
    setBusy(false);
    onSaved();
  };

  const done = drafts.filter((d) => d.status);

  return (
    <Sheet
      title="Add by link"
      onClose={onClose}
      footer={
        drafts.length === 0 ? (
          <button onClick={runFetch} disabled={fetching} className={`${primaryBtn} flex w-full items-center justify-center gap-2`}>
            {fetching ? <Loader2 className="h-5 w-5 animate-spin" /> : <LinkIcon className="h-5 w-5" />} Fetch
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setDrafts([])} disabled={busy} className={`${ghostBtn} flex-1`}>New links</button>
            <button onClick={saveAll} disabled={busy} className={`${primaryBtn} flex flex-1 items-center justify-center gap-2`}>
              {busy && <Loader2 className="h-5 w-5 animate-spin" />} Save all valid
            </button>
          </div>
        )
      }
    >
      {drafts.length === 0 ? (
        <Field label="Product links (one per line, max 10)">
          <button type="button" onClick={pasteClip} className={`${ghostBtn} mb-2 flex w-full items-center justify-center gap-2`}>
            <ClipboardPaste className="h-5 w-5" /> Paste from clipboard
          </button>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} inputMode="url" placeholder="https://www.startech.com.bd/..." className="min-h-48 text-base" />
          {text && (
            <button type="button" onClick={() => setText("")} className="mt-2 text-xs font-medium text-muted-foreground">Clear</button>
          )}
        </Field>
      ) : (
        <>
          {done.length > 0 && (
            <div className="glass rounded-2xl p-3 text-sm">
              <p className="font-semibold">
                {done.filter((d) => d.status?.kind === "added").length} added · {done.filter((d) => d.status?.kind === "updated").length} updated ·{" "}
                {done.filter((d) => d.status?.kind === "skipped").length} skipped
              </p>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {done.map((d, i) => (
                  <li key={d.url + i} className="break-all">
                    <span className="font-medium text-foreground">{d.status?.kind}</span> — {d.url}
                    {d.status?.reason ? ` (${d.status.reason})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {drafts.map((d, i) => (
            <div key={d.url + i} id={`draft-${i}`} className={`glass space-y-3 rounded-2xl p-3 ${d.status ? "opacity-60" : ""}`}>
              <p className="break-all text-xs text-muted-foreground">{d.url}</p>
              {(() => {
                const ex = listings.find((l) => l.url.trim() === d.url.trim());
                return ex ? (
                  <p className="rounded-xl bg-primary/10 p-2 text-xs font-medium text-primary">
                    Already in catalog at {fmtPrice(ex.price)}
                    {Number(d.price) > 0 ? ` — saving updates it to ${fmtPrice(Number(d.price))}` : ""}
                  </p>
                ) : null;
              })()}
              {!d.error && <SpecBadges title={d.title} description={d.description} inStock={d.inStock} />}
              {d.error ? (
                <p className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" /> {d.error}</p>
              ) : (
                <>
                  {d.warning && (
                    <p className="flex items-center gap-2 rounded-xl bg-destructive/10 p-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" /> {d.warning} — type the price by hand to save.
                    </p>
                  )}
                  <Field label="Product">
                    <Picker
                      value={d.productId}
                      onChange={(v) => update(i, { productId: v })}
                      options={[{ value: "", label: "New product" }, ...products.map((p) => ({ value: p.id, label: p.display_name }))]}
                    />
                  </Field>
                  {!d.productId && (
                    <>
                      <Field label="Display name">
                        <Input className="h-12 text-base" value={d.name} onChange={(e) => update(i, { name: e.target.value })} />
                      </Field>
                      <Field label="Category">
                        <Input className="h-12 text-base" value={d.category} onChange={(e) => update(i, { category: e.target.value })} />
                      </Field>
                    </>
                  )}
                  <Field label="Store">
                    <Input className="h-12 text-base" value={d.store} onChange={(e) => update(i, { store: e.target.value })} />
                  </Field>
                  <Field label="Price (BDT)">
                    <Input className="h-12 text-base" inputMode="numeric" value={d.price} onChange={(e) => update(i, { price: e.target.value.replace(/[^\d]/g, "") })} />
                  </Field>
                  <Field label="Image URL">
                    <Input className="h-12 text-base" value={d.image} onChange={(e) => update(i, { image: e.target.value })} />
                    <ImagePreview url={d.image} />
                  </Field>
                  <Field label="Listing title">
                    <Input className="h-12 text-base" value={d.title} onChange={(e) => update(i, { title: e.target.value })} />
                  </Field>
                  <Field label="Description">
                    <Textarea className="text-base" rows={2} value={d.description} onChange={(e) => update(i, { description: e.target.value })} />
                  </Field>
                  <div className="flex min-h-12 items-center justify-between">
                    <span className="text-sm font-medium">In stock</span>
                    <Switch checked={d.inStock} onCheckedChange={(v) => update(i, { inStock: v })} />
                  </div>
                  {d.status ? (
                    <p className="text-sm font-semibold">{d.status.kind}{d.status.reason ? ` — ${d.status.reason}` : ""}</p>
                  ) : (
                    <button
                      disabled={!canSave(d) || busy}
                      onClick={async () => {
                        setBusy(true);
                        await saveOne(i, d);
                        setBusy(false);
                        onSaved();
                      }}
                      className={`${primaryBtn} w-full`}
                    >
                      Save
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Store, Search, ShieldAlert, ExternalLink } from "lucide-react";
import {
  checkIsAdmin,
  listCatalogEntries,
  listCatalogSources,
  saveCatalogEntry,
  setCatalogEntryActive,
  deleteCatalogEntry,
  saveCatalogSource,
  deleteCatalogSource,
} from "@/lib/admin-catalog.functions";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      { title: "Catalog admin — Price Tube" },
      {
        name: "description",
        content: "Manage the cached Price Tube product catalog: add, edit, deactivate entries and their store listings.",
      },
      { property: "og:title", content: "Catalog admin — Price Tube" },
      {
        property: "og:description",
        content: "Manage the cached Price Tube product catalog and its store listings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Entry = {
  id: string;
  search_key: string;
  display_name: string;
  category: string;
  image_url: string | null;
  is_active: boolean;
  search_count: number;
  last_refreshed_at: string;
  sourceCount: number;
};

type Source = {
  id: string;
  site_name: string;
  url: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  last_checked_at: string;
};

const emptyEntry = { searchKey: "", displayName: "", category: "GENERAL", imageUrl: "", isActive: true };
const emptySource = { siteName: "", url: "", title: "", price: "", currency: "BDT", imageUrl: "" };

function AdminPage() {
  const isAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listCatalogEntries);
  const sourcesFn = useServerFn(listCatalogSources);
  const saveEntryFn = useServerFn(saveCatalogEntry);
  const toggleFn = useServerFn(setCatalogEntryActive);
  const removeEntryFn = useServerFn(deleteCatalogEntry);
  const saveSourceFn = useServerFn(saveCatalogSource);
  const removeSourceFn = useServerFn(deleteCatalogSource);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");

  const [entryForm, setEntryForm] = useState<typeof emptyEntry & { id?: string }>(emptyEntry);
  const [entryOpen, setEntryOpen] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);

  const [sourcesFor, setSourcesFor] = useState<Entry | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourceForm, setSourceForm] = useState<typeof emptySource & { id?: string }>(emptySource);
  const [savingSource, setSavingSource] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await listFn({ data: { search: search.trim() || undefined } });
      setEntries(res.entries as Entry[]);
    } catch {
      toast.error("Could not load the catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { isAdmin } = await isAdminFn({ data: undefined });
        setAllowed(isAdmin);
        if (isAdmin) await refresh();
        else setLoading(false);
      } catch {
        setAllowed(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSources = async (entry: Entry) => {
    setSourcesFor(entry);
    setSourceForm(emptySource);
    setSourcesLoading(true);
    try {
      const res = await sourcesFn({ data: { catalogId: entry.id } });
      setSources(res.sources as Source[]);
    } catch {
      toast.error("Could not load store listings.");
    } finally {
      setSourcesLoading(false);
    }
  };

  const submitEntry = async () => {
    setSavingEntry(true);
    try {
      await saveEntryFn({
        data: {
          id: entryForm.id,
          searchKey: entryForm.searchKey,
          displayName: entryForm.displayName,
          category: entryForm.category,
          imageUrl: entryForm.imageUrl,
          isActive: entryForm.isActive,
        },
      });
      toast.success(entryForm.id ? "Entry updated" : "Entry added");
      setEntryOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the entry.");
    } finally {
      setSavingEntry(false);
    }
  };

  const submitSource = async () => {
    if (!sourcesFor) return;
    setSavingSource(true);
    try {
      const priceValue = sourceForm.price.trim() === "" ? null : Number(sourceForm.price);
      if (priceValue !== null && Number.isNaN(priceValue)) throw new Error("Price must be a number");
      await saveSourceFn({
        data: {
          id: sourceForm.id,
          catalogId: sourcesFor.id,
          siteName: sourceForm.siteName,
          url: sourceForm.url,
          title: sourceForm.title,
          price: priceValue,
          currency: sourceForm.currency,
          imageUrl: sourceForm.imageUrl,
        },
      });
      toast.success(sourceForm.id ? "Listing updated" : "Listing added");
      setSourceForm(emptySource);
      await openSources(sourcesFor);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the listing.");
    } finally {
      setSavingSource(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: entries.length,
      active: entries.filter((e) => e.is_active).length,
      listings: entries.reduce((n, e) => n + e.sourceCount, 0),
    }),
    [entries],
  );

  if (allowed === false) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="glass-strong rounded-3xl p-8">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 font-display text-xl font-semibold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This account doesn&apos;t have catalog admin access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Catalog admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add, edit and deactivate cached products, and manage their store listings.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Entries", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Listings", value: stats.listings },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl px-3 py-3 text-center">
            <div className="font-display text-xl font-semibold">{s.value}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh()}
            placeholder="Filter by product name"
            aria-label="Filter catalog entries"
            className="glass-inset h-11 rounded-full border-white/40 pl-9"
          />
        </div>
        <button
          onClick={() => {
            setEntryForm(emptyEntry);
            setEntryOpen(true);
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 text-sm font-medium text-primary-foreground shadow-md transition hover:shadow-lg"
        >
          <Plus className="h-4 w-4" /> New entry
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="glass mt-6 rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No catalog entries yet.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="glass flex flex-col gap-3 overflow-hidden rounded-2xl p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/70 p-1">
                  {entry.image_url ? (
                    <img src={entry.image_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <Store className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{entry.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {entry.category} · {entry.sourceCount} listings · {entry.search_count} searches
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <Switch
                  checked={entry.is_active}
                  aria-label="Active"
                  onCheckedChange={async (v) => {
                    setEntries((prev) =>
                      prev.map((e) => (e.id === entry.id ? { ...e, is_active: v } : e)),
                    );
                    try {
                      await toggleFn({ data: { id: entry.id, isActive: v } });
                    } catch {
                      toast.error("Could not update status.");
                      await refresh();
                    }
                  }}
                />
                <button
                  onClick={() => openSources(entry)}
                  className="grid h-11 w-11 place-items-center rounded-full glass-inset text-muted-foreground transition hover:text-foreground"
                  aria-label="Manage store listings"
                >
                  <Store className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setEntryForm({
                      id: entry.id,
                      searchKey: entry.search_key,
                      displayName: entry.display_name,
                      category: entry.category,
                      imageUrl: entry.image_url ?? "",
                      isActive: entry.is_active,
                    });
                    setEntryOpen(true);
                  }}
                  className="grid h-11 w-11 place-items-center rounded-full glass-inset text-muted-foreground transition hover:text-foreground"
                  aria-label="Edit entry"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(entry)}
                  className="grid h-11 w-11 place-items-center rounded-full glass-inset text-destructive transition hover:bg-destructive/10"
                  aria-label="Delete entry"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entry editor */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="glass-strong max-w-md overflow-hidden rounded-3xl border-white/40">
          <DialogHeader>
            <DialogTitle>{entryForm.id ? "Edit entry" : "New entry"}</DialogTitle>
            <DialogDescription>
              The search key is what user queries are matched against.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={entryForm.displayName}
              onChange={(e) => setEntryForm({ ...entryForm, displayName: e.target.value })}
              placeholder="Display name"
              aria-label="Display name"
              className="glass-inset h-11 rounded-xl border-white/40"
            />
            <Input
              value={entryForm.searchKey}
              onChange={(e) => setEntryForm({ ...entryForm, searchKey: e.target.value })}
              placeholder="Search key (lowercase)"
              aria-label="Search key"
              className="glass-inset h-11 rounded-xl border-white/40"
            />
            <Input
              value={entryForm.category}
              onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}
              placeholder="Category"
              aria-label="Category"
              className="glass-inset h-11 rounded-xl border-white/40"
            />
            <Input
              value={entryForm.imageUrl}
              onChange={(e) => setEntryForm({ ...entryForm, imageUrl: e.target.value })}
              placeholder="Image URL (optional)"
              aria-label="Image URL"
              className="glass-inset h-11 rounded-xl border-white/40"
            />
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={entryForm.isActive}
                onCheckedChange={(v) => setEntryForm({ ...entryForm, isActive: v })}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <button
              onClick={submitEntry}
              disabled={savingEntry}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-sm font-medium text-primary-foreground shadow-md disabled:opacity-60"
            >
              {savingEntry && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sources manager */}
      <Dialog open={!!sourcesFor} onOpenChange={(o) => !o && setSourcesFor(null)}>
        <DialogContent className="glass-strong max-h-[85vh] max-w-lg overflow-y-auto overflow-x-hidden rounded-3xl border-white/40">
          <DialogHeader>
            <DialogTitle className="truncate">{sourcesFor?.display_name}</DialogTitle>
            <DialogDescription>Store listings cached for this product.</DialogDescription>
          </DialogHeader>

          {sourcesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {sources.length === 0 && (
                <div className="text-sm text-muted-foreground">No listings yet.</div>
              )}
              {sources.map((s) => (
                <div key={s.id} className="glass-inset flex items-center gap-2 rounded-xl p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.site_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.price != null && s.price > 0
                        ? `${s.currency ?? "BDT"} ${Math.round(s.price).toLocaleString()}`
                        : "Price unavailable"}
                    </div>
                  </div>
                  <a
                    href={/^https?:\/\//i.test(s.url) ? s.url : "#"}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                    aria-label={`Open ${s.site_name}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() =>
                      setSourceForm({
                        id: s.id,
                        siteName: s.site_name,
                        url: s.url,
                        title: s.title ?? "",
                        price: s.price == null ? "" : String(s.price),
                        currency: s.currency ?? "BDT",
                        imageUrl: s.image_url ?? "",
                      })
                    }
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                    aria-label="Edit listing"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await removeSourceFn({ data: { id: s.id } });
                        toast.success("Listing removed");
                        if (sourcesFor) await openSources(sourcesFor);
                        await refresh();
                      } catch {
                        toast.error("Could not remove the listing.");
                      }
                    }}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                    aria-label="Delete listing"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-2 rounded-2xl glass-inset p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {sourceForm.id ? "Edit listing" : "Add listing"}
            </div>
            <Input
              value={sourceForm.siteName}
              onChange={(e) => setSourceForm({ ...sourceForm, siteName: e.target.value })}
              placeholder="Store name"
              aria-label="Store name"
              className="h-10 rounded-xl border-white/40 bg-white/70"
            />
            <Input
              value={sourceForm.url}
              onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
              placeholder="https://store.com/product"
              aria-label="Product URL"
              className="h-10 rounded-xl border-white/40 bg-white/70"
            />
            <Input
              value={sourceForm.title}
              onChange={(e) => setSourceForm({ ...sourceForm, title: e.target.value })}
              placeholder="Listing title (optional)"
              aria-label="Listing title"
              className="h-10 rounded-xl border-white/40 bg-white/70"
            />
            <div className="flex gap-2">
              <Input
                value={sourceForm.price}
                onChange={(e) => setSourceForm({ ...sourceForm, price: e.target.value })}
                placeholder="Price"
                inputMode="decimal"
                aria-label="Price"
                className="h-10 rounded-xl border-white/40 bg-white/70"
              />
              <Input
                value={sourceForm.currency}
                onChange={(e) => setSourceForm({ ...sourceForm, currency: e.target.value })}
                placeholder="BDT"
                aria-label="Currency"
                className="h-10 w-24 rounded-xl border-white/40 bg-white/70"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={submitSource}
                disabled={savingSource}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-brand-gradient text-sm font-medium text-primary-foreground shadow-md disabled:opacity-60"
              >
                {savingSource && <Loader2 className="h-4 w-4 animate-spin" />}
                {sourceForm.id ? "Update listing" : "Add listing"}
              </button>
              {sourceForm.id && (
                <button
                  onClick={() => setSourceForm(emptySource)}
                  className="h-10 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-strong rounded-3xl border-white/40">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete catalog entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleteTarget?.display_name}” and all of its cached store listings. Tracked
              products in your dashboard are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await removeEntryFn({ data: { id: deleteTarget.id } });
                  toast.success("Entry deleted");
                  setDeleteTarget(null);
                  await refresh();
                } catch {
                  toast.error("Could not delete the entry.");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

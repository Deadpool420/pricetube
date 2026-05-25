import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Link as LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { scrapeProductFromUrl } from "@/lib/price-scraping.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/add")({
  component: AddProduct,
});

function AddProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrape = useServerFn(scrapeProductFromUrl);

  const [name, setName] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const updateUrl = (i: number, v: string) =>
    setUrls((u) => u.map((x, idx) => (idx === i ? v : x)));
  const addRow = () => setUrls((u) => [...u, ""]);
  const removeRow = (i: number) => setUrls((u) => u.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
    if (cleanUrls.length === 0) {
      toast.error("Add at least one product URL");
      return;
    }

    setSaving(true);
    try {
      // Scrape all URLs in parallel
      toast.message("Scraping prices…");
      const scraped = await Promise.all(
        cleanUrls.map((url) => scrape({ data: { url } }).then((r) => ({ url, ...r }))),
      );

      const successful = scraped.filter((s) => s.ok);
      if (successful.length === 0) {
        toast.error("Couldn't fetch any prices. Check the URLs and try again.");
        setSaving(false);
        return;
      }

      const productName =
        name.trim() ||
        (successful[0].ok ? successful[0].title : "Untitled product");
      const imageUrl = successful.find((s) => s.ok && s.imageUrl)?.imageUrl ?? null;

      const { data: product, error: productErr } = await supabase
        .from("products")
        .insert({ user_id: user.id, name: productName, image_url: imageUrl })
        .select()
        .single();
      if (productErr) throw productErr;

      const sourceRows = successful.map((s) => ({
        product_id: product.id,
        user_id: user.id,
        site_name: s.ok ? s.siteName : "Unknown",
        url: s.url,
        current_price: s.ok ? s.price : null,
        currency: s.ok ? s.currency : "USD",
        last_checked_at: new Date().toISOString(),
      }));

      const { data: insertedSources, error: srcErr } = await supabase
        .from("product_sources")
        .insert(sourceRows)
        .select();
      if (srcErr) throw srcErr;

      // Seed price history
      const historyRows = insertedSources
        .filter((s) => typeof s.current_price === "number")
        .map((s) => ({
          source_id: s.id,
          user_id: user.id,
          price: s.current_price as number,
          currency: s.currency ?? "USD",
        }));
      if (historyRows.length) {
        await supabase.from("price_history").insert(historyRows);
      }

      toast.success(`Tracking ${productName}`);
      navigate({ to: "/app/product/$productId", params: { productId: product.id } });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to="/app"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="glass-strong rounded-3xl p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Track a new product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste one or more product URLs. We'll fetch the title, image and current price for each.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Custom name (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. AirPods Pro 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-2xl glass-inset px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Product URLs
            </label>
            <div className="mt-1.5 space-y-2">
              {urls.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="url"
                      placeholder="https://www.amazon.com/..."
                      value={u}
                      onChange={(e) => updateUrl(i, e.target.value)}
                      className="w-full rounded-2xl glass-inset py-3 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="grid h-10 w-10 place-items-center rounded-2xl glass-inset text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className="mt-2 inline-flex items-center gap-1 rounded-full glass-inset px-3 py-1.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" /> Add another source
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--deep)] px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:shadow-lg transition disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Fetching prices…" : "Start tracking"}
          </button>
        </form>
      </div>
    </main>
  );
}

CREATE TABLE public.product_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'GENERAL',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  search_count integer NOT NULL DEFAULT 1,
  last_refreshed_at timestamptz NOT NULL DEFAULT now(),
  last_searched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_catalog_search_key_idx ON public.product_catalog (search_key);
CREATE INDEX product_catalog_refresh_idx ON public.product_catalog (is_active, last_refreshed_at);

GRANT SELECT ON public.product_catalog TO anon;
GRANT SELECT ON public.product_catalog TO authenticated;
GRANT ALL ON public.product_catalog TO service_role;

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog is publicly readable"
  ON public.product_catalog FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE public.catalog_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_id uuid NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  url text NOT NULL,
  title text,
  description text,
  price numeric,
  currency text NOT NULL DEFAULT 'BDT',
  image_url text,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_sources_url_scheme CHECK (url ~* '^https?://'),
  CONSTRAINT catalog_sources_unique_url UNIQUE (catalog_id, url)
);

CREATE INDEX catalog_sources_catalog_idx ON public.catalog_sources (catalog_id);

GRANT SELECT ON public.catalog_sources TO anon;
GRANT SELECT ON public.catalog_sources TO authenticated;
GRANT ALL ON public.catalog_sources TO service_role;

ALTER TABLE public.catalog_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog sources are publicly readable"
  ON public.catalog_sources FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON public.product_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
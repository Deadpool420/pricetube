ALTER TABLE public.product_catalog ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.catalog_sources ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;
ALTER TABLE public.product_sources ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;
ALTER TABLE public.product_sources ADD COLUMN IF NOT EXISTS fail_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_product_catalog_aliases ON public.product_catalog USING gin (aliases);
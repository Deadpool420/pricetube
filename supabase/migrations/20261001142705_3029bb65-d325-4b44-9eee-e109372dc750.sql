ALTER TABLE public.product_catalog ADD COLUMN verification_status text NOT NULL DEFAULT 'pending_review';
UPDATE public.product_catalog SET verification_status = 'verified';
ALTER TABLE public.product_catalog ADD CONSTRAINT product_catalog_verification_status_check CHECK (verification_status IN ('verified','pending_review','rejected'));
CREATE INDEX IF NOT EXISTS idx_product_catalog_status ON public.product_catalog(verification_status);
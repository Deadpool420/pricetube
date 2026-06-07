
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  source_id UUID NOT NULL,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  emailed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts TO authenticated;
GRANT ALL ON public.price_alerts TO service_role;

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own alerts" ON public.price_alerts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own alerts" ON public.price_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own alerts" ON public.price_alerts
  FOR UPDATE USING (auth.uid() = user_id);

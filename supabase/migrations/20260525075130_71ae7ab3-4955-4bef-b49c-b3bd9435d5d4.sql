
-- Timestamp helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_products_user ON public.products(user_id);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product sources
CREATE TABLE public.product_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  url TEXT NOT NULL,
  current_price NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sources" ON public.product_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sources" ON public.product_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sources" ON public.product_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sources" ON public.product_sources FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_sources_product ON public.product_sources(product_id);
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON public.product_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Price history
CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.product_sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own history" ON public.price_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own history" ON public.price_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_history_source_time ON public.price_history(source_id, recorded_at DESC);

-- Wishlist
CREATE TABLE public.wishlist (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wishlist" ON public.wishlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wishlist" ON public.wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own wishlist" ON public.wishlist FOR DELETE USING (auth.uid() = user_id);

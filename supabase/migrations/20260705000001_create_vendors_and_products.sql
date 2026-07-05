-- Create auth helper functions if they do not exist (pre-exist in hosted Supabase)
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
$$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

-- Create vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  "momoChannel" VARCHAR(50) NOT NULL CHECK ("momoChannel" IN ('mtn', 'telecel', 'at')),
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  "priceInPesewas" INTEGER NOT NULL CHECK ("priceInPesewas" >= 0),
  "vendorId" UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  category VARCHAR(100) NOT NULL,
  "inStock" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendors
CREATE POLICY "staff can read vendors" ON public.vendors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can insert vendors" ON public.vendors
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "staff can update vendors" ON public.vendors
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "staff can delete vendors" ON public.vendors
  FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for products
CREATE POLICY "staff can read products" ON public.products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can insert products" ON public.products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "staff can update products" ON public.products
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "staff can delete products" ON public.products
  FOR DELETE USING (auth.role() = 'authenticated');

-- Function to automatically update updatedAt timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updatedAt
DROP TRIGGER IF EXISTS trg_vendors_update_timestamp ON public.vendors;
CREATE TRIGGER trg_vendors_update_timestamp
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_products_update_timestamp ON public.products;
CREATE TRIGGER trg_products_update_timestamp
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to block vendor deletion if order history exists in order_items
CREATE OR REPLACE FUNCTION public.check_vendor_delete_restriction()
RETURNS TRIGGER AS $$
DECLARE
  has_orders BOOLEAN := false;
BEGIN
  -- Perform check dynamically since order_items will be created in a later migration
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'order_items'
  ) THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.order_items WHERE "vendorId" = $1)'
    INTO has_orders
    USING OLD.id;
    
    IF has_orders THEN
      RAISE EXCEPTION 'Cannot delete vendor with active order history. Set active to false instead.' USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for soft-delete enforcement
DROP TRIGGER IF EXISTS trg_vendors_before_delete ON public.vendors;
CREATE TRIGGER trg_vendors_before_delete
  BEFORE DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.check_vendor_delete_restriction();

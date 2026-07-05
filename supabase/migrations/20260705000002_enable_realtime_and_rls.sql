-- Enable Row Level Security (RLS) on Prisma-managed tables to ensure security baseline
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ussd_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Select Policies for staff (authenticated role)
CREATE POLICY "staff can read orders" ON public.orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can read order_items" ON public.order_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can read vendor_fulfillments" ON public.vendor_fulfillments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can read payments" ON public.payments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can read disbursements" ON public.disbursements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can read call_sessions" ON public.call_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "staff can read ussd_sessions" ON public.ussd_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Enable Supabase Realtime logical replication on the specified tables
BEGIN;
  -- Remove tables if they are already in the publication to prevent errors
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.orders;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.vendor_fulfillments;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.call_sessions;

  -- Add tables to logical replication publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_fulfillments;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
COMMIT;

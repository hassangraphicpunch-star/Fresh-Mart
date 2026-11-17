-- Fresh Mart – Atomic RPC Functions & Row Level Security (002_rpc_and_rls.sql)

-- Order number sequence for clean daily/unique identifiers
CREATE SEQUENCE IF NOT EXISTS public.freshmart_order_seq START 1001;

-- Atomic Cash on Delivery Order Creation RPC
-- Prevents duplicate orders via idempotency_key, prevents stock overselling via FOR UPDATE locks,
-- enforces Admin-configured Karachi fixed delivery fee, and calculates totals server-side.
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_delivery_area TEXT,
  p_delivery_address TEXT,
  p_delivery_notes TEXT,
  p_coupon_code TEXT,
  p_items JSONB
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.orders;
  v_delivery public.delivery_settings;
  v_coupon public.coupons;
  v_item JSONB;
  v_product public.products;
  v_qty INTEGER;
  v_subtotal INTEGER := 0;
  v_delivery_fee INTEGER := 0;
  v_discount INTEGER := 0;
  v_grand_total INTEGER := 0;
  v_order_number TEXT;
  v_order public.orders;
BEGIN
  -- 1. Idempotency / duplicate order check
  SELECT * INTO v_existing
  FROM public.orders
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- 2. Verify Karachi delivery settings configured by admin
  SELECT * INTO v_delivery
  FROM public.delivery_settings
  WHERE id = 1
  FOR SHARE;

  IF NOT FOUND OR v_delivery.is_available = false THEN
    RAISE EXCEPTION 'Delivery in Karachi is currently unavailable';
  END IF;

  IF v_delivery.fixed_fee_pkr IS NULL THEN
    RAISE EXCEPTION 'Delivery charges have not been configured by store admin yet';
  END IF;

  -- 3. Lock products in deterministic order, validate availability, compute subtotal
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'productId'
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'productId')::UUID
    FOR UPDATE;

    IF NOT FOUND OR v_product.is_active = false THEN
      RAISE EXCEPTION 'Product % is unavailable', COALESCE(v_item->>'productId', 'unknown');
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (available: %)', v_product.name_en, v_product.stock;
    END IF;

    v_subtotal := v_subtotal + (v_product.price_pkr * v_qty);
  END LOOP;

  -- 4. Minimum order check
  IF v_subtotal < v_delivery.min_order_pkr THEN
    RAISE EXCEPTION 'Minimum order amount is Rs. %', v_delivery.min_order_pkr;
  END IF;

  -- 5. Apply single fixed Karachi delivery fee (or free threshold if configured)
  IF v_delivery.free_delivery_threshold_pkr IS NOT NULL AND v_subtotal >= v_delivery.free_delivery_threshold_pkr THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := v_delivery.fixed_fee_pkr;
  END IF;

  -- 6. Validate and apply optional coupon
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE upper(code) = upper(trim(p_coupon_code))
      AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or inactive coupon code';
    END IF;

    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
      RAISE EXCEPTION 'Coupon has expired';
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'Coupon usage limit reached';
    END IF;

    IF v_subtotal < v_coupon.min_order_pkr THEN
      RAISE EXCEPTION 'Coupon requires minimum subtotal of Rs. %', v_coupon.min_order_pkr;
    END IF;

    IF v_coupon.discount_type = 'fixed' THEN
      v_discount := v_coupon.discount_value;
    ELSE
      v_discount := FLOOR((v_subtotal * v_coupon.discount_value) / 100.0)::INTEGER;
      IF v_coupon.max_discount_pkr IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_coupon.max_discount_pkr);
      END IF;
    END IF;

    v_discount := LEAST(v_discount, v_subtotal);

    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE id = v_coupon.id;
  END IF;

  v_grand_total := GREATEST(0, v_subtotal + v_delivery_fee - v_discount);
  v_order_number := 'FM-' || to_char(now(), 'YYYYMMDD') || '-' || nextval('public.freshmart_order_seq')::TEXT;

  -- 7. Insert order
  INSERT INTO public.orders (
    order_number,
    idempotency_key,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    delivery_city,
    delivery_area,
    delivery_address,
    delivery_notes,
    payment_method,
    status,
    subtotal_pkr,
    delivery_fee_pkr,
    discount_pkr,
    grand_total_pkr,
    coupon_code
  ) VALUES (
    v_order_number,
    p_idempotency_key,
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    'Karachi',
    p_delivery_area,
    p_delivery_address,
    COALESCE(p_delivery_notes, ''),
    'COD',
    'pending',
    v_subtotal,
    v_delivery_fee,
    v_discount,
    v_grand_total,
    CASE WHEN v_coupon.id IS NOT NULL THEN v_coupon.code ELSE NULL END
  )
  RETURNING * INTO v_order;

  -- 8. Insert order items & decrement stock atomically
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'productId')::UUID;

    UPDATE public.products
    SET stock = stock - v_qty, updated_at = now()
    WHERE id = v_product.id AND stock >= v_qty;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name_en,
      product_name_ur,
      unit_label,
      unit_price_pkr,
      quantity,
      line_total_pkr
    ) VALUES (
      v_order.id,
      v_product.id,
      v_product.name_en,
      v_product.name_ur,
      v_product.unit_label,
      v_product.price_pkr,
      v_qty,
      v_product.price_pkr * v_qty
    );
  END LOOP;

  RETURN v_order;
END;
$$;

-- Atomic Stock Restoration on Order Cancellation
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id
  LOOP
    UPDATE public.products
    SET stock = stock + v_item.quantity, updated_at = now()
    WHERE id = v_item.product_id;
  END LOOP;
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Public read access ONLY for active storefront catalog & public settings
DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
CREATE POLICY "Public read active categories"
  ON public.categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Public read active products" ON public.products;
CREATE POLICY "Public read active products"
  ON public.products FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Public read delivery settings" ON public.delivery_settings;
CREATE POLICY "Public read delivery settings"
  ON public.delivery_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read store settings" ON public.store_settings;
CREATE POLICY "Public read store settings"
  ON public.store_settings FOR SELECT
  USING (true);

-- Sensitive tables (customers, orders, order_items, coupons, whatsapp_logs, admin_users)
-- are denied to anon/public clients and accessed solely via server-side Service Role API routes
-- with explicit session authentication & phone/order verification.

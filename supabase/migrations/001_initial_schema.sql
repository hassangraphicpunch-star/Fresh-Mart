-- Fresh Mart – Initial Idempotent PostgreSQL / Supabase Schema
-- Safe to run on fresh or existing databases without dropping customer/order data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_ur TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ur TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_ur TEXT NOT NULL DEFAULT '',
  unit_label TEXT NOT NULL,
  price_pkr INTEGER NOT NULL CHECK (price_pkr >= 0),
  compare_at_price_pkr INTEGER CHECK (compare_at_price_pkr IS NULL OR compare_at_price_pkr >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  image_url TEXT NOT NULL DEFAULT '',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- 3. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  default_area TEXT NOT NULL DEFAULT '',
  default_address TEXT NOT NULL DEFAULT '',
  language_pref TEXT NOT NULL DEFAULT 'en' CHECK (language_pref IN ('en', 'ur')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Delivery Settings (Karachi – Single Fixed Fee Configurable by Admin)
CREATE TABLE IF NOT EXISTS public.delivery_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  city TEXT NOT NULL DEFAULT 'Karachi',
  fixed_fee_pkr INTEGER CHECK (fixed_fee_pkr IS NULL OR fixed_fee_pkr >= 0),
  min_order_pkr INTEGER NOT NULL DEFAULT 0 CHECK (min_order_pkr >= 0),
  free_delivery_threshold_pkr INTEGER CHECK (free_delivery_threshold_pkr IS NULL OR free_delivery_threshold_pkr >= 0),
  is_available BOOLEAN NOT NULL DEFAULT true,
  active_areas TEXT[] NOT NULL DEFAULT ARRAY[
    'DHA & Clifton',
    'Gulshan-e-Iqbal',
    'Gulistan-e-Johar',
    'PECHS & Bahadurabad',
    'North Nazimabad',
    'Nazimabad',
    'Saddar',
    'Korangi',
    'Malir'
  ],
  instructions_en TEXT NOT NULL DEFAULT 'Cash on Delivery across active Karachi neighborhoods. Rider calls prior to arrival.',
  instructions_ur TEXT NOT NULL DEFAULT 'کراچی کے فعال علاقوں میں کیش آن ڈیلیوری دستیاب ہے۔ رائیڈر پہنچنے سے پہلے کال کرے گا۔',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_order_pkr INTEGER NOT NULL DEFAULT 0 CHECK (min_order_pkr >= 0),
  max_discount_pkr INTEGER CHECK (max_discount_pkr IS NULL OR max_discount_pkr >= 0),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Orders (Cash on Delivery Only)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  delivery_city TEXT NOT NULL DEFAULT 'Karachi',
  delivery_area TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_notes TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'COD' CHECK (payment_method = 'COD'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')
  ),
  subtotal_pkr INTEGER NOT NULL CHECK (subtotal_pkr >= 0),
  delivery_fee_pkr INTEGER NOT NULL CHECK (delivery_fee_pkr >= 0),
  discount_pkr INTEGER NOT NULL DEFAULT 0 CHECK (discount_pkr >= 0),
  grand_total_pkr INTEGER NOT NULL CHECK (grand_total_pkr >= 0),
  coupon_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 7. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_en TEXT NOT NULL,
  product_name_ur TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  unit_price_pkr INTEGER NOT NULL CHECK (unit_price_pkr >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_pkr INTEGER NOT NULL CHECK (line_total_pkr >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 8. Store Settings
CREATE TABLE IF NOT EXISTS public.store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name TEXT NOT NULL DEFAULT 'Fresh Mart',
  phone TEXT NOT NULL DEFAULT '03233469424',
  whatsapp_phone TEXT NOT NULL DEFAULT '03233469424',
  city TEXT NOT NULL DEFAULT 'Karachi',
  country TEXT NOT NULL DEFAULT 'Pakistan',
  currency TEXT NOT NULL DEFAULT 'PKR',
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_welcome_en TEXT NOT NULL DEFAULT 'Welcome to Fresh Mart AI! Ask me about fresh groceries, PKR prices, budget lists, or order tracking in Karachi.',
  ai_welcome_ur TEXT NOT NULL DEFAULT 'فریش مارٹ اے آئی میں خوش آمدید! کراچی میں تازہ گروسری، قیمتوں، بجٹ لسٹ یا آرڈر ٹریکنگ کے بارے میں پوچھیں۔',
  whatsapp_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. WhatsApp Notification & Webhook Logs
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  template_name TEXT NOT NULL DEFAULT '',
  message_body TEXT NOT NULL DEFAULT '',
  meta_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped_unconfigured', 'received')
  ),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_order ON public.whatsapp_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_meta_id ON public.whatsapp_logs(meta_message_id);

-- 10. Admin Users
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure singleton configuration rows exist (fixed_fee_pkr remains NULL until configured by Admin)
INSERT INTO public.delivery_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

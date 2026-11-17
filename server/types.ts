export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_ur: string;
  description_en: string;
  description_ur: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  sku: string;
  slug: string;
  name_en: string;
  name_ur: string;
  description_en: string;
  description_ur: string;
  unit_label: string;
  price_pkr: number;
  compare_at_price_pkr: number | null;
  stock: number;
  low_stock_threshold: number;
  image_url: string;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliverySettings {
  id: number;
  city: string;
  fixed_fee_pkr: number | null;
  min_order_pkr: number;
  free_delivery_threshold_pkr: number | null;
  is_available: boolean;
  active_areas: string[];
  instructions_en: string;
  instructions_ur: string;
  updated_at: string;
}

export interface StoreSettings {
  id: number;
  store_name: string;
  phone: string;
  whatsapp_phone: string;
  city: string;
  country: string;
  currency: string;
  ai_enabled: boolean;
  ai_welcome_en: string;
  ai_welcome_ur: string;
  whatsapp_notifications_enabled: boolean;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_order_pkr: number;
  max_discount_pkr: number | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  password_hash: string;
  default_area: string;
  default_address: string;
  language_pref: 'en' | 'ur';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name_en: string;
  product_name_ur: string;
  unit_label: string;
  unit_price_pkr: number;
  quantity: number;
  line_total_pkr: number;
}

export interface Order {
  id: string;
  order_number: string;
  idempotency_key: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_city: string;
  delivery_area: string;
  delivery_address: string;
  delivery_notes: string;
  payment_method: 'COD';
  status: OrderStatus;
  subtotal_pkr: number;
  delivery_fee_pkr: number;
  discount_pkr: number;
  grand_total_pkr: number;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface WhatsAppLog {
  id: string;
  order_id: string | null;
  recipient_phone: string;
  direction: 'outbound' | 'inbound';
  template_name: string;
  message_body: string;
  meta_message_id: string | null;
  status:
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed'
    | 'skipped_unconfigured'
    | 'received';
  error_message: string | null;
  retry_count: number;
  payload_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  created_at: string;
}

export interface CartCalculation {
  items: Array<{
    productId: string;
    name_en: string;
    name_ur: string;
    unit_label: string;
    unit_price_pkr: number;
    quantity: number;
    line_total_pkr: number;
    available_stock: number;
  }>;
  subtotal_pkr: number;
  delivery_fee_pkr: number | null;
  delivery_configured: boolean;
  delivery_available: boolean;
  min_order_pkr: number;
  free_delivery_threshold_pkr: number | null;
  meets_min_order: boolean;
  discount_pkr: number;
  applied_coupon: string | null;
  coupon_error: string | null;
  grand_total_pkr: number | null;
}

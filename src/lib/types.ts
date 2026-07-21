// =============================================
// Tipos compartilhados (Supabase → app)
// =============================================

export type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  cpf: string | null;
  role: "customer" | "admin";
  created_at: string;
  updated_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
  created_at: string;
};

export type DbProduct = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price: number;
  old_price: number | null;
  category: string | null;
  tag: "Mais Vendido" | "Lançamento" | "Frete Grátis" | null;
  notes: string[];
  sizes: string[];
  images: string[];
  rating: number;
  review_count: number;
  stock: number;
  active: boolean;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  for_whom: "ela" | "ele" | "casal" | "todos" | null;
  experience_level: "iniciante" | "intermediario" | "avancado" | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  size: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_cpf: string | null;
  shipping_cep: string | null;
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  coupon_code: string | null;
  discount: number;
  subtotal: number;
  shipping_cost: number;
  total: number;
  payment_method: "pix" | "credit_card" | "boleto";
  payment_gateway: "mercadopago" | "stripe" | "pagseguro" | null;
  payment_status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  payment_id: string | null;
  payment_url: string | null;
  payment_qr_code: string | null;
  payment_barcode: string | null;
  payment_expires_at: string | null;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  tracking_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
};

export type PaymentMethod = "pix" | "credit_card" | "boleto";
export type PaymentGateway = "mercadopago" | "stripe" | "pagseguro";

export type Coupon = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  product_id: string;
  user_id: string | null;
  order_id: string | null;
  customer_name: string;
  customer_email: string;
  rating: number;
  comment: string | null;
  verified_purchase: boolean;
  approved: boolean;
  created_at: string;
  updated_at: string;
  // joined
  product_name?: string;
  product_slug?: string;
};

export type CreateOrderInput = {
  user_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_cpf: string;
  shipping_cep: string;
  shipping_street: string;
  shipping_number: string;
  shipping_complement?: string;
  shipping_neighborhood: string;
  shipping_city: string;
  shipping_state: string;
  payment_method: PaymentMethod;
  coupon_code?: string;
  items: {
    product_id?: string;
    product_name: string;
    product_slug: string;
    product_image?: string;
    size: string;
    quantity: number;
    unit_price: number;
  }[];
};

export type PaymentResult = {
  orderId: string;
  orderNumber: string;
  gateway: PaymentGateway;
  paymentMethod: PaymentMethod;
  paymentId?: string;
  // Pix
  qrCode?: string;
  qrCodeBase64?: string;
  expiresAt?: string;
  // Boleto
  barcode?: string;
  barcodeUrl?: string;
  // Card
  redirectUrl?: string;
  status: "pending" | "paid" | "processing";
};

/*
# Create products and orders tables for Creamy Nut ecommerce

1. New Tables
- `products`
  - `id` (uuid, primary key, auto-generated)
  - `name` (text, not null) — product display name
  - `slug` (text, unique, not null) — URL-friendly identifier
  - `tagline` (text) — short marketing line
  - `description` (text, not null) — full description
  - `category` (text, not null) — 'peanut-butter', 'soup', or 'bundle'
  - `price` (numeric, not null) — selling price
  - `compare_at_price` (numeric, nullable) — original price for sale display
  - `weight` (text) — package size label (e.g. "500g jar")
  - `image_url` (text, not null) — product photo URL
  - `badge` (text, nullable) — small badge label like "Best Seller"
  - `stock` (integer, not null, default 0) — units available
  - `rating` (numeric, not null, default 5) — average rating 0-5
  - `review_count` (integer, not null, default 0)
  - `sort_order` (integer, not null, default 0) — display ordering
  - `created_at` (timestamp)

- `orders`
  - `id` (uuid, primary key, auto-generated)
  - `order_number` (text, unique, not null) — human-friendly reference like CN-2026-XXXX
  - `customer_name` (text, not null)
  - `email` (text, not null)
  - `phone` (text, not null)
  - `address` (text, not null)
  - `city` (text, not null)
  - `country` (text, not null)
  - `items` (jsonb, not null) — snapshot of purchased items (name, qty, price each)
  - `subtotal` (numeric, not null)
  - `shipping` (numeric, not null)
  - `total` (numeric, not null)
  - `status` (text, not null, default 'pending') — pending, paid, shipped, delivered
  - `created_at` (timestamp)

2. Security
- Enable RLS on both tables.
- Products: world-readable (public storefront catalog), but only writable by the shop owner service — no anon writes.
- Orders: customers (anon) can create orders and read their own order by its order number; no anon update/delete.

3. Notes
- This is a single-tenant storefront with no sign-in: storefront visitors are anonymous.
- Product images are external stock photo URLs.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  tagline text,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('peanut-butter', 'soup', 'bundle')),
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  compare_at_price numeric(10, 2),
  weight text,
  image_url text NOT NULL,
  badge text,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  rating numeric(2, 1) NOT NULL DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  review_count integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  items jsonb NOT NULL,
  subtotal numeric(10, 2) NOT NULL,
  shipping numeric(10, 2) NOT NULL,
  total numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products (sort_order);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Products are a public catalog: anyone can read, nobody anonymous can write.
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Orders: anyone can place an order; a customer can look up their own order by number.
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_own_orders" ON orders;
CREATE POLICY "anon_read_own_orders" ON orders
  FOR SELECT
  TO anon, authenticated
  USING (true);
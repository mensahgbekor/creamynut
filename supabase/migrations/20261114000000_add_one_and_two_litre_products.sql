INSERT INTO public.products (name, slug, tagline, description, category, price, compare_at_price, weight, image_url, badge, stock, rating, review_count, sort_order)
VALUES
  ('CreamyNut Peanut Butter — 2 L', 'tub-2l', 'Smooth peanut butter, 2 litres', 'CreamyNut peanut butter in a handy 2-litre size.', 'peanut-butter', 150.00, NULL, '2 L', 'https://creamynut.vercel.app/creamynut-4l-bucket.png', NULL, 100, 5.0, 0, 3),
  ('CreamyNut Peanut Butter — 1 L', 'tub-1l', 'Smooth peanut butter, 1 litre', 'CreamyNut peanut butter in a handy 1-litre size.', 'peanut-butter', 75.00, NULL, '1 L', 'https://creamynut.vercel.app/creamynut-4l-bucket.png', NULL, 100, 5.0, 0, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  weight = EXCLUDED.weight,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order;

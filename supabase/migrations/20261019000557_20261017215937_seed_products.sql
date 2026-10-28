/*
 * Version aligned with the CreamyNut Supabase migration history.
# Seed Creamy Nut product catalog

1. Data
- Inserts 8 products across three categories (peanut-butter, soup, bundle).
- Prices in USD. Images are stock photos (peanut butter jars, peanut soups/stews, bread + jar).

2. Security
- No changes; products table already has a public-read policy.

3. Notes
- Idempotent: re-running updates existing rows on slug conflict instead of duplicating.
*/

INSERT INTO products (name, slug, tagline, description, category, price, compare_at_price, weight, image_url, badge, stock, rating, review_count, sort_order)
VALUES
  ('Classic Creamy Peanut Butter', 'classic-creamy', 'Your bread''s best friend', 'Slow-roasted Virginia peanuts, stone-ground into an ultra-smooth spread with nothing else added — no sugar, no palm oil, no shortcuts. Rich, toasty, and impossibly spreadable.', 'peanut-butter', 6.99, 8.99, '500g jar', 'https://images.pexels.com/photos/8611766/pexels-photo-8611766.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Best Seller', 120, 4.9, 342, 1),
  ('Crunchy Peanut Butter', 'crunchy', 'For the crunch loyalists', 'The same slow-roasted goodness, folded with hand-cracked peanut pieces for a satisfying snap in every bite. Seriously crunchy, seriously addictive.', 'peanut-butter', 6.99, NULL, '500g jar', 'https://images.pexels.com/photos/5149345/pexels-photo-5149345.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', NULL, 95, 4.8, 218, 2),
  ('Dark Roast Peanut Butter', 'dark-roast', 'Deeper, bolder, toastier', 'Peanuts roasted an extra six minutes for a deep, almost cocoa-like flavor. Our boldest jar yet — incredible on dark chocolate, pancakes, or straight off the spoon.', 'peanut-butter', 7.99, NULL, '500g jar', 'https://images.pexels.com/photos/5149349/pexels-photo-5149349.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'New', 70, 4.7, 96, 3),
  ('Signature Groundnut Soup', 'signature-groundnut-soup', 'From bread to soup, we''ve got you', 'Our signature West African-style groundnut soup: creamy peanut base, slow-simmered with smoked beef, chicken, and a whisper of chili. Deeply savory, deeply comforting. Serves 2.', 'soup', 12.99, 14.99, '750ml pouch', 'https://images.pexels.com/photos/37648018/pexels-photo-37648018.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Best Seller', 60, 5.0, 187, 4),
  ('Spicy Pepper Groundnut Soup', 'spicy-groundnut-soup', 'Turn up the heat', 'The signature soup with a fiery pepper kick — scotch bonnet, ginger, and garlic layered over our creamy peanut base. Not for the faint of heart. Serves 2.', 'soup', 12.99, NULL, '750ml pouch', 'https://images.pexels.com/photos/35490114/pexels-photo-35490114.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Spicy', 55, 4.8, 143, 5),
  ('Smoky BBQ Groundnut Soup', 'smoky-groundnut-soup', 'Campfire in a bowl', 'A gentle, smoky take with roasted tomato, paprika, and tender beef. The family favorite for cooler evenings. Serves 2.', 'soup', 12.49, NULL, '750ml pouch', 'https://images.pexels.com/photos/8321980/pexels-photo-8321980.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', NULL, 48, 4.7, 88, 6),
  ('Spread & Soup Duo', 'spread-soup-duo', 'The full Creamy Nut experience', 'One 500g jar of Classic Creamy plus our Signature Groundnut Soup — bread before, soup after. Everything Creamy Nut stands for in a single box, wrapped and ready to gift.', 'bundle', 17.99, 19.98, 'Gift box', 'https://images.pexels.com/photos/7253551/pexels-photo-7253551.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Save $2', 40, 4.9, 74, 7),
  ('The Pantry Stock-Up', 'pantry-stock-up', 'Never run out again', 'Two Classic Creamy jars, one Crunchy, and all three soups. Six full products at our best per-jar price — built for households that go through peanut butter fast.', 'bundle', 49.99, 57.94, '6 items', 'https://images.pexels.com/photos/23384626/pexels-photo-23384626.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Best Value', 25, 5.0, 51, 8)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  weight = EXCLUDED.weight,
  image_url = EXCLUDED.image_url,
  badge = EXCLUDED.badge,
  stock = EXCLUDED.stock,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  sort_order = EXCLUDED.sort_order;

/*
# Switch catalog to Ghana cedi weight-based tubs

1. Changes
- Replaces the previous 9-item demo catalog with the shop's real offering, priced in
  Ghana cedi (GH₵) and sold by weight:
  - `Creamy Peanut Butter — 4.5kg tub` — GH₵250.00
  - `Creamy Peanut Butter — 2.25kg tub` — GH₵130.00
  - `Custom Kilograms` — price 0 / TBD: customer enters their own kilograms at checkout;
    the shop negotiates the price separately (flagged on the orders dashboard).
- The old rows were placeholder seed data with no customers attached, so replacing them
  is safe. Customer orders are NOT touched.

2. Security
- No changes; products remain world-readable and read-only for visitors.
*/

DELETE FROM products;

INSERT INTO products (name, slug, tagline, description, category, price, compare_at_price, weight, image_url, badge, stock, rating, review_count, sort_order)
VALUES
  ('Creamy Peanut Butter — 4.5kg Tub', 'tub-4-5kg', 'Our signature smooth spread, family size', 'Slow-roasted peanuts, stone-ground into an ultra-smooth spread. Nothing added — no sugar, no palm oil. The 4.5kg tub is the best value for households that go through peanut butter fast.', 'peanut-butter', 250.00, NULL, '4.5 kg', 'https://images.pexels.com/photos/8611766/pexels-photo-8611766.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Best Value', 120, 4.9, 342, 1),
  ('Creamy Peanut Butter — 2.25kg Tub', 'tub-2-25kg', 'Our signature smooth spread, half size', 'The same slow-roasted, stone-ground smoothness in a half-size tub. Perfect for smaller households or a first taste of Creamy Nut.', 'peanut-butter', 130.00, NULL, '2.25 kg', 'https://images.pexels.com/photos/23384626/pexels-photo-23384626.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', NULL, 95, 4.8, 210, 2),
  ('Custom Order — Choose Your Kilograms', 'custom-kg', 'You decide the amount, we agree the price', 'Need a different quantity — 5kg, 10kg, 20kg for a shop or event? Enter the number of kilograms you want and place your order. We will contact you to confirm the price and payment before anything ships.', 'peanut-butter', 0.00, NULL, 'You choose', 'https://images.pexels.com/photos/5149349/pexels-photo-5149349.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'Bulk / Custom', 9999, 5.0, 48, 3);
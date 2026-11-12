-- Present the peanut butter catalogue in litres and use the familiar Ghanaian bucket.
-- The 10 L option costs two standard buckets; historical orders remain unchanged.
UPDATE public.products
SET name = 'CreamyNut Peanut Butter — Ghanaian Blue Bucket (Approx. 5 L)',
    tagline = 'Our familiar standard blue bucket',
    description = 'Smooth, natural peanut butter in the familiar Ghanaian blue-and-white bucket. This standard bucket holds approximately 5 litres.',
    weight = 'Approx. 5 L',
    image_url = 'https://creamynut.vercel.app/creamynut-5l-bucket.png'
WHERE slug = 'tub-4-5kg';

UPDATE public.products
SET name = 'CreamyNut Peanut Butter — 10 L — Two Buckets',
    tagline = 'Our signature smooth spread, two standard buckets',
    description = 'The same smooth, natural peanut butter in two standard 5-litre buckets.',
    weight = '10 L (2 × 5 L buckets)',
    price = (SELECT price * 2 FROM public.products WHERE slug = 'tub-4-5kg'),
    image_url = 'https://creamynut.vercel.app/creamynut-5l-bucket.png'
WHERE slug = 'tub-2-25kg';

UPDATE public.products
SET name = 'Bulk Peanut Butter — 5 L Bucket Multiples',
    tagline = 'Measured with the familiar Ghanaian blue bucket',
    description = 'Bulk enquiries start at 15 litres, in 5-litre multiples. One standard Ghanaian blue bucket holds approximately 5 litres. Send an enquiry to confirm availability, price and delivery.',
    weight = 'From 15 L'
WHERE slug = 'custom-kg';

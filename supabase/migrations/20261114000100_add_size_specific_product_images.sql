UPDATE public.products
SET image_url = CASE slug
  WHEN 'tub-2l' THEN 'https://creamynut.vercel.app/creamynut-2l.png'
  WHEN 'tub-1l' THEN 'https://creamynut.vercel.app/creamynut-1l.png'
END
WHERE slug IN ('tub-2l', 'tub-1l');

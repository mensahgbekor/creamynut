UPDATE public.products SET
name = replace(replace(replace(name, '5 L', '4 L'), '10 L', '8 L'), '15 L', '12 L'),
description = replace(replace(description, '5 litre', '4 litre'), '5-litre', '4-litre'),
weight = replace(replace(replace(weight, '5 L', '4 L'), '10 L', '8 L'), '15 L', '12 L'),
image_url = 'https://creamynut.vercel.app/creamynut-4l-bucket.png'
WHERE slug IN ('tub-4-5kg','tub-2-25kg','custom-kg');
UPDATE public.products SET description = replace(description, '15 litres', '12 litres') WHERE slug = 'custom-kg';

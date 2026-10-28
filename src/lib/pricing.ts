import type { Product } from './store';

export function customPrice(kg: number, products: Product[]): number | null {
  if (!Number.isFinite(kg) || kg < 10 || kg > 10000 || kg % 0.5 !== 0) return null;
  const reference = products.find(p => p.slug === 'tub-4-5kg') ?? products.find(p => p.slug === 'tub-2-25kg');
  if (!reference || !Number.isFinite(Number(reference.price)) || Number(reference.price) <= 0) return null;
  const grams = reference.slug === 'tub-4-5kg' ? 5000 : 2500;
  return Math.round(Math.round(Number(reference.price) * 100) * (kg * 1000) / grams) / 100;
}

export function pricedCustomProduct(product: Product, kg: number, products: Product[]): Product | null {
  const price = customPrice(kg, products);
  return price === null ? null : { ...product, price, name: `Custom Order — ${kg} kg`, weight: `${kg} kg` };
}

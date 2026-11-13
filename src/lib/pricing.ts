import type { Product } from './store';

// Historical kilogram orders must be ordered again through the current litre catalogue.
export function pricedCustomProduct(_product: Product, _kg: number, _products: Product[]): Product | null {
  void _product; void _kg; void _products;
  return null;
}

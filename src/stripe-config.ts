export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'payment' | 'subscription';
}

export const stripeProducts: StripeProduct[] = [
  {
    id: 'prod_TwsvDNsDe4iHcS',
    priceId: 'price_1Syz9QAuo9xoLwDEJuYXSMlb',
    name: 'FFLTracker Yearly Subscription',
    description: 'FFLTracker Yearly Subscription',
    price: 20.00,
    currency: 'usd',
    mode: 'subscription'
  }
];

export const getProductByPriceId = (priceId: string): StripeProduct | undefined => {
  return stripeProducts.find(product => product.priceId === priceId);
};
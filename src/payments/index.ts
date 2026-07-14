export type { PaymentProvider, PaymentType, CheckoutSession, VerifyResult } from './PaymentProvider';
export { StripeProvider } from './StripeProvider';
export { MockProvider } from './MockProvider';

import { StripeProvider } from './StripeProvider';
import { MockProvider } from './MockProvider';

/**
 * Active payment provider.
 *
 * To swap providers, change VITE_PAYMENT_PROVIDER in your environment:
 *   VITE_PAYMENT_PROVIDER=stripe   (production)
 *   VITE_PAYMENT_PROVIDER=mock     (development, no real charges)
 *
 * To add Mollie: create MollieProvider implementing PaymentProvider,
 * then set VITE_PAYMENT_PROVIDER=mollie here.
 */
const providerName = (import.meta.env.VITE_PAYMENT_PROVIDER as string | undefined)
  ?? (import.meta.env.DEV ? 'mock' : 'stripe');

export const paymentProvider =
  providerName === 'mock' ? new MockProvider() : new StripeProvider();

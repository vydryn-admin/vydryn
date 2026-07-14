import type { PaymentProvider, PaymentType, CheckoutSession, VerifyResult } from './PaymentProvider';

/**
 * MockProvider — for local development without a real payment backend.
 *
 * Simulates an immediate successful payment so the full export flow can be
 * tested without Stripe credentials.
 *
 * Activated by setting VITE_PAYMENT_PROVIDER=mock (or when no provider is set
 * and NODE_ENV is development).
 *
 * NEVER use this in production — it grants paid features without any charge.
 */
export class MockProvider implements PaymentProvider {
  readonly name = 'mock';

  async createSession(type: PaymentType): Promise<CheckoutSession> {
    // Navigate to the success URL as if a real provider completed payment
    const successUrl = `${window.location.origin}?session_id=mock_${type}_${Date.now()}&payment_type=${type}`;
    return { url: successUrl, sessionId: `mock_${type}_${Date.now()}` };
  }

  async verifySession(sessionId: string): Promise<VerifyResult> {
    const type: PaymentType = sessionId.includes('creator') ? 'creator' : 'unlock';
    return { paid: true, type };
  }
}

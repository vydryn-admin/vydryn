import type { PaymentProvider, PaymentType, CheckoutSession, VerifyResult } from './PaymentProvider';

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  async createSession(type: PaymentType): Promise<CheckoutSession> {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? 'Failed to create payment session');
    }
    return res.json() as Promise<CheckoutSession>;
  }

  async verifySession(sessionId: string): Promise<VerifyResult> {
    const res = await fetch(`/api/verify-session?session_id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error('Failed to verify payment session');
    return res.json() as Promise<VerifyResult>;
  }
}

export type PaymentType = 'unlock' | 'creator';

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface VerifyResult {
  paid: boolean;
  type: PaymentType;
}

/**
 * PaymentProvider — swap implementations without touching UI code.
 * Current: StripeProvider (see src/payments/StripeProvider.ts)
 */
export interface PaymentProvider {
  readonly name: string;
  createSession(type: PaymentType): Promise<CheckoutSession>;
  verifySession(sessionId: string): Promise<VerifyResult>;
}

# VYDRYN — Payment Architecture

## Overview

Payments use a provider-based architecture defined in `src/payments/PaymentProvider.ts`.

The active provider is set at build time via `VITE_PAYMENT_PROVIDER`.

```
VITE_PAYMENT_PROVIDER=stripe   # production (current)
VITE_PAYMENT_PROVIDER=mock     # development (no real charges)
VITE_PAYMENT_PROVIDER=mollie   # future
```

---

## Current Provider: Stripe

The current implementation uses Stripe Hosted Checkout (popup flow).

### Setup

1. Create products in the Stripe dashboard:
   - "Remove watermark" — one-time, €0.99 → copy Price ID → `STRIPE_UNLOCK_PRICE_ID`
   - "Creator" — subscription, €8.99/month → copy Price ID → `STRIPE_CREATOR_PRICE_ID`

2. Set environment variables (see `.env.example`)

3. Configure the Stripe Success URL to point to your production domain:
   ```
   https://your-vydryn.vercel.app?session_id={CHECKOUT_SESSION_ID}&payment_type={type}
   ```

### Known Production Risks (Fix Before Scale)

| Risk | Severity | Notes |
|---|---|---|
| Creator entitlement is client-side (localStorage) | High | No server-side verification. A user who sets the localStorage key gets Creator for free. |
| No webhook validation | High | Payment status verified by polling, not by Stripe webhook. |
| No rate limiting on `/api/create-checkout-session` | Medium | Abuse could generate unlimited Stripe sessions. Add IP-based rate limiting. |
| No environment variable validation at startup | Low | Fixed — API routes now return 503 if env vars are missing. |
| No receipt emails | Low | Stripe sends these automatically if configured in the dashboard. |

---

## Mollie Migration Guide

When switching to Mollie:

1. Create `src/payments/MollieProvider.ts` implementing `PaymentProvider`:
   ```typescript
   import type { PaymentProvider, PaymentType, CheckoutSession, VerifyResult } from './PaymentProvider';

   export class MollieProvider implements PaymentProvider {
     readonly name = 'mollie';
     async createSession(type: PaymentType): Promise<CheckoutSession> {
       // Call your /api/create-mollie-payment endpoint
     }
     async verifySession(sessionId: string): Promise<VerifyResult> {
       // Call your /api/verify-mollie-payment endpoint
     }
   }
   ```

2. Create `/api/create-mollie-payment.ts` and `/api/verify-mollie-payment.ts`

3. Set `VITE_PAYMENT_PROVIDER=mollie` in production

4. The UI components do not need to change.

### Mollie-specific work required

- Mollie payment creation API call
- Mollie payment verification
- Mollie webhook handler (`/api/webhooks/mollie`)
- Server-side Creator subscription record (replaces localStorage)
- Webhook signature validation
- Idempotency handling

---

## Development

In development, `VITE_PAYMENT_PROVIDER` defaults to `mock`.

`MockProvider` simulates an instant successful payment so the full export flow
can be tested without any payment credentials.

To test the real Stripe flow locally, set:
```
VITE_PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
```

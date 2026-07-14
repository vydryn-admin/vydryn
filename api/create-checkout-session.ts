import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Environment validation (fail fast rather than exposing stack traces) ──────
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ConfigError('Payment service is not configured.');
  // Lazy-import Stripe so missing env var returns a clean 503, not a crash
  const Stripe = require('stripe');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

class ConfigError extends Error {}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only POST accepted
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate env before doing anything
  if (!process.env.STRIPE_SECRET_KEY ||
      !process.env.STRIPE_UNLOCK_PRICE_ID ||
      !process.env.STRIPE_CREATOR_PRICE_ID) {
    console.error('[create-checkout-session] Missing required environment variables');
    return res.status(503).json({ error: 'Payment service is not configured. Please try again later.' });
  }

  const { type } = req.body as { type: 'unlock' | 'creator' };

  if (type !== 'unlock' && type !== 'creator') {
    return res.status(400).json({ error: 'Invalid payment type' });
  }

  const priceId = type === 'creator'
    ? process.env.STRIPE_CREATOR_PRICE_ID
    : process.env.STRIPE_UNLOCK_PRICE_ID;

  const origin = (req.headers.origin as string) ?? process.env.VITE_APP_URL ?? 'http://localhost:5173';

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode:         type === 'creator' ? 'subscription' : 'payment',
      line_items:   [{ price: priceId, quantity: 1 }],
      success_url:  `${origin}?session_id={CHECKOUT_SESSION_ID}&payment_type=${type}`,
      cancel_url:   `${origin}?payment_cancelled=1`,
      payment_method_types: type === 'creator' ? undefined : ['card'],
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    if (err instanceof ConfigError) {
      return res.status(503).json({ error: err.message });
    }
    // Log the real error server-side; send a safe message to the client
    console.error('[create-checkout-session]', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
}

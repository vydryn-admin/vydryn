import type { VercelRequest, VercelResponse } from '@vercel/node';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Payment service is not configured.');
  const Stripe = require('stripe');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Payment service is not configured.' });
  }

  const { session_id } = req.query as { session_id: string };

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'session_id required' });
  }

  // Prevent session ID injection — must look like a Stripe CS ID
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(session_id)) {
    return res.status(400).json({ error: 'Invalid session_id format' });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paid = session.payment_status === 'paid' || session.status === 'complete';

    return res.status(200).json({
      paid,
      type: session.metadata?.payment_type ?? 'unlock',
    });
  } catch (err) {
    console.error('[verify-session]', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Could not verify payment. Please contact support.' });
  }
}

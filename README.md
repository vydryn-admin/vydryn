# VYDRYN — Making sound visible.

Turn any song into beautiful moving visuals in seconds.

## Stack

- **Frontend:** Vite + React 19 + TypeScript + WebGL2 + Web Audio API
- **Payments:** Provider-based architecture — currently Stripe (see `PAYMENTS.md`)
- **Deployment:** Vercel (frontend + serverless API routes)
- **No backend, no database, no auth**

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your credentials
npm run dev                  # http://localhost:5173
```

In development, `VITE_PAYMENT_PROVIDER` defaults to `mock` — the full export
and payment flow works without any payment credentials.

## Environment variables

See `.env.example` for all available variables and documentation.

| Variable | Required | Description |
|---|---|---|
| `VITE_PAYMENT_PROVIDER` | No | `stripe` (prod) or `mock` (dev). Defaults to `mock` in dev. |
| `STRIPE_SECRET_KEY` | Yes (Stripe) | Stripe secret key |
| `STRIPE_UNLOCK_PRICE_ID` | Yes (Stripe) | Price ID for €0.99 watermark removal |
| `STRIPE_CREATOR_PRICE_ID` | Yes (Stripe) | Price ID for €8.99/month Creator |
| `VITE_APP_URL` | Yes (prod) | Production URL for payment redirects |

## Deploy to Vercel

```bash
npm i -g vercel
vercel   # Framework: Vite, Build: npm run build, Output: dist
```

Or push to GitHub and import at [vercel.com/new](https://vercel.com/new).
Add all environment variables in Project Settings → Environment Variables.

## Architecture

```
api/
  create-checkout-session.ts   Creates payment session (current: Stripe)
  verify-session.ts            Verifies payment status

src/
  payments/
    PaymentProvider.ts         Abstract interface — swap providers here
    StripeProvider.ts          Stripe implementation
    MockProvider.ts            Development mock (no real charges)
    index.ts                   Active provider selected by VITE_PAYMENT_PROVIDER

  engine/
    AudioEngine.ts             Web Audio API, FFT analysis, file validation
    CanvasRenderer.ts          Canvas 2D styles — Liquid, Bloom, Tunnel, Pulse
    VoidPlasmaGL.ts            Prism style — WebGL2 shader, offscreen blit
    Watermark.ts               "Made with VYDRYN" signature
    Recorder.ts                MP4-first export, WebM fallback

  components/
    LandingPage.tsx            Fullscreen intro over live canvas
    ExportDialog.tsx           Export flow — ready state, download options
    PaymentSheet.tsx           Payment popup coordinator
    StylePreviews.tsx          Animated live preview per Style

  hooks/
    useCreatorStatus.ts        Creator subscription state (localStorage)

  payments/                    Provider abstraction (see PAYMENTS.md)
  shaders/                     WebGL2 GLSL source for Prism style
  styles/globals.css           All styles — no CSS modules
```

## Video export formats

| Browser | Output | Playable on |
|---|---|---|
| Chrome 130+ | `.mp4` (H.264) | All devices |
| Firefox | `.webm` (VP9) | Desktop, Android |
| Safari macOS | `.webm` | Desktop browsers |
| iOS Safari | `.webm` | ⚠ Not natively playable on iPhone |

For iPhone users, VYDRYN displays a note to convert via CapCut.
The export dialog shows the actual format before download.

A server-side conversion pipeline (FFmpeg on Cloudflare Workers or similar)
would resolve iOS compatibility completely — documented in `PAYMENTS.md`.

## Payments

See `PAYMENTS.md` for:
- Current Stripe setup guide
- Known production risks
- Mollie migration guide
- What needs building before scale

# VYDRYN — Launch Checklist

Work through this list top-to-bottom before making the URL public.

## Payments (see PAYMENTS.md for full setup guide)
- [ ] Payment provider credentials configured in Vercel env vars
- [ ] "Remove watermark" product created (one-time, €0.99)
- [ ] "Creator" product created (subscription, €8.99/month)
- [ ] Test purchase completed end-to-end in test mode
- [ ] Live mode credentials set (replace test credentials)
- [ ] Payment redirect URL matches production domain
- [ ] EU VAT configured if applicable

## Vercel
- [ ] Project imported from GitHub
- [ ] Framework preset: Vite
- [ ] All env vars set (see PAYMENTS.md and .env.example)
- [ ] `npm run build` passes with zero errors
- [ ] Production deployment preview tested

## App functionality
- [ ] Upload mp3 / wav / m4a — all three formats play
- [ ] All five Styles load and animate (Liquid, Bloom, Prism, Tunnel, Pulse)
- [ ] All controls respond
- [ ] All colour themes apply
- [ ] All aspect ratios resize correctly (9:16, 1:1, 16:9)
- [ ] Record → Stop → Export dialog appears
- [ ] "Download with watermark" downloads a .webm with "made with VYDRYN" watermark visible
- [ ] "Remove watermark" → payment flow opens → completed → clean file downloads
- [ ] "Become a Creator" → payment flow → Creator status set → all future exports are clean
- [ ] Creator status persists on page refresh (localStorage)
- [ ] Prism style (WebGL2) renders correctly on Chrome, Firefox, Safari
- [ ] Recording captures audio + video in the .webm file

## Browser targets
- [ ] Chrome 120+ (primary)
- [ ] Firefox 120+ (test WebGL2)
- [ ] Safari 17+ on macOS (test audio context, Apple Pay in Stripe)
- [ ] Mobile Chrome on Android
- [ ] Mobile Safari on iOS 16+

## Legal / compliance
- [ ] Privacy policy page or link
- [ ] Terms of service page or link
- [ ] Cookie notice (if using analytics)
- [ ] GDPR: no personal data stored client-side beyond Creator subscription flag

## Performance
- [ ] Lighthouse performance score ≥ 80 on desktop
- [ ] Canvas FPS ≥ 45 on 2020-era MacBook Air
- [ ] First meaningful paint ≤ 3s on fast 3G

## Final
- [ ] All console.error / console.warn cleared in production build
- [ ] No prototype or debug files in the production build
- [ ] README.md up to date
- [ ] Custom domain configured in Vercel

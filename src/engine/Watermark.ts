/**
 * Watermark — "Made with VYDRYN"
 * Drawn on the canvas during free recordings only.
 * Designed to feel like a signature, not a penalty.
 */
export const Watermark = {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const size = Math.max(11, Math.round(h * 0.012));
    const pad  = Math.round(h * 0.022);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign    = 'right';
    ctx.shadowColor  = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur   = size * 0.9;

    // "Made with" — quiet, smaller weight
    ctx.font         = `400 ${Math.round(size * 0.78)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle    = 'rgba(255,255,255,0.26)';
    ctx.fillText('Made with', w - pad, h - pad - Math.round(size * 1.15));

    // "VYDRYN" — the wordmark, slightly tracked
    ctx.font         = `700 ${size}px Inter, ui-sans-serif, sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle    = 'rgba(255,255,255,0.42)';
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0.06em';
    ctx.fillText('VYDRYN', w - pad, h - pad);
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0';

    ctx.restore();
  },
};

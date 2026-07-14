/**
 * StylePreviews — live animated mini-canvas per Style.
 * One shared RAF loop drives all 5 previews simultaneously.
 * Each preview uses the style's default theme colours and idle animation.
 */
import { useEffect, useRef } from 'react';
import { STYLES, THEMES, STYLE_THEMES } from '../types';

// ── Colour helper ─────────────────────────────────────────────────────────────
function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
}

// ── Liquid ────────────────────────────────────────────────────────────────────
function drawLiquid(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ti: number) {
  const [c1,c2,c3] = THEMES[ti];
  ctx.fillStyle = 'rgba(2,1,7,0.20)';
  ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation = 'lighter';
  const cols = [c1,c2,c3,c1,c2];
  for (let i=0;i<5;i++){
    const x = w/2 + Math.sin(t*0.68+i*2.09)*w*0.37;
    const y = h/2 + Math.cos(t*0.54+i*1.73)*h*0.36;
    const r = Math.min(w,h)*(0.27+0.07*Math.sin(t*0.38+i));
    const gr = ctx.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,  rgba(cols[i],0.30));
    gr.addColorStop(0.5,rgba(cols[(i+1)%3],0.10));
    gr.addColorStop(1,  'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  // Caustic shimmer
  for (let i=0;i<6;i++){
    const a = i/6*Math.PI*2+t*0.06;
    const r = Math.min(w,h)*(0.06+0.08*Math.abs(Math.sin(t*0.4+i)));
    const x1=w/2+Math.cos(a)*r, y1=h/2+Math.sin(a)*r;
    const x2=w/2+Math.cos(a+0.7+0.2*Math.sin(t*0.5))*(r+Math.min(w,h)*0.10);
    const y2=h/2+Math.sin(a+0.7+0.2*Math.sin(t*0.5))*(r+Math.min(w,h)*0.10);
    ctx.strokeStyle = rgba(c3, 0.06);
    ctx.lineWidth = 0.5;
    const mx=(x1+x2)/2+Math.sin(t*2+i)*10, my=(y1+y2)/2+Math.cos(t*1.5+i)*10;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(mx,my,x2,y2); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  const vig=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.max(w,h)*0.6);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(2,1,7,0.7)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
}

// ── Bloom ─────────────────────────────────────────────────────────────────────
function drawBloom(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ti: number) {
  const [c1,c2,c3] = THEMES[ti];
  ctx.fillStyle = 'rgba(2,1,7,0.42)';
  ctx.fillRect(0,0,w,h);
  ctx.save(); ctx.translate(w/2,h/2);
  ctx.globalCompositeOperation = 'lighter';
  const minD = Math.min(w,h);
  // 3 petal layers — outer cool, inner warm
  const layers: [number, number, number, string][] = [
    [6,  0.48, 0.020, c1],
    [10, 0.30, 0.035, c2],
    [16, 0.16, 0.058, c3],
  ];
  for (let li=0;li<layers.length;li++){
    const [n,len,spd,col] = layers[li];
    const L = minD*len*(1+0.08*Math.sin(t*0.5+li));
    const hw = L*0.19;
    const rot = t*spd + li*0.40;
    for (let p=0;p<n;p++){
      const ang = (p/n)*Math.PI*2 + rot + (li%2===0?0:Math.PI/n);
      ctx.save(); ctx.rotate(ang);
      const gr = ctx.createLinearGradient(0,0,0,L);
      gr.addColorStop(0.0, rgba(col, 0.48-li*0.08));
      gr.addColorStop(0.5, rgba(col, 0.22-li*0.05));
      gr.addColorStop(1.0, 'rgba(0,0,0,0)');
      ctx.fillStyle=gr;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.bezierCurveTo(hw,L*0.22, hw,L*0.78, 0,L);
      ctx.bezierCurveTo(-hw,L*0.78, -hw,L*0.22, 0,0);
      ctx.fill();
      ctx.restore();
    }
  }
  // Constant warm core
  const cg = ctx.createRadialGradient(0,0,0,0,0,minD*0.10);
  cg.addColorStop(0,'rgba(255,248,235,0.65)');
  cg.addColorStop(0.4, rgba(c1, 0.25));
  cg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,minD*0.10,0,Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation='source-over'; ctx.restore();
  ctx.setTransform(1,0,0,1,0,0);
}

// ── Tunnel ────────────────────────────────────────────────────────────────────
function drawTunnel(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ti: number) {
  const [c1,,c3] = THEMES[ti];
  ctx.fillStyle='#010107'; ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='lighter';
  const cx=w/2, cy=h/2, minD=Math.min(w,h);
  // Corridor beams
  for (let b=0;b<10;b++){
    const a=(b/10)*Math.PI*2+t*0.009;
    ctx.strokeStyle=rgba(b%2===0?c1:c3,0.08); ctx.lineWidth=0.7;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(a)*Math.max(w,h)*1.2, cy+Math.sin(a)*Math.max(w,h)*1.2);
    ctx.stroke();
  }
  // Scrolling rings
  for (let i=0;i<28;i++){
    const raw=((i/28)+t*0.32)%1.0;
    const safePos=((raw%1)+1)%1;
    const depth=1-safePos;
    if (depth<0.05) continue;
    const radius=minD*0.052/(depth+0.011);
    if (radius>minD*0.72) continue;
    const near=(1-depth)*(1-depth)*(1-depth);
    // Near=warm, far=cool
    const col=depth<0.5?c1:c3;
    ctx.strokeStyle=rgba(col,near*0.80);
    ctx.lineWidth=0.4+near*5;
    ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.stroke();
  }
  const vp=ctx.createRadialGradient(cx,cy,0,cx,cy,minD*0.18);
  vp.addColorStop(0,'rgba(255,255,255,0.20)'); vp.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=vp; ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='source-over';
}

// ── Pulse ─────────────────────────────────────────────────────────────────────
function drawPulse(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ti: number) {
  const [c1] = THEMES[ti];
  ctx.fillStyle='#010007'; ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='lighter';
  const cy=h/2, amp=h*0.28;
  // Center axis
  ctx.strokeStyle=rgba(c1,0.30); ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.moveTo(0,cy); ctx.lineTo(w,cy); ctx.stroke();
  // Mirrored waveform
  ctx.strokeStyle=c1; ctx.lineWidth=1.5; ctx.globalAlpha=0.88;
  const pts: number[]=[];
  for (let x=0;x<=w;x+=2){
    const p=x/w;
    pts.push((Math.sin(p*Math.PI*2*2.1+t*1.5)*0.38+Math.sin(p*Math.PI*2*4.7+t*2.3)*0.25+Math.sin(p*Math.PI*2*0.8+t*0.8)*0.30)*amp);
  }
  ctx.beginPath();
  pts.forEach((y,i)=>{ i===0?ctx.moveTo(i*2,cy-y):ctx.lineTo(i*2,cy-y); });
  ctx.stroke();
  ctx.beginPath();
  pts.forEach((y,i)=>{ i===0?ctx.moveTo(i*2,cy+y):ctx.lineTo(i*2,cy+y); });
  ctx.stroke();
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  const vig=ctx.createRadialGradient(w/2,cy,0,w/2,cy,Math.max(w,h)*0.6);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(1,0,7,0.85)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
}

// ── Prism ─────────────────────────────────────────────────────────────────────
function drawPrism(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, ti: number) {
  const [c1,c2,c3] = THEMES[ti];
  ctx.fillStyle='rgba(2,1,7,0.28)'; ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='lighter';
  const cx=w/2, cy=h/2;
  // Plasma base
  for (let i=0;i<4;i++){
    const x=cx+Math.sin(t*0.12+i*1.57)*w*0.30;
    const y=cy+Math.cos(t*0.09+i*1.57)*h*0.30;
    const r=Math.min(w,h)*(0.28+0.07*Math.sin(t*0.28+i));
    const gr=ctx.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,rgba([c1,c2,c3,c1][i],0.22));
    gr.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  // Crystal edges
  const hs=Math.min(w,h)*0.18;
  ctx.strokeStyle=rgba(c3,0.30); ctx.lineWidth=0.5;
  for (let gx=-hs;gx<w+hs;gx+=hs){
    for (let gy=0;gy<h+hs;gy+=hs*1.73){
      const ox=(gy/hs)%2===0?0:hs/2;
      ctx.beginPath(); ctx.moveTo(gx+ox+hs*0.5,gy); ctx.lineTo(gx+ox,gy+hs*0.87); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx+ox,gy+hs*0.87); ctx.lineTo(gx+ox+hs,gy+hs*0.87); ctx.stroke();
    }
  }
  // Light rays (prismatic signature)
  for (let r=0;r<6;r++){
    const angle=t*0.035+r*1.047;
    const rl=Math.min(w,h)*0.38;
    ctx.strokeStyle=[c1,c2,c3,c1,c2,c3][r];
    ctx.globalAlpha=0.10; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.lineTo(cx+Math.cos(angle)*rl, cy+Math.sin(angle)*rl); ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  const vig=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*0.6);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(2,1,7,0.60)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { activeStyle: string; onSelect: (id: string) => void; }

const DRAW_FNS: Record<string, (c:CanvasRenderingContext2D,w:number,h:number,t:number,ti:number)=>void> = {
  plasma:  drawLiquid,
  kaleido: drawBloom,
  tunnel:  drawTunnel,
  pulse:   drawPulse,
  void:    drawPrism,
};

export default function StylePreviews({ activeStyle, onSelect }: Props) {
  const refs = useRef<Record<string, HTMLCanvasElement | null>>({});

  useEffect(() => {
    let rafId: number;
    const start = performance.now();

    const tick = (ts: number) => {
      const t = (ts - start) / 1000;
      for (const s of STYLES) {
        const canvas = refs.current[s.id];
        if (!canvas) continue;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        const fn = DRAW_FNS[s.id];
        if (fn) fn(ctx, canvas.width, canvas.height, t, STYLE_THEMES[s.id] ?? 0);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <>
      {STYLES.map(s => (
        <button
          key={s.id}
          className={`style-card${activeStyle === s.id ? ' style-card--active' : ''}`}
          onClick={() => onSelect(s.id)}
          title={s.desc}
        >
          <div className="style-canvas-wrap">
            <canvas
              ref={el => { refs.current[s.id] = el; }}
              width={130}
              height={78}
            />
          </div>
          <span className="style-card__name">{s.name}</span>
        </button>
      ))}
    </>
  );
}

export const VERT_SRC = `#version 300 es
in vec2 aPos;

// ── Crystal facets (hexagonal grid) ──────────────────────────────────────────
float hexDist(vec2 p){
  p=abs(p);
  return max(dot(p,normalize(vec2(1.0,1.732))),p.x);
}
float hexGrid(vec2 p){
  vec2 q=fract(p*vec2(1.0,0.5774))-0.5;
  vec2 r=fract(p*vec2(1.0,0.5774)+0.5)-0.5;
  return hexDist(dot(q,q)<dot(r,r)?q:r);
}

void main(){gl_Position=vec4(aPos,0.0,1.0);}`;

export const FRAG_SRC = `#version 300 es
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform float u_bass, u_mid, u_high, u_vol;
uniform float u_kick, u_snare, u_hat, u_beat;
uniform float u_beatPhase;
uniform float u_intensity, u_speed, u_glow, u_complexity, u_particles;
uniform vec3  u_c1, u_c2, u_c3;

out vec4 fragColor;

// Hash & Noise
float hash(vec2 p){
  p=fract(p*vec2(127.1,311.7));
  p+=dot(p,p+45.32);
  return fract(p.x*p.y);
}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.02+vec2(1.7,9.2);a*=0.5;}
  return v;
}
float fbm3(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.02+vec2(3.1,7.4);a*=0.5;}
  return v;
}

// Palette: smooth blend across 3 user colours
vec3 palette(float t){
  t=fract(t);
  vec3 a=t<0.5?u_c1:u_c2;
  vec3 b=t<0.5?u_c2:u_c3;
  float u=t<0.5?t*2.0:(t-0.5)*2.0;
  return mix(a,b,smoothstep(0.0,1.0,u));
}

mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}


// ── Crystal facets (hexagonal grid) ──────────────────────────────────────────
float hexDist(vec2 p){
  p=abs(p);
  return max(dot(p,normalize(vec2(1.0,1.732))),p.x);
}
float hexGrid(vec2 p){
  vec2 q=fract(p*vec2(1.0,0.5774))-0.5;
  vec2 r=fract(p*vec2(1.0,0.5774)+0.5)-0.5;
  return hexDist(dot(q,q)<dot(r,r)?q:r);
}

void main(){
  // Aspect-correct UV centred at 0
  vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
  float t=u_time*u_speed;

  // Camera drift (figure-eight)
  float dt=t*0.022;
  uv+=vec2(sin(dt*0.78+1.2)*0.018, sin(dt*0.61+0.4)*cos(dt*0.42)*0.015);
  uv*=1.0-u_beat*0.045;
  uv=rot2(t*0.008+u_bass*0.022)*uv;
  uv+=vec2(sin(t*73.1),cos(t*67.3))*(u_kick*0.006+u_snare*0.003);

  // Coordinate space
  vec2 p=uv*(1.9+u_complexity*0.55);
  float heat=1.1+u_bass*2.9*u_intensity;
  float sp=t*0.088;

  // Two-level domain warp (Quilez technique)
  vec2 q=vec2(
    fbm(p+vec2(0.00,0.00)+sp),
    fbm(p+vec2(5.20,1.30)+sp*0.96)
  );
  vec2 r=vec2(
    fbm(p+heat*q+vec2(1.70,9.20)+sp*0.91),
    fbm(p+heat*q+vec2(8.30,2.80)+sp*0.87)
  );
  vec2 pW=p+heat*1.25*r;
  float f=fbm(pW+vec2(sp*0.055));
  float fd=fbm3(p*1.75+heat*0.55*vec2(r.y,r.x)+vec2(sp*0.07));

  // Chromatic aberration via per-channel palette phase offset
  float caAmt=0.085*length(uv)*u_glow;
  float fShift=f+t*0.031+u_mid*0.22;
  vec3 col;
  col.r=palette(fShift+caAmt).r;
  col.g=palette(fShift      ).g;
  col.b=palette(fShift-caAmt).b;

  vec3 col2=palette(fd*1.25+0.45+t*0.042+u_high*0.14);
  col=mix(col,col2,smoothstep(0.28,0.72,f)*0.42);

  // Energy veins (gradient magnitude at final FBM level)
  float ep=0.0055;
  float fR=fbm(pW+vec2(ep,0.0)+vec2(sp*0.055));
  float fU=fbm(pW+vec2(0.0,ep)+vec2(sp*0.055));
  float gradMag=length(vec2(fR-f,fU-f))/ep;

  float vein=smoothstep(0.28,1.65,gradMag*2.3);
  vec3 veinCol=mix(u_c1,u_c3,fd);
  col+=vein*veinCol*(0.45+u_bass*2.4)*u_glow;
  col+=smoothstep(0.75,2.6,gradMag*2.5)*mix(vec3(1.0,0.85,1.0),u_c3,fd)*(0.18+u_bass*0.55);

  // Star field — two depth layers (parallax)
  vec2 sfar=uv*88.0+vec2(sp*0.04,sp*0.02);
  vec2 sidfar=floor(sfar);
  float shfar=hash(sidfar);
  float sdistfar=length(fract(sfar)-0.5-(hash(sidfar+3.7)-0.5)*0.45);
  col+=smoothstep(0.09,0.0,sdistfar)*step(0.93,shfar)*(0.25+shfar*0.55)*(0.5+u_hat*2.2)*mix(u_c2,vec3(1.0),0.55);

  vec2 snear=uv*26.0+vec2(sp*0.09,sp*0.06);
  vec2 sidnear=floor(snear);
  float shnear=hash(sidnear);
  col+=smoothstep(0.13,0.0,length(fract(snear)-0.5-(hash(sidnear+7.1)-0.5)*0.5))*step(0.955,shnear)*(0.6+shnear*0.9)*(0.4+u_hat*1.8)*mix(u_c3,vec3(1.0),0.45);

  // Hi-hat sparkle bursts
  vec2 sp1=uv*155.0+vec2(t*1.4,t*1.1);
  vec2 sp2=uv*240.0-vec2(t*0.8,t*1.6);
  col+=(step(0.989,hash(floor(sp1)))+step(0.993,hash(floor(sp2)))*0.6)*u_hat*mix(u_c2,u_c3,fd)*2.8;

  // Beat shockwave rings
  float dist=length(uv);
  float ringR=u_beatPhase*1.7;
  float ringFade=smoothstep(1.0,0.1,u_beatPhase);
  float ringW=0.048+u_beat*0.032;
  col+=smoothstep(ringW,0.001,abs(dist-ringR))*u_beat*ringFade*mix(u_c1,u_c2,u_beatPhase)*3.8;

  float ring2R=max(0.0,u_beatPhase-0.17)*1.7;
  col+=smoothstep(ringW*1.5,0.001,abs(dist-ring2R))*u_beat*ringFade*0.45*mix(u_c1,u_c3,u_beatPhase)*2.0;

  float ring3R=max(0.0,u_beatPhase-0.34)*1.7;
  col+=smoothstep(ringW*2.2,0.001,abs(dist-ring3R))*u_beat*ringFade*0.18*u_c3*1.5;

  // Bass core glow
  col+=smoothstep(0.65,0.0,dist)*u_bass*0.6*mix(u_c1,vec3(0.75,0.35,1.0),0.45)*u_glow;


  // ── Crystal facets — hexagonal structure, sharper and more visible ─────
  float hexScale=5.2+u_complexity*1.4;
  float hex=hexGrid((uv*rot2(t*0.006)+vec2(t*0.010,t*0.007))*hexScale);
  // Facet fill: subtle colour shift inside each cell
  float facetEdge=smoothstep(0.12,0.05,hex-0.40);
  col+=facetEdge*mix(u_c2,u_c3,fDetail+u_mid*0.25)*(0.28+u_bass*0.40)*u_glow;
  // Hard crystal edge — this is the "cut glass" signature line
  float crystalLine=smoothstep(0.025,0.0,abs(hex-0.46));
  col+=crystalLine*mix(u_c1,vec3(0.95,0.98,1.0),0.7)*(0.30+u_bass*0.50);
  // Secondary inner edge (gives facets a bevel feel)
  float bevelLine=smoothstep(0.018,0.0,abs(hex-0.52));
  col+=bevelLine*u_c3*(0.12+u_mid*0.18);

  // ── Directional light rays — light fanning through the crystal ───────────
  // These are the signature of real prismatic refraction.
  float rayAngle=atan(uv.y,uv.x);
  float rayPattern=pow(max(0.0,sin(rayAngle*9.0+fDetail*2.5+t*0.035)),7.0);
  rayPattern*=exp(-length(uv)*1.2);                    // falloff from centre
  vec3 rayCol=mix(u_c1,u_c3,fract(rayAngle/3.14159)); // spectrum across angle
  col+=rayPattern*rayCol*(0.25+u_bass*0.35);

  // Snare flash
  col+=u_snare*0.22*u_glow*smoothstep(0.8,0.0,dist);

  // Radial depth atmosphere
  float radial=1.0-smoothstep(0.42,1.32,dist*0.84);
  col*=radial*radial;
  col+=(1.0-radial*radial)*vec3(0.04,0.02,0.09)*0.5;

  // Mid saturation breathing
  float lum=dot(col,vec3(0.299,0.587,0.114));
  col=mix(vec3(lum),col,0.78+u_mid*0.5);

  // Volume envelope + self-feedback
  col*=0.42+u_vol*0.90;
  col+=col*col*u_vol*0.2;

  // Film grain
  col+=(hash(gl_FragCoord.xy+fract(u_time*97.0)*314.0)-0.5)*0.032;

  // ACES tone mapping + gamma
  col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
  col=pow(max(col,0.0),vec3(1.0/2.2));

  fragColor=vec4(col,1.0);
}`;

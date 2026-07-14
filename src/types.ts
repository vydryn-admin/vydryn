export interface AudioFeatures {
  bass: number; mid: number; high: number; vol: number;
  kick: number; snare: number; hat: number; beat: number;
}
export interface Settings {
  intensity: number; speed: number; glow: number; complexity: number;
  shake: number; particles: number; crt: number; zoom: number;
}
export const DEFAULT_SETTINGS: Settings = {
  intensity: 1.15, speed: 1, glow: 0.82, complexity: 1.2,
  shake: 0.32, particles: 0.72, crt: 0.42, zoom: 1,
};
export const THEMES: string[][] = [
  ['#ff2bd6','#7b2fff','#21ffe2'],
  ['#ff5a00','#ff006e','#ffd000'],
  ['#00ffd5','#0077ff','#b14cff'],
  ['#ffffff','#7f8cff','#15152a'],
  ['#00ff99','#ffe600','#ff2bd6'],
];
// Default colour theme per style — applied automatically unless user overrides
export const STYLE_THEMES: Record<string, number> = {
  plasma: 0, tunnel: 1, kaleido: 2, void: 2, pulse: 3,
};
export interface Style { id: string; name: string; desc: string; }
export const STYLES: Style[] = [
  { id: 'plasma',  name: 'Liquid', desc: 'Soft plasma that flows and breathes with your music.' },
  { id: 'tunnel',  name: 'Tunnel', desc: 'Light streams that rush forward on every beat.' },
  { id: 'kaleido', name: 'Bloom',  desc: 'Radial symmetry that erupts with every transient.' },
  { id: 'void',    name: 'Prism',  desc: 'Deep shader fields with living energy veins.' },
  { id: 'pulse',   name: 'Pulse',  desc: 'Elegant waveform lines that trace the shape of sound.' },
];
// One primary control visible by default
export const PRIMARY_CONTROLS: Array<[keyof Settings, string, number, number]> = [
  ['intensity', 'Intensity', 0, 2],
];
// Everything else lives in Advanced (includes Speed, Glow, Color is handled separately)
export const ADVANCED_CONTROLS: Array<[keyof Settings, string, number, number]> = [
  ['speed',      'Speed',      0.2, 2.5],
  ['glow',       'Glow',       0,   2  ],
  ['complexity', 'Detail',     0.2, 2.2],
  ['shake',      'Impact',     0,   1  ],
  ['particles',  'Particles',  0,   2  ],
  ['crt',        'Texture',    0,   1  ],
  ['zoom',       'Zoom',       0,   2  ],
];
export const FORMAT_DIMS: Record<string, [number, number]> = {
  '916': [1080,1920], '11': [1080,1080], '169': [1920,1080],
};
export const FORMAT_LABELS: Record<string, string> = {
  '916': '9:16', '11': '1:1', '169': '16:9',
};

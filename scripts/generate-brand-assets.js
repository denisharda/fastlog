// Generates /assets/icon.png, /assets/adaptive-icon.png, /assets/splash.png,
// /assets/favicon.png from the FastLog brand marks in .claude/design/brand.jsx.
//
// Run: node scripts/generate-brand-assets.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets');

const LIGHT = {
  bg: '#FBF6EE',
  surface2: '#F5EEE2',
  primary: '#C8621B',
  text: '#2A1F14',
  textFaint: '#A8957A',
  phases: ['#E8C89A', '#E6A86B', '#D88845', '#C8621B', '#A04418', '#6B2A12'],
};

// Ports .claude/design/brand.jsx:RingMark — 6 phase arcs with configurable gap.
function ringMarkSvg({ size, stroke, phases, gap = 4, rotate = -90 }) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const seg = circ / phases.length;
  const gapLen = (gap * circ) / 360;

  const arcs = phases
    .map((col, i) => {
      const len = seg - gapLen;
      const offset = -i * seg;
      return `<circle cx="${c}" cy="${c}" r="${r}" fill="none"
        stroke="${col}" stroke-width="${stroke}" stroke-linecap="butt"
        stroke-dasharray="${len} ${circ}" stroke-dashoffset="${offset}"
        transform="rotate(${rotate} ${c} ${c})" />`;
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${arcs}
</svg>`;
}

// App icon — iOS fills the corners; use a flat cream bg with the ring centered.
function iconSvg(size) {
  const t = LIGHT;
  const ring = ringMarkSvg({
    size: size * 0.6,
    stroke: size * 0.6 * 0.19,
    phases: t.phases,
    gap: 5,
  });
  const ringX = size * 0.2;
  const ringY = size * 0.2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${t.bg}" />
      <stop offset="55%" stop-color="${t.surface2}" />
      <stop offset="100%" stop-color="${t.phases[1]}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="50%">
      <stop offset="0%" stop-color="${t.primary}" stop-opacity="0.28" />
      <stop offset="70%" stop-color="${t.primary}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" />
  <rect width="${size}" height="${size}" fill="url(#glow)" />
  <g transform="translate(${ringX} ${ringY})">
    ${ring.replace(/^<svg[^>]*>|<\/svg>$/g, '')}
  </g>
</svg>`;
}

// Splash — cream bg with the ring centered (static first-frame of brand.jsx:Splash).
function splashSvg(width, height) {
  const t = LIGHT;
  const ringSize = Math.min(width, height) * 0.32;
  const stroke = ringSize * 0.19;
  const ring = ringMarkSvg({
    size: ringSize,
    stroke,
    phases: t.phases,
    gap: 4,
  });
  const ringX = (width - ringSize) / 2;
  const ringY = (height - ringSize) / 2 - ringSize * 0.1;

  const wordmarkY = ringY + ringSize + stroke + 48;
  const eyebrowY = height - Math.max(72, height * 0.07);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="amb" cx="50%" cy="${(ringY / height) * 100 + 8}%" r="38%">
      <stop offset="0%" stop-color="${t.primary}" stop-opacity="0.22" />
      <stop offset="80%" stop-color="${t.primary}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="${t.bg}" />
  <rect width="${width}" height="${height}" fill="url(#amb)" />
  <g transform="translate(${ringX} ${ringY})">
    ${ring.replace(/^<svg[^>]*>|<\/svg>$/g, '')}
  </g>
  <text x="${width / 2}" y="${wordmarkY}" text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro', system-ui, sans-serif"
    font-size="${Math.round(ringSize * 0.22)}" font-weight="700" letter-spacing="-1.2"
    fill="${t.text}">Fast<tspan fill="${t.primary}">Log</tspan></text>
  <text x="${width / 2}" y="${eyebrowY}" text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro', system-ui, sans-serif"
    font-size="${Math.round(ringSize * 0.06)}" font-weight="600" letter-spacing="2"
    fill="${t.textFaint}">FASTING, PHASE BY PHASE</text>
</svg>`;
}

// Adaptive icon foreground (Android) — ring only on transparent, since
// app.config.ts supplies the cream backgroundColor.
function adaptiveForegroundSvg(size) {
  const inner = size * 0.62; // safe zone
  const ring = ringMarkSvg({
    size: inner,
    stroke: inner * 0.19,
    phases: LIGHT.phases,
    gap: 5,
  });
  const offset = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${offset} ${offset})">
    ${ring.replace(/^<svg[^>]*>|<\/svg>$/g, '')}
  </g>
</svg>`;
}

async function rasterize(svg, outPath, { width, height, flatten }) {
  let pipeline = sharp(Buffer.from(svg), { density: 384 }).resize(width, height);
  if (flatten) pipeline = pipeline.flatten({ background: flatten });
  await pipeline.png().toFile(outPath);
  console.log(`  wrote ${path.relative(ROOT, outPath)} (${width}×${height})`);
}

async function main() {
  console.log('Generating FastLog brand assets…');

  // iOS icon — 1024×1024, no alpha (Apple requires it).
  await rasterize(iconSvg(1024), path.join(OUT, 'icon.png'), {
    width: 1024,
    height: 1024,
    flatten: LIGHT.bg,
  });

  // Android adaptive foreground — 1024×1024 with transparent bg.
  await rasterize(adaptiveForegroundSvg(1024), path.join(OUT, 'adaptive-icon.png'), {
    width: 1024,
    height: 1024,
  });

  // Splash — 2732×2732 square canvas (Expo scales down per-device).
  await rasterize(splashSvg(2732, 2732), path.join(OUT, 'splash.png'), {
    width: 2732,
    height: 2732,
    flatten: LIGHT.bg,
  });

  // Favicon — 48×48.
  await rasterize(iconSvg(256), path.join(OUT, 'favicon.png'), {
    width: 48,
    height: 48,
    flatten: LIGHT.bg,
  });

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

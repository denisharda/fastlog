// Generates 1024×1024 subscription review screenshots for App Store Connect.
// Output: assets/review-monthly.png, assets/review-yearly.png
//
// Run: node scripts/generate-review-screenshots.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets');

const T = {
  bg: '#FBF6EE',
  surface: '#FFFFFF',
  surface2: '#F5EEE2',
  text: '#2A1F14',
  textMuted: '#6B5A44',
  textFaint: '#A8957A',
  hairline: 'rgba(42,31,20,0.08)',
  primary: '#C8621B',
  accent: '#D89B2B',
  phases: ['#E8C89A', '#E6A86B', '#D88845', '#C8621B', '#A04418', '#6B2A12'],
};

const FEATURES = [
  'Full fasting history',
  'Custom protocols (8–72h)',
  'Scheduled recurring fasts',
  'Share &amp; export your data',
];

function ringArcs({ size, stroke, phases, gap = 5, rotate = -90 }) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const seg = circ / phases.length;
  const gapLen = (gap * circ) / 360;
  return phases
    .map((col, i) => {
      const len = seg - gapLen;
      const offset = -i * seg;
      return `<circle cx="${c}" cy="${c}" r="${r}" fill="none"
        stroke="${col}" stroke-width="${stroke}" stroke-linecap="butt"
        stroke-dasharray="${len} ${circ}" stroke-dashoffset="${offset}"
        transform="rotate(${rotate} ${c} ${c})" />`;
    })
    .join('\n    ');
}

function checkmark(x, y, size, color) {
  return `<g transform="translate(${x} ${y})">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${color}" fill-opacity="0.15" />
    <path d="M${size * 0.3} ${size * 0.5} L${size * 0.45} ${size * 0.65} L${size * 0.72} ${size * 0.35}"
      stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  </g>`;
}

function reviewSvg({ productLabel, price, subPrice, badge }) {
  const W = 1024;
  const H = 1024;

  // Ring top
  const ringSize = 200;
  const ringStroke = 38;
  const ringX = (W - ringSize) / 2;
  const ringY = 100;

  // Wordmark
  const wordY = ringY + ringSize + 60;

  // Product pill
  const pillY = wordY + 40;

  // Title
  const titleY = pillY + 70;

  // Price
  const priceY = titleY + 100;
  const subPriceY = priceY + 44;

  // Features list
  const featStartY = subPriceY + 70;
  const featGap = 56;

  const ring = ringArcs({
    size: ringSize,
    stroke: ringStroke,
    phases: T.phases,
    gap: 5,
  });

  const features = FEATURES.map((f, i) => {
    const y = featStartY + i * featGap;
    return `${checkmark(W / 2 - 180, y - 16, 32, T.primary)}
    <text x="${W / 2 - 132}" y="${y + 8}" font-family="-apple-system, SF Pro Rounded, sans-serif"
      font-size="22" font-weight="500" fill="${T.text}" letter-spacing="-0.2">${f}</text>`;
  }).join('\n    ');

  const badgeSvg = badge
    ? `<g>
      <rect x="${W / 2 - 90}" y="${pillY - 14}" width="180" height="32" rx="16"
        fill="${T.primary}" />
      <text x="${W / 2}" y="${pillY + 8}" text-anchor="middle"
        font-family="-apple-system, SF Pro Rounded, sans-serif"
        font-size="13" font-weight="700" fill="#FFFFFF" letter-spacing="1.2">${badge}</text>
    </g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="18%" r="42%">
      <stop offset="0%" stop-color="${T.primary}" stop-opacity="0.22" />
      <stop offset="80%" stop-color="${T.primary}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${T.bg}" />
  <rect width="${W}" height="${H}" fill="url(#glow)" />

  <!-- Phase ring mark -->
  <g transform="translate(${ringX} ${ringY})">
    ${ring}
  </g>

  <!-- Wordmark: FastLog (Log in primary) -->
  <text x="${W / 2}" y="${wordY}" text-anchor="middle"
    font-family="-apple-system, SF Pro Rounded, sans-serif"
    font-size="52" font-weight="700" letter-spacing="-1.8" fill="${T.text}">
    Fast<tspan fill="${T.primary}">Log</tspan>
  </text>

  <!-- Product badge -->
  ${badgeSvg}

  <!-- Product label -->
  ${badge
    ? ''
    : `<text x="${W / 2}" y="${pillY + 8}" text-anchor="middle"
    font-family="-apple-system, SF Pro Rounded, sans-serif"
    font-size="13" font-weight="700" fill="${T.textFaint}" letter-spacing="2">${productLabel.toUpperCase()}</text>`}

  <!-- Title -->
  <text x="${W / 2}" y="${titleY}" text-anchor="middle"
    font-family="-apple-system, SF Pro Rounded, sans-serif"
    font-size="42" font-weight="700" fill="${T.text}" letter-spacing="-1">
    FastLog Pro
  </text>

  <!-- Price -->
  <text x="${W / 2}" y="${priceY}" text-anchor="middle"
    font-family="-apple-system, SF Pro Rounded, sans-serif"
    font-size="56" font-weight="700" fill="${T.primary}" letter-spacing="-1.2">
    ${price}
  </text>

  <!-- Sub price -->
  <text x="${W / 2}" y="${subPriceY}" text-anchor="middle"
    font-family="-apple-system, SF Pro Rounded, sans-serif"
    font-size="18" font-weight="500" fill="${T.textMuted}" letter-spacing="-0.2">
    ${subPrice}
  </text>

  <!-- Features list -->
  ${features}

  <!-- Footer caption -->
  <text x="${W / 2}" y="${H - 50}" text-anchor="middle"
    font-family="-apple-system, SF Pro Rounded, sans-serif"
    font-size="14" font-weight="500" fill="${T.textFaint}" letter-spacing="-0.1">
    Auto-renewing subscription. Cancel anytime.
  </text>
</svg>`;
}

async function rasterize(svg, outPath) {
  await sharp(Buffer.from(svg), { density: 192 })
    .resize(1024, 1024)
    .flatten({ background: T.bg })
    .png()
    .toFile(outPath);
  console.log(`  wrote ${path.relative(ROOT, outPath)}`);
}

async function main() {
  console.log('Generating subscription review screenshots…');

  const monthly = reviewSvg({
    productLabel: 'Monthly',
    price: '$5.99 / month',
    subPrice: 'Billed monthly · renews each month',
    badge: null,
  });

  const yearly = reviewSvg({
    productLabel: 'Annual',
    price: '$39.99 / year',
    subPrice: '$3.33 / month · billed annually · save 44%',
    badge: 'BEST VALUE',
  });

  await rasterize(monthly, path.join(OUT, 'review-monthly.png'));
  await rasterize(yearly, path.join(OUT, 'review-yearly.png'));

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

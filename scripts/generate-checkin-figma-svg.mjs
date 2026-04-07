import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checkinDir = path.join(root, 'assets', 'design-v6', 'checkin');
const outputDir = path.join(root, 'docs', 'figma');
const outputFile = path.join(outputDir, 'checkin-signin-artboard.svg');

const rewardIconMap = {
  coin: path.join(root, 'assets', 'design-v5', 'clean', 'icon_coin.png'),
  hint: path.join(root, 'assets', 'design-v2', 'clean', 'icon_hint.png'),
  theme: path.join(root, 'assets', 'design-v2', 'clean', 'icon_theme.png'),
};

function dataUri(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const base64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${base64}`;
}

function escapeXml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function rewardPill({ x, y, width, height, icon, qty, fontSize, iconSize, stroke = '#b48858' }) {
  const radius = Math.round(height / 2);
  return `
    <g class="reward-pill" transform="translate(${x} ${y})">
      <rect width="${width}" height="${height}" rx="${radius}" fill="rgba(255,255,255,0.92)" stroke="${stroke}" />
      <image href="${icon}" x="8" y="${(height - iconSize) / 2}" width="${iconSize}" height="${iconSize}" />
      <text x="${width - 10}" y="${height / 2 + fontSize * 0.34}" text-anchor="end"
        font-family="'Nunito','Microsoft YaHei','PingFang SC',sans-serif"
        font-size="${fontSize}" font-weight="900" fill="#624027">${escapeXml(qty)}</text>
    </g>`;
}

const assets = {
  sheet: dataUri(path.join(checkinDir, 'checkin_sheet_cut.png')),
  ribbon: dataUri(path.join(checkinDir, 'checkin_ribbon_cut.png')),
  card: dataUri(path.join(checkinDir, 'checkin_day_card_cut.png')),
  cardClaimed: dataUri(path.join(checkinDir, 'checkin_day_card_claimed_cut.png')),
  day7: dataUri(path.join(checkinDir, 'checkin_day7_panel_cut.png')),
  snake: dataUri(path.join(checkinDir, 'checkin_mascot_snake_cut.png')),
  coin: dataUri(rewardIconMap.coin),
  hint: dataUri(rewardIconMap.hint),
  theme: dataUri(rewardIconMap.theme),
};

const dayCards = [
  { id: 'day-1', title: '第1天', qty: 'x30', icon: assets.coin, x: 40, y: 0, claimed: true },
  { id: 'day-2', title: '第2天', qty: 'x40', icon: assets.coin, x: 250, y: 0, next: true },
  { id: 'day-3', title: '第3天', qty: 'x50', icon: assets.coin, x: 460, y: 0 },
  { id: 'day-4', title: '第4天', qty: 'x1', icon: assets.hint, x: 40, y: 190 },
  { id: 'day-5', title: '第5天', qty: 'x70', icon: assets.coin, x: 250, y: 190 },
  { id: 'day-6', title: '第6天', qty: 'x2', icon: assets.theme, x: 460, y: 190 },
];

const cardSvg = dayCards.map((card) => {
  const pill = rewardPill({
    x: 34,
    y: 100,
    width: 72,
    height: 22,
    icon: card.icon,
    qty: card.qty,
    fontSize: 14,
    iconSize: 18,
  });

  return `
    <g id="${card.id}" class="checkin-day${card.claimed ? ' is-claimed' : ''}${card.next ? ' is-next' : ''}" transform="translate(${card.x} ${card.y})">
      ${card.next ? '<rect x="-6" y="-6" width="152" height="173" rx="24" fill="none" stroke="#f2c98c" stroke-width="4" opacity="0.92" filter="url(#nextGlow)" />' : ''}
      <image href="${card.claimed ? assets.cardClaimed : assets.card}" width="140" height="161" />
      <text x="70" y="28" text-anchor="middle"
        font-family="'ZCOOL KuaiLe','Nunito','Microsoft YaHei',sans-serif"
        font-size="16" font-weight="900" fill="${card.claimed ? '#3e6121' : '#8a5427'}">${escapeXml(card.title)}</text>
      ${pill}
    </g>`;
}).join('\n');

const day7Svg = `
  <g id="day-7" class="checkin-day day-7" transform="translate(290 494)">
    <image href="${assets.day7}" width="400" height="137.5" />
    <text x="68" y="52"
      font-family="'ZCOOL KuaiLe','Nunito','Microsoft YaHei',sans-serif"
      font-size="44" font-weight="900" fill="#8a5427">第7天</text>
    ${rewardPill({
      x: 248,
      y: 67,
      width: 102,
      height: 34,
      icon: assets.theme,
      qty: 'x1',
      fontSize: 20,
      iconSize: 30,
      stroke: '#b17b3c',
    })}
  </g>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="980" height="760" viewBox="0 0 980 760" fill="none">
  <defs>
    <linearGradient id="sceneBg" x1="140" y1="80" x2="820" y2="700" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2f4077"/>
      <stop offset="1" stop-color="#11172a"/>
    </linearGradient>
    <radialGradient id="ctaHighlight" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(298 698) rotate(40) scale(118 84)">
      <stop stop-color="#fff8e7" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#fff8e7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ctaFill" x1="490" y1="688" x2="490" y2="740" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff0d0"/>
      <stop offset="0.56" stop-color="#f8d8a2"/>
      <stop offset="1" stop-color="#e7b576"/>
    </linearGradient>
    <filter id="ctaShadow" x="150" y="680" width="680" height="90" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="#503115" flood-opacity="0.18"/>
    </filter>
    <filter id="nextGlow" x="-20" y="-20" width="180" height="210" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#f9cc8b" flood-opacity="0.55"/>
    </filter>
  </defs>

  <g id="artboard">
    <rect id="scene-background" width="980" height="760" fill="url(#sceneBg)" />

    <g id="checkin-sheet">
      <image href="${assets.sheet}" width="980" height="760" />
    </g>

    <g id="checkin-ribbon" transform="translate(230 44)">
      <image href="${assets.ribbon}" width="520" height="170" />
      <text x="260" y="77" text-anchor="middle"
        font-family="'ZCOOL KuaiLe','Nunito','Microsoft YaHei',sans-serif"
        font-size="54" font-weight="900" letter-spacing="2" fill="#8d5327">签到</text>
    </g>

    <g id="checkin-grid" transform="translate(170 134)">
      ${cardSvg}
    </g>

    ${day7Svg}

    <g id="claim-button" filter="url(#ctaShadow)">
      <rect x="170" y="688" width="640" height="52" rx="16" fill="url(#ctaFill)" stroke="#e7c38f" stroke-width="2" />
      <rect x="170" y="688" width="640" height="52" rx="16" fill="url(#ctaHighlight)" />
      <text x="490" y="722" text-anchor="middle"
        font-family="'ZCOOL KuaiLe','Nunito','Microsoft YaHei',sans-serif"
        font-size="27" font-weight="900" letter-spacing="1" fill="#6b4125">领取签到奖励</text>
    </g>

    <g id="status-area">
      <text x="490" y="756" text-anchor="middle"
        font-family="'Nunito','Microsoft YaHei','PingFang SC',sans-serif"
        font-size="16" font-weight="900" fill="#7d5431">可领取第2天奖励</text>
    </g>

    <g id="snake-mascot" transform="translate(790 562)">
      <image href="${assets.snake}" width="132" height="176" />
    </g>
  </g>
</svg>
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, svg, 'utf8');
console.log(outputFile);

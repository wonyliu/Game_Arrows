const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const THEMES = {
    arcadeFantasy: {
        name: 'arcadeFantasy',
        palette: [
            'rgba(0,0,0,0)',
            '#140f2e',
            '#2a1e59',
            '#3f2b87',
            '#6347c5',
            '#56b8ff',
            '#76ffe2',
            '#ffe26d',
            '#ff7a8e',
            '#ffffff',
            '#2f1c12',
            '#70452b',
            '#c08a53',
            '#88ff7a'
        ],
        boardBg: '#120f2a',
        boardFrame: '#2d2370'
    }
};

const MATRICES = {
    lineBodyH: [
        [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
        [0,1,3,3,3,3,3,3,3,3,3,3,1,0],
        [1,3,4,5,5,5,5,5,5,5,5,4,3,1],
        [1,3,5,6,6,5,6,6,5,6,6,5,3,1],
        [1,3,4,5,5,5,5,5,5,5,5,4,3,1],
        [0,1,3,3,3,3,3,3,3,3,3,3,1,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,0,0]
    ],
    lineBodyV: [
        [0,0,1,1,1,1,0],
        [0,1,3,3,3,3,1],
        [1,3,4,5,4,3,1],
        [1,3,5,6,5,3,1],
        [1,3,4,5,4,3,1],
        [1,3,5,6,5,3,1],
        [1,3,4,5,4,3,1],
        [1,3,5,6,5,3,1],
        [1,3,4,5,4,3,1],
        [0,1,3,3,3,3,1],
        [0,0,1,1,1,1,0]
    ],
    flowMarkRight: [
        [0,0,0,7,0,0],
        [0,0,7,9,7,0],
        [0,7,9,9,9,7],
        [0,0,7,9,7,0],
        [0,0,0,7,0,0]
    ],
    headRight: [
        [0,0,0,0,7,7,0,0,0,0],
        [0,0,0,7,9,9,7,0,0,0],
        [0,0,7,9,5,9,9,7,0,0],
        [0,7,9,6,9,5,9,9,7,0],
        [7,9,6,9,9,9,5,9,9,7],
        [7,9,6,9,9,9,5,9,9,7],
        [0,7,9,6,9,5,9,9,7,0],
        [0,0,7,9,5,9,9,7,0,0],
        [0,0,0,7,9,9,7,0,0,0],
        [0,0,0,0,7,7,0,0,0,0]
    ],
    tailRing: [
        [0,0,1,1,1,0,0],
        [0,1,5,5,5,1,0],
        [1,5,0,0,0,5,1],
        [1,5,0,9,0,5,1],
        [1,5,0,0,0,5,1],
        [0,1,5,5,5,1,0],
        [0,0,1,1,1,0,0]
    ],
    gridDot: [
        [0,1,1,1,0],
        [1,3,3,3,1],
        [1,3,5,3,1],
        [1,3,3,3,1],
        [0,1,1,1,0]
    ],
    tileBase: [
        [2,2,2,1,2,2,2,2],
        [2,2,3,2,2,2,3,2],
        [2,3,2,2,2,1,2,2],
        [2,2,2,3,2,2,2,2],
        [1,2,2,2,3,2,2,2],
        [2,2,3,2,2,2,2,1],
        [2,2,2,2,2,3,2,2],
        [2,1,2,2,2,2,2,2]
    ],
    tileVar1: [
        [2,2,1,2,2,2,3,2],
        [2,3,2,2,1,2,2,2],
        [2,2,2,3,2,2,2,1],
        [1,2,2,2,2,3,2,2],
        [2,2,3,2,2,2,2,2],
        [2,1,2,2,3,2,2,2],
        [2,2,2,1,2,2,3,2],
        [3,2,2,2,2,1,2,2]
    ],
    tileVar2: [
        [2,3,2,2,2,2,1,2],
        [2,2,2,1,2,3,2,2],
        [1,2,3,2,2,2,2,2],
        [2,2,2,2,1,2,2,3],
        [2,1,2,2,2,2,3,2],
        [2,2,2,3,2,1,2,2],
        [3,2,2,2,2,2,1,2],
        [2,2,1,2,3,2,2,2]
    ],
    decoRune: [
        [0,1,1,1,1,0],
        [1,11,11,11,11,1],
        [1,11,9,9,11,1],
        [1,11,9,9,11,1],
        [1,11,11,11,11,1],
        [0,1,1,1,1,0]
    ],
    decoTorch: [
        [0,7,7,0],
        [7,8,8,7],
        [0,7,7,0],
        [1,10,10,1],
        [1,10,10,1],
        [1,10,10,1],
        [1,10,10,1],
        [1,1,1,1]
    ],
    particleSquare: [
        [1,1,1,1],
        [1,7,7,1],
        [1,7,7,1],
        [1,1,1,1]
    ],
    particleStar: [
        [0,0,7,7,0,0],
        [0,7,9,9,7,0],
        [7,9,7,7,9,7],
        [7,9,7,7,9,7],
        [0,7,9,9,7,0],
        [0,0,7,7,0,0]
    ]
};

const SPRITE_CACHE = new Map();

function createSurface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function spriteCacheKey(name, scale, paletteKey) {
    return `${name}:${scale}:${paletteKey}`;
}

export function getThemePalette(themeName = 'arcadeFantasy') {
    return THEMES[themeName] || THEMES.arcadeFantasy;
}

export function renderSprite(name, matrix, palette, scale = 3) {
    const paletteKey = palette.join('|');
    const key = spriteCacheKey(name, scale, paletteKey);
    if (SPRITE_CACHE.has(key)) {
        return SPRITE_CACHE.get(key);
    }

    const rows = matrix.length;
    const cols = matrix[0]?.length || 0;
    const canvas = createSurface(cols * scale, rows * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const index = matrix[row][col];
            const color = palette[index] || palette[0];
            if (!color || color === 'rgba(0,0,0,0)') continue;
            ctx.fillStyle = color;
            ctx.fillRect(col * scale, row * scale, scale, scale);
        }
    }

    const sprite = { name, canvas, width: canvas.width, height: canvas.height, scale, matrix };
    SPRITE_CACHE.set(key, sprite);
    return sprite;
}

export function renderSpriteSheet(name, frames, palette, scale = 3) {
    const frameSprites = frames.map((frame, index) => renderSprite(`${name}-${index}`, frame, palette, scale));
    const width = frameSprites.reduce((sum, sprite) => sum + sprite.width, 0);
    const height = frameSprites.reduce((max, sprite) => Math.max(max, sprite.height), 0);
    const canvas = createSurface(width, height);
    const ctx = canvas.getContext('2d');
    let offset = 0;

    for (const sprite of frameSprites) {
        ctx.drawImage(sprite.canvas, offset, 0);
        offset += sprite.width;
    }

    return {
        name,
        canvas,
        frames: frameSprites,
        frameWidth: frameSprites[0]?.width || 0,
        frameHeight: height
    };
}

export function drawSprite(ctx, sprite, x, y, options = {}) {
    if (!sprite || !sprite.canvas) return;

    const {
        alpha = 1,
        scale = 1,
        rotation = 0,
        centered = true,
        tint = null
    } = options;

    const width = sprite.width * scale;
    const height = sprite.height * scale;
    const drawX = centered ? x - width / 2 : x;
    const drawY = centered ? y - height / 2 : y;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (rotation !== 0) {
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.translate(-x, -y);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite.canvas, drawX, drawY, width, height);

    if (tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tint;
        ctx.fillRect(drawX, drawY, width, height);
        ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
}

function rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const output = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            output[c][rows - 1 - r] = matrix[r][c];
        }
    }
    return output;
}

function buildDirectionMatrices(base) {
    const right = base;
    const down = rotateMatrix(right);
    const left = rotateMatrix(down);
    const up = rotateMatrix(left);
    return { right, down, left, up };
}

function getStyleTint(style) {
    switch (style) {
        case 'highlight':
            return '#ffe070';
        case 'remove':
            return '#78a8ff';
        case 'error':
            return '#ff5167';
        default:
            return null;
    }
}

export function buildGameSpriteAtlas(cellSize, dpr = 1, themeName = 'arcadeFantasy') {
    const theme = getThemePalette(themeName);
    const scale = clamp(Math.round((cellSize / 16) * Math.min(2, Math.max(1, dpr))), 2, 5);
    const heads = buildDirectionMatrices(MATRICES.headRight);
    const flows = buildDirectionMatrices(MATRICES.flowMarkRight);

    return {
        scale,
        theme,
        sprites: {
            lineBodyH: renderSprite('line-body-h', MATRICES.lineBodyH, theme.palette, scale),
            lineBodyV: renderSprite('line-body-v', MATRICES.lineBodyV, theme.palette, scale),
            headRight: renderSprite('line-head-right', heads.right, theme.palette, scale),
            headDown: renderSprite('line-head-down', heads.down, theme.palette, scale),
            headLeft: renderSprite('line-head-left', heads.left, theme.palette, scale),
            headUp: renderSprite('line-head-up', heads.up, theme.palette, scale),
            flowRight: renderSprite('flow-right', flows.right, theme.palette, clamp(scale - 1, 1, 4)),
            flowDown: renderSprite('flow-down', flows.down, theme.palette, clamp(scale - 1, 1, 4)),
            flowLeft: renderSprite('flow-left', flows.left, theme.palette, clamp(scale - 1, 1, 4)),
            flowUp: renderSprite('flow-up', flows.up, theme.palette, clamp(scale - 1, 1, 4)),
            tailRing: renderSprite('tail-ring', MATRICES.tailRing, theme.palette, scale),
            gridDot: renderSprite('grid-dot', MATRICES.gridDot, theme.palette, clamp(scale - 1, 1, 4)),
            tileBase: renderSprite('tile-base', MATRICES.tileBase, theme.palette, clamp(scale - 1, 1, 4)),
            tileVar1: renderSprite('tile-var-1', MATRICES.tileVar1, theme.palette, clamp(scale - 1, 1, 4)),
            tileVar2: renderSprite('tile-var-2', MATRICES.tileVar2, theme.palette, clamp(scale - 1, 1, 4)),
            decoRune: renderSprite('deco-rune', MATRICES.decoRune, theme.palette, clamp(scale - 1, 1, 4)),
            decoTorch: renderSprite('deco-torch', MATRICES.decoTorch, theme.palette, clamp(scale - 1, 1, 4)),
            particleSquare: renderSprite('particle-square', MATRICES.particleSquare, theme.palette, clamp(scale - 1, 1, 4)),
            particleStar: renderSprite('particle-star', MATRICES.particleStar, theme.palette, clamp(scale - 1, 1, 4))
        }
    };
}

export function drawArrowPathPixels(ctx, pathPoints, direction, styleState = {}) {
    const { atlas, alpha = 1, style = 'normal', lineId = 0 } = styleState;
    if (!atlas || !pathPoints || pathPoints.length < 2) return;

    const palette = linePalette(lineId);
    const styleTint = getStyleTint(style);
    const base = styleTint || palette.base;
    const headColor = styleTint || palette.head;
    const glow = styleTint || palette.glow;
    const tailColor = styleTint ? '#252850' : palette.tail;

    const tail = pathPoints[0];
    const head = pathPoints[pathPoints.length - 1];
    const lineWidth = 8 + clamp(atlas.scale * 1.5, 2, 8);

    const bodyGradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    bodyGradient.addColorStop(0, tailColor);
    bodyGradient.addColorStop(0.65, base);
    bodyGradient.addColorStop(1, glow);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(10, 8, 28, 0.95)';
    ctx.lineWidth = lineWidth + 5;
    strokePolyline(ctx, pathPoints);

    ctx.strokeStyle = bodyGradient;
    ctx.lineWidth = lineWidth;
    strokePolyline(ctx, pathPoints);

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = Math.max(2, lineWidth * 0.28);
    strokePolyline(ctx, pathPoints, 0.35, 0.97);
    ctx.restore();

    drawTailCap(ctx, tail, direction, tailColor, alpha);
    drawDirectionalHead(ctx, head, direction, headColor, glow, alpha);
}

function strokePolyline(ctx, points, tStart = 0, tEnd = 1) {
    if (!points.length) return;
    const clipped = trimPolyline(points, tStart, tEnd);
    if (clipped.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(clipped[0].x, clipped[0].y);
    for (let i = 1; i < clipped.length; i++) {
        ctx.lineTo(clipped[i].x, clipped[i].y);
    }
    ctx.stroke();
}

function trimPolyline(points, tStart, tEnd) {
    if (tStart <= 0 && tEnd >= 1) return points;
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        segments.push({ p1, p2, len });
        total += len;
    }
    if (total <= 0) return points;

    const startDist = total * clamp(tStart, 0, 1);
    const endDist = total * clamp(tEnd, 0, 1);
    const out = [];
    let cursor = 0;

    for (const seg of segments) {
        const segStart = cursor;
        const segEnd = cursor + seg.len;
        if (segEnd < startDist || segStart > endDist) {
            cursor = segEnd;
            continue;
        }
        const a = clamp((startDist - segStart) / seg.len, 0, 1);
        const b = clamp((endDist - segStart) / seg.len, 0, 1);
        const pA = lerpPoint(seg.p1, seg.p2, a);
        const pB = lerpPoint(seg.p1, seg.p2, b);
        if (!out.length) out.push(pA);
        out.push(pB);
        cursor = segEnd;
    }
    return out;
}

function lerpPoint(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function drawDirectionalHead(ctx, head, direction, fillColor, glowColor, alpha) {
    const angle = directionToAngle(direction);
    const len = 13;
    const w = 9;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);

    // A dart/fish hybrid silhouette with a notch at the rear gives one unique forward direction.
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(-len * 0.25, -w * 0.95);
    ctx.lineTo(-len * 0.75, -w * 0.5);
    ctx.lineTo(-len, 0);
    ctx.lineTo(-len * 0.75, w * 0.5);
    ctx.lineTo(-len * 0.25, w * 0.95);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = 'rgba(12, 10, 30, 0.95)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(len * 0.18, 0, 3.1, 0, Math.PI * 2);
    ctx.fill();

    // Eye at the nose side: head identity only appears here.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(len * 0.47, -1.7, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawTailCap(ctx, tail, direction, tailColor, alpha) {
    const angle = directionToAngle(direction);
    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    ctx.translate(tail.x, tail.y);
    ctx.rotate(angle);

    ctx.fillStyle = tailColor;
    ctx.beginPath();
    ctx.arc(-4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
}

function directionToAngle(direction) {
    if (direction === 'up') return -Math.PI / 2;
    if (direction === 'down') return Math.PI / 2;
    if (direction === 'left') return Math.PI;
    return 0;
}

function linePalette(lineId) {
    const hue = (lineId * 47) % 360;
    return {
        tail: `hsl(${(hue + 300) % 360} 42% 30%)`,
        base: `hsl(${hue} 80% 54%)`,
        head: `hsl(${(hue + 25) % 360} 96% 58%)`,
        glow: `hsl(${(hue + 60) % 360} 96% 70%)`
    };
}

export function drawPixelParticle(ctx, particle, pixelTheme) {
    if (!pixelTheme?.atlas) return;

    const sprite = particle.type === 'star'
        ? pixelTheme.atlas.sprites.particleStar
        : pixelTheme.atlas.sprites.particleSquare;

    drawSprite(ctx, sprite, particle.x, particle.y, {
        alpha: Math.min(1, particle.life / 0.6),
        rotation: particle.rotation,
        scale: Math.max(0.7, particle.size / 10),
        tint: particle.color
    });
}

export function hashPoint(x, y, seed = 0) {
    let value = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
    value = (value ^ (value >> 13)) * 1274126177;
    return (value >>> 0) / 0xffffffff;
}

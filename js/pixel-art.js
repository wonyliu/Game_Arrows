const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const DESIGN_V2 = {
    snakeHead: 'assets/design-v4/clean/snake_head.png',
    snakeHeadCurious: 'assets/design-v4/clean/snake_head_curious_r2.png',
    snakeHeadSleepy: 'assets/design-v4/clean/snake_head_sleepy_r2.png',
    snakeHeadSurprised: 'assets/design-v4/clean/snake_head_surprised_r2.png',
    snakeSegA: 'assets/design-v4/clean/snake_seg_a.png',
    snakeSegB: 'assets/design-v4/clean/snake_seg_b.png',
    snakeTailBase: 'assets/design-v4/clean/snake_tail_base.png',
    snakeTailTip: 'assets/design-v4/clean/snake_tail_tip.png'
};

const THEMES = {
    moleFamily: {
        name: 'moleFamily',
        palette: [
            'rgba(0,0,0,0)',
            '#3a2b20',
            '#5a422f',
            '#7a593f',
            '#9d7350',
            '#c9966a',
            '#e8bf8f',
            '#f7e8ca',
            '#ffd07d',
            '#fff7ec',
            '#5a7c39',
            '#79a84f',
            '#a6cf6f',
            '#ff8ca8',
            '#8ad6ff',
            '#ffd15f'
        ],
        boardBg: '#6b4c32',
        boardFrame: '#4a3524'
    }
};

const MATRICES = {
    gridDot: [
        [0,1,1,1,0],
        [1,2,3,2,1],
        [1,3,7,3,1],
        [1,2,3,2,1],
        [0,1,1,1,0]
    ],
    tileBase: [
        [3,3,3,2,3,3,3,3],
        [3,2,3,3,3,2,3,3],
        [3,3,10,3,3,3,10,3],
        [2,3,3,3,2,3,3,3],
        [3,3,3,2,3,3,3,3],
        [3,11,3,3,3,12,3,3],
        [3,3,3,3,2,3,3,2],
        [3,3,2,3,3,3,3,3]
    ],
    tileVar1: [
        [3,3,2,3,3,3,3,2],
        [2,3,3,3,10,3,3,3],
        [3,3,3,2,3,3,3,3],
        [3,10,3,3,3,11,3,3],
        [3,3,3,3,2,3,3,2],
        [3,3,2,3,3,3,12,3],
        [3,3,3,3,3,2,3,3],
        [2,3,3,10,3,3,3,3]
    ],
    tileVar2: [
        [3,2,3,3,3,3,10,3],
        [3,3,3,11,3,3,3,2],
        [2,3,3,3,3,12,3,3],
        [3,3,10,3,2,3,3,3],
        [3,3,3,3,3,3,2,3],
        [3,2,3,3,10,3,3,3],
        [3,3,3,2,3,3,3,11],
        [3,3,3,3,3,2,3,3]
    ],
    decoMushroom: [
        [0,0,13,13,13,0,0],
        [0,13,15,13,15,13,0],
        [13,13,13,13,13,13,13],
        [0,0,4,4,4,0,0],
        [0,0,4,7,4,0,0],
        [0,0,4,4,4,0,0]
    ],
    decoFlower: [
        [0,0,0,14,0,0,0],
        [0,14,13,9,13,14,0],
        [0,0,14,13,14,0,0],
        [0,0,0,11,0,0,0],
        [0,0,0,10,0,0,0],
        [0,0,10,10,10,0,0]
    ],
    particleLeaf: [
        [0,0,10,10,0,0],
        [0,10,11,11,10,0],
        [10,11,12,12,11,10],
        [0,10,11,11,10,0],
        [0,0,10,10,0,0]
    ],
    particleHeart: [
        [0,13,13,0,13,13,0],
        [13,13,13,13,13,13,13],
        [13,13,13,13,13,13,13],
        [0,13,13,13,13,13,0],
        [0,0,13,13,13,0,0],
        [0,0,0,13,0,0,0]
    ]
};

const MOLE_FAMILIES = [
    {
        fur: '#8f6b49',
        furDark: '#6b5037',
        belly: '#f3d6ad',
        ear: '#f4b5c5',
        nose: '#ff7da2',
        eye: '#2c1f19'
    },
    {
        fur: '#b58758',
        furDark: '#875f3d',
        belly: '#f7dfbe',
        ear: '#f2c4d2',
        nose: '#ff8ab6',
        eye: '#35261e'
    },
    {
        fur: '#6e737d',
        furDark: '#4c5159',
        belly: '#d9dde6',
        ear: '#edb8c7',
        nose: '#ff8fb2',
        eye: '#1e2026'
    },
    {
        fur: '#9a7aa0',
        furDark: '#6e5873',
        belly: '#f0d8f3',
        ear: '#f8bfd8',
        nose: '#ff86bf',
        eye: '#2d1f31'
    },
    {
        fur: '#7e8b55',
        furDark: '#5d6a40',
        belly: '#d8e2ae',
        ear: '#f4c6b6',
        nose: '#ff9d8f',
        eye: '#23281b'
    }
];

const EXPRESSIONS = ['goofy', 'smirk', 'sleepy', 'grin'];
const SPRITE_CACHE = new Map();
const RASTER_SPRITE_CACHE = new Map();
const CARDINAL_VECTORS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

function createSurface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function spriteCacheKey(name, scale, paletteKey) {
    return `${name}:${scale}:${paletteKey}`;
}

function rasterCacheKey(name, path) {
    return `${name}:${path}`;
}

function loadRasterSprite(name, path) {
    const key = rasterCacheKey(name, path);
    const cached = RASTER_SPRITE_CACHE.get(key);

    if (cached?.status === 'ready') {
        return cached.sprite;
    }

    if (!cached) {
        const record = { status: 'loading', sprite: null };
        const image = new Image();
        image.decoding = 'async';

        image.onload = () => {
            const canvas = createSurface(image.naturalWidth, image.naturalHeight);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(image, 0, 0);
            record.status = 'ready';
            record.sprite = {
                name,
                canvas,
                width: canvas.width,
                height: canvas.height
            };
        };

        image.onerror = () => {
            record.status = 'error';
        };

        image.src = path;
        RASTER_SPRITE_CACHE.set(key, record);
    }

    return null;
}

function ensureSnakeImageSprites(atlas) {
    if (!atlas?.sprites) return false;

    atlas.sprites.snakeHead = atlas.sprites.snakeHead || loadRasterSprite('snake-head', DESIGN_V2.snakeHead);
    atlas.sprites.snakeHeadCurious = atlas.sprites.snakeHeadCurious || loadRasterSprite('snake-head-curious', DESIGN_V2.snakeHeadCurious);
    atlas.sprites.snakeHeadSleepy = atlas.sprites.snakeHeadSleepy || loadRasterSprite('snake-head-sleepy', DESIGN_V2.snakeHeadSleepy);
    atlas.sprites.snakeHeadSurprised = atlas.sprites.snakeHeadSurprised || loadRasterSprite('snake-head-surprised', DESIGN_V2.snakeHeadSurprised);
    atlas.sprites.snakeSegA = atlas.sprites.snakeSegA || loadRasterSprite('snake-seg-a', DESIGN_V2.snakeSegA);
    atlas.sprites.snakeSegB = atlas.sprites.snakeSegB || loadRasterSprite('snake-seg-b', DESIGN_V2.snakeSegB);
    atlas.sprites.snakeTailBase = atlas.sprites.snakeTailBase || loadRasterSprite('snake-tail-base', DESIGN_V2.snakeTailBase);
    atlas.sprites.snakeTailTip = atlas.sprites.snakeTailTip || loadRasterSprite('snake-tail-tip', DESIGN_V2.snakeTailTip);

    return Boolean(
        atlas.sprites.snakeHead &&
        atlas.sprites.snakeHeadCurious &&
        atlas.sprites.snakeHeadSleepy &&
        atlas.sprites.snakeHeadSurprised &&
        atlas.sprites.snakeSegA &&
        atlas.sprites.snakeSegB &&
        atlas.sprites.snakeTailBase &&
        atlas.sprites.snakeTailTip
    );
}

export function getThemePalette(themeName = 'moleFamily') {
    return THEMES[themeName] || THEMES.moleFamily;
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
        tint = null,
        smooth = false,
        stretchX = 1
    } = options;

    const width = sprite.width * scale * stretchX;
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

    ctx.imageSmoothingEnabled = smooth;
    if (smooth) {
        ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(sprite.canvas, drawX, drawY, width, height);

    if (tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tint;
        ctx.fillRect(drawX, drawY, width, height);
        ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
}

function normalizeDirection(direction, fallback = 'right') {
    return CARDINAL_VECTORS[direction] ? direction : fallback;
}

function drawSnakeDirectionArrow(ctx, x, y, direction, thickness, alpha, style) {
    const vector = CARDINAL_VECTORS[direction] || CARDINAL_VECTORS.right;
    const angle = Math.atan2(vector.y, vector.x);
    const length = thickness * 0.34;
    const spread = thickness * 0.14;
    const color = style === 'error' ? '#ff4f6f' : '#ff8cab';
    const frontOffset = thickness * 0.62 + 1.5;

    ctx.save();
    ctx.globalAlpha = alpha * 0.82;
    ctx.translate(
        x + vector.x * frontOffset,
        y + vector.y * frontOffset
    );
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(length, 0);
    ctx.lineTo(0, -spread);
    ctx.lineTo(0, spread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function resolveCardinalDirection(dx, dy, fallback = 'right') {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return fallback;
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'down' : 'up';
}

function resolveHeadDirection(points) {
    if (!Array.isArray(points) || points.length < 2) {
        return 'right';
    }
    const head = points[points.length - 1];
    const neck = points[points.length - 2];
    return resolveCardinalDirection(head.x - neck.x, head.y - neck.y);
}

function directionToHeadPose(direction) {
    switch (direction) {
        case 'up':
            return { angle: -Math.PI / 2, flipX: false, isVertical: true };
        case 'down':
            return { angle: Math.PI / 2, flipX: false, isVertical: true };
        case 'left':
            return { angle: 0, flipX: true, isVertical: false };
        default:
            return { angle: 0, flipX: false, isVertical: false };
    }
}

function pickSnakeHeadSprite(atlas, expression = 'default') {
    const sprites = atlas?.sprites || {};
    switch (expression) {
        case 'curious':
            return sprites.snakeHeadCurious || sprites.snakeHead || null;
        case 'sleepy':
            return sprites.snakeHeadSleepy || sprites.snakeHead || null;
        case 'surprised':
            return sprites.snakeHeadSurprised || sprites.snakeHead || null;
        default:
            return sprites.snakeHead || null;
    }
}

function drawSnakeHeadSprite(ctx, sprite, x, y, options = {}) {
    if (!sprite || !sprite.canvas) return;

    const {
        alpha = 1,
        scale = 1,
        rotation = 0,
        flipX = false,
        tint = null
    } = options;

    const width = sprite.width * scale;
    const height = sprite.height * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    if (flipX) {
        ctx.scale(-1, 1);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sprite.canvas, -width / 2, -height / 2, width, height);

    if (tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tint;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
}

function drawSnakePathWithSprites(ctx, pathPoints, styleState, directionHint = 'right') {
    const {
        atlas,
        alpha = 1,
        style = 'normal',
        lineId = 0,
        wiggleTime = 0,
        softPulse = 0,
        headExpression = 'default'
    } = styleState;

    if (!atlas || !ensureSnakeImageSprites(atlas)) return false;

    const spacing = clamp(atlas.cellSize * 0.88, 12, 22);
    const sampled = samplePolyline(pathPoints, spacing);
    if (sampled.length < 4) return false;

    const styleTint = getStyleTint(style);
    const wiggleStrength = (style === 'remove' ? 2.2 : 0.78) + softPulse * 1.5;
    const thickness = clamp(atlas.cellSize * 0.9, 18, 34);

    const bodyPoints = [];
    for (const point of sampled) {
        const envelope = Math.sin(Math.PI * point.t);
        const wiggle = Math.sin(wiggleTime * 7 + point.t * 14 + lineId * 0.73) * wiggleStrength * envelope;
        bodyPoints.push({
            ...point,
            x: point.x - point.dirY * wiggle,
            y: point.y + point.dirX * wiggle
        });
    }

    const tail = bodyPoints[0];
    const tailNext = bodyPoints[1];
    const tailAngle = Math.atan2(tailNext.y - tail.y, tailNext.x - tail.x) + Math.PI;

    const tailTipScale = (thickness * 0.95) / atlas.sprites.snakeTailTip.height;
    drawSprite(ctx, atlas.sprites.snakeTailTip, tail.x, tail.y, {
        alpha: alpha * 0.96,
        rotation: tailAngle,
        scale: tailTipScale,
        tint: styleTint,
        smooth: true
    });

    for (let i = 1; i < bodyPoints.length - 2; i++) {
        const point = bodyPoints[i];
        const prev = bodyPoints[Math.max(0, i - 1)];
        const next = bodyPoints[Math.min(bodyPoints.length - 1, i + 1)];
        const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
        const t = i / Math.max(1, bodyPoints.length - 1);

        const sprite = i % 2 === 0 ? atlas.sprites.snakeSegA : atlas.sprites.snakeSegB;
        const sizeTier = t > 0.76 ? 1.12 : (t > 0.5 ? 1.0 : 0.9);
        const pulse = 1 + Math.sin(i * 0.6 + wiggleTime * 2.1) * 0.03 + softPulse * 0.04;
        const scale = (thickness * sizeTier * pulse) / sprite.height;

        drawSprite(ctx, sprite, point.x, point.y, {
            alpha: alpha * (0.84 + t * 0.12),
            rotation: angle,
            scale,
            tint: styleTint,
            smooth: true
        });
    }

    const sampledHead = sampled[sampled.length - 1];
    const sampledNeck = sampled[Math.max(1, sampled.length - 2)];
    const headDirection = normalizeDirection(directionHint, resolveHeadDirection(pathPoints));
    const headPose = directionToHeadPose(headDirection);
    const bobAmplitude = thickness * (0.06 + softPulse * 0.03);
    const headBob = Math.sin(wiggleTime * 7 + lineId * 0.73 + Math.PI * 0.25) * bobAmplitude;
    const neckBob = headBob * 0.58;
    const isVerticalByPath = headPose.isVertical;
    const headRender = {
        x: sampledHead.x + (isVerticalByPath ? 0 : headBob),
        y: sampledHead.y + (isVerticalByPath ? headBob : 0)
    };
    const neckRender = {
        x: sampledNeck.x + (isVerticalByPath ? 0 : neckBob),
        y: sampledNeck.y + (isVerticalByPath ? neckBob : 0)
    };

    const neckScale = (thickness * 1.05) / atlas.sprites.snakeSegA.height;
    drawSprite(ctx, atlas.sprites.snakeSegA, neckRender.x, neckRender.y, {
        alpha: alpha * 0.96,
        rotation: headPose.angle,
        scale: neckScale,
        tint: styleTint,
        smooth: true
    });

    const headSprite = pickSnakeHeadSprite(atlas, headExpression);
    const headScale = (thickness * 1.1) / headSprite.height;
    drawSnakeHeadSprite(ctx, headSprite, headRender.x, headRender.y, {
        alpha,
        rotation: headPose.angle,
        flipX: headPose.flipX,
        scale: headScale,
        tint: styleTint
    });

    drawSnakeDirectionArrow(ctx, headRender.x, headRender.y, headDirection, thickness, alpha, style);
    return true;
}

function getStyleTint(style) {
    switch (style) {
        case 'highlight':
            return '#ffe79a';
        case 'remove':
            return 'rgba(183, 255, 204, 0.28)';
        case 'error':
            return '#ff9caf';
        default:
            return null;
    }
}

function lineMood(style, baseExpression) {
    if (style === 'error') return 'dizzy';
    if (style === 'highlight') return 'surprised';
    if (style === 'remove') return 'excited';
    return baseExpression;
}

function lineFamily(lineId) {
    return MOLE_FAMILIES[Math.abs(lineId) % MOLE_FAMILIES.length];
}

function lineExpression(lineId, turns, bodyCount) {
    const shift = (lineId + turns * 3 + bodyCount) % EXPRESSIONS.length;
    return EXPRESSIONS[Math.abs(shift)];
}

function preprocessPolyline(points) {
    const segments = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len <= 0.001) continue;
        const dirX = dx / len;
        const dirY = dy / len;
        segments.push({ p1, p2, len, dirX, dirY, start: total, end: total + len });
        total += len;
    }
    return { segments, total };
}

function samplePoint(pre, distance) {
    const d = clamp(distance, 0, pre.total);
    for (const seg of pre.segments) {
        if (d >= seg.start && d <= seg.end) {
            const t = (d - seg.start) / seg.len;
            return {
                x: seg.p1.x + (seg.p2.x - seg.p1.x) * t,
                y: seg.p1.y + (seg.p2.y - seg.p1.y) * t,
                dirX: seg.dirX,
                dirY: seg.dirY,
                t: pre.total === 0 ? 0 : d / pre.total
            };
        }
    }

    const last = pre.segments[pre.segments.length - 1];
    return {
        x: last.p2.x,
        y: last.p2.y,
        dirX: last.dirX,
        dirY: last.dirY,
        t: 1
    };
}

function samplePolyline(points, spacing) {
    const pre = preprocessPolyline(points);
    if (!pre.segments.length || pre.total <= 0) {
        return [];
    }

    const out = [];
    const count = Math.max(2, Math.floor(pre.total / spacing) + 1);
    for (let i = 0; i <= count; i++) {
        const d = (i / count) * pre.total;
        out.push(samplePoint(pre, d));
    }
    return out;
}

function countTurns(points) {
    let turns = 0;
    for (let i = 2; i < points.length; i++) {
        const dx1 = points[i - 1].x - points[i - 2].x;
        const dy1 = points[i - 1].y - points[i - 2].y;
        const dx2 = points[i].x - points[i - 1].x;
        const dy2 = points[i].y - points[i - 1].y;
        if (Math.abs(dx1 * dy2 - dy1 * dx2) > 0.001) turns++;
    }
    return turns;
}

function postureByPath(points, bodyCount) {
    const turns = countTurns(points);
    if (turns > 0) return 'bent';
    if (bodyCount <= 4) return 'short';
    return 'long';
}

function drawBodySegment(ctx, x, y, angle, rx, ry, family, shade, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = shade > 0.5 ? family.fur : family.furDark;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = family.belly;
    ctx.beginPath();
    ctx.ellipse(rx * 0.15, ry * 0.2, rx * 0.55, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawTail(ctx, point, dirX, dirY, family, alpha) {
    const tailAngle = Math.atan2(dirY, dirX) + Math.PI;
    const tailLen = 7;
    ctx.save();
    ctx.globalAlpha = alpha * 0.95;
    ctx.translate(point.x, point.y);
    ctx.rotate(tailAngle);

    ctx.strokeStyle = family.furDark;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.quadraticCurveTo(-tailLen * 0.5, -4, -tailLen, 0);
    ctx.stroke();

    ctx.fillStyle = family.nose;
    ctx.beginPath();
    ctx.arc(-tailLen - 1.4, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawWhiskers(ctx, len, spread) {
    ctx.beginPath();
    ctx.moveTo(len * 0.3, 0);
    ctx.lineTo(len * 0.9, -spread);
    ctx.moveTo(len * 0.32, 1.4);
    ctx.lineTo(len * 0.92, 0.1);
    ctx.moveTo(len * 0.3, 2.8);
    ctx.lineTo(len * 0.88, spread + 1.8);
    ctx.stroke();
}

function drawEyes(ctx, mood, family, len) {
    ctx.fillStyle = family.eye;
    if (mood === 'sleepy') {
        ctx.strokeStyle = family.eye;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(len * 0.14, -1.8);
        ctx.lineTo(len * 0.3, -1.8);
        ctx.moveTo(len * 0.14, 2.2);
        ctx.lineTo(len * 0.3, 2.2);
        ctx.stroke();
        return;
    }

    if (mood === 'dizzy') {
        ctx.strokeStyle = family.eye;
        ctx.lineWidth = 1.5;
        for (const y of [-2.1, 2.1]) {
            ctx.beginPath();
            ctx.moveTo(len * 0.15, y - 1);
            ctx.lineTo(len * 0.28, y + 1);
            ctx.moveTo(len * 0.28, y - 1);
            ctx.lineTo(len * 0.15, y + 1);
            ctx.stroke();
        }
        return;
    }

    const leftEye = mood === 'goofy' ? { x: len * 0.18, y: -2.3, r: 1.5 } : { x: len * 0.2, y: -2, r: 1.25 };
    const rightEye = mood === 'goofy' ? { x: len * 0.28, y: 2.5, r: 0.95 } : { x: len * 0.2, y: 2, r: 1.25 };

    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, leftEye.r, 0, Math.PI * 2);
    ctx.arc(rightEye.x, rightEye.y, rightEye.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(leftEye.x + 0.3, leftEye.y - 0.2, 0.35, 0, Math.PI * 2);
    ctx.arc(rightEye.x + 0.25, rightEye.y - 0.2, 0.25, 0, Math.PI * 2);
    ctx.fill();
}

function drawMouth(ctx, mood, len) {
    ctx.strokeStyle = '#5f3729';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (mood === 'grin' || mood === 'excited') {
        ctx.arc(len * 0.08, 0.8, 2.4, 0.15, Math.PI - 0.15);
    } else if (mood === 'smirk') {
        ctx.moveTo(len * 0.02, 1.2);
        ctx.quadraticCurveTo(len * 0.18, 2.4, len * 0.32, 1.1);
    } else if (mood === 'surprised') {
        ctx.arc(len * 0.12, 1.1, 1.1, 0, Math.PI * 2);
    } else if (mood === 'dizzy') {
        ctx.moveTo(len * 0.03, 0.7);
        ctx.lineTo(len * 0.28, 0.7);
    } else {
        ctx.moveTo(len * 0.04, 1.1);
        ctx.quadraticCurveTo(len * 0.17, 2, len * 0.28, 1.1);
    }
    ctx.stroke();
}

function drawMoleHead(ctx, point, dirX, dirY, family, mood, alpha, squish, styleTint) {
    const angle = Math.atan2(dirY, dirX);
    const len = 11 + squish * 3;
    const width = 8.5 - squish * 1.1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);

    const fur = styleTint || family.fur;

    ctx.fillStyle = family.furDark;
    ctx.beginPath();
    ctx.ellipse(-2.2, 0, len * 0.9, width * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, 0, len, width, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = family.ear;
    ctx.beginPath();
    ctx.arc(-len * 0.35, -width * 0.72, 2.5, 0, Math.PI * 2);
    ctx.arc(-len * 0.35, width * 0.72, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = family.belly;
    ctx.beginPath();
    ctx.ellipse(len * 0.22, 0, len * 0.56, width * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = family.nose;
    ctx.beginPath();
    ctx.ellipse(len * 0.82, 0, 2.1, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    drawEyes(ctx, mood, family, len);
    drawMouth(ctx, mood, len);

    ctx.strokeStyle = '#fff2eb';
    ctx.lineWidth = 1.1;
    drawWhiskers(ctx, len, 3.4);

    ctx.restore();
}

export function buildGameSpriteAtlas(cellSize, dpr = 1, themeName = 'moleFamily') {
    const theme = getThemePalette(themeName);
    const scale = clamp(Math.round((cellSize / 18) * Math.min(2, Math.max(1, dpr))), 2, 5);

    return {
        cellSize,
        scale,
        theme,
        sprites: {
            gridDot: renderSprite('grid-dot-mole', MATRICES.gridDot, theme.palette, clamp(scale - 1, 1, 4)),
            tileBase: renderSprite('tile-base-mole', MATRICES.tileBase, theme.palette, clamp(scale - 1, 1, 4)),
            tileVar1: renderSprite('tile-var1-mole', MATRICES.tileVar1, theme.palette, clamp(scale - 1, 1, 4)),
            tileVar2: renderSprite('tile-var2-mole', MATRICES.tileVar2, theme.palette, clamp(scale - 1, 1, 4)),
            decoRune: renderSprite('deco-mushroom', MATRICES.decoMushroom, theme.palette, clamp(scale - 1, 1, 4)),
            decoTorch: renderSprite('deco-flower', MATRICES.decoFlower, theme.palette, clamp(scale - 1, 1, 4)),
            particleSquare: renderSprite('particle-leaf', MATRICES.particleLeaf, theme.palette, clamp(scale - 1, 1, 4)),
            particleStar: renderSprite('particle-heart', MATRICES.particleHeart, theme.palette, clamp(scale - 1, 1, 4)),
            snakeHead: loadRasterSprite('snake-head', DESIGN_V2.snakeHead),
            snakeHeadCurious: loadRasterSprite('snake-head-curious', DESIGN_V2.snakeHeadCurious),
            snakeHeadSleepy: loadRasterSprite('snake-head-sleepy', DESIGN_V2.snakeHeadSleepy),
            snakeHeadSurprised: loadRasterSprite('snake-head-surprised', DESIGN_V2.snakeHeadSurprised),
            snakeSegA: loadRasterSprite('snake-seg-a', DESIGN_V2.snakeSegA),
            snakeSegB: loadRasterSprite('snake-seg-b', DESIGN_V2.snakeSegB),
            snakeTailBase: loadRasterSprite('snake-tail-base', DESIGN_V2.snakeTailBase),
            snakeTailTip: loadRasterSprite('snake-tail-tip', DESIGN_V2.snakeTailTip)
        }
    };
}

export function drawArrowPathPixels(ctx, pathPoints, direction, styleState = {}) {
    if (drawSnakePathWithSprites(ctx, pathPoints, styleState, direction)) {
        return;
    }

    const {
        atlas,
        alpha = 1,
        style = 'normal',
        lineId = 0,
        wiggleTime = 0,
        softPulse = 0
    } = styleState;

    if (!atlas || !pathPoints || pathPoints.length < 2) return;

    const spacing = clamp(11 - atlas.scale, 7, 12);
    const sampled = samplePolyline(pathPoints, spacing);
    if (sampled.length < 2) return;

    const family = lineFamily(lineId);
    const posture = postureByPath(pathPoints, sampled.length);
    const turns = countTurns(pathPoints);
    const mood = lineMood(style, lineExpression(lineId, turns, sampled.length));
    const styleTint = getStyleTint(style);

    const wiggleStrength = (style === 'remove' ? 4.2 : 1.7) + softPulse * 4;
    const bodyBase = posture === 'short' ? 7.4 : (posture === 'bent' ? 6.6 : 6.2);

    const bodyPoints = [];
    for (const p of sampled) {
        const envelope = Math.sin(Math.PI * p.t);
        const wiggle = Math.sin(wiggleTime * 8 + p.t * 18 + lineId * 0.7) * wiggleStrength * envelope;
        const nx = -p.dirY;
        const ny = p.dirX;
        bodyPoints.push({
            ...p,
            x: p.x + nx * wiggle,
            y: p.y + ny * wiggle
        });
    }

    for (let i = 0; i < bodyPoints.length - 1; i++) {
        const p = bodyPoints[i];
        const next = bodyPoints[i + 1];
        const angle = Math.atan2(next.y - p.y, next.x - p.x);
        const t = i / Math.max(1, bodyPoints.length - 1);
        const radiusX = bodyBase * (0.82 + Math.sin(t * Math.PI) * 0.34);
        const radiusY = radiusX * (0.72 + softPulse * 0.12);
        drawBodySegment(ctx, p.x, p.y, angle, radiusX, radiusY, family, 0.3 + t * 0.7, alpha * (0.87 + t * 0.13));
    }

    const tail = bodyPoints[0];
    drawTail(ctx, tail, tail.dirX, tail.dirY, family, alpha);

    const head = bodyPoints[bodyPoints.length - 1];
    drawMoleHead(
        ctx,
        head,
        head.dirX,
        head.dirY,
        family,
        mood,
        alpha,
        clamp(softPulse, 0, 1),
        styleTint
    );
}

export function drawPixelParticle(ctx, particle, pixelTheme) {
    if (!pixelTheme?.atlas) return;

    const isHeart = particle.type === 'star';
    const sprite = isHeart ? pixelTheme.atlas.sprites.particleStar : pixelTheme.atlas.sprites.particleSquare;

    drawSprite(ctx, sprite, particle.x, particle.y, {
        alpha: Math.min(1, particle.life / 0.5),
        rotation: particle.rotation,
        scale: Math.max(0.75, particle.size / 11),
        tint: particle.color
    });
}

export function hashPoint(x, y, seed = 0) {
    let value = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
    value = (value ^ (value >> 13)) * 1274126177;
    return (value >>> 0) / 0xffffffff;
}

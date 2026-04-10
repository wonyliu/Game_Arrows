import { getDefaultSkinId, getSkinById } from './skins.js?v=24';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
const SNAKE_VARIANT_SPRITE_CACHE = new Map();
const MASKED_SNAKE_SPRITE_CACHE = new Map();
const SPRITE_ALPHA_BOUNDS_CACHE = new WeakMap();
const CARDINAL_VECTORS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};
const DEFAULT_SNAKE_COLOR_VARIANTS = Object.freeze([
    Object.freeze({ id: 'vivid-green', hueShift: 0, saturation: 1.32, lightness: 1.03, contrast: 1.04 }),
    Object.freeze({ id: 'sun-amber', hueShift: -34, saturation: 1.38, lightness: 1.02, contrast: 1.05 }),
    Object.freeze({ id: 'mint-cyan', hueShift: 58, saturation: 1.35, lightness: 1.03, contrast: 1.04 }),
    Object.freeze({ id: 'sky-blue', hueShift: 102, saturation: 1.33, lightness: 1.04, contrast: 1.03 }),
    Object.freeze({ id: 'berry-violet', hueShift: 138, saturation: 1.34, lightness: 1.03, contrast: 1.03 }),
    Object.freeze({ id: 'coral-sunrise', hueShift: -68, saturation: 1.36, lightness: 1.02, contrast: 1.04 })
]);
const DEFAULT_SNAKE_RENDER_PROFILE = Object.freeze({
    segmentShadowColor: 'rgba(20, 16, 28, 0.24)',
    segmentShadowBlur: 2.2,
    segmentShadowOffsetX: 0,
    segmentShadowOffsetY: 1,
    headShadowColor: 'rgba(20, 16, 28, 0.30)',
    headShadowBlur: 3.2,
    headShadowOffsetX: 0,
    headShadowOffsetY: 1,
    spriteScale: 1
});
const SKIN_PART_FIT_STORAGE_KEY = 'arrowClear_skinPartFitOverrides_v2';
const SNAKE_PART_FIT_KEYS = Object.freeze([
    'headDefault',
    'headCurious',
    'headSleepy',
    'headSurprised',
    'segA',
    'segB',
    'tailTip'
]);
const DEFAULT_SNAKE_PART_FIT = Object.freeze({
    headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
    headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
    headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
    headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
    segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
    segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
    tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
});
const SNAKE_PART_MASK_SPECS = Object.freeze([
    Object.freeze({ spriteKey: 'snakeHead', fitKey: 'headDefault', maskAssetKey: 'snakeHead' }),
    Object.freeze({ spriteKey: 'snakeSegA', fitKey: 'segA', maskAssetKey: 'snakeSegA' }),
    Object.freeze({ spriteKey: 'snakeTailTip', fitKey: 'tailTip', maskAssetKey: 'snakeTailTip' })
]);
const ENABLE_RUNTIME_SNAKE_SHADOW = false;

function normalizeHue(value) {
    let hue = value % 360;
    if (hue < 0) hue += 360;
    return hue;
}

function rgbToHsl(r, g, b) {
    const nr = r / 255;
    const ng = g / 255;
    const nb = b / 255;
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    const lightness = (max + min) / 2;
    const delta = max - min;

    if (delta <= 0.00001) {
        return { h: 0, s: 0, l: lightness };
    }

    const saturation = lightness > 0.5
        ? delta / (2 - max - min)
        : delta / (max + min);

    let hue = 0;
    switch (max) {
        case nr:
            hue = ((ng - nb) / delta + (ng < nb ? 6 : 0)) * 60;
            break;
        case ng:
            hue = ((nb - nr) / delta + 2) * 60;
            break;
        default:
            hue = ((nr - ng) / delta + 4) * 60;
            break;
    }

    return { h: normalizeHue(hue), s: saturation, l: lightness };
}

function hueToRgb(p, q, t) {
    let nt = t;
    if (nt < 0) nt += 1;
    if (nt > 1) nt -= 1;
    if (nt < 1 / 6) return p + (q - p) * 6 * nt;
    if (nt < 1 / 2) return q;
    if (nt < 2 / 3) return p + (q - p) * (2 / 3 - nt) * 6;
    return p;
}

function hslToRgb(h, s, l) {
    if (s <= 0.00001) {
        const gray = Math.round(clamp(l, 0, 1) * 255);
        return [gray, gray, gray];
    }

    const nh = normalizeHue(h) / 360;
    const q = l < 0.5
        ? l * (1 + s)
        : l + s - l * s;
    const p = 2 * l - q;
    const r = hueToRgb(p, q, nh + 1 / 3);
    const g = hueToRgb(p, q, nh);
    const b = hueToRgb(p, q, nh - 1 / 3);
    return [
        Math.round(clamp(r, 0, 1) * 255),
        Math.round(clamp(g, 0, 1) * 255),
        Math.round(clamp(b, 0, 1) * 255)
    ];
}

function readClampedNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return clamp(parsed, min, max);
}

function readOptionalClampedNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return clamp(parsed, min, max);
}

function normalizeSnakeColorVariant(rawVariant, fallbackVariant, index = 0) {
    const fallback = fallbackVariant || DEFAULT_SNAKE_COLOR_VARIANTS[index % DEFAULT_SNAKE_COLOR_VARIANTS.length];
    const id = `${rawVariant?.id || fallback.id || `variant-${index}`}`.trim() || `variant-${index}`;
    return {
        id,
        hueShift: readClampedNumber(rawVariant?.hueShift, fallback.hueShift, -360, 360),
        saturation: readClampedNumber(rawVariant?.saturation, fallback.saturation, 0.6, 2.2),
        lightness: readClampedNumber(rawVariant?.lightness, fallback.lightness, 0.7, 1.3),
        contrast: readClampedNumber(rawVariant?.contrast, fallback.contrast, 0.8, 1.4),
        neutralTintStrength: readClampedNumber(rawVariant?.neutralTintStrength, 0, 0, 1),
        neutralLightnessTarget: readOptionalClampedNumber(rawVariant?.neutralLightnessTarget, 0, 1),
        neutralLightnessThreshold: readClampedNumber(rawVariant?.neutralLightnessThreshold, 0.56, 0, 1),
        neutralSaturationThreshold: readClampedNumber(rawVariant?.neutralSaturationThreshold, 0.22, 0, 1),
        forceMonochrome: rawVariant?.forceMonochrome === true,
        monochromeLightness: readClampedNumber(rawVariant?.monochromeLightness, 0.5, 0, 1),
        forceBinaryMonochrome: rawVariant?.forceBinaryMonochrome === true,
        invertBinaryMonochrome: rawVariant?.invertBinaryMonochrome === true,
        monochromeThreshold: readClampedNumber(rawVariant?.monochromeThreshold, 0.62, 0, 1)
    };
}

function resolveSnakeColorVariants(skin) {
    const source = Array.isArray(skin?.colorVariants) && skin.colorVariants.length > 0
        ? skin.colorVariants
        : DEFAULT_SNAKE_COLOR_VARIANTS;
    return source.map((variant, index) =>
        normalizeSnakeColorVariant(
            variant,
            DEFAULT_SNAKE_COLOR_VARIANTS[index % DEFAULT_SNAKE_COLOR_VARIANTS.length],
            index
        )
    );
}

function resolveSkinRenderProfile(skin) {
    const profile = skin?.renderProfile || {};
    return {
        segmentShadowColor: typeof profile.segmentShadowColor === 'string'
            ? profile.segmentShadowColor
            : DEFAULT_SNAKE_RENDER_PROFILE.segmentShadowColor,
        segmentShadowBlur: readClampedNumber(
            profile.segmentShadowBlur,
            DEFAULT_SNAKE_RENDER_PROFILE.segmentShadowBlur,
            0,
            10
        ),
        segmentShadowOffsetX: readClampedNumber(
            profile.segmentShadowOffsetX,
            DEFAULT_SNAKE_RENDER_PROFILE.segmentShadowOffsetX,
            -8,
            8
        ),
        segmentShadowOffsetY: readClampedNumber(
            profile.segmentShadowOffsetY,
            DEFAULT_SNAKE_RENDER_PROFILE.segmentShadowOffsetY,
            -8,
            8
        ),
        headShadowColor: typeof profile.headShadowColor === 'string'
            ? profile.headShadowColor
            : DEFAULT_SNAKE_RENDER_PROFILE.headShadowColor,
        headShadowBlur: readClampedNumber(
            profile.headShadowBlur,
            DEFAULT_SNAKE_RENDER_PROFILE.headShadowBlur,
            0,
            12
        ),
        headShadowOffsetX: readClampedNumber(
            profile.headShadowOffsetX,
            DEFAULT_SNAKE_RENDER_PROFILE.headShadowOffsetX,
            -8,
            8
        ),
        headShadowOffsetY: readClampedNumber(
            profile.headShadowOffsetY,
            DEFAULT_SNAKE_RENDER_PROFILE.headShadowOffsetY,
            -8,
            8
        ),
        spriteScale: readClampedNumber(
            profile.spriteScale,
            DEFAULT_SNAKE_RENDER_PROFILE.spriteScale,
            0.9,
            1.3
        )
    };
}

function normalizeSnakePartFitEntry(rawEntry, fallbackEntry) {
    const fallback = fallbackEntry || { scale: 1, offsetX: 0, offsetY: 0 };
    return {
        scale: readClampedNumber(rawEntry?.scale, fallback.scale, 0.8, 1.4),
        offsetX: readClampedNumber(rawEntry?.offsetX, fallback.offsetX, -0.35, 0.35),
        offsetY: readClampedNumber(rawEntry?.offsetY, fallback.offsetY, -0.35, 0.35)
    };
}

function normalizeSnakePartFit(rawFit) {
    const normalized = {};
    for (const key of SNAKE_PART_FIT_KEYS) {
        normalized[key] = normalizeSnakePartFitEntry(rawFit?.[key], DEFAULT_SNAKE_PART_FIT[key]);
    }
    return normalized;
}

function readSkinPartFitOverrides() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(SKIN_PART_FIT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function resolveSkinPartFit(skin) {
    const baseFit = normalizeSnakePartFit(skin?.renderProfile?.partFit);
    if (skin?.lockClassicPartShape === true) {
        return baseFit;
    }
    const overrides = readSkinPartFitOverrides();
    const overrideFit = overrides?.[skin?.id];
    if (!overrideFit || typeof overrideFit !== 'object') {
        return baseFit;
    }

    const merged = {};
    for (const key of SNAKE_PART_FIT_KEYS) {
        merged[key] = normalizeSnakePartFitEntry(overrideFit?.[key], baseFit[key]);
    }
    return merged;
}

function getSpriteAlphaBounds(sprite) {
    const fallbackWidth = Math.max(1, Number(sprite?.width) || Number(sprite?.canvas?.width) || 1);
    const fallbackHeight = Math.max(1, Number(sprite?.height) || Number(sprite?.canvas?.height) || 1);
    const fallbackBounds = {
        x: 0,
        y: 0,
        width: fallbackWidth,
        height: fallbackHeight
    };
    if (!sprite?.canvas) {
        return fallbackBounds;
    }
    const cached = SPRITE_ALPHA_BOUNDS_CACHE.get(sprite);
    if (cached) {
        return cached;
    }

    const width = Math.max(1, Number(sprite.canvas.width) || fallbackWidth);
    const height = Math.max(1, Number(sprite.canvas.height) || fallbackHeight);
    let bounds = fallbackBounds;
    try {
        const ctx = sprite.canvas.getContext('2d', { willReadFrequently: true }) || sprite.canvas.getContext('2d');
        if (ctx) {
            const data = ctx.getImageData(0, 0, width, height).data;
            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < height; y += 1) {
                const rowOffset = y * width * 4;
                for (let x = 0; x < width; x += 1) {
                    const alpha = data[rowOffset + x * 4 + 3];
                    if (alpha <= 0) {
                        continue;
                    }
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
            if (maxX >= minX && maxY >= minY) {
                bounds = {
                    x: minX,
                    y: minY,
                    width: maxX - minX + 1,
                    height: maxY - minY + 1
                };
            }
        }
    } catch {
        bounds = fallbackBounds;
    }

    SPRITE_ALPHA_BOUNDS_CACHE.set(sprite, bounds);
    return bounds;
}

function maskedSpriteCacheKey(sourceSprite, maskSprite, fit, options = {}) {
    const safeFit = normalizeSnakePartFitEntry(fit, { scale: 1, offsetX: 0, offsetY: 0 });
    return [
        sourceSprite?.name || 'source',
        maskSprite?.name || 'mask',
        safeFit.scale.toFixed(4),
        safeFit.offsetX.toFixed(4),
        safeFit.offsetY.toFixed(4),
        options?.forceOpaque === true ? 'opaque' : 'soft'
    ].join('|');
}

function createMaskedSnakeSprite(sourceSprite, maskSprite, fit, options = {}) {
    if (!sourceSprite?.canvas || !maskSprite?.canvas) {
        return sourceSprite || null;
    }

    const safeFit = normalizeSnakePartFitEntry(fit, { scale: 1, offsetX: 0, offsetY: 0 });
    const forceOpaque = options?.forceOpaque === true;
    const cacheKey = maskedSpriteCacheKey(sourceSprite, maskSprite, safeFit, { forceOpaque });
    const cached = MASKED_SNAKE_SPRITE_CACHE.get(cacheKey);
    if (cached) {
        return cached;
    }

    const canvas = createSurface(maskSprite.width, maskSprite.height);
    const ctx = getSurfaceContext(canvas, true);
    if (!ctx) {
        return sourceSprite;
    }

    const sourceBounds = getSpriteAlphaBounds(sourceSprite);
    const maskBounds = getSpriteAlphaBounds(maskSprite);
    const sourceWidth = Math.max(1, Number(sourceBounds.width) || 1);
    const sourceHeight = Math.max(1, Number(sourceBounds.height) || 1);
    const maskWidth = Math.max(1, Number(maskBounds.width) || Number(canvas.width) || 1);
    const maskHeight = Math.max(1, Number(maskBounds.height) || Number(canvas.height) || 1);
    const containScale = Math.min(maskWidth / sourceWidth, maskHeight / sourceHeight);
    const baseScale = clamp(containScale, 0.05, 8);
    const scaledWidth = sourceWidth * baseScale * safeFit.scale;
    const scaledHeight = sourceHeight * baseScale * safeFit.scale;
    const drawX = maskBounds.x + (maskWidth - scaledWidth) * 0.5 + scaledWidth * safeFit.offsetX;
    const drawY = maskBounds.y + (maskHeight - scaledHeight) * 0.5 + scaledHeight * safeFit.offsetY;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        sourceSprite.canvas,
        sourceBounds.x,
        sourceBounds.y,
        sourceWidth,
        sourceHeight,
        drawX,
        drawY,
        scaledWidth,
        scaledHeight
    );
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskSprite.canvas, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    bleedTransparentEdgePixels(ctx, canvas.width, canvas.height, 2);
    if (isSnakeHeadSpriteName(sourceSprite.name || '')) {
        reduceOuterBrightHalo(ctx, canvas.width, canvas.height);
    }
    if (forceOpaque) {
        forceOpaqueAlpha(ctx, canvas.width, canvas.height);
    }

    const maskedSprite = {
        name: `${sourceSprite.name || 'snake-part'}-masked`,
        canvas,
        width: canvas.width,
        height: canvas.height
    };
    MASKED_SNAKE_SPRITE_CACHE.set(cacheKey, maskedSprite);
    return maskedSprite;
}

function ensureSnakeMaskSprites(atlas) {
    const defaultSkin = getSkinById(getDefaultSkinId());
    const maskPrefix = `snake-mask-${defaultSkin.id}`;
    const maskAssets = defaultSkin?.assets || {};

    atlas.maskSprites = atlas.maskSprites || {};
    for (const spec of SNAKE_PART_MASK_SPECS) {
        const key = spec.maskAssetKey;
        const current = atlas.maskSprites[key];
        atlas.maskSprites[key] = current || loadRasterSprite(`${maskPrefix}-${key}`, maskAssets[key]);
    }

    return SNAKE_PART_MASK_SPECS.every((spec) => {
        const key = spec.maskAssetKey;
        return Boolean(atlas.maskSprites?.[key]?.canvas);
    });
}

function ensureMaskedSnakeSprites(atlas) {
    if (!atlas?.sprites) {
        return false;
    }
    if (!ensureSnakeMaskSprites(atlas)) {
        return false;
    }

    const nextMaskedSprites = {};
    for (const spec of SNAKE_PART_MASK_SPECS) {
        const sourceSprite = atlas.sprites[spec.spriteKey];
        const maskSprite = atlas.maskSprites[spec.maskAssetKey];
        const fit = atlas.skinPartFit?.[spec.fitKey] || DEFAULT_SNAKE_PART_FIT[spec.fitKey];
        const maskedSprite = createMaskedSnakeSprite(sourceSprite, maskSprite, fit, {
            forceOpaque: atlas.forceOpaqueSnakeParts === true
        });
        if (!maskedSprite?.canvas) {
            return false;
        }
        nextMaskedSprites[spec.spriteKey] = maskedSprite;
    }

    atlas.maskedSnakeSprites = nextMaskedSprites;
    return true;
}

function getSnakeColorVariant(atlas, lineId = 0, preferredVariantIndex = null) {
    const variants = Array.isArray(atlas?.snakeColorVariants) && atlas.snakeColorVariants.length > 0
        ? atlas.snakeColorVariants
        : DEFAULT_SNAKE_COLOR_VARIANTS;
    const fallbackIndex = Math.abs(Math.trunc(lineId || 0));
    const preferred = Number(preferredVariantIndex);
    const rawIndex = Number.isFinite(preferred) ? Math.trunc(preferred) : fallbackIndex;
    const index = Math.abs(rawIndex) % variants.length;
    return variants[index];
}

function makeSnakeVariantSprite(sprite, variant) {
    if (!sprite?.canvas || !variant) return sprite;

    const spriteName = sprite.name || 'snake-sprite';
    const cacheKey = `${spriteName}:${variant.id}`;
    const cached = SNAKE_VARIANT_SPRITE_CACHE.get(cacheKey);
    if (cached) {
        return cached;
    }

    const canvas = createSurface(sprite.width, sprite.height);
    const ctx = getSurfaceContext(canvas, true);
    if (!ctx) {
        return sprite;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprite.canvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let usedBinaryMonochrome = false;
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha === 0) continue;

        if (variant.forceBinaryMonochrome) {
            usedBinaryMonochrome = true;
            const luma = (
                data[i] * 0.2126
                + data[i + 1] * 0.7152
                + data[i + 2] * 0.0722
            ) / 255;
            const isDark = luma < variant.monochromeThreshold;
            const outputIsLight = variant.invertBinaryMonochrome ? isDark : !isDark;
            const monoLightness = outputIsLight ? 1 : 0;
            const [r, g, b] = hslToRgb(0, 0, monoLightness);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            continue;
        }

        const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        if (variant.forceMonochrome) {
            const monoLightness = variant.monochromeLightness;
            const [r, g, b] = hslToRgb(0, 0, monoLightness);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            continue;
        }

        const shouldRemapNeutralLightness =
            Number.isFinite(variant.neutralLightnessTarget)
            && hsl.s <= variant.neutralSaturationThreshold
            && hsl.l >= variant.neutralLightnessThreshold;

        if (shouldRemapNeutralLightness) {
            // Darken/lighten only neutral bright body areas; keep dark line art untouched.
            const highlightRange = Math.max(0.0001, 1 - variant.neutralLightnessThreshold);
            const highlight = clamp((hsl.l - variant.neutralLightnessThreshold) / highlightRange, 0, 1);
            const shapedHighlight = Math.pow(highlight, 1.15);
            hsl.l = clamp(variant.neutralLightnessTarget + shapedHighlight * 0.18, 0, 1);
            hsl.s = Math.min(hsl.s, 0.08);
        }

        const preserveDetail = shouldRemapNeutralLightness || hsl.s < 0.08 || hsl.l < 0.08 || hsl.l > 0.96;
        const canTintNeutral =
            !shouldRemapNeutralLightness
            && variant.neutralTintStrength > 0
            && hsl.l > 0.12
            && hsl.l < 0.9;

        if (!preserveDetail) {
            hsl.h = normalizeHue(hsl.h + variant.hueShift);
        } else if (canTintNeutral) {
            // Tint near-grayscale body regions so monochrome skins can still separate by line color.
            hsl.h = normalizeHue(hsl.h + variant.hueShift);
            hsl.s = Math.max(hsl.s, 0.14 + variant.neutralTintStrength * 0.30);
        }

        const saturationBoost = preserveDetail ? Math.min(1.1, variant.saturation) : variant.saturation;
        const lightnessBoost = preserveDetail ? 1.02 : variant.lightness;
        const contrastBoost = preserveDetail ? 1.01 : variant.contrast;

        hsl.s = clamp(hsl.s * saturationBoost, 0, 1);
        hsl.l = clamp((hsl.l - 0.5) * contrastBoost + 0.5, 0, 1);
        hsl.l = clamp(hsl.l * lightnessBoost, 0, 1);

        const [r, g, b] = hslToRgb(hsl.h, hsl.s, hsl.l);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }

    if (usedBinaryMonochrome) {
        const edgeBase = variant.invertBinaryMonochrome ? 0 : 255;
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            // Anti-aliased edge pixels can produce colored/gray fringe after
            // binary recolor. Force edge RGB to body base tone.
            if (alpha > 0 && alpha < 255) {
                data[i] = edgeBase;
                data[i + 1] = edgeBase;
                data[i + 2] = edgeBase;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    const variantSprite = {
        ...sprite,
        name: `${spriteName}-${variant.id}`,
        canvas
    };
    SNAKE_VARIANT_SPRITE_CACHE.set(cacheKey, variantSprite);
    return variantSprite;
}

function getSnakeVariantSprite(sprite, variant) {
    if (!sprite || !variant) {
        return sprite;
    }
    return makeSnakeVariantSprite(sprite, variant) || sprite;
}

function createSurface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function getSurfaceContext(canvas, preferReadback = false) {
    if (!canvas) return null;
    if (!preferReadback) {
        return canvas.getContext('2d');
    }
    return canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
}

function spriteCacheKey(name, scale, paletteKey) {
    return `${name}:${scale}:${paletteKey}`;
}

function rasterCacheKey(name, path) {
    return `${name}:${path}`;
}

function bleedTransparentEdgePixels(ctx, width, height, passes = 2) {
    if (!ctx || width <= 0 || height <= 0) {
        return;
    }

    const passCount = Math.max(1, Math.min(3, Math.trunc(passes) || 1));
    for (let pass = 0; pass < passCount; pass++) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const next = new Uint8ClampedArray(data);
        let changed = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                if (data[index + 3] !== 0) {
                    continue;
                }

                let r = 0;
                let g = 0;
                let b = 0;
                let count = 0;

                const minY = Math.max(0, y - 1);
                const maxY = Math.min(height - 1, y + 1);
                const minX = Math.max(0, x - 1);
                const maxX = Math.min(width - 1, x + 1);
                for (let ny = minY; ny <= maxY; ny++) {
                    for (let nx = minX; nx <= maxX; nx++) {
                        if (nx === x && ny === y) continue;
                        const nIndex = (ny * width + nx) * 4;
                        if (data[nIndex + 3] === 0) {
                            continue;
                        }
                        r += data[nIndex];
                        g += data[nIndex + 1];
                        b += data[nIndex + 2];
                        count++;
                    }
                }

                if (count <= 0) {
                    continue;
                }

                next[index] = Math.round(r / count);
                next[index + 1] = Math.round(g / count);
                next[index + 2] = Math.round(b / count);
                changed = true;
            }
        }

        if (!changed) {
            break;
        }
        imageData.data.set(next);
        ctx.putImageData(imageData, 0, 0);
    }
}

function isSnakeHeadSpriteName(name) {
    return typeof name === 'string' && (name.endsWith('-head') || name.includes('-head-'));
}

function reduceOuterBrightHalo(ctx, width, height) {
    if (!ctx || width <= 0 || height <= 0) {
        return;
    }

    const passCount = 3;
    for (let pass = 0; pass < passCount; pass++) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const next = new Uint8ClampedArray(data);
        let changed = false;

        const indexOf = (x, y) => (y * width + x) * 4;
        const alphaAt = (x, y) => {
            if (x < 0 || y < 0 || x >= width || y >= height) {
                return 0;
            }
            return data[indexOf(x, y) + 3];
        };
        const isBrightNeutral = (r, g, b) => {
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            return max >= 208 && ((r + g + b) / 3) >= 200 && (max - min) <= 60;
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = indexOf(x, y);
                const alpha = data[index + 3];
                if (alpha === 0) {
                    continue;
                }

                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                if (!isBrightNeutral(r, g, b)) {
                    continue;
                }

                let nearTransparent = false;
                const boundaryRadius = 4;
                for (let oy = -boundaryRadius; oy <= boundaryRadius && !nearTransparent; oy++) {
                    for (let ox = -boundaryRadius; ox <= boundaryRadius; ox++) {
                        if (ox === 0 && oy === 0) continue;
                        if (alphaAt(x + ox, y + oy) === 0) {
                            nearTransparent = true;
                            break;
                        }
                    }
                }
                if (!nearTransparent) {
                    continue;
                }

                let sumR = 0;
                let sumG = 0;
                let sumB = 0;
                let count = 0;

                const sampleRadius = 3;
                const minY = Math.max(0, y - sampleRadius);
                const maxY = Math.min(height - 1, y + sampleRadius);
                const minX = Math.max(0, x - sampleRadius);
                const maxX = Math.min(width - 1, x + sampleRadius);
                for (let ny = minY; ny <= maxY; ny++) {
                    for (let nx = minX; nx <= maxX; nx++) {
                        if (nx === x && ny === y) continue;
                        const neighborIndex = indexOf(nx, ny);
                        const neighborAlpha = data[neighborIndex + 3];
                        if (neighborAlpha === 0) {
                            continue;
                        }
                        const nr = data[neighborIndex];
                        const ng = data[neighborIndex + 1];
                        const nb = data[neighborIndex + 2];
                        if (isBrightNeutral(nr, ng, nb)) {
                            continue;
                        }
                        sumR += nr;
                        sumG += ng;
                        sumB += nb;
                        count++;
                    }
                }

                if (count > 0) {
                    next[index] = Math.round(sumR / count);
                    next[index + 1] = Math.round(sumG / count);
                    next[index + 2] = Math.round(sumB / count);
                    next[index + 3] = Math.round(alpha * 0.68);
                } else {
                    next[index + 3] = Math.round(alpha * 0.4);
                }
                changed = true;
            }
        }

        if (!changed) {
            break;
        }
        imageData.data.set(next);
        ctx.putImageData(imageData, 0, 0);
    }
}

function forceOpaqueAlpha(ctx, width, height) {
    if (!ctx || width <= 0 || height <= 0) {
        return;
    }
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let changed = false;
    for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i];
        if (alpha === 0 || alpha === 255) {
            continue;
        }
        data[i] = 255;
        changed = true;
    }
    if (changed) {
        ctx.putImageData(imageData, 0, 0);
    }
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
            const ctx = getSurfaceContext(canvas, true);
            if (!ctx) {
                record.status = 'error';
                return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(image, 0, 0);
            // Some AI-exported heads carry bright outer fringe that becomes a white ring
            // after runtime downscale/rotation. Soften only snake-head outer boundary.
            if (isSnakeHeadSpriteName(name)) {
                reduceOuterBrightHalo(ctx, canvas.width, canvas.height);
            }
            // Fill RGB in fully transparent edge pixels to avoid dark fringe shimmer
            // when sprites are continuously rotated/scaled in animation.
            bleedTransparentEdgePixels(ctx, canvas.width, canvas.height, 2);
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
    const skin = getSkinById(atlas.skinId);
    const assets = skin.assets;
    const cachePrefix = `snake-${skin.id}`;

    atlas.sprites.snakeHead = atlas.sprites.snakeHead || loadRasterSprite(`${cachePrefix}-head`, assets.snakeHead);
    atlas.sprites.snakeSegA = atlas.sprites.snakeSegA
        || loadRasterSprite(`${cachePrefix}-seg-a`, assets.snakeSegA || assets.snakeSegB);
    atlas.sprites.snakeTailTip = atlas.sprites.snakeTailTip
        || loadRasterSprite(`${cachePrefix}-tail-tip`, assets.snakeTailTip || assets.snakeTailBase);

    const baseReady = Boolean(
        atlas.sprites.snakeHead &&
        atlas.sprites.snakeSegA &&
        atlas.sprites.snakeTailTip
    );

    if (!baseReady) {
        return false;
    }

    const maskedReady = ensureMaskedSnakeSprites(atlas);
    if (maskedReady) {
        return true;
    }

    // If mask layers are still loading, fallback to raw sprites temporarily.
    return true;
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
        stretchX = 1,
        shadowColor = null,
        shadowBlur = 0,
        shadowOffsetX = 0,
        shadowOffsetY = 0
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

    if (shadowColor && shadowBlur > 0) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOffsetX;
        ctx.shadowOffsetY = shadowOffsetY;
    }

    ctx.imageSmoothingEnabled = smooth;
    if (smooth) {
        ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(sprite.canvas, drawX, drawY, width, height);

    if (tint) {
        if (shadowColor && shadowBlur > 0) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
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
    const sprites = atlas?.maskedSnakeSprites || atlas?.sprites || {};
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

function expressionToHeadFitKey(expression) {
    switch (expression) {
        case 'curious':
            return 'headCurious';
        case 'sleepy':
            return 'headSleepy';
        case 'surprised':
            return 'headSurprised';
        default:
            return 'headDefault';
    }
}

function applyPartFitTransform(x, y, width, height, rotation, fit, flipX = false) {
    if (!fit) {
        return { x, y, scale: 1 };
    }
    const safeScale = readClampedNumber(fit.scale, 1, 0.8, 1.4);
    const nx = readClampedNumber(fit.offsetX, 0, -0.35, 0.35);
    const ny = readClampedNumber(fit.offsetY, 0, -0.35, 0.35);
    if (safeScale === 1 && nx === 0 && ny === 0) {
        return { x, y, scale: 1 };
    }

    const localX = width * nx * (flipX ? -1 : 1);
    const localY = height * ny;
    const cos = Math.cos(rotation || 0);
    const sin = Math.sin(rotation || 0);
    return {
        x: x + localX * cos - localY * sin,
        y: y + localX * sin + localY * cos,
        scale: safeScale
    };
}

function shouldSmoothSnakeSprite(scale) {
    if (!Number.isFinite(scale)) {
        return true;
    }
    // Snake assets are raster paintings, not pixel art. They are usually rendered
    // at a strong downscale ratio; nearest-neighbor introduces dark pixel shimmer.
    return scale <= 1.35;
}

function drawSnakeHeadSprite(ctx, sprite, x, y, options = {}) {
    if (!sprite || !sprite.canvas) return;

    const {
        alpha = 1,
        scale = 1,
        rotation = 0,
        flipX = false,
        tint = null,
        shadowColor = null,
        shadowBlur = 0,
        shadowOffsetX = 0,
        shadowOffsetY = 0
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
    if (shadowColor && shadowBlur > 0) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOffsetX;
        ctx.shadowOffsetY = shadowOffsetY;
    }
    const smooth = shouldSmoothSnakeSprite(scale);
    ctx.imageSmoothingEnabled = smooth;
    if (smooth) {
        ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(sprite.canvas, -width / 2, -height / 2, width, height);

    if (tint) {
        if (shadowColor && shadowBlur > 0) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
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
        colorVariantIndex = null,
        wiggleTime = 0,
        softPulse = 0,
        headExpression = 'default'
    } = styleState;

    if (!atlas || !ensureSnakeImageSprites(atlas)) return false;

    const spacing = clamp(atlas.cellSize * 0.88, 12, 22);
    const sampled = samplePolyline(pathPoints, spacing);
    // Support very short snakes (2 cells) with sprite rendering too, otherwise
    // they fall back to the legacy mole-head style and look like wrong assets.
    if (sampled.length < 3) return false;

    const styleTint = getStyleTint(style);
    const wiggleStrength = (style === 'remove' ? 2.2 : 0.78) + softPulse * 1.5;
    const thickness = clamp(atlas.cellSize * 0.9, 18, 34);
    const renderProfile = atlas.skinRenderProfile || DEFAULT_SNAKE_RENDER_PROFILE;
    const spriteScale = renderProfile.spriteScale || 1;
    const useMaskedSnakeSprites = !!atlas.maskedSnakeSprites;
    const partFit = useMaskedSnakeSprites
        ? DEFAULT_SNAKE_PART_FIT
        : (atlas.skinPartFit || DEFAULT_SNAKE_PART_FIT);
    const spriteSet = atlas.maskedSnakeSprites || atlas.sprites;
    const allowShadow = ENABLE_RUNTIME_SNAKE_SHADOW && style !== 'remove' && style !== 'error';
    const segmentShadowColor = allowShadow ? renderProfile.segmentShadowColor : null;
    const segmentShadowBlur = allowShadow ? renderProfile.segmentShadowBlur : 0;
    const segmentShadowOffsetX = allowShadow ? renderProfile.segmentShadowOffsetX : 0;
    const segmentShadowOffsetY = allowShadow ? renderProfile.segmentShadowOffsetY : 0;
    const headShadowColor = allowShadow ? renderProfile.headShadowColor : null;
    const headShadowBlur = allowShadow ? renderProfile.headShadowBlur : 0;
    const headShadowOffsetX = allowShadow ? renderProfile.headShadowOffsetX : 0;
    const headShadowOffsetY = allowShadow ? renderProfile.headShadowOffsetY : 0;
    const colorVariant = atlas.skinAllowHueVariants === false
        ? null
        : getSnakeColorVariant(atlas, lineId, colorVariantIndex);
    const bodySprite = getSnakeVariantSprite(
        spriteSet.snakeSegA || spriteSet.snakeSegB,
        colorVariant
    );
    const tailTipSprite = getSnakeVariantSprite(
        spriteSet.snakeTailTip || spriteSet.snakeTailBase,
        colorVariant
    );
    if (!bodySprite || !tailTipSprite) {
        return false;
    }

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

    const tailFit = partFit.tailTip || DEFAULT_SNAKE_PART_FIT.tailTip;
    const tailTipBaseScale = (thickness * 0.95 * spriteScale) / tailTipSprite.height;
    const tailTipScale = tailTipBaseScale * tailFit.scale;
    const tailSize = {
        width: tailTipSprite.width * tailTipScale,
        height: tailTipSprite.height * tailTipScale
    };
    const tailRender = applyPartFitTransform(
        tail.x,
        tail.y,
        tailSize.width,
        tailSize.height,
        tailAngle,
        tailFit,
        false
    );
    drawSprite(ctx, tailTipSprite, tailRender.x, tailRender.y, {
        alpha,
        rotation: tailAngle,
        scale: tailTipScale,
        tint: styleTint,
        smooth: shouldSmoothSnakeSprite(tailTipScale),
        shadowColor: segmentShadowColor,
        shadowBlur: segmentShadowBlur,
        shadowOffsetX: segmentShadowOffsetX,
        shadowOffsetY: segmentShadowOffsetY
    });

    for (let i = 1; i < bodyPoints.length - 2; i++) {
        const point = bodyPoints[i];
        const prev = bodyPoints[Math.max(0, i - 1)];
        const next = bodyPoints[Math.min(bodyPoints.length - 1, i + 1)];
        const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
        const t = i / Math.max(1, bodyPoints.length - 1);

        const sprite = bodySprite;
        const sizeTier = t > 0.76 ? 1.12 : (t > 0.5 ? 1.0 : 0.9);
        const pulse = 1 + Math.sin(i * 0.6 + wiggleTime * 2.1) * 0.03 + softPulse * 0.04;
        const baseScale = (thickness * sizeTier * pulse * spriteScale) / sprite.height;
        const segmentFit = partFit.segA || DEFAULT_SNAKE_PART_FIT.segA;
        const scale = baseScale * segmentFit.scale;
        const segmentSize = {
            width: sprite.width * scale,
            height: sprite.height * scale
        };
        const segmentRender = applyPartFitTransform(
            point.x,
            point.y,
            segmentSize.width,
            segmentSize.height,
            angle,
            segmentFit,
            false
        );

        drawSprite(ctx, sprite, segmentRender.x, segmentRender.y, {
            alpha,
            rotation: angle,
            scale,
            tint: styleTint,
            smooth: shouldSmoothSnakeSprite(scale),
            shadowColor: segmentShadowColor,
            shadowBlur: segmentShadowBlur,
            shadowOffsetX: segmentShadowOffsetX,
            shadowOffsetY: segmentShadowOffsetY
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

    const neckFit = partFit.segA || DEFAULT_SNAKE_PART_FIT.segA;
    const neckScale = ((thickness * 1.05 * spriteScale) / bodySprite.height) * neckFit.scale;
    const neckSize = {
        width: bodySprite.width * neckScale,
        height: bodySprite.height * neckScale
    };
    const neckFitRender = applyPartFitTransform(
        neckRender.x,
        neckRender.y,
        neckSize.width,
        neckSize.height,
        headPose.angle,
        neckFit,
        false
    );
    drawSprite(ctx, bodySprite, neckFitRender.x, neckFitRender.y, {
        alpha,
        rotation: headPose.angle,
        scale: neckScale,
        tint: styleTint,
        smooth: shouldSmoothSnakeSprite(neckScale),
        shadowColor: segmentShadowColor,
        shadowBlur: segmentShadowBlur,
        shadowOffsetX: segmentShadowOffsetX,
        shadowOffsetY: segmentShadowOffsetY
    });

    const headSprite = pickSnakeHeadSprite(atlas, headExpression);
    const coloredHeadSprite = getSnakeVariantSprite(headSprite, colorVariant);
    const headFitKey = expressionToHeadFitKey(headExpression);
    const headFit = partFit[headFitKey] || DEFAULT_SNAKE_PART_FIT[headFitKey];
    const headScale = ((thickness * 1.1 * spriteScale) / coloredHeadSprite.height) * headFit.scale;
    const headSize = {
        width: coloredHeadSprite.width * headScale,
        height: coloredHeadSprite.height * headScale
    };
    const headFitRender = applyPartFitTransform(
        headRender.x,
        headRender.y,
        headSize.width,
        headSize.height,
        headPose.angle,
        headFit,
        headPose.flipX
    );
    drawSnakeHeadSprite(ctx, coloredHeadSprite, headFitRender.x, headFitRender.y, {
        alpha,
        rotation: headPose.angle,
        flipX: headPose.flipX,
        scale: headScale,
        tint: styleTint,
        shadowColor: headShadowColor,
        shadowBlur: headShadowBlur,
        shadowOffsetX: headShadowOffsetX,
        shadowOffsetY: headShadowOffsetY
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

export function buildGameSpriteAtlas(cellSize, dpr = 1, themeName = 'moleFamily', skinId = null) {
    const theme = getThemePalette(themeName);
    const skin = getSkinById(skinId);
    const scale = clamp(Math.round((cellSize / 18) * Math.min(2, Math.max(1, dpr))), 2, 5);
    const cachePrefix = `snake-${skin.id}`;
    const snakeColorVariants = resolveSnakeColorVariants(skin);
    const skinRenderProfile = resolveSkinRenderProfile(skin);
    const skinPartFit = resolveSkinPartFit(skin);

    return {
        cellSize,
        scale,
        theme,
        skinId: skin.id,
        forceOpaqueSnakeParts: skin.forceOpaqueSnakeParts === true,
        skinAllowHueVariants: skin.allowHueVariants !== false,
        snakeColorVariants,
        skinRenderProfile,
        skinPartFit,
        sprites: {
            gridDot: renderSprite('grid-dot-mole', MATRICES.gridDot, theme.palette, clamp(scale - 1, 1, 4)),
            tileBase: renderSprite('tile-base-mole', MATRICES.tileBase, theme.palette, clamp(scale - 1, 1, 4)),
            tileVar1: renderSprite('tile-var1-mole', MATRICES.tileVar1, theme.palette, clamp(scale - 1, 1, 4)),
            tileVar2: renderSprite('tile-var2-mole', MATRICES.tileVar2, theme.palette, clamp(scale - 1, 1, 4)),
            decoRune: renderSprite('deco-mushroom', MATRICES.decoMushroom, theme.palette, clamp(scale - 1, 1, 4)),
            decoTorch: renderSprite('deco-flower', MATRICES.decoFlower, theme.palette, clamp(scale - 1, 1, 4)),
            particleSquare: renderSprite('particle-leaf', MATRICES.particleLeaf, theme.palette, clamp(scale - 1, 1, 4)),
            particleStar: renderSprite('particle-heart', MATRICES.particleHeart, theme.palette, clamp(scale - 1, 1, 4)),
            snakeHead: loadRasterSprite(`${cachePrefix}-head`, skin.assets.snakeHead),
            snakeSegA: loadRasterSprite(`${cachePrefix}-seg-a`, skin.assets.snakeSegA),
            snakeTailTip: loadRasterSprite(`${cachePrefix}-tail-tip`, skin.assets.snakeTailTip)
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










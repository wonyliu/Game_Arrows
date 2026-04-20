import {
    LOCAL_SKIN_CATALOG_STORAGE_KEY,
    LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY,
    clearSkinPriceOverrides,
    getDefaultCoinCostBySkinId,
    isBuiltInSkinId,
    getSkinById,
    getSkinCatalog,
    isLegacyColorVariantSkinId,
    readSkinPriceOverrides,
    writeSkinPriceOverrides
} from './skins.js?v=32';

const NAME_ZH_OVERRIDE_KEY = 'arrowClear_skinNameZhOverrides_v1';
const NAME_EN_OVERRIDE_KEY = 'arrowClear_skinNameEnOverrides_v1';
const DESC_ZH_OVERRIDE_KEY = 'arrowClear_skinDescZhOverrides_v1';
const DESC_EN_OVERRIDE_KEY = 'arrowClear_skinDescEnOverrides_v1';
const LOCAL_SKIN_PRICE_KEY = 'arrowClear_localSkinPriceOverrides_v1';
const SKIN_PRICE_SERVER_FILE = 'skin-price-overrides-v1';
const STORAGE_API_BASE = '/api/storage';
const DEFAULT_SKIN_ID = 'classic-burrow';
const ATLAS_SOURCE_SIZE = Object.freeze({ width: 1984, height: 2174 });
const ATLAS_PART_LAYOUT = Object.freeze({
    snakeHead: Object.freeze({ x: 98, y: 80, width: 824, height: 646 }),
    snakeHeadCurious: Object.freeze({ x: 1051, y: 80, width: 827, height: 646 }),
    snakeHeadSleepy: Object.freeze({ x: 98, y: 792, width: 824, height: 644 }),
    snakeHeadSurprised: Object.freeze({ x: 1053, y: 792, width: 827, height: 644 }),
    snakeSegA: Object.freeze({ x: 104, y: 1493, width: 848, height: 613 }),
    snakeSegB: Object.freeze({ x: 104, y: 1493, width: 848, height: 613 }),
    snakeTailBase: Object.freeze({ x: 1059, y: 1516, width: 817, height: 519 }),
    snakeTailTip: Object.freeze({ x: 1059, y: 1516, width: 817, height: 519 })
});
const ATLAS_GREEN_KEY = Object.freeze({
    color: '#239638',
    tolerance: 74,
    feather: 18
});
const ASSET_PREVIEW_CACHE = new Map();

const PARTS = Object.freeze([
    Object.freeze({ key: 'headDefault', label: 'Head Default', file: 'snake_head.png', assetKey: 'snakeHead' }),
    Object.freeze({ key: 'headCurious', label: 'Head Curious', file: 'snake_head_curious.png', assetKey: 'snakeHeadCurious' }),
    Object.freeze({ key: 'headSleepy', label: 'Head Sleepy', file: 'snake_head_sleepy.png', assetKey: 'snakeHeadSleepy' }),
    Object.freeze({ key: 'headSurprised', label: 'Head Surprised', file: 'snake_head_surprised.png', assetKey: 'snakeHeadSurprised' }),
    Object.freeze({ key: 'segA', label: 'Segment A', file: 'snake_seg_a.png', assetKey: 'snakeSegA' }),
    Object.freeze({ key: 'segB', label: 'Segment B', file: 'snake_seg_b.png', assetKey: 'snakeSegB' }),
    Object.freeze({ key: 'tailBase', label: 'Tail Base', file: 'snake_tail_base.png', assetKey: 'snakeTailBase' }),
    Object.freeze({ key: 'tailTip', label: 'Tail Tip', file: 'snake_tail_tip.png', assetKey: 'snakeTailTip' })
]);

const el = {
    list: document.getElementById('skinLibraryList'),
    listStatus: document.getElementById('skinLibraryStatus'),
    search: document.getElementById('skinLibrarySearch'),
    select: document.getElementById('skinPriceSelect'),
    btnRefresh: document.getElementById('btnSkinRefreshList'),
    btnOpenGenA: document.getElementById('btnShowSkinGenView'),
    btnImportAtlas: document.getElementById('btnImportAtlasSkin'),
    btnCloseGen: document.getElementById('btnCloseSkinGenView'),
    importAtlasInput: document.getElementById('inputImportAtlasSkin'),

    detailView: document.getElementById('skinDetailView'),
    genView: document.getElementById('skinGenView'),
    workspaceTitle: document.getElementById('skinWorkspaceTitle'),

    skinId: document.getElementById('skinMetaSkinId'),
    nameZh: document.getElementById('skinMetaNameZh'),
    nameEn: document.getElementById('skinMetaNameEn'),
    descZh: document.getElementById('skinMetaDescZh'),
    descEn: document.getElementById('skinMetaDescEn'),
    priceCurrent: document.getElementById('skinPriceCurrent'),
    priceInput: document.getElementById('skinPriceInput'),
    btnSaveMeta: document.getElementById('btnSaveSkinMeta'),
    btnDeleteSkin: document.getElementById('btnDeleteLocalSkin'),
    metaStatus: document.getElementById('skinPriceStatus'),
    partList: document.getElementById('skinPartList'),

    btnSavePriceLegacy: document.getElementById('btnSaveSkinPrice'),
    btnResetPriceLegacy: document.getElementById('btnResetSkinPrice'),
    priceDefault: document.getElementById('skinPriceDefault')
};

const REQUIRED_KEYS = [
    'list',
    'listStatus',
    'search',
    'select',
    'btnRefresh',
    'btnOpenGenA',
    'btnImportAtlas',
    'btnCloseGen',
    'importAtlasInput',
    'detailView',
    'genView',
    'workspaceTitle',
    'skinId',
    'nameZh',
    'nameEn',
    'descZh',
    'descEn',
    'priceCurrent',
    'priceInput',
    'btnSaveMeta',
    'btnDeleteSkin',
    'metaStatus',
    'partList',
    'btnSavePriceLegacy'
];

const hasRequired = REQUIRED_KEYS.every((key) => Boolean(el[key]));
if (!hasRequired) {
    console.warn('[admin-skin-manager] missing required elements');
}

const state = {
    skins: [],
    selectedSkinId: '',
    filterText: '',
    nameZhOverrides: readJsonStorage(NAME_ZH_OVERRIDE_KEY, {}),
    nameEnOverrides: readJsonStorage(NAME_EN_OVERRIDE_KEY, {}),
    descZhOverrides: readJsonStorage(DESC_ZH_OVERRIDE_KEY, {}),
    descEnOverrides: readJsonStorage(DESC_EN_OVERRIDE_KEY, {}),
    localSkinPriceOverrides: readJsonStorage(LOCAL_SKIN_PRICE_KEY, {})
};

function readJsonStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value || {}, null, 2));
}

function normalizePriceMap(rawMap) {
    const source = rawMap && typeof rawMap === 'object' ? rawMap : {};
    const normalized = {};
    for (const [rawSkinId, rawPrice] of Object.entries(source)) {
        const skinId = sanitizeId(rawSkinId);
        if (!skinId) {
            continue;
        }
        const parsed = Number(rawPrice);
        normalized[skinId] = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    }
    return normalized;
}

function buildServerSkinPriceMap() {
    const merged = {
        ...normalizePriceMap(readSkinPriceOverrides()),
        ...normalizePriceMap(state.localSkinPriceOverrides)
    };
    return normalizePriceMap(merged);
}

async function fetchSkinPriceOverridesFromServer() {
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${SKIN_PRICE_SERVER_FILE}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return {};
        }
        const payload = await response.json().catch(() => ({}));
        return normalizePriceMap(payload);
    } catch {
        return {};
    }
}

async function persistSkinPriceOverridesToServer(priceMap) {
    const payload = normalizePriceMap(priceMap);
    const response = await fetch(`${STORAGE_API_BASE}/${SKIN_PRICE_SERVER_FILE}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`价格同步到服务器失败 (${response.status})`);
    }
}

async function hydrateSkinPriceOverridesFromServer() {
    const serverMap = await fetchSkinPriceOverridesFromServer();
    const builtInMap = {};
    const localMap = {};
    for (const [skinId, price] of Object.entries(serverMap)) {
        if (isBuiltInSkinId(skinId)) {
            builtInMap[skinId] = price;
        } else {
            localMap[skinId] = price;
        }
    }

    const normalizedBuiltIn = writeSkinPriceOverrides(builtInMap);
    if (!normalizedBuiltIn || Object.keys(normalizedBuiltIn).length <= 0) {
        clearSkinPriceOverrides();
    }

    state.localSkinPriceOverrides = normalizePriceMap(localMap);
    writeJsonStorage(LOCAL_SKIN_PRICE_KEY, state.localSkinPriceOverrides);
}

function writeLocalSkinCatalog(savedRows, catalogSkins = []) {
    const builtInIds = new Set([DEFAULT_SKIN_ID]);
    const savedIds = (Array.isArray(savedRows) ? savedRows : []).map((row) => sanitizeId(row?.id)).filter(Boolean);
    const candidateBaseIdSet = new Set([...builtInIds, ...savedIds, DEFAULT_SKIN_ID]);
    const existingRows = readJsonStorage(LOCAL_SKIN_CATALOG_STORAGE_KEY, []);
    const existingById = new Map(
        (Array.isArray(existingRows) ? existingRows : [])
            .map((row) => [sanitizeId(row?.id), row])
            .filter(([id]) => Boolean(id))
    );
    const payload = [];
    for (const row of (Array.isArray(savedRows) ? savedRows : [])) {
        const id = sanitizeId(row?.id);
        if (!id || id === DEFAULT_SKIN_ID || builtInIds.has(id)) {
            continue;
        }
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        const nameZh = normalizeLabel(state.nameZhOverrides[id], normalizeLabel(row?.nameZh, id));
        const nameEn = normalizeLabel(state.nameEnOverrides[id], id);
        const descriptionZh = normalizeDescription(
            state.descZhOverrides[id],
            normalizeDescription(row?.descriptionZh, 'AI 生成皮肤。')
        );
        const descriptionEn = normalizeDescription(
            state.descEnOverrides[id],
            normalizeDescription(row?.descriptionEn, 'AI generated skin.')
        );
        payload.push({
            id,
            nameZh,
            nameEn,
            descriptionZh,
            descriptionEn,
            preview: `${row?.preview || `/assets/skins/${id}/snake_head.png`}`.split('?')[0],
            coinCost: Object.prototype.hasOwnProperty.call(state.localSkinPriceOverrides, id)
                ? Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[id]) || 0))
                : Math.max(0, Math.floor(Number(row?.coinCost) || 0)),
            ...(row?.assets && typeof row.assets === 'object' ? { assets: row.assets } : {}),
            ...(typeof row?.allowHueVariants === 'boolean' ? { allowHueVariants: row.allowHueVariants } : {})
        });
    }
    for (const [id, row] of existingById.entries()) {
        if (!id || id === DEFAULT_SKIN_ID || builtInIds.has(id)) {
            continue;
        }
        if (payload.some((entry) => sanitizeId(entry.id) === id)) {
            continue;
        }
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        payload.push({
            id,
            nameZh: normalizeLabel(state.nameZhOverrides[id], normalizeLabel(row?.nameZh, id)),
            nameEn: normalizeLabel(state.nameEnOverrides[id], normalizeLabel(row?.nameEn, id)),
            descriptionZh: normalizeDescription(state.descZhOverrides[id], normalizeDescription(row?.descriptionZh, 'AI generated skin.')),
            descriptionEn: normalizeDescription(state.descEnOverrides[id], normalizeDescription(row?.descriptionEn, 'AI generated skin.')),
            preview: `${row?.preview || `/assets/skins/${id}/snake_head.png`}`.split('?')[0],
            coinCost: Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[id]) || row?.coinCost || 0)),
            ...(row?.assets && typeof row.assets === 'object' ? { assets: row.assets } : {}),
            ...(typeof row?.allowHueVariants === 'boolean' ? { allowHueVariants: row.allowHueVariants } : {})
        });
    }
    localStorage.setItem(LOCAL_SKIN_CATALOG_STORAGE_KEY, JSON.stringify(payload, null, 2));
}

function sanitizeId(raw) {
    return `${raw || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeLabel(raw, fallback = '') {
    const text = `${raw || ''}`.replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function normalizeDescription(raw, fallback = '') {
    const text = `${raw || ''}`.replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function buildLocalAssets(skinId) {
    const id = sanitizeId(skinId);
    if (!id) return null;
    const base = `/assets/skins/${id}`;
    return {
        snakeHead: `${base}/snake_head.png`,
        snakeHeadCurious: `${base}/snake_head_curious.png`,
        snakeHeadSleepy: `${base}/snake_head_sleepy.png`,
        snakeHeadSurprised: `${base}/snake_head_surprised.png`,
        snakeSegA: `${base}/snake_seg_a.png`,
        snakeSegB: `${base}/snake_seg_b.png`,
        snakeTailBase: `${base}/snake_tail_base.png`,
        snakeTailTip: `${base}/snake_tail_tip.png`
    };
}

function buildAtlasAssetsForSkin(skinId, cacheTag = '1') {
    const id = sanitizeId(skinId);
    const atlasSrc = `/assets/skins/${id}/skin_atlas.png?v=${cacheTag}`;
    const assets = {};
    for (const [key, crop] of Object.entries(ATLAS_PART_LAYOUT)) {
        assets[key] = {
            src: atlasSrc,
            crop: { ...crop, sourceWidth: ATLAS_SOURCE_SIZE.width, sourceHeight: ATLAS_SOURCE_SIZE.height },
            chromaKey: { ...ATLAS_GREEN_KEY }
        };
    }
    return assets;
}

function normalizeAssetUrl(asset, fallback = '') {
    if (typeof asset === 'string') {
        return asset;
    }
    if (asset && typeof asset === 'object' && typeof asset.src === 'string') {
        return asset.src;
    }
    return fallback;
}

function resolveAssetPreview(img, asset, fallback = '') {
    if (!(img instanceof HTMLImageElement)) {
        return;
    }
    if (typeof asset === 'string') {
        img.src = asset || fallback;
        return;
    }
    if (!asset || typeof asset !== 'object' || typeof asset.src !== 'string') {
        img.src = fallback;
        return;
    }
    const crop = asset.crop && typeof asset.crop === 'object' ? asset.crop : null;
    if (!crop) {
        img.src = asset.src;
        return;
    }
    const cacheKey = JSON.stringify({ src: asset.src, crop, chromaKey: asset.chromaKey || null });
    const cached = ASSET_PREVIEW_CACHE.get(cacheKey);
    if (cached) {
        img.src = cached;
        return;
    }
    const source = new Image();
    source.decoding = 'async';
    source.onload = () => {
        const basisWidth = Math.max(1, Math.round(Number(crop.sourceWidth) || source.naturalWidth));
        const basisHeight = Math.max(1, Math.round(Number(crop.sourceHeight) || source.naturalHeight));
        const scaleX = source.naturalWidth / basisWidth;
        const scaleY = source.naturalHeight / basisHeight;
        const width = Math.max(1, Math.round((Number(crop.width) || source.naturalWidth) * scaleX));
        const height = Math.max(1, Math.round((Number(crop.height) || source.naturalHeight) * scaleY));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
        if (!ctx) {
            img.src = asset.src;
            return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            source,
            Math.max(0, Math.round((Number(crop.x) || 0) * scaleX)),
            Math.max(0, Math.round((Number(crop.y) || 0) * scaleY)),
            width,
            height,
            0,
            0,
            width,
            height
        );
        const chromaKey = asset.chromaKey && typeof asset.chromaKey === 'object' ? asset.chromaKey : null;
        if (chromaKey) {
            const data = ctx.getImageData(0, 0, width, height);
            const pixels = data.data;
            const color = `${chromaKey.color || '#00ff00'}`.trim().toLowerCase();
            const r = Number.parseInt(color.slice(1, 3), 16) || 0;
            const g = Number.parseInt(color.slice(3, 5), 16) || 255;
            const b = Number.parseInt(color.slice(5, 7), 16) || 0;
            const tolerance = Math.max(1, Number(chromaKey.tolerance) || 60);
            const feather = Math.max(0, Math.min(tolerance, Number(chromaKey.feather) || 0));
            const hardCutoff = Math.max(0, tolerance - feather);
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] === 0) continue;
                const dr = pixels[i] - r;
                const dg = pixels[i + 1] - g;
                const db = pixels[i + 2] - b;
                const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
                if (distance > tolerance) continue;
                if (distance <= hardCutoff || feather <= 0) {
                    pixels[i + 3] = 0;
                } else {
                    const progress = (distance - hardCutoff) / Math.max(1e-6, feather);
                    pixels[i + 3] = Math.round(pixels[i + 3] * Math.max(0, Math.min(1, progress)));
                }
            }
            ctx.putImageData(data, 0, 0);
        }
        const dataUrl = canvas.toDataURL('image/png');
        ASSET_PREVIEW_CACHE.set(cacheKey, dataUrl);
        img.src = dataUrl;
    };
    source.onerror = () => {
        img.src = fallback || normalizeAssetUrl(asset, '');
    };
    source.src = asset.src;
}

function deriveImportedSkinBaseName(filename = '') {
    const raw = `${filename || ''}`.replace(/\.[^.]+$/, '').trim();
    return raw || `imported-atlas-${Date.now().toString(36)}`;
}

function createImportedSkinId(baseName) {
    const baseId = sanitizeId(baseName) || `imported-atlas-${Date.now().toString(36)}`;
    let nextId = baseId;
    let attempt = 1;
    const usedIds = new Set(state.skins.map((skin) => skin.id));
    while (usedIds.has(nextId)) {
        attempt += 1;
        nextId = `${baseId}-${attempt}`;
    }
    return nextId;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(reader.error || new Error('file read failed'));
        reader.readAsDataURL(file);
    });
}

function createAtlasPreviewDataUrl(dataUrl, crop = ATLAS_PART_LAYOUT.snakeHead) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const basisWidth = Math.max(1, Math.round(Number(crop.sourceWidth) || ATLAS_SOURCE_SIZE.width));
            const basisHeight = Math.max(1, Math.round(Number(crop.sourceHeight) || ATLAS_SOURCE_SIZE.height));
            const scaleX = image.naturalWidth / basisWidth;
            const scaleY = image.naturalHeight / basisHeight;
            const width = Math.max(1, Math.round(crop.width * scaleX));
            const height = Math.max(1, Math.round(crop.height * scaleY));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('preview canvas unavailable'));
                return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
                image,
                Math.max(0, Math.round(crop.x * scaleX)),
                Math.max(0, Math.round(crop.y * scaleY)),
                width,
                height,
                0,
                0,
                width,
                height
            );
            const data = ctx.getImageData(0, 0, width, height);
            const pixels = data.data;
            const r = 0x23;
            const g = 0x96;
            const b = 0x38;
            const tolerance = ATLAS_GREEN_KEY.tolerance;
            const feather = ATLAS_GREEN_KEY.feather;
            const hardCutoff = Math.max(0, tolerance - feather);
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] === 0) continue;
                const dr = pixels[i] - r;
                const dg = pixels[i + 1] - g;
                const db = pixels[i + 2] - b;
                const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
                if (distance > tolerance) continue;
                if (distance <= hardCutoff) {
                    pixels[i + 3] = 0;
                } else {
                    const progress = (distance - hardCutoff) / Math.max(1e-6, feather);
                    pixels[i + 3] = Math.round(pixels[i + 3] * Math.max(0, Math.min(1, progress)));
                }
            }
            ctx.putImageData(data, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => reject(new Error('atlas preview decode failed'));
        image.src = dataUrl;
    });
}

function convertImageDataUrlToPng(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, image.naturalWidth || image.width || 1);
            canvas.height = Math.max(1, image.naturalHeight || image.height || 1);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('atlas canvas unavailable'));
                return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => reject(new Error('atlas decode failed'));
        image.src = dataUrl;
    });
}

function upsertLocalCatalogRow(nextRow) {
    const id = sanitizeId(nextRow?.id);
    if (!id || id === DEFAULT_SKIN_ID) {
        return;
    }
    const rows = readJsonStorage(LOCAL_SKIN_CATALOG_STORAGE_KEY, []);
    const filtered = (Array.isArray(rows) ? rows : []).filter((row) => sanitizeId(row?.id) !== id);
    filtered.push({
        id,
        nameZh: normalizeLabel(nextRow?.nameZh, id),
        nameEn: normalizeLabel(nextRow?.nameEn, id),
        descriptionZh: normalizeDescription(nextRow?.descriptionZh, 'Imported atlas skin.'),
        descriptionEn: normalizeDescription(nextRow?.descriptionEn, 'Imported atlas skin.'),
        preview: `${nextRow?.preview || `/assets/skins/${id}/skin_preview.png`}`.split('?')[0],
        coinCost: Math.max(0, Math.floor(Number(nextRow?.coinCost) || 0)),
        ...(nextRow?.assets && typeof nextRow.assets === 'object' ? { assets: nextRow.assets } : {}),
        ...(typeof nextRow?.allowHueVariants === 'boolean' ? { allowHueVariants: nextRow.allowHueVariants } : {})
    });
    localStorage.setItem(LOCAL_SKIN_CATALOG_STORAGE_KEY, JSON.stringify(filtered, null, 2));
}

function removeLocalCatalogRow(skinId) {
    const id = sanitizeId(skinId);
    if (!id) {
        return;
    }
    const rows = readJsonStorage(LOCAL_SKIN_CATALOG_STORAGE_KEY, []);
    const filtered = (Array.isArray(rows) ? rows : []).filter((row) => sanitizeId(row?.id) !== id);
    localStorage.setItem(LOCAL_SKIN_CATALOG_STORAGE_KEY, JSON.stringify(filtered, null, 2));
}

function setListStatus(text, isError = false) {
    el.listStatus.textContent = text || '';
    el.listStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setMetaStatus(text, isError = false) {
    el.metaStatus.textContent = text || '';
    el.metaStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

async function fetchSavedSkins() {
    try {
        const res = await fetch('/api/skin-gen/saved-skins', { method: 'GET', cache: 'no-store' });
        if (!res.ok) return [];
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload?.skins) ? payload.skins : [];
        const normalizedRows = rows
            .map((row) => ({
                id: sanitizeId(row?.id),
                nameZh: normalizeLabel(row?.nameZh),
                descriptionZh: normalizeDescription(row?.descriptionZh),
                descriptionEn: normalizeDescription(row?.descriptionEn),
                coinCost: Math.max(0, Math.floor(Number(row?.coinCost) || 0)),
                complete: !!row?.complete,
                preview: typeof row?.preview === 'string' ? row.preview : '',
                protected: !!row?.protected,
                assets: row?.assets && typeof row.assets === 'object' ? row.assets : null,
                allowHueVariants: row?.allowHueVariants !== false
            }))
            .filter((row) => !!row.id && row.complete);
        const candidateBaseIdSet = new Set(normalizedRows.map((row) => row.id));
        candidateBaseIdSet.add(DEFAULT_SKIN_ID);
        return normalizedRows.filter((row) => !isLegacyColorVariantSkinId(row.id, candidateBaseIdSet) && !isLegacyColorVariantSkinId(row.id));
    } catch {
        return [];
    }
}

function getSkinDisplayName(skin, locale = 'zh-CN') {
    if (!skin) return '';
    if (skin.name?.[locale]) return skin.name[locale];
    return skin.name?.['en-US'] || skin.id;
}

function getSkinDescriptionByLocale(skin, locale = 'zh-CN') {
    if (!skin) return '';
    if (skin.description?.[locale]) return skin.description[locale];
    return skin.description?.['en-US'] || '';
}

function buildMergedSkins(catalog, savedRows) {
    const catalogIds = (Array.isArray(catalog) ? catalog : []).map((skin) => sanitizeId(skin?.id)).filter(Boolean);
    const savedIds = (Array.isArray(savedRows) ? savedRows : []).map((row) => sanitizeId(row?.id)).filter(Boolean);
    const candidateBaseIdSet = new Set([...catalogIds, ...savedIds, DEFAULT_SKIN_ID]);
    const savedById = new Map(savedRows.map((row) => [row.id, row]));
    const byId = new Map();

    for (const skin of catalog) {
        const id = sanitizeId(skin.id);
        if (!id) continue;

        const saved = savedById.get(id);
        if (!saved && id !== DEFAULT_SKIN_ID) {
            byId.set(id, {
                id,
                source: 'catalog',
                protected: id === DEFAULT_SKIN_ID,
                preview: typeof skin.preview === 'string' ? skin.preview.split('?')[0] : '',
                assets: skin.assets,
                defaultPrice: Math.max(0, Math.floor(Number(getDefaultCoinCostBySkinId(id)) || 0)),
                currentPrice: Math.max(0, Math.floor(Number(getSkinById(id)?.coinCost) || 0)),
                defaultZh: normalizeLabel(getSkinDisplayName(skin, 'zh-CN'), id),
                defaultEn: normalizeLabel(getSkinDisplayName(skin, 'en-US'), id),
                defaultDescZh: normalizeDescription(getSkinDescriptionByLocale(skin, 'zh-CN'), 'AI generated skin.'),
                defaultDescEn: normalizeDescription(getSkinDescriptionByLocale(skin, 'en-US'), 'AI generated skin.')
            });
            continue;
        }

        byId.set(id, {
            id,
            source: 'catalog',
            protected: id === DEFAULT_SKIN_ID,
            preview: saved?.preview || `${skin.preview || skin.assets?.snakeHead || ''}`.split('?')[0],
            assets: saved?.assets || (saved ? buildLocalAssets(id) : skin.assets),
            defaultPrice: Math.max(0, Math.floor(Number(getDefaultCoinCostBySkinId(id)) || 0)),
            currentPrice: Math.max(0, Math.floor(Number(getSkinById(id)?.coinCost) || 0)),
            defaultZh: normalizeLabel(saved?.nameZh || getSkinDisplayName(skin, 'zh-CN'), id),
            defaultEn: normalizeLabel(getSkinDisplayName(skin, 'en-US'), id),
            defaultDescZh: normalizeDescription(saved?.descriptionZh || getSkinDescriptionByLocale(skin, 'zh-CN'), 'AI 生成皮肤。'),
            defaultDescEn: normalizeDescription(saved?.descriptionEn || getSkinDescriptionByLocale(skin, 'en-US'), 'AI generated skin.')
        });
    }

    for (const row of savedRows) {
        if (byId.has(row.id)) continue;
        if (isLegacyColorVariantSkinId(row.id, candidateBaseIdSet) || isLegacyColorVariantSkinId(row.id)) continue;
        byId.set(row.id, {
            id: row.id,
            source: 'local',
            protected: row.id === DEFAULT_SKIN_ID,
            preview: row.preview || `/assets/skins/${row.id}/snake_head.png`,
            assets: row.assets && typeof row.assets === 'object' ? row.assets : buildLocalAssets(row.id),
            defaultPrice: Math.max(0, Math.floor(Number(row.coinCost) || 0)),
            currentPrice: Object.prototype.hasOwnProperty.call(state.localSkinPriceOverrides, row.id)
                ? Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[row.id]) || 0))
                : Math.max(0, Math.floor(Number(row.coinCost) || 0)),
            defaultZh: row.nameZh || row.id,
            defaultEn: row.id,
            defaultDescZh: normalizeDescription(row.descriptionZh, 'AI 生成皮肤。'),
            defaultDescEn: normalizeDescription(row.descriptionEn, 'AI generated skin.')
        });
    }

    return Array.from(byId.values()).sort((a, b) => {
        if (a.id === DEFAULT_SKIN_ID) return -1;
        if (b.id === DEFAULT_SKIN_ID) return 1;
        return a.id.localeCompare(b.id);
    });
}

function getSkinByStateId(skinId) {
    return state.skins.find((skin) => skin.id === skinId) || null;
}

function resolveNameZh(skin) {
    return normalizeLabel(state.nameZhOverrides[skin.id], skin.defaultZh || skin.id);
}

function resolveNameEn(skin) {
    return normalizeLabel(state.nameEnOverrides[skin.id], skin.defaultEn || skin.id);
}

function resolveDescZh(skin) {
    return normalizeDescription(state.descZhOverrides[skin.id], skin.defaultDescZh || 'AI 生成皮肤。');
}

function resolveDescEn(skin) {
    return normalizeDescription(state.descEnOverrides[skin.id], skin.defaultDescEn || 'AI generated skin.');
}

function syncSelectOptions() {
    el.select.innerHTML = '';
    for (const skin of state.skins) {
        const option = document.createElement('option');
        option.value = skin.id;
        option.textContent = `${resolveNameZh(skin)} (${skin.id})`;
        el.select.appendChild(option);
    }
    if (state.selectedSkinId && state.skins.some((skin) => skin.id === state.selectedSkinId)) {
        el.select.value = state.selectedSkinId;
    }
}

function renderPartList(skin) {
    el.partList.innerHTML = '';
    for (const part of PARTS) {
        const card = document.createElement('article');
        card.className = 'skin-part-item';

        const thumb = document.createElement('div');
        thumb.className = 'skin-part-thumb';
        const img = document.createElement('img');
        img.alt = part.label;
        img.loading = 'lazy';
        resolveAssetPreview(img, skin?.assets?.[part.assetKey], skin.preview || '');
        thumb.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'skin-part-meta';
        meta.innerHTML = `<strong>${part.label}</strong><span>${part.file}</span>`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'skin-part-fit-btn';
        btn.textContent = '微调';
        btn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('admin-skin-open-fit', {
                detail: { skinId: state.selectedSkinId, partKey: part.key }
            }));
        });

        card.appendChild(thumb);
        card.appendChild(meta);
        card.appendChild(btn);
        el.partList.appendChild(card);
    }
}

function renderMeta(skin) {
    if (!skin) return;
    el.skinId.value = skin.id;
    el.nameZh.value = resolveNameZh(skin);
    el.nameEn.value = resolveNameEn(skin);
    el.descZh.value = resolveDescZh(skin);
    el.descEn.value = resolveDescEn(skin);

    const catalogSkin = getSkinById(skin.id);
    const hasExactCatalogSkin = catalogSkin?.id === skin.id;
    const currentPrice = hasExactCatalogSkin
        ? Math.max(0, Math.floor(Number(catalogSkin.coinCost) || 0))
        : Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[skin.id]) || 0));

    if (el.priceDefault) {
        el.priceDefault.textContent = `${skin.defaultPrice}`;
    }
    el.priceCurrent.textContent = `${currentPrice}`;
    el.priceInput.value = `${currentPrice}`;
    el.btnDeleteSkin.disabled = skin.protected;
}

function renderLibrary() {
    const keyword = state.filterText.toLowerCase();
    const rows = state.skins.filter((skin) => {
        if (!keyword) return true;
        const zh = resolveNameZh(skin).toLowerCase();
        const en = resolveNameEn(skin).toLowerCase();
        return skin.id.includes(keyword) || zh.includes(keyword) || en.includes(keyword);
    });

    el.list.innerHTML = '';
    for (const skin of rows) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'skin-library-item';
        card.classList.toggle('is-active', skin.id === state.selectedSkinId);

        const img = document.createElement('img');
        img.className = 'skin-library-thumb';
        img.alt = skin.id;
        img.loading = 'lazy';
        img.src = skin.preview || normalizeAssetUrl(skin.assets?.snakeHead, '');

        const label = document.createElement('div');
        label.className = 'skin-library-name';
        label.innerHTML = `<strong>${resolveNameZh(skin)}</strong><span>${resolveNameEn(skin)} · ${skin.id}</span>`;

        card.appendChild(img);
        card.appendChild(label);
        card.addEventListener('click', () => selectSkin(skin.id, false));
        el.list.appendChild(card);
    }
}

function selectSkin(skinId, fromSelect) {
    const id = sanitizeId(skinId);
    if (!id || !state.skins.some((skin) => skin.id === id)) return;
    state.selectedSkinId = id;
    syncSelectOptions();
    if (!fromSelect) {
        el.select.value = id;
        el.select.dispatchEvent(new Event('change'));
    }
    const skin = getSkinByStateId(id);
    renderMeta(skin);
    renderPartList(skin);
    renderLibrary();
    window.dispatchEvent(new CustomEvent('admin-skin-selected', { detail: { skinId: id } }));
}

function syncTemplateFromSelectedSkin() {
    const templateSelect = document.getElementById('skinGenTemplateSelect');
    const selected = sanitizeId(el.select.value || state.selectedSkinId);
    if (!templateSelect || !selected) return;
    const exists = Array.from(templateSelect.options).some((option) => sanitizeId(option.value) === selected);
    if (!exists) return;
    templateSelect.value = selected;
    templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

function setWorkspaceView(view) {
    const showGen = view === 'gen';
    el.detailView.classList.toggle('is-active', !showGen);
    el.genView.classList.toggle('is-active', showGen);
    el.workspaceTitle.textContent = showGen ? '新建皮肤' : '皮肤详情';
    if (showGen) {
        setTimeout(syncTemplateFromSelectedSkin, 0);
    }
}

async function saveNames(skin) {
    const nextZh = normalizeLabel(el.nameZh.value, skin.defaultZh || skin.id);
    const nextEn = normalizeLabel(el.nameEn.value, skin.defaultEn || skin.id);
    const nextDescZh = normalizeDescription(el.descZh.value, skin.defaultDescZh || 'AI 生成皮肤。');
    const nextDescEn = normalizeDescription(el.descEn.value, skin.defaultDescEn || 'AI generated skin.');
    state.nameZhOverrides[skin.id] = nextZh;
    state.nameEnOverrides[skin.id] = nextEn;
    state.descZhOverrides[skin.id] = nextDescZh;
    state.descEnOverrides[skin.id] = nextDescEn;
    writeJsonStorage(NAME_ZH_OVERRIDE_KEY, state.nameZhOverrides);
    writeJsonStorage(NAME_EN_OVERRIDE_KEY, state.nameEnOverrides);
    writeJsonStorage(DESC_ZH_OVERRIDE_KEY, state.descZhOverrides);
    writeJsonStorage(DESC_EN_OVERRIDE_KEY, state.descEnOverrides);

    await fetch('/api/skin-gen/skin-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId: skin.id, nameZh: nextZh })
    }).catch(() => null);
}

async function saveMeta() {
    const skin = getSkinByStateId(state.selectedSkinId);
    if (!skin) return;
    try {

    await saveNames(skin);

    const price = Math.max(0, Math.floor(Number(el.priceInput.value) || 0));
    if (isBuiltInSkinId(skin.id)) {
        const defaultPrice = Math.max(0, Math.floor(Number(getDefaultCoinCostBySkinId(skin.id)) || 0));
        const nextOverrides = {
            ...readSkinPriceOverrides()
        };
        if (price === defaultPrice) {
            delete nextOverrides[skin.id];
        } else {
            nextOverrides[skin.id] = price;
        }
        const normalizedOverrides = writeSkinPriceOverrides(nextOverrides);
        if (!normalizedOverrides || Object.keys(normalizedOverrides).length <= 0) {
            clearSkinPriceOverrides();
        }
        if (Object.prototype.hasOwnProperty.call(state.localSkinPriceOverrides, skin.id)) {
            delete state.localSkinPriceOverrides[skin.id];
            writeJsonStorage(LOCAL_SKIN_PRICE_KEY, state.localSkinPriceOverrides);
        }
    } else {
        state.localSkinPriceOverrides[skin.id] = price;
        writeJsonStorage(LOCAL_SKIN_PRICE_KEY, state.localSkinPriceOverrides);
    }

    await persistSkinPriceOverridesToServer(buildServerSkinPriceMap());
    await refreshCatalog(false);
    selectSkin(skin.id, false);
    setMetaStatus(`已保存：${skin.id}`);
    } catch (error) {
        setMetaStatus(error?.message || 'Save failed.', true);
    }
}

async function deleteSkin() {
    const skin = getSkinByStateId(state.selectedSkinId);
    if (!skin || skin.protected || skin.id === DEFAULT_SKIN_ID) {
        return setMetaStatus('默认皮肤（洞穴经典）不可删除。', true);
    }

    if (!window.confirm(`确认删除皮肤 ${skin.id} ?\n将删除 assets/skins/${skin.id}/ 下全部文件。`)) {
        return;
    }

    try {
        const res = await fetch('/api/skin-gen/delete-skin', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skinId: skin.id })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.ok) throw new Error(payload?.error || `删除失败 (${res.status})`);

        delete state.nameZhOverrides[skin.id];
        delete state.nameEnOverrides[skin.id];
        delete state.descZhOverrides[skin.id];
        delete state.descEnOverrides[skin.id];
        delete state.localSkinPriceOverrides[skin.id];
        const colorVariantMap = readJsonStorage(LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY, {});
        if (colorVariantMap && typeof colorVariantMap === 'object' && Object.prototype.hasOwnProperty.call(colorVariantMap, skin.id)) {
            delete colorVariantMap[skin.id];
            writeJsonStorage(LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY, colorVariantMap);
        }
        writeJsonStorage(NAME_ZH_OVERRIDE_KEY, state.nameZhOverrides);
        writeJsonStorage(NAME_EN_OVERRIDE_KEY, state.nameEnOverrides);
        writeJsonStorage(DESC_ZH_OVERRIDE_KEY, state.descZhOverrides);
        writeJsonStorage(DESC_EN_OVERRIDE_KEY, state.descEnOverrides);
        writeJsonStorage(LOCAL_SKIN_PRICE_KEY, state.localSkinPriceOverrides);
        removeLocalCatalogRow(skin.id);

        await refreshCatalog(true);
        window.dispatchEvent(new CustomEvent('admin-skin-catalog-updated'));
        setMetaStatus(`已删除皮肤：${skin.id}`);
    } catch (error) {
        setMetaStatus(error?.message || '删除失败。', true);
    }
}

async function refreshCatalog(resetSelection) {
    const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
    const savedRows = await fetchSavedSkins();
    writeLocalSkinCatalog(savedRows, catalog);
    state.skins = buildMergedSkins(catalog, savedRows);

    const fallback = state.skins.find((skin) => skin.id === DEFAULT_SKIN_ID)?.id || state.skins[0]?.id || '';
    if (resetSelection || !state.skins.some((skin) => skin.id === state.selectedSkinId)) {
        state.selectedSkinId = fallback;
    }

    syncSelectOptions();
    renderLibrary();
    selectSkin(state.selectedSkinId, true);
    setListStatus(`共 ${state.skins.length} 套皮肤。`);

    window.dispatchEvent(new CustomEvent('admin-skin-catalog-updated'));
}

async function importAtlasSkinFromFile(file) {
    if (!(file instanceof File)) {
        return;
    }
    const derivedBase = deriveImportedSkinBaseName(file.name);
    const skinId = createImportedSkinId(derivedBase);
    const skinNameZh = normalizeLabel(derivedBase, skinId);
    const sourceDataUrl = await readFileAsDataUrl(file);
    const imageDataUrl = await convertImageDataUrlToPng(sourceDataUrl);
    const previewDataUrl = await createAtlasPreviewDataUrl(imageDataUrl);
    const res = await fetch('/api/skin-gen/import-atlas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            skinId,
            skinNameZh,
            atlasImageDataUrl: imageDataUrl,
            previewImageDataUrl: previewDataUrl
        })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || `导入失败 (${res.status})`);
    }
    upsertLocalCatalogRow({
        id: skinId,
        nameZh: skinNameZh,
        nameEn: skinId,
        descriptionZh: '导入的 atlas 贴图皮肤。',
        descriptionEn: 'Imported atlas-sheet skin.',
        preview: payload.preview || `/assets/skins/${skinId}/skin_preview.png`,
        assets: payload.assets || buildAtlasAssetsForSkin(skinId, payload.cacheTag || Date.now().toString(36)),
        allowHueVariants: true,
        coinCost: 0
    });
    await refreshCatalog(false);
    selectSkin(skinId, false);
    setMetaStatus(`已导入 atlas 皮肤：${skinId}`);
}

function bindEvents() {
    el.search.addEventListener('input', () => {
        state.filterText = `${el.search.value || ''}`.trim();
        renderLibrary();
    });

    el.select.addEventListener('change', () => selectSkin(el.select.value, true));
    el.btnRefresh.addEventListener('click', () => { void refreshCatalog(false); });
    el.btnSaveMeta.addEventListener('click', () => { void saveMeta(); });
    el.btnDeleteSkin.addEventListener('click', () => { void deleteSkin(); });

    const openGen = () => setWorkspaceView('gen');
    el.btnOpenGenA.addEventListener('click', openGen);
    el.btnImportAtlas.addEventListener('click', () => {
        el.importAtlasInput.value = '';
        el.importAtlasInput.click();
    });
    el.btnCloseGen.addEventListener('click', () => setWorkspaceView('detail'));
    el.importAtlasInput.addEventListener('change', () => {
        const file = el.importAtlasInput.files?.[0] || null;
        if (!file) {
            return;
        }
        setMetaStatus(`正在导入 atlas：${file.name}`);
        void importAtlasSkinFromFile(file).catch((error) => {
            setMetaStatus(error?.message || '导入 atlas 失败', true);
        });
    });

    window.addEventListener('admin-skin-catalog-refresh', () => {
        void refreshCatalog(false);
    });
}

async function init() {
    bindEvents();
    await hydrateSkinPriceOverridesFromServer();
    setWorkspaceView('detail');
    await refreshCatalog(true);
}

if (hasRequired) {
    init().catch((error) => {
        setListStatus(error?.message || '皮肤管理初始化失败。', true);
    });
}









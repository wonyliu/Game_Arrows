import { getSkinById, getSkinCatalog } from './skins.js?v=31';
import {
    initSkinPartFitStorage,
    readSkinPartFitOverrides,
    saveSkinPartFitOverrides,
    SKIN_PART_FIT_STORAGE_KEY
} from './skin-fit-storage.js?v=1';

const STORAGE_KEY = SKIN_PART_FIT_STORAGE_KEY;
const GAME_PROGRESS_KEY = 'arrowClear_progress';
const DEFAULT_SKIN_ID = 'classic-burrow';
const DEFAULT_FIT = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });
const PREVIEW_MASK_ALPHA_KEY = 'arrowClear_skinFitPreviewMaskAlpha';
const PARTS = Object.freeze([
    Object.freeze({ key: 'headDefault', label: 'Head Default', assetKey: 'snakeHead' }),
    Object.freeze({ key: 'headCurious', label: 'Head Curious', assetKey: 'snakeHeadCurious' }),
    Object.freeze({ key: 'headSleepy', label: 'Head Sleepy', assetKey: 'snakeHeadSleepy' }),
    Object.freeze({ key: 'headSurprised', label: 'Head Surprised', assetKey: 'snakeHeadSurprised' }),
    Object.freeze({ key: 'segA', label: 'Segment A', assetKey: 'snakeSegA' }),
    Object.freeze({ key: 'segB', label: 'Segment B', assetKey: 'snakeSegB' }),
    Object.freeze({ key: 'tailBase', label: 'Tail Base', assetKey: 'snakeTailBase' }),
    Object.freeze({ key: 'tailTip', label: 'Tail Tip', assetKey: 'snakeTailTip' })
]);

const state = {
    skinId: 'candy-dream',
    partKey: 'headDefault',
    overrides: {},
    maskAlpha: 35,
    images: {
        skin: null,
        mask: null,
        maskLayers: null
    }
};

const imageCache = new Map();
const el = {
    modal: document.getElementById('skinFitModal'),
    modalClose: document.getElementById('fitBtnCloseModal'),
    skinSelect: document.getElementById('skinPriceSelect'),
    selectionHint: document.getElementById('fitSelectionHint'),
    partSelect: document.getElementById('fitPartSelect'),
    scaleRange: document.getElementById('fitScaleRange'),
    scaleNumber: document.getElementById('fitScaleNumber'),
    offsetXRange: document.getElementById('fitOffsetXRange'),
    offsetXNumber: document.getElementById('fitOffsetXNumber'),
    offsetYRange: document.getElementById('fitOffsetYRange'),
    offsetYNumber: document.getElementById('fitOffsetYNumber'),
    maskAlphaRange: document.getElementById('fitMaskAlphaRange'),
    maskAlphaNumber: document.getElementById('fitMaskAlphaNumber'),
    btnLoadConfig: document.getElementById('fitBtnLoadConfig'),
    btnLoadEffective: document.getElementById('fitBtnLoadEffective'),
    btnSavePart: document.getElementById('fitBtnSavePart'),
    btnResetPart: document.getElementById('fitBtnResetPart'),
    btnResetSkin: document.getElementById('fitBtnResetSkin'),
    btnImportJson: document.getElementById('fitBtnImportJson'),
    btnCopyJson: document.getElementById('fitBtnCopyJson'),
    output: document.getElementById('fitOverrideOutput'),
    status: document.getElementById('fitStatusText'),
    canvas: document.getElementById('fitPreviewCanvas')
};
const ctx = el.canvas ? el.canvas.getContext('2d') : null;
const requiredKeys = [
    'skinSelect',
    'selectionHint',
    'partSelect',
    'scaleRange',
    'scaleNumber',
    'offsetXRange',
    'offsetXNumber',
    'offsetYRange',
    'offsetYNumber',
    'maskAlphaRange',
    'maskAlphaNumber',
    'btnLoadConfig',
    'btnLoadEffective',
    'btnSavePart',
    'btnResetPart',
    'btnResetSkin',
    'btnImportJson',
    'btnCopyJson',
    'output',
    'status',
    'canvas'
];
const hasAllElements = requiredKeys.every((key) => Boolean(el[key])) && Boolean(ctx);

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeFit(raw, fallback = DEFAULT_FIT) {
    return {
        scale: clamp(Number.isFinite(Number(raw?.scale)) ? Number(raw.scale) : fallback.scale, 0.8, 1.4),
        offsetX: clamp(Number.isFinite(Number(raw?.offsetX)) ? Number(raw.offsetX) : fallback.offsetX, -0.35, 0.35),
        offsetY: clamp(Number.isFinite(Number(raw?.offsetY)) ? Number(raw.offsetY) : fallback.offsetY, -0.35, 0.35)
    };
}

function readOverrides() {
    return readSkinPartFitOverrides();
}

function writeOverrides(overrides) {
    void saveSkinPartFitOverrides(overrides);
}

function readMaskAlpha() {
    try {
        const raw = Number(localStorage.getItem(PREVIEW_MASK_ALPHA_KEY));
        if (!Number.isFinite(raw)) return 35;
        // Backward compatibility: old versions stored 0.0 ~ 0.8
        const value = raw <= 1 ? raw * 100 : raw;
        return clamp(value, 0, 100);
    } catch {
        return 35;
    }
}

function writeMaskAlpha(value) {
    localStorage.setItem(PREVIEW_MASK_ALPHA_KEY, String(clamp(value, 0, 100)));
}

function readGameProgress() {
    try {
        const raw = localStorage.getItem(GAME_PROGRESS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function getSelectionState() {
    const progress = readGameProgress();
    const gameSkinId = `${progress?.selectedSkinId || ''}`.trim() || DEFAULT_SKIN_ID;
    const editingSkinId = `${state.skinId || ''}`.trim() || DEFAULT_SKIN_ID;
    const unlockedSkinIds = Array.isArray(progress?.unlockedSkinIds) ? progress.unlockedSkinIds : [DEFAULT_SKIN_ID];
    const editingSkinUnlocked = editingSkinId === DEFAULT_SKIN_ID || unlockedSkinIds.includes(editingSkinId);
    return {
        gameSkinId,
        editingSkinId,
        unlockedSkinIds,
        editingSkinUnlocked
    };
}

function buildLocalSkinAssets(skinId) {
    const id = `${skinId || ''}`.trim();
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

function resolveSkinConfig(skinId) {
    const id = `${skinId || ''}`.trim() || DEFAULT_SKIN_ID;
    const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
    const fromCatalog = catalog.find((skin) => skin?.id === id);
    if (fromCatalog) {
        return fromCatalog;
    }
    return {
        id,
        name: {
            'zh-CN': id,
            'en-US': id
        },
        assets: buildLocalSkinAssets(id),
        renderProfile: {
            partFit: {}
        },
        lockClassicPartShape: false
    };
}

function getSkinLabel(skinId) {
    const skin = resolveSkinConfig(skinId);
    return `${skin?.name?.['zh-CN'] || skin?.id || skinId} (${skin?.id || skinId})`;
}

function updateSelectionHint() {
    if (!el.selectionHint) {
        return;
    }

    const selection = getSelectionState();
    const { gameSkinId, editingSkinId, editingSkinUnlocked } = selection;
    const gameSkinLabel = getSkinLabel(gameSkinId);
    const editingSkinLabel = getSkinLabel(editingSkinId);

    if (!editingSkinUnlocked) {
        el.selectionHint.textContent = `\u6b63\u5728\u7f16\u8f91\uff1a${editingSkinLabel}\u3002\u8be5\u76ae\u80a4\u5728\u6e38\u620f\u5b58\u6863\u4e2d\u672a\u89e3\u9501\uff0c\u5b9e\u673a\u4e0d\u4f1a\u663e\u793a\u3002`;
        el.selectionHint.style.color = '#ffcf93';
        return;
    }

    if (gameSkinId === editingSkinId) {
        el.selectionHint.textContent = `\u6e38\u620f\u5f53\u524d\u76ae\u80a4\uff1a${gameSkinLabel}\uff08\u4e0e\u6b63\u5728\u7f16\u8f91\u4e00\u81f4\uff09\u3002`;
        el.selectionHint.style.color = 'var(--muted)';
        return;
    }

    el.selectionHint.textContent = `\u6e38\u620f\u5f53\u524d\u76ae\u80a4\uff1a${gameSkinLabel}\uff1b\u6b63\u5728\u7f16\u8f91\uff1a${editingSkinLabel}\u3002\u5207\u6362\u5230\u8be5\u76ae\u80a4\u540e\u624d\u4f1a\u770b\u5230\u6539\u52a8\u3002`;
    el.selectionHint.style.color = '#ffcf93';
}

function setStatus(text, isError = false) {
    if (!el.status) {
        return;
    }
    el.status.textContent = text || '';
    el.status.style.color = isError ? '#ff96ad' : '#9df2c0';
}

function getPartMeta(partKey) {
    return PARTS.find((part) => part.key === partKey) || PARTS[0];
}

function getConfiguredPartFit(skin, partKey) {
    return normalizeFit(skin?.renderProfile?.partFit?.[partKey], DEFAULT_FIT);
}

function isShapeLockedSkin(skin) {
    return skin?.lockClassicPartShape === true;
}

function getOverridePartFit(skinId, partKey) {
    return normalizeFit(state.overrides?.[skinId]?.[partKey], DEFAULT_FIT);
}

function getEffectivePartFit(skin, partKey) {
    const configured = getConfiguredPartFit(skin, partKey);
    if (isShapeLockedSkin(skin)) {
        return configured;
    }
    const overrideRaw = state.overrides?.[skin.id]?.[partKey];
    return overrideRaw ? normalizeFit(overrideRaw, configured) : configured;
}

function applyFitLockState(skin) {
    const locked = isShapeLockedSkin(skin);
    const fitControls = [
        el.scaleRange,
        el.scaleNumber,
        el.offsetXRange,
        el.offsetXNumber,
        el.offsetYRange,
        el.offsetYNumber
    ];
    for (const control of fitControls) {
        if (control) {
            control.disabled = locked;
        }
    }
    if (el.btnSavePart) {
        el.btnSavePart.disabled = locked;
    }
}

function setFitInputs(fit) {
    const normalized = normalizeFit(fit);
    el.scaleRange.value = normalized.scale.toFixed(3);
    el.scaleNumber.value = normalized.scale.toFixed(3);
    el.offsetXRange.value = normalized.offsetX.toFixed(3);
    el.offsetXNumber.value = normalized.offsetX.toFixed(3);
    el.offsetYRange.value = normalized.offsetY.toFixed(3);
    el.offsetYNumber.value = normalized.offsetY.toFixed(3);
}

function getFitFromInputs() {
    return normalizeFit({
        scale: Number(el.scaleNumber.value),
        offsetX: Number(el.offsetXNumber.value),
        offsetY: Number(el.offsetYNumber.value)
    });
}

function syncInputPair(rangeEl, numberEl) {
    const push = (value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return;
        rangeEl.value = numeric;
        numberEl.value = numeric.toFixed(3);
        drawPreview();
    };
    rangeEl.addEventListener('input', () => push(rangeEl.value));
    numberEl.addEventListener('input', () => push(numberEl.value));
}

function drawCheckerboard(width, height) {
    const size = 16;
    for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
            const even = ((x / size) + (y / size)) % 2 === 0;
            ctx.fillStyle = even ? '#463a32' : '#5a4a3f';
            ctx.fillRect(x, y, size, size);
        }
    }
}

function buildMaskLayers(maskImage) {
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = maskImage.width;
    alphaCanvas.height = maskImage.height;
    const alphaCtx = alphaCanvas.getContext('2d');
    alphaCtx.fillStyle = '#ffffff';
    alphaCtx.fillRect(0, 0, alphaCanvas.width, alphaCanvas.height);
    alphaCtx.globalCompositeOperation = 'destination-in';
    alphaCtx.drawImage(maskImage, 0, 0);

    const tintCanvas = document.createElement('canvas');
    tintCanvas.width = maskImage.width;
    tintCanvas.height = maskImage.height;
    const tintCtx = tintCanvas.getContext('2d');
    tintCtx.fillStyle = 'rgba(26, 180, 255, 1)';
    tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
    tintCtx.globalCompositeOperation = 'destination-in';
    tintCtx.drawImage(maskImage, 0, 0);

    const edgeCanvas = document.createElement('canvas');
    edgeCanvas.width = maskImage.width;
    edgeCanvas.height = maskImage.height;
    const edgeCtx = edgeCanvas.getContext('2d');

    const src = alphaCtx.getImageData(0, 0, alphaCanvas.width, alphaCanvas.height);
    const edge = edgeCtx.createImageData(edgeCanvas.width, edgeCanvas.height);
    const { data } = src;
    const edgeData = edge.data;
    const width = alphaCanvas.width;
    const height = alphaCanvas.height;

    const isOpaque = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        return data[(y * width + x) * 4 + 3] > 0;
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!isOpaque(x, y)) continue;
            if (
                !isOpaque(x - 1, y) ||
                !isOpaque(x + 1, y) ||
                !isOpaque(x, y - 1) ||
                !isOpaque(x, y + 1)
            ) {
                const index = (y * width + x) * 4;
                edgeData[index] = 255;
                edgeData[index + 1] = 255;
                edgeData[index + 2] = 255;
                edgeData[index + 3] = 255;
            }
        }
    }
    edgeCtx.putImageData(edge, 0, 0);

    return { alphaCanvas, tintCanvas, edgeCanvas };
}

async function loadImage(path) {
    const safePath = typeof path === 'string' ? path.trim() : '';
    if (!safePath || safePath === '[object Object]') {
        throw new Error(`Invalid image path: ${path}`);
    }
    if (imageCache.has(safePath)) {
        return imageCache.get(safePath);
    }
    const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load image: ${safePath}`));
        image.src = safePath;
    });
    imageCache.set(safePath, promise);
    return promise;
}

function resolveAssetPath(asset) {
    if (typeof asset === 'string') {
        const text = asset.trim();
        return text && text !== '[object Object]' ? text : '';
    }
    if (asset && typeof asset === 'object') {
        const direct = `${asset.src || asset.url || asset.path || asset.href || ''}`.trim();
        if (direct && direct !== '[object Object]') {
            return direct;
        }
    }
    return '';
}

function toOpaqueImageSurface(image) {
    if (!image?.width || !image?.height) {
        return image;
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const localCtx = canvas.getContext('2d');
    localCtx.drawImage(image, 0, 0);
    const imageData = localCtx.getImageData(0, 0, canvas.width, canvas.height);
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
        localCtx.putImageData(imageData, 0, 0);
    }
    return canvas;
}

async function loadPartImages() {
    const skin = resolveSkinConfig(state.skinId);
    const maskSkin = getSkinById(DEFAULT_SKIN_ID);
    const part = getPartMeta(state.partKey);
    const skinPath = resolveAssetPath(skin?.assets?.[part.assetKey]);
    const maskPath = resolveAssetPath(maskSkin?.assets?.[part.assetKey]);
    if (!skinPath || !maskPath) {
        throw new Error(`Missing asset path for part: ${part.key}`);
    }

    const [skinImageRaw, maskImage] = await Promise.all([loadImage(skinPath), loadImage(maskPath)]);
    const skinImage = skin?.forceOpaqueSnakeParts === true
        ? toOpaqueImageSurface(skinImageRaw)
        : skinImageRaw;
    state.images.skin = skinImage;
    state.images.mask = maskImage;
    state.images.maskLayers = buildMaskLayers(maskImage);
}

function drawPreview() {
    const skinImage = state.images.skin;
    const maskImage = state.images.mask;
    const layers = state.images.maskLayers;
    if (!skinImage || !maskImage || !layers) {
        return;
    }

    const fit = getFitFromInputs();
    const canvasWidth = el.canvas.width;
    const canvasHeight = el.canvas.height;
    drawCheckerboard(canvasWidth, canvasHeight);

    const baseScale = Math.min(
        (canvasWidth * 0.74) / maskImage.width,
        (canvasHeight * 0.80) / maskImage.height
    );

    const maskWidth = maskImage.width * baseScale;
    const maskHeight = maskImage.height * baseScale;
    const maskX = (canvasWidth - maskWidth) * 0.5;
    const maskY = (canvasHeight - maskHeight) * 0.5;

    const drawWidth = skinImage.width * baseScale * fit.scale;
    const drawHeight = skinImage.height * baseScale * fit.scale;
    const drawCenterX = canvasWidth * 0.5 + fit.offsetX * drawWidth;
    const drawCenterY = canvasHeight * 0.5 + fit.offsetY * drawHeight;
    const drawX = drawCenterX - drawWidth * 0.5;
    const drawY = drawCenterY - drawHeight * 0.5;

    // Use an intermediate layer so preview shows true masked result (same as runtime).
    const maskedLayer = document.createElement('canvas');
    maskedLayer.width = canvasWidth;
    maskedLayer.height = canvasHeight;
    const maskedCtx = maskedLayer.getContext('2d');
    maskedCtx.imageSmoothingEnabled = true;
    maskedCtx.imageSmoothingQuality = 'high';
    maskedCtx.drawImage(skinImage, drawX, drawY, drawWidth, drawHeight);
    maskedCtx.globalCompositeOperation = 'destination-in';
    maskedCtx.drawImage(maskImage, maskX, maskY, maskWidth, maskHeight);
    maskedCtx.globalCompositeOperation = 'source-over';

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(maskedLayer, 0, 0);

    ctx.globalAlpha = clamp(state.maskAlpha, 0, 100) / 100;
    ctx.drawImage(layers.tintCanvas, maskX, maskY, maskWidth, maskHeight);
    ctx.globalAlpha = 1;
    ctx.drawImage(layers.edgeCanvas, maskX, maskY, maskWidth, maskHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvasWidth * 0.5, 0);
    ctx.lineTo(canvasWidth * 0.5, canvasHeight);
    ctx.moveTo(0, canvasHeight * 0.5);
    ctx.lineTo(canvasWidth, canvasHeight * 0.5);
    ctx.stroke();
}

function refreshOutput() {
    el.output.value = JSON.stringify(state.overrides, null, 2);
}

function setSelectionFitToConfig() {
    const skin = resolveSkinConfig(state.skinId);
    const fit = getConfiguredPartFit(skin, state.partKey);
    setFitInputs(fit);
    drawPreview();
}

function setSelectionFitToEffective() {
    const skin = resolveSkinConfig(state.skinId);
    const fit = getEffectivePartFit(skin, state.partKey);
    setFitInputs(fit);
    drawPreview();
}


function saveCurrentPartOverride() {
    if (!state.skinId || !state.partKey) {
        setStatus('Please select a skin and a part first.', true);
        return;
    }
    const skin = resolveSkinConfig(state.skinId);
    if (isShapeLockedSkin(skin)) {
        if (state.overrides[state.skinId]) {
            delete state.overrides[state.skinId];
            writeOverrides(state.overrides);
            refreshOutput();
            updateSelectionHint();
        }
        setSelectionFitToConfig();
        setStatus('该皮肤形状已锁定为洞穴经典，禁止保存 scale/x/y 覆盖。');
        return;
    }

    const fit = getFitFromInputs();
    const skinOverrides = state.overrides[state.skinId] || {};
    skinOverrides[state.partKey] = fit;
    state.overrides[state.skinId] = skinOverrides;
    writeOverrides(state.overrides);
    refreshOutput();
    updateSelectionHint();
    const selection = getSelectionState();
    if (selection.gameSkinId !== selection.editingSkinId) {
        setStatus(`\u5df2\u4fdd\u5b58 ${state.skinId} / ${state.partKey}\u3002\u5f53\u524d\u6e38\u620f\u76ae\u80a4\u4e0d\u662f\u8be5\u76ae\u80a4\uff0c\u8fdb\u6e38\u620f\u5207\u6362\u540e\u624d\u4f1a\u751f\u6548\u3002`);
        return;
    }
    setStatus(`\u5df2\u4fdd\u5b58 ${state.skinId} / ${state.partKey}\uff0c\u56de\u5230\u6e38\u620f\u5237\u65b0\u5373\u53ef\u770b\u5230\u6548\u679c\u3002`);
}


function resetCurrentPartOverride() {
    if (state.overrides[state.skinId]) {
        delete state.overrides[state.skinId][state.partKey];
        if (Object.keys(state.overrides[state.skinId]).length === 0) {
            delete state.overrides[state.skinId];
        }
    }
    writeOverrides(state.overrides);
    refreshOutput();
    setSelectionFitToEffective();
    updateSelectionHint();
    setStatus(`Reset ${state.skinId} / ${state.partKey}`);
}


function resetCurrentSkinOverride() {
    delete state.overrides[state.skinId];
    writeOverrides(state.overrides);
    refreshOutput();
    setSelectionFitToEffective();
    updateSelectionHint();
    setStatus(`Cleared overrides for ${state.skinId}`);
}

async function copyOutputJson() {
    try {
        await navigator.clipboard.writeText(el.output.value);
        setStatus('JSON copied.');
    } catch {
        setStatus('Copy failed. Please copy from the textbox manually.', true);
    }
}


function importOutputJson() {
    try {
        const parsed = JSON.parse(el.output.value || '{}');
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid JSON');
        }
        state.overrides = parsed;
        writeOverrides(state.overrides);
        refreshOutput();
        setSelectionFitToEffective();
        updateSelectionHint();
        setStatus('JSON imported and saved.');
    } catch {
        setStatus('Invalid JSON format. Import failed.', true);
    }
}

async function refreshSelectedPart() {
    state.skinId = el.skinSelect.value || DEFAULT_SKIN_ID;
    state.partKey = el.partSelect.value;
    const skin = resolveSkinConfig(state.skinId);
    if (isShapeLockedSkin(skin) && state.overrides[state.skinId]) {
        delete state.overrides[state.skinId];
        writeOverrides(state.overrides);
        refreshOutput();
    }
    applyFitLockState(skin);
    updateSelectionHint();
    try {
        await loadPartImages();
        setSelectionFitToEffective();
        drawPreview();
    } catch (error) {
        setStatus(error?.message || 'Failed to load images.', true);
    }
}


function initSelections() {
    if (el.skinSelect.options.length === 0) {
        const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
        for (const skin of catalog) {
            if (!skin?.id) {
                continue;
            }
            const option = document.createElement('option');
            option.value = skin.id;
            option.textContent = `${skin.name?.['zh-CN'] || skin.id} (${skin.id})`;
            el.skinSelect.appendChild(option);
        }
    }

    if (el.partSelect.options.length === 0) {
        for (const part of PARTS) {
            const option = document.createElement('option');
            option.value = part.key;
            option.textContent = part.label;
            el.partSelect.appendChild(option);
        }
    }

    const availableSkinIds = Array.from(el.skinSelect.options)
        .map((option) => `${option.value || ''}`.trim())
        .filter(Boolean);
    const progress = readGameProgress();
    const preferredSkinId = `${progress?.selectedSkinId || ''}`.trim();
    const currentSkinId = `${el.skinSelect.value || ''}`.trim();

    if (availableSkinIds.includes(currentSkinId)) {
        state.skinId = currentSkinId;
    } else if (preferredSkinId && availableSkinIds.includes(preferredSkinId)) {
        state.skinId = preferredSkinId;
    } else if (availableSkinIds.length > 0) {
        state.skinId = availableSkinIds[0];
    } else {
        state.skinId = DEFAULT_SKIN_ID;
    }

    if (`${el.skinSelect.value || ''}`.trim() !== state.skinId) {
        el.skinSelect.value = state.skinId;
        el.skinSelect.dispatchEvent(new Event('change'));
    }
    el.partSelect.value = state.partKey;
    updateSelectionHint();
}

function ensureSkinOptionExists(skinId) {
    const id = `${skinId || ''}`.trim();
    if (!id) return;
    const exists = Array.from(el.skinSelect.options).some((option) => `${option.value || ''}`.trim() === id);
    if (exists) return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${getSkinLabel(id)}`;
    el.skinSelect.appendChild(option);
}

function openModal() {
    if (!el.modal) return;
    el.modal.hidden = false;
}

function closeModal() {
    if (!el.modal) return;
    el.modal.hidden = true;
}

function openFitModalBySelection(skinId, partKey) {
    ensureSkinOptionExists(skinId);
    if (skinId) {
        el.skinSelect.value = skinId;
    }
    if (partKey && Array.from(el.partSelect.options).some((option) => option.value === partKey)) {
        el.partSelect.value = partKey;
    }
    openModal();
    void refreshSelectedPart();
}


function bindEvents() {
    syncInputPair(el.scaleRange, el.scaleNumber);
    syncInputPair(el.offsetXRange, el.offsetXNumber);
    syncInputPair(el.offsetYRange, el.offsetYNumber);

    const pushMaskAlpha = (value) => {
        const numeric = clamp(Number(value), 0, 100);
        if (!Number.isFinite(numeric)) return;
        state.maskAlpha = numeric;
        el.maskAlphaRange.value = numeric.toFixed(0);
        el.maskAlphaNumber.value = numeric.toFixed(0);
        writeMaskAlpha(numeric);
        drawPreview();
    };
    el.maskAlphaRange.addEventListener('input', () => pushMaskAlpha(el.maskAlphaRange.value));
    el.maskAlphaNumber.addEventListener('input', () => pushMaskAlpha(el.maskAlphaNumber.value));

    el.skinSelect.addEventListener('change', refreshSelectedPart);
    el.partSelect.addEventListener('change', refreshSelectedPart);
    el.btnLoadConfig.addEventListener('click', () => {
        setSelectionFitToConfig();
        setStatus('Loaded default config values.');
    });
    el.btnLoadEffective.addEventListener('click', () => {
        setSelectionFitToEffective();
        setStatus('Loaded effective values.');
    });
    el.btnSavePart.addEventListener('click', saveCurrentPartOverride);
    el.btnResetPart.addEventListener('click', resetCurrentPartOverride);
    el.btnResetSkin.addEventListener('click', resetCurrentSkinOverride);
    el.btnImportJson.addEventListener('click', importOutputJson);
    el.btnCopyJson.addEventListener('click', copyOutputJson);
    el.modalClose?.addEventListener('click', closeModal);
    el.modal?.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.hasAttribute('data-fit-modal-close')) {
            closeModal();
        }
    });

    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY) {
            state.overrides = readOverrides();
            refreshOutput();
            setSelectionFitToEffective();
            updateSelectionHint();
            setStatus('Override data changed and refreshed.');
            return;
        }
        if (event.key === GAME_PROGRESS_KEY) {
            updateSelectionHint();
        }
    });

    window.addEventListener('admin-skin-open-fit', (event) => {
        const detail = event?.detail || {};
        const skinId = `${detail?.skinId || state.skinId || ''}`.trim() || DEFAULT_SKIN_ID;
        const partKey = `${detail?.partKey || state.partKey || ''}`.trim() || PARTS[0].key;
        openFitModalBySelection(skinId, partKey);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && el.modal && !el.modal.hidden) {
            closeModal();
        }
    });
}

async function init() {
    await initSkinPartFitStorage();
    state.overrides = readOverrides();
    state.maskAlpha = readMaskAlpha();
    initSelections();
    bindEvents();
    el.maskAlphaRange.value = state.maskAlpha.toFixed(0);
    el.maskAlphaNumber.value = state.maskAlpha.toFixed(0);
    refreshOutput();
    await refreshSelectedPart();
    setStatus('Ready: adjust values, save override, then refresh game to see changes.');
}



if (hasAllElements) {
    init().catch((error) => {
        setStatus(error?.message || '\u521d\u59cb\u5316\u5931\u8d25', true);
    });
} else {
    console.warn('[admin-skin-fit] missing required elements, skipped init.');
}













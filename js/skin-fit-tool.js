import { getSkinById, getSkinCatalog } from './skins.js?v=6';

const STORAGE_KEY = 'arrowClear_skinPartFitOverrides';
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
    skinSelect: document.getElementById('skinSelect'),
    partSelect: document.getElementById('partSelect'),
    scaleRange: document.getElementById('scaleRange'),
    scaleNumber: document.getElementById('scaleNumber'),
    offsetXRange: document.getElementById('offsetXRange'),
    offsetXNumber: document.getElementById('offsetXNumber'),
    offsetYRange: document.getElementById('offsetYRange'),
    offsetYNumber: document.getElementById('offsetYNumber'),
    maskAlphaRange: document.getElementById('maskAlphaRange'),
    maskAlphaNumber: document.getElementById('maskAlphaNumber'),
    btnLoadConfig: document.getElementById('btnLoadConfig'),
    btnLoadEffective: document.getElementById('btnLoadEffective'),
    btnSavePart: document.getElementById('btnSavePart'),
    btnResetPart: document.getElementById('btnResetPart'),
    btnResetSkin: document.getElementById('btnResetSkin'),
    btnImportJson: document.getElementById('btnImportJson'),
    btnCopyJson: document.getElementById('btnCopyJson'),
    output: document.getElementById('overrideOutput'),
    status: document.getElementById('statusText'),
    canvas: document.getElementById('previewCanvas')
};
const ctx = el.canvas.getContext('2d');

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
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeOverrides(overrides) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
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

function setStatus(text, isError = false) {
    el.status.textContent = text || '';
    el.status.style.color = isError ? '#ff96ad' : '#9df2c0';
}

function getPartMeta(partKey) {
    return PARTS.find((part) => part.key === partKey) || PARTS[0];
}

function getConfiguredPartFit(skin, partKey) {
    return normalizeFit(skin?.renderProfile?.partFit?.[partKey], DEFAULT_FIT);
}

function getOverridePartFit(skinId, partKey) {
    return normalizeFit(state.overrides?.[skinId]?.[partKey], DEFAULT_FIT);
}

function getEffectivePartFit(skin, partKey) {
    const configured = getConfiguredPartFit(skin, partKey);
    const overrideRaw = state.overrides?.[skin.id]?.[partKey];
    return overrideRaw ? normalizeFit(overrideRaw, configured) : configured;
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
    if (imageCache.has(path)) {
        return imageCache.get(path);
    }
    const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load image: ${path}`));
        image.src = path;
    });
    imageCache.set(path, promise);
    return promise;
}

async function loadPartImages() {
    const skin = getSkinById(state.skinId);
    const maskSkin = getSkinById(DEFAULT_SKIN_ID);
    const part = getPartMeta(state.partKey);
    const skinPath = skin?.assets?.[part.assetKey];
    const maskPath = maskSkin?.assets?.[part.assetKey];
    if (!skinPath || !maskPath) {
        throw new Error(`Missing asset path for part: ${part.key}`);
    }

    const [skinImage, maskImage] = await Promise.all([loadImage(skinPath), loadImage(maskPath)]);
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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(skinImage, drawX, drawY, drawWidth, drawHeight);

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
    const skin = getSkinById(state.skinId);
    const fit = getConfiguredPartFit(skin, state.partKey);
    setFitInputs(fit);
    drawPreview();
}

function setSelectionFitToEffective() {
    const skin = getSkinById(state.skinId);
    const fit = getEffectivePartFit(skin, state.partKey);
    setFitInputs(fit);
    drawPreview();
}

function saveCurrentPartOverride() {
    const fit = getFitFromInputs();
    const skinOverrides = state.overrides[state.skinId] || {};
    skinOverrides[state.partKey] = fit;
    state.overrides[state.skinId] = skinOverrides;
    writeOverrides(state.overrides);
    refreshOutput();
    setStatus(`已保存 ${state.skinId} / ${state.partKey}`);
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
    setStatus(`已重置 ${state.skinId} / ${state.partKey}`);
}

function resetCurrentSkinOverride() {
    delete state.overrides[state.skinId];
    writeOverrides(state.overrides);
    refreshOutput();
    setSelectionFitToEffective();
    setStatus(`已清空 ${state.skinId} 覆盖`);
}

async function copyOutputJson() {
    try {
        await navigator.clipboard.writeText(el.output.value);
        setStatus('JSON 已复制');
    } catch {
        setStatus('复制失败，请手动复制文本框内容', true);
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
        setStatus('已导入并保存 JSON');
    } catch {
        setStatus('JSON 格式错误，导入失败', true);
    }
}

async function refreshSelectedPart() {
    state.skinId = el.skinSelect.value;
    state.partKey = el.partSelect.value;
    try {
        await loadPartImages();
        setSelectionFitToEffective();
        drawPreview();
    } catch (error) {
        setStatus(error?.message || '图片加载失败', true);
    }
}

function initSelections() {
    const skins = getSkinCatalog().filter((skin) => skin?.id && skin.id !== DEFAULT_SKIN_ID);
    for (const skin of skins) {
        const option = document.createElement('option');
        option.value = skin.id;
        option.textContent = `${skin.name?.['zh-CN'] || skin.id} (${skin.id})`;
        el.skinSelect.appendChild(option);
    }

    for (const part of PARTS) {
        const option = document.createElement('option');
        option.value = part.key;
        option.textContent = part.label;
        el.partSelect.appendChild(option);
    }

    if (!skins.some((skin) => skin.id === state.skinId) && skins.length > 0) {
        state.skinId = skins[0].id;
    }
    el.skinSelect.value = state.skinId;
    el.partSelect.value = state.partKey;
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
        setStatus('已加载配置默认参数');
    });
    el.btnLoadEffective.addEventListener('click', () => {
        setSelectionFitToEffective();
        setStatus('已加载当前生效参数');
    });
    el.btnSavePart.addEventListener('click', saveCurrentPartOverride);
    el.btnResetPart.addEventListener('click', resetCurrentPartOverride);
    el.btnResetSkin.addEventListener('click', resetCurrentSkinOverride);
    el.btnImportJson.addEventListener('click', importOutputJson);
    el.btnCopyJson.addEventListener('click', copyOutputJson);

    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return;
        state.overrides = readOverrides();
        refreshOutput();
        setSelectionFitToEffective();
        setStatus('检测到覆盖参数变更，已刷新');
    });
}

async function init() {
    state.overrides = readOverrides();
    state.maskAlpha = readMaskAlpha();
    initSelections();
    bindEvents();
    el.maskAlphaRange.value = state.maskAlpha.toFixed(0);
    el.maskAlphaNumber.value = state.maskAlpha.toFixed(0);
    refreshOutput();
    await refreshSelectedPart();
    setStatus('就绪：调完点击“保存当前部件”，回游戏刷新即可生效');
}

init().catch((error) => {
    setStatus(error?.message || '初始化失败', true);
});

/**
 * Main - game entry
 */
import { Game } from './game.js?v=137';
import { UI } from './ui.js?v=96';
import {
    disposePreloadWorker,
    preloadCurrentPlayableLevels,
    startNextUnlockPreload,
    stopNextUnlockPreload
} from './level-preload.js?v=9';
import { initLevelStorage } from './level-storage.js?v=55';
import { initUiTheme } from './ui-theme.js?v=2';
import { initProgressStorage } from './progress-storage.js?v=1';
import { initSkinPartFitStorage } from './skin-fit-storage.js?v=1';
import { initSfxStorage } from './sfx-storage.js?v=6';
import { initLiveOpsStorage } from './liveops-storage.js?v=2';
import { isLegacyColorVariantSkinId } from './skins.js?v=23';
import { earlyBgmBootstrap } from './audio.js?v=47';

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 932;
const BOOT_LOG_TAG = '[boot]';
const LOCAL_SKIN_CATALOG_STORAGE_KEY = 'arrowClear_localSkinCatalog_v1';
const SKIN_VISIBLE_IDS_STORAGE_KEY = 'arrowClear_skinVisibleSkinIds_v1';
const UI_EDITOR_PREVIEW_PARAMS = (() => {
    if (typeof window === 'undefined') {
        return { enabled: false, panel: 'checkin' };
    }
    const params = new URLSearchParams(window.location.search);
    return {
        enabled: params.get('uiEditorPreview') === '1',
        panel: params.get('uiEditorPanel') || 'checkin'
    };
})();

let gameRef = null;
let uiRef = null;
let resizePollTimer = null;
let lastViewportWidth = -1;
let lastViewportHeight = -1;
let lastViewportDpr = -1;
let bootPreloadOverlayEl = null;
let bootPreloadFillEl = null;
let bootPreloadTextEl = null;
let bootPreloadTipEl = null;
let forcedZeroCanvasResizeLogged = false;
let skinCatalogSyncPromise = null;

function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

function logBoot(step, details = null) {
    if (details !== null && details !== undefined) {
        const detailText = formatLogDetails(details);
        console.info(`${BOOT_LOG_TAG} ${step} ${detailText}`);
        return;
    }
    console.info(`${BOOT_LOG_TAG} ${step}`);
}

function formatLogDetails(value) {
    try {
        if (typeof value === 'string') {
            return value;
        }
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function sanitizeLocalSkinId(rawId) {
    return `${rawId || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeText(raw, fallback = '') {
    const text = `${raw || ''}`.replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function normalizeSavedSkinRows(rawRows) {
    const rows = Array.isArray(rawRows) ? rawRows : [];
    const candidateBaseIdSet = new Set(rows.map((row) => sanitizeLocalSkinId(row?.id)).filter(Boolean));
    candidateBaseIdSet.add('classic-burrow');
    const seen = new Set();
    const out = [];

    for (const row of rows) {
        const id = sanitizeLocalSkinId(row?.id);
        if (!id || id === 'classic-burrow' || seen.has(id) || row?.complete !== true) {
            continue;
        }
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        const fallbackPreview = `/assets/skins/${id}/snake_head.png`;
        out.push({
            id,
            nameZh: normalizeText(row?.nameZh, id),
            nameEn: id,
            descriptionZh: 'AI generated skin.',
            descriptionEn: 'AI generated skin.',
            preview: normalizeText(row?.preview, fallbackPreview),
            coinCost: 0
        });
        seen.add(id);
    }
    return out;
}

function normalizeVisibleSkinIds(rawRows) {
    const rows = Array.isArray(rawRows) ? rawRows : [];
    const candidateBaseIdSet = new Set(rows.map((row) => sanitizeLocalSkinId(row?.id)).filter(Boolean));
    candidateBaseIdSet.add('classic-burrow');
    const visible = new Set(['classic-burrow']);
    for (const row of rows) {
        const id = sanitizeLocalSkinId(row?.id);
        if (!id || row?.complete !== true) {
            continue;
        }
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        visible.add(id);
    }
    return Array.from(visible.values());
}

function readLocalSkinCatalogRows() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return [];
    }
    try {
        const raw = localStorage.getItem(LOCAL_SKIN_CATALOG_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeLocalSkinCatalogRows(rows) {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    localStorage.setItem(LOCAL_SKIN_CATALOG_STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : [], null, 2));
}

function mergeLocalSkinCatalogRows(existingRows, incomingRows) {
    const existing = Array.isArray(existingRows) ? existingRows : [];
    const incoming = Array.isArray(incomingRows) ? incomingRows : [];
    const existingById = new Map();
    for (const row of existing) {
        const id = sanitizeLocalSkinId(row?.id);
        if (!id || id === 'classic-burrow') {
            continue;
        }
        existingById.set(id, {
            id,
            nameZh: normalizeText(row?.nameZh, id),
            nameEn: normalizeText(row?.nameEn, id),
            descriptionZh: normalizeText(row?.descriptionZh, 'AI generated skin.'),
            descriptionEn: normalizeText(row?.descriptionEn, 'AI generated skin.'),
            preview: normalizeText(row?.preview, `/assets/skins/${id}/snake_head.png`),
            coinCost: Math.max(0, Math.floor(Number(row?.coinCost) || 0))
        });
    }

    const merged = [];
    for (const row of incoming) {
        const id = sanitizeLocalSkinId(row?.id);
        if (!id) {
            continue;
        }
        const prev = existingById.get(id);
        merged.push({
            id,
            nameZh: normalizeText(prev?.nameZh, normalizeText(row?.nameZh, id)),
            nameEn: normalizeText(prev?.nameEn, normalizeText(row?.nameEn, id)),
            descriptionZh: normalizeText(prev?.descriptionZh, normalizeText(row?.descriptionZh, 'AI generated skin.')),
            descriptionEn: normalizeText(prev?.descriptionEn, normalizeText(row?.descriptionEn, 'AI generated skin.')),
            preview: normalizeText(row?.preview, normalizeText(prev?.preview, `/assets/skins/${id}/snake_head.png`)),
            coinCost: Math.max(0, Math.floor(Number(prev?.coinCost) || Number(row?.coinCost) || 0))
        });
    }

    merged.sort((a, b) => a.id.localeCompare(b.id));
    return merged;
}

async function syncLocalSkinCatalogFromServer() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return { ok: false, reason: 'no_local_storage' };
    }
    if (skinCatalogSyncPromise) {
        return skinCatalogSyncPromise;
    }

    skinCatalogSyncPromise = (async () => {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = setTimeout(() => {
            if (controller) {
                controller.abort();
            }
        }, 1500);

        try {
            const response = await fetch('/api/skin-gen/saved-skins', {
                method: 'GET',
                cache: 'no-store',
                signal: controller ? controller.signal : undefined
            });
            if (!response.ok) {
                return { ok: false, reason: `http_${response.status}` };
            }

            const payload = await response.json().catch(() => ({}));
            const visibleIds = normalizeVisibleSkinIds(payload?.skins);
            localStorage.setItem(SKIN_VISIBLE_IDS_STORAGE_KEY, JSON.stringify(visibleIds, null, 2));

            const incoming = normalizeSavedSkinRows(payload?.skins);
            const merged = mergeLocalSkinCatalogRows(readLocalSkinCatalogRows(), incoming);
            writeLocalSkinCatalogRows(merged);
            logBoot('skin catalog synced', { skinCount: merged.length, visibleCount: visibleIds.length });
            return { ok: true, skinCount: merged.length, visibleCount: visibleIds.length };
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.warn('[main] sync local skin catalog failed', error);
            }
            return { ok: false, reason: error?.name || 'sync_failed' };
        } finally {
            clearTimeout(timeoutId);
            skinCatalogSyncPromise = null;
        }
    })();

    return skinCatalogSyncPromise;
}

if (typeof window !== 'undefined') {
    window.__arrowSyncSkinCatalogFromServer = syncLocalSkinCatalogFromServer;
}

function readViewportSize() {
    const visual = window.visualViewport;
    const docEl = document.documentElement;
    const innerWidth = Math.round(window.innerWidth || 0);
    const innerHeight = Math.round(window.innerHeight || 0);
    const clientWidth = Math.round(docEl?.clientWidth || 0);
    const clientHeight = Math.round(docEl?.clientHeight || 0);
    const visualWidth = Math.round(visual?.width || 0);
    const visualHeight = Math.round(visual?.height || 0);
    const dpr = Number(window.devicePixelRatio || 1);

    const widthCandidates = [innerWidth, clientWidth, visualWidth].filter((value) => value > 0);
    const heightCandidates = [innerHeight, clientHeight, visualHeight].filter((value) => value > 0);
    const width = widthCandidates.length > 0 ? Math.min(...widthCandidates) : DESIGN_WIDTH;
    const height = heightCandidates.length > 0 ? Math.min(...heightCandidates) : DESIGN_HEIGHT;
    return { width, height, dpr };
}

function applyAdaptiveLayout(force = false) {
    const { width, height, dpr } = readViewportSize();
    if (!force && width === lastViewportWidth && height === lastViewportHeight && dpr === lastViewportDpr) {
        if (gameRef?.canvas && (gameRef.canvas.width <= 1 || gameRef.canvas.height <= 1)) {
            gameRef.resize();
            if (!forcedZeroCanvasResizeLogged) {
                forcedZeroCanvasResizeLogged = true;
                logBoot('force resize for zero canvas', {
                    canvasWidth: gameRef.canvas.width,
                    canvasHeight: gameRef.canvas.height
                });
            }
        }
        return;
    }

    lastViewportWidth = width;
    lastViewportHeight = height;
    lastViewportDpr = dpr;

    const scale = Math.max(0.01, Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT));
    document.documentElement.style.setProperty('--safe-vw', `${width}px`);
    document.documentElement.style.setProperty('--safe-vh', `${height}px`);
    document.documentElement.style.setProperty('--app-scale', `${scale.toFixed(6)}`);

    if (gameRef && typeof gameRef.resize === 'function') {
        gameRef.resize();
    }
}

function initBootPreloadDom() {
    if (bootPreloadOverlayEl) {
        return;
    }
    bootPreloadOverlayEl = document.getElementById('bootPreloadOverlay');
    bootPreloadFillEl = document.getElementById('bootPreloadFill');
    bootPreloadTextEl = document.getElementById('bootPreloadText');
    bootPreloadTipEl = document.getElementById('bootPreloadTip');
}

function showBootPreloadOverlay() {
    initBootPreloadDom();
    bootPreloadOverlayEl?.classList.remove('hidden');
}

function hideBootPreloadOverlay() {
    bootPreloadOverlayEl?.classList.add('hidden');
}

function updateBootPreloadProgress(percent, tip) {
    initBootPreloadDom();
    const normalized = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    if (bootPreloadFillEl) {
        bootPreloadFillEl.style.width = `${normalized}%`;
    }
    if (bootPreloadTextEl) {
        bootPreloadTextEl.textContent = `${normalized}%`;
    }
    if (bootPreloadTipEl && typeof tip === 'string' && tip.length > 0) {
        bootPreloadTipEl.textContent = tip;
    }
}

if (!window.__ARROW_GAME_BOOTSTRAPPED__) {
    window.__ARROW_GAME_BOOTSTRAPPED__ = true;

    window.addEventListener('DOMContentLoaded', async () => {
        const bootStartedAt = nowMs();
        logBoot('DOMContentLoaded');

        if (!UI_EDITOR_PREVIEW_PARAMS.enabled) {
            earlyBgmBootstrap();
        }

        applyAdaptiveLayout(true);
        initBootPreloadDom();
        showBootPreloadOverlay();
        updateBootPreloadProgress(2, 'Loading level cache...');

        const triggerResize = () => applyAdaptiveLayout(true);
        window.addEventListener('resize', triggerResize);
        window.addEventListener('orientationchange', triggerResize);
        window.addEventListener('visibilitychange', triggerResize);
        window.addEventListener('focus', triggerResize);
        window.visualViewport?.addEventListener('resize', triggerResize);
        window.visualViewport?.addEventListener('scroll', triggerResize);

        const canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            console.error('Missing #gameCanvas element');
            hideBootPreloadOverlay();
            return;
        }

        try {
            const storageStartedAt = nowMs();
            await Promise.all([
                initLevelStorage().catch((error) => {
                    console.warn('[main] level storage init failed', error);
                }),
                initProgressStorage().catch((error) => {
                    console.warn('[main] progress storage init failed', error);
                }),
                initSkinPartFitStorage().catch((error) => {
                    console.warn('[main] skin part fit storage init failed', error);
                }),
                initSfxStorage().catch((error) => {
                    console.warn('[main] sfx storage init failed', error);
                }),
                initLiveOpsStorage().catch((error) => {
                    console.warn('[main] liveops storage init failed', error);
                })
            ]);
            await syncLocalSkinCatalogFromServer();
            logBoot('storages initialized', { durationMs: Math.round(nowMs() - storageStartedAt) });
            updateBootPreloadProgress(26, 'Initializing game...');

            const themeInitTask = initUiTheme('design-v5')
                .then(() => logBoot('ui theme initialized'))
                .catch((error) => {
                    console.warn('[main] ui theme init failed', error);
                });

            gameRef = new Game(canvas);
            const preloadTargetLevel = Math.max(1, gameRef.maxUnlockedLevel || gameRef.currentLevel || 1);
            logBoot('preload current level start', { level: preloadTargetLevel });

            const preloadStartedAt = nowMs();
            await preloadCurrentPlayableLevels(preloadTargetLevel, {
                onProgress: ({ done, total, level, source }) => {
                    const ratio = total > 0 ? done / total : 1;
                    const percent = 26 + ratio * 64;
                    const sourceTip = source === 'cache' ? 'cache' : (source === 'generated' ? 'generated' : 'loading');
                    const levelTip = level > 0
                        ? `Preloading level ${level} (${sourceTip})`
                        : 'Preloading current level';
                    updateBootPreloadProgress(percent, levelTip);
                }
            });
            logBoot('preload current level done', {
                level: preloadTargetLevel,
                durationMs: Math.round(nowMs() - preloadStartedAt)
            });

            uiRef = new UI(gameRef, {
                uiEditorPreview: UI_EDITOR_PREVIEW_PARAMS
            });
            gameRef.start();
            applyAdaptiveLayout(true);
            updateBootPreloadProgress(100, 'Ready');

            if (UI_EDITOR_PREVIEW_PARAMS.enabled && typeof window !== 'undefined') {
                window.__arrowUiEditorPreview = {
                    render(override = {}) {
                        uiRef?.setUiEditorPreviewState?.(override);
                    },
                    getMeta() {
                        return uiRef?.getUiEditorPreviewMeta?.() || { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
                    },
                    getElementRect(elementId) {
                        return uiRef?.getUiEditorElementRect?.(elementId) || null;
                    }
                };
            }

            startNextUnlockPreload(
                () => gameRef?.maxUnlockedLevel || 1,
                {
                    canPreload: () => !!gameRef,
                    onStatus: (payload) => {
                        logBoot('background preload status', payload || {});
                    }
                }
            );

            themeInitTask.then(() => {
                if (!uiRef) return;
                uiRef.applyThemeAssets();
                uiRef.renderFeatureCards();
            });
        } finally {
            setTimeout(() => {
                hideBootPreloadOverlay();
                logBoot('boot complete', { durationMs: Math.round(nowMs() - bootStartedAt) });
            }, 120);
        }

        resizePollTimer = setInterval(() => applyAdaptiveLayout(false), 300);
    });

    window.addEventListener('beforeunload', () => {
        stopNextUnlockPreload();
        disposePreloadWorker();
        if (resizePollTimer) {
            clearInterval(resizePollTimer);
        }
    });
}








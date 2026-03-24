/**
 * Main - game entry
 */
import { Game } from './game.js?v=71';
import { UI } from './ui.js?v=49';
import {
    disposePreloadWorker,
    preloadCurrentPlayableLevels,
    startNextUnlockPreload,
    stopNextUnlockPreload
} from './level-preload.js?v=9';
import { initLevelStorage } from './level-storage.js?v=55';
import { initUiTheme } from './ui-theme.js?v=2';

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 932;
const BOOT_LOG_TAG = '[boot]';

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
            await initLevelStorage().catch((error) => {
                console.warn('[main] level storage init failed', error);
            });
            logBoot('level storage initialized', { durationMs: Math.round(nowMs() - storageStartedAt) });
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

            uiRef = new UI(gameRef);
            gameRef.start();
            applyAdaptiveLayout(true);
            updateBootPreloadProgress(100, 'Ready');

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




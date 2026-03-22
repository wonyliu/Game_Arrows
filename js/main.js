/**
 * Main - game entry
 */
import { Game } from './game.js?v=53';
import { UI } from './ui.js?v=38';
import {
    disposePreloadWorker,
    preloadCurrentPlayableLevels,
    startNextUnlockPreload,
    stopNextUnlockPreload
} from './level-preload.js?v=4';
import { initLevelStorage } from './level-storage.js?v=44';
import { initUiTheme } from './ui-theme.js?v=2';

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 932;

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
        applyAdaptiveLayout(true);
        initBootPreloadDom();
        showBootPreloadOverlay();
        updateBootPreloadProgress(2, '加载关卡存档...');

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
            // Step 1: read remote/local storage maps first.
            await initLevelStorage().catch((error) => {
                console.warn('[main] level storage init failed', error);
            });
            updateBootPreloadProgress(26, '初始化游戏...');

            // Theme can initialize in parallel while booting gameplay.
            const themeInitTask = initUiTheme('design-v5').catch((error) => {
                console.warn('[main] ui theme init failed', error);
            });

            gameRef = new Game(canvas);
            const preloadTargetLevel = Math.max(1, gameRef.maxUnlockedLevel || gameRef.currentLevel || 1);

            // Step 2: preload the current playable (unpassed) level before menu.
            await preloadCurrentPlayableLevels(preloadTargetLevel, {
                onProgress: ({ done, total, level, source }) => {
                    const ratio = total > 0 ? done / total : 1;
                    const percent = 26 + ratio * 64;
                    const sourceTip = source === 'cache' ? '本地缓存' : (source === 'generated' ? '已生成' : '加载中');
                    const levelTip = level > 0 ? `预加载第 ${level} 关（${sourceTip}）` : '预加载当前关卡';
                    updateBootPreloadProgress(percent, levelTip);
                }
            });

            uiRef = new UI(gameRef);
            gameRef.start();
            applyAdaptiveLayout(true);
            updateBootPreloadProgress(100, '准备完成');

            // Step 3: in background, always keep exactly current + next available.
            startNextUnlockPreload(
                () => gameRef?.maxUnlockedLevel || 1,
                { canPreload: () => !!gameRef }
            );

            // Re-apply assets after theme manifest is ready.
            themeInitTask.then(() => {
                if (!uiRef) return;
                uiRef.applyThemeAssets();
                uiRef.renderFeatureCards();
            });
        } finally {
            setTimeout(() => {
                hideBootPreloadOverlay();
            }, 120);
        }

        // Fallback for browsers that delay resize/orientation events.
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

/**
 * Main - game entry
 */
import { Game } from './game.js?v=52';
import { UI } from './ui.js?v=35';
import { initLevelStorage } from './level-storage.js?v=41';
import { initUiTheme } from './ui-theme.js?v=1';

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 932;

let gameRef = null;
let resizePollTimer = null;
let lastViewportWidth = -1;
let lastViewportHeight = -1;
let lastViewportDpr = -1;

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

if (!window.__ARROW_GAME_BOOTSTRAPPED__) {
    window.__ARROW_GAME_BOOTSTRAPPED__ = true;

    window.addEventListener('DOMContentLoaded', async () => {
        applyAdaptiveLayout(true);

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
            return;
        }

        await initLevelStorage();
        await initUiTheme('design-v5');

        gameRef = new Game(canvas);
        new UI(gameRef);
        gameRef.start();
        applyAdaptiveLayout(true);

        // Fallback for browsers that delay resize/orientation events.
        resizePollTimer = setInterval(() => applyAdaptiveLayout(false), 300);
    });

    window.addEventListener('beforeunload', () => {
        if (resizePollTimer) {
            clearInterval(resizePollTimer);
        }
    });
}

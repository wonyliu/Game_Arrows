import { buildPlayableLevelRecord } from './level-builder.js?v=46';
import { getBaseLevelConfig } from './levels.js?v=27';
import { buildStoredSettings, getSavedLevelRecord, saveSavedLevelRecord } from './level-storage.js?v=43';

const PRELOAD_MODE = 1;
const MAX_PRELOAD_LEVEL = 60;
const NEXT_LEVEL_INTERVAL_MS = 3000;

let preloadQueue = Promise.resolve();
const pendingLevels = new Set();
let nextLevelTimer = null;

export async function preloadPlayableLevels(maxUnlockedLevel) {
    const maxLevel = normalizeLevel(maxUnlockedLevel);
    if (maxLevel < 1) return;

    for (let level = 1; level <= maxLevel; level++) {
        await enqueueEnsureLevel(level);
    }
}

export function startNextUnlockPreload(getUnlockedLevel) {
    stopNextUnlockPreload();

    const tick = () => {
        const unlockedLevel = normalizeLevel(getUnlockedLevel?.());
        const nextLevel = normalizeLevel(unlockedLevel + 1);
        if (nextLevel >= 1) {
            enqueueEnsureLevel(nextLevel);
        }
    };

    tick();
    nextLevelTimer = setInterval(tick, NEXT_LEVEL_INTERVAL_MS);
}

export function stopNextUnlockPreload() {
    if (!nextLevelTimer) return;
    clearInterval(nextLevelTimer);
    nextLevelTimer = null;
}

function enqueueEnsureLevel(level) {
    preloadQueue = preloadQueue
        .then(() => ensureLevelCached(level))
        .then(yieldToUi)
        .catch((error) => {
            console.warn('[level-preload] enqueue failed', error);
        });

    return preloadQueue;
}

async function ensureLevelCached(level) {
    const targetLevel = normalizeLevel(level);
    if (targetLevel < 1) return false;
    if (getSavedLevelRecord(targetLevel)) return false;
    if (pendingLevels.has(targetLevel)) return false;

    pendingLevels.add(targetLevel);
    try {
        const baseConfig = getBaseLevelConfig(targetLevel);
        const settings = buildStoredSettings(baseConfig, {
            dimensionMode: 'rows',
            dimensionValue: baseConfig.gridRows,
            minLen: baseConfig.minLen,
            maxLen: baseConfig.maxLen
        });
        const record = buildPlayableLevelRecord(baseConfig, settings, PRELOAD_MODE);
        await Promise.resolve(saveSavedLevelRecord(targetLevel, record));
        return true;
    } catch (error) {
        console.warn(`[level-preload] failed to build level ${targetLevel}`, error);
        return false;
    } finally {
        pendingLevels.delete(targetLevel);
    }
}

function normalizeLevel(value) {
    const level = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(MAX_PRELOAD_LEVEL, level));
}

function yieldToUi() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

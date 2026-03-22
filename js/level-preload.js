import { getSavedLevelRecord, saveSavedLevelRecord } from './level-storage.js?v=44';

const PRELOAD_MODE = 1;
const MAX_PRELOAD_LEVEL = 1000;
const NEXT_LEVEL_INTERVAL_MS = 1500;
const NEXT_LEVEL_INITIAL_DELAY_MS = 150;

let preloadQueue = Promise.resolve();
const pendingLevels = new Map();
let nextLevelTimer = null;
let nextLevelInitialTimer = null;
let workerSeq = 0;
let workerRef = null;
let workerTasks = new Map();

export async function preloadCurrentPlayableLevels(maxUnlockedLevel, options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const targetLevel = normalizeLevel(maxUnlockedLevel);

    if (targetLevel < 1) {
        onProgress?.({ done: 1, total: 1, level: 0, source: 'skip' });
        return;
    }

    onProgress?.({ done: 0, total: 1, level: targetLevel, source: 'pending' });
    const source = await enqueueEnsureLevel(targetLevel);
    onProgress?.({ done: 1, total: 1, level: targetLevel, source: source || 'failed' });
}

// Backward-compatible alias used by older main.js versions.
export async function preloadPlayableLevel(maxUnlockedLevel, options = {}) {
    return preloadCurrentPlayableLevels(maxUnlockedLevel, options);
}

export function startNextUnlockPreload(getUnlockedLevel, options = {}) {
    stopNextUnlockPreload();
    const canPreload = typeof options.canPreload === 'function' ? options.canPreload : () => true;
    const onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;

    let running = false;
    let satisfiedUnlockedLevel = -1;

    const tick = async () => {
        if (running || !canPreload()) {
            return;
        }
        running = true;
        try {
            const unlockedLevel = normalizeLevel(getUnlockedLevel?.());
            if (unlockedLevel < 1) {
                return;
            }

            let currentSource = 'cache';
            if (!hasUsableCachedLevel(unlockedLevel)) {
                onStatus?.({ phase: 'current-start', level: unlockedLevel });
                currentSource = await enqueueEnsureLevel(unlockedLevel);
                onStatus?.({
                    phase: currentSource ? 'current-done' : 'current-failed',
                    level: unlockedLevel,
                    source: currentSource || 'failed'
                });
                if (!currentSource) {
                    satisfiedUnlockedLevel = -1;
                    return;
                }
            }

            const nextLevel = normalizeLevel(unlockedLevel + 1);
            if (nextLevel < 1) {
                satisfiedUnlockedLevel = unlockedLevel;
                return;
            }

            if (hasUsableCachedLevel(nextLevel)) {
                satisfiedUnlockedLevel = unlockedLevel;
                onStatus?.({ phase: 'next-ready', level: nextLevel, source: 'cache' });
                return;
            }

            if (satisfiedUnlockedLevel === unlockedLevel) {
                return;
            }

            onStatus?.({ phase: 'next-start', level: nextLevel, source: currentSource });
            const nextSource = await enqueueEnsureLevel(nextLevel);
            if (nextSource) {
                satisfiedUnlockedLevel = unlockedLevel;
                onStatus?.({ phase: 'next-done', level: nextLevel, source: nextSource });
            } else {
                onStatus?.({ phase: 'next-failed', level: nextLevel, source: 'failed' });
            }
        } finally {
            running = false;
        }
    };

    nextLevelTimer = setInterval(() => {
        tick().catch((error) => {
            console.warn('[level-preload] next-level tick failed', error);
        });
    }, NEXT_LEVEL_INTERVAL_MS);

    nextLevelInitialTimer = setTimeout(() => {
        tick().catch((error) => {
            console.warn('[level-preload] next-level first tick failed', error);
        });
    }, NEXT_LEVEL_INITIAL_DELAY_MS);
}

export function stopNextUnlockPreload() {
    if (nextLevelInitialTimer) {
        clearTimeout(nextLevelInitialTimer);
        nextLevelInitialTimer = null;
    }
    if (nextLevelTimer) {
        clearInterval(nextLevelTimer);
        nextLevelTimer = null;
    }
}

export function disposePreloadWorker() {
    stopNextUnlockPreload();
    if (workerRef) {
        workerRef.terminate();
        workerRef = null;
    }
    for (const task of workerTasks.values()) {
        task.reject(new Error('preload worker disposed'));
    }
    workerTasks.clear();
}

function enqueueEnsureLevel(level) {
    preloadQueue = preloadQueue
        .then(() => ensureLevelCached(level))
        .then(yieldToUi)
        .catch((error) => {
            console.warn('[level-preload] enqueue failed', error);
            return null;
        });
    return preloadQueue;
}

function ensureLevelCached(level) {
    const targetLevel = normalizeLevel(level);
    if (targetLevel < 1) {
        return Promise.resolve(null);
    }

    if (hasUsableCachedLevel(targetLevel)) {
        return Promise.resolve('cache');
    }

    if (pendingLevels.has(targetLevel)) {
        return pendingLevels.get(targetLevel);
    }

    const task = requestBuildRecord(targetLevel)
        .then(async (record) => {
            if (!record) {
                return null;
            }
            await Promise.resolve(saveSavedLevelRecord(targetLevel, record));
            return 'generated';
        })
        .catch((error) => {
            console.warn(`[level-preload] failed to build level ${targetLevel}`, error);
            return null;
        })
        .finally(() => {
            pendingLevels.delete(targetLevel);
        });

    pendingLevels.set(targetLevel, task);
    return task;
}

function requestBuildRecord(level) {
    const worker = getWorker();
    if (!worker) {
        return buildRecordOnMainThread(level);
    }

    const id = ++workerSeq;
    return new Promise((resolve, reject) => {
        workerTasks.set(id, { resolve, reject });
        worker.postMessage({ id, level, mode: PRELOAD_MODE });
    });
}

function getWorker() {
    if (workerRef) {
        return workerRef;
    }
    if (typeof Worker === 'undefined') {
        return null;
    }

    try {
        const workerUrl = new URL('./level-preload-worker.js?v=3', import.meta.url);
        workerRef = new Worker(workerUrl, { type: 'module' });
        workerRef.addEventListener('message', onWorkerMessage);
        workerRef.addEventListener('error', onWorkerError);
        return workerRef;
    } catch {
        workerRef = null;
        return null;
    }
}

function onWorkerMessage(event) {
    const payload = event.data || {};
    const id = Number(payload.id || 0);
    if (!id || !workerTasks.has(id)) {
        return;
    }

    const task = workerTasks.get(id);
    workerTasks.delete(id);

    if (payload.ok) {
        task.resolve(payload.record || null);
    } else {
        task.reject(new Error(payload.error || 'worker build failed'));
    }
}

function onWorkerError(error) {
    if (!workerTasks.size) {
        return;
    }
    for (const task of workerTasks.values()) {
        task.reject(error || new Error('preload worker error'));
    }
    workerTasks.clear();
    if (workerRef) {
        workerRef.terminate();
        workerRef = null;
    }
}

async function buildRecordOnMainThread(level) {
    const [{ buildPlayableLevelRecord }, { getBaseLevelConfig }, { buildStoredSettings }] = await Promise.all([
        import('./level-builder.js?v=46'),
        import('./levels.js?v=27'),
        import('./level-storage.js?v=44')
    ]);

    const baseConfig = getBaseLevelConfig(level);
    const settings = buildStoredSettings(baseConfig, {
        dimensionMode: 'rows',
        dimensionValue: baseConfig.gridRows,
        minLen: baseConfig.minLen,
        maxLen: baseConfig.maxLen
    });

    return buildPlayableLevelRecord(baseConfig, settings, PRELOAD_MODE);
}

function normalizeLevel(value) {
    const level = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(MAX_PRELOAD_LEVEL, level));
}

function hasUsableCachedLevel(level) {
    return isCompatibleLevelRecord(getSavedLevelRecord(level));
}

function isCompatibleLevelRecord(record) {
    if (!record || typeof record !== 'object') {
        return false;
    }
    const data = record.data;
    if (!data || typeof data !== 'object') {
        return false;
    }
    if (!Array.isArray(data.lines) || data.lines.length === 0) {
        return false;
    }
    return Number(data.generatorVersion || 0) >= 5;
}

function yieldToUi(source) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(source), 0);
    });
}

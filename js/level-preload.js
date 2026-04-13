import {
    getSavedLevelRecord,
    isStoredLevelRecordUsable,
    saveSavedLevelRecord
} from './level-storage.js?v=56';
import { getNormalLevelCount } from './levels.js?v=32';

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
const LOG_TAG = '[level-preload]';
const ENABLE_PRELOAD_DEBUG_LOGS = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('debug') === '1';

function logPreloadInfo(message) {
    if (!ENABLE_PRELOAD_DEBUG_LOGS) {
        return;
    }
    console.info(message);
}

export async function preloadCurrentPlayableLevels(maxUnlockedLevel, options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const targetLevel = normalizeLevel(maxUnlockedLevel, getNormalLevelCount());

    if (targetLevel < 1) {
        onProgress?.({ done: 1, total: 1, level: 0, source: 'skip' });
        return;
    }

    const startedAt = nowMs();
    logPreloadInfo(`${LOG_TAG} boot preload start ${toLogJson({ level: targetLevel })}`);
    onProgress?.({ done: 0, total: 1, level: targetLevel, source: 'pending' });
    const source = await enqueueEnsureLevel(targetLevel);
    logPreloadInfo(`${LOG_TAG} boot preload done ${toLogJson({
        level: targetLevel,
        source: source || 'failed',
        durationMs: Math.round(nowMs() - startedAt)
    })}`);
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
    const emitStatus = createStatusEmitter(onStatus);

    let running = false;
    let satisfiedUnlockedLevel = -1;

    const tick = async () => {
        if (running || !canPreload()) {
            return;
        }
        running = true;
        try {
            const maxCampaignLevel = Math.max(1, getNormalLevelCount());
            const unlockedLevel = normalizeLevel(getUnlockedLevel?.(), maxCampaignLevel);
            if (unlockedLevel < 1) {
                return;
            }

            let currentSource = 'cache';
            if (!hasUsableCachedLevel(unlockedLevel)) {
                emitStatus({ phase: 'current-start', level: unlockedLevel });
                logPreloadInfo(`${LOG_TAG} ensure current level ${toLogJson({ level: unlockedLevel })}`);
                currentSource = await enqueueEnsureLevel(unlockedLevel);
                emitStatus({
                    phase: currentSource ? 'current-done' : 'current-failed',
                    level: unlockedLevel,
                    source: currentSource || 'failed'
                });
                if (!currentSource) {
                    satisfiedUnlockedLevel = -1;
                    return;
                }
            }

            const nextLevel = normalizeLevel(unlockedLevel + 1, maxCampaignLevel);
            if (nextLevel <= unlockedLevel) {
                satisfiedUnlockedLevel = unlockedLevel;
                return;
            }

            if (hasUsableCachedLevel(nextLevel)) {
                satisfiedUnlockedLevel = unlockedLevel;
                emitStatus({ phase: 'next-ready', level: nextLevel, source: 'cache' });
                return;
            }

            if (satisfiedUnlockedLevel === unlockedLevel) {
                return;
            }

            emitStatus({ phase: 'next-start', level: nextLevel, source: currentSource });
            logPreloadInfo(`${LOG_TAG} preload next level ${toLogJson({ level: nextLevel })}`);
            const nextSource = await enqueueEnsureLevel(nextLevel);
            if (nextSource) {
                satisfiedUnlockedLevel = unlockedLevel;
                emitStatus({ phase: 'next-done', level: nextLevel, source: nextSource });
            } else {
                emitStatus({ phase: 'next-failed', level: nextLevel, source: 'failed' });
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
    const targetLevel = normalizeLevel(level, getNormalLevelCount());
    if (targetLevel < 1) {
        return Promise.resolve(null);
    }

    if (hasUsableCachedLevel(targetLevel)) {
        logPreloadInfo(`${LOG_TAG} cache hit ${toLogJson({ level: targetLevel })}`);
        return Promise.resolve('cache');
    }

    if (pendingLevels.has(targetLevel)) {
        return pendingLevels.get(targetLevel);
    }

    const startedAt = nowMs();
    const task = requestBuildRecord(targetLevel)
        .then(async (record) => {
            if (!record) {
                return null;
            }
            await Promise.resolve(saveSavedLevelRecord(targetLevel, record));
            logPreloadInfo(`${LOG_TAG} generated level ${toLogJson({
                level: targetLevel,
                durationMs: Math.round(nowMs() - startedAt)
            })}`);
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
    // Worker context has no localStorage, so dynamic catalog counts can be stale there.
    // Fall back to main-thread generation when campaign count differs from the legacy default.
    if (getNormalLevelCount() !== 100) {
        return null;
    }
    if (typeof Worker === 'undefined') {
        return null;
    }

    try {
        const workerUrl = new URL('./level-preload-worker.js?v=6', import.meta.url);
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
        import('./level-builder.js?v=48'),
        import('./levels.js?v=32'),
import('./level-storage.js?v=56')
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

function normalizeLevel(value, maxLevel = MAX_PRELOAD_LEVEL) {
    const max = Math.max(0, Math.min(MAX_PRELOAD_LEVEL, Math.floor(Number(maxLevel) || MAX_PRELOAD_LEVEL)));
    const level = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(max, level));
}

function hasUsableCachedLevel(level) {
    return isStoredLevelRecordUsable(getSavedLevelRecord(level));
}

function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

function createStatusEmitter(onStatus) {
    if (typeof onStatus !== 'function') {
        return () => {};
    }
    let lastKey = '';
    return (payload) => {
        const key = toLogJson(payload);
        if (key === lastKey) {
            return;
        }
        lastKey = key;
        onStatus(payload);
    };
}

function toLogJson(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function yieldToUi(source) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(source), 0);
    });
}



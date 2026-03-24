import { buildPlayableLevelRecord } from './level-builder.js?v=48';
import { getBaseLevelConfig } from './levels.js?v=32';
import { buildStoredSettings } from './level-storage.js?v=55';

const DEFAULT_PRELOAD_MODE = 1;

self.addEventListener('message', (event) => {
    const payload = event.data || {};
    const id = Number(payload.id || 0);
    if (!id) {
        return;
    }

    const level = normalizeLevel(payload.level);
    const mode = normalizeMode(payload.mode);

    try {
        if (level < 1) {
            self.postMessage({ id, ok: false, error: 'invalid level' });
            return;
        }

        const baseConfig = getBaseLevelConfig(level);
        const settings = buildStoredSettings(baseConfig, {
            dimensionMode: 'rows',
            dimensionValue: baseConfig.gridRows,
            minLen: baseConfig.minLen,
            maxLen: baseConfig.maxLen
        });
        const record = buildPlayableLevelRecord(baseConfig, settings, mode);
        self.postMessage({ id, ok: true, record });
    } catch (error) {
        self.postMessage({
            id,
            ok: false,
            error: error instanceof Error ? error.message : String(error || 'unknown worker error')
        });
    }
});

function normalizeLevel(value) {
    const level = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(1000, level));
}

function normalizeMode(value) {
    const mode = Math.floor(Number(value) || DEFAULT_PRELOAD_MODE);
    return Number.isFinite(mode) ? mode : DEFAULT_PRELOAD_MODE;
}



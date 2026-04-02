const GAME_PROGRESS_KEY = 'arrowClear_progress';
const GAME_PROGRESS_FILE = 'game-progress-v1';
const STORAGE_API_BASE = '/api/storage';
const PROGRESS_SCHEMA_VERSION = 1;

let progressInitPromise = null;
let serverSyncWarned = false;

export function initProgressStorage() {
    if (progressInitPromise) {
        return progressInitPromise;
    }

    progressInitPromise = hydrateFromServer().catch((error) => {
        console.warn('[progress-storage] init failed, fallback to browser storage only', error);
    });

    return progressInitPromise;
}

export function readProgressSnapshot() {
    return readLocalProgress();
}

export function saveProgressSnapshot(progress) {
    const normalized = normalizeProgress(progress, {
        fallback: readLocalProgress(),
        forceTouchUpdatedAt: true
    });
    writeLocalProgress(normalized);
    return persistProgressToServer(normalized);
}

async function hydrateFromServer() {
    const local = readLocalProgress();
    const remote = await fetchProgressFromServer();
    if (!remote) {
        return;
    }
    const merged = mergeProgress(remote, local);
    writeLocalProgress(merged);
}

async function fetchProgressFromServer() {
    if (!canUseApiStorage()) {
        return null;
    }

    try {
        const response = await fetch(`${STORAGE_API_BASE}/${GAME_PROGRESS_FILE}`, {
            method: 'GET',
            cache: 'no-store'
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return isPlainObject(data) ? data : null;
    } catch {
        return null;
    }
}

async function persistProgressToServer(progress) {
    if (!canUseApiStorage()) {
        return false;
    }

    try {
        const response = await fetch(`${STORAGE_API_BASE}/${GAME_PROGRESS_FILE}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(progress)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return true;
    } catch (error) {
        warnServerUnavailable(error);
        return false;
    }
}

function warnServerUnavailable(error) {
    if (serverSyncWarned) {
        return;
    }
    serverSyncWarned = true;
    console.warn('[progress-storage] server sync unavailable, fallback to browser storage only', error);
}

function readLocalProgress() {
    if (typeof localStorage === 'undefined') {
        return normalizeProgress(null);
    }

    try {
        const parsed = JSON.parse(localStorage.getItem(GAME_PROGRESS_KEY) || 'null');
        return normalizeProgress(parsed);
    } catch {
        return normalizeProgress(null);
    }
}

function writeLocalProgress(progress) {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(GAME_PROGRESS_KEY, JSON.stringify(normalizeProgress(progress, {
            fallback: progress,
            forceTouchUpdatedAt: false
        })));
    } catch (error) {
        console.warn('[progress-storage] failed to write browser storage', error);
    }
}

function normalizeProgress(value, options = {}) {
    const fallback = isPlainObject(options.fallback) ? options.fallback : {};
    const raw = isPlainObject(value) ? value : {};

    const fallbackMaxUnlocked = clampProgressLevel(fallback.maxUnlockedLevel, 1);
    const fallbackCurrent = clampProgressLevel(fallback.currentLevel, 1);
    const fallbackCoins = clampCoins(fallback.coins);
    const fallbackSelectedSkinId = `${fallback.selectedSkinId || ''}`.trim();
    const fallbackUnlockedSkins = sanitizeSkinIdList(fallback.unlockedSkinIds);
    const fallbackVersion = clampProgressLevel(fallback.version, PROGRESS_SCHEMA_VERSION);

    const maxUnlockedLevel = clampProgressLevel(raw.maxUnlockedLevel, fallbackMaxUnlocked);
    const currentLevel = clampProgressLevel(raw.currentLevel, fallbackCurrent);
    const coins = clampCoins(raw.coins ?? fallbackCoins);
    const selectedSkinId = `${raw.selectedSkinId || fallbackSelectedSkinId || ''}`.trim();
    const unlockedSkinIds = sanitizeSkinIdList(raw.unlockedSkinIds).length > 0
        ? sanitizeSkinIdList(raw.unlockedSkinIds)
        : fallbackUnlockedSkins;
    const version = clampProgressLevel(raw.version, fallbackVersion || PROGRESS_SCHEMA_VERSION);
    const updatedAt = resolveUpdatedAt(raw.updatedAt, fallback.updatedAt, !!options.forceTouchUpdatedAt);

    return {
        version,
        updatedAt,
        maxUnlockedLevel,
        currentLevel,
        coins,
        unlockedSkinIds,
        selectedSkinId
    };
}

function mergeProgress(remote, local) {
    const remoteNormalized = normalizeProgress(remote);
    const localNormalized = normalizeProgress(local);
    const remoteScore = computeProgressScore(remoteNormalized);
    const localScore = computeProgressScore(localNormalized);

    const remoteUpdatedAtMs = parseUpdatedAtMs(remoteNormalized.updatedAt);
    const localUpdatedAtMs = parseUpdatedAtMs(localNormalized.updatedAt);

    if (remoteUpdatedAtMs > 0 && localUpdatedAtMs > 0) {
        if (remoteUpdatedAtMs > localUpdatedAtMs) {
            return remoteNormalized;
        }
        if (localUpdatedAtMs > remoteUpdatedAtMs) {
            return localNormalized;
        }
        return remoteScore > localScore ? remoteNormalized : localNormalized;
    }

    if (remoteUpdatedAtMs > 0 && localUpdatedAtMs === 0) {
        return localScore > remoteScore ? localNormalized : remoteNormalized;
    }

    if (localUpdatedAtMs > 0 && remoteUpdatedAtMs === 0) {
        return remoteScore > localScore ? remoteNormalized : localNormalized;
    }

    return remoteScore > localScore ? remoteNormalized : localNormalized;
}

function computeProgressScore(progress) {
    const unlockedSkinCount = Array.isArray(progress.unlockedSkinIds) ? progress.unlockedSkinIds.length : 0;
    return (
        clampProgressLevel(progress.maxUnlockedLevel, 1) * 1000000000 +
        clampCoins(progress.coins) * 10000 +
        unlockedSkinCount * 100 +
        clampProgressLevel(progress.currentLevel, 1)
    );
}

function resolveUpdatedAt(value, fallback, forceTouch) {
    if (forceTouch) {
        return new Date().toISOString();
    }

    const primary = normalizeIsoTimestamp(value);
    if (primary) {
        return primary;
    }

    const backup = normalizeIsoTimestamp(fallback);
    if (backup) {
        return backup;
    }

    return '';
}

function normalizeIsoTimestamp(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const text = value.trim();
    if (!text) {
        return '';
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toISOString();
}

function parseUpdatedAtMs(value) {
    const normalized = normalizeIsoTimestamp(value);
    if (!normalized) {
        return 0;
    }
    const time = Date.parse(normalized);
    return Number.isFinite(time) ? time : 0;
}

function sanitizeSkinIdList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set();
    const output = [];
    for (const item of value) {
        const id = `${item || ''}`.trim();
        if (!id || seen.has(id)) {
            continue;
        }
        seen.add(id);
        output.push(id);
    }
    return output;
}

function clampProgressLevel(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return Math.max(1, Math.floor(Number(fallback) || 1));
    }
    return Math.max(1, Math.floor(parsed));
}

function clampCoins(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Math.max(0, Math.floor(parsed));
}

function canUseApiStorage() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
        return false;
    }

    const host = (window.location?.hostname || '').toLowerCase();
    if (!host) {
        return false;
    }

    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
        return true;
    }

    return isPrivateIpv4Host(host);
}

function isPrivateIpv4Host(host) {
    const parts = host.split('.');
    if (parts.length !== 4) {
        return false;
    }

    const numbers = parts.map((part) => Number(part));
    if (numbers.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) {
        return false;
    }

    if (numbers[0] === 10) return true;
    if (numbers[0] === 192 && numbers[1] === 168) return true;
    if (numbers[0] === 172 && numbers[1] >= 16 && numbers[1] <= 31) return true;
    return false;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

import { getActiveUserId } from './user-auth.js?v=5';

const GAME_PROGRESS_FILE = 'game-progress-v1';
const STORAGE_API_BASE = '/api/storage';
const USER_API_BASE = '/api/users';
const PROGRESS_STATIC_CONFIG_PATHS = Object.freeze([
    '.local-data/game-progress-v1.json',
    'data/game-progress-v1.json'
]);
const PROGRESS_SCHEMA_VERSION = 1;
const SUPPORT_ADS_MAX_DAILY_LIMIT = 200;
const SUPPORT_AUTHOR_BADGE_MAX = 999999;

let progressInitPromise = null;
let serverSyncWarned = false;
let progressState = normalizeProgress(null);

export function initProgressStorage() {
    if (progressInitPromise) {
        return progressInitPromise;
    }

    progressInitPromise = hydrateFromPersistentSource().catch((error) => {
        console.warn('[progress-storage] init failed, using in-memory defaults', error);
    });

    return progressInitPromise;
}

export function readProgressSnapshot() {
    return cloneJson(progressState);
}

export function saveProgressSnapshot(progress, options = {}) {
    const normalized = normalizeProgress(progress, {
        fallback: progressState,
        forceTouchUpdatedAt: true
    });
    progressState = normalized;
    return persistProgressToServer(normalized, { keepalive: options.keepalive === true });
}

export function syncProgressSnapshotToServer(options = {}) {
    const state = readProgressSnapshot();
    return persistProgressToServer(state, { keepalive: options.keepalive === true });
}

async function hydrateFromPersistentSource() {
    const remote = await fetchProgressFromServer();
    if (remote) {
        progressState = normalizeProgress(remote, { fallback: progressState });
    }
}

async function fetchProgressFromServer() {
    if (typeof fetch !== 'function') {
        return null;
    }

    const userId = `${getActiveUserId() || ''}`.trim();
    if (userId) {
        try {
            const response = await fetch(`${USER_API_BASE}/${encodeURIComponent(userId)}/progress`, {
                method: 'GET',
                cache: 'no-store'
            });

            if (response.ok) {
                const payload = await response.json();
                const data = payload?.progress;
                return isPlainObject(data) ? data : null;
            }
        } catch {
            // continue to fallback source
        }
    }

    try {
        const response = await fetch(`${STORAGE_API_BASE}/${GAME_PROGRESS_FILE}`, {
            method: 'GET',
            cache: 'no-store'
        });

        if (response.ok) {
            const data = await response.json();
            return isPlainObject(data) ? data : null;
        }
    } catch {
        // continue to static fallback
    }

    for (const path of PROGRESS_STATIC_CONFIG_PATHS) {
        try {
            const response = await fetch(path, {
                method: 'GET',
                cache: 'no-store'
            });
            if (!response.ok) {
                continue;
            }
            const data = await response.json();
            if (isPlainObject(data)) {
                return data;
            }
        } catch {
            // try next static fallback
        }
    }

    return null;
}

async function persistProgressToServer(progress, options = {}) {
    if (typeof fetch !== 'function') {
        return false;
    }

    const userId = `${getActiveUserId() || ''}`.trim();
    if (userId) {
        try {
            const response = await fetch(`${USER_API_BASE}/${encodeURIComponent(userId)}/progress`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                keepalive: options.keepalive === true,
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

    try {
        const response = await fetch(`${STORAGE_API_BASE}/${GAME_PROGRESS_FILE}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            keepalive: options.keepalive === true,
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
    console.warn('[progress-storage] server sync unavailable; using read-only static/in-memory progress', error);
}

function normalizeProgress(value, options = {}) {
    const fallback = isPlainObject(options.fallback) ? options.fallback : {};
    const raw = isPlainObject(value) ? value : {};

    const fallbackMaxUnlocked = clampProgressLevel(fallback.maxUnlockedLevel, 1);
    const fallbackCurrent = clampProgressLevel(fallback.currentLevel, 1);
    const fallbackCleared = clampProgressLevelOrZero(fallback.maxClearedLevel, 0);
    const fallbackCoins = clampCoins(fallback.coins);
    const fallbackSelectedSkinId = `${fallback.selectedSkinId || ''}`.trim();
    const fallbackUnlockedSkins = sanitizeSkinIdList(fallback.unlockedSkinIds);
    const fallbackNextRewardLevelIndex = clampPositiveInt(fallback.nextRewardLevelIndex, 1);
    const fallbackRewardGuideShown = fallback.rewardGuideShown === true;
    const fallbackSupportAds = normalizeSupportAdsState(fallback.supportAds, null);
    const fallbackSupportAuthorBadgeCount = clampInt(
        fallback.supportAuthorBadgeCount,
        0,
        SUPPORT_AUTHOR_BADGE_MAX,
        0
    );
    const fallbackVersion = clampProgressLevel(fallback.version, PROGRESS_SCHEMA_VERSION);

    const maxUnlockedLevel = clampProgressLevel(raw.maxUnlockedLevel, fallbackMaxUnlocked);
    const currentLevel = clampProgressLevel(raw.currentLevel, fallbackCurrent);
    const maxClearedLevel = clampProgressLevelOrZero(raw.maxClearedLevel, fallbackCleared);
    const coins = clampCoins(raw.coins ?? fallbackCoins);
    const selectedSkinId = `${raw.selectedSkinId || fallbackSelectedSkinId || ''}`.trim();
    const unlockedSkinIds = sanitizeSkinIdList(raw.unlockedSkinIds).length > 0
        ? sanitizeSkinIdList(raw.unlockedSkinIds)
        : fallbackUnlockedSkins;
    const nextRewardLevelIndex = clampPositiveInt(
        raw.nextRewardLevelIndex,
        fallbackNextRewardLevelIndex
    );
    const rewardGuideShown = raw.rewardGuideShown === true || (raw.rewardGuideShown !== false && fallbackRewardGuideShown);
    const supportAds = normalizeSupportAdsState(raw.supportAds, fallbackSupportAds);
    const supportAuthorBadgeCount = clampInt(
        raw.supportAuthorBadgeCount,
        0,
        SUPPORT_AUTHOR_BADGE_MAX,
        fallbackSupportAuthorBadgeCount
    );
    const version = clampProgressLevel(raw.version, fallbackVersion || PROGRESS_SCHEMA_VERSION);
    const updatedAt = resolveUpdatedAt(raw.updatedAt, fallback.updatedAt, !!options.forceTouchUpdatedAt);

    return {
        version,
        updatedAt,
        maxUnlockedLevel,
        maxClearedLevel,
        currentLevel,
        coins,
        unlockedSkinIds,
        selectedSkinId,
        nextRewardLevelIndex,
        rewardGuideShown,
        supportAds,
        supportAuthorBadgeCount
    };
}

function normalizeSupportAdsState(value, fallback = null) {
    const source = isPlainObject(value) ? value : {};
    const base = isPlainObject(fallback) ? fallback : {
        dayKey: '',
        watchedToday: 0,
        totalWatched: 0,
        dailyLimitOverride: -1,
        lastPlacement: '',
        lastWatchedAt: ''
    };
    return {
        dayKey: sanitizeDayKey(source.dayKey ?? base.dayKey),
        watchedToday: clampNonNegativeInt(source.watchedToday ?? base.watchedToday),
        totalWatched: clampNonNegativeInt(source.totalWatched ?? base.totalWatched),
        dailyLimitOverride: clampInt(
            source.dailyLimitOverride ?? base.dailyLimitOverride,
            -1,
            SUPPORT_ADS_MAX_DAILY_LIMIT,
            -1
        ),
        lastPlacement: `${source.lastPlacement ?? base.lastPlacement ?? ''}`
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '')
            .slice(0, 40),
        lastWatchedAt: normalizeIsoTimestamp(source.lastWatchedAt ?? base.lastWatchedAt)
    };
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

function clampProgressLevelOrZero(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(Number(fallback) || 0));
    }
    return Math.max(0, Math.floor(parsed));
}

function clampCoins(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Math.max(0, Math.floor(parsed));
}

function clampPositiveInt(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return Math.max(1, Math.floor(Number(fallback) || 1));
    }
    return Math.max(1, Math.floor(parsed));
}

function clampNonNegativeInt(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(Number(fallback) || 0));
    }
    return Math.max(0, Math.floor(parsed));
}

function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function sanitizeDayKey(value) {
    const text = `${value || ''}`.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return '';
    }
    return text;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

const STORAGE_API_BASE = '/api/storage';
const BGM_STORAGE_KEY = 'arrowClear_bgmConfig_v1';
const BGM_STORAGE_FILE = 'bgm-config-v1';
const BGM_STATIC_CONFIG_PATH = '.local-data/bgm-config-v1.json';
const BGM_SCHEMA_VERSION = 1;

export const BGM_SCENE_KEYS = Object.freeze({
    HOME: 'home',
    NORMAL: 'normal',
    REWARD: 'reward',
    CAMPAIGN_COMPLETE: 'campaignComplete'
});

export const DEFAULT_BGM_CONFIG = Object.freeze({
    version: BGM_SCHEMA_VERSION,
    updatedAt: '',
    scenes: Object.freeze({
        [BGM_SCENE_KEYS.HOME]: Object.freeze({
            playlist: Object.freeze([{ url: 'assets/audio/bgm/\u5c0f\u86c7\u51fa\u4e0d\u53bb1.mp3', volume: 1 }]),
            volume: 0.65
        }),
        [BGM_SCENE_KEYS.NORMAL]: Object.freeze({
            playlist: Object.freeze([{ url: 'assets/audio/bgm/\u5c0f\u86c7\u51fa\u4e0d\u53bb2.mp3', volume: 1 }]),
            volume: 0.72
        }),
        [BGM_SCENE_KEYS.REWARD]: Object.freeze({
            playlist: Object.freeze([{ url: 'assets/audio/bgm/\u626d\u626d\u821e.mp3', volume: 1 }]),
            volume: 0.75
        }),
        [BGM_SCENE_KEYS.CAMPAIGN_COMPLETE]: Object.freeze({
            playlist: Object.freeze([{ url: 'assets/audio/bgm/\u5c0f\u86c7\u51fa\u4e0d\u53bb3.mp3', volume: 1 }]),
            volume: 0.8
        })
    })
});

let bgmInitPromise = null;
let bgmConfigState = normalizeBgmConfig(null);

export function initBgmStorage() {
    if (bgmInitPromise) {
        return bgmInitPromise;
    }
    bgmInitPromise = hydrateBgmFromServer().catch((error) => {
        console.warn('[bgm-storage] init failed, fallback to browser storage only', error);
    });
    return bgmInitPromise;
}

export function readBgmConfig() {
    return cloneJson(bgmConfigState);
}

export function writeBgmConfig(value, options = {}) {
    const normalized = normalizeBgmConfig(value, { forceTouchUpdatedAt: true });
    bgmConfigState = normalized;
    if (options.syncServer !== false) {
        void persistBgmToServer(normalized);
    }
    return cloneJson(normalized);
}

async function hydrateBgmFromServer() {
    if (!canUseApiStorage()) {
        return;
    }
    const staticConfig = await fetchJsonFromStaticFile();
    if (staticConfig) {
        const normalizedStatic = normalizeBgmConfig(staticConfig);
        const merged = mergeByUpdatedAt(normalizedStatic, readBgmConfig());
        bgmConfigState = merged;
        return;
    }
    const remote = await fetchJsonFromServer(BGM_STORAGE_FILE);
    const remoteNormalized = normalizeBgmConfig(remote);
    const merged = isGitHubPagesHost()
        ? remoteNormalized
        : mergeByUpdatedAt(remoteNormalized, readBgmConfig());
    const repaired = isGitHubPagesHost() ? merged : await repairBgmConfigByLibrary(merged);
    bgmConfigState = repaired;
}

async function repairBgmConfigByLibrary(config) {
    const normalized = normalizeBgmConfig(config);
    const library = await fetchBgmTrackLibrary();
    if (!Array.isArray(library) || library.length <= 0) {
        return normalized;
    }
    const fallbackTrack = library[0]?.url || '';
    const knownUrls = new Set(library.map((row) => `${row.url || ''}`.trim().toLowerCase()).filter(Boolean));
    const knownByFile = new Map(
        library
            .map((row) => [normalizeFileName(row.fileName), `${row.url || ''}`.trim()])
            .filter(([name, url]) => name && url)
    );

    const next = {
        ...normalized,
        scenes: { ...(normalized.scenes || {}) }
    };
    let changed = false;
    for (const sceneKey of Object.values(BGM_SCENE_KEYS)) {
        const scene = next.scenes[sceneKey] || { playlist: [], volume: 0.7 };
        const rawList = Array.isArray(scene.playlist) ? scene.playlist : [];
        const repairedList = [];
        for (const item of rawList) {
            const normalizedEntry = normalizePlaylistEntry(item);
            if (!normalizedEntry) {
                continue;
            }
            const normalizedPath = normalizedEntry.url;
            const lower = normalizedPath.toLowerCase();
            if (knownUrls.has(lower)) {
                repairedList.push(normalizedEntry);
                continue;
            }
            const fileName = normalizeFileName(getPathBaseName(normalizedPath));
            const mapped = fileName ? knownByFile.get(fileName) : '';
            if (mapped) {
                repairedList.push({
                    ...normalizedEntry,
                    url: mapped
                });
                changed = true;
            } else if (fallbackTrack) {
                repairedList.push({
                    ...normalizedEntry,
                    url: fallbackTrack
                });
                changed = true;
            }
        }
        const unique = dedupePlaylistEntries(repairedList);
        if (serializePlaylistSignature(unique) !== serializePlaylistSignature(rawList)) {
            changed = true;
        }
        next.scenes[sceneKey] = {
            ...scene,
            playlist: unique
        };
    }
    if (changed) {
        next.updatedAt = new Date().toISOString();
    }
    return next;
}

function normalizeFileName(value) {
    return decodePathCompat(`${value || ''}`)
        .replace(/\?/g, '')
        .trim()
        .toLowerCase();
}

function getPathBaseName(pathValue) {
    const normalized = `${pathValue || ''}`.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
}

async function fetchBgmTrackLibrary() {
    if (isGitHubPagesHost()) {
        return [];
    }
    try {
        const response = await fetch('/api/bgm/list', {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json().catch(() => ({}));
        const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
        return tracks.map((track) => ({
            url: `${track?.url || ''}`.trim(),
            fileName: `${track?.fileName || track?.name || ''}`.trim()
        })).filter((row) => row.url);
    } catch {
        return [];
    }
}

function normalizeBgmConfig(value, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const scenesRaw = isPlainObject(raw.scenes) ? raw.scenes : {};
    const defaults = DEFAULT_BGM_CONFIG.scenes;
    const forceTouch = !!options.forceTouchUpdatedAt;

    return {
        version: BGM_SCHEMA_VERSION,
        updatedAt: forceTouch ? new Date().toISOString() : normalizeIso(raw.updatedAt),
        scenes: {
            [BGM_SCENE_KEYS.HOME]: normalizeScene(scenesRaw[BGM_SCENE_KEYS.HOME], defaults[BGM_SCENE_KEYS.HOME]),
            [BGM_SCENE_KEYS.NORMAL]: normalizeScene(scenesRaw[BGM_SCENE_KEYS.NORMAL], defaults[BGM_SCENE_KEYS.NORMAL]),
            [BGM_SCENE_KEYS.REWARD]: normalizeScene(scenesRaw[BGM_SCENE_KEYS.REWARD], defaults[BGM_SCENE_KEYS.REWARD]),
            [BGM_SCENE_KEYS.CAMPAIGN_COMPLETE]: normalizeScene(
                scenesRaw[BGM_SCENE_KEYS.CAMPAIGN_COMPLETE],
                defaults[BGM_SCENE_KEYS.CAMPAIGN_COMPLETE]
            )
        }
    };
}

function normalizeScene(input, fallback) {
    const raw = isPlainObject(input) ? input : {};
    const backup = isPlainObject(fallback) ? fallback : { playlist: [], volume: 0.7 };
    const fallbackList = Array.isArray(backup.playlist) ? backup.playlist : [];
    const playlist = normalizePlaylist(raw.playlist, fallbackList);
    const volume = clampFloat(raw.volume, 0, 1, clampFloat(backup.volume, 0, 1, 0.7));
    return {
        playlist,
        volume
    };
}

function normalizePlaylist(input, fallback = []) {
    const rows = Array.isArray(input) ? input : (Array.isArray(fallback) ? fallback : []);
    return dedupePlaylistEntries(rows.map((row) => normalizePlaylistEntry(row)).filter(Boolean));
}

function normalizePlaylistEntry(rawEntry) {
    if (typeof rawEntry === 'string') {
        const url = normalizeTrackPath(rawEntry);
        return url ? { url, volume: 1 } : null;
    }
    if (!isPlainObject(rawEntry)) {
        return null;
    }
    const url = normalizeTrackPath(rawEntry.url || rawEntry.src || rawEntry.path || rawEntry.file || '');
    if (!url) {
        return null;
    }
    return {
        url,
        volume: clampFloat(rawEntry.volume, 0, 1, 1)
    };
}

function dedupePlaylistEntries(entries) {
    const out = [];
    const seen = new Set();
    for (const row of entries) {
        if (!row || !row.url) {
            continue;
        }
        if (seen.has(row.url)) {
            continue;
        }
        out.push({
            url: row.url,
            volume: clampFloat(row.volume, 0, 1, 1)
        });
        seen.add(row.url);
    }
    return out;
}

function serializePlaylistSignature(input) {
    const rows = Array.isArray(input) ? input : [];
    return rows
        .map((row) => normalizePlaylistEntry(row))
        .filter(Boolean)
        .map((row) => `${row.url}#${clampFloat(row.volume, 0, 1, 1).toFixed(4)}`)
        .join('\n');
}

function normalizeTrackPath(rawPath) {
    let text = `${rawPath || ''}`.trim();
    if (!text) {
        return '';
    }
    text = decodePathCompat(text);
    if (text.startsWith('/assets/audio/bgm/')) {
        return text.slice(1);
    }
    if (text.startsWith('assets/audio/bgm/')) {
        return text;
    }
    if (/^[^/\\]+\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(text)) {
        return `assets/audio/bgm/${text}`;
    }
    return '';
}

function decodePathCompat(pathValue) {
    let out = `${pathValue || ''}`;
    for (let i = 0; i < 2; i += 1) {
        try {
            const decoded = decodeURIComponent(out);
            if (decoded === out) {
                break;
            }
            out = decoded;
        } catch {
            break;
        }
    }
    return out;
}

async function fetchJsonFromServer(fileKey) {
    if (isGitHubPagesHost()) {
        return fetchJsonFromStaticFile();
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${fileKey}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return fetchJsonFromStaticFile();
        }
        const data = await response.json();
        return isPlainObject(data) ? data : null;
    } catch {
        return fetchJsonFromStaticFile();
    }
}

async function fetchJsonFromStaticFile() {
    try {
        const response = await fetch(BGM_STATIC_CONFIG_PATH, {
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

async function persistBgmToServer(config) {
    if (!canUseApiStorage() || isGitHubPagesHost()) {
        return false;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${BGM_STORAGE_FILE}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return response.ok;
    } catch {
        return false;
    }
}

function mergeByUpdatedAt(remoteValue, localValue) {
    const remoteTs = parseIsoToMs(remoteValue?.updatedAt);
    const localTs = parseIsoToMs(localValue?.updatedAt);
    if (remoteTs > localTs) {
        return remoteValue;
    }
    if (localTs > remoteTs) {
        return localValue;
    }
    return remoteValue;
}

function parseIsoToMs(value) {
    const text = normalizeIso(value);
    if (!text) {
        return 0;
    }
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : 0;
}

function normalizeIso(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const text = value.trim();
    if (!text) {
        return '';
    }
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

function clampFloat(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function canUseApiStorage() {
    return typeof window !== 'undefined' && typeof window.fetch === 'function';
}

function isGitHubPagesHost() {
    if (typeof window === 'undefined') {
        return false;
    }
    const host = `${window.location?.hostname || ''}`.toLowerCase();
    return host.endsWith('.github.io');
}


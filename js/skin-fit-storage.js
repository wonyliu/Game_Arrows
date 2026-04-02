const SKIN_PART_FIT_STORAGE_KEY = 'arrowClear_skinPartFitOverrides_v2';
const SKIN_PART_FIT_STORAGE_FILE = 'skin-part-fit-overrides-v1';
const STORAGE_API_BASE = '/api/storage';
const STORAGE_SCHEMA_VERSION = 1;
const PART_KEYS = new Set([
    'headDefault',
    'headCurious',
    'headSleepy',
    'headSurprised',
    'segA',
    'segB',
    'tailBase',
    'tailTip'
]);

let initPromise = null;
let serverSyncWarned = false;

export { SKIN_PART_FIT_STORAGE_KEY };

export function readSkinPartFitOverrides() {
    return readLocalOverrides();
}

export async function initSkinPartFitStorage() {
    if (initPromise) {
        return initPromise;
    }
    initPromise = hydrateFromServer().catch((error) => {
        console.warn('[skin-fit-storage] init failed, fallback to browser storage only', error);
    });
    return initPromise;
}

export async function saveSkinPartFitOverrides(rawOverrides) {
    const overrides = normalizeOverrides(rawOverrides);
    writeLocalOverrides(overrides);
    return persistOverridesToServer(overrides);
}

async function hydrateFromServer() {
    const localDoc = {
        version: STORAGE_SCHEMA_VERSION,
        updatedAt: '',
        overrides: readLocalOverrides()
    };
    const remoteDoc = await fetchOverridesFromServer();
    const remoteOverrides = normalizeOverrides(remoteDoc?.overrides);
    const hasRemote = hasOverrides(remoteOverrides);
    const hasLocal = hasOverrides(localDoc.overrides);

    if (hasRemote) {
        writeLocalOverrides(remoteOverrides);
        return;
    }

    if (hasLocal) {
        await persistOverridesToServer(localDoc.overrides);
    }
}

async function fetchOverridesFromServer() {
    if (!canUseApiStorage()) {
        return null;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${SKIN_PART_FIT_STORAGE_FILE}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return null;
        }
        const payload = await response.json().catch(() => null);
        if (!isPlainObject(payload)) {
            return null;
        }
        const sourceOverrides = isPlainObject(payload.overrides) ? payload.overrides : payload;
        return {
            version: Number(payload.version) || STORAGE_SCHEMA_VERSION,
            updatedAt: normalizeIsoTimestamp(payload.updatedAt),
            overrides: normalizeOverrides(sourceOverrides)
        };
    } catch {
        return null;
    }
}

async function persistOverridesToServer(overrides) {
    if (!canUseApiStorage()) {
        return false;
    }
    const payload = {
        version: STORAGE_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        overrides: normalizeOverrides(overrides)
    };
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${SKIN_PART_FIT_STORAGE_FILE}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
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
    console.warn('[skin-fit-storage] server sync unavailable, fallback to browser storage only', error);
}

function readLocalOverrides() {
    if (typeof localStorage === 'undefined') {
        return {};
    }
    try {
        const parsed = JSON.parse(localStorage.getItem(SKIN_PART_FIT_STORAGE_KEY) || 'null');
        return normalizeOverrides(parsed);
    } catch {
        return {};
    }
}

function writeLocalOverrides(overrides) {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(
            SKIN_PART_FIT_STORAGE_KEY,
            JSON.stringify(normalizeOverrides(overrides), null, 2)
        );
    } catch (error) {
        console.warn('[skin-fit-storage] failed to write browser storage', error);
    }
}

function normalizeOverrides(raw) {
    if (!isPlainObject(raw)) {
        return {};
    }
    const output = {};
    for (const [rawSkinId, rawParts] of Object.entries(raw)) {
        const skinId = sanitizeSkinId(rawSkinId);
        if (!skinId || !isPlainObject(rawParts)) {
            continue;
        }
        const nextParts = {};
        for (const [partKeyRaw, fitRaw] of Object.entries(rawParts)) {
            const partKey = `${partKeyRaw || ''}`.trim();
            if (!partKey || !PART_KEYS.has(partKey)) {
                continue;
            }
            nextParts[partKey] = normalizeFitEntry(fitRaw);
        }
        if (Object.keys(nextParts).length > 0) {
            output[skinId] = nextParts;
        }
    }
    return output;
}

function normalizeFitEntry(raw) {
    const value = isPlainObject(raw) ? raw : {};
    return {
        scale: clampNumber(value.scale, 1, 0.8, 1.4),
        offsetX: clampNumber(value.offsetX, 0, -0.35, 0.35),
        offsetY: clampNumber(value.offsetY, 0, -0.35, 0.35)
    };
}

function hasOverrides(overrides) {
    if (!isPlainObject(overrides)) {
        return false;
    }
    return Object.keys(overrides).length > 0;
}

function clampNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}

function sanitizeSkinId(rawId) {
    return `${rawId || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
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

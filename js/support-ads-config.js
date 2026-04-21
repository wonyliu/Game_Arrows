const STORAGE_API_BASE = '/api/storage';
const SUPPORT_ADS_CONFIG_FILE = 'support-ads-config-v1';
const SUPPORT_ADS_STATIC_CONFIG_PATH = 'data/managed-config/support-ads-config-v1.json';
const SUPPORT_ADS_LOCAL_STORAGE_KEY = 'arrowClear_supportAdsConfig_v1';
const SUPPORT_ADS_SCHEMA_VERSION = 1;

export const DEFAULT_SUPPORT_ADS_CONFIG = Object.freeze({
    version: SUPPORT_ADS_SCHEMA_VERSION,
    updatedAt: '',
    defaultDailyLimit: 5,
    thankYouMessage: '\u611f\u8c22\u4f60\u7684\u652f\u6301\uff0c\u8fd9\u4f1a\u5e2e\u52a9\u6211\u4eec\u6301\u7eed\u66f4\u65b0\u6e38\u620f\u5185\u5bb9\u3002',
    enabledPlacements: Object.freeze({
        support_author: true,
        fail_continue: false,
        double_coin: false
    }),
    adUnitIds: Object.freeze({
        support_author: '',
        fail_continue: '',
        double_coin: ''
    })
});

let initPromise = null;
let syncWarned = false;
let configState = normalizeSupportAdsConfig(readLocalConfig());

export function initSupportAdsConfig() {
    if (initPromise) {
        return initPromise;
    }
    initPromise = hydrateSupportAdsConfig().catch((error) => {
        console.warn('[support-ads-config] init failed, using local/default config', error);
    });
    return initPromise;
}

export function readSupportAdsConfig() {
    return cloneJson(configState);
}

export function writeSupportAdsConfig(value, options = {}) {
    const normalized = normalizeSupportAdsConfig(value, { forceTouchUpdatedAt: true });
    configState = normalized;
    writeLocalConfig(normalized);
    if (options.syncServer !== false) {
        void persistConfigToServer(normalized);
    }
    return cloneJson(normalized);
}

export function resolveEffectiveDailyAdLimit(overrideValue, defaultLimitValue) {
    const override = clampInt(overrideValue, -1, 200, -1);
    if (override >= 0) {
        return override;
    }
    return clampInt(defaultLimitValue, 0, 200, DEFAULT_SUPPORT_ADS_CONFIG.defaultDailyLimit);
}

async function hydrateSupportAdsConfig() {
    const local = normalizeSupportAdsConfig(readLocalConfig());
    configState = local;
    if (typeof fetch !== 'function') {
        return;
    }
    const [remoteFromStorage, remoteFromStatic] = await Promise.all([
        fetchSupportAdsConfigFromServer(),
        fetchSupportAdsConfigFromStatic()
    ]);
    const remote = remoteFromStorage || remoteFromStatic;
    if (!remote) {
        return;
    }
    const normalizedRemote = normalizeSupportAdsConfig(remote);
    configState = mergeByUpdatedAt(normalizedRemote, local);
    writeLocalConfig(configState);
}

async function fetchSupportAdsConfigFromServer() {
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${SUPPORT_ADS_CONFIG_FILE}`, {
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

async function fetchSupportAdsConfigFromStatic() {
    try {
        const response = await fetch(SUPPORT_ADS_STATIC_CONFIG_PATH, {
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

async function persistConfigToServer(config) {
    if (typeof fetch !== 'function') {
        return false;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${SUPPORT_ADS_CONFIG_FILE}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return true;
    } catch (error) {
        if (!syncWarned) {
            syncWarned = true;
            console.warn('[support-ads-config] server sync unavailable', error);
        }
        return false;
    }
}

function normalizeSupportAdsConfig(value, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const defaults = DEFAULT_SUPPORT_ADS_CONFIG;
    return {
        version: SUPPORT_ADS_SCHEMA_VERSION,
        updatedAt: options.forceTouchUpdatedAt === true
            ? new Date().toISOString()
            : normalizeIso(raw.updatedAt),
        defaultDailyLimit: clampInt(
            raw.defaultDailyLimit,
            0,
            200,
            defaults.defaultDailyLimit
        ),
        thankYouMessage: normalizeThankYouMessage(raw.thankYouMessage, defaults.thankYouMessage),
        enabledPlacements: normalizePlacements(raw.enabledPlacements, defaults.enabledPlacements),
        adUnitIds: normalizeAdUnitIds(raw.adUnitIds, defaults.adUnitIds)
    };
}

function normalizePlacements(rawValue, fallback) {
    const source = isPlainObject(rawValue) ? rawValue : {};
    return {
        support_author: source.support_author !== false && fallback.support_author !== false,
        fail_continue: source.fail_continue !== false && fallback.fail_continue !== false,
        double_coin: source.double_coin !== false && fallback.double_coin !== false
    };
}

function normalizeAdUnitIds(rawValue, fallback) {
    const source = isPlainObject(rawValue) ? rawValue : {};
    return {
        support_author: normalizeAdUnitId(source.support_author, fallback.support_author),
        fail_continue: normalizeAdUnitId(source.fail_continue, fallback.fail_continue),
        double_coin: normalizeAdUnitId(source.double_coin, fallback.double_coin)
    };
}

function normalizeAdUnitId(value, fallback = '') {
    const text = `${value ?? fallback ?? ''}`.trim();
    if (!text) {
        return '';
    }
    return text.slice(0, 120);
}

function normalizeThankYouMessage(value, fallback) {
    const text = `${value ?? fallback ?? ''}`.trim();
    if (!text) {
        return fallback;
    }
    return text.slice(0, 180);
}

function normalizeIso(value) {
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

function mergeByUpdatedAt(remoteValue, localValue) {
    const remoteAt = parseIsoMs(remoteValue?.updatedAt);
    const localAt = parseIsoMs(localValue?.updatedAt);
    if (remoteAt > localAt) {
        return remoteValue;
    }
    return localValue;
}

function parseIsoMs(value) {
    const text = `${value || ''}`.trim();
    if (!text) {
        return 0;
    }
    const time = Date.parse(text);
    return Number.isFinite(time) ? time : 0;
}

function readLocalConfig() {
    try {
        const raw = localStorage.getItem(SUPPORT_ADS_LOCAL_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return isPlainObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function writeLocalConfig(config) {
    try {
        localStorage.setItem(SUPPORT_ADS_LOCAL_STORAGE_KEY, JSON.stringify(config, null, 2));
    } catch {
        // ignore local storage failures
    }
}

function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

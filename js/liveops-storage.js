const STORAGE_API_BASE = '/api/storage';

const LIVEOPS_CONFIG_STORAGE_KEY = 'arrowClear_liveopsConfig_v1';
const LIVEOPS_CONFIG_FILE = 'liveops-config-v1';

const LIVEOPS_PLAYER_STORAGE_KEY = 'arrowClear_liveopsPlayer_v1';
const LIVEOPS_PLAYER_FILE = 'liveops-player-v1';

const LIVEOPS_SCHEMA_VERSION = 1;

export const DEFAULT_LIVEOPS_CONFIG = Object.freeze({
    version: LIVEOPS_SCHEMA_VERSION,
    updatedAt: '',
    items: Object.freeze([
        Object.freeze({ id: 'coin', nameZh: '\u91d1\u5e01', nameEn: 'Coin', type: 'currency', builtin: true }),
        Object.freeze({ id: 'skin_fragment', nameZh: '\u76ae\u80a4\u788e\u7247', nameEn: 'Skin Fragment', type: 'currency', builtin: true }),
        Object.freeze({ id: 'hint', nameZh: '\u63d0\u793a', nameEn: 'Hint', type: 'tool', builtin: true }),
        Object.freeze({ id: 'undo', nameZh: '\u64a4\u9500', nameEn: 'Undo', type: 'tool', builtin: true }),
        Object.freeze({ id: 'shuffle', nameZh: '\u91cd\u6392', nameEn: 'Shuffle', type: 'tool', builtin: true }),
        Object.freeze({ id: 'skin', nameZh: '\u76ae\u80a4', nameEn: 'Skin', type: 'item', builtin: true })
    ]),
    activities: Object.freeze({
        checkin: Object.freeze({
            enabled: true,
            cycleDays: 7,
            rewards: Object.freeze([
                Object.freeze([{ itemId: 'coin', amount: 30 }]),
                Object.freeze([{ itemId: 'coin', amount: 40 }]),
                Object.freeze([{ itemId: 'coin', amount: 50 }]),
                Object.freeze([{ itemId: 'hint', amount: 1 }]),
                Object.freeze([{ itemId: 'coin', amount: 70 }]),
                Object.freeze([{ itemId: 'skin_fragment', amount: 2 }]),
                Object.freeze([{ itemId: 'skin', amount: 1 }])
            ])
        }),
        onlineReward: Object.freeze({
            enabled: true,
            resetHour: 4,
            tiers: Object.freeze([
                Object.freeze({ seconds: 120, rewards: Object.freeze([{ itemId: 'coin', amount: 20 }]) }),
                Object.freeze({ seconds: 300, rewards: Object.freeze([{ itemId: 'hint', amount: 1 }]) }),
                Object.freeze({ seconds: 600, rewards: Object.freeze([{ itemId: 'skin_fragment', amount: 1 }]) })
            ])
        })
    })
});

export const DEFAULT_LIVEOPS_PLAYER_STATE = Object.freeze({
    version: LIVEOPS_SCHEMA_VERSION,
    updatedAt: '',
    inventory: Object.freeze({
        skin_fragment: 0,
        hint: 0,
        undo: 0,
        shuffle: 0
    }),
    checkin: Object.freeze({
        claimedCount: 0,
        lastClaimDayKey: ''
    }),
    onlineReward: Object.freeze({
        dayKey: '',
        tierIndex: 0,
        remainingSeconds: 0
    })
});

let liveopsInitPromise = null;
let configSyncWarned = false;
let playerSyncWarned = false;

export function initLiveOpsStorage() {
    if (liveopsInitPromise) {
        return liveopsInitPromise;
    }

    liveopsInitPromise = hydrateLiveOpsFromServer().catch((error) => {
        console.warn('[liveops-storage] init failed, fallback to browser storage only', error);
    });
    return liveopsInitPromise;
}

export function readLiveOpsConfig() {
    const storage = getStorage();
    if (!storage) {
        return normalizeLiveOpsConfig(null);
    }
    try {
        return normalizeLiveOpsConfig(JSON.parse(storage.getItem(LIVEOPS_CONFIG_STORAGE_KEY) || 'null'));
    } catch {
        return normalizeLiveOpsConfig(null);
    }
}

export function writeLiveOpsConfig(value, options = {}) {
    const normalized = normalizeLiveOpsConfig(value, { forceTouchUpdatedAt: true });
    writeLocalJson(LIVEOPS_CONFIG_STORAGE_KEY, normalized);
    if (options.syncServer !== false) {
        void persistConfigToServer(normalized);
    }
    return normalized;
}

export function readLiveOpsPlayerState() {
    const storage = getStorage();
    if (!storage) {
        return normalizeLiveOpsPlayerState(null);
    }
    try {
        return normalizeLiveOpsPlayerState(JSON.parse(storage.getItem(LIVEOPS_PLAYER_STORAGE_KEY) || 'null'));
    } catch {
        return normalizeLiveOpsPlayerState(null);
    }
}

export function writeLiveOpsPlayerState(value, options = {}) {
    const normalized = normalizeLiveOpsPlayerState(value, { forceTouchUpdatedAt: true });
    writeLocalJson(LIVEOPS_PLAYER_STORAGE_KEY, normalized);
    if (options.syncServer === true) {
        void persistPlayerToServer(normalized);
    }
    return normalized;
}

export function syncLiveOpsPlayerToServer() {
    const state = readLiveOpsPlayerState();
    return persistPlayerToServer(state);
}

export function getBusinessDayKeyByHour(dateValue, resetHour = 0) {
    const date = dateValue instanceof Date ? new Date(dateValue.getTime()) : new Date();
    const hour = clampInt(resetHour, 0, 23, 0);
    const shifted = new Date(date.getTime() - hour * 60 * 60 * 1000);
    const year = shifted.getFullYear();
    const month = `${shifted.getMonth() + 1}`.padStart(2, '0');
    const day = `${shifted.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getLocalDayKey(dateValue) {
    return getBusinessDayKeyByHour(dateValue, 0);
}

async function hydrateLiveOpsFromServer() {
    if (!canUseApiStorage()) {
        return;
    }

    const [remoteConfig, remotePlayer] = await Promise.all([
        fetchJsonFromServer(LIVEOPS_CONFIG_FILE),
        fetchJsonFromServer(LIVEOPS_PLAYER_FILE)
    ]);

    if (remoteConfig) {
        const mergedConfig = mergeByUpdatedAt(
            normalizeLiveOpsConfig(remoteConfig),
            readLiveOpsConfig()
        );
        writeLocalJson(LIVEOPS_CONFIG_STORAGE_KEY, mergedConfig);
    }

    if (remotePlayer) {
        const mergedPlayer = mergeByUpdatedAt(
            normalizeLiveOpsPlayerState(remotePlayer),
            readLiveOpsPlayerState()
        );
        writeLocalJson(LIVEOPS_PLAYER_STORAGE_KEY, mergedPlayer);
    }
}

async function fetchJsonFromServer(fileKey) {
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${fileKey}`, {
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
    if (!canUseApiStorage()) {
        return false;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${LIVEOPS_CONFIG_FILE}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return true;
    } catch (error) {
        if (!configSyncWarned) {
            configSyncWarned = true;
            console.warn('[liveops-storage] config sync unavailable', error);
        }
        return false;
    }
}

async function persistPlayerToServer(player) {
    if (!canUseApiStorage()) {
        return false;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${LIVEOPS_PLAYER_FILE}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(player)
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return true;
    } catch (error) {
        if (!playerSyncWarned) {
            playerSyncWarned = true;
            console.warn('[liveops-storage] player sync unavailable', error);
        }
        return false;
    }
}

function normalizeLiveOpsConfig(value, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const forceTouchUpdatedAt = !!options.forceTouchUpdatedAt;
    const fallback = DEFAULT_LIVEOPS_CONFIG;

    const items = normalizeItems(raw.items, fallback.items);
    const checkin = normalizeCheckinConfig(raw.activities?.checkin, fallback.activities.checkin, items);
    const onlineReward = normalizeOnlineRewardConfig(raw.activities?.onlineReward, fallback.activities.onlineReward, items);
    return {
        version: LIVEOPS_SCHEMA_VERSION,
        updatedAt: forceTouchUpdatedAt ? new Date().toISOString() : normalizeIso(raw.updatedAt),
        items,
        activities: {
            checkin,
            onlineReward
        }
    };
}

function normalizeLiveOpsPlayerState(value, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const forceTouchUpdatedAt = !!options.forceTouchUpdatedAt;

    const inventoryRaw = isPlainObject(raw.inventory) ? raw.inventory : {};
    const inventory = {};
    for (const [rawKey, rawValue] of Object.entries(inventoryRaw)) {
        const key = sanitizeId(rawKey);
        if (!key) {
            continue;
        }
        inventory[key] = clampInt(rawValue, 0, 9999999, 0);
    }
    if (!Object.prototype.hasOwnProperty.call(inventory, 'skin_fragment')) inventory.skin_fragment = 0;
    if (!Object.prototype.hasOwnProperty.call(inventory, 'hint')) inventory.hint = 0;
    if (!Object.prototype.hasOwnProperty.call(inventory, 'undo')) inventory.undo = 0;
    if (!Object.prototype.hasOwnProperty.call(inventory, 'shuffle')) inventory.shuffle = 0;

    const checkinRaw = isPlainObject(raw.checkin) ? raw.checkin : {};
    const checkin = {
        claimedCount: clampInt(checkinRaw.claimedCount, 0, 999999, 0),
        lastClaimDayKey: sanitizeDayKey(checkinRaw.lastClaimDayKey)
    };

    const onlineRaw = isPlainObject(raw.onlineReward) ? raw.onlineReward : {};
    const onlineReward = {
        dayKey: sanitizeDayKey(onlineRaw.dayKey),
        tierIndex: clampInt(onlineRaw.tierIndex, 0, 999, 0),
        remainingSeconds: clampFloat(onlineRaw.remainingSeconds, 0, 86400, 0)
    };

    return {
        version: LIVEOPS_SCHEMA_VERSION,
        updatedAt: forceTouchUpdatedAt ? new Date().toISOString() : normalizeIso(raw.updatedAt),
        inventory,
        checkin,
        onlineReward
    };
}

function normalizeItems(rawItems, fallbackItems) {
    const source = Array.isArray(rawItems) ? rawItems : fallbackItems;
    const out = [];
    const seen = new Set();
    for (const raw of source) {
        if (!isPlainObject(raw)) {
            continue;
        }
        const id = sanitizeId(raw.id);
        if (!id || seen.has(id)) {
            continue;
        }
        seen.add(id);
        out.push({
            id,
            nameZh: normalizeText(raw.nameZh, id),
            nameEn: normalizeText(raw.nameEn, id),
            type: normalizeItemType(raw.type),
            builtin: !!raw.builtin
        });
    }

    for (const builtin of fallbackItems) {
        if (!out.some((item) => item.id === builtin.id)) {
            out.push({
                id: builtin.id,
                nameZh: builtin.nameZh,
                nameEn: builtin.nameEn,
                type: builtin.type,
                builtin: true
            });
        }
    }

    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}

function normalizeCheckinConfig(raw, fallback, items) {
    const source = isPlainObject(raw) ? raw : {};
    const cycleDays = clampInt(source.cycleDays, 1, 31, fallback.cycleDays);
    const sourceRewards = Array.isArray(source.rewards) ? source.rewards : fallback.rewards;
    const rewards = [];
    for (let day = 0; day < cycleDays; day += 1) {
        const candidate = sourceRewards[day] ?? sourceRewards[sourceRewards.length - 1] ?? [];
        rewards.push(normalizeRewardList(candidate, items));
    }
    return {
        enabled: source.enabled !== false,
        cycleDays,
        rewards
    };
}

function normalizeOnlineRewardConfig(raw, fallback, items) {
    const source = isPlainObject(raw) ? raw : {};
    const tiersSource = Array.isArray(source.tiers) && source.tiers.length > 0
        ? source.tiers
        : fallback.tiers;
    const tiers = tiersSource.map((tier) => {
        const tierObj = isPlainObject(tier) ? tier : {};
        return {
            seconds: clampInt(tierObj.seconds, 5, 86400, 60),
            rewards: normalizeRewardList(tierObj.rewards, items)
        };
    });
    return {
        enabled: source.enabled !== false,
        resetHour: clampInt(source.resetHour, 0, 23, fallback.resetHour),
        tiers
    };
}

function normalizeRewardList(raw, items) {
    const rows = Array.isArray(raw) ? raw : [];
    const validIds = new Set((Array.isArray(items) ? items : []).map((item) => item.id));
    const out = [];
    for (const row of rows) {
        if (!isPlainObject(row)) {
            continue;
        }
        const itemId = sanitizeId(row.itemId);
        if (!itemId || !validIds.has(itemId)) {
            continue;
        }
        const amount = clampInt(row.amount, 1, 9999999, 1);
        out.push({ itemId, amount });
    }
    return out;
}

function normalizeItemType(rawType) {
    const text = `${rawType || ''}`.trim().toLowerCase();
    if (text === 'currency' || text === 'tool' || text === 'item' || text === 'skin') {
        return text;
    }
    return 'item';
}

function writeLocalJson(key, value) {
    const storage = getStorage();
    if (!storage) return;
    try {
        storage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('[liveops-storage] failed to write local storage', error);
    }
}

function mergeByUpdatedAt(remoteValue, localValue) {
    const remoteAt = parseIsoMs(remoteValue?.updatedAt);
    const localAt = parseIsoMs(localValue?.updatedAt);
    if (remoteAt > localAt) {
        return remoteValue;
    }
    return localValue;
}

function getStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    return window.localStorage;
}

function canUseApiStorage() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
        return false;
    }
    const host = `${window.location?.hostname || ''}`.toLowerCase();
    if (!host) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
        return true;
    }
    const parts = host.split('.');
    if (parts.length !== 4) {
        return false;
    }
    const nums = parts.map((part) => Number(part));
    if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) {
        return false;
    }
    if (nums[0] === 10) return true;
    if (nums[0] === 192 && nums[1] === 168) return true;
    if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;
    return false;
}

function sanitizeId(value) {
    return `${value || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function sanitizeDayKey(value) {
    const text = `${value || ''}`.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeText(value, fallback) {
    const text = `${value || ''}`.replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function normalizeIso(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const date = new Date(value.trim());
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toISOString();
}

function parseIsoMs(value) {
    const iso = normalizeIso(value);
    if (!iso) {
        return 0;
    }
    const time = Date.parse(iso);
    return Number.isFinite(time) ? time : 0;
}

function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampFloat(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}




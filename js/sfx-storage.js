const STORAGE_API_BASE = '/api/storage';

export const SFX_CUSTOM_PRESETS_STORAGE_KEY = 'arrowClear_sfxCustomPresets_v1';
export const SKIN_SFX_BINDINGS_STORAGE_KEY = 'arrowClear_skinSfxPresetBySkin_v1';
export const SFX_LAB_STATE_STORAGE_KEY = 'arrowClear_sfxLabState_v2';
export const SFX_PRESET_OVERRIDES_STORAGE_KEY = 'arrowClear_sfxPresetOverrides_v1';
export const GAME_SFX_BINDINGS_STORAGE_KEY = 'arrowClear_gameSfxPresetByEvent_v1';

const SFX_CUSTOM_PRESETS_FILE = 'sfx-custom-presets-v1';
const SKIN_SFX_BINDINGS_FILE = 'skin-sfx-bindings-v1';
const SFX_LAB_STATE_FILE = 'sfx-lab-state-v1';
const SFX_PRESET_OVERRIDES_FILE = 'sfx-preset-overrides-v1';
const GAME_SFX_BINDINGS_FILE = 'game-sfx-bindings-v1';

const DEFAULT_GAME_SFX_BINDINGS = Object.freeze({
    click: 'syrup-pop',
    coin: 'syrup-pop',
    checkinCoinTrail: 'syrup-pop',
    error: 'fail-plop',
    levelComplete: 'candy-crunch',
    gameOver: 'fail-plop'
});

export const SFX_PARAM_SCHEMA = Object.freeze({
    impact: Object.freeze({ min: 0.1, max: 1.8, digits: 2, integer: false }),
    pitchSemitone: Object.freeze({ min: -24, max: 24, digits: 0, integer: true }),
    length: Object.freeze({ min: 0.35, max: 2.2, digits: 2, integer: false }),
    randomness: Object.freeze({ min: 0, max: 1, digits: 2, integer: false }),
    bounce: Object.freeze({ min: 0, max: 1, digits: 2, integer: false }),
    repeats: Object.freeze({ min: 1, max: 6, digits: 0, integer: true })
});

export const BUILTIN_SFX_PRESETS = Object.freeze([
    Object.freeze({
        id: 'candy-crunch',
        name: 'Candy Crunch',
        description: 'Crisp high-end particles with light rebound for hit/combo feedback.',
        defaults: Object.freeze({
            impact: 0.9,
            pitchSemitone: 2,
            length: 0.95,
            randomness: 0.68,
            bounce: 0.22,
            repeats: 3
        })
    }),
    Object.freeze({
        id: 'jelly-duang',
        name: 'Jelly Duang',
        description: 'Soft low-end bounce with a gummy tail, good for jelly body touch.',
        defaults: Object.freeze({
            impact: 0.84,
            pitchSemitone: -3,
            length: 1.18,
            randomness: 0.22,
            bounce: 0.86,
            repeats: 2
        })
    }),
    Object.freeze({
        id: 'syrup-pop',
        name: 'Syrup Pop',
        description: 'Short bubble pop for light trigger and UI click feedback.',
        defaults: Object.freeze({
            impact: 0.72,
            pitchSemitone: 4,
            length: 0.7,
            randomness: 0.36,
            bounce: 0.28,
            repeats: 1
        })
    }),
    Object.freeze({
        id: 'gummy-stretch',
        name: 'Gummy Stretch',
        description: 'Mid/low glide with curl-back, suitable for drag and stretch feel.',
        defaults: Object.freeze({
            impact: 0.76,
            pitchSemitone: -6,
            length: 1.34,
            randomness: 0.3,
            bounce: 0.6,
            repeats: 1
        })
    }),
    Object.freeze({
        id: 'fail-plop',
        name: 'Fail Plop',
        description: 'Low, short thud for mis-tap and fail feedback.',
        defaults: Object.freeze({
            impact: 0.88,
            pitchSemitone: -9,
            length: 0.9,
            randomness: 0.18,
            bounce: 0.2,
            repeats: 1
        })
    })
]);

const BUILTIN_PRESET_BY_ID = new Map(BUILTIN_SFX_PRESETS.map((preset) => [preset.id, preset]));
let initPromise = null;

export function initSfxStorage() {
    if (initPromise) {
        return initPromise;
    }
    initPromise = hydrateSfxStorageFromServer().catch((error) => {
        console.warn('[sfx-storage] init failed, fallback to browser storage only', error);
    });
    return initPromise;
}

export function isBuiltInSfxPresetId(presetId) {
    return BUILTIN_PRESET_BY_ID.has(sanitizePresetId(presetId));
}

export function getSfxPresetCatalog() {
    const overrides = readSfxPresetParamOverrides();
    const customPresets = readCustomSfxPresets();
    return [
        ...BUILTIN_SFX_PRESETS.map((preset) => applyPresetParamOverrides(preset, overrides, false)),
        ...customPresets.map((preset) => applyPresetParamOverrides(preset, overrides, true))
    ];
}

export function getSfxPresetById(presetId) {
    const overrides = readSfxPresetParamOverrides();
    const key = sanitizePresetId(presetId);
    if (key) {
        const builtIn = BUILTIN_PRESET_BY_ID.get(key);
        if (builtIn) {
            return applyPresetParamOverrides(builtIn, overrides, false);
        }
        const custom = readCustomSfxPresets().find((preset) => preset.id === key);
        if (custom) {
            return applyPresetParamOverrides(custom, overrides, true);
        }
    }
    return applyPresetParamOverrides(BUILTIN_SFX_PRESETS[0], overrides, false);
}

export function getSfxPresetSample(presetId) {
    const preset = getSfxPresetById(presetId);
    const sample = normalizeCustomPresetSample(preset?.sample);
    return sample || null;
}

export function normalizeRecipe(rawRecipe, fallbackPresetId = BUILTIN_SFX_PRESETS[0].id) {
    const input = isPlainObject(rawRecipe) ? rawRecipe : {};
    const presetId = getSfxPresetById(input.presetId || fallbackPresetId).id;
    const fallbackParams = getSfxPresetById(presetId).defaults;
    const rawParams = isPlainObject(input.params) ? input.params : input;
    return {
        presetId,
        params: normalizePresetParams(rawParams, fallbackParams)
    };
}

export function readSfxLabState() {
    const data = readLocalJson(SFX_LAB_STATE_STORAGE_KEY, {});
    return normalizeRecipe(data, BUILTIN_SFX_PRESETS[0].id);
}

export function writeSfxLabState(recipe) {
    const normalized = normalizeRecipe(recipe, BUILTIN_SFX_PRESETS[0].id);
    writeLocalJson(SFX_LAB_STATE_STORAGE_KEY, normalized);
    void persistJsonToServer(SFX_LAB_STATE_FILE, normalized);
    return normalized;
}

export function readSfxPresetParamOverrides() {
    const data = readLocalJson(SFX_PRESET_OVERRIDES_STORAGE_KEY, {});
    return normalizeSfxPresetOverrides(data);
}

export function writeSfxPresetParamOverrides(map) {
    const normalized = normalizeSfxPresetOverrides(map);
    writeLocalJson(SFX_PRESET_OVERRIDES_STORAGE_KEY, normalized);
    void persistJsonToServer(SFX_PRESET_OVERRIDES_FILE, normalized);
    return normalized;
}

export function setSfxPresetParamOverride(presetId, params) {
    const id = sanitizePresetId(presetId);
    if (!id) {
        return readSfxPresetParamOverrides();
    }
    const baseDefaults = resolveBaseDefaultsForPresetId(id);
    const overrides = readSfxPresetParamOverrides();
    overrides[id] = normalizePresetParams(params, baseDefaults);
    return writeSfxPresetParamOverrides(overrides);
}

export function readCustomSfxPresets() {
    const data = readLocalJson(SFX_CUSTOM_PRESETS_STORAGE_KEY, []);
    return normalizeCustomPresetList(data);
}

export function writeCustomSfxPresets(presets) {
    const normalized = normalizeCustomPresetList(presets);
    writeLocalJson(SFX_CUSTOM_PRESETS_STORAGE_KEY, normalized);
    void persistJsonToServer(SFX_CUSTOM_PRESETS_FILE, { presets: normalized });
    return normalized;
}

export function upsertCustomSfxPreset(payload = {}, options = {}) {
    const current = readCustomSfxPresets();
    const fallbackParams = normalizePresetParams(payload.params, BUILTIN_SFX_PRESETS[0].defaults);
    const nextName = sanitizeDisplayText(payload.name, 'Custom SFX');
    const nextDescription = sanitizeDisplayText(payload.description, '');

    const presetIdSet = new Set(getSfxPresetCatalog().map((preset) => preset.id));
    const rawRequestedId = sanitizePresetId(payload.id);
    const requestedId = (rawRequestedId && !isBuiltInSfxPresetId(rawRequestedId)) ? rawRequestedId : '';
    const enforceUpdateId = sanitizePresetId(options.enforceUpdateId);

    let nextId = enforceUpdateId && current.some((item) => item.id === enforceUpdateId)
        ? enforceUpdateId
        : requestedId;
    if (!nextId) {
        nextId = buildUniqueCustomPresetId(nextName, presetIdSet);
    }

    const existingIndex = current.findIndex((item) => item.id === nextId);
    const nowIso = new Date().toISOString();
    const existingSample = existingIndex >= 0 ? normalizeCustomPresetSample(current[existingIndex]?.sample) : null;
    const payloadSample = normalizeCustomPresetSample(payload?.sample);
    const nextSample = payloadSample !== null
        ? payloadSample
        : existingSample;

    const nextEntry = normalizeCustomPresetEntry({
        id: nextId,
        name: nextName,
        description: nextDescription,
        defaults: fallbackParams,
        sample: nextSample,
        createdAt: existingIndex >= 0 ? current[existingIndex].createdAt : nowIso,
        updatedAt: nowIso
    }, existingIndex >= 0 ? existingIndex : current.length);

    const next = [...current];
    if (existingIndex >= 0) {
        next[existingIndex] = nextEntry;
    } else {
        next.push(nextEntry);
    }

    writeCustomSfxPresets(next);
    return nextEntry;
}

export function setCustomSfxPresetSample(presetId, sample) {
    const id = sanitizePresetId(presetId);
    if (!id || isBuiltInSfxPresetId(id)) {
        return null;
    }
    const current = readCustomSfxPresets();
    const index = current.findIndex((item) => item.id === id);
    if (index < 0) {
        return null;
    }
    const normalizedSample = normalizeCustomPresetSample(sample);
    const nextEntry = normalizeCustomPresetEntry({
        ...current[index],
        sample: normalizedSample,
        updatedAt: new Date().toISOString()
    }, index);
    const next = [...current];
    next[index] = nextEntry;
    writeCustomSfxPresets(next);
    return nextEntry;
}

export function deleteCustomSfxPreset(presetId) {
    const id = sanitizePresetId(presetId);
    if (!id || isBuiltInSfxPresetId(id)) {
        return false;
    }
    const current = readCustomSfxPresets();
    const next = current.filter((item) => item.id !== id);
    if (next.length === current.length) {
        return false;
    }
    writeCustomSfxPresets(next);

    const overrides = readSfxPresetParamOverrides();
    if (Object.prototype.hasOwnProperty.call(overrides, id)) {
        delete overrides[id];
        writeSfxPresetParamOverrides(overrides);
    }

    const bindings = readSkinSfxBindings();
    let dirty = false;
    for (const [skinId, bindPresetId] of Object.entries(bindings)) {
        if (bindPresetId === id) {
            delete bindings[skinId];
            dirty = true;
        }
    }
    if (dirty) {
        writeSkinSfxBindings(bindings);
    }
    return true;
}

export function readSkinSfxBindings() {
    const data = readLocalJson(SKIN_SFX_BINDINGS_STORAGE_KEY, {});
    return normalizeSkinSfxBindings(data);
}

export function writeSkinSfxBindings(map) {
    const normalized = normalizeSkinSfxBindings(map);
    writeLocalJson(SKIN_SFX_BINDINGS_STORAGE_KEY, normalized);
    void persistJsonToServer(SKIN_SFX_BINDINGS_FILE, normalized);
    return normalized;
}

export function getSkinSfxPresetId(skinId, fallbackPresetId = BUILTIN_SFX_PRESETS[0].id) {
    const id = sanitizeSkinId(skinId);
    if (!id) {
        return getSfxPresetById(fallbackPresetId).id;
    }
    const bindings = readSkinSfxBindings();
    return getSfxPresetById(bindings[id] || fallbackPresetId).id;
}

export function setSkinSfxPresetId(skinId, presetId) {
    const id = sanitizeSkinId(skinId);
    if (!id) {
        return readSkinSfxBindings();
    }
    const preset = getSfxPresetById(presetId);
    const bindings = readSkinSfxBindings();
    bindings[id] = preset.id;
    return writeSkinSfxBindings(bindings);
}

export function readGameSfxBindings() {
    const data = readLocalJson(GAME_SFX_BINDINGS_STORAGE_KEY, {});
    return normalizeGameSfxBindings(data);
}

export function writeGameSfxBindings(map) {
    const normalized = normalizeGameSfxBindings(map);
    writeLocalJson(GAME_SFX_BINDINGS_STORAGE_KEY, normalized);
    void persistJsonToServer(GAME_SFX_BINDINGS_FILE, normalized);
    return normalized;
}

export function getGameSfxPresetId(eventKey, fallbackPresetId = BUILTIN_SFX_PRESETS[0].id) {
    const key = sanitizeGameSfxEventKey(eventKey);
    const bindings = readGameSfxBindings();
    const defaultPresetId = DEFAULT_GAME_SFX_BINDINGS[key] || fallbackPresetId;
    return getSfxPresetById(bindings[key] || defaultPresetId).id;
}

export function setGameSfxPresetId(eventKey, presetId) {
    const key = sanitizeGameSfxEventKey(eventKey);
    if (!key) {
        return readGameSfxBindings();
    }
    const preset = getSfxPresetById(presetId);
    const bindings = readGameSfxBindings();
    bindings[key] = preset.id;
    return writeGameSfxBindings(bindings);
}

async function hydrateSfxStorageFromServer() {
    if (!canUseApiStorage()) {
        return;
    }

    const [customPayload, bindingPayload, labPayload, overridePayload, gameSfxPayload] = await Promise.all([
        fetchJsonFromServer(SFX_CUSTOM_PRESETS_FILE),
        fetchJsonFromServer(SKIN_SFX_BINDINGS_FILE),
        fetchJsonFromServer(SFX_LAB_STATE_FILE),
        fetchJsonFromServer(SFX_PRESET_OVERRIDES_FILE),
        fetchJsonFromServer(GAME_SFX_BINDINGS_FILE)
    ]);

    if (isPlainObject(customPayload) || Array.isArray(customPayload)) {
        const rows = Array.isArray(customPayload)
            ? customPayload
            : (Array.isArray(customPayload.presets) ? customPayload.presets : []);
        writeLocalJson(SFX_CUSTOM_PRESETS_STORAGE_KEY, normalizeCustomPresetList(rows));
    }

    if (isPlainObject(bindingPayload)) {
        writeLocalJson(SKIN_SFX_BINDINGS_STORAGE_KEY, normalizeSkinSfxBindings(bindingPayload));
    }

    if (isPlainObject(labPayload)) {
        writeLocalJson(SFX_LAB_STATE_STORAGE_KEY, normalizeRecipe(labPayload));
    }

    if (isPlainObject(overridePayload)) {
        writeLocalJson(SFX_PRESET_OVERRIDES_STORAGE_KEY, normalizeSfxPresetOverrides(overridePayload));
    }
    if (isPlainObject(gameSfxPayload)) {
        writeLocalJson(GAME_SFX_BINDINGS_STORAGE_KEY, normalizeGameSfxBindings(gameSfxPayload));
    }
}

async function fetchJsonFromServer(fileName) {
    if (!canUseApiStorage()) {
        return null;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${fileName}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
}

async function persistJsonToServer(fileName, payload) {
    if (!canUseApiStorage()) {
        return false;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${fileName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch {
        return false;
    }
}

function readLocalJson(storageKey, fallback) {
    if (typeof localStorage === 'undefined') {
        return fallback;
    }
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return fallback;
        }
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeLocalJson(storageKey, payload) {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(storageKey, JSON.stringify(payload, null, 2));
    } catch (error) {
        console.warn('[sfx-storage] localStorage write failed', error);
    }
}

function normalizeCustomPresetList(rawList) {
    if (!Array.isArray(rawList)) {
        return [];
    }
    const result = [];
    const usedIds = new Set(BUILTIN_SFX_PRESETS.map((preset) => preset.id));
    for (let i = 0; i < rawList.length; i += 1) {
        const row = normalizeCustomPresetEntry(rawList[i], i);
        if (!row || usedIds.has(row.id)) {
            continue;
        }
        usedIds.add(row.id);
        result.push(row);
    }
    return result;
}

function normalizeCustomPresetEntry(raw, index = 0) {
    if (!isPlainObject(raw)) {
        return null;
    }
    const safeName = sanitizeDisplayText(raw.name, `Custom SFX ${index + 1}`);
    const safeDescription = sanitizeDisplayText(raw.description, '');
    const id = sanitizePresetId(raw.id);
    const safeId = id && !isBuiltInSfxPresetId(id)
        ? id
        : `custom-${(index + 1).toString(36)}`;
    const defaults = normalizePresetParams(raw.defaults || raw.params, BUILTIN_SFX_PRESETS[0].defaults);
    const sample = normalizeCustomPresetSample(raw.sample);
    const createdAt = normalizeIsoTimestamp(raw.createdAt) || '';
    const updatedAt = normalizeIsoTimestamp(raw.updatedAt) || createdAt || '';
    return {
        id: safeId,
        name: safeName,
        description: safeDescription,
        defaults,
        sample,
        createdAt,
        updatedAt
    };
}

function applyPresetParamOverrides(preset, overrides, isCustom) {
    const base = isPlainObject(preset) ? preset : BUILTIN_SFX_PRESETS[0];
    const safeId = sanitizePresetId(base.id) || BUILTIN_SFX_PRESETS[0].id;
    const baseDefaults = normalizePresetParams(base.defaults, resolveBaseDefaultsForPresetId(safeId));
    const sourceOverrides = isPlainObject(overrides) ? overrides : {};
    const override = sourceOverrides[safeId];
    const defaults = isPlainObject(override)
        ? normalizePresetParams(override, baseDefaults)
        : baseDefaults;
    return {
        ...base,
        id: safeId,
        defaults,
        sample: normalizeCustomPresetSample(base?.sample),
        custom: !!isCustom
    };
}

function normalizeCustomPresetSample(rawSample) {
    if (!isPlainObject(rawSample)) {
        return null;
    }
    const dataUrl = `${rawSample.dataUrl || ''}`.trim();
    if (!dataUrl || !dataUrl.startsWith('data:audio/')) {
        return null;
    }
    const mimeType = `${rawSample.mimeType || ''}`.trim() || 'audio/wav';
    const fileName = sanitizeDisplayText(rawSample.fileName, 'sample.wav');
    const sourceLabel = sanitizeDisplayText(rawSample.sourceLabel, 'external sample');
    return {
        dataUrl,
        mimeType,
        fileName,
        sourceLabel
    };
}

function normalizeSfxPresetOverrides(rawMap) {
    const source = isPlainObject(rawMap) ? rawMap : {};
    const normalized = {};
    const validPresetIds = new Set([
        ...BUILTIN_SFX_PRESETS.map((preset) => preset.id),
        ...readCustomSfxPresets().map((preset) => preset.id)
    ]);
    for (const [rawPresetId, rawParams] of Object.entries(source)) {
        const presetId = sanitizePresetId(rawPresetId);
        if (!presetId || !validPresetIds.has(presetId)) {
            continue;
        }
        normalized[presetId] = normalizePresetParams(rawParams, resolveBaseDefaultsForPresetId(presetId));
    }
    return normalized;
}

function resolveBaseDefaultsForPresetId(presetId) {
    const id = sanitizePresetId(presetId);
    if (!id) {
        return BUILTIN_SFX_PRESETS[0].defaults;
    }
    const builtIn = BUILTIN_PRESET_BY_ID.get(id);
    if (builtIn) {
        return builtIn.defaults;
    }
    const custom = readCustomSfxPresets().find((preset) => preset.id === id);
    if (custom) {
        return custom.defaults;
    }
    return BUILTIN_SFX_PRESETS[0].defaults;
}

function normalizePresetParams(rawParams, fallbackParams) {
    const source = isPlainObject(rawParams) ? rawParams : {};
    const fallback = isPlainObject(fallbackParams) ? fallbackParams : BUILTIN_SFX_PRESETS[0].defaults;
    const normalized = {};
    for (const [key, schema] of Object.entries(SFX_PARAM_SCHEMA)) {
        const fallbackValue = Number(fallback[key]);
        const value = Number(source[key]);
        const safe = Number.isFinite(value) ? value : (Number.isFinite(fallbackValue) ? fallbackValue : schema.min);
        const clamped = clamp(safe, schema.min, schema.max);
        normalized[key] = schema.integer ? Math.round(clamped) : Number(clamped.toFixed(schema.digits));
    }
    return normalized;
}

function normalizeSkinSfxBindings(rawMap) {
    const source = isPlainObject(rawMap) ? rawMap : {};
    const validPresetIds = new Set(getSfxPresetCatalog().map((preset) => preset.id));
    const normalized = {};
    for (const [rawSkinId, rawPresetId] of Object.entries(source)) {
        const skinId = sanitizeSkinId(rawSkinId);
        const presetId = sanitizePresetId(rawPresetId);
        if (!skinId || !presetId || !validPresetIds.has(presetId)) {
            continue;
        }
        normalized[skinId] = presetId;
    }
    return normalized;
}

function normalizeGameSfxBindings(rawMap) {
    const source = isPlainObject(rawMap) ? rawMap : {};
    const validPresetIds = new Set(getSfxPresetCatalog().map((preset) => preset.id));
    const normalized = {};
    for (const [rawEventKey, rawPresetId] of Object.entries(source)) {
        const eventKey = sanitizeGameSfxEventKey(rawEventKey);
        const presetId = sanitizePresetId(rawPresetId);
        if (!eventKey || !presetId || !validPresetIds.has(presetId)) {
            continue;
        }
        normalized[eventKey] = presetId;
    }
    return normalized;
}

function buildUniqueCustomPresetId(name, usedIdSet) {
    const slug = sanitizeSlug(name) || 'sound';
    const base = `custom-${slug}`;
    let candidate = base;
    let index = 2;
    while (usedIdSet.has(candidate) || isBuiltInSfxPresetId(candidate)) {
        candidate = `${base}-${index}`;
        index += 1;
    }
    return candidate;
}

function sanitizePresetId(rawId) {
    return sanitizeSlug(rawId);
}

function sanitizeSkinId(rawId) {
    return sanitizeSlug(rawId);
}

function sanitizeGameSfxEventKey(rawKey) {
    const key = `${rawKey || ''}`.trim();
    if (!key) return '';
    if (Object.prototype.hasOwnProperty.call(DEFAULT_GAME_SFX_BINDINGS, key)) {
        return key;
    }
    return '';
}

function sanitizeSlug(raw) {
    return `${raw || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function sanitizeDisplayText(raw, fallback = '') {
    const cleaned = `${raw || ''}`.replace(/\s+/g, ' ').trim();
    return cleaned || fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeIsoTimestamp(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const text = value.trim();
    if (!text) {
        return '';
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }
    return parsed.toISOString();
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

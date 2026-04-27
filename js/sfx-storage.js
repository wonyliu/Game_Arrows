const STORAGE_API_BASE = '/api/storage';

export const SFX_CUSTOM_PRESETS_STORAGE_KEY = 'arrowClear_sfxCustomPresets_v1';
export const SKIN_SFX_BINDINGS_STORAGE_KEY = 'arrowClear_skinSfxPresetBySkin_v1';
export const SFX_LAB_STATE_STORAGE_KEY = 'arrowClear_sfxLabState_v2';
export const SFX_PRESET_OVERRIDES_STORAGE_KEY = 'arrowClear_sfxPresetOverrides_v1';
export const GAME_SFX_BINDINGS_STORAGE_KEY = 'arrowClear_gameSfxPresetByEvent_v1';
export const AUDIO_LIBRARY_STORAGE_KEY = 'arrowClear_audioLibrary_v1';

const SFX_CUSTOM_PRESETS_FILE = 'sfx-custom-presets-v1';
const SKIN_SFX_BINDINGS_FILE = 'skin-sfx-bindings-v1';
const SFX_LAB_STATE_FILE = 'sfx-lab-state-v1';
const SFX_PRESET_OVERRIDES_FILE = 'sfx-preset-overrides-v1';
const GAME_SFX_BINDINGS_FILE = 'game-sfx-bindings-v1';
const AUDIO_LIBRARY_FILE = 'audio-library-v1';

const DEFAULT_GAME_SFX_BINDINGS = Object.freeze({
    click: 'syrup-pop',
    coin: 'syrup-pop',
    checkinCoinTrail: 'syrup-pop',
    error: 'fail-plop',
    levelComplete: 'candy-crunch',
    gameOver: 'fail-plop'
});

const DEFAULT_GAME_SFX_AUDIO_ITEM_FALLBACKS = Object.freeze({
    click: 'audio-syrup-pop',
    coin: 'audio-coinflic6-mp3',
    checkinCoinTrail: 'audio-syrup-pop',
    error: 'audio-fail-plop',
    levelComplete: 'audio-crowd-cheer-7',
    gameOver: 'audio-fail-plop'
});

const LEGACY_GAME_SFX_AUDIO_LIBRARY_SEEDS = Object.freeze([
    Object.freeze({
        id: 'audio-coinflic6-mp3',
        name: 'Coin Flic (Legacy)',
        description: 'Legacy coin gain SFX.',
        fallbackPresetId: 'syrup-pop',
        keywords: Object.freeze(['coin', 'legacy', 'sfx'])
    }),
    Object.freeze({
        id: 'audio-crowd-cheer-7',
        name: 'Crowd Cheer (Legacy)',
        description: 'Legacy level-complete cheer SFX.',
        fallbackPresetId: 'candy-crunch',
        keywords: Object.freeze(['crowd', 'cheer', 'legacy', 'sfx'])
    })
]);

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
let audioLibraryMemoryCache = null;

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

export function readAudioLibrary() {
    if (Array.isArray(audioLibraryMemoryCache)) {
        const normalizedCached = normalizeAudioLibraryList(audioLibraryMemoryCache);
        const withSeeds = applyLegacyGameSfxAudioLibrarySeeds(normalizedCached);
        audioLibraryMemoryCache = withSeeds;
        return withSeeds;
    }
    const data = readLocalJson(AUDIO_LIBRARY_STORAGE_KEY, []);
    const rows = Array.isArray(data)
        ? data
        : (Array.isArray(data?.items) ? data.items : []);
    const normalized = normalizeAudioLibraryList(rows);
    const withSeeds = applyLegacyGameSfxAudioLibrarySeeds(normalized);
    audioLibraryMemoryCache = withSeeds;
    return withSeeds;
}

export function getAudioLibraryCatalog(options = {}) {
    const audioType = normalizeAudioLibraryType(options?.audioType || '');
    const rows = readAudioLibrary();
    if (!audioType) {
        return rows;
    }
    return rows.filter((item) => item.audioType === audioType);
}

export function writeAudioLibrary(items) {
    const normalized = normalizeAudioLibraryList(items);
    audioLibraryMemoryCache = normalized;
    if (canUseApiStorage()) {
        removeLocalJson(AUDIO_LIBRARY_STORAGE_KEY);
    } else {
        writeLocalJson(AUDIO_LIBRARY_STORAGE_KEY, normalized);
    }
    void persistJsonToServer(AUDIO_LIBRARY_FILE, { items: normalized });
    return normalized;
}

export function planAudioLibraryItemIdentity(payload = {}, options = {}) {
    const current = readAudioLibrary();
    const requestedId = sanitizeSlug(payload?.id);
    const enforceUpdateId = sanitizeSlug(options?.enforceUpdateId);
    const originKey = sanitizeDisplayText(payload?.originKey, '');

    let existingIndex = -1;
    if (enforceUpdateId) {
        existingIndex = current.findIndex((item) => item.id === enforceUpdateId);
    } else if (requestedId) {
        existingIndex = current.findIndex((item) => item.id === requestedId);
    } else if (originKey) {
        existingIndex = current.findIndex((item) => item.originKey === originKey);
    }

    const usedIds = new Set(current.map((item) => item.id));
    let nextId = existingIndex >= 0
        ? current[existingIndex].id
        : (requestedId || '');
    if (!nextId) {
        nextId = buildUniqueAudioLibraryId(payload?.name || payload?.sample?.fileName || 'audio-item', usedIds);
    }

    return {
        id: nextId,
        existing: existingIndex >= 0 ? current[existingIndex] : null
    };
}

export function getAudioLibraryItemById(itemId) {
    const id = sanitizeSlug(itemId);
    if (!id) {
        return null;
    }
    return readAudioLibrary().find((item) => item.id === id) || null;
}

export function upsertAudioLibraryItem(payload = {}, options = {}) {
    const current = readAudioLibrary();
    const nowIso = new Date().toISOString();
    const requestedId = sanitizeSlug(payload?.id);
    const enforceUpdateId = sanitizeSlug(options?.enforceUpdateId);
    const originKey = sanitizeDisplayText(payload?.originKey, '');

    let existingIndex = -1;
    if (enforceUpdateId) {
        existingIndex = current.findIndex((item) => item.id === enforceUpdateId);
    } else if (requestedId) {
        existingIndex = current.findIndex((item) => item.id === requestedId);
    } else if (originKey) {
        existingIndex = current.findIndex((item) => item.originKey === originKey);
    }

    const usedIds = new Set(current.map((item) => item.id));
    let nextId = existingIndex >= 0
        ? current[existingIndex].id
        : (requestedId || '');
    if (!nextId) {
        nextId = buildUniqueAudioLibraryId(payload?.name || payload?.sample?.fileName || 'audio-item', usedIds);
    }

    const nextEntry = normalizeAudioLibraryItem({
        ...(existingIndex >= 0 ? current[existingIndex] : {}),
        ...payload,
        id: nextId,
        createdAt: existingIndex >= 0 ? current[existingIndex].createdAt : nowIso,
        updatedAt: nowIso
    }, existingIndex >= 0 ? existingIndex : current.length);
    if (!nextEntry) {
        return null;
    }

    const next = [...current];
    if (existingIndex >= 0) {
        next[existingIndex] = nextEntry;
    } else {
        next.push(nextEntry);
    }

    writeAudioLibrary(next);
    return nextEntry;
}

export function deleteAudioLibraryItem(itemId) {
    const id = sanitizeSlug(itemId);
    if (!id) {
        return false;
    }
    const current = readAudioLibrary();
    const next = current.filter((item) => item.id !== id);
    if (next.length === current.length) {
        return false;
    }
    writeAudioLibrary(next);
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

export function getSkinSfxAudioItemId(skinId, fallbackItemId = '') {
    const id = sanitizeSkinId(skinId);
    const validAudioIds = new Set(getAudioLibraryCatalog({ audioType: 'sfx' }).map((item) => item.id));
    const fallback = sanitizeSlug(fallbackItemId);
    if (!id) {
        return fallback && validAudioIds.has(fallback) ? fallback : '';
    }
    const bindings = readSkinSfxBindings();
    const boundId = resolveLegacySfxBindingToAudioItemId(bindings[id], validAudioIds);
    if (boundId) {
        return boundId;
    }
    return fallback && validAudioIds.has(fallback) ? fallback : '';
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

export function setSkinSfxAudioItemId(skinId, itemId) {
    const id = sanitizeSkinId(skinId);
    if (!id) {
        return readSkinSfxBindings();
    }
    const audioId = sanitizeSlug(itemId);
    const validAudioIds = new Set(getAudioLibraryCatalog({ audioType: 'sfx' }).map((item) => item.id));
    const bindings = readSkinSfxBindings();
    if (!audioId || !validAudioIds.has(audioId)) {
        delete bindings[id];
        return writeSkinSfxBindings(bindings);
    }
    bindings[id] = audioId;
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
    const bindingPresetId = resolveGameSfxBindingPresetId(bindings[key]);
    const defaultPresetId = DEFAULT_GAME_SFX_BINDINGS[key] || fallbackPresetId;
    return getSfxPresetById(bindingPresetId || defaultPresetId).id;
}

export function getGameSfxBindingOptions(eventKey, fallbackItemId = '') {
    const key = sanitizeGameSfxEventKey(eventKey);
    if (!key) {
        return [];
    }
    const validAudioIds = new Set(getAudioLibraryCatalog({ audioType: 'sfx' }).map((item) => item.id));
    const fallback = sanitizeSlug(fallbackItemId);
    const bindings = readGameSfxBindings();
    const rawBinding = bindings[key];
    const boundOptions = resolveGameSfxBindingOptions(rawBinding, validAudioIds);
    if (boundOptions.length > 0) {
        return boundOptions;
    }
    if (resolveGameSfxBindingPresetId(rawBinding)) {
        return [];
    }
    const defaultOptions = resolveDefaultGameSfxBindingOptions(key, validAudioIds);
    if (defaultOptions.length > 0) {
        return defaultOptions;
    }
    if (fallback && validAudioIds.has(fallback)) {
        return [{ audioItemId: fallback, loop: false }];
    }
    return [];
}

export function getGameSfxAudioItemId(eventKey, fallbackItemId = '') {
    const options = getGameSfxBindingOptions(eventKey, fallbackItemId);
    return options[0]?.audioItemId || '';
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

export function setGameSfxBindingOptions(eventKey, options) {
    const key = sanitizeGameSfxEventKey(eventKey);
    if (!key) {
        return readGameSfxBindings();
    }
    const validAudioIds = new Set(getAudioLibraryCatalog({ audioType: 'sfx' }).map((item) => item.id));
    const normalizedOptions = normalizeGameSfxOptionList(options, validAudioIds);
    const bindings = readGameSfxBindings();
    if (normalizedOptions.length <= 0) {
        delete bindings[key];
        return writeGameSfxBindings(bindings);
    }
    bindings[key] = { items: normalizedOptions };
    return writeGameSfxBindings(bindings);
}

export function setGameSfxAudioItemId(eventKey, itemId) {
    const key = sanitizeGameSfxEventKey(eventKey);
    if (!key) {
        return readGameSfxBindings();
    }
    const audioId = sanitizeSlug(itemId);
    const validAudioIds = new Set(getAudioLibraryCatalog({ audioType: 'sfx' }).map((item) => item.id));
    if (!audioId || !validAudioIds.has(audioId)) {
        return setGameSfxBindingOptions(key, []);
    }
    return setGameSfxBindingOptions(key, [{ audioItemId: audioId, loop: false }]);
}

async function hydrateSfxStorageFromServer() {
    if (!canUseApiStorage()) {
        return;
    }

    const localSkinBindingPayload = readLocalJson(SKIN_SFX_BINDINGS_STORAGE_KEY, {});
    const localGameSfxPayload = readLocalJson(GAME_SFX_BINDINGS_STORAGE_KEY, {});
    const [customPayload, bindingPayload, labPayload, overridePayload, gameSfxPayload, audioLibraryPayload] = await Promise.all([
        fetchJsonFromServer(SFX_CUSTOM_PRESETS_FILE),
        fetchJsonFromServer(SKIN_SFX_BINDINGS_FILE),
        fetchJsonFromServer(SFX_LAB_STATE_FILE),
        fetchJsonFromServer(SFX_PRESET_OVERRIDES_FILE),
        fetchJsonFromServer(GAME_SFX_BINDINGS_FILE),
        fetchJsonFromServer(AUDIO_LIBRARY_FILE)
    ]);

    if (isPlainObject(customPayload) || Array.isArray(customPayload)) {
        const rows = Array.isArray(customPayload)
            ? customPayload
            : (Array.isArray(customPayload.presets) ? customPayload.presets : []);
        writeLocalJson(SFX_CUSTOM_PRESETS_STORAGE_KEY, normalizeCustomPresetList(rows));
    }

    if (isPlainObject(audioLibraryPayload) || Array.isArray(audioLibraryPayload)) {
        const rows = Array.isArray(audioLibraryPayload)
            ? audioLibraryPayload
            : (Array.isArray(audioLibraryPayload.items) ? audioLibraryPayload.items : []);
        const normalized = normalizeAudioLibraryList(rows);
        audioLibraryMemoryCache = normalized;
        removeLocalJson(AUDIO_LIBRARY_STORAGE_KEY);
    }

    if (isPlainObject(bindingPayload) || isPlainObject(localSkinBindingPayload)) {
        const normalizedServer = normalizeSkinSfxBindings(bindingPayload);
        const normalizedLocal = normalizeSkinSfxBindings(localSkinBindingPayload);
        const hasServerBindings = isPlainObject(bindingPayload);
        const normalizedMerged = hasServerBindings
            ? normalizedServer
            : normalizedLocal;
        writeLocalJson(SKIN_SFX_BINDINGS_STORAGE_KEY, normalizedMerged);
        if (canUseApiStorage() && !hasServerBindings && JSON.stringify(normalizedMerged) !== JSON.stringify(normalizedServer)) {
            void persistJsonToServer(SKIN_SFX_BINDINGS_FILE, normalizedMerged);
        }
    }

    if (isPlainObject(labPayload)) {
        writeLocalJson(SFX_LAB_STATE_STORAGE_KEY, normalizeRecipe(labPayload));
    }

    if (isPlainObject(overridePayload)) {
        writeLocalJson(SFX_PRESET_OVERRIDES_STORAGE_KEY, normalizeSfxPresetOverrides(overridePayload));
    }
    if (isPlainObject(gameSfxPayload) || isPlainObject(localGameSfxPayload)) {
        const normalizedServer = normalizeGameSfxBindings(gameSfxPayload);
        const normalizedLocal = normalizeGameSfxBindings(localGameSfxPayload);
        const hasServerBindings = isPlainObject(gameSfxPayload);
        const normalizedMerged = hasServerBindings
            ? normalizedServer
            : normalizedLocal;
        writeLocalJson(GAME_SFX_BINDINGS_STORAGE_KEY, normalizedMerged);
        if (canUseApiStorage() && !hasServerBindings && JSON.stringify(normalizedMerged) !== JSON.stringify(normalizedServer)) {
            void persistJsonToServer(GAME_SFX_BINDINGS_FILE, normalizedMerged);
        }
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

function removeLocalJson(storageKey) {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.removeItem(storageKey);
    } catch {
        // ignore
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

function readSampleUrlValue(rawValue) {
    if (typeof rawValue === 'string') {
        const text = rawValue.trim();
        if (!text || text === '[object Object]') {
            return '';
        }
        return text;
    }
    if (isPlainObject(rawValue)) {
        const nested = rawValue.url || rawValue.src || rawValue.path || rawValue.href || '';
        if (typeof nested !== 'string') {
            return '';
        }
        const text = nested.trim();
        if (!text || text === '[object Object]') {
            return '';
        }
        return text;
    }
    return '';
}

function normalizeCustomPresetSample(rawSample) {
    if (!isPlainObject(rawSample)) {
        return null;
    }
    const dataUrl = `${rawSample.dataUrl || ''}`.trim();
    const url = readSampleUrlValue(rawSample.url) || readSampleUrlValue(rawSample.webUrl);
    const refKind = `${rawSample.refKind || rawSample.refType || ''}`.trim().toLowerCase();
    const refId = sanitizeDisplayText(rawSample.refId, '');
    if (!dataUrl.startsWith('data:audio/') && !url && !(refKind === 'preset-sample' && refId)) {
        return null;
    }
    const mimeType = `${rawSample.mimeType || ''}`.trim() || 'audio/wav';
    const fileName = sanitizeDisplayText(rawSample.fileName, 'sample.wav');
    const sourceLabel = sanitizeDisplayText(rawSample.sourceLabel, 'external sample');
    const rawSizeBytes = Number(rawSample.sizeBytes || rawSample.fileSizeBytes || 0);
    const sizeBytes = Number.isFinite(rawSizeBytes) && rawSizeBytes > 0 ? Math.round(rawSizeBytes) : 0;
    return {
        dataUrl: dataUrl.startsWith('data:audio/') ? dataUrl : '',
        url,
        refKind: refKind === 'preset-sample' && refId ? 'preset-sample' : '',
        refId: refKind === 'preset-sample' && refId ? refId : '',
        mimeType,
        fileName,
        sourceLabel,
        sizeBytes
    };
}

function normalizeAudioLibraryList(rawList) {
    if (!Array.isArray(rawList)) {
        return [];
    }
    const result = [];
    const usedIds = new Set();
    for (let index = 0; index < rawList.length; index += 1) {
        const row = normalizeAudioLibraryItem(rawList[index], index);
        if (!row || usedIds.has(row.id)) {
            continue;
        }
        usedIds.add(row.id);
        result.push(row);
    }
    return result;
}

function normalizeAudioLibraryItem(raw, index = 0) {
    if (!isPlainObject(raw)) {
        return null;
    }
    const sample = normalizeCustomPresetSample(raw.sample);
    if (!sample) {
        return null;
    }
    const fallbackName = stripFileExtension(sample.fileName || `Audio Item ${index + 1}`) || `Audio Item ${index + 1}`;
    const id = sanitizeSlug(raw.id) || `audio-item-${(index + 1).toString(36)}`;
    const name = sanitizeDisplayText(raw.name, fallbackName);
    const description = sanitizeDisplayText(raw.description, '');
    const sourceKind = normalizeAudioSourceKind(raw.sourceKind);
    const audioType = normalizeAudioLibraryType(raw.audioType || raw.type || sourceKind);
    const sourceLabel = sanitizeDisplayText(raw.sourceLabel || sample.sourceLabel, sample.sourceLabel);
    const originKey = sanitizeDisplayText(raw.originKey, '');
    const keywords = normalizeAudioLibraryKeywords(raw.keywords);
    const params = audioType === 'sfx'
        ? normalizePresetParams(raw.params, BUILTIN_SFX_PRESETS[0].defaults)
        : null;
    const rawDuration = Number(raw.durationSeconds || raw.duration || 0);
    const durationSeconds = clamp(Number.isFinite(rawDuration) ? rawDuration : 0, 0, 600);
    const rawVolume = Number(raw.volume || 1);
    const volume = clamp(Number.isFinite(rawVolume) ? rawVolume : 1, 0, 2);
    const trimStart = durationSeconds > 0
        ? clamp(Number.isFinite(Number(raw.trimStart)) ? Number(raw.trimStart) : 0, 0, Math.max(0, durationSeconds - 0.01))
        : 0;
    const trimEnd = durationSeconds > 0
        ? clamp(Number.isFinite(Number(raw.trimEnd)) ? Number(raw.trimEnd) : durationSeconds, trimStart + 0.01, durationSeconds)
        : 0;
    const createdAt = normalizeIsoTimestamp(raw.createdAt) || '';
    const updatedAt = normalizeIsoTimestamp(raw.updatedAt) || createdAt || '';
    const item = {
        id,
        name,
        description,
        audioType,
        sourceKind,
        sourceLabel,
        originKey,
        keywords,
        params,
        durationSeconds,
        volume: Number(volume.toFixed(2)),
        trimStart: Number(trimStart.toFixed(2)),
        trimEnd: Number(trimEnd.toFixed(2)),
        sample,
        createdAt,
        updatedAt
    };
    return compactProjectManagedAudioItem(item);
}

function compactProjectManagedAudioItem(item) {
    if (!isPlainObject(item) || !isPlainObject(item.sample)) {
        return item;
    }
    if (item.sourceKind === 'bgm') {
        const sourceUrl = readSampleUrlValue(item.sample.url)
            || readSampleUrlValue(extractAudioLibraryOriginUrl(item.originKey, 'bgm:'));
        if (!sourceUrl) {
            return item;
        }
        return {
            ...item,
            sample: {
                dataUrl: '',
                url: sourceUrl,
                refKind: '',
                refId: '',
                mimeType: item.sample.mimeType || 'audio/mpeg',
                fileName: item.sample.fileName,
                sourceLabel: item.sample.sourceLabel,
                sizeBytes: item.sample.sizeBytes || 0
            }
        };
    }
    if (item.sourceKind === 'preset-sample') {
        const refId = `${item.sample.refId || extractAudioLibraryOriginUrl(item.originKey, 'preset-sample:')}`.trim();
        if (!refId) {
            return item;
        }
        return {
            ...item,
            sample: {
                dataUrl: '',
                url: '',
                refKind: 'preset-sample',
                refId,
                mimeType: item.sample.mimeType || 'audio/wav',
                fileName: item.sample.fileName,
                sourceLabel: item.sample.sourceLabel,
                sizeBytes: item.sample.sizeBytes || 0
            }
        };
    }
    return item;
}

function extractAudioLibraryOriginUrl(originKey, prefix) {
    const text = `${originKey || ''}`.trim();
    return text.startsWith(prefix) ? text.slice(prefix.length) : '';
}

function normalizeAudioLibraryKeywords(rawKeywords) {
    if (!Array.isArray(rawKeywords)) {
        if (typeof rawKeywords === 'string') {
            rawKeywords = rawKeywords.split(/[,\n]/g);
        } else {
            return [];
        }
    }
    const out = [];
    const seen = new Set();
    for (const row of rawKeywords) {
        const keyword = sanitizeDisplayText(row, '').toLowerCase();
        if (!keyword || seen.has(keyword)) {
            continue;
        }
        seen.add(keyword);
        out.push(keyword.slice(0, 40));
        if (out.length >= 24) {
            break;
        }
    }
    return out;
}

function normalizeAudioSourceKind(rawKind) {
    const kind = `${rawKind || ''}`.trim().toLowerCase();
    if (['freesound', 'upload', 'stable-audio', 'manual', 'bgm', 'preset-sample', 'preset-render'].includes(kind)) {
        return kind;
    }
    return 'manual';
}

function normalizeAudioLibraryType(rawType) {
    const type = `${rawType || ''}`.trim().toLowerCase();
    if (type === 'music' || type === 'sfx') {
        return type;
    }
    if (type === 'bgm') {
        return 'music';
    }
    return 'sfx';
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
    const validAudioIds = new Set(getAudioLibraryCatalog({ audioType: 'sfx' }).map((item) => item.id));
    const validPresetIds = new Set(getSfxPresetCatalog().map((preset) => preset.id));
    const normalized = {};
    for (const [rawSkinId, rawBindingId] of Object.entries(source)) {
        const skinId = sanitizeSkinId(rawSkinId);
        if (!skinId) {
            continue;
        }
        const audioItemId = sanitizeSlug(rawBindingId);
        if (audioItemId && validAudioIds.has(audioItemId)) {
            normalized[skinId] = audioItemId;
            continue;
        }
        const presetId = sanitizePresetId(rawBindingId);
        if (presetId && validPresetIds.has(presetId)) {
            normalized[skinId] = presetId;
        }
    }
    return normalized;
}

function normalizeGameSfxBindings(rawMap) {
    const source = isPlainObject(rawMap) ? rawMap : {};
    const validAudioIds = new Set(getAudioLibraryCatalog({ audioType: 'sfx' }).map((item) => item.id));
    const validPresetIds = new Set(getSfxPresetCatalog().map((preset) => preset.id));
    const normalized = {};
    for (const eventKey of Object.keys(DEFAULT_GAME_SFX_BINDINGS)) {
        const rawBinding = source[eventKey];
        const options = resolveGameSfxBindingOptions(rawBinding, validAudioIds);
        if (options.length > 0) {
            normalized[eventKey] = { items: options };
            continue;
        }
        const presetId = resolveGameSfxBindingPresetId(rawBinding, validPresetIds);
        if (presetId) {
            normalized[eventKey] = presetId;
            continue;
        }
        const defaultOptions = resolveDefaultGameSfxBindingOptions(eventKey, validAudioIds);
        if (defaultOptions.length > 0) {
            normalized[eventKey] = { items: defaultOptions };
            continue;
        }
        const defaultPresetId = sanitizePresetId(DEFAULT_GAME_SFX_BINDINGS[eventKey] || '');
        if (defaultPresetId && validPresetIds.has(defaultPresetId)) {
            normalized[eventKey] = defaultPresetId;
        }
    }
    return normalized;
}

function resolveDefaultGameSfxBindingOptions(eventKey, validAudioIds = new Set()) {
    const preferredAudioItemId = sanitizeSlug(DEFAULT_GAME_SFX_AUDIO_ITEM_FALLBACKS[eventKey] || '');
    if (preferredAudioItemId && validAudioIds.has(preferredAudioItemId)) {
        return [{ audioItemId: preferredAudioItemId, loop: false }];
    }
    const defaultBinding = DEFAULT_GAME_SFX_BINDINGS[eventKey] || '';
    const defaultItemId = resolveLegacySfxBindingToAudioItemId(defaultBinding, validAudioIds);
    if (defaultItemId) {
        return [{ audioItemId: defaultItemId, loop: false }];
    }
    return [];
}

function applyLegacyGameSfxAudioLibrarySeeds(rows) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const existingIds = new Set(sourceRows.map((row) => sanitizeSlug(row?.id)));
    const seedRows = [];
    for (const seed of LEGACY_GAME_SFX_AUDIO_LIBRARY_SEEDS) {
        const seedId = sanitizeSlug(seed?.id);
        if (!seedId || existingIds.has(seedId)) {
            continue;
        }
        const fallbackPreset = getSfxPresetById(seed?.fallbackPresetId || BUILTIN_SFX_PRESETS[0].id);
        seedRows.push({
            id: seedId,
            name: sanitizeDisplayText(seed?.name, seedId),
            description: sanitizeDisplayText(seed?.description, ''),
            audioType: 'sfx',
            sourceKind: 'manual',
            sourceLabel: 'legacy game sfx',
            originKey: `legacy-game-sfx:${seedId}`,
            keywords: Array.isArray(seed?.keywords) ? seed.keywords : ['legacy', 'sfx'],
            params: normalizePresetParams(fallbackPreset.defaults, fallbackPreset.defaults),
            durationSeconds: 0,
            volume: 1,
            trimStart: 0,
            trimEnd: 0,
            sample: {
                dataUrl: '',
                url: `/assets/audio/sfx/${seedId}.wav`,
                refKind: '',
                refId: '',
                mimeType: 'audio/wav',
                fileName: `${seedId}.wav`,
                sourceLabel: 'legacy game sfx'
            }
        });
    }
    if (seedRows.length <= 0) {
        return sourceRows;
    }
    return normalizeAudioLibraryList([...sourceRows, ...seedRows]);
}

function resolveGameSfxBindingPresetId(rawBinding, validPresetIds = null) {
    const validSet = validPresetIds instanceof Set
        ? validPresetIds
        : new Set(getSfxPresetCatalog().map((preset) => preset.id));
    const rawValue = isPlainObject(rawBinding)
        ? (rawBinding.presetId || rawBinding.legacyPresetId || rawBinding.bindingId || '')
        : rawBinding;
    const presetId = sanitizePresetId(rawValue);
    if (!presetId || !validSet.has(presetId)) {
        return '';
    }
    return presetId;
}

function resolveGameSfxBindingOptions(rawBinding, validAudioIds = new Set()) {
    let rows = [];
    if (Array.isArray(rawBinding)) {
        rows = rawBinding;
    } else if (isPlainObject(rawBinding) && Array.isArray(rawBinding.items)) {
        rows = rawBinding.items;
    } else {
        rows = [rawBinding];
    }
    const normalizedOptions = normalizeGameSfxOptionList(rows, validAudioIds);
    if (normalizedOptions.length > 0) {
        return normalizedOptions;
    }
    const boundId = resolveLegacySfxBindingToAudioItemId(
        isPlainObject(rawBinding) ? (rawBinding.presetId || rawBinding.legacyPresetId || '') : rawBinding,
        validAudioIds
    );
    return boundId ? [{ audioItemId: boundId, loop: false }] : [];
}

function normalizeGameSfxOptionList(rawOptions, validAudioIds = new Set()) {
    const rows = Array.isArray(rawOptions) ? rawOptions : [rawOptions];
    const out = [];
    const seen = new Set();
    for (const rawOption of rows) {
        const option = normalizeGameSfxOption(rawOption, validAudioIds);
        if (!option) {
            continue;
        }
        const signature = `${option.audioItemId}:${option.loop ? 1 : 0}`;
        if (seen.has(signature)) {
            continue;
        }
        seen.add(signature);
        out.push(option);
    }
    return out;
}

function normalizeGameSfxOption(rawOption, validAudioIds = new Set()) {
    const rawAudioId = isPlainObject(rawOption)
        ? (rawOption.audioItemId || rawOption.itemId || rawOption.audioId || rawOption.id || '')
        : rawOption;
    const audioItemId = sanitizeSlug(rawAudioId);
    if (!audioItemId || !validAudioIds.has(audioItemId)) {
        return null;
    }
    return {
        audioItemId,
        loop: isPlainObject(rawOption) ? rawOption.loop === true : false
    };
}

function resolveLegacySfxBindingToAudioItemId(rawBindingId, validAudioIds = new Set()) {
    const audioItemId = sanitizeSlug(rawBindingId);
    if (audioItemId && validAudioIds.has(audioItemId)) {
        return audioItemId;
    }
    const presetId = sanitizePresetId(rawBindingId);
    if (!presetId) {
        return '';
    }
    const item = getAudioLibraryCatalog({ audioType: 'sfx' }).find((row) => (
        row.originKey === `preset-sample:${presetId}`
        || row.originKey === `preset-render:${presetId}`
    ));
    return item?.id || '';
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

function buildUniqueAudioLibraryId(name, usedIdSet) {
    const slug = sanitizeSlug(name) || 'audio';
    const base = `audio-${slug}`;
    let candidate = base;
    let index = 2;
    while (usedIdSet.has(candidate)) {
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

function stripFileExtension(fileName) {
    const text = `${fileName || ''}`.trim();
    const dotIndex = text.lastIndexOf('.');
    return dotIndex > 0 ? text.slice(0, dotIndex) : text;
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

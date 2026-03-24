import { Line } from './line.js?v=43';

const SAVED_LEVELS_KEY = 'arrowClear_savedLevels_v1';
const PREVIEW_LEVELS_KEY = 'arrowClear_previewLevels_v1';
const LEVEL_CATALOG_KEY = 'arrowClear_levelCatalog_v1';
const SAVED_LEVELS_FILE = 'saved-levels-v1';
const PREVIEW_LEVELS_FILE = 'preview-levels-v1';
const LEVEL_CATALOG_FILE = 'level-catalog-v1';
const STORAGE_API_BASE = '/api/storage';
const VALID_DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const MAX_LEVEL_DISPLAY_NAME_LENGTH = 28;
const MAX_ARROW_LENGTH = 999;
const DEFAULT_LEVEL_CATALOG = Object.freeze({
    normalCount: 100,
    rewardCount: 1
});

const DEFAULT_PLAYFIELD = {
    width: 430,
    height: 664
};

let savedLevelsCache = readMap(SAVED_LEVELS_KEY);
let previewLevelsCache = readMap(PREVIEW_LEVELS_KEY);
let levelCatalogCache = readCatalog(LEVEL_CATALOG_KEY);
let storageInitPromise = null;
let serverSyncWarned = false;

export function initLevelStorage() {
    if (storageInitPromise) {
        return storageInitPromise;
    }

    storageInitPromise = hydrateFromServer().catch((error) => {
        console.warn('[level-storage] init failed, fallback to browser storage', error);
    });

    return storageInitPromise;
}

export function deriveGridSize(dimensionMode, dimensionValue) {
    const value = clamp(Math.round(Number(dimensionValue) || 0), 4, 40);

    if (dimensionMode === 'cols') {
        return {
            gridCols: value,
            gridRows: clamp(Math.round(value * DEFAULT_PLAYFIELD.height / DEFAULT_PLAYFIELD.width), 6, 60)
        };
    }

    return {
        gridRows: value,
        gridCols: clamp(Math.round(value * DEFAULT_PLAYFIELD.width / DEFAULT_PLAYFIELD.height), 4, 40)
    };
}

export function buildStoredSettings(baseConfig, overrides = {}) {
    const rawDimensionMode = `${overrides.dimensionMode || 'rows'}`.toLowerCase();
    const dimensionMode = rawDimensionMode === 'cols' || rawDimensionMode === 'custom'
        ? rawDimensionMode
        : 'rows';
    const fallbackGridCols = clamp(Math.round(Number(baseConfig.gridCols) || 18), 4, 40);
    const fallbackGridRows = clamp(Math.round(Number(baseConfig.gridRows) || 26), 4, 40);
    const fallbackValue = dimensionMode === 'cols' ? fallbackGridCols : fallbackGridRows;
    const dimensionValue = clamp(Math.round(Number(overrides.dimensionValue ?? fallbackValue) || fallbackValue), 4, 40);
    const customGridCols = clamp(
        Math.round(Number(overrides.customGridCols ?? baseConfig.customGridCols ?? fallbackGridCols) || fallbackGridCols),
        4,
        40
    );
    const customGridRows = clamp(
        Math.round(Number(overrides.customGridRows ?? baseConfig.customGridRows ?? fallbackGridRows) || fallbackGridRows),
        4,
        40
    );
    const grid = dimensionMode === 'custom'
        ? { gridCols: customGridCols, gridRows: customGridRows }
        : deriveGridSize(dimensionMode, dimensionValue);
    const maxCells = Math.max(2, grid.gridCols * grid.gridRows);
    const maxLenUpperBound = Math.min(MAX_ARROW_LENGTH, maxCells);
    const minLen = clamp(Math.round(Number(overrides.minLen ?? baseConfig.minLen) || baseConfig.minLen), 2, 12);
    const maxLen = clamp(
        Math.round(Number(overrides.maxLen ?? baseConfig.maxLen) || baseConfig.maxLen),
        minLen,
        maxLenUpperBound
    );
    const timerSeconds = clamp(
        Math.round(Number(overrides.timerSeconds ?? baseConfig.timerSeconds) || 0),
        0,
        7200
    );
    const misclickPenaltySeconds = clamp(
        Math.round(Number(overrides.misclickPenaltySeconds ?? baseConfig.misclickPenaltySeconds ?? 1) || 0),
        0,
        120
    );
    const displayName = sanitizeLevelDisplayName(overrides.displayName ?? baseConfig.displayName ?? '');

    return {
        level: baseConfig.level,
        dimensionMode,
        dimensionValue: dimensionMode === 'custom' ? grid.gridRows : dimensionValue,
        customGridCols: grid.gridCols,
        customGridRows: grid.gridRows,
        gridCols: grid.gridCols,
        gridRows: grid.gridRows,
        minLen,
        maxLen,
        timerSeconds,
        misclickPenaltySeconds,
        displayName
    };
}

export function applyStoredSettings(baseConfig, storedSettings = null) {
    if (!storedSettings) {
        return {
            ...baseConfig,
            lineCount: estimateLineCount(baseConfig.gridCols, baseConfig.gridRows, baseConfig.minLen, baseConfig.maxLen)
        };
    }

    const settings = buildStoredSettings(baseConfig, storedSettings);
    return {
        ...baseConfig,
        ...settings,
        hasTimer: settings.timerSeconds > 0,
        timerSeconds: settings.timerSeconds,
        misclickPenaltySeconds: settings.misclickPenaltySeconds,
        lineCount: estimateLineCount(settings.gridCols, settings.gridRows, settings.minLen, settings.maxLen),
        fillRatio: 1,
        maxCellUsage: 1
    };
}

export function estimateLineCount(gridCols, gridRows, minLen, maxLen) {
    const totalCells = gridCols * gridRows;
    const averageLen = Math.max(2, (minLen + maxLen) / 2);
    return Math.max(1, Math.ceil(totalCells / averageLen));
}

export function serializeLevelData(config, lines, path = null) {
    return {
        version: 1,
        generatorVersion: 5,
        level: config.level,
        gridCols: config.gridCols,
        gridRows: config.gridRows,
        minLen: config.minLen,
        maxLen: config.maxLen,
        lineCount: lines.length,
        path,
        lines: lines.map((line) => ({
            id: line.id,
            direction: line.direction,
            color: line.color,
            zIndex: line.zIndex,
            cells: line.cells.map((cell) => ({ col: cell.col, row: cell.row }))
        }))
    };
}

export function deserializeLevelData(levelData) {
    if (!levelData || !Array.isArray(levelData.lines)) {
        return [];
    }

    return levelData.lines.map((item) => {
        const line = new Line(item.id, item.cells, item.direction, item.color);
        line.zIndex = item.zIndex ?? item.id;
        return line;
    });
}

export function getSavedLevelRecord(level) {
    return savedLevelsCache[String(level)] || null;
}

export function saveSavedLevelRecord(level, record) {
    savedLevelsCache = {
        ...savedLevelsCache,
        [String(level)]: record
    };
    writeMap(SAVED_LEVELS_KEY, savedLevelsCache);
    return persistMapToServer(SAVED_LEVELS_FILE, savedLevelsCache);
}

export function deleteSavedLevelRecord(level) {
    savedLevelsCache = { ...savedLevelsCache };
    delete savedLevelsCache[String(level)];
    writeMap(SAVED_LEVELS_KEY, savedLevelsCache);
    return persistMapToServer(SAVED_LEVELS_FILE, savedLevelsCache);
}

export function getPreviewLevelRecord(level) {
    return previewLevelsCache[String(level)] || null;
}

export function isStoredLevelRecordUsable(record) {
    if (!isPlainObject(record)) {
        return false;
    }
    return isStoredLevelDataUsable(record.data);
}

export function isStoredLevelDataUsable(levelData) {
    if (!isPlainObject(levelData)) {
        return false;
    }

    const gridCols = Number(levelData.gridCols);
    const gridRows = Number(levelData.gridRows);
    if (!Number.isInteger(gridCols) || !Number.isInteger(gridRows) || gridCols < 2 || gridRows < 2) {
        return false;
    }

    if (Number(levelData.generatorVersion || 0) < 5) {
        return false;
    }

    if (!Array.isArray(levelData.lines) || levelData.lines.length === 0) {
        return false;
    }

    for (const line of levelData.lines) {
        if (!isPlainObject(line)) {
            return false;
        }

        if (!VALID_DIRECTIONS.has(String(line.direction || ''))) {
            return false;
        }

        if (!Array.isArray(line.cells) || line.cells.length < 2) {
            return false;
        }

        for (const cell of line.cells) {
            if (!isPlainObject(cell)) {
                return false;
            }
            const col = Number(cell.col);
            const row = Number(cell.row);
            if (!Number.isInteger(col) || !Number.isInteger(row)) {
                return false;
            }
            if (col < 0 || col >= gridCols || row < 0 || row >= gridRows) {
                return false;
            }
        }
    }

    return true;
}

export function getMaxStoredLevel() {
    const keys = [
        ...Object.keys(savedLevelsCache || {}),
        ...Object.keys(previewLevelsCache || {})
    ];
    let maxLevel = 0;
    for (const key of keys) {
        const level = Number(key);
        if (Number.isFinite(level) && level > maxLevel) {
            maxLevel = level;
        }
    }
    return maxLevel;
}

export function getLevelCatalog() {
    return { ...levelCatalogCache };
}

export function saveLevelCatalog(catalog) {
    levelCatalogCache = normalizeLevelCatalog({
        ...(isPlainObject(catalog) ? catalog : {}),
        updatedAt: new Date().toISOString()
    });
    writeCatalog(LEVEL_CATALOG_KEY, levelCatalogCache);
    return persistMapToServer(LEVEL_CATALOG_FILE, levelCatalogCache);
}

export function savePreviewLevelRecord(level, record) {
    previewLevelsCache = {
        ...previewLevelsCache,
        [String(level)]: record
    };
    writeMap(PREVIEW_LEVELS_KEY, previewLevelsCache);
    return persistMapToServer(PREVIEW_LEVELS_FILE, previewLevelsCache);
}

export function deletePreviewLevelRecord(level) {
    previewLevelsCache = { ...previewLevelsCache };
    delete previewLevelsCache[String(level)];
    writeMap(PREVIEW_LEVELS_KEY, previewLevelsCache);
    return persistMapToServer(PREVIEW_LEVELS_FILE, previewLevelsCache);
}

async function hydrateFromServer() {
    const [savedRemote, previewRemote, catalogRemote] = await Promise.all([
        fetchMapFromServer(SAVED_LEVELS_FILE),
        fetchMapFromServer(PREVIEW_LEVELS_FILE),
        fetchMapFromServer(LEVEL_CATALOG_FILE)
    ]);

    if (savedRemote) {
        savedLevelsCache = mergeLevelMaps(savedRemote, savedLevelsCache);
        writeMap(SAVED_LEVELS_KEY, savedLevelsCache);
    }

    if (previewRemote) {
        previewLevelsCache = mergeLevelMaps(previewRemote, previewLevelsCache);
        writeMap(PREVIEW_LEVELS_KEY, previewLevelsCache);
    }

    if (catalogRemote) {
        levelCatalogCache = mergeCatalog(catalogRemote, levelCatalogCache);
        writeCatalog(LEVEL_CATALOG_KEY, levelCatalogCache);
    }
}

async function fetchMapFromServer(name) {
    if (!canUseFetchStorage()) {
        return null;
    }

    if (canUseApiStorage()) {
        const serverData = await tryFetchMap(`${STORAGE_API_BASE}/${name}`);
        if (serverData) {
            return serverData;
        }
    }

    // Static fallback for environments without storage API.
    const staticData = await tryFetchMap(resolveStaticStorageUrl(name));
    if (staticData) {
        return staticData;
    }

    if (canUseApiStorage()) {
        warnServerUnavailable(new Error(`storage fetch failed for ${name}`));
    }
    return null;
}

async function persistMapToServer(name, mapValue) {
    if (!canUseApiStorage()) {
        return false;
    }

    try {
        const response = await fetch(`${STORAGE_API_BASE}/${name}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mapValue)
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
    console.warn('[level-storage] server sync unavailable, fallback to browser storage only', error);
}

async function tryFetchMap(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store'
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return isPlainObject(data) ? data : {};
    } catch {
        return null;
    }
}

function readMap(key) {
    if (typeof localStorage === 'undefined') {
        return {};
    }

    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}');
        return isPlainObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function writeMap(key, value) {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('[level-storage] failed to write browser storage', error);
    }
}

function readCatalog(key) {
    if (typeof localStorage === 'undefined') {
        return normalizeLevelCatalog(null);
    }

    try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        return normalizeLevelCatalog(parsed);
    } catch {
        return normalizeLevelCatalog(null);
    }
}

function writeCatalog(key, value) {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(key, JSON.stringify(normalizeLevelCatalog(value)));
    } catch (error) {
        console.warn('[level-storage] failed to write level catalog', error);
    }
}

function canUseFetchStorage() {
    return typeof window !== 'undefined' && typeof fetch === 'function';
}

function canUseApiStorage() {
    if (!canUseFetchStorage()) {
        return false;
    }

    const host = (window.location?.hostname || '').toLowerCase();
    if (!host) {
        return false;
    }

    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
        return true;
    }

    if (isPrivateIpv4Host(host)) {
        return true;
    }

    return false;
}

function resolveStaticStorageUrl(name) {
    try {
        return new URL(`../.local-data/${name}.json`, import.meta.url).toString();
    } catch {
        return `./.local-data/${name}.json`;
    }
}

function isPrivateIpv4Host(host) {
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

function mergeLevelMaps(remoteMap, localMap) {
    const merged = isPlainObject(remoteMap) ? { ...remoteMap } : {};
    const local = isPlainObject(localMap) ? localMap : {};

    for (const [key, localRecord] of Object.entries(local)) {
        const remoteRecord = merged[key];
        if (!isPlainObject(remoteRecord)) {
            merged[key] = localRecord;
            continue;
        }

        const localTs = parseUpdatedAtMs(localRecord?.updatedAt);
        const remoteTs = parseUpdatedAtMs(remoteRecord?.updatedAt);

        // Prefer newer record; if timestamps are unavailable or equal, keep local to avoid
        // losing unsynced admin edits after reload.
        if (localTs >= remoteTs) {
            merged[key] = localRecord;
        }
    }

    return merged;
}

function mergeCatalog(remoteCatalog, localCatalog) {
    const remote = normalizeLevelCatalog(remoteCatalog);
    const local = normalizeLevelCatalog(localCatalog);
    const localTs = parseUpdatedAtMs(local.updatedAt);
    const remoteTs = parseUpdatedAtMs(remote.updatedAt);
    return localTs >= remoteTs ? local : remote;
}

function parseUpdatedAtMs(value) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : 0;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeLevelDisplayName(value) {
    const text = `${value ?? ''}`.trim();
    if (!text) {
        return '';
    }
    return text.slice(0, MAX_LEVEL_DISPLAY_NAME_LENGTH);
}

function normalizeLevelCatalog(catalog) {
    const value = isPlainObject(catalog) ? catalog : {};
    const normalCount = clamp(
        Math.round(Number(value.normalCount ?? DEFAULT_LEVEL_CATALOG.normalCount) || DEFAULT_LEVEL_CATALOG.normalCount),
        1,
        1000
    );
    const rewardCount = clamp(
        Math.round(Number(value.rewardCount ?? DEFAULT_LEVEL_CATALOG.rewardCount) || 0),
        0,
        200
    );
    const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : '';
    return { normalCount, rewardCount, updatedAt };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}



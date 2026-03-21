import { Line } from './line.js?v=22';

const SAVED_LEVELS_KEY = 'arrowClear_savedLevels_v1';
const PREVIEW_LEVELS_KEY = 'arrowClear_previewLevels_v1';
const SAVED_LEVELS_FILE = 'saved-levels-v1';
const PREVIEW_LEVELS_FILE = 'preview-levels-v1';
const STORAGE_API_BASE = '/api/storage';
const STORAGE_STATIC_BASE = './.local-data';

const DEFAULT_PLAYFIELD = {
    width: 430,
    height: 664
};

let savedLevelsCache = readMap(SAVED_LEVELS_KEY);
let previewLevelsCache = readMap(PREVIEW_LEVELS_KEY);
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
    const dimensionMode = overrides.dimensionMode || 'rows';
    const fallbackValue = dimensionMode === 'cols' ? baseConfig.gridCols : baseConfig.gridRows;
    const dimensionValue = clamp(Math.round(Number(overrides.dimensionValue ?? fallbackValue) || fallbackValue), 4, 40);
    const grid = deriveGridSize(dimensionMode, dimensionValue);
    const minLen = clamp(Math.round(Number(overrides.minLen ?? baseConfig.minLen) || baseConfig.minLen), 2, 12);
    const maxLen = clamp(
        Math.round(Number(overrides.maxLen ?? baseConfig.maxLen) || baseConfig.maxLen),
        minLen,
        16
    );

    return {
        level: baseConfig.level,
        dimensionMode,
        dimensionValue,
        gridCols: grid.gridCols,
        gridRows: grid.gridRows,
        minLen,
        maxLen
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
    const [savedRemote, previewRemote] = await Promise.all([
        fetchMapFromServer(SAVED_LEVELS_FILE),
        fetchMapFromServer(PREVIEW_LEVELS_FILE)
    ]);

    if (savedRemote) {
        savedLevelsCache = savedRemote;
        writeMap(SAVED_LEVELS_KEY, savedLevelsCache);
    }

    if (previewRemote) {
        previewLevelsCache = previewRemote;
        writeMap(PREVIEW_LEVELS_KEY, previewLevelsCache);
    }
}

async function fetchMapFromServer(name) {
    if (!canUseServerStorage()) {
        return null;
    }

    const serverData = await tryFetchMap(`${STORAGE_API_BASE}/${name}`);
    if (serverData) {
        return serverData;
    }

    const staticData = await tryFetchMap(`${STORAGE_STATIC_BASE}/${name}.json`);
    if (staticData) {
        return staticData;
    }

    warnServerUnavailable(new Error(`storage fetch failed for ${name}`));
    return null;
}

async function persistMapToServer(name, mapValue) {
    if (!canUseServerStorage()) {
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

function canUseServerStorage() {
    return typeof window !== 'undefined' && typeof fetch === 'function';
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

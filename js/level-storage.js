import { Line } from './line.js?v=22';

const SAVED_LEVELS_KEY = 'arrowClear_savedLevels_v1';
const PREVIEW_LEVELS_KEY = 'arrowClear_previewLevels_v1';
const DEFAULT_PLAYFIELD = {
    width: 430,
    height: 664
};

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
        path: path, // Added path meta
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
    return readMap(SAVED_LEVELS_KEY)[String(level)] || null;
}

export function saveSavedLevelRecord(level, record) {
    const map = readMap(SAVED_LEVELS_KEY);
    map[String(level)] = record;
    writeMap(SAVED_LEVELS_KEY, map);
}

export function deleteSavedLevelRecord(level) {
    const map = readMap(SAVED_LEVELS_KEY);
    delete map[String(level)];
    writeMap(SAVED_LEVELS_KEY, map);
}

export function getPreviewLevelRecord(level) {
    return readMap(PREVIEW_LEVELS_KEY)[String(level)] || null;
}

export function savePreviewLevelRecord(level, record) {
    const map = readMap(PREVIEW_LEVELS_KEY);
    map[String(level)] = record;
    writeMap(PREVIEW_LEVELS_KEY, map);
}

export function deletePreviewLevelRecord(level) {
    const map = readMap(PREVIEW_LEVELS_KEY);
    delete map[String(level)];
    writeMap(PREVIEW_LEVELS_KEY, map);
}

function readMap(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
        return {};
    }
}

function writeMap(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

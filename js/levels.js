import { applyStoredSettings, getSavedLevelRecord } from './level-storage.js?v=45';

export function getBaseLevelConfig(levelNum) {
    if (levelNum === 1) {
        return {
            level: 1,
            gridCols: 7,
            gridRows: 8,
            lineCount: 18,
            maxTurns: 2,
            lives: 5,
            hasTimer: false,
            timerSeconds: 0,
            colors: ['#1a1c3c'],
            fillRatio: 0.56,
            minLen: 2,
            maxLen: 4,
            maxCellUsage: 1
        };
    }

    if (levelNum === 2) {
        return {
            level: 2,
            gridCols: 19,
            gridRows: 30,
            lineCount: 180,
            maxTurns: 10,
            lives: 4,
            hasTimer: false,
            timerSeconds: 0,
            colors: ['#1a1c3c'],
            fillRatio: 1.0,
            minLen: 2,
            maxLen: 12,
            maxCellUsage: 1
        };
    }

    if (levelNum === 3) {
        return {
            level: 3,
            gridCols: 18,
            gridRows: 26,
            lineCount: 180,
            maxTurns: 8,
            lives: 3,
            hasTimer: true,
            timerSeconds: 600,
            colors: ['#1a1c3c'],
            fillRatio: 0.86,
            minLen: 2,
            maxLen: 5,
            maxCellUsage: 1
        };
    }

    const base = levelNum - 3;
    return {
        level: levelNum,
        gridCols: 18,
        gridRows: Math.min(30, 26 + Math.floor(base / 2)),
        lineCount: 180 + base * 12,
        maxTurns: Math.min(10, 8 + Math.floor(base / 2)),
        lives: 3,
        hasTimer: true,
        timerSeconds: Math.max(150, 600 - base * 20),
        colors: ['#1a1c3c'],
        fillRatio: Math.min(0.88, 0.86 + base * 0.002),
        minLen: 2,
        maxLen: Math.min(6, 5 + Math.floor(base / 5)),
        maxCellUsage: 1
    };
}

export function getLevelConfig(levelNum) {
    const baseConfig = getBaseLevelConfig(levelNum);
    const savedRecord = getSavedLevelRecord(levelNum);
    return applyStoredSettings(baseConfig, savedRecord?.settings || null);
}

export const LEVEL_CONFIGS = Array.from({ length: 30 }, (_, index) => getLevelConfig(index + 1));

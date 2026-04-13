import { applyStoredSettings, getLevelCatalog, getSavedLevelRecord } from './level-storage.js?v=56';

export const MAX_NORMAL_LEVEL = 1000;
export const MAX_REWARD_LEVEL = 200;
export const REWARD_LEVEL_ID_BASE = 1001;
export const BONUS_LEVEL_ID = REWARD_LEVEL_ID_BASE;

const DEFAULT_REWARD_NAME = '奖励关';
const DEFAULT_REWARD_SCORE_PER_BODY_SEGMENT = 1000;

export function getNormalLevelCount() {
    const catalog = getLevelCatalog();
    return clampInt(catalog?.normalCount, 1, MAX_NORMAL_LEVEL, 100);
}

export function getRewardLevelCount() {
    const catalog = getLevelCatalog();
    return clampInt(catalog?.rewardCount, 0, MAX_REWARD_LEVEL, 1);
}

export function clampNormalLevel(levelNum) {
    return clampInt(levelNum, 1, getNormalLevelCount(), 1);
}

export function toRewardLevelId(index) {
    const safeIndex = clampInt(index, 1, MAX_REWARD_LEVEL, 1);
    return REWARD_LEVEL_ID_BASE + safeIndex - 1;
}

export function rewardIndexFromLevelId(levelNum) {
    const level = Math.floor(Number(levelNum) || 0);
    if (!Number.isFinite(level) || level < REWARD_LEVEL_ID_BASE) {
        return 0;
    }
    const rewardIndex = level - REWARD_LEVEL_ID_BASE + 1;
    if (rewardIndex < 1 || rewardIndex > getRewardLevelCount()) {
        return 0;
    }
    return rewardIndex;
}

export function getRewardLevelIds() {
    const count = getRewardLevelCount();
    return Array.from({ length: count }, (_, index) => toRewardLevelId(index + 1));
}

export function isRewardLevel(levelNum) {
    return rewardIndexFromLevelId(levelNum) > 0;
}

export function getBaseLevelConfig(levelNum) {
    const level = Math.floor(Number(levelNum) || 0);
    const rewardIndex = rewardIndexFromLevelId(level);
    if (rewardIndex > 0) {
        return buildRewardBaseConfig(level, rewardIndex);
    }
    return buildNormalBaseConfig(clampNormalLevel(level));
}

export function getLevelConfig(levelNum) {
    const baseConfig = getBaseLevelConfig(levelNum);
    const savedRecord = getSavedLevelRecord(baseConfig.level);
    return applyStoredSettings(baseConfig, savedRecord?.settings || null);
}

function buildNormalBaseConfig(levelNum) {
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
            misclickPenaltySeconds: 1,
            colors: ['#1a1c3c'],
            fillRatio: 0.56,
            minLen: 2,
            maxLen: 4,
            maxCellUsage: 1,
            isRewardLevel: false,
            displayName: ''
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
            misclickPenaltySeconds: 1,
            colors: ['#1a1c3c'],
            fillRatio: 1.0,
            minLen: 2,
            maxLen: 12,
            maxCellUsage: 1,
            isRewardLevel: false,
            displayName: ''
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
            misclickPenaltySeconds: 1,
            colors: ['#1a1c3c'],
            fillRatio: 0.86,
            minLen: 2,
            maxLen: 5,
            maxCellUsage: 1,
            isRewardLevel: false,
            displayName: ''
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
        misclickPenaltySeconds: 1,
        colors: ['#1a1c3c'],
        fillRatio: Math.min(0.88, 0.86 + base * 0.002),
        minLen: 2,
        maxLen: Math.min(6, 5 + Math.floor(base / 5)),
        maxCellUsage: 1,
        isRewardLevel: false,
        displayName: ''
    };
}

function buildRewardBaseConfig(levelNum, rewardIndex) {
    const rewardScale = Math.max(0, rewardIndex - 1);
    return {
        level: levelNum,
        gridCols: 18,
        gridRows: Math.min(30, 26 + Math.floor(rewardScale / 2)),
        lineCount: 200 + rewardScale * 8,
        maxTurns: 12,
        lives: 3,
        hasTimer: true,
        timerSeconds: 120,
        misclickPenaltySeconds: 0,
        colors: ['#1a1c3c'],
        fillRatio: 0.9,
        minLen: 2,
        maxLen: 6,
        maxCellUsage: 1,
        isRewardLevel: true,
        rewardIndex,
        rewardScorePerBodySegment: DEFAULT_REWARD_SCORE_PER_BODY_SEGMENT,
        displayName: rewardIndex === 1 ? DEFAULT_REWARD_NAME : `${DEFAULT_REWARD_NAME} ${rewardIndex}`
    };
}

function clampInt(value, min, max, fallback) {
    const parsed = Math.round(Number(value));
    const base = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, base));
}


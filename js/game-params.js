export const GAMEPLAY_PARAM_STORAGE_KEY = 'arrowClear_gameplayParams_v1';
export const GAMEPLAY_PARAMS_UPDATED_EVENT = 'arrow:gameplay-params-updated';

export const DEFAULT_GAMEPLAY_PARAMS = Object.freeze({
    scorePerCoin: 1000,
    releaseSfxEveryNScoreEvents: 1,
    scoreBurstStarCount: 4,
    snakeRemoveSpeedMultiplier: 1,
    snakeRemoveAccelMultiplier: 1,
    comboWindowMs: 3000,
    rewardComboThreshold: 100,
    misclickPenaltyTextDurationSeconds: 1.9,
    releasableHitAreaScale: 1.3
});

const PARAM_RANGE = Object.freeze({
    scorePerCoin: Object.freeze({ min: 1, max: 100000 }),
    releaseSfxEveryNScoreEvents: Object.freeze({ min: 1, max: 1000 }),
    scoreBurstStarCount: Object.freeze({ min: 0, max: 20 }),
    snakeRemoveSpeedMultiplier: Object.freeze({ min: 0.2, max: 5 }),
    snakeRemoveAccelMultiplier: Object.freeze({ min: 0.2, max: 5 }),
    comboWindowMs: Object.freeze({ min: 100, max: 15000 }),
    rewardComboThreshold: Object.freeze({ min: 1, max: 1000 }),
    misclickPenaltyTextDurationSeconds: Object.freeze({ min: 0.2, max: 6 }),
    releasableHitAreaScale: Object.freeze({ min: 1, max: 2.2 })
});

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeNumber(value, fallback, min, max, integer = true) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    const clamped = clampNumber(parsed, min, max);
    return integer ? Math.round(clamped) : clamped;
}

function getStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    return window.localStorage;
}

export function normalizeGameplayParams(rawParams = {}) {
    const raw = rawParams && typeof rawParams === 'object' ? rawParams : {};
    return {
        scorePerCoin: normalizeNumber(
            raw.scorePerCoin,
            DEFAULT_GAMEPLAY_PARAMS.scorePerCoin,
            PARAM_RANGE.scorePerCoin.min,
            PARAM_RANGE.scorePerCoin.max,
            true
        ),
        releaseSfxEveryNScoreEvents: normalizeNumber(
            raw.releaseSfxEveryNScoreEvents,
            DEFAULT_GAMEPLAY_PARAMS.releaseSfxEveryNScoreEvents,
            PARAM_RANGE.releaseSfxEveryNScoreEvents.min,
            PARAM_RANGE.releaseSfxEveryNScoreEvents.max,
            true
        ),
        scoreBurstStarCount: normalizeNumber(
            raw.scoreBurstStarCount,
            DEFAULT_GAMEPLAY_PARAMS.scoreBurstStarCount,
            PARAM_RANGE.scoreBurstStarCount.min,
            PARAM_RANGE.scoreBurstStarCount.max,
            true
        ),
        snakeRemoveSpeedMultiplier: normalizeNumber(
            raw.snakeRemoveSpeedMultiplier,
            DEFAULT_GAMEPLAY_PARAMS.snakeRemoveSpeedMultiplier,
            PARAM_RANGE.snakeRemoveSpeedMultiplier.min,
            PARAM_RANGE.snakeRemoveSpeedMultiplier.max,
            false
        ),
        snakeRemoveAccelMultiplier: normalizeNumber(
            raw.snakeRemoveAccelMultiplier,
            DEFAULT_GAMEPLAY_PARAMS.snakeRemoveAccelMultiplier,
            PARAM_RANGE.snakeRemoveAccelMultiplier.min,
            PARAM_RANGE.snakeRemoveAccelMultiplier.max,
            false
        ),
        comboWindowMs: normalizeNumber(
            raw.comboWindowMs,
            DEFAULT_GAMEPLAY_PARAMS.comboWindowMs,
            PARAM_RANGE.comboWindowMs.min,
            PARAM_RANGE.comboWindowMs.max,
            true
        ),
        rewardComboThreshold: normalizeNumber(
            raw.rewardComboThreshold,
            DEFAULT_GAMEPLAY_PARAMS.rewardComboThreshold,
            PARAM_RANGE.rewardComboThreshold.min,
            PARAM_RANGE.rewardComboThreshold.max,
            true
        ),
        misclickPenaltyTextDurationSeconds: normalizeNumber(
            raw.misclickPenaltyTextDurationSeconds,
            DEFAULT_GAMEPLAY_PARAMS.misclickPenaltyTextDurationSeconds,
            PARAM_RANGE.misclickPenaltyTextDurationSeconds.min,
            PARAM_RANGE.misclickPenaltyTextDurationSeconds.max,
            false
        ),
        releasableHitAreaScale: normalizeNumber(
            raw.releasableHitAreaScale,
            DEFAULT_GAMEPLAY_PARAMS.releasableHitAreaScale,
            PARAM_RANGE.releasableHitAreaScale.min,
            PARAM_RANGE.releasableHitAreaScale.max,
            false
        )
    };
}

export function readGameplayParams() {
    const storage = getStorage();
    if (!storage) {
        return { ...DEFAULT_GAMEPLAY_PARAMS };
    }
    try {
        const raw = storage.getItem(GAMEPLAY_PARAM_STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_GAMEPLAY_PARAMS };
        }
        const parsed = JSON.parse(raw);
        return normalizeGameplayParams(parsed);
    } catch {
        return { ...DEFAULT_GAMEPLAY_PARAMS };
    }
}

export function writeGameplayParams(rawParams) {
    const normalized = normalizeGameplayParams(rawParams);
    const storage = getStorage();
    if (storage) {
        storage.setItem(GAMEPLAY_PARAM_STORAGE_KEY, JSON.stringify(normalized));
    }
    notifyGameplayParamsUpdated(normalized);
    return normalized;
}

export function clearGameplayParams() {
    const storage = getStorage();
    if (storage) {
        storage.removeItem(GAMEPLAY_PARAM_STORAGE_KEY);
    }
    const cleared = { ...DEFAULT_GAMEPLAY_PARAMS };
    notifyGameplayParamsUpdated(cleared);
    return cleared;
}

function notifyGameplayParamsUpdated(params) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
        return;
    }
    window.dispatchEvent(new CustomEvent(GAMEPLAY_PARAMS_UPDATED_EVENT, {
        detail: { params: normalizeGameplayParams(params) }
    }));
}

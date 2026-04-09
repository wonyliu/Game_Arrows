import { Grid } from './grid.js?v=24';
import { Line } from './line.js?v=54';
import { canMove, findMovableLines } from './collision.js?v=19';
import {
    BONUS_LEVEL_ID,
    getLevelConfig,
    getNormalLevelCount,
    getRewardLevelCount,
    toRewardLevelId
} from './levels.js?v=32';
import { AnimationManager } from './animation.js?v=42';
import { buildPlayableLevel } from './level-builder.js?v=48';
import {
    deserializeLevelData,
    getSavedLevelRecord,
    isStoredLevelDataUsable
} from './level-storage.js?v=55';
import {
    playClearSoundExclusive,
    playErrorSound,
    playGameOverSound,
    playLevelCompleteSound,
    playReleaseScaleSound,
    resumeAudio,
    setAudioSkinId
} from './audio.js?v=51';
import { buildGameSpriteAtlas, drawSprite, hashPoint } from './pixel-art.js?v=48';
import {
    ensureSelectedSkin,
    getDefaultSkinId,
    getSkinById,
    getSkinCatalog as getSkinCatalogList,
    normalizeUnlockedSkins
} from './skins.js?v=23';
import { readGameplayParams } from './game-params.js?v=3';
import {
    readProgressSnapshot,
    saveProgressSnapshot
} from './progress-storage.js?v=1';
import {
    getBusinessDayKeyByHour,
    getLocalDayKey,
    readLiveOpsConfig,
    readLiveOpsPlayerState,
    syncLiveOpsPlayerToServer,
    writeLiveOpsPlayerState
} from './liveops-storage.js?v=2';

const DEFAULT_TOOL_USES = Object.freeze({
    hint: 2,
    undo: 2,
    shuffle: 2
});
const GAMEPLAY_PARAMS = readGameplayParams();
const SCORE_PER_COIN = GAMEPLAY_PARAMS.scorePerCoin;
const SCORE_PER_BODY_SEGMENT = GAMEPLAY_PARAMS.scorePerBodySegment;
const DEFAULT_REWARD_SCORE_PER_BODY_SEGMENT = 1000;
const RELEASE_SFX_EVERY_N_SCORE_EVENTS = Math.max(
    1,
    Math.floor(Number(GAMEPLAY_PARAMS.releaseSfxEveryNScoreEvents) || 1)
);
const SCORE_BURST_STAR_COUNT = GAMEPLAY_PARAMS.scoreBurstStarCount;
const SCORE_BURST_STAR_COLORS = Object.freeze(['#fff8c9', '#ffe899', '#ffd86e', '#ffffff']);
const REWARD_COMBO_THRESHOLD = GAMEPLAY_PARAMS.rewardComboThreshold;
const MISCLICK_PENALTY_TEXT_DURATION_SECONDS = Math.max(
    0.2,
    Number(GAMEPLAY_PARAMS.misclickPenaltyTextDurationSeconds) || 1.9
);
const DRAG_RELEASE_CLICK_SUPPRESS_MS = 160;

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.searchParams = new URLSearchParams(window.location.search);
        this.isPlaytestMode = this.searchParams.get('playtest') === '1';
        this.playtestLevel = Number(this.searchParams.get('level') || this.searchParams.get('playtestLevel') || 0);
        this.state = 'MENU';
        this.currentLevel = 1;
        this.maxUnlockedLevel = 1;
        this.normalLevelCount = getNormalLevelCount();
        this.rewardLevelCount = getRewardLevelCount();
        this.grid = null;
        this.lines = [];
        this.lifeSystemEnabled = false;
        this.lives = 0;
        this.maxLives = 0;
        this.score = 0;
        this.coins = 0;
        this.lastCoinReward = 0;
        this.combo = 0;
        this.comboWindowMs = GAMEPLAY_PARAMS.comboWindowMs;
        this.lastComboReleaseAt = 0;
        this.releaseSfxScoreEventCount = 0;
        this.timeRemaining = 0;
        this.maxTimeRemaining = 0;
        this.hasTimer = false;
        this.misclickPenaltySeconds = 1;
        this.energyBatchSeq = 1;
        this.activeEnergyBatches = new Set();
        this.animations = new AnimationManager();
        this.lastTime = 0;
        this.lastSnakeInteractionTime = performance.now();
        this.hintLine = null;
        this.undoStack = [];
        this.defaultToolUses = { ...DEFAULT_TOOL_USES };
        this.toolUses = { ...DEFAULT_TOOL_USES };
        this.baseToolUsesRemaining = { ...DEFAULT_TOOL_USES };
        this.toolInventory = {
            hint: 0,
            undo: 0,
            shuffle: 0
        };
        this.pixelTheme = null;
        this.unlockedSkinIds = [...normalizeUnlockedSkins()];
        this.selectedSkinId = getDefaultSkinId();
        this.isRewardStage = false;
        this.rewardReturnLevel = null;
        this.rewardSourceLevel = null;
        this.pendingRewardReturnLevel = null;
        this.pendingRewardSourceLevel = null;
        this.currentStageLabel = '';
        this.currentScorePerBodySegment = SCORE_PER_BODY_SEGMENT;
        this.campaignCompleted = false;
        this.bestComboThisLevel = 0;
        this.dragReleaseActive = false;
        this.dragReleaseLineIds = new Set();
        this.suppressClickUntil = 0;
        this.lineById = new Map();
        this.sortedLinesAsc = [];
        this.sortedLinesDesc = [];
        this.sortedLinesDirty = true;
        this.gridDotsLayer = null;
        this.liveOpsConfig = readLiveOpsConfig();
        this.liveOpsPlayer = readLiveOpsPlayerState();
        this.onlineRewardSaveAccumulator = 0;
        this.nextRewardLevelIndex = 1;

        this.loadProgress();
        setAudioSkinId(this.selectedSkinId);

        if (this.isPlaytestMode && this.playtestLevel > 0) {
            const playtestTargetLevel = normalizePlayableLevel(this.playtestLevel, this.normalLevelCount);
            this.currentLevel = playtestTargetLevel;
            this.maxUnlockedLevel = Math.max(this.maxUnlockedLevel, playtestTargetLevel);
        }

        this.canvas.addEventListener('click', (event) => this.handleClick(event));
        this.canvas.addEventListener('mousedown', (event) => this.handlePointerDown(event));
        window.addEventListener('mousemove', (event) => this.handlePointerMove(event));
        window.addEventListener('mouseup', (event) => this.handlePointerUp(event));
        this.canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.handleClick(event.touches[0]);
        }, { passive: false });

        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    loadProgress() {
        this.refreshLevelCatalog();
        try {
            const data = readProgressSnapshot();
            this.maxUnlockedLevel = normalizePlayableLevel(data.maxUnlockedLevel || 1, this.normalLevelCount);
            this.currentLevel = normalizePlayableLevel(
                data.currentLevel || 1,
                Math.max(1, this.maxUnlockedLevel)
            );
            this.coins = Math.max(0, Math.floor(Number(data.coins) || 0));
            this.unlockedSkinIds = normalizeUnlockedSkins(data.unlockedSkinIds);
            this.selectedSkinId = ensureSelectedSkin(data.selectedSkinId, this.unlockedSkinIds);
            this.nextRewardLevelIndex = Math.max(1, Math.floor(Number(data.nextRewardLevelIndex) || 1));
            this.lastCoinReward = 0;
        } catch {
            this.maxUnlockedLevel = 1;
            this.currentLevel = 1;
            this.coins = 0;
            this.lastCoinReward = 0;
            this.unlockedSkinIds = normalizeUnlockedSkins();
            this.selectedSkinId = getDefaultSkinId();
            this.nextRewardLevelIndex = 1;
        }
        setAudioSkinId(this.selectedSkinId);
        this.loadLiveOpsState();
    }

    saveProgress() {
        this.refreshLevelCatalog();
        const cappedUnlocked = normalizePlayableLevel(this.maxUnlockedLevel || 1, this.normalLevelCount);
        const cappedCurrent = this.isRewardStage
            ? normalizePlayableLevel(this.rewardSourceLevel || 1, cappedUnlocked)
            : normalizePlayableLevel(this.currentLevel || 1, cappedUnlocked);
        const normalizedUnlockedSkins = normalizeUnlockedSkins(this.unlockedSkinIds);
        const selectedSkinId = ensureSelectedSkin(this.selectedSkinId, normalizedUnlockedSkins);
        this.maxUnlockedLevel = cappedUnlocked;
        this.unlockedSkinIds = normalizedUnlockedSkins;
        this.selectedSkinId = selectedSkinId;
        setAudioSkinId(this.selectedSkinId);
        saveProgressSnapshot({
            maxUnlockedLevel: cappedUnlocked,
            currentLevel: cappedCurrent,
            coins: Math.max(0, Math.floor(Number(this.coins) || 0)),
            unlockedSkinIds: normalizedUnlockedSkins,
            selectedSkinId,
            nextRewardLevelIndex: Math.max(1, Math.floor(Number(this.nextRewardLevelIndex) || 1))
        });
    }

    loadLiveOpsState() {
        this.liveOpsConfig = readLiveOpsConfig();
        this.liveOpsPlayer = readLiveOpsPlayerState();
        const inv = this.liveOpsPlayer?.inventory || {};
        this.toolInventory.hint = Math.max(0, Math.floor(Number(inv.hint) || 0));
        this.toolInventory.undo = Math.max(0, Math.floor(Number(inv.undo) || 0));
        this.toolInventory.shuffle = Math.max(0, Math.floor(Number(inv.shuffle) || 0));
        this.resetOnlineRewardDayIfNeeded(false);
    }

    writeLiveOpsPlayer(options = {}) {
        const next = {
            ...this.liveOpsPlayer,
            inventory: {
                ...this.liveOpsPlayer.inventory,
                hint: Math.max(0, Math.floor(Number(this.toolInventory.hint) || 0)),
                undo: Math.max(0, Math.floor(Number(this.toolInventory.undo) || 0)),
                shuffle: Math.max(0, Math.floor(Number(this.toolInventory.shuffle) || 0))
            }
        };
        this.liveOpsPlayer = writeLiveOpsPlayerState(next, { syncServer: options.syncServer === true });
        if (options.syncServer === true) {
            void syncLiveOpsPlayerToServer();
        }
    }

    getLiveOpsConfig() {
        this.liveOpsConfig = readLiveOpsConfig();
        return this.liveOpsConfig;
    }

    refreshLevelCatalog() {
        this.normalLevelCount = Math.max(1, getNormalLevelCount());
        this.rewardLevelCount = Math.max(0, getRewardLevelCount());
        this.maxUnlockedLevel = normalizePlayableLevel(this.maxUnlockedLevel || 1, this.normalLevelCount);
        if (!this.isRewardStage) {
            this.currentLevel = normalizePlayableLevel(this.currentLevel || 1, this.maxUnlockedLevel);
        }
        if (this.rewardReturnLevel !== null && this.rewardReturnLevel !== undefined) {
            this.rewardReturnLevel = normalizePlayableLevel(this.rewardReturnLevel, this.normalLevelCount);
        }
        const maxRewardIndex = Math.max(1, this.rewardLevelCount);
        this.nextRewardLevelIndex = Math.max(
            1,
            Math.min(maxRewardIndex, Math.floor(Number(this.nextRewardLevelIndex) || 1))
        );
    }

    rebuildLineLookup() {
        this.lineById = new Map();
        for (const line of this.lines) {
            if (line && Number.isFinite(line.id)) {
                this.lineById.set(line.id, line);
            }
        }
    }

    markSortedLinesDirty() {
        this.sortedLinesDirty = true;
    }

    getSortedLines(order = 'asc') {
        if (this.sortedLinesDirty) {
            this.sortedLinesAsc = [...this.lines].sort((a, b) => a.zIndex - b.zIndex);
            this.sortedLinesDesc = [...this.sortedLinesAsc].reverse();
            this.sortedLinesDirty = false;
        }
        return order === 'desc' ? this.sortedLinesDesc : this.sortedLinesAsc;
    }

    resize() {
        const wrapper = this.canvas.parentElement;
        const docEl = document.documentElement;
        const wrapperWidth = Math.round(wrapper?.clientWidth || 0);
        const wrapperHeight = Math.round(wrapper?.clientHeight || 0);
        const canvasWidth = Math.round(this.canvas.clientWidth || 0);
        const canvasHeight = Math.round(this.canvas.clientHeight || 0);
        const fallbackWidth = Math.round(window.innerWidth || docEl?.clientWidth || 430);
        const fallbackHeight = Math.round(window.innerHeight || docEl?.clientHeight || 664);
        const nextWidth = Math.max(1, wrapperWidth || canvasWidth || fallbackWidth);
        const nextHeight = Math.max(1, wrapperHeight || canvasHeight || fallbackHeight);

        this.canvas.width = nextWidth;
        this.canvas.height = nextHeight;

        if (this.grid) {
            this.grid.resize(this.canvas.width, this.canvas.height);
            this.rebuildPixelScene();
        }
    }

    startNormalLevel(levelNum) {
        this.refreshLevelCatalog();
        const targetLevel = normalizePlayableLevel(levelNum, this.normalLevelCount);
        this.startLevel(targetLevel, { stageType: 'normal' });
    }

    startRewardLevel(returnLevel, rewardSourceLevel = this.currentLevel, fixedRewardLevelId = null) {
        this.refreshLevelCatalog();
        const sourceLevel = normalizePlayableLevel(rewardSourceLevel, this.normalLevelCount);
        const nextNormalLevel = normalizePlayableLevel(returnLevel || (sourceLevel + 1), this.normalLevelCount);
        const rewardLevelId = this.resolveRewardLevelId(sourceLevel, fixedRewardLevelId);
        if (!rewardLevelId) {
            this.startNormalLevel(nextNormalLevel);
            return;
        }
        this.startLevel(rewardLevelId, {
            stageType: 'reward',
            rewardLevelId,
            rewardReturnLevel: nextNormalLevel,
            rewardSourceLevel: sourceLevel
        });
    }

    startNextStage() {
        this.refreshLevelCatalog();
        if (!this.isRewardStage && this.campaignCompleted) {
            return;
        }

        if (this.pendingRewardReturnLevel && !this.isRewardStage) {
            const nextNormalLevel = this.pendingRewardReturnLevel;
            const sourceLevel = this.pendingRewardSourceLevel || this.currentLevel;
            this.pendingRewardReturnLevel = null;
            this.pendingRewardSourceLevel = null;
            this.startRewardLevel(nextNormalLevel, sourceLevel);
            return;
        }

        if (this.isRewardStage) {
            const fallback = normalizePlayableLevel(
                (this.rewardSourceLevel || this.currentLevel) + 1,
                this.normalLevelCount
            );
            this.startNormalLevel(this.rewardReturnLevel || fallback);
            return;
        }

        this.startNormalLevel(this.currentLevel + 1);
    }

    retryCurrentStage() {
        if (this.isRewardStage) {
            this.startRewardLevel(
                this.rewardReturnLevel || normalizePlayableLevel((this.rewardSourceLevel || 1) + 1, this.normalLevelCount),
                this.rewardSourceLevel || 1,
                this.currentLevel
            );
            return;
        }
        this.startNormalLevel(this.currentLevel);
    }

    getCurrentStageLabel() {
        return this.currentStageLabel || '';
    }

    getNormalLevelCount() {
        this.refreshLevelCatalog();
        return this.normalLevelCount;
    }

    getCoins() {
        return Math.max(0, Math.floor(Number(this.coins) || 0));
    }

    getLastCoinReward() {
        return Math.max(0, Math.floor(Number(this.lastCoinReward) || 0));
    }

    getItemBalance(itemId) {
        const id = `${itemId || ''}`.trim().toLowerCase();
        if (id === 'coin') {
            return this.getCoins();
        }
        if (id === 'hint' || id === 'undo' || id === 'shuffle') {
            return Math.max(0, Math.floor(Number(this.toolInventory[id]) || 0));
        }
        const inv = this.liveOpsPlayer?.inventory || {};
        return Math.max(0, Math.floor(Number(inv[id]) || 0));
    }

    getLiveOpsItemDefinition(itemId) {
        const id = `${itemId || ''}`.trim().toLowerCase();
        if (!id) {
            return null;
        }
        const config = this.getLiveOpsConfig();
        const items = Array.isArray(config?.items) ? config.items : [];
        return items.find((item) => `${item?.id || ''}`.trim().toLowerCase() === id) || null;
    }

    getCheckinSnapshot() {
        const config = this.getLiveOpsConfig();
        const checkinCfg = config?.activities?.checkin || {};
        const cycleDays = Math.max(1, Math.floor(Number(checkinCfg.cycleDays) || 7));
        const rewards = Array.isArray(checkinCfg.rewards) ? checkinCfg.rewards : [];
        const state = this.liveOpsPlayer?.checkin || {};
        const claimedCount = Math.max(0, Math.floor(Number(state.claimedCount) || 0));
        const lastClaimDayKey = `${state.lastClaimDayKey || ''}`.trim();
        const todayKey = getLocalDayKey(new Date());
        const claimedInCycle = claimedCount % cycleDays;
        const nextDayIndex = claimedInCycle + 1;
        const canClaimToday = checkinCfg.enabled !== false && lastClaimDayKey !== todayKey;
        const todayReward = Array.isArray(rewards[nextDayIndex - 1]) ? rewards[nextDayIndex - 1] : [];
        return {
            enabled: checkinCfg.enabled !== false,
            cycleDays,
            rewards,
            claimedCount,
            claimedInCycle,
            nextDayIndex,
            canClaimToday,
            todayReward
        };
    }

    claimCheckinReward() {
        const snapshot = this.getCheckinSnapshot();
        if (!snapshot.enabled) {
            return { ok: false, reason: 'disabled' };
        }
        if (!snapshot.canClaimToday) {
            return { ok: false, reason: 'already-claimed' };
        }
        this.applyRewardList(snapshot.todayReward);
        const todayKey = getLocalDayKey(new Date());
        this.liveOpsPlayer = {
            ...this.liveOpsPlayer,
            checkin: {
                claimedCount: snapshot.claimedCount + 1,
                lastClaimDayKey: todayKey
            }
        };
        this.writeLiveOpsPlayer({ syncServer: true });
        this.updateHUD();
        this.emitLiveOpsUpdated();
        return {
            ok: true,
            dayIndex: snapshot.nextDayIndex,
            rewards: snapshot.todayReward
        };
    }

    getOnlineRewardSnapshot() {
        this.resetOnlineRewardDayIfNeeded(false);
        const cfg = this.getLiveOpsConfig().activities?.onlineReward || {};
        const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
        const resetHour = Math.max(0, Math.min(23, Math.floor(Number(cfg.resetHour) || 4)));
        const dayKey = getBusinessDayKeyByHour(new Date(), resetHour);
        const online = this.liveOpsPlayer?.onlineReward || {};
        const tierIndex = Math.max(0, Math.floor(Number(online.tierIndex) || 0));
        const done = tierIndex >= tiers.length;
        const currentTier = done ? null : tiers[tierIndex];
        const storedRemaining = Number(online.remainingSeconds);
        const tierDefaultSeconds = Math.max(0, Number(currentTier?.seconds) || 0);
        const remainingSeconds = done
            ? 0
            : (Number.isFinite(storedRemaining) ? Math.max(0, storedRemaining) : tierDefaultSeconds);
        return {
            enabled: cfg.enabled !== false,
            resetHour,
            dayKey,
            tiers,
            tierIndex,
            done,
            currentTier,
            remainingSeconds,
            canClaim: !done && remainingSeconds <= 0
        };
    }

    claimOnlineReward() {
        const snapshot = this.getOnlineRewardSnapshot();
        if (!snapshot.enabled) {
            return { ok: false, reason: 'disabled' };
        }
        if (!snapshot.canClaim || !snapshot.currentTier) {
            return { ok: false, reason: 'not-ready' };
        }
        this.applyRewardList(snapshot.currentTier.rewards);
        const nextIndex = snapshot.tierIndex + 1;
        const nextTier = snapshot.tiers[nextIndex] || null;
        this.liveOpsPlayer = {
            ...this.liveOpsPlayer,
            onlineReward: {
                ...this.liveOpsPlayer.onlineReward,
                dayKey: snapshot.dayKey,
                tierIndex: nextIndex,
                remainingSeconds: nextTier ? Math.max(0, Number(nextTier.seconds) || 0) : 0
            }
        };
        this.writeLiveOpsPlayer({ syncServer: true });
        this.emitLiveOpsUpdated();
        this.updateHUD();
        return {
            ok: true,
            claimedTierIndex: snapshot.tierIndex,
            rewards: snapshot.currentTier.rewards,
            nextTierIndex: nextIndex
        };
    }

    getScorePerCoin() {
        return SCORE_PER_COIN;
    }

    getSkinCatalog() {
        return getSkinCatalogList();
    }

    getSelectedSkinId() {
        return this.selectedSkinId;
    }

    isSkinUnlocked(skinId) {
        const skin = getSkinById(skinId);
        return this.unlockedSkinIds.includes(skin.id);
    }

    canUnlockSkin(skinId) {
        const skin = getSkinById(skinId);
        if (this.isSkinUnlocked(skin.id)) {
            return false;
        }
        const cost = Math.max(0, Math.floor(Number(skin.coinCost) || 0));
        return this.getCoins() >= cost;
    }

    unlockSkin(skinId) {
        const skin = getSkinById(skinId);
        const cost = Math.max(0, Math.floor(Number(skin.coinCost) || 0));
        if (this.isSkinUnlocked(skin.id)) {
            return {
                ok: false,
                reason: 'already-unlocked',
                skinId: skin.id,
                coins: this.getCoins(),
                coinCost: cost
            };
        }
        if (this.getCoins() < cost) {
            return {
                ok: false,
                reason: 'not-enough-coins',
                skinId: skin.id,
                coins: this.getCoins(),
                coinCost: cost
            };
        }

        this.coins = Math.max(0, this.getCoins() - cost);
        this.unlockedSkinIds = normalizeUnlockedSkins([...this.unlockedSkinIds, skin.id]);
        this.selectedSkinId = skin.id;
        setAudioSkinId(this.selectedSkinId);
        this.saveProgress();
        this.rebuildPixelScene();
        this.updateHUD();
        return {
            ok: true,
            skinId: skin.id,
            coins: this.getCoins(),
            coinCost: cost
        };
    }

    selectSkin(skinId) {
        const skin = getSkinById(skinId);
        if (!this.isSkinUnlocked(skin.id)) {
            return false;
        }
        if (this.selectedSkinId === skin.id) {
            return true;
        }
        this.selectedSkinId = skin.id;
        setAudioSkinId(this.selectedSkinId);
        this.saveProgress();
        this.rebuildPixelScene();
        this.updateHUD();
        return true;
    }

    isCampaignCompleted() {
        return !this.isRewardStage && !!this.campaignCompleted;
    }

    resolveRewardLevelId(rewardSourceLevel, preferredLevelId = null) {
        this.refreshLevelCatalog();
        if (this.rewardLevelCount <= 0) {
            return null;
        }

        const minRewardId = BONUS_LEVEL_ID;
        const maxRewardId = toRewardLevelId(this.rewardLevelCount);
        const preferred = Math.floor(Number(preferredLevelId) || 0);
        if (preferred >= minRewardId && preferred <= maxRewardId) {
            return preferred;
        }

        const sourceLevel = normalizePlayableLevel(rewardSourceLevel, this.normalLevelCount);
        if (!sourceLevel) {
            return null;
        }
        const rewardIndex = Math.max(
            1,
            Math.min(this.rewardLevelCount, Math.floor(Number(this.nextRewardLevelIndex) || 1))
        );
        this.nextRewardLevelIndex = rewardIndex >= this.rewardLevelCount ? 1 : (rewardIndex + 1);
        return toRewardLevelId(rewardIndex);
    }

    startLevel(levelNum, options = {}) {
        resumeAudio();
        this.refreshLevelCatalog();
        const stageType = options?.stageType === 'reward' ? 'reward' : 'normal';
        const isRewardStage = stageType === 'reward';
        const sourceLevel = normalizePlayableLevel(options?.rewardSourceLevel ?? this.currentLevel, this.normalLevelCount);
        const rewardLevelId = isRewardStage
            ? this.resolveRewardLevelId(sourceLevel, options?.rewardLevelId ?? levelNum)
            : null;
        if (isRewardStage && !rewardLevelId) {
            this.startNormalLevel(
                normalizePlayableLevel(options?.rewardReturnLevel || (sourceLevel + 1), this.normalLevelCount)
            );
            return;
        }
        const normalizedLevel = isRewardStage
            ? rewardLevelId
            : normalizePlayableLevel(levelNum, this.normalLevelCount);
        this.currentLevel = normalizedLevel;
        this.isRewardStage = isRewardStage;
        this.rewardSourceLevel = isRewardStage ? sourceLevel : null;
        this.rewardReturnLevel = isRewardStage
            ? normalizePlayableLevel(options?.rewardReturnLevel || (sourceLevel + 1), this.normalLevelCount)
            : null;
        if (!isRewardStage) {
            this.pendingRewardReturnLevel = null;
            this.pendingRewardSourceLevel = null;
        }
        const startedAt = nowMs();
        const config = getLevelConfig(normalizedLevel);
        const preparedRecord = this.getPreparedLevelRecord(normalizedLevel);
        const cachedLevelData = isStoredLevelDataUsable(preparedRecord?.data) ? preparedRecord.data : null;
        let source = cachedLevelData ? 'cache' : 'generate';

        try {
            this.applyRuntimeLevelData(config, cachedLevelData);
        } catch (error) {
            console.warn('[game] level load failed, fallback to generator', {
                level: normalizedLevel,
                source,
                error: error instanceof Error ? error.message : String(error)
            });
            source = 'fallback-generate';
            this.applyRuntimeLevelData(config, null);
        }

        this.resetEnergyBatches();
        this.lives = this.lifeSystemEnabled ? config.lives : 0;
        this.maxLives = this.lifeSystemEnabled ? config.lives : 0;
        this.score = 0;
        this.lastCoinReward = 0;
        this.combo = 0;
        this.bestComboThisLevel = 0;
        this.lastComboReleaseAt = 0;
        this.releaseSfxScoreEventCount = 0;
        this.hasTimer = !!config.hasTimer && Number(config.timerSeconds) > 0;
        this.maxTimeRemaining = this.hasTimer ? Math.max(1, Number(config.timerSeconds) || 0) : 0;
        this.timeRemaining = this.maxTimeRemaining;
        this.misclickPenaltySeconds = Math.max(0, Math.round(Number(config.misclickPenaltySeconds ?? 1) || 0));
        this.currentStageLabel = this.resolveStageLabel(config);
        this.currentScorePerBodySegment = this.resolveScorePerBodySegment(config);
        this.hintLine = null;
        this.undoStack = [];
        this.resetToolUses();
        this.state = 'PLAYING';
        this.campaignCompleted = false;
        this.lastSnakeInteractionTime = performance.now();
        this.dragReleaseActive = false;
        this.dragReleaseLineIds.clear();
        this.suppressClickUntil = 0;

        console.info('[game] level ready ' + JSON.stringify({
            level: normalizedLevel,
            stage: isRewardStage ? 'reward' : 'normal',
            rewardReturnLevel: this.rewardReturnLevel,
            source,
            lineCount: Array.isArray(this.lines) ? this.lines.length : 0,
            durationMs: Math.round(nowMs() - startedAt),
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height
        }));

        if (this.canvas.width <= 1 || this.canvas.height <= 1) {
            requestAnimationFrame(() => {
                this.resize();
                console.info('[game] deferred resize ' + JSON.stringify({
                    level: normalizedLevel,
                    canvasWidth: this.canvas.width,
                    canvasHeight: this.canvas.height
                }));
            });
        }
        this.updateHUD();
    }

    applyRuntimeLevelData(config, levelData = null) {
        const gridCols = levelData?.gridCols || config.gridCols;
        const gridRows = levelData?.gridRows || config.gridRows;

        this.grid = new Grid(gridCols, gridRows);
        this.grid.resize(this.canvas.width, this.canvas.height);

        const generated = levelData ? null : buildPlayableLevel(config);
        const lines = levelData
            ? deserializeLevelData(levelData)
            : (Array.isArray(generated) ? generated : (generated?.lines || []));

        if (!Array.isArray(lines) || lines.length === 0) {
            throw new Error(`empty line list for level ${config.level}`);
        }

        this.lines = lines;
        this.rebuildLineLookup();
        this.markSortedLinesDirty();
        this.grid.clear();
        for (const line of this.lines) {
            if (!line || !Array.isArray(line.cells) || line.cells.length < 2) {
                throw new Error(`invalid line data for level ${config.level}`);
            }
            this.grid.registerLine(line);
        }
        this.rebuildPixelScene();
    }

    getPreparedLevelRecord(levelNum) {
        // Only saved records are considered persistent level data.
        return getSavedLevelRecord(levelNum);
    }

    resolveStageLabel(config) {
        if (!this.isRewardStage && !config?.isRewardLevel) {
            return '';
        }
        const customName = `${config?.displayName || ''}`.trim();
        return customName || '奖励关';
    }

    resolveScorePerBodySegment(config) {
        if (!this.isRewardStage) {
            return SCORE_PER_BODY_SEGMENT;
        }
        const configured = Math.floor(Number(config?.rewardScorePerBodySegment) || 0);
        return Math.max(1, configured || DEFAULT_REWARD_SCORE_PER_BODY_SEGMENT);
    }

    handleClick(event) {
        if (this.state !== 'PLAYING' || !this.grid) {
            return;
        }
        if (nowMs() < this.suppressClickUntil) {
            return;
        }

        const point = this.getCanvasPoint(event);
        if (!point) {
            return;
        }
        this.tryReleaseAtPoint(point.x, point.y, {
            allowPenalty: true,
            trackDragTarget: false
        });
    }

    handlePointerDown(event) {
        if (this.state !== 'PLAYING' || !this.grid) {
            return;
        }
        if (event?.button !== undefined && event.button !== 0) {
            return;
        }

        const point = this.getCanvasPoint(event);
        if (!point) {
            return;
        }

        if (this.canUseDragRelease(event)) {
            if (typeof event?.preventDefault === 'function') {
                event.preventDefault();
            }
            this.dragReleaseActive = true;
            this.dragReleaseLineIds.clear();
            this.suppressClickUntil = nowMs() + DRAG_RELEASE_CLICK_SUPPRESS_MS;
            this.tryReleaseAtPoint(point.x, point.y, {
                allowPenalty: false,
                trackDragTarget: true
            });
            return;
        }

        // Normal stages: release immediately on press to remove click-up latency.
        this.suppressClickUntil = nowMs() + DRAG_RELEASE_CLICK_SUPPRESS_MS;
        this.tryReleaseAtPoint(point.x, point.y, {
            allowPenalty: true,
            trackDragTarget: false
        });
    }

    handlePointerMove(event) {
        if (this.dragReleaseActive && event?.buttons !== undefined && (event.buttons & 1) !== 1) {
            this.handlePointerUp({ button: 0 });
            return;
        }
        if (!this.dragReleaseActive || !this.canUseDragRelease(event)) {
            return;
        }
        if (typeof event?.preventDefault === 'function') {
            event.preventDefault();
        }
        const point = this.getCanvasPoint(event);
        if (!point) {
            return;
        }

        this.tryReleaseAtPoint(point.x, point.y, {
            allowPenalty: false,
            trackDragTarget: true
        });
        this.suppressClickUntil = nowMs() + DRAG_RELEASE_CLICK_SUPPRESS_MS;
    }

    handlePointerUp(event) {
        if (event && event.button !== undefined && event.button !== 0) {
            return;
        }
        if (!this.dragReleaseActive) {
            return;
        }
        this.dragReleaseActive = false;
        this.dragReleaseLineIds.clear();
        this.suppressClickUntil = nowMs() + DRAG_RELEASE_CLICK_SUPPRESS_MS;
    }

    canUseDragRelease(event) {
        if (this.state !== 'PLAYING' || !this.grid || !this.isRewardStage) {
            return false;
        }
        if (event?.buttons !== undefined && event.type === 'mousemove') {
            return (event.buttons & 1) === 1;
        }
        if (event?.button !== undefined) {
            return event.button === 0;
        }
        return true;
    }

    getCanvasPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
        const clientX = Number(event?.clientX ?? event?.pageX);
        const clientY = Number(event?.clientY ?? event?.pageY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return null;
        }
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    tryReleaseAtPoint(x, y, options = {}) {
        if (this.state !== 'PLAYING' || !this.grid) {
            return false;
        }

        resumeAudio();
        const clickedLine = this.findTopLineAtPoint(x, y);
        if (!clickedLine) {
            return false;
        }

        const trackDragTarget = !!options.trackDragTarget;
        if (trackDragTarget && this.dragReleaseLineIds.has(clickedLine.id)) {
            return false;
        }

        this.lastSnakeInteractionTime = performance.now();
        if (typeof clickedLine.pokeSoft === 'function') {
            clickedLine.pokeSoft(0.85);
        }
        if (typeof clickedLine.onClicked === 'function') {
            clickedLine.onClicked();
        }

        const result = canMove(clickedLine, this.lines, this.grid);
        if (result.canMove) {
            this.removeLine(clickedLine);
            if (trackDragTarget) {
                this.dragReleaseLineIds.add(clickedLine.id);
            }
            return true;
        }

        if (options.allowPenalty !== false) {
            this.errorOnLine(clickedLine, result.distance);
        }
        return false;
    }

    findTopLineAt(col, row) {
        const lineIds = this.grid.getLinesAt(col, row);
        let topLine = null;

        for (const lineId of lineIds) {
            const line = this.lineById.get(lineId);
            if (!line || line.state !== 'active') continue;
            if (!topLine || line.zIndex > topLine.zIndex) {
                topLine = line;
            }
        }

        return topLine;
    }

    findTopLineAtPoint(x, y) {
        const sortedLines = this.getSortedLines('desc');

        const threshold = this.grid.cellSize * 0.26;
        const headThreshold = this.grid.cellSize * 0.4;

        for (const line of sortedLines) {
            if (!line || line.state !== 'active') {
                continue;
            }
            const points = line.getScreenPoints(this.grid);
            const head = points[points.length - 1];

            if (distance(x, y, head.x, head.y) <= headThreshold) {
                return line;
            }

            for (let i = 0; i < points.length - 1; i++) {
                if (distanceToSegment(x, y, points[i], points[i + 1]) <= threshold) {
                    return line;
                }
            }
        }

        const gridPos = this.grid.screenToGrid(x, y);
        return gridPos ? this.findTopLineAt(gridPos.col, gridPos.row) : null;
    }

    removeLine(line) {
        const currentMs = nowMs();
        const isComboWindowActive = this.combo > 0
            && this.lastComboReleaseAt > 0
            && (currentMs - this.lastComboReleaseAt) <= this.comboWindowMs;
        const nextCombo = isComboWindowActive ? (this.combo + 1) : 1;
        const comboTimerReward = this.getComboTimerReward(nextCombo);
        const energyBatchId = (this.hasTimer && comboTimerReward > 0) ? this.createEnergyBatch() : null;
        this.undoStack.push({
            lineId: line.id,
            combo: this.combo,
            lastComboReleaseAt: this.lastComboReleaseAt,
            releaseSfxScoreEventCount: this.releaseSfxScoreEventCount,
            score: this.score,
            lives: this.lives,
            timeRemaining: this.timeRemaining,
            energyBatchId
        });

        this.grid.unregisterLine(line);
        this.markSortedLinesDirty();
        this.combo = nextCombo;
        this.bestComboThisLevel = Math.max(this.bestComboThisLevel, this.combo);
        this.lastComboReleaseAt = currentMs;
        playReleaseScaleSound(this.combo - 1);

        const headPos = this.grid.gridToScreen(line.headCell.col, line.headCell.row);
        const boardLeft = this.grid.offsetX;
        const boardTop = this.grid.offsetY;
        const boardRight = boardLeft + this.grid.cols * this.grid.cellSize;
        const boardBottom = boardTop + this.grid.rows * this.grid.cellSize;
        const headDirection = typeof line.getHeadDirection === 'function' ? line.getHeadDirection() : (line.direction || 'right');
        const removeDir = headDirection === 'left'
            ? { dx: -1, dy: 0 }
            : headDirection === 'up'
                ? { dx: 0, dy: -1 }
                : headDirection === 'down'
                    ? { dx: 0, dy: 1 }
                    : { dx: 1, dy: 0 };
        const borderOutPad = Math.max(3, this.grid.cellSize * 0.08);
        const floatingYPad = Math.max(14, this.grid.cellSize * 0.32);
        if (typeof line.pokeSoft === 'function') {
            line.pokeSoft(1.4);
        }

        if (comboTimerReward > 0) {
            this.emitTimerEnergyFromPoint(headPos, energyBatchId, line.id, comboTimerReward);
        }
        this.animations.startRemoveAnimation(line, this.grid, {
            onSegment: (source) => {
                const sourceX = Number(source?.x) || headPos.x;
                const sourceY = Number(source?.y) || headPos.y;

                let edgeX = sourceX;
                let edgeY = sourceY;
                if (removeDir.dx > 0) {
                    edgeX = boardRight;
                } else if (removeDir.dx < 0) {
                    edgeX = boardLeft;
                } else if (removeDir.dy > 0) {
                    edgeY = boardBottom;
                } else if (removeDir.dy < 0) {
                    edgeY = boardTop;
                }

                const burstX = edgeX + removeDir.dx * borderOutPad;
                const burstY = edgeY + removeDir.dy * borderOutPad;
                const textX = burstX + removeDir.dx * Math.max(4, this.grid.cellSize * 0.06);
                const textY = burstY - floatingYPad;

                const gainedScore = this.currentScorePerBodySegment;
                this.score += gainedScore;
                this.releaseSfxScoreEventCount += 1;
                const shouldPlayReleaseSfx = (this.releaseSfxScoreEventCount % RELEASE_SFX_EVERY_N_SCORE_EVENTS) === 0;
                if (shouldPlayReleaseSfx) {
                    playClearSoundExclusive();
                }
                // Release SFX playback is throttled by gameplay parameter releaseSfxEveryNScoreEvents.
                this.animations.addFloatingText(textX, textY, `+${gainedScore}`, '#fffbea', 20, {
                    life: 0.88,
                    vy: -36,
                    scale: 1.08,
                    scaleDecay: 0.985
                });
                this.animations.addConfetti(
                    burstX,
                    burstY,
                    SCORE_BURST_STAR_COUNT,
                    SCORE_BURST_STAR_COLORS,
                    'star',
                    {
                        speedMin: 42,
                        speedMax: 96,
                        riseBias: 72,
                        sizeMin: 2.2,
                        sizeMax: 4.6,
                        lifeMin: 0.36,
                        lifeMax: 0.72,
                        rotationSpeed: 6
                    }
                );

                if (this.onScoreGain) {
                    this.onScoreGain({
                        gained: gainedScore,
                        score: this.score,
                        combo: this.combo
                    });
                } else {
                    this.updateHUD();
                }
            },
            onComplete: () => this.checkLevelComplete()
        });

        this.hintLine = null;
        this.updateHUD();
    }

    errorOnLine(line, distanceCells) {
        this.combo = 0;
        this.lastComboReleaseAt = 0;
        playErrorSound();

        if (this.onCollision) {
            this.onCollision();
        }

        this.animations.startErrorAnimation(line, distanceCells, this.grid);
        if (typeof line.pokeSoft === 'function') {
            line.pokeSoft(1.8);
        }

        if (this.hasTimer && this.misclickPenaltySeconds > 0 && this.state === 'PLAYING') {
            const prevTime = this.timeRemaining;
            this.timeRemaining = Math.max(0, this.timeRemaining - this.misclickPenaltySeconds);
            const deducted = prevTime - this.timeRemaining;

            if (deducted > 0) {
                const center = this.grid.gridToScreen(this.grid.cols / 2, this.grid.rows * 0.68);
                this.animations.addFloatingText(center.x, center.y, `-${formatPenaltySecondsLabel(deducted)}`, '#8b2f4f', 18, {
                    pill: true,
                    pillColor: '#ffe1eb',
                    life: MISCLICK_PENALTY_TEXT_DURATION_SECONDS,
                    vy: -30,
                    stroke: false
                });
                this.updateTimerUI();
            }

            if (prevTime > 0 && this.timeRemaining <= 0) {
                setTimeout(() => {
                    if (this.state === 'PLAYING') {
                        this.gameOver('Time is up');
                    }
                }, 450);
            }
        }

        if (this.lifeSystemEnabled) {
            this.lives = Math.max(0, this.lives - 1);
            const center = this.grid.gridToScreen(this.grid.cols / 2, this.grid.rows * 0.72);
            this.animations.addFloatingText(center.x, center.y, '-1 Life', '#5a3f33', 18, {
                pill: true,
                pillColor: '#ffe9dc',
                life: 0.9,
                vy: -30,
                stroke: false
            });

            if (this.lives <= 0) {
                setTimeout(() => this.gameOver('No lives left'), 450);
            }
        }

        this.updateHUD();
    }

    checkLevelComplete() {
        // Multiple remove-animation callbacks can arrive after a level is already settled.
        // Only settle rewards once while actively playing.
        if (this.state !== 'PLAYING') return;

        // Wait until every snake has fully finished remove animation and score emission.
        // If we only check `active`, settlement may pop while the last snake is still in
        // `removing` state, causing final score/coin undercount.
        const unfinished = this.lines.filter((line) => line.state !== 'removed');
        if (unfinished.length !== 0) return;

        this.refreshLevelCatalog();
        this.state = 'LEVEL_COMPLETE';
        this.lastComboReleaseAt = 0;
        this.resetEnergyBatches();
        playLevelCompleteSound();
        const coinsEarned = Math.floor(Math.max(0, this.score) / SCORE_PER_COIN);
        this.lastCoinReward = coinsEarned;
        if (coinsEarned > 0) {
            this.coins += coinsEarned;
        }

        if (this.isRewardStage) {
            this.pendingRewardReturnLevel = null;
            this.pendingRewardSourceLevel = null;
            this.campaignCompleted = false;
        } else {
            const isFinalNormalLevel = this.currentLevel >= this.normalLevelCount;
            let unlockedRewardStage = false;
            if (this.currentLevel >= this.maxUnlockedLevel) {
                this.maxUnlockedLevel = Math.min(this.normalLevelCount, this.currentLevel + 1);
            }
            if (!isFinalNormalLevel && this.rewardLevelCount > 0 && this.bestComboThisLevel > REWARD_COMBO_THRESHOLD) {
                this.pendingRewardReturnLevel = normalizePlayableLevel(this.currentLevel + 1, this.normalLevelCount);
                this.pendingRewardSourceLevel = normalizePlayableLevel(this.currentLevel, this.normalLevelCount);
                unlockedRewardStage = true;
            } else {
                this.pendingRewardReturnLevel = null;
                this.pendingRewardSourceLevel = null;
            }
            this.campaignCompleted = isFinalNormalLevel;
            if (unlockedRewardStage && typeof this.onRewardStageUnlocked === 'function') {
                this.onRewardStageUnlocked({
                    level: this.currentLevel,
                    combo: this.bestComboThisLevel,
                    threshold: REWARD_COMBO_THRESHOLD
                });
            }
        }
        this.saveProgress();
        this.showLevelComplete();
    }

    gameOver(reason) {
        this.state = 'GAME_OVER';
        this.lastComboReleaseAt = 0;
        this.resetEnergyBatches();
        this.dragReleaseActive = false;
        this.dragReleaseLineIds.clear();
        playGameOverSound();
        this.animations.addConfetti(this.canvas.width / 2, this.canvas.height / 2, 60, ['#ff8ca8', '#ffd5a8', '#fff1d5'], 'star');
        this.showGameOver(reason);
    }

    useHint() {
        if (this.state !== 'PLAYING') return;
        const source = this.consumeToolUse('hint');
        if (!source) return;

        const movableLines = findMovableLines(this.lines, this.grid);
        this.hintLine = movableLines[0] || null;
        if (!this.hintLine) {
            this.restoreToolUse('hint', source);
        }
        this.updateHUD();
    }

    useUndo() {
        if (this.state !== 'PLAYING' || this.undoStack.length === 0) return;
        const source = this.consumeToolUse('undo');
        if (!source) return;

        const undo = this.undoStack[this.undoStack.length - 1];
        const line = this.lineById.get(undo.lineId);
        if (!line || line.state === 'active') {
            this.restoreToolUse('undo', source);
            return;
        }

        this.undoStack.pop();

        line.state = 'active';
        line.opacity = 1;
        line.trails = [];
        line._removeAnim = null;
        line.removeTint = null;
        this.grid.registerLine(line);
        this.markSortedLinesDirty();
        this.combo = undo.combo;
        this.lastComboReleaseAt = Number(undo.lastComboReleaseAt) || 0;
        this.releaseSfxScoreEventCount = Math.max(0, Math.floor(Number(undo.releaseSfxScoreEventCount) || 0));
        this.score = undo.score;
        this.lives = undo.lives;
        if (typeof undo.energyBatchId === 'number') {
            this.cancelEnergyBatch(undo.energyBatchId);
        }
        if (typeof undo.timeRemaining === 'number') {
            this.timeRemaining = this.clampTime(undo.timeRemaining);
            this.updateTimerUI();
        }
        this.updateHUD();
    }

    useShuffle() {
        if (this.state !== 'PLAYING') return;
        const source = this.consumeToolUse('shuffle');
        if (!source) return;

        const activeLines = this.lines.filter((line) => line.state === 'active');
        if (activeLines.length < 2) {
            this.restoreToolUse('shuffle', source);
            return;
        }

        const zIndices = activeLines.map((line) => line.zIndex);
        for (let i = zIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [zIndices[i], zIndices[j]] = [zIndices[j], zIndices[i]];
        }

        activeLines.forEach((line, index) => {
            line.zIndex = zIndices[index];
        });
        this.markSortedLinesDirty();
        this.hintLine = null;
        this.updateHUD();
    }

    render(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;
        this.consumeTimer(dt);
        this.updateComboTimeout(timestamp);
        const globalIdleSeconds = this.state === 'PLAYING'
            ? Math.max(0, (timestamp - this.lastSnakeInteractionTime) / 1000)
            : 0;
        this.animations.update(dt, Array.isArray(this.lines) ? this.lines : [], globalIdleSeconds);

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        ctx.clearRect(0, 0, width, height);

        if (this.state === 'PLAYING' || this.state === 'LEVEL_COMPLETE' || this.state === 'GAME_OVER') {
            ctx.save();
            const shake = this.animations.getScreenShakeOffset();
            ctx.translate(shake.x, shake.y);
            this.drawPixelBoardBackground(ctx);
            this.drawGridDots(ctx);

            const sortedLines = this.getSortedLines('asc');

            for (const line of sortedLines) {
                if (!line || line.state === 'removed') {
                    continue;
                }
                if (line.trails.length > 0) {
                    line.drawTrails(ctx, this.grid, this.pixelTheme);
                }
            }

            for (const line of sortedLines) {
                if (!line || line.state === 'removed') {
                    continue;
                }
                if (this.hintLine && line.id === this.hintLine.id) {
                    ctx.save();
                    ctx.shadowColor = '#ffd68f';
                    ctx.shadowBlur = 20;
                    ctx.globalAlpha = 0.95;
                    line.removeTint = '#ffd68f';
                    line.draw(ctx, this.grid, this.pixelTheme);
                    line.removeTint = null;
                    ctx.restore();
                } else {
                    line.draw(ctx, this.grid, this.pixelTheme);
                }
            }

            ctx.restore();
            this.animations.drawParticles(ctx, this.pixelTheme);
            this.animations.drawFloatingTexts(ctx);
        }

        requestAnimationFrame((nextTimestamp) => this.render(nextTimestamp));
    }

    drawGridDots(ctx) {
        if (!this.grid) return;
        if (this.gridDotsLayer) {
            ctx.drawImage(this.gridDotsLayer, 0, 0);
            return;
        }

        if (this.pixelTheme?.atlas?.sprites?.gridDot) {
            const sprite = this.pixelTheme.atlas.sprites.gridDot;
            for (let row = 0; row <= this.grid.rows; row++) {
                for (let col = 0; col <= this.grid.cols; col++) {
                    const x = this.grid.offsetX + col * this.grid.cellSize;
                    const y = this.grid.offsetY + row * this.grid.cellSize;
                    drawSprite(ctx, sprite, x, y, { alpha: 0.92 });
                }
            }
            return;
        }

        ctx.fillStyle = '#ececf4';
        for (let row = 0; row <= this.grid.rows; row++) {
            for (let col = 0; col <= this.grid.cols; col++) {
                const x = this.grid.offsetX + col * this.grid.cellSize;
                const y = this.grid.offsetY + row * this.grid.cellSize;
                ctx.beginPath();
                ctx.arc(x, y, 1.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    rebuildPixelScene() {
        if (!this.grid) {
            this.pixelTheme = null;
            this.gridDotsLayer = null;
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const atlas = buildGameSpriteAtlas(this.grid.cellSize, dpr, 'moleFamily', this.selectedSkinId);
        const tileKeys = ['tileBase', 'tileVar1', 'tileVar2'];
        const tileSprite = atlas.sprites.tileBase;
        const tileSize = Math.max(8, tileSprite.width);
        const minX = this.grid.offsetX;
        const minY = this.grid.offsetY;
        const maxX = this.grid.offsetX + this.grid.cols * this.grid.cellSize;
        const maxY = this.grid.offsetY + this.grid.rows * this.grid.cellSize;
        const tiles = [];
        const seed = this.currentLevel || 1;

        for (let y = minY; y < maxY; y += tileSize) {
            for (let x = minX; x < maxX; x += tileSize) {
                const h = hashPoint(Math.floor(x / tileSize), Math.floor(y / tileSize), seed);
                const index = h < 0.64 ? 0 : (h < 0.83 ? 1 : 2);
                tiles.push({
                    x: x + tileSize / 2,
                    y: y + tileSize / 2,
                    key: tileKeys[index]
                });
            }
        }

        const decor = [];
        const decorKeys = ['decoRune', 'decoTorch'];
        const decorCount = Math.max(18, Math.floor((this.grid.cols * this.grid.rows) / 18));
        for (let i = 0; i < decorCount; i++) {
            const x = minX + 10 + hashPoint(i, seed, 31) * Math.max(1, maxX - minX - 20);
            const y = minY + 10 + hashPoint(seed, i, 59) * Math.max(1, maxY - minY - 20);
            const kind = hashPoint(i, i + seed, 7) > 0.5 ? decorKeys[1] : decorKeys[0];
            decor.push({
                x,
                y,
                key: kind,
                alpha: 0.33 + hashPoint(i, seed, 91) * 0.32
            });
        }

        this.pixelTheme = { atlas, tiles, decor };
        this.gridDotsLayer = document.createElement('canvas');
        this.gridDotsLayer.width = this.canvas.width;
        this.gridDotsLayer.height = this.canvas.height;
        const dotsCtx = this.gridDotsLayer.getContext('2d');
        if (dotsCtx) {
            if (this.pixelTheme?.atlas?.sprites?.gridDot) {
                const sprite = this.pixelTheme.atlas.sprites.gridDot;
                for (let row = 0; row <= this.grid.rows; row++) {
                    for (let col = 0; col <= this.grid.cols; col++) {
                        const x = this.grid.offsetX + col * this.grid.cellSize;
                        const y = this.grid.offsetY + row * this.grid.cellSize;
                        drawSprite(dotsCtx, sprite, x, y, { alpha: 0.92 });
                    }
                }
            } else {
                dotsCtx.fillStyle = '#ececf4';
                for (let row = 0; row <= this.grid.rows; row++) {
                    for (let col = 0; col <= this.grid.cols; col++) {
                        const x = this.grid.offsetX + col * this.grid.cellSize;
                        const y = this.grid.offsetY + row * this.grid.cellSize;
                        dotsCtx.beginPath();
                        dotsCtx.arc(x, y, 1.6, 0, Math.PI * 2);
                        dotsCtx.fill();
                    }
                }
            }
        }
        this.assignLineColorVariants();
    }

    assignLineColorVariants() {
        if (!Array.isArray(this.lines) || this.lines.length === 0) {
            return;
        }

        const atlas = this.pixelTheme?.atlas;
        const variantCount = Array.isArray(atlas?.snakeColorVariants) ? atlas.snakeColorVariants.length : 0;
        if (!atlas || atlas.skinAllowHueVariants === false || variantCount <= 1) {
            for (const line of this.lines) {
                line.colorVariantIndex = null;
            }
            return;
        }

        const assignment = buildLineColorVariantAssignment(this.lines, variantCount);
        for (const line of this.lines) {
            const fallback = Math.abs(Math.trunc(line?.id || 0)) % variantCount;
            line.colorVariantIndex = assignment.get(line.id) ?? fallback;
        }
    }

    drawPixelBoardBackground(ctx) {
        if (!this.grid || !this.pixelTheme?.atlas) return;

        const minX = this.grid.offsetX;
        const minY = this.grid.offsetY;
        const width = this.grid.cols * this.grid.cellSize;
        const height = this.grid.rows * this.grid.cellSize;
        ctx.save();
        ctx.fillStyle = this.pixelTheme.atlas.theme.boardBg;
        ctx.fillRect(minX, minY, width, height);
        ctx.strokeStyle = this.pixelTheme.atlas.theme.boardFrame;
        ctx.lineWidth = 4;
        ctx.strokeRect(minX, minY, width, height);
        ctx.restore();

        for (const tile of this.pixelTheme.tiles) {
            drawSprite(ctx, this.pixelTheme.atlas.sprites[tile.key], tile.x, tile.y, { alpha: 0.82 });
        }

        for (const item of this.pixelTheme.decor) {
            drawSprite(ctx, this.pixelTheme.atlas.sprites[item.key], item.x, item.y, { alpha: item.alpha });
        }
    }

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((timestamp) => this.render(timestamp));
    }

    updateHUD() {
        if (this.onHUDUpdate) {
            this.onHUDUpdate();
        }
    }

    resetToolUses() {
        this.baseToolUsesRemaining = { ...this.defaultToolUses };
        this.syncToolUsesFromPools();
    }

    getToolUses(type) {
        return Math.max(0, Number(this.toolUses?.[type] || 0));
    }

    consumeToolUse(type) {
        const key = `${type || ''}`.trim();
        const baseRemaining = Math.max(0, Number(this.baseToolUsesRemaining?.[key] || 0));
        const invRemaining = Math.max(0, Number(this.toolInventory?.[key] || 0));
        if (baseRemaining <= 0 && invRemaining <= 0) {
            return null;
        }
        if (baseRemaining > 0) {
            this.baseToolUsesRemaining[key] = baseRemaining - 1;
            this.syncToolUsesFromPools();
            return 'base';
        }
        this.toolInventory[key] = invRemaining - 1;
        this.syncToolUsesFromPools();
        this.writeLiveOpsPlayer();
        this.emitLiveOpsUpdated();
        return 'inventory';
    }

    restoreToolUse(type, source = 'base') {
        if (!(type in this.toolUses)) {
            return;
        }
        if (source === 'inventory') {
            this.toolInventory[type] = Math.max(0, Math.floor(Number(this.toolInventory[type]) || 0)) + 1;
            this.syncToolUsesFromPools();
            this.writeLiveOpsPlayer();
            this.emitLiveOpsUpdated();
            return;
        }
        const limit = Math.max(0, Number(this.defaultToolUses?.[type] || 0));
        const base = Math.max(0, Math.floor(Number(this.baseToolUsesRemaining?.[type] || 0)));
        this.baseToolUsesRemaining[type] = Math.min(limit, base + 1);
        this.syncToolUsesFromPools();
    }

    syncToolUsesFromPools() {
        this.toolUses = {
            hint: Math.max(0, Math.floor(Number(this.baseToolUsesRemaining.hint) || 0))
                + Math.max(0, Math.floor(Number(this.toolInventory.hint) || 0)),
            undo: Math.max(0, Math.floor(Number(this.baseToolUsesRemaining.undo) || 0))
                + Math.max(0, Math.floor(Number(this.toolInventory.undo) || 0)),
            shuffle: Math.max(0, Math.floor(Number(this.baseToolUsesRemaining.shuffle) || 0))
                + Math.max(0, Math.floor(Number(this.toolInventory.shuffle) || 0))
        };
    }

    applyRewardList(rewardList) {
        const rows = Array.isArray(rewardList) ? rewardList : [];
        let changed = false;
        let skinChanged = false;
        for (const row of rows) {
            const itemId = `${row?.itemId || ''}`.trim().toLowerCase();
            const amount = Math.max(0, Math.floor(Number(row?.amount) || 0));
            const itemDef = this.getLiveOpsItemDefinition(itemId);
            if (!itemId || amount <= 0) {
                continue;
            }
            if (itemId === 'coin') {
                this.coins += amount;
                changed = true;
                continue;
            }
            if (itemId === 'hint' || itemId === 'undo' || itemId === 'shuffle') {
                this.toolInventory[itemId] = Math.max(0, Math.floor(Number(this.toolInventory[itemId]) || 0)) + amount;
                changed = true;
                continue;
            }
            if (itemId === 'skin') {
                const catalog = Array.isArray(getSkinCatalogList()) ? getSkinCatalogList() : [];
                let granted = 0;
                let firstGrantedSkinId = '';
                for (const skin of catalog) {
                    if (granted >= amount) {
                        break;
                    }
                    const skinId = `${skin?.id || ''}`.trim();
                    if (!skinId || this.unlockedSkinIds.includes(skinId)) {
                        continue;
                    }
                    this.unlockedSkinIds = normalizeUnlockedSkins([...this.unlockedSkinIds, skinId]);
                    if (!firstGrantedSkinId) {
                        firstGrantedSkinId = skinId;
                    }
                    granted += 1;
                }
                if (granted > 0) {
                    changed = true;
                    skinChanged = true;
                    this.selectedSkinId = ensureSelectedSkin(firstGrantedSkinId || this.selectedSkinId, this.unlockedSkinIds);
                    setAudioSkinId(this.selectedSkinId);
                }
                continue;
            }
            if (itemDef?.type === 'skin') {
                const catalog = Array.isArray(getSkinCatalogList()) ? getSkinCatalogList() : [];
                const skin = catalog.find((entry) => `${entry?.id || ''}`.trim().toLowerCase() === itemId) || null;
                const skinId = `${skin?.id || ''}`.trim();
                if (skinId && !this.unlockedSkinIds.includes(skinId)) {
                    this.unlockedSkinIds = normalizeUnlockedSkins([...this.unlockedSkinIds, skinId]);
                    this.selectedSkinId = ensureSelectedSkin(skinId, this.unlockedSkinIds);
                    setAudioSkinId(this.selectedSkinId);
                    changed = true;
                    skinChanged = true;
                }
                continue;
            }
            const inventory = this.liveOpsPlayer?.inventory || {};
            inventory[itemId] = Math.max(0, Math.floor(Number(inventory[itemId]) || 0)) + amount;
            this.liveOpsPlayer = {
                ...this.liveOpsPlayer,
                inventory
            };
            changed = true;
        }
        if (!changed) {
            return;
        }
        this.syncToolUsesFromPools();
        this.writeLiveOpsPlayer();
        this.saveProgress();
        if (skinChanged) {
            this.rebuildPixelScene();
            this.updateHUD();
        }
    }

    resetOnlineRewardDayIfNeeded(forceWrite = false) {
        const cfg = this.getLiveOpsConfig().activities?.onlineReward || {};
        const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
        const resetHour = Math.max(0, Math.min(23, Math.floor(Number(cfg.resetHour) || 4)));
        const dayKey = getBusinessDayKeyByHour(new Date(), resetHour);
        const prev = this.liveOpsPlayer?.onlineReward || {};
        const firstSeconds = Math.max(0, Number(tiers[0]?.seconds) || 0);
        const changed = forceWrite || prev.dayKey !== dayKey;
        if (!changed) {
            return false;
        }
        this.liveOpsPlayer = {
            ...this.liveOpsPlayer,
            onlineReward: {
                dayKey,
                tierIndex: 0,
                remainingSeconds: firstSeconds
            }
        };
        this.writeLiveOpsPlayer();
        return true;
    }

    consumeOnlineRewardTimer(dt) {
        const cfg = this.getLiveOpsConfig().activities?.onlineReward || {};
        if (cfg.enabled === false) {
            return;
        }
        if (typeof document !== 'undefined' && document.hidden) {
            return;
        }
        this.resetOnlineRewardDayIfNeeded(false);
        const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
        const online = this.liveOpsPlayer?.onlineReward || {};
        const tierIndex = Math.max(0, Math.floor(Number(online.tierIndex) || 0));
        if (tierIndex >= tiers.length) {
            return;
        }
        const delta = Math.max(0, Number(dt) || 0);
        if (delta <= 0) {
            return;
        }
        const storedRemaining = Number(online.remainingSeconds);
        const tierDefaultSeconds = Math.max(0, Number(tiers[tierIndex]?.seconds) || 0);
        const previous = Number.isFinite(storedRemaining) ? Math.max(0, storedRemaining) : tierDefaultSeconds;
        const next = Math.max(0, previous - delta);
        if (next === previous) {
            return;
        }
        this.liveOpsPlayer = {
            ...this.liveOpsPlayer,
            onlineReward: {
                ...online,
                remainingSeconds: next
            }
        };
        this.onlineRewardSaveAccumulator += delta;
        if (next <= 0 || this.onlineRewardSaveAccumulator >= 8) {
            this.onlineRewardSaveAccumulator = 0;
            this.writeLiveOpsPlayer();
            this.emitLiveOpsUpdated();
        }
    }

    emitLiveOpsUpdated() {
        if (typeof this.onLiveOpsUpdate === 'function') {
            this.onLiveOpsUpdate();
        }
    }

    consumeTimer(dt) {
        this.consumeOnlineRewardTimer(dt);
        if (!this.hasTimer || this.state !== 'PLAYING') {
            return;
        }
        const delta = Math.max(0, Number(dt) || 0);
        if (delta <= 0) {
            return;
        }

        const prev = this.timeRemaining;
        this.timeRemaining = Math.max(0, this.timeRemaining - delta);
        if (this.timeRemaining !== prev) {
            this.updateTimerUI();
        }

        if (prev > 0 && this.timeRemaining <= 0) {
            this.gameOver('Time is up');
        }

    }

    updateComboTimeout(currentMs) {
        if (this.state !== 'PLAYING') {
            return;
        }
        if (this.combo <= 0 || this.lastComboReleaseAt <= 0) {
            return;
        }
        if ((Number(currentMs) || 0) - this.lastComboReleaseAt <= this.comboWindowMs) {
            return;
        }

        this.combo = 0;
        this.lastComboReleaseAt = 0;
        this.updateHUD();
    }

    createEnergyBatch() {
        const batchId = this.energyBatchSeq++;
        this.activeEnergyBatches.add(batchId);
        return batchId;
    }

    isEnergyBatchActive(batchId) {
        if (typeof batchId !== 'number') {
            return true;
        }
        return this.activeEnergyBatches.has(batchId);
    }

    cancelEnergyBatch(batchId) {
        if (typeof batchId !== 'number') {
            return;
        }
        if (!this.activeEnergyBatches.delete(batchId)) {
            return;
        }
        if (this.onTimerEnergyBatchCancel) {
            this.onTimerEnergyBatchCancel(batchId);
        }
    }

    resetEnergyBatches() {
        if (this.activeEnergyBatches.size === 0) {
            return;
        }
        this.activeEnergyBatches.clear();
        if (this.onTimerEnergyClear) {
            this.onTimerEnergyClear();
        }
    }

    emitTimerEnergyFromPoint(point, batchId, lineId, seconds = 1) {
        if (!this.hasTimer || !this.isEnergyBatchActive(batchId)) {
            return;
        }
        const gainSeconds = Math.max(0, Number(seconds) || 0);
        if (gainSeconds <= 0) {
            return;
        }
        const payload = {
            x: Number(point?.x) || 0,
            y: Number(point?.y) || 0,
            seconds: gainSeconds,
            batchId,
            lineId
        };
        if (this.onTimerEnergyEmit) {
            this.onTimerEnergyEmit(payload);
            return;
        }
        this.collectTimerEnergy(payload.seconds, payload.batchId, payload.lineId);
    }

    collectTimerEnergy(seconds = 1, batchId = null, lineId = null) {
        if (!this.hasTimer || this.state !== 'PLAYING') {
            return 0;
        }
        if (!this.isEnergyBatchActive(batchId)) {
            return 0;
        }
        if (typeof lineId === 'number') {
            const line = this.lines.find((item) => item.id === lineId);
            if (line?.state === 'active') {
                return 0;
            }
        }

        const gain = Math.max(0, Number(seconds) || 0);
        if (gain <= 0) {
            return 0;
        }

        const prev = this.timeRemaining;
        this.timeRemaining = this.clampTime(this.timeRemaining + gain);
        const actualGain = this.timeRemaining - prev;
        if (actualGain > 0) {
            this.updateTimerUI();
        }
        return actualGain;
    }

    clampTime(seconds) {
        const value = Math.max(0, Number(seconds) || 0);
        if (!this.hasTimer || this.maxTimeRemaining <= 0) {
            return 0;
        }
        return Math.min(this.maxTimeRemaining, value);
    }

    getComboTimerReward(comboCount = this.combo) {
        const combo = Math.max(0, Math.floor(Number(comboCount) || 0));
        if (combo <= 10) {
            return 0;
        }
        if (combo <= 50) {
            return 1;
        }
        if (combo <= 100) {
            return 2;
        }
        return 3;
    }

    updateTimerUI() {
        if (this.onTimerUpdate) {
            this.onTimerUpdate();
        }
    }

    playLevelCompleteCelebration() {
        this.animations.addConfetti(this.canvas.width * 0.2, this.canvas.height, 80, ['#ffd2a2', '#ffc6d8', '#b8f2a8'], 'leaf');
        this.animations.addConfetti(this.canvas.width * 0.5, this.canvas.height + 50, 100, ['#ffd2a2', '#ffc6d8', '#b8f2a8'], 'leaf');
        this.animations.addConfetti(this.canvas.width * 0.8, this.canvas.height, 80, ['#ffd2a2', '#ffc6d8', '#b8f2a8'], 'leaf');
    }

    showLevelComplete() {
        if (this.onLevelComplete) {
            this.onLevelComplete();
        }
    }

    showGameOver(reason) {
        if (this.onGameOver) {
            this.onGameOver(reason);
        }
    }
}

function normalizePlayableLevel(value, maxLevel = getNormalLevelCount()) {
    const safeMaxLevel = Math.max(1, Math.floor(Number(maxLevel) || 1));
    const level = Math.floor(Number(value) || 0);
    if (!Number.isFinite(level) || level < 1) {
        return 1;
    }
    return Math.min(safeMaxLevel, level);
}

function nowMs() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

function formatPenaltySecondsLabel(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    return `${seconds}s`;
}

function buildLineColorVariantAssignment(lines, variantCount) {
    const safeVariantCount = Math.max(1, Math.floor(Number(variantCount) || 1));
    const assignment = new Map();
    if (!Array.isArray(lines) || lines.length === 0 || safeVariantCount <= 1) {
        return assignment;
    }

    const neighbors = buildLineNeighborGraph(lines);
    const usage = new Array(safeVariantCount).fill(0);
    const ordered = [...lines].sort((a, b) => {
        const degreeA = neighbors.get(a.id)?.size || 0;
        const degreeB = neighbors.get(b.id)?.size || 0;
        if (degreeA !== degreeB) {
            return degreeB - degreeA;
        }
        const lenA = Array.isArray(a.cells) ? a.cells.length : 0;
        const lenB = Array.isArray(b.cells) ? b.cells.length : 0;
        if (lenA !== lenB) {
            return lenB - lenA;
        }
        return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    for (const line of ordered) {
        const lineId = line?.id;
        const preferred = Math.abs(Math.trunc(Number(lineId) || 0)) % safeVariantCount;
        const conflictCounts = new Array(safeVariantCount).fill(0);
        const neighborSet = neighbors.get(lineId) || new Set();

        for (const neighborId of neighborSet) {
            const variant = assignment.get(neighborId);
            if (Number.isInteger(variant) && variant >= 0 && variant < safeVariantCount) {
                conflictCounts[variant] += 1;
            }
        }

        let bestVariant = 0;
        for (let variant = 1; variant < safeVariantCount; variant++) {
            if (isVariantCandidateBetter(
                variant,
                bestVariant,
                conflictCounts,
                usage,
                preferred,
                safeVariantCount
            )) {
                bestVariant = variant;
            }
        }

        assignment.set(lineId, bestVariant);
        usage[bestVariant] += 1;
    }

    return assignment;
}

function isVariantCandidateBetter(candidate, currentBest, conflictCounts, usage, preferred, variantCount) {
    const candidateConflict = conflictCounts[candidate];
    const bestConflict = conflictCounts[currentBest];
    if (candidateConflict !== bestConflict) {
        return candidateConflict < bestConflict;
    }

    const candidateUsage = usage[candidate];
    const bestUsage = usage[currentBest];
    if (candidateUsage !== bestUsage) {
        return candidateUsage < bestUsage;
    }

    const candidateDistance = cyclicVariantDistance(candidate, preferred, variantCount);
    const bestDistance = cyclicVariantDistance(currentBest, preferred, variantCount);
    if (candidateDistance !== bestDistance) {
        return candidateDistance < bestDistance;
    }

    return candidate < currentBest;
}

function cyclicVariantDistance(a, b, count) {
    const safeCount = Math.max(1, Math.floor(Number(count) || 1));
    const direct = Math.abs(a - b);
    return Math.min(direct, safeCount - direct);
}

function buildLineNeighborGraph(lines) {
    const neighbors = new Map();
    const ownerByCell = new Map();
    const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1]
    ];

    for (const line of lines) {
        neighbors.set(line.id, new Set());
        if (!Array.isArray(line.cells)) {
            continue;
        }
        for (const cell of line.cells) {
            ownerByCell.set(`${cell.col},${cell.row}`, line.id);
        }
    }

    for (const line of lines) {
        if (!Array.isArray(line.cells)) {
            continue;
        }
        const ownNeighbors = neighbors.get(line.id);
        for (const cell of line.cells) {
            for (const [dx, dy] of offsets) {
                const otherId = ownerByCell.get(`${cell.col + dx},${cell.row + dy}`);
                if (otherId === undefined || otherId === line.id) {
                    continue;
                }
                ownNeighbors?.add(otherId);
                neighbors.get(otherId)?.add(line.id);
            }
        }
    }

    return neighbors;
}

function isLevelSolvable(lines, config) {
    for (let attempt = 0; attempt < 14; attempt++) {
        const simGrid = new Grid(config.gridCols, config.gridRows);
        const simLines = lines.map((line) => ({
            id: line.id,
            zIndex: line.zIndex,
            state: 'active',
            exitLength: line.getExitCells(config.gridCols, config.gridRows).length,
            getExitCells: (...args) => line.getExitCells(...args)
        }));

        for (const line of lines) {
            simGrid.registerLine(line);
        }

        let removed = 0;
        while (removed < simLines.length) {
            const movable = simLines.filter((line) => line.state === 'active' && canMove(line, simLines, simGrid).canMove);
            if (movable.length === 0) {
                break;
            }

            const next = pickMovableLine(movable, attempt);
            next.state = 'removed';
            simGrid.unregisterLine(lines[next.id]);
            removed++;
        }

        if (removed === simLines.length) {
            return true;
        }
    }

    return false;
}

function buildGenerationVariants(config) {
    const variants = [];
    for (let step = 0; step < 6; step++) {
        const fillRatio = Math.max(0.56, (config.fillRatio ?? 0.82) - step * 0.04);
        const lineCount = Math.max(8, Math.floor(config.lineCount * (1 - step * 0.08)));
        variants.push({
            ...config,
            fillRatio,
            lineCount
        });
    }
    return variants;
}

function generateEmergencyLevel(config) {
    const lines = [];
    const maxCols = config.gridCols - 2;
    const maxRows = config.gridRows - 2;
    const templates = [
        { cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }], direction: 'right' },
        { cells: [{ col: 0, row: 1 }, { col: 0, row: 0 }], direction: 'up' },
        { cells: [{ col: 2, row: 0 }, { col: 2, row: 1 }], direction: 'down' },
        { cells: [{ col: 3, row: 1 }, { col: 2, row: 1 }], direction: 'left' }
    ];

    let id = 0;
    for (let row = 0; row < maxRows; row += 3) {
        for (let col = 0; col < maxCols; col += 4) {
            const tpl = templates[id % templates.length];
            const cells = tpl.cells
                .map((cell) => ({ col: cell.col + col, row: cell.row + row }))
                .filter((cell) => cell.col < config.gridCols && cell.row < config.gridRows);

            if (cells.length >= 2) {
                lines.push({
                    id,
                    cells,
                    direction: tpl.direction,
                    color: config.colors[id % config.colors.length]
                });
                id++;
            }
        }
    }

    return lines.map((line) => new Line(line.id, line.cells, line.direction, line.color));
}

function hasHeadInExitPath(lines, config) {
    const headMap = new Map();
    const occupied = new Set();

    for (const line of lines) {
        const headDirection = line.getHeadDirection();
        const key = `${line.headCell.col},${line.headCell.row}`;
        headMap.set(key, {
            col: line.headCell.col,
            row: line.headCell.row,
            direction: headDirection
        });

        for (const cell of line.cells) {
            occupied.add(`${cell.col},${cell.row}`);
        }
    }

    for (const head of headMap.values()) {
        const vector = directionVector(head.direction);
        let col = head.col + vector.dx;
        let row = head.row + vector.dy;

        while (col >= 0 && col < config.gridCols && row >= 0 && row < config.gridRows) {
            const key = `${col},${row}`;
            const otherHead = headMap.get(key);

            if (otherHead) {
                return true;
            }

            if (occupied.has(key)) {
                break;
            }

            col += vector.dx;
            row += vector.dy;
        }
    }

    return false;
}

function pickMovableLine(movable, strategyIndex) {
    const sorted = [...movable];

    switch (strategyIndex % 4) {
        case 0:
            sorted.sort((a, b) => b.zIndex - a.zIndex);
            return sorted[0];
        case 1:
            sorted.sort((a, b) => a.exitLength - b.exitLength);
            return sorted[0];
        case 2:
            sorted.sort((a, b) => a.zIndex - b.zIndex);
            return sorted[0];
        default:
            return sorted[Math.floor(Math.random() * sorted.length)];
    }
}

function directionVector(direction) {
    switch (direction) {
        case 'up':
            return { dx: 0, dy: -1 };
        case 'down':
            return { dx: 0, dy: 1 };
        case 'left':
            return { dx: -1, dy: 0 };
        default:
            return { dx: 1, dy: 0 };
    }
}

function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

function distanceToSegment(px, py, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
        return distance(px, py, start.x, start.y);
    }

    const t = Math.max(0, Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / (dx * dx + dy * dy)));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    return distance(px, py, projX, projY);
}













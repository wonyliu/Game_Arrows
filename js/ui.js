import { detectInitialLocale, persistLocale, resolveLocale, t } from './i18n.js?v=6';
import {
    BGM_SCENE_KEYS,
    playBgmForScene,
    playClickSound as playClickSoundV31,
    readAudioMixConfig,
    resumeAudio as resumeAudioV31,
    setMusicVolume,
    setSfxVolume,
    playCheckinRewardCoinSound
} from './audio.js?v=49';
import { getSkinDescription, getSkinDisplayName } from './skins.js?v=23';
import { readUiLayoutConfig, subscribeUiLayoutConfig } from './ui-layout-config.js?v=3';
import { getUiAsset } from './ui-theme.js?v=2';

const MENU_PANEL = Object.freeze({
    HOME: 'HOME',
    LEVEL_SELECT: 'LEVEL_SELECT',
    SETTINGS: 'SETTINGS',
    LEADERBOARD: 'LEADERBOARD',
    SKINS: 'SKINS',
    CHECKIN: 'CHECKIN',
    EXIT_CONFIRM: 'EXIT_CONFIRM',
    RESET_PROGRESS_CONFIRM: 'RESET_PROGRESS_CONFIRM'
});

const FEATURE_CONFIG = Object.freeze([
    { id: 'settings', buttonId: 'btnSettings', panelId: MENU_PANEL.SETTINGS, labelKey: 'feature.settings', iconSlot: 'icon.settings', badge: null, enabled: true },
    { id: 'leaderboard', buttonId: 'btnLeaderboard', panelId: MENU_PANEL.LEADERBOARD, labelKey: 'feature.leaderboard', iconSlot: 'icon.leaderboard', badge: null, enabled: true },
    { id: 'skins', buttonId: 'btnSkins', panelId: MENU_PANEL.SKINS, labelKey: 'feature.skins', iconSlot: 'icon.skins', badge: null, enabled: true },
    { id: 'checkin', buttonId: 'btnCheckin', panelId: MENU_PANEL.CHECKIN, labelKey: 'feature.checkin', iconSlot: 'icon.checkin', badge: null, enabled: true },
    { id: 'exit', buttonId: 'btnExit', panelId: MENU_PANEL.EXIT_CONFIRM, labelKey: 'feature.exit', iconSlot: 'icon.exit', badge: null, enabled: true }
]);

const TOOL_BUTTON_CONFIG = Object.freeze([
    { id: 'undo', buttonId: 'btnUndo' },
    { id: 'hint', buttonId: 'btnHint' },
    { id: 'shuffle', buttonId: 'btnShuffle' }
]);

const HOME_START_VISUAL_HITBOX = Object.freeze({
    x: 92.5,
    y: 332.5,
    width: 245,
    height: 91.1
});

const SETTINGS_ENTRY = Object.freeze({
    MENU: 'menu',
    GAME: 'game'
});

const SETTINGS_CONFIRM_MODE = Object.freeze({
    RESET_PROGRESS: 'reset-progress',
    END_RUN: 'end-run'
});

const LEVEL_SETTLE_MIN_MS = 700;
const LEVEL_SETTLE_MAX_MS = 1800;
const LEVEL_SETTLE_PER_POINT_MS = 0.4;
const CHECKIN_COIN_FLY_COUNT = 6;
const CHECKIN_COIN_FLY_DURATION_MS = 920;
const CHECKIN_COIN_COUNTER_DURATION_MS = 1040;

export class UI {
    constructor(game, options = {}) {
        this.game = game;
        this.options = options || {};
        this.locale = detectInitialLocale();
        this.menuState = MENU_PANEL.HOME;
        this.settingsEntry = SETTINGS_ENTRY.MENU;
        this.settingsConfirmMode = SETTINGS_CONFIRM_MODE.RESET_PROGRESS;
        this.lastStartTriggerAt = Number.NEGATIVE_INFINITY;
        this.menuBadges = Object.fromEntries(
            FEATURE_CONFIG.map((feature) => [feature.id, feature.badge ?? null])
        );

        this.hud = document.getElementById('hud');
        this.livesEl = document.getElementById('lives');
        this.levelInfoEl = document.getElementById('levelInfo');
        this.timerEl = document.getElementById('timer');
        this.timerFillEl = document.getElementById('timerFill');
        this.timerLabelEl = document.getElementById('timerLabel');
        this.comboDisplayEl = document.getElementById('comboDisplay');
        this.rewardUnlockToastEl = document.getElementById('rewardUnlockToast');
        this.rewardUnlockToastImageEl = document.getElementById('rewardUnlockToastImage');
        this.rewardUnlockToastTextEl = document.getElementById('rewardUnlockToastText');
        this.rewardUnlockToastTimer = 0;
        this.hudScoreValueEl = document.getElementById('hudScoreValue');
        this.hudScoreGainEl = document.getElementById('hudScoreGain');
        this.hudEnergyLayerEl = document.getElementById('hudEnergyLayer');
        this.energyOrbNodes = new Set();
        this.scorePulseAnimation = null;
        this.scoreGainAnimation = null;

        this.menuOverlay = document.getElementById('menuOverlay');
        this.settingsOverlay = document.getElementById('settingsOverlay');
        this.leaderboardOverlay = document.getElementById('leaderboardOverlay');
        this.skinsOverlay = document.getElementById('skinsOverlay');
        this.checkinOverlay = document.getElementById('checkinOverlay');
        this.checkinSceneEl = this.checkinOverlay?.querySelector('.checkin-scene') || null;
        this.checkinBackButtonEl = document.getElementById('btnBackFromCheckin');
        this.checkinCardEl = this.checkinOverlay?.querySelector('.checkin-card-notebook') || null;
        this.checkinRibbonEl = this.checkinOverlay?.querySelector('.checkin-ribbon') || null;
        this.checkinRibbonTitleEl = this.checkinOverlay?.querySelector('.checkin-ribbon-title') || null;
        this.checkinMascotEl = this.checkinOverlay?.querySelector('.checkin-mascot-snake') || null;
        this.exitOverlay = document.getElementById('exitOverlay');
        this.resetProgressOverlay = document.getElementById('resetProgressOverlay');

        this.levelCompleteOverlay = document.getElementById('levelCompleteOverlay');
        this.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.levelSelectOverlay = document.getElementById('levelSelectOverlay');
        this.levelCompleteTitleEl = document.querySelector('#levelCompleteOverlay .popup-title');
        this.levelCompleteNextButton = document.getElementById('btnNext');
        this.levelCompleteButtonsEl = document.querySelector('#levelCompleteOverlay .popup-buttons');

        this.levelScore = document.getElementById('levelScore');
        this.levelGrid = document.getElementById('levelGrid');
        this.gameOverReason = document.getElementById('gameOverReason');
        this.levelTag = document.getElementById('btnLevels');
        this.levelTagValue = document.getElementById('menuLevelTagValue');
        this.levelSelectCurrent = document.getElementById('levelSelectCurrent');
        this.exitFeedback = document.getElementById('exitFeedback');
        this.localeZhBtn = document.getElementById('btnLocaleZh');
        this.localeEnBtn = document.getElementById('btnLocaleEn');
        this.settingsMusicVolumeEl = document.getElementById('settingsMusicVolume');
        this.settingsSfxVolumeEl = document.getElementById('settingsSfxVolume');
        this.settingsMusicVolumeValueEl = document.getElementById('settingsMusicVolumeValue');
        this.settingsSfxVolumeValueEl = document.getElementById('settingsSfxVolumeValue');
        this.settingsEndRunRow = document.getElementById('settingsEndRunRow');
        this.settingsConfirmTitleEl = document.getElementById('settingsConfirmTitle');
        this.settingsConfirmDescEl = document.getElementById('settingsConfirmDesc');
        this.settingsConfirmActionBtn = document.getElementById('btnResetProgressConfirm');
        this.menuCoinValue = document.getElementById('menuCoinValue');
        this.hudCoinValue = document.getElementById('hudCoinValue');
        this.menuCoinDisplay = document.getElementById('menuCoinDisplay');
        this.menuCoinFlyRestore = null;
        this.skinList = document.getElementById('skinList');
        this.skinsCoinValue = document.getElementById('skinsCoinValue');
        this.levelCoinReward = document.getElementById('levelCoinReward');
        this.levelSettleAnimFrame = 0;
        this.isLevelSettleAnimating = false;
        this.checkinWeekGridEl = document.getElementById('checkinWeekGrid');
        this.checkinStatusEl = document.getElementById('checkinStatus');
        this.checkinRewardTooltipEl = document.getElementById('checkinRewardTooltip');
        this.activeCheckinTooltipDay = 0;
        this.onlineRewardDockEl = document.getElementById('onlineRewardDock');
        this.btnOnlineRewardChest = document.getElementById('btnOnlineRewardChest');
        this.onlineDockTextEl = document.getElementById('onlineDockText');
        this.onlineRewardPreviewBubbleEl = document.getElementById('onlineRewardPreviewBubble');
        this.onlineRewardSettleOverlay = document.getElementById('onlineRewardSettleOverlay');
        this.onlineRewardSettleDescEl = document.getElementById('onlineRewardSettleDesc');
        this.onlineRewardSettleListEl = document.getElementById('onlineRewardSettleList');
        this.btnOnlineRewardSettleCloseTop = document.getElementById('btnOnlineRewardSettleCloseTop');
        this.btnOnlineRewardSettleClose = document.getElementById('btnOnlineRewardSettleClose');
        this.checkinRewardSettleOverlay = document.getElementById('checkinRewardSettleOverlay');
        this.checkinRewardSettleDescEl = document.getElementById('checkinRewardSettleDesc');
        this.checkinRewardSettleListEl = document.getElementById('checkinRewardSettleList');
        this.checkinRewardCoinHeroEl = document.getElementById('checkinRewardCoinHero');
        this.checkinRewardCoinHeroIconEl = document.getElementById('checkinRewardCoinHeroIcon');
        this.checkinRewardCoinHeroAmountEl = document.getElementById('checkinRewardCoinHeroAmount');
        this.btnCheckinRewardConfirm = document.getElementById('btnCheckinRewardConfirm');
        this.rewardFlyLayerEl = document.getElementById('rewardFlyLayer');
        this.appContainerEl = document.querySelector('.app-container');
        this.coinDisplayOverride = null;
        this.checkinCoinCounterFrame = 0;
        this.pendingCheckinRewardPayload = null;
        this.pendingOnlineRewardPayload = null;
        this.onlineRewardSettleCoinIconEl = null;
        this.uiEditorPreviewOptions = this.options.uiEditorPreview || { enabled: false };
        this.audioEnabled = this.uiEditorPreviewOptions.enabled !== true;
        this.uiEditorPreviewOverride = null;
        this.uiLayoutConfig = readUiLayoutConfig();
        this.releaseUiLayoutSubscription = subscribeUiLayoutConfig((nextConfig) => {
            this.uiLayoutConfig = nextConfig;
            this.applyCheckinLayoutConfig();
            this.refreshCheckinPanel(false);
            this.updateCheckinSceneScale();
        });

        this.bindEvents();
        this.initAudioSettingsUi();
        if (this.audioEnabled) {
            this.setupAudioAutoUnlock();
        }
        this.bindGameCallbacks();
        this.applyThemeAssets();
        this.applyCheckinLayoutConfig();
        this.markUiEditorElements();
        this.setMenuBadges(this.menuBadges);
        this.applyLocalizedText();
        this.refreshCheckinPanel();
        this.updateCheckinSceneScale();
        this.onlineDockTicker = setInterval(() => {
            this.refreshOnlineRewardDock();
        }, 1000);
        window.addEventListener('resize', () => this.updateCheckinSceneScale());
        if (this.audioEnabled) {
            playBgmForScene(BGM_SCENE_KEYS.HOME);
        }

        if (this.game.isPlaytestMode) {
            this.startSpecificLevel(this.game.currentLevel);
        } else {
            this.goToMenu();
        }

        if (this.uiEditorPreviewOptions.enabled) {
            this.activateUiEditorPreview();
        }
    }

    setupAudioAutoUnlock() {
        const unlock = () => {
            try {
                resumeAudioV31();
            } catch (error) {
                console.warn('Audio resume failed during auto unlock:', error);
            }
            playBgmForScene(BGM_SCENE_KEYS.HOME);
            document.removeEventListener('pointerdown', unlock, true);
            document.removeEventListener('keydown', unlock, true);
            document.removeEventListener('touchstart', unlock, true);
        };

        document.addEventListener('pointerdown', unlock, true);
        document.addEventListener('keydown', unlock, true);
        document.addEventListener('touchstart', unlock, true);
    }

    initAudioSettingsUi() {
        this.syncAudioSettingsUi();
        this.bindAudioSlider(this.settingsMusicVolumeEl, (ratio) => {
            setMusicVolume(ratio);
            this.updateAudioSliderValueText(this.settingsMusicVolumeValueEl, ratio);
        });
        this.bindAudioSlider(this.settingsSfxVolumeEl, (ratio) => {
            setSfxVolume(ratio);
            this.updateAudioSliderValueText(this.settingsSfxVolumeValueEl, ratio);
        });
    }

    bindAudioSlider(inputEl, onChange) {
        if (!inputEl || typeof onChange !== 'function') {
            return;
        }
        const apply = () => {
            const ratio = Math.max(0, Math.min(1, Number(inputEl.value) / 100));
            onChange(ratio);
        };
        inputEl.addEventListener('input', apply);
        inputEl.addEventListener('change', apply);
    }

    syncAudioSettingsUi() {
        const config = readAudioMixConfig();
        const musicPercent = Math.round(Math.max(0, Math.min(1, Number(config.music) || 0)) * 100);
        const sfxPercent = Math.round(Math.max(0, Math.min(1, Number(config.sfx) || 0)) * 100);

        if (this.settingsMusicVolumeEl) {
            this.settingsMusicVolumeEl.value = String(musicPercent);
        }
        if (this.settingsSfxVolumeEl) {
            this.settingsSfxVolumeEl.value = String(sfxPercent);
        }
        this.updateAudioSliderValueText(this.settingsMusicVolumeValueEl, musicPercent / 100);
        this.updateAudioSliderValueText(this.settingsSfxVolumeValueEl, sfxPercent / 100);
    }

    updateAudioSliderValueText(targetEl, ratio) {
        if (!targetEl) {
            return;
        }
        const percent = Math.round(Math.max(0, Math.min(1, Number(ratio) || 0)) * 100);
        targetEl.textContent = `${percent}%`;
    }

    bindEvents() {
        this.bindButton('btnPlay', () => this.triggerStartGame());
        this.bindButton('btnLevels', () => this.showLevelSelect());
        this.bindButton('btnHint', () => this.game.useHint());
        this.bindButton('btnUndo', () => this.game.useUndo());
        this.bindButton('btnShuffle', () => this.game.useShuffle());

        this.bindButton('btnNext', () => this.nextLevel());
        this.bindButton('btnRetry', () => this.retryLevel());
        this.bindButton('btnMenuFromComplete', () => this.goToMenu());
        this.bindButton('btnMenuFromOver', () => this.goToMenu());

        this.bindButton('btnBackFromSelect', () => this.closeMenuPanel());
        this.bindButton('btnBackFromSettings', () => this.closeMenuPanel());
        this.bindButton('btnBackFromLeaderboard', () => this.closeMenuPanel());
        this.bindButton('btnBackFromSkins', () => this.closeMenuPanel());
        this.bindButton('btnBackFromCheckin', () => this.closeMenuPanel());

        this.bindButton('btnSettings', () => this.openSettingsPanel(SETTINGS_ENTRY.MENU));
        this.bindButton('btnHudSettings', () => this.openSettingsFromGame());
        this.bindButton('btnLeaderboard', () => this.openMenuPanel(MENU_PANEL.LEADERBOARD));
        this.bindButton('btnSkins', () => this.openMenuPanel(MENU_PANEL.SKINS));
        this.bindButton('btnCheckin', () => this.openMenuPanel(MENU_PANEL.CHECKIN));
        this.bindButton('btnExit', () => this.openMenuPanel(MENU_PANEL.EXIT_CONFIRM));
        this.bindButton('btnOnlineRewardSettleCloseTop', () => this.closeOnlineRewardSettle(true));
        this.bindButton('btnOnlineRewardSettleClose', () => {
            void this.confirmOnlineRewardSettle();
        });
        this.bindButton('btnCheckinRewardConfirm', () => {
            void this.confirmCheckinRewardSettle();
        });

        if (this.btnOnlineRewardChest) {
            this.btnOnlineRewardChest.addEventListener('click', () => this.onClickOnlineChest());
            const hide = () => this.hideOnlineRewardPreview();
            this.btnOnlineRewardChest.addEventListener('pointerdown', () => this.onPressOnlineChest());
            this.btnOnlineRewardChest.addEventListener('pointerup', hide);
            this.btnOnlineRewardChest.addEventListener('pointercancel', hide);
            this.btnOnlineRewardChest.addEventListener('pointerleave', hide);
        }

        this.bindButton('btnExitCancelTop', () => this.closeMenuPanel());
        this.bindButton('btnExitCancel', () => this.closeMenuPanel());
        this.bindButton('btnExitConfirm', () => this.handleExitConfirm());
        this.bindButton('btnResetProgress', () => this.openSettingsConfirm(SETTINGS_CONFIRM_MODE.RESET_PROGRESS));
        this.bindButton('btnEndRun', () => this.openSettingsConfirm(SETTINGS_CONFIRM_MODE.END_RUN));
        this.bindButton('btnResetProgressCancelTop', () => this.openMenuPanel(MENU_PANEL.SETTINGS));
        this.bindButton('btnResetProgressCancel', () => this.openMenuPanel(MENU_PANEL.SETTINGS));
        this.bindButton('btnResetProgressConfirm', () => this.handleSettingsConfirmAction());

        this.bindButton('btnLocaleZh', () => this.setLocale('zh-CN'));
        this.bindButton('btnLocaleEn', () => this.setLocale('en-US'));

        this.bindHomeStartVisualFallback();
    }

    bindButton(id, handler) {
        const element = document.getElementById(id);
        if (!element) return;

        let lastTriggerAt = Number.NEGATIVE_INFINITY;
        const invoke = () => {
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if (now - lastTriggerAt < 220) {
                return;
            }
            lastTriggerAt = now;

            try {
                if (this.audioEnabled) {
                    resumeAudioV31();
                    playClickSoundV31();
                }
            } catch (error) {
                console.warn(`Audio click failed for #${id}:`, error);
            }

            handler();
        };

        element.addEventListener('click', invoke);
        element.addEventListener('pointerup', (event) => {
            if (event.pointerType === 'touch') {
                invoke();
            }
        });
    }

    bindHomeStartVisualFallback() {
        if (!this.menuOverlay) return;

        this.menuOverlay.addEventListener('pointerup', (event) => {
            if (this.menuState !== MENU_PANEL.HOME) return;

            const target = event.target;
            if (target instanceof Element && target.closest('button, a, input, select, textarea, label')) {
                return;
            }

            if (!this.isPointInsideHomeStartVisual(event.clientX, event.clientY)) {
                return;
            }

            this.triggerStartGame();
        }, true);
    }

    isPointInsideHomeStartVisual(clientX, clientY) {
        const appRect = document.querySelector('.app-container')?.getBoundingClientRect();
        if (!appRect || appRect.width <= 0 || appRect.height <= 0) {
            return false;
        }

        const x = ((clientX - appRect.left) / appRect.width) * 430;
        const y = ((clientY - appRect.top) / appRect.height) * 932;
        const hit = HOME_START_VISUAL_HITBOX;
        return x >= hit.x && x <= (hit.x + hit.width) && y >= hit.y && y <= (hit.y + hit.height);
    }

    triggerStartGame() {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (now - this.lastStartTriggerAt < 220) {
            return;
        }
        this.lastStartTriggerAt = now;
        this.startGame();
    }

    bindGameCallbacks() {
        this.game.onHUDUpdate = () => this.updateHUD();
        this.game.onScoreGain = (payload) => this.showScorePulse(payload);
        this.game.onTimerUpdate = () => this.updateTimer();
        this.game.onTimerEnergyEmit = (payload) => this.spawnTimerEnergyOrb(payload);
        this.game.onTimerEnergyBatchCancel = (batchId) => this.cancelTimerEnergyBatch(batchId);
        this.game.onTimerEnergyClear = () => this.clearTimerEnergyOrbs();
        this.game.onRewardStageUnlocked = () => this.showRewardUnlockToast();
        this.game.onLevelComplete = () => this.showLevelCompletePopup();
        this.game.onGameOver = (reason) => this.showGameOverPopup(reason);
        this.game.onCollision = () => this.triggerErrorVignette();
        this.game.onLiveOpsUpdate = () => this.refreshCheckinPanel();
    }

    syncGameplayBgm(restart = false) {
        if (!this.audioEnabled) {
            return;
        }
        if (!this.game || this.game.state !== 'PLAYING') {
            return;
        }
        const isRewardStage = this.game.isRewardStage === true;
        playBgmForScene(
            isRewardStage ? BGM_SCENE_KEYS.REWARD : BGM_SCENE_KEYS.NORMAL,
            { restart }
        );
    }

    startGame() {
        const defaultLevel = this.getDefaultStartLevel();
        this.clearTimerEnergyOrbs();
        this.hideAll();
        this.hud.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.forceGameCanvasResize();
        if (typeof this.game.startNormalLevel === 'function') {
            this.game.startNormalLevel(defaultLevel);
        } else {
            this.game.startLevel(defaultLevel);
        }
        requestAnimationFrame(() => this.forceGameCanvasResize());
        this.updateHUD();
        this.syncGameplayBgm(true);
    }

    startSpecificLevel(level) {
        this.clearTimerEnergyOrbs();
        this.hideAll();
        this.hud.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.forceGameCanvasResize();
        if (typeof this.game.startNormalLevel === 'function') {
            this.game.startNormalLevel(level);
        } else {
            this.game.startLevel(level);
        }
        requestAnimationFrame(() => this.forceGameCanvasResize());
        this.updateHUD();
        this.syncGameplayBgm(true);
    }

    forceGameCanvasResize() {
        if (this.game && typeof this.game.resize === 'function') {
            this.game.resize();
        }
    }

    nextLevel() {
        if (typeof this.game.isCampaignCompleted === 'function' && this.game.isCampaignCompleted()) {
            this.goToMenu();
            return;
        }
        if (typeof this.game.startNextStage === 'function') {
            this.clearTimerEnergyOrbs();
            this.hideAll();
            this.hud.classList.remove('hidden');
            this.setMenuChromeVisible(false);
            this.forceGameCanvasResize();
            this.game.startNextStage();
            requestAnimationFrame(() => this.forceGameCanvasResize());
            this.updateHUD();
            this.syncGameplayBgm(true);
            return;
        }
        this.startSpecificLevel(this.game.currentLevel + 1);
    }

    retryLevel() {
        if (typeof this.game.retryCurrentStage === 'function') {
            this.clearTimerEnergyOrbs();
            this.hideAll();
            this.hud.classList.remove('hidden');
            this.setMenuChromeVisible(false);
            this.forceGameCanvasResize();
            this.game.retryCurrentStage();
            requestAnimationFrame(() => this.forceGameCanvasResize());
            this.updateHUD();
            this.syncGameplayBgm(true);
            return;
        }
        this.startSpecificLevel(this.game.currentLevel);
    }

    goToMenu() {
        this.openMenuPanel(MENU_PANEL.HOME);
    }

    showLevelSelect() {
        this.openMenuPanel(MENU_PANEL.LEVEL_SELECT);
    }

    openSettingsPanel(source = SETTINGS_ENTRY.MENU) {
        this.settingsEntry = source === SETTINGS_ENTRY.GAME
            ? SETTINGS_ENTRY.GAME
            : SETTINGS_ENTRY.MENU;
        this.openMenuPanel(MENU_PANEL.SETTINGS);
    }

    openSettingsFromGame() {
        if (this.game.state !== 'PLAYING') {
            return;
        }
        this.openSettingsPanel(SETTINGS_ENTRY.GAME);
    }

    openMenuPanel(panelId) {
        const target = Object.values(MENU_PANEL).includes(panelId) ? panelId : MENU_PANEL.HOME;
        this.clearTimerEnergyOrbs();
        this.hideAll();
        this.hud.classList.add('hidden');
        this.setMenuChromeVisible(true);

        if (target === MENU_PANEL.HOME) {
            this.menuOverlay.classList.remove('hidden');
            this.game.state = 'MENU';
            this.settingsEntry = SETTINGS_ENTRY.MENU;
            this.settingsConfirmMode = SETTINGS_CONFIRM_MODE.RESET_PROGRESS;
            this.updateCoinDisplays();
            if (this.audioEnabled) {
                playBgmForScene(BGM_SCENE_KEYS.HOME);
            }
        }

        if (target === MENU_PANEL.LEVEL_SELECT) {
            this.levelSelectOverlay.classList.remove('hidden');
            this.game.state = 'LEVEL_SELECT';
            this.buildLevelGrid();
        }

        if (target === MENU_PANEL.SETTINGS) {
            this.settingsOverlay.classList.remove('hidden');
            this.game.state = 'SETTINGS';
            this.syncAudioSettingsUi();
            this.updateSettingsActionRows();
        }

        if (target === MENU_PANEL.LEADERBOARD) {
            this.leaderboardOverlay.classList.remove('hidden');
            this.game.state = 'LEADERBOARD';
        }

        if (target === MENU_PANEL.SKINS) {
            this.skinsOverlay.classList.remove('hidden');
            this.game.state = 'SKINS';
            this.renderSkinCenter();
            void this.syncSkinCatalogForSkinCenter();
        }

        if (target === MENU_PANEL.CHECKIN) {
            this.checkinOverlay.classList.remove('hidden');
            this.game.state = 'CHECKIN';
            this.refreshCheckinPanel();
            this.updateCheckinSceneScale();
        }

        if (target === MENU_PANEL.EXIT_CONFIRM) {
            this.exitOverlay.classList.remove('hidden');
            this.game.state = 'EXIT_CONFIRM';
            this.exitFeedback?.classList.add('hidden');
        }

        if (target === MENU_PANEL.RESET_PROGRESS_CONFIRM) {
            this.resetProgressOverlay?.classList.remove('hidden');
            this.game.state = 'RESET_PROGRESS_CONFIRM';
            this.updateSettingsConfirmDialogText();
        }

        this.menuState = target;
        this.applyLocalizedText();
        this.refreshMenuLevelTag();
        this.renderFeatureCards();
        this.refreshCheckinPanel();
        this.refreshOnlineRewardDock();
    }

    async syncSkinCatalogForSkinCenter() {
        const syncFn = typeof window !== 'undefined'
            ? window.__arrowSyncSkinCatalogFromServer
            : null;
        if (typeof syncFn !== 'function') {
            return;
        }
        try {
            await syncFn();
            if (this.game && typeof this.game.saveProgress === 'function') {
                this.game.saveProgress();
            }
            if (this.menuState === MENU_PANEL.SKINS) {
                this.renderSkinCenter();
            }
        } catch (error) {
            console.warn('[ui] skin catalog sync failed', error);
        }
    }

    closeMenuPanel() {
        if (this.menuState === MENU_PANEL.SETTINGS && this.settingsEntry === SETTINGS_ENTRY.GAME) {
            this.resumeGameFromSettings();
            return;
        }
        this.openMenuPanel(MENU_PANEL.HOME);
    }

    setMenuBadges(badges = {}) {
        this.menuBadges = {
            ...this.menuBadges,
            ...(badges || {})
        };

        for (const feature of FEATURE_CONFIG) {
            const badgeEl = document.querySelector(`[data-badge-for="${feature.id}"]`);
            if (!badgeEl) continue;

            const value = this.menuBadges[feature.id];
            const hasValue = value !== null && value !== undefined && `${value}`.trim().length > 0;
            badgeEl.textContent = hasValue ? `${value}` : '';
            badgeEl.classList.toggle('hidden', !hasValue);
        }
    }

    setLocale(locale) {
        this.locale = resolveLocale(locale);
        persistLocale(this.locale);
        this.applyLocalizedText();
        this.refreshMenuLevelTag();
        this.updateHUD();
        this.updateLocaleButtons();
    }

    setMenuChromeVisible(_visible) {
        const appContainer = document.querySelector('.app-container');
        appContainer?.classList.toggle('menu-mode', !!_visible);
    }

    toggleLevelCompleteButtons(visible) {
        if (!this.levelCompleteButtonsEl) return;
        this.levelCompleteButtonsEl.classList.toggle('hidden', !visible);
    }

    stopLevelSettleAnimation() {
        if (this.levelSettleAnimFrame && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.levelSettleAnimFrame);
        }
        this.levelSettleAnimFrame = 0;
        this.isLevelSettleAnimating = false;
    }

    hideAll() {
        this.stopLevelSettleAnimation();
        this.toggleLevelCompleteButtons(true);
        if (this.scorePulseAnimation && typeof this.scorePulseAnimation.cancel === 'function') {
            this.scorePulseAnimation.cancel();
        }
        if (this.scoreGainAnimation && typeof this.scoreGainAnimation.cancel === 'function') {
            this.scoreGainAnimation.cancel();
        }
        if (this.hudScoreGainEl) {
            this.hudScoreGainEl.classList.add('hidden');
            this.hudScoreGainEl.textContent = '';
        }
        this.hud.classList.add('hidden');
        this.menuOverlay.classList.add('hidden');
        this.settingsOverlay.classList.add('hidden');
        this.leaderboardOverlay.classList.add('hidden');
        this.skinsOverlay.classList.add('hidden');
        this.checkinOverlay.classList.add('hidden');
        this.exitOverlay.classList.add('hidden');
        this.resetProgressOverlay?.classList.add('hidden');
        this.levelCompleteOverlay.classList.add('hidden');
        this.gameOverOverlay.classList.add('hidden');
        this.levelSelectOverlay.classList.add('hidden');
        this.onlineRewardSettleOverlay?.classList.add('hidden');
        this.checkinRewardSettleOverlay?.classList.add('hidden');
        this.rewardFlyLayerEl?.classList.add('hidden');
        if (this.rewardFlyLayerEl) {
            this.rewardFlyLayerEl.innerHTML = '';
        }
        this.hideOnlineRewardPreview();
        this.hideCheckinRewardTooltip();
        this.pendingCheckinRewardPayload = null;
        this.pendingOnlineRewardPayload = null;
        this.onlineRewardSettleCoinIconEl = null;
        if (this.rewardUnlockToastTimer) {
            clearTimeout(this.rewardUnlockToastTimer);
            this.rewardUnlockToastTimer = 0;
        }
        if (this.rewardUnlockToastEl) {
            this.rewardUnlockToastEl.classList.add('hidden');
            this.rewardUnlockToastEl.classList.remove('is-playing');
        }
        this.stopCheckinCoinCounter();
        this.clearCoinDisplayOverride();
        this.updateCheckinSceneScale();
    }

    updateCheckinSceneScale() {
        if (!this.checkinSceneEl) {
            return;
        }
        const layout = this.getCheckinLayoutConfig();
        const designW = Math.max(320, Number(layout?.notebook?.width) || 980);
        const designH = Math.max(320, Number(layout?.notebook?.height) || 760);
        const host = this.checkinOverlay || this.checkinSceneEl.parentElement;
        const vw = Math.max(320, host?.clientWidth || window.innerWidth || designW);
        const vh = Math.max(420, host?.clientHeight || window.innerHeight || designH);
        const padding = 8;
        const scale = Math.min(1, (vw - padding) / designW, (vh - padding) / designH);
        const multiplier = Math.max(0.2, Number(layout?.scene?.scaleMultiplier) || 1);
        const safeScale = Math.max(0.24, scale * multiplier);
        this.checkinSceneEl.style.transform = `scale(${safeScale})`;
        this.checkinSceneEl.style.marginBottom = '0px';
    }

    markUiEditorElements() {
        this.checkinBackButtonEl?.setAttribute('data-ui-editor-id', 'backButton');
        this.checkinCardEl?.setAttribute('data-ui-editor-id', 'notebook');
        this.checkinRibbonEl?.setAttribute('data-ui-editor-id', 'ribbon');
        this.checkinRibbonTitleEl?.setAttribute('data-ui-editor-id', 'ribbonTitle');
        this.checkinMascotEl?.setAttribute('data-ui-editor-id', 'mascot');
        this.checkinRewardTooltipEl?.setAttribute('data-ui-editor-id', 'rewardTooltip');
        this.checkinStatusEl?.setAttribute('data-ui-editor-id', 'status');
    }

    getCheckinLayoutConfig() {
        return this.uiLayoutConfig?.checkin || readUiLayoutConfig().checkin;
    }

    applyCheckinLayoutConfig() {
        const layout = this.getCheckinLayoutConfig();
        if (this.checkinBackButtonEl) {
            this.checkinBackButtonEl.style.left = `${layout.backButton.x}px`;
            this.checkinBackButtonEl.style.top = `${layout.backButton.y}px`;
            this.checkinBackButtonEl.style.minWidth = `${layout.backButton.width}px`;
            this.checkinBackButtonEl.style.height = `${layout.backButton.height}px`;
            this.checkinBackButtonEl.style.fontSize = `${layout.backButton.fontSize}px`;
            this.checkinBackButtonEl.style.display = layout.backButton.visible === false ? 'none' : '';
        }
        if (this.checkinCardEl) {
            this.checkinCardEl.style.width = `${layout.notebook.width}px`;
            this.checkinCardEl.style.height = `${layout.notebook.height}px`;
            this.checkinCardEl.style.paddingTop = `${layout.notebook.paddingTop}px`;
            this.checkinCardEl.style.display = layout.notebook.visible === false ? 'none' : '';
        }
        if (this.checkinRibbonEl) {
            this.checkinRibbonEl.style.left = `${layout.ribbon.x}px`;
            this.checkinRibbonEl.style.top = `${layout.ribbon.y}px`;
            this.checkinRibbonEl.style.width = `${layout.ribbon.width}px`;
            this.checkinRibbonEl.style.height = `${layout.ribbon.height}px`;
            this.checkinRibbonEl.style.display = layout.ribbon.visible === false ? 'none' : '';
        }
        if (this.checkinRibbonTitleEl) {
            this.checkinRibbonTitleEl.style.fontSize = `${layout.ribbonTitle.fontSize}px`;
            this.checkinRibbonTitleEl.style.transform = `translate(${layout.ribbonTitle.x}px, ${layout.ribbonTitle.y}px)`;
            this.checkinRibbonTitleEl.style.display = layout.ribbonTitle.visible === false ? 'none' : '';
        }
        if (this.checkinMascotEl) {
            this.checkinMascotEl.style.left = `${layout.mascot.x}px`;
            this.checkinMascotEl.style.top = `${layout.mascot.y}px`;
            this.checkinMascotEl.style.width = `${layout.mascot.width}px`;
            this.checkinMascotEl.style.height = `${layout.mascot.height}px`;
            this.checkinMascotEl.style.display = layout.mascot.visible === true ? 'block' : 'none';
        }
        if (this.checkinStatusEl) {
            this.checkinStatusEl.style.left = `${layout.status.x}px`;
            this.checkinStatusEl.style.top = `${layout.status.y}px`;
            this.checkinStatusEl.style.width = `${layout.status.width}px`;
            this.checkinStatusEl.style.fontSize = `${layout.status.fontSize}px`;
            this.checkinStatusEl.style.display = layout.status.visible === true ? 'block' : 'none';
        }
    }

    getDefaultStartLevel() {
        const maxCampaignLevel = this.getCampaignLevelCount();
        const fallback = Math.max(1, this.game.maxUnlockedLevel || this.game.currentLevel || 1);
        return Math.min(maxCampaignLevel, fallback);
    }

    getCampaignLevelCount() {
        if (this.game && typeof this.game.getNormalLevelCount === 'function') {
            return Math.max(1, Number(this.game.getNormalLevelCount()) || 1);
        }
        return Math.max(1, Number(this.game.maxUnlockedLevel) || 1);
    }

    formatLevel(level) {
        if (
            this.game
            && Number(level) === Number(this.game.currentLevel)
            && typeof this.game.getCurrentStageLabel === 'function'
        ) {
            const stageLabel = `${this.game.getCurrentStageLabel() || ''}`.trim();
            if (stageLabel) {
                return stageLabel;
            }
        }
        return t(this.locale, 'common.levelTag', { level });
    }

    refreshMenuLevelTag() {
        const level = this.getDefaultStartLevel();
        const valueText = this.formatLevel(level);
        const chipText = t(this.locale, 'common.levelChip', { level });
        if (this.levelTag) {
            this.levelTag.setAttribute('aria-label', valueText);
        }
        if (this.levelTagValue) {
            this.levelTagValue.textContent = chipText;
        } else if (this.levelTag) {
            this.levelTag.textContent = valueText;
        }
        if (this.levelSelectCurrent) {
            this.levelSelectCurrent.textContent = valueText;
        }
    }

    updateCoinDisplays() {
        const override = Number.isFinite(this.coinDisplayOverride) ? this.coinDisplayOverride : null;
        const coins = override !== null
            ? override
            : (typeof this.game.getCoins === 'function' ? this.game.getCoins() : 0);
        const valueText = String(Math.max(0, Math.floor(Number(coins) || 0)));

        if (this.menuCoinValue) {
            this.menuCoinValue.textContent = valueText;
        }
        if (this.hudCoinValue) {
            this.hudCoinValue.textContent = valueText;
        }
        if (this.skinsCoinValue) {
            this.skinsCoinValue.textContent = valueText;
        }
    }

    setCoinDisplayOverride(value) {
        this.coinDisplayOverride = Math.max(0, Math.floor(Number(value) || 0));
        this.updateCoinDisplays();
    }

    clearCoinDisplayOverride() {
        this.coinDisplayOverride = null;
        this.updateCoinDisplays();
    }

    applyLocalizedText() {
        document.documentElement.lang = this.locale;
        document.title = t(this.locale, 'app.title');

        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', t(this.locale, 'app.description'));
        }

        document.querySelectorAll('[data-i18n]').forEach((element) => {
            const key = element.dataset.i18n;
            if (!key) return;
            element.textContent = t(this.locale, key);
        });

        this.updateLocaleButtons();
        this.refreshMenuLevelTag();
        this.renderFeatureCards();
        this.updateSettingsActionRows();
        this.updateSettingsConfirmDialogText();
        this.renderSkinCenter();
        this.updateCoinDisplays();
        this.refreshCheckinPanel(false);
    }

    updateLocaleButtons() {
        this.localeZhBtn?.classList.toggle('active', this.locale === 'zh-CN');
        this.localeEnBtn?.classList.toggle('active', this.locale === 'en-US');
    }

    updateSettingsActionRows() {
        const inGameSettings = this.settingsEntry === SETTINGS_ENTRY.GAME;
        const resetRow = document.querySelector('#settingsOverlay .setting-row-reset');
        resetRow?.classList.toggle('hidden', inGameSettings);
        this.settingsEndRunRow?.classList.toggle('hidden', !inGameSettings);
    }

    openSettingsConfirm(mode) {
        this.settingsConfirmMode = mode === SETTINGS_CONFIRM_MODE.END_RUN
            ? SETTINGS_CONFIRM_MODE.END_RUN
            : SETTINGS_CONFIRM_MODE.RESET_PROGRESS;
        this.openMenuPanel(MENU_PANEL.RESET_PROGRESS_CONFIRM);
    }

    updateSettingsConfirmDialogText() {
        const isEndRun = this.settingsConfirmMode === SETTINGS_CONFIRM_MODE.END_RUN;
        const titleKey = isEndRun ? 'panel.exit.title' : 'panel.reset.title';
        const descKey = isEndRun ? 'panel.exit.desc' : 'panel.reset.desc';
        const confirmKey = isEndRun ? 'panel.exit.confirm' : 'panel.reset.confirm';

        if (this.settingsConfirmTitleEl) {
            this.settingsConfirmTitleEl.textContent = t(this.locale, titleKey);
        }
        if (this.settingsConfirmDescEl) {
            this.settingsConfirmDescEl.textContent = t(this.locale, descKey);
        }
        if (this.settingsConfirmActionBtn) {
            this.settingsConfirmActionBtn.textContent = t(this.locale, confirmKey);
        }
    }

    resumeGameFromSettings() {
        this.hideAll();
        this.hud.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.game.state = 'PLAYING';
        this.menuState = MENU_PANEL.HOME;
        this.forceGameCanvasResize();
        this.updateHUD();
        this.syncGameplayBgm(false);
    }

    renderFeatureCards() {
        for (const feature of FEATURE_CONFIG) {
            const button = document.getElementById(feature.buttonId);
            if (!button) continue;
            button.disabled = !feature.enabled;
            button.classList.toggle('disabled', !feature.enabled);
            button.dataset.panelId = feature.panelId;

            const label = button.querySelector('.feature-label');
            if (label) {
                label.textContent = t(this.locale, feature.labelKey);
            }

            const icon = button.querySelector('.feature-icon');
            if (icon) {
                icon.setAttribute('data-icon-slot', feature.iconSlot);
                const asset = getUiAsset(feature.iconSlot);
                if (asset) {
                    icon.setAttribute('src', asset);
                }
            }
        }
    }

    applyThemeAssets() {
        const root = document.documentElement;
        const cssSlotMap = [
            ['--asset-home-bg', 'home.background'],
            ['--asset-panel', 'surface.panel'],
            ['--asset-button', 'button.primary'],
            ['--asset-card', 'card.feature']
        ];

        for (const [cssVar, slot] of cssSlotMap) {
            const asset = getUiAsset(slot);
            if (!asset) continue;
            const safe = asset.replace(/'/g, "%27");
            root.style.setProperty(cssVar, `url('${safe}')`);
        }

        document.querySelectorAll('[data-icon-slot]').forEach((img) => {
            const slot = img.getAttribute('data-icon-slot');
            if (!slot) return;
            const asset = getUiAsset(slot);
            if (!asset) return;
            img.setAttribute('src', asset);
        });
    }

    updateHUD() {
        if (this.levelInfoEl) {
            this.levelInfoEl.textContent = this.formatLevel(this.game.currentLevel);
        }

        if (this.livesEl) {
            const showLives = !!this.game.lifeSystemEnabled;
            this.livesEl.classList.toggle('hidden', !showLives);
            this.livesEl.innerHTML = '';
            if (showLives) {
                for (let i = 0; i < this.game.maxLives; i++) {
                    const heart = document.createElement('span');
                    heart.className = `heart${i < this.game.lives ? '' : ' empty'}`;
                    const icon = document.createElement('span');
                    icon.className = 'heart-icon';
                    heart.appendChild(icon);
                    this.livesEl.appendChild(heart);
                }
            }
        }

        this.updateTimer();
        this.updateComboDisplay();
        this.updateToolButtons();
        this.refreshMenuLevelTag();
        this.updateCoinDisplays();
        this.syncScorePulse();
        this.refreshCheckinPanel(false);
        this.refreshOnlineRewardDock();
    }

    formatRewardList(rewards = []) {
        const rows = Array.isArray(rewards) ? rewards : [];
        if (rows.length === 0) {
            return this.locale === 'zh-CN' ? '\u65e0\u5956\u52b1' : 'No reward';
        }
        return rows
            .map((row) => {
                const meta = this.getRewardMeta(row);
                return `${meta.name} x${Math.max(0, Math.floor(Number(row?.amount) || 0))}`;
            })
            .join(' / ');
    }

    getRewardMeta(reward) {
        const itemId = `${reward?.itemId || reward || ''}`.trim().toLowerCase();
        const itemDef = this.game?.getLiveOpsItemDefinition?.(itemId) || null;
        const isZh = this.locale === 'zh-CN';
        const builtinNames = {
            coin: isZh ? '\u91d1\u5e01' : 'Coin',
            skin_fragment: isZh ? '\u76ae\u80a4\u788e\u7247' : 'Skin Fragment',
            hint: isZh ? '\u63d0\u793a' : 'Hint',
            undo: isZh ? '\u64a4\u9500' : 'Undo',
            shuffle: isZh ? '\u91cd\u6392' : 'Shuffle',
            skin: isZh ? '\u76ae\u80a4' : 'Skin'
        };
        const builtinDesc = {
            coin: isZh ? '\u7528\u4e8e\u89e3\u9501\u76ae\u80a4\u6216\u6d3b\u52a8\u6d88\u8017\u3002' : 'Used to unlock skins or spend in activities.',
            skin_fragment: isZh ? '\u7528\u4e8e\u540e\u7eed\u76ae\u80a4\u76f8\u5173\u6d3b\u52a8\u9053\u5177\u3002' : 'Used in future skin-related activities.',
            hint: isZh ? '\u6e38\u620f\u5185\u53ef\u76f4\u63a5\u4f7f\u7528\u7684\u63d0\u793a\u9053\u5177\u3002' : 'Usable hint item during gameplay.',
            undo: isZh ? '\u6e38\u620f\u5185\u53ef\u64a4\u56de\u4e00\u6b21\u64cd\u4f5c\u3002' : 'Undo one move during gameplay.',
            shuffle: isZh ? '\u6e38\u620f\u5185\u91cd\u65b0\u6253\u4e71\u76d8\u9762\u3002' : 'Shuffle the board during gameplay.',
            skin: isZh ? '\u968f\u673a\u89e3\u9501\u4e00\u6b3e\u672a\u62e5\u6709\u76ae\u80a4\u3002' : 'Unlock one random skin you do not own yet.'
        };
        if (itemDef?.type === 'skin' && itemId && itemId !== 'skin') {
            const skin = (this.game?.getSkinCatalog?.() || []).find((entry) => `${entry?.id || ''}`.trim().toLowerCase() === itemId)
                || null;
            return {
                itemId,
                type: 'skin',
                name: getSkinDisplayName(skin, isZh ? 'zh-CN' : 'en-US') || (itemDef?.nameZh || itemDef?.nameEn || itemId),
                description: getSkinDescription(skin, isZh ? 'zh-CN' : 'en-US') || (isZh ? '\u89e3\u9501\u6307\u5b9a\u76ae\u80a4\u3002' : 'Unlock this specific skin.'),
                icon: skin?.preview || 'assets/design-v2/clean/icon_gift.png'
            };
        }
        return {
            itemId,
            type: itemDef?.type || 'item',
            name: isZh
                ? (itemDef?.nameZh || builtinNames[itemId] || itemId)
                : (itemDef?.nameEn || builtinNames[itemId] || itemId),
            description: builtinDesc[itemId] || (isZh ? '\u5956\u52b1\u9053\u5177\u3002' : 'Reward item.'),
            icon: this.getRewardIconByItemId(itemId)
        };
    }

    getRewardIconByItemId(itemId) {
        const id = `${itemId || ''}`.trim().toLowerCase();
        const itemDef = this.game?.getLiveOpsItemDefinition?.(id) || null;
        if (itemDef?.type === 'skin' && id && id !== 'skin') {
            const skin = (this.game?.getSkinCatalog?.() || []).find((entry) => `${entry?.id || ''}`.trim().toLowerCase() === id)
                || null;
            return skin?.preview || 'assets/design-v2/clean/icon_gift.png';
        }
        if (id === 'coin') return 'assets/design-v6/checkin/icon_coin_pile.png';
        if (id === 'hint') return 'assets/design-v2/clean/icon_hint.png';
        if (id === 'undo') return 'assets/design-v2/clean/icon_undo.png';
        if (id === 'shuffle') return 'assets/design-v2/clean/icon_shuffle.png';
        if (id === 'skin_fragment') return 'assets/design-v2/clean/icon_theme.png';
        if (id === 'skin') return 'assets/design-v2/clean/icon_theme.png';
        return 'assets/design-v2/clean/icon_gift.png';
    }

    showCheckinRewardTooltip(anchorEl, day, rewards = [], pointerEvent = null) {
        if (!this.checkinRewardTooltipEl || !anchorEl || !Array.isArray(rewards) || rewards.length === 0) {
            return;
        }
        const tooltipLayout = this.getCheckinLayoutConfig()?.rewardTooltip || null;
        const title = this.locale === 'zh-CN' ? `第${day}天奖励` : `Day ${day} Reward`;
        this.checkinRewardTooltipEl.innerHTML = '';
        const titleEl = document.createElement('div');
        titleEl.className = 'checkin-reward-tooltip-title';
        titleEl.textContent = title;
        this.checkinRewardTooltipEl.appendChild(titleEl);

        const list = document.createElement('div');
        list.className = 'checkin-reward-tooltip-list';
        for (const reward of rewards) {
            const meta = this.getRewardMeta(reward);
            const row = document.createElement('div');
            row.className = 'checkin-reward-tooltip-item';
            const icon = document.createElement('img');
            icon.src = meta.icon;
            icon.alt = meta.name;
            const text = document.createElement('div');
            text.className = 'checkin-reward-tooltip-item-text';
            text.textContent = `${meta.name} x${Math.max(0, Math.floor(Number(reward?.amount) || 0))}`;
            row.appendChild(icon);
            row.appendChild(text);
            list.appendChild(row);
        }
        this.checkinRewardTooltipEl.appendChild(list);

        const primaryMeta = this.getRewardMeta(rewards[0]);
        if (primaryMeta.description) {
            const desc = document.createElement('div');
            desc.className = 'checkin-reward-tooltip-desc';
            desc.textContent = primaryMeta.description;
            this.checkinRewardTooltipEl.appendChild(desc);
        }

        this.checkinRewardTooltipEl.classList.remove('hidden');
        if (tooltipLayout?.width) {
            this.checkinRewardTooltipEl.style.width = `${tooltipLayout.width}px`;
            this.checkinRewardTooltipEl.style.maxWidth = `${tooltipLayout.width}px`;
        } else {
            this.checkinRewardTooltipEl.style.width = '';
            this.checkinRewardTooltipEl.style.maxWidth = '';
        }
        this.checkinRewardTooltipEl.style.left = '0px';
        this.checkinRewardTooltipEl.style.top = '0px';
        const bubbleWidth = this.checkinRewardTooltipEl.offsetWidth;
        const bubbleHeight = this.checkinRewardTooltipEl.offsetHeight;
        const anchorCenterX = anchorEl.offsetLeft + (anchorEl.offsetWidth / 2);
        const autoLeft = Math.max(16, Math.min(980 - bubbleWidth - 16, anchorCenterX - (bubbleWidth / 2)));
        const preferredTop = anchorEl.offsetTop - bubbleHeight - 12;
        const autoTop = preferredTop >= 18 ? preferredTop : Math.min(760 - bubbleHeight - 16, anchorEl.offsetTop + anchorEl.offsetHeight + 8);
        let left = Number.isFinite(Number(tooltipLayout?.x)) ? Number(tooltipLayout.x) : autoLeft;
        let top = Number.isFinite(Number(tooltipLayout?.y)) ? Number(tooltipLayout.y) : autoTop;
        if (tooltipLayout?.followMouse) {
            const offsetParent = anchorEl.offsetParent instanceof HTMLElement ? anchorEl.offsetParent : anchorEl.parentElement;
            const parentRect = offsetParent instanceof HTMLElement ? offsetParent.getBoundingClientRect() : null;
            const parentWidth = offsetParent instanceof HTMLElement ? offsetParent.offsetWidth : 980;
            const parentHeight = offsetParent instanceof HTMLElement ? offsetParent.offsetHeight : 760;
            const pointerX = Number(pointerEvent?.clientX);
            const pointerY = Number(pointerEvent?.clientY);
            let localX = anchorCenterX;
            let localY = anchorEl.offsetTop + (anchorEl.offsetHeight / 2);
            if (parentRect && Number.isFinite(pointerX) && Number.isFinite(pointerY) && parentRect.width > 0 && parentRect.height > 0) {
                const scaleX = parentWidth / parentRect.width;
                const scaleY = parentHeight / parentRect.height;
                localX = (pointerX - parentRect.left) * scaleX;
                localY = (pointerY - parentRect.top) * scaleY;
            }
            left = Math.max(16, Math.min(parentWidth - bubbleWidth - 16, localX + Number(tooltipLayout.x || 0)));
            top = Math.max(18, Math.min(parentHeight - bubbleHeight - 16, localY + Number(tooltipLayout.y || 0)));
        }
        this.checkinRewardTooltipEl.style.left = `${Math.round(left)}px`;
        this.checkinRewardTooltipEl.style.top = `${Math.round(top)}px`;
        this.activeCheckinTooltipDay = day;
    }

    hideCheckinRewardTooltip() {
        this.activeCheckinTooltipDay = 0;
        this.checkinRewardTooltipEl?.classList.add('hidden');
    }

    getCheckinCardLayout(day) {
        const layout = this.getCheckinLayoutConfig();
        const dayLayout = layout?.days?.[day] || layout?.days?.[`${day}`];
        const fallback = layout?.days?.[1] || layout?.days?.['1'];
        return dayLayout?.card || fallback?.card;
    }

    getCheckinCardPartLayout(day) {
        const layout = this.getCheckinLayoutConfig();
        return layout?.days?.[day] || layout?.days?.[`${day}`] || layout?.days?.[1] || layout?.days?.['1'];
    }

    isCheckinPartVisible(partConfig) {
        return partConfig?.visible !== false;
    }

    createCheckinRewardNode(day, rewards, isClaimableDay, isClaimedDay) {
        const node = document.createElement('div');
        node.className = 'checkin-day';
        if (day === 7) {
            node.classList.add('day-7');
        }
        const layout = this.getCheckinCardLayout(day);
        const partLayout = this.getCheckinCardPartLayout(day);
        node.style.left = `${layout.x}px`;
        node.style.top = `${layout.y}px`;
        node.style.width = `${layout.width}px`;
        node.style.height = `${layout.height}px`;
        node.style.display = this.isCheckinPartVisible(layout) ? '' : 'none';
        if (isClaimedDay) {
            node.classList.add('is-claimed');
        } else if (isClaimableDay) {
            node.classList.add('is-next');
        }
        node.dataset.uiEditorId = `day${day}-card`;
        node.dataset.day = `${day}`;
        node.setAttribute('aria-label', this.locale === 'zh-CN'
            ? `第${day}天签到奖励：${this.formatRewardList(rewards)}`
            : `Day ${day} check-in reward: ${this.formatRewardList(rewards)}`);

        const title = document.createElement('div');
        title.className = 'checkin-day-title';
        title.textContent = this.locale === 'zh-CN' ? `第${day}天` : `Day ${day}`;
        title.style.left = partLayout.title.align === 'left'
            ? `${partLayout.title.x}px`
            : `${partLayout.title.x - (partLayout.title.width / 2)}px`;
        title.style.top = `${partLayout.title.y}px`;
        title.style.width = `${partLayout.title.width}px`;
        title.style.fontSize = `${partLayout.title.fontSize}px`;
        title.style.textAlign = partLayout.title.align;
        title.style.display = this.isCheckinPartVisible(partLayout.title) ? '' : 'none';
        title.dataset.uiEditorId = `day${day}-title`;
        node.appendChild(title);

        const primaryReward = Array.isArray(rewards) ? rewards[0] : null;
        if (primaryReward) {
            const meta = this.getRewardMeta(primaryReward);
            const icon = document.createElement('img');
            icon.className = 'checkin-reward-icon';
            icon.src = meta.icon;
            icon.alt = meta.name;
            icon.style.left = `${partLayout.icon.x}px`;
            icon.style.top = `${partLayout.icon.y}px`;
            icon.style.width = `${partLayout.icon.width}px`;
            icon.style.height = `${partLayout.icon.height}px`;
            icon.style.display = this.isCheckinPartVisible(partLayout.icon) ? '' : 'none';
            icon.dataset.uiEditorId = `day${day}-icon`;

            const amount = document.createElement('div');
            amount.className = 'checkin-reward-amount';
            amount.textContent = `x${Math.max(0, Math.floor(Number(primaryReward?.amount) || 0))}`;
            amount.style.left = `${partLayout.amount.x}px`;
            amount.style.top = `${partLayout.amount.y}px`;
            amount.style.fontSize = `${partLayout.amount.fontSize}px`;
            amount.style.display = this.isCheckinPartVisible(partLayout.amount) ? '' : 'none';
            amount.dataset.uiEditorId = `day${day}-amount`;

            node.appendChild(icon);
            node.appendChild(amount);
        }

        if (isClaimedDay) {
            const badge = document.createElement('div');
            badge.className = 'checkin-claimed-badge';
            badge.textContent = '\u2713';
            badge.setAttribute('aria-hidden', 'true');
            badge.style.left = `${partLayout.badge.x}px`;
            badge.style.top = `${partLayout.badge.y}px`;
            badge.style.width = `${partLayout.badge.size}px`;
            badge.style.height = `${partLayout.badge.size}px`;
            badge.style.fontSize = `${Math.round(partLayout.badge.size * 0.57)}px`;
            badge.style.display = this.isCheckinPartVisible(partLayout.badge) ? '' : 'none';
            badge.dataset.uiEditorId = `day${day}-badge`;
            node.appendChild(badge);
        }

        const showPreview = (event) => this.showCheckinRewardTooltip(node, day, rewards, event);
        const movePreview = (event) => {
            if (this.getCheckinLayoutConfig()?.rewardTooltip?.followMouse) {
                this.showCheckinRewardTooltip(node, day, rewards, event);
            }
        };
        const hidePreview = () => {
            if (this.activeCheckinTooltipDay === day) {
                this.hideCheckinRewardTooltip();
            }
        };
        node.addEventListener('mouseenter', showPreview);
        node.addEventListener('mousemove', movePreview);
        node.addEventListener('mouseleave', hidePreview);
        node.addEventListener('pointerdown', showPreview);
        node.addEventListener('pointermove', movePreview);
        node.addEventListener('pointerup', hidePreview);
        node.addEventListener('pointercancel', hidePreview);
        node.addEventListener('pointerleave', hidePreview);
        return node;
    }

    getCheckinSnapshotForRender() {
        if (!this.game || typeof this.game.getCheckinSnapshot !== 'function') {
            return null;
        }
        const base = this.game.getCheckinSnapshot();
        if (!this.uiEditorPreviewOptions.enabled || !this.uiEditorPreviewOverride) {
            return base;
        }
        const cycleDays = Math.max(1, Number(base?.cycleDays) || 7);
        const claimedInCycle = Math.max(
            0,
            Math.min(cycleDays, Math.round(Number(this.uiEditorPreviewOverride.claimedDays) || 0))
        );
        const nextDayIndex = Math.max(
            1,
            Math.min(cycleDays, Math.round(Number(this.uiEditorPreviewOverride.nextDay) || (claimedInCycle + 1)))
        );
        const canClaimToday = `${this.uiEditorPreviewOverride.previewMode || 'claimable'}` === 'claimable';
        return {
            ...base,
            claimedInCycle,
            claimedCount: claimedInCycle,
            nextDayIndex,
            canClaimToday,
            todayReward: Array.isArray(base?.rewards?.[nextDayIndex - 1]) ? base.rewards[nextDayIndex - 1] : []
        };
    }

    refreshCheckinPanel(updateBadge = true) {
        const checkin = this.getCheckinSnapshotForRender();
        if (!checkin) {
            return;
        }
        const online = typeof this.game.getOnlineRewardSnapshot === 'function'
            ? this.game.getOnlineRewardSnapshot()
            : null;
        this.hideCheckinRewardTooltip();

        if (this.checkinWeekGridEl) {
            this.checkinWeekGridEl.innerHTML = '';
            for (let day = 1; day <= checkin.cycleDays; day += 1) {
                const rewards = Array.isArray(checkin.rewards?.[day - 1]) ? checkin.rewards[day - 1] : [];
                const isClaimableDay = checkin.canClaimToday && day === checkin.nextDayIndex;
                const isClaimedDay = day <= checkin.claimedInCycle;
                const node = this.createCheckinRewardNode(day, rewards, isClaimableDay, isClaimedDay);
                if (isClaimableDay) {
                    node.classList.add('is-clickable');
                    node.tabIndex = 0;
                    node.setAttribute('role', 'button');
                    node.addEventListener('click', () => this.claimCheckinReward());
                    node.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.claimCheckinReward();
                        }
                    });
                }
                this.checkinWeekGridEl.appendChild(node);
            }
        }
        if (this.checkinStatusEl) {
            this.checkinStatusEl.textContent = checkin.canClaimToday
                ? (this.locale === 'zh-CN' ? `点击第${checkin.nextDayIndex}天奖励卡即可领取` : `Tap day ${checkin.nextDayIndex} card to claim`)
                : (this.locale === 'zh-CN' ? '\u4eca\u65e5\u5df2\u7b7e\u5230\uff0c\u660e\u65e5\u518d\u6765\u3002' : 'Already claimed today.');
        }
        if (this.uiEditorPreviewOptions.enabled) {
            const tooltipLayout = this.getCheckinLayoutConfig()?.rewardTooltip || null;
            if (tooltipLayout?.visible) {
                const anchor = this.checkinWeekGridEl?.querySelector(`[data-day="${checkin.nextDayIndex}"]`) || this.checkinWeekGridEl?.firstElementChild;
                if (anchor instanceof HTMLElement) {
                    this.showCheckinRewardTooltip(anchor, checkin.nextDayIndex, checkin.todayReward);
                }
            } else {
                this.hideCheckinRewardTooltip();
            }
        }

        if (updateBadge) {
            const hasBadge = checkin.canClaimToday || !!online?.canClaim;
            this.setMenuBadges({
                checkin: hasBadge ? '!' : ''
            });
        }
    }

    activateUiEditorPreview() {
        this.appContainerEl?.classList.add('menu-mode');
        this.uiEditorPreviewOverride = {
            previewMode: 'claimable',
            claimedDays: 0,
            nextDay: 1
        };
        this.openMenuPanel(MENU_PANEL.CHECKIN);
    }

    setUiEditorPreviewState(override = {}) {
        if (!this.uiEditorPreviewOptions.enabled) {
            return;
        }
        this.uiEditorPreviewOverride = {
            ...this.uiEditorPreviewOverride,
            ...(override || {})
        };
        if (this.menuState !== MENU_PANEL.CHECKIN) {
            this.openMenuPanel(MENU_PANEL.CHECKIN);
        } else {
            this.refreshCheckinPanel(false);
            this.updateCheckinSceneScale();
        }
    }

    getUiEditorPreviewMeta() {
        return {
            width: 430,
            height: 932
        };
    }

    getUiEditorElementRect(elementId) {
        if (!elementId) {
            return null;
        }
        const target = document.querySelector(`[data-ui-editor-id="${elementId}"]`);
        if (!(target instanceof HTMLElement)) {
            return null;
        }
        const rect = target.getBoundingClientRect();
        return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };
    }

    claimCheckinReward() {
        if (!this.game || typeof this.game.claimCheckinReward !== 'function') {
            return;
        }
        const beforeCoins = typeof this.game.getCoins === 'function'
            ? Math.max(0, Math.floor(Number(this.game.getCoins()) || 0))
            : 0;
        const result = this.game.claimCheckinReward();
        if (this.checkinStatusEl) {
            this.checkinStatusEl.textContent = result?.ok
                ? (this.locale === 'zh-CN' ? `\u7b7e\u5230\u6210\u529f\uff1a${this.formatRewardList(result.rewards)}` : `Claimed: ${this.formatRewardList(result.rewards)}`)
                : (this.locale === 'zh-CN' ? '\u4eca\u65e5\u5df2\u7b7e\u5230\u3002' : 'Already claimed today.');
        }
        this.refreshCheckinPanel();
        if (!result?.ok) {
            this.updateCoinDisplays();
            return;
        }
        const afterCoins = typeof this.game.getCoins === 'function'
            ? Math.max(0, Math.floor(Number(this.game.getCoins()) || 0))
            : beforeCoins;
        const coinRewardAmount = Math.max(0, afterCoins - beforeCoins);
        this.openMenuPanel(MENU_PANEL.HOME);
        this.setCoinDisplayOverride(beforeCoins);
        this.showCheckinRewardSettle({
            ...result,
            beforeCoins,
            afterCoins,
            coinRewardAmount
        });
    }

    claimOnlineReward() {
        if (!this.game || typeof this.game.claimOnlineReward !== 'function') {
            return;
        }
        const beforeCoins = typeof this.game.getCoins === 'function'
            ? Math.max(0, Math.floor(Number(this.game.getCoins()) || 0))
            : Math.max(0, Math.floor(Number(this.game?.coins) || 0));
        const result = this.game.claimOnlineReward();
        if (result?.ok) {
            const afterCoins = typeof this.game.getCoins === 'function'
                ? Math.max(0, Math.floor(Number(this.game.getCoins()) || 0))
                : beforeCoins;
            const rewards = Array.isArray(result?.rewards) ? result.rewards : [];
            const coinRewardAmount = rewards.reduce((sum, reward) => {
                if (`${reward?.itemId || ''}` !== 'coin') {
                    return sum;
                }
                return sum + Math.max(0, Math.floor(Number(reward?.amount) || 0));
            }, 0);
            this.setCoinDisplayOverride(beforeCoins);
            this.showOnlineRewardSettle({
                ...result,
                rewards,
                beforeCoins,
                afterCoins,
                coinRewardAmount
            });
        }
        this.refreshCheckinPanel();
        this.refreshOnlineRewardDock();
        this.updateCoinDisplays();
    }

    refreshOnlineRewardDock() {
        const settleVisible = !!this.onlineRewardSettleOverlay && !this.onlineRewardSettleOverlay.classList.contains('hidden');
        const checkinSettleVisible = !!this.checkinRewardSettleOverlay && !this.checkinRewardSettleOverlay.classList.contains('hidden');
        const show = this.menuState === MENU_PANEL.HOME && this.game?.state === 'MENU' && !settleVisible && !checkinSettleVisible;
        this.onlineRewardDockEl?.classList.toggle('hidden', !show);
        if (!show || !this.game || typeof this.game.getOnlineRewardSnapshot !== 'function') {
            return;
        }
        const online = this.game.getOnlineRewardSnapshot();
        if (!this.onlineDockTextEl) {
            return;
        }
        if (!online.enabled) {
            this.onlineDockTextEl.textContent = this.locale === 'zh-CN' ? '未开启' : 'Off';
            return;
        }
        if (online.done) {
            this.onlineDockTextEl.textContent = this.locale === 'zh-CN' ? '已领完' : 'Done';
            return;
        }
        if (online.canClaim) {
            this.onlineDockTextEl.textContent = this.locale === 'zh-CN' ? '可领取' : 'Claim';
            return;
        }
        const remain = Math.max(0, Math.ceil(Number(online.remainingSeconds) || 0));
        this.onlineDockTextEl.textContent = this.formatCountdown(remain);
    }

    formatCountdown(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        const mm = Math.floor(seconds / 60);
        const ss = seconds % 60;
        return `${mm}:${`${ss}`.padStart(2, '0')}`;
    }

    onClickOnlineChest() {
        if (!this.game || typeof this.game.getOnlineRewardSnapshot !== 'function') {
            return;
        }
        const online = this.game.getOnlineRewardSnapshot();
        if (!online.enabled || !online.canClaim) {
            return;
        }
        this.claimOnlineReward();
    }

    onPressOnlineChest() {
        if (!this.game || typeof this.game.getOnlineRewardSnapshot !== 'function') {
            return;
        }
        const online = this.game.getOnlineRewardSnapshot();
        if (!online.enabled || online.done || online.canClaim || !online.currentTier) {
            return;
        }
        const rewards = Array.isArray(online.currentTier.rewards) ? online.currentTier.rewards : [];
        this.showOnlineRewardPreview(rewards);
    }

    showOnlineRewardPreview(rewards = []) {
        if (!this.onlineRewardPreviewBubbleEl) {
            return;
        }
        this.onlineRewardPreviewBubbleEl.innerHTML = '';
        const rows = Array.isArray(rewards) ? rewards : [];
        for (const reward of rows) {
            const item = document.createElement('div');
            item.className = 'online-reward-preview-item';
            const img = document.createElement('img');
            img.src = this.getRewardIconByItemId(reward?.itemId);
            img.alt = `${reward?.itemId || 'item'}`;
            const amount = document.createElement('span');
            amount.className = 'amount';
            amount.textContent = `x${Math.max(0, Math.floor(Number(reward?.amount) || 0))}`;
            item.appendChild(img);
            item.appendChild(amount);
            this.onlineRewardPreviewBubbleEl.appendChild(item);
        }
        this.onlineRewardPreviewBubbleEl.classList.remove('hidden');
    }

    hideOnlineRewardPreview() {
        this.onlineRewardPreviewBubbleEl?.classList.add('hidden');
    }

    showCheckinRewardSettle(payload = {}) {
        const rewards = Array.isArray(payload?.rewards) ? payload.rewards : [];
        const coinRewardAmount = Math.max(0, Math.floor(Number(payload?.coinRewardAmount) || 0));
        this.pendingCheckinRewardPayload = {
            ...payload,
            rewards,
            coinRewardAmount,
            beforeCoins: Math.max(0, Math.floor(Number(payload?.beforeCoins) || 0)),
            afterCoins: Math.max(0, Math.floor(Number(payload?.afterCoins) || 0))
        };

        if (this.checkinRewardSettleDescEl) {
            this.checkinRewardSettleDescEl.textContent = this.locale === 'zh-CN'
                ? '签到成功，奖励如下：'
                : 'Check-in successful. Rewards:';
        }
        if (this.checkinRewardCoinHeroEl) {
            this.checkinRewardCoinHeroEl.classList.toggle('hidden', coinRewardAmount <= 0);
        }
        if (this.checkinRewardCoinHeroAmountEl) {
            this.checkinRewardCoinHeroAmountEl.textContent = `+${coinRewardAmount}`;
        }
        if (this.checkinRewardSettleListEl) {
            this.checkinRewardSettleListEl.innerHTML = '';
            for (const reward of rewards) {
                const node = document.createElement('div');
                node.className = 'online-settle-item';
                const icon = document.createElement('img');
                icon.className = 'online-settle-icon';
                icon.src = this.getRewardIconByItemId(reward?.itemId);
                icon.alt = `${reward?.itemId || 'item'}`;
                const text = document.createElement('span');
                text.textContent = this.formatRewardList([reward]);
                node.appendChild(icon);
                node.appendChild(text);
                this.checkinRewardSettleListEl.appendChild(node);
            }
        }
        if (this.btnCheckinRewardConfirm) {
            this.btnCheckinRewardConfirm.disabled = false;
            this.btnCheckinRewardConfirm.textContent = this.locale === 'zh-CN' ? '确定' : 'Confirm';
        }
        this.checkinRewardSettleOverlay?.classList.remove('hidden');
        this.refreshOnlineRewardDock();
    }

    closeCheckinRewardSettle() {
        this.checkinRewardSettleOverlay?.classList.add('hidden');
        this.pendingCheckinRewardPayload = null;
        this.refreshOnlineRewardDock();
    }

    async confirmCheckinRewardSettle() {
        const payload = this.pendingCheckinRewardPayload;
        if (!payload) {
            this.closeCheckinRewardSettle();
            return;
        }
        if (this.btnCheckinRewardConfirm) {
            this.btnCheckinRewardConfirm.disabled = true;
        }
        if (payload.coinRewardAmount > 0) {
            await this.playCheckinCoinFlyAnimation(payload);
        }
        this.stopCheckinCoinCounter();
        this.clearCoinDisplayOverride();
        this.closeCheckinRewardSettle();
    }

    stopCheckinCoinCounter() {
        if (this.checkinCoinCounterFrame && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.checkinCoinCounterFrame);
        }
        this.checkinCoinCounterFrame = 0;
    }

    animateCoinDisplayValue(fromValue, toValue, durationMs = CHECKIN_COIN_COUNTER_DURATION_MS) {
        const startValue = Math.max(0, Math.floor(Number(fromValue) || 0));
        const endValue = Math.max(startValue, Math.floor(Number(toValue) || 0));
        if (endValue <= startValue) {
            this.setCoinDisplayOverride(endValue);
            return Promise.resolve();
        }
        this.stopCheckinCoinCounter();
        return new Promise((resolve) => {
            const startAt = performance.now();
            const step = (now) => {
                const elapsed = Math.max(0, now - startAt);
                const progress = Math.min(1, elapsed / Math.max(1, durationMs));
                const eased = 1 - Math.pow(1 - progress, 3);
                const nextValue = Math.min(
                    endValue,
                    startValue + Math.floor((endValue - startValue) * eased)
                );
                this.setCoinDisplayOverride(nextValue);
                if (progress >= 1 || nextValue >= endValue) {
                    this.checkinCoinCounterFrame = 0;
                    this.setCoinDisplayOverride(endValue);
                    resolve();
                    return;
                }
                this.checkinCoinCounterFrame = requestAnimationFrame(step);
            };
            this.checkinCoinCounterFrame = requestAnimationFrame(step);
        });
    }

    getAppSpacePoint(element, anchor = 'center') {
        if (!(element instanceof HTMLElement) || !this.appContainerEl) {
            return null;
        }
        const appRect = this.appContainerEl.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const scaleX = appRect.width / Math.max(1, this.appContainerEl.offsetWidth);
        const scaleY = appRect.height / Math.max(1, this.appContainerEl.offsetHeight);
        let x = rect.left + (rect.width / 2);
        let y = rect.top + (rect.height / 2);
        if (anchor === 'top-right') {
            x = rect.right - 8;
            y = rect.top + 10;
        }
        return {
            x: (x - appRect.left) / Math.max(0.0001, scaleX),
            y: (y - appRect.top) / Math.max(0.0001, scaleY)
        };
    }

    getAppSpaceRect(element) {
        if (!(element instanceof HTMLElement) || !this.appContainerEl) {
            return null;
        }
        const appRect = this.appContainerEl.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        const scaleX = appRect.width / Math.max(1, this.appContainerEl.offsetWidth);
        const scaleY = appRect.height / Math.max(1, this.appContainerEl.offsetHeight);
        return {
            left: (rect.left - appRect.left) / Math.max(0.0001, scaleX),
            top: (rect.top - appRect.top) / Math.max(0.0001, scaleY),
            width: rect.width / Math.max(0.0001, scaleX),
            height: rect.height / Math.max(0.0001, scaleY)
        };
    }

    animateSingleFlyCoin(sourcePoint, targetPoint, index) {
        return new Promise((resolve) => {
            if (!this.rewardFlyLayerEl || !sourcePoint || !targetPoint) {
                resolve();
                return;
            }
            const coin = document.createElement('img');
            coin.className = 'reward-fly-coin';
            coin.src = 'assets/design-v5/clean/icon_coin.png';
            coin.alt = '';
            coin.style.left = `${sourcePoint.x}px`;
            coin.style.top = `${sourcePoint.y}px`;
            this.rewardFlyLayerEl.appendChild(coin);

            const dx = targetPoint.x - sourcePoint.x;
            const dy = targetPoint.y - sourcePoint.y;
            const arcLift = 26 + (index % 3) * 10;
            const delay = index * 90;
            const cleanup = () => {
                coin.remove();
                resolve();
            };

            if (typeof coin.animate !== 'function') {
                setTimeout(cleanup, CHECKIN_COIN_FLY_DURATION_MS + delay);
                return;
            }

            const animation = coin.animate([
                { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(0.92)', opacity: 0 },
                { offset: 0.12, transform: 'translate(-50%, -50%) translate(0px, 0px) scale(1.02)', opacity: 1 },
                {
                    offset: 0.55,
                    transform: `translate(-50%, -50%) translate(${Math.round(dx * 0.48)}px, ${Math.round(dy * 0.38 - arcLift)}px) scale(1.05)`,
                    opacity: 1
                },
                {
                    transform: `translate(-50%, -50%) translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(0.48)`,
                    opacity: 0.1
                }
            ], {
                duration: CHECKIN_COIN_FLY_DURATION_MS,
                delay,
                easing: 'cubic-bezier(0.2, 0.85, 0.18, 1)',
                fill: 'forwards'
            });
            animation.onfinish = cleanup;
            animation.oncancel = cleanup;
        });
    }

    setMenuCoinFlyFocus(active) {
        if (!(this.menuCoinDisplay instanceof HTMLElement)) {
            return;
        }
        this.menuCoinDisplay.classList.toggle('coin-chip-fly-focus', !!active);
    }

    promoteMenuCoinDisplayForFly() {
        if (!(this.menuCoinDisplay instanceof HTMLElement) || !(this.appContainerEl instanceof HTMLElement) || this.menuCoinFlyRestore) {
            return;
        }
        const rect = this.getAppSpaceRect(this.menuCoinDisplay);
        const parent = this.menuCoinDisplay.parentElement;
        if (!rect || !(parent instanceof HTMLElement)) {
            return;
        }
        this.menuCoinFlyRestore = {
            parent,
            nextSibling: this.menuCoinDisplay.nextSibling,
            style: this.menuCoinDisplay.getAttribute('style') || ''
        };
        this.menuCoinDisplay.style.position = 'absolute';
        this.menuCoinDisplay.style.left = `${Math.round(rect.left)}px`;
        this.menuCoinDisplay.style.top = `${Math.round(rect.top)}px`;
        this.menuCoinDisplay.style.width = `${Math.round(rect.width)}px`;
        this.menuCoinDisplay.style.height = `${Math.round(rect.height)}px`;
        this.menuCoinDisplay.style.right = 'auto';
        this.menuCoinDisplay.style.zIndex = '96';
        this.menuCoinDisplay.style.pointerEvents = 'none';
        this.appContainerEl.appendChild(this.menuCoinDisplay);
    }

    restoreMenuCoinDisplayAfterFly() {
        if (!(this.menuCoinDisplay instanceof HTMLElement) || !this.menuCoinFlyRestore) {
            return;
        }
        const restore = this.menuCoinFlyRestore;
        this.menuCoinFlyRestore = null;
        if (restore.nextSibling) {
            restore.parent.insertBefore(this.menuCoinDisplay, restore.nextSibling);
        } else {
            restore.parent.appendChild(this.menuCoinDisplay);
        }
        if (restore.style) {
            this.menuCoinDisplay.setAttribute('style', restore.style);
        } else {
            this.menuCoinDisplay.removeAttribute('style');
        }
    }

    async playRewardCoinFlyAnimation(payload, sourceElement) {
        const sourcePoint = this.getAppSpacePoint(sourceElement);
        const targetPoint = this.getAppSpacePoint(this.menuCoinDisplay, 'top-right');
        if (!sourcePoint || !targetPoint) {
            this.setCoinDisplayOverride(payload.afterCoins);
            return;
        }
        this.promoteMenuCoinDisplayForFly();
        this.setMenuCoinFlyFocus(true);
        this.rewardFlyLayerEl?.classList.remove('hidden');
        try {
            const counterPromise = this.animateCoinDisplayValue(payload.beforeCoins, payload.afterCoins);
            const flights = [];
            for (let i = 0; i < CHECKIN_COIN_FLY_COUNT; i += 1) {
                setTimeout(() => {
                    playCheckinRewardCoinSound();
                }, i * 90);
                flights.push(this.animateSingleFlyCoin(sourcePoint, targetPoint, i));
            }
            await Promise.all([...flights, counterPromise]);
        } finally {
            this.setMenuCoinFlyFocus(false);
            this.rewardFlyLayerEl?.classList.add('hidden');
            if (this.rewardFlyLayerEl) {
                this.rewardFlyLayerEl.innerHTML = '';
            }
            this.restoreMenuCoinDisplayAfterFly();
        }
    }

    async playCheckinCoinFlyAnimation(payload) {
        await this.playRewardCoinFlyAnimation(payload, this.checkinRewardCoinHeroIconEl);
    }

    showOnlineRewardSettle(payload = {}) {
        const rewards = Array.isArray(payload?.rewards) ? payload.rewards : [];
        const beforeCoins = Math.max(0, Math.floor(Number(payload?.beforeCoins) || 0));
        const afterCoins = Math.max(0, Math.floor(Number(payload?.afterCoins) || beforeCoins));
        const coinRewardAmount = Math.max(0, Math.floor(Number(payload?.coinRewardAmount) || 0));
        this.pendingOnlineRewardPayload = {
            ...payload,
            rewards,
            beforeCoins,
            afterCoins,
            coinRewardAmount
        };
        this.onlineRewardSettleCoinIconEl = null;
        if (this.onlineRewardSettleDescEl) {
            this.onlineRewardSettleDescEl.textContent = this.locale === 'zh-CN' ? '本次在线奖励：' : 'Online reward:';
        }
        if (this.onlineRewardSettleListEl) {
            this.onlineRewardSettleListEl.innerHTML = '';
            const rows = Array.isArray(rewards) ? rewards : [];
            for (const reward of rows) {
                const node = document.createElement('div');
                node.className = 'online-settle-item';
                const icon = document.createElement('img');
                icon.className = 'online-settle-icon';
                icon.src = this.getRewardIconByItemId(reward?.itemId);
                icon.alt = `${reward?.itemId || 'item'}`;
                if (!this.onlineRewardSettleCoinIconEl && `${reward?.itemId || ''}` === 'coin') {
                    this.onlineRewardSettleCoinIconEl = icon;
                }
                const text = document.createElement('span');
                text.textContent = this.formatRewardList([reward]);
                node.appendChild(icon);
                node.appendChild(text);
                this.onlineRewardSettleListEl.appendChild(node);
            }
        }
        if (this.btnOnlineRewardSettleClose) {
            this.btnOnlineRewardSettleClose.disabled = false;
            this.btnOnlineRewardSettleClose.textContent = this.locale === 'zh-CN' ? '确定' : 'Confirm';
        }
        this.onlineRewardSettleOverlay?.classList.remove('hidden');
    }

    closeOnlineRewardSettle(finalizeCoinDisplay = false) {
        this.onlineRewardSettleOverlay?.classList.add('hidden');
        const payload = this.pendingOnlineRewardPayload;
        this.pendingOnlineRewardPayload = null;
        this.onlineRewardSettleCoinIconEl = null;
        if (finalizeCoinDisplay && payload) {
            this.stopCheckinCoinCounter();
            this.clearCoinDisplayOverride();
        }
        this.refreshOnlineRewardDock();
    }

    async confirmOnlineRewardSettle() {
        const payload = this.pendingOnlineRewardPayload;
        if (!payload) {
            this.closeOnlineRewardSettle(true);
            return;
        }
        if (this.btnOnlineRewardSettleClose) {
            this.btnOnlineRewardSettleClose.disabled = true;
        }
        if (payload.coinRewardAmount > 0) {
            await this.playRewardCoinFlyAnimation(payload, this.onlineRewardSettleCoinIconEl);
        }
        this.stopCheckinCoinCounter();
        this.clearCoinDisplayOverride();
        this.closeOnlineRewardSettle(false);
    }

    syncScorePulse() {
        const totalScore = Math.max(0, Math.floor(Number(this.game?.score) || 0));
        this.updateScorePulseVisual(totalScore, false, 0, Number(this.game?.combo) || 0);
    }

    showScorePulse(payload = {}) {
        const gained = Math.max(0, Math.floor(Number(payload?.gained) || 0));
        const totalScore = Math.max(0, Math.floor(Number(payload?.score) || Number(this.game?.score) || 0));
        const combo = Math.max(0, Math.floor(Number(payload?.combo) || Number(this.game?.combo) || 0));
        this.updateScorePulseVisual(totalScore, gained > 0, gained, combo);
    }

    resolveScorePulseStyle(totalScore) {
        if (totalScore >= 12000) {
            return {
                scale: 1.38,
                color: '#ff77c1',
                shadow: '0 2px 0 rgba(56, 23, 37, 0.68), 0 0 12px rgba(255, 103, 186, 0.56), 0 0 24px rgba(255, 89, 176, 0.34)',
                gainColor: '#ffe8f6'
            };
        }
        if (totalScore >= 8000) {
            return {
                scale: 1.30,
                color: '#ff9766',
                shadow: '0 2px 0 rgba(63, 35, 20, 0.65), 0 0 10px rgba(255, 143, 92, 0.46), 0 0 20px rgba(255, 129, 73, 0.26)',
                gainColor: '#fff0d9'
            };
        }
        if (totalScore >= 5000) {
            return {
                scale: 1.22,
                color: '#ffcb72',
                shadow: '0 2px 0 rgba(66, 42, 21, 0.62), 0 0 8px rgba(255, 206, 117, 0.42), 0 0 18px rgba(255, 176, 77, 0.22)',
                gainColor: '#fff2c8'
            };
        }
        if (totalScore >= 2500) {
            return {
                scale: 1.15,
                color: '#ffe592',
                shadow: '0 2px 0 rgba(62, 43, 22, 0.6), 0 0 8px rgba(255, 234, 162, 0.36)',
                gainColor: '#fff4cf'
            };
        }
        if (totalScore >= 1000) {
            return {
                scale: 1.08,
                color: '#f0ffd2',
                shadow: '0 2px 0 rgba(45, 30, 20, 0.58), 0 0 6px rgba(225, 255, 166, 0.3)',
                gainColor: '#f8ffd9'
            };
        }
        return {
            scale: 1,
            color: '#e6f4d4',
            shadow: '0 2px 0 rgba(45, 30, 20, 0.58), 0 6px 12px rgba(38, 23, 16, 0.28)',
            gainColor: '#fff4cf'
        };
    }

    updateScorePulseVisual(totalScore, animate = false, gained = 0, combo = 0) {
        if (!this.hudScoreValueEl) {
            return;
        }

        const style = this.resolveScorePulseStyle(totalScore);
        const locale = this.locale === 'en-US' ? 'en-US' : 'zh-CN';
        this.hudScoreValueEl.textContent = new Intl.NumberFormat(locale).format(totalScore);
        this.hudScoreValueEl.style.color = style.color;
        this.hudScoreValueEl.style.textShadow = style.shadow;
        this.hudScoreValueEl.style.setProperty('--score-base-scale', style.scale.toFixed(3));

        if (animate && typeof this.hudScoreValueEl.animate === 'function') {
            if (this.scorePulseAnimation && typeof this.scorePulseAnimation.cancel === 'function') {
                this.scorePulseAnimation.cancel();
            }
            const pulseBoost = Math.min(0.34, 0.1 + (Math.min(1800, gained) / 1800) * 0.12 + Math.min(0.12, combo * 0.01));
            const baseScale = style.scale;
            this.scorePulseAnimation = this.hudScoreValueEl.animate([
                { transform: `scale(${(baseScale * 0.82).toFixed(3)})` },
                { offset: 0.45, transform: `scale(${(baseScale * (1 + pulseBoost)).toFixed(3)})` },
                { transform: `scale(${baseScale.toFixed(3)})` }
            ], {
                duration: Math.round(320 + Math.min(260, combo * 14)),
                easing: 'cubic-bezier(0.2, 0.9, 0.22, 1)',
                fill: 'forwards'
            });
            this.scorePulseAnimation.onfinish = () => {
                this.scorePulseAnimation = null;
            };
            this.scorePulseAnimation.oncancel = () => {
                this.scorePulseAnimation = null;
            };
        }

        if (!this.hudScoreGainEl) {
            return;
        }
        if (gained <= 0) {
            this.hudScoreGainEl.classList.add('hidden');
            this.hudScoreGainEl.textContent = '';
            return;
        }

        this.hudScoreGainEl.textContent = `+${gained}`;
        this.hudScoreGainEl.style.color = style.gainColor;
        this.hudScoreGainEl.classList.remove('hidden');

        if (this.scoreGainAnimation && typeof this.scoreGainAnimation.cancel === 'function') {
            this.scoreGainAnimation.cancel();
        }
        if (typeof this.hudScoreGainEl.animate !== 'function') {
            return;
        }
        this.scoreGainAnimation = this.hudScoreGainEl.animate([
            { opacity: 0, transform: 'translateY(6px) scale(0.84)' },
            { offset: 0.25, opacity: 1, transform: 'translateY(0px) scale(1.06)' },
            { opacity: 0, transform: 'translateY(-16px) scale(1.1)' }
        ], {
            duration: 520,
            easing: 'cubic-bezier(0.18, 0.84, 0.2, 1)',
            fill: 'forwards'
        });
        this.scoreGainAnimation.onfinish = () => {
            this.hudScoreGainEl?.classList.add('hidden');
            if (this.hudScoreGainEl) {
                this.hudScoreGainEl.textContent = '';
            }
            this.scoreGainAnimation = null;
        };
        this.scoreGainAnimation.oncancel = () => {
            this.scoreGainAnimation = null;
        };
    }

    updateToolButtons() {
        for (const item of TOOL_BUTTON_CONFIG) {
            const button = document.getElementById(item.buttonId);
            if (!button) continue;

            const remaining = typeof this.game.getToolUses === 'function'
                ? this.game.getToolUses(item.id)
                : 0;

            const badge = button.querySelector('.badge-plus');
            if (badge) {
                badge.textContent = String(remaining);
                badge.classList.toggle('is-empty', remaining <= 0);
            }

            let disabled = this.game.state !== 'PLAYING' || remaining <= 0;
            if (item.id === 'undo' && (!Array.isArray(this.game.undoStack) || this.game.undoStack.length === 0)) {
                disabled = true;
            }
            button.disabled = disabled;
            button.classList.toggle('item-btn-disabled', disabled);
        }
    }

    updateTimer() {
        if (!this.timerEl) return;

        if (!this.game.hasTimer) {
            this.clearTimerEnergyOrbs();
            this.timerEl.classList.add('hidden');
            return;
        }

        this.timerEl.classList.remove('hidden');
        const maxSeconds = Math.max(1, Number(this.game.maxTimeRemaining) || 1);
        const remainingSeconds = Math.max(0, Number(this.game.timeRemaining) || 0);
        const ratio = Math.max(0, Math.min(1, remainingSeconds / maxSeconds));
        const displaySeconds = Math.ceil(remainingSeconds);
        const mins = Math.floor(displaySeconds / 60);
        const secs = displaySeconds % 60;

        if (this.timerFillEl) {
            this.timerFillEl.style.transform = `scaleX(${ratio.toFixed(4)})`;
        }
        if (this.timerLabelEl) {
            this.timerLabelEl.textContent = `${mins}m${secs.toString().padStart(2, '0')}s`;
        } else {
            this.timerEl.textContent = `${mins}m${secs.toString().padStart(2, '0')}s`;
        }

        this.timerEl.classList.toggle('timer-danger', ratio <= 0.12 || displaySeconds <= 10);
        this.timerEl.setAttribute('aria-valuemin', '0');
        this.timerEl.setAttribute('aria-valuemax', String(maxSeconds));
        this.timerEl.setAttribute('aria-valuenow', String(Math.max(0, Math.min(maxSeconds, displaySeconds))));
    }

    updateComboDisplay() {
        if (!this.comboDisplayEl) {
            return;
        }
        const combo = Math.max(0, Math.floor(Number(this.game.combo) || 0));
        const shouldShow = combo >= 5;
        this.comboDisplayEl.classList.toggle('hidden', !shouldShow);
        this.comboDisplayEl.classList.remove('combo-tier-1', 'combo-tier-2', 'combo-tier-3', 'combo-tier-4');
        if (!shouldShow) {
            this.comboDisplayEl.replaceChildren();
            return;
        }

        const countEl = document.createElement('span');
        countEl.className = 'hud-combo-count';
        countEl.textContent = `${combo}`;

        const labelEl = document.createElement('span');
        labelEl.className = 'hud-combo-label';
        labelEl.textContent = 'combo';

        this.comboDisplayEl.replaceChildren(countEl, labelEl);
    }

    showRewardUnlockToast() {
        if (!this.rewardUnlockToastEl) {
            return;
        }

        const imageEl = this.rewardUnlockToastImageEl;
        const textEl = this.rewardUnlockToastTextEl;
        if (imageEl) {
            const hasLoadedImage = imageEl.complete && imageEl.naturalWidth > 0;
            imageEl.classList.toggle('hidden', !hasLoadedImage);
            if (!hasLoadedImage && textEl) {
                imageEl.addEventListener('load', () => {
                    imageEl.classList.remove('hidden');
                    textEl.classList.add('hidden');
                }, { once: true });
            }
        }
        if (textEl) {
            const showTextFallback = !imageEl || imageEl.classList.contains('hidden');
            textEl.classList.toggle('hidden', !showTextFallback);
        }

        if (this.rewardUnlockToastTimer) {
            clearTimeout(this.rewardUnlockToastTimer);
            this.rewardUnlockToastTimer = 0;
        }
        this.rewardUnlockToastEl.classList.remove('hidden');
        this.rewardUnlockToastEl.classList.remove('is-playing');
        void this.rewardUnlockToastEl.offsetWidth;
        this.rewardUnlockToastEl.classList.add('is-playing');

        this.rewardUnlockToastTimer = setTimeout(() => {
            if (!this.rewardUnlockToastEl) return;
            this.rewardUnlockToastEl.classList.remove('is-playing');
            this.rewardUnlockToastEl.classList.add('hidden');
            this.rewardUnlockToastTimer = 0;
        }, 2200);
    }

    spawnTimerEnergyOrb(payload = {}) {
        const seconds = Math.max(0, Number(payload.seconds) || 0);
        if (seconds <= 0) {
            return;
        }

        const batchId = typeof payload.batchId === 'number' ? payload.batchId : null;
        const lineId = typeof payload.lineId === 'number' ? payload.lineId : null;

        const applyGainDirectly = () => this.game.collectTimerEnergy(seconds, batchId, lineId);

        if (!this.hudEnergyLayerEl || !this.timerEl || this.timerEl.classList.contains('hidden')) {
            applyGainDirectly();
            return;
        }

        const start = this.resolveCanvasPointInApp(payload.x, payload.y);
        const target = this.resolveTimerTargetInApp();
        if (!start || !target) {
            applyGainDirectly();
            return;
        }

        const orb = document.createElement('span');
        orb.className = 'hud-energy-orb';
        if (batchId !== null) {
            orb.dataset.batchId = String(batchId);
        }
        orb.style.left = `${start.x}px`;
        orb.style.top = `${start.y}px`;
        this.hudEnergyLayerEl.appendChild(orb);
        this.energyOrbNodes.add(orb);

        if (typeof orb.animate !== 'function') {
            this.energyOrbNodes.delete(orb);
            orb.remove();
            applyGainDirectly();
            return;
        }

        const dx = target.x - start.x;
        const dy = target.y - start.y;
        const lift = 24 + Math.random() * 20;
        const duration = 320 + Math.random() * 200;
        const animation = orb.animate([
            { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0.2 },
            { offset: 0.12, transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { offset: 0.68, transform: `translate(-50%, -50%) translate(${dx * 0.65}px, ${dy * 0.65 - lift}px) scale(0.92)`, opacity: 0.95 },
            { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.72)`, opacity: 0.1 }
        ], {
            duration,
            easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
            fill: 'forwards'
        });

        let finalized = false;
        const cleanup = () => {
            if (finalized) return;
            finalized = true;
            this.energyOrbNodes.delete(orb);
            if (orb.isConnected) {
                orb.remove();
            }
        };

        animation.onfinish = () => {
            cleanup();
            const gained = applyGainDirectly();
            if (gained > 0) {
                this.flashTimerGain();
                this.showTimerGainText(gained);
            }
        };
        animation.oncancel = () => cleanup();
    }

    cancelTimerEnergyBatch(batchId) {
        const parsed = Number(batchId);
        if (!Number.isFinite(parsed)) {
            return;
        }
        for (const orb of Array.from(this.energyOrbNodes)) {
            if (Number(orb.dataset.batchId) !== parsed) {
                continue;
            }
            const animations = typeof orb.getAnimations === 'function' ? orb.getAnimations() : [];
            if (animations.length > 0) {
                for (const animation of animations) {
                    animation.cancel();
                }
            } else {
                this.energyOrbNodes.delete(orb);
                orb.remove();
            }
        }
    }

    clearTimerEnergyOrbs() {
        for (const orb of Array.from(this.energyOrbNodes)) {
            const animations = typeof orb.getAnimations === 'function' ? orb.getAnimations() : [];
            if (animations.length > 0) {
                for (const animation of animations) {
                    animation.cancel();
                }
            } else {
                orb.remove();
            }
        }
        this.energyOrbNodes.clear();
        this.hudEnergyLayerEl?.querySelectorAll('.hud-timer-gain-pop').forEach((node) => node.remove());
    }

    resolveCanvasPointInApp(canvasX, canvasY) {
        const canvas = this.game?.canvas;
        if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
            return null;
        }
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        const x = Math.max(0, Math.min(canvas.width, Number(canvasX) || 0));
        const y = Math.max(0, Math.min(canvas.height, Number(canvasY) || 0));
        const clientX = rect.left + (x / canvas.width) * rect.width;
        const clientY = rect.top + (y / canvas.height) * rect.height;
        return this.toAppPoint(clientX, clientY);
    }

    resolveTimerTargetInApp() {
        if (!this.timerEl) {
            return null;
        }
        const rect = this.timerEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }
        const clientX = rect.left + rect.width * 0.82;
        const clientY = rect.top + rect.height * 0.5;
        return this.toAppPoint(clientX, clientY);
    }

    resolveTimerGainAnchorInApp() {
        if (!this.timerEl) {
            return null;
        }
        const rect = this.timerEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }
        const clientX = rect.right - 6;
        const clientY = rect.top + 2;
        return this.toAppPoint(clientX, clientY);
    }

    toAppPoint(clientX, clientY) {
        const app = document.querySelector('.app-container');
        if (!app) {
            return null;
        }
        const rect = app.getBoundingClientRect();
        const scaleX = app.clientWidth > 0 ? rect.width / app.clientWidth : 1;
        const scaleY = app.clientHeight > 0 ? rect.height / app.clientHeight : 1;
        if (scaleX <= 0 || scaleY <= 0) {
            return null;
        }
        return {
            x: (clientX - rect.left) / scaleX,
            y: (clientY - rect.top) / scaleY
        };
    }

    flashTimerGain() {
        if (!this.timerEl) {
            return;
        }
        this.timerEl.classList.remove('timer-gain');
        void this.timerEl.offsetWidth;
        this.timerEl.classList.add('timer-gain');
        setTimeout(() => {
            this.timerEl?.classList.remove('timer-gain');
        }, 180);
    }

    showTimerGainText(gainedSeconds, anchor = null) {
        if (!this.hudEnergyLayerEl) {
            return;
        }
        const resolvedAnchor = anchor || this.resolveTimerGainAnchorInApp();
        if (!resolvedAnchor) {
            return;
        }
        const display = Math.max(1, Math.round(Number(gainedSeconds) || 0));
        const popup = document.createElement('span');
        popup.className = 'hud-timer-gain-pop';
        popup.textContent = `+${display}`;
        popup.style.left = `${resolvedAnchor.x}px`;
        popup.style.top = `${resolvedAnchor.y}px`;
        this.hudEnergyLayerEl.appendChild(popup);

        if (typeof popup.animate !== 'function') {
            setTimeout(() => popup.remove(), 360);
            return;
        }

        const animation = popup.animate([
            { transform: 'translate(-50%, -50%) translateY(0px) scale(0.92)', opacity: 0 },
            { offset: 0.2, transform: 'translate(-50%, -50%) translateY(-8px) scale(1.08)', opacity: 1 },
            { transform: 'translate(-50%, -50%) translateY(-24px) scale(1)', opacity: 0 }
        ], {
            duration: 520,
            easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
            fill: 'forwards'
        });
        animation.onfinish = () => popup.remove();
        animation.oncancel = () => popup.remove();
    }

    getLocaleText(zhText, enText) {
        return this.locale === 'en-US' ? enText : zhText;
    }

    getSkinLocaleValue(mapLike, fallback = '') {
        if (!mapLike || typeof mapLike !== 'object') {
            return fallback;
        }
        return mapLike[this.locale] || mapLike['en-US'] || fallback;
    }

    renderSkinCenter() {
        if (!this.skinList) {
            return;
        }

        const skins = typeof this.game.getSkinCatalog === 'function'
            ? this.game.getSkinCatalog()
            : [];
        const selectedSkinId = typeof this.game.getSelectedSkinId === 'function'
            ? this.game.getSelectedSkinId()
            : '';

        this.updateCoinDisplays();

        this.skinList.innerHTML = '';

        for (const skin of skins) {
            const unlocked = typeof this.game.isSkinUnlocked === 'function'
                ? this.game.isSkinUnlocked(skin.id)
                : Number(skin.coinCost) <= 0;
            const selected = unlocked && selectedSkinId === skin.id;
            const canUnlock = !unlocked && typeof this.game.canUnlockSkin === 'function'
                ? this.game.canUnlockSkin(skin.id)
                : false;

            const card = document.createElement('article');
            card.className = 'skin-card';
            if (selected) {
                card.classList.add('skin-card-selected');
            }
            if (!unlocked) {
                card.classList.add('skin-card-locked');
            }

            const preview = document.createElement('img');
            preview.className = 'skin-preview';
            preview.src = skin.preview;
            preview.alt = this.getSkinLocaleValue(skin.name, skin.id);
            preview.loading = 'lazy';
            preview.addEventListener('error', () => {
                if (preview.dataset.fallbackApplied === '1') {
                    return;
                }
                preview.dataset.fallbackApplied = '1';
                preview.src = 'assets/skins/classic-burrow/snake_head.png';
            });

            const meta = document.createElement('div');
            meta.className = 'skin-meta';

            const title = document.createElement('h3');
            title.className = 'skin-name';
            title.textContent = this.getSkinLocaleValue(skin.name, skin.id);

            const desc = document.createElement('p');
            desc.className = 'skin-desc';
            desc.textContent = this.getSkinLocaleValue(skin.description, '');

            const status = document.createElement('p');
            status.className = 'skin-status';
            if (selected) {
                status.textContent = this.getLocaleText('\u4f7f\u7528\u4e2d', 'In Use');
            } else if (unlocked) {
                status.textContent = this.getLocaleText('\u5df2\u89e3\u9501', 'Unlocked');
            } else {
                status.textContent = this.getLocaleText(
                    `\u4ef7\u683c ${skin.coinCost} \u91d1\u5e01`,
                    `${skin.coinCost} coins`
                );
            }

            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'skin-action-btn';
            if (selected) {
                action.textContent = this.getLocaleText('\u5df2\u88c5\u5907', 'Equipped');
                action.disabled = true;
            } else if (unlocked) {
                action.textContent = this.getLocaleText('\u88c5\u5907', 'Use');
                action.addEventListener('click', () => {
                    if (this.game.selectSkin(skin.id)) {
                        this.renderSkinCenter();
                    }
                });
            } else {
                action.textContent = this.getLocaleText(
                    `\u89e3\u9501 (${skin.coinCost})`,
                    `Unlock (${skin.coinCost})`
                );
                action.disabled = !canUnlock;
                action.addEventListener('click', () => {
                    const result = this.game.unlockSkin(skin.id);
                    if (result?.ok) {
                        this.renderSkinCenter();
                    }
                });
            }

            meta.appendChild(title);
            meta.appendChild(desc);
            meta.appendChild(status);
            card.appendChild(preview);
            card.appendChild(meta);
            card.appendChild(action);
            this.skinList.appendChild(card);
        }
    }
    showLevelCompletePopup() {
        this.levelCompleteOverlay.classList.remove('hidden');
        this.updateCoinDisplays();
        if (typeof this.game.playLevelCompleteCelebration === 'function') {
            this.game.playLevelCompleteCelebration();
        }
        const isCampaignComplete = typeof this.game.isCampaignCompleted === 'function'
            && this.game.isCampaignCompleted();
        if (this.audioEnabled && isCampaignComplete) {
            playBgmForScene(BGM_SCENE_KEYS.CAMPAIGN_COMPLETE, { restart: true });
        } else if (this.audioEnabled) {
            this.syncGameplayBgm(false);
        }
        if (this.levelCompleteNextButton) {
            this.levelCompleteNextButton.textContent = '下一关';
        }
        if (this.levelCompleteTitleEl) {
            this.levelCompleteTitleEl.textContent = '恭喜过关';
        }
        if (this.levelScore) {
            this.levelScore.textContent = t(this.locale, 'common.score', { score: this.game.score });
        }
        if (this.levelCoinReward) {
            const earnedCoins = typeof this.game.getLastCoinReward === 'function'
                ? this.game.getLastCoinReward()
                : 0;
            const totalCoins = typeof this.game.getCoins === 'function'
                ? this.game.getCoins()
                : 0;
            this.levelCoinReward.textContent = this.getLocaleText(
                `\u91d1\u5e01 +${earnedCoins}\uff08\u603b\u8ba1 ${totalCoins}\uff09`,
                `Coins +${earnedCoins} (Total ${totalCoins})`
            );
        }
    }

    showGameOverPopup(reason) {
        this.gameOverOverlay.classList.remove('hidden');
        if (this.gameOverReason) {
            this.gameOverReason.textContent = reason || t(this.locale, 'panel.over.title');
        }
    }

    buildLevelGrid() {
        if (!this.levelGrid) return;

        this.levelGrid.innerHTML = '';
        const defaultLevel = this.getDefaultStartLevel();
        const totalLevels = this.getCampaignLevelCount();
        const unlockedMax = Math.min(totalLevels, Math.max(1, Number(this.game.maxUnlockedLevel) || 1));
        for (let i = 1; i <= totalLevels; i++) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'level-btn';
            button.setAttribute('aria-label', this.formatLevel(i));

            if (i <= unlockedMax) {
                button.classList.add('unlocked');
                if (i < unlockedMax) {
                    button.classList.add('completed');
                }
                if (i === defaultLevel) {
                    button.classList.add('current');
                }
                button.textContent = i;
                button.addEventListener('click', () => {
                    try {
                        if (this.audioEnabled) {
                            resumeAudioV31();
                            playClickSoundV31();
                        }
                    } catch (error) {
                        console.warn('Audio click failed for level button:', error);
                    }
                    this.startSpecificLevel(i);
                });
            } else {
                button.classList.add('locked');
                button.title = t(this.locale, 'common.locked');
                const icon = document.createElement('img');
                icon.src = 'assets/design-v2/clean/icon_lock.png';
                icon.alt = t(this.locale, 'common.locked');
                icon.className = 'pixel-icon level-lock-icon';
                button.appendChild(icon);
            }

            this.levelGrid.appendChild(button);
        }
    }

    handleExitConfirm() {
        if (window.opener) {
            window.close();
            return;
        }

        if (this.exitFeedback) {
            this.exitFeedback.classList.remove('hidden');
            this.exitFeedback.textContent = t(this.locale, 'panel.exit.feedback');
        }
    }

    handleSettingsConfirmAction() {
        if (this.settingsConfirmMode === SETTINGS_CONFIRM_MODE.END_RUN) {
            this.openMenuPanel(MENU_PANEL.HOME);
            return;
        }

        this.game.maxUnlockedLevel = 1;
        this.game.currentLevel = 1;
        this.game.saveProgress();
        this.refreshMenuLevelTag();
        this.openMenuPanel(MENU_PANEL.HOME);
    }

    triggerErrorVignette() {
        const vignette = document.getElementById('errorVignette');
        if (!vignette) return;

        vignette.classList.remove('active');
        void vignette.offsetWidth;
        vignette.classList.add('active');
    }
}

export { MENU_PANEL };




import { detectInitialLocale, persistLocale, resolveLocale, t } from './i18n.js?v=9';
import {
    BGM_SCENE_KEYS,
    playBgmForScene,
    playClickSound as playClickSoundV31,
    readAudioMixConfig,
    resumeAudio as resumeAudioV31,
    setMusicVolume,
    setSfxVolume,
    playCheckinRewardCoinSound,
    playFinalCountdownTickSound,
    stopBgm
} from './audio.js?v=73';
import { getSkinDescription, getSkinDisplayName } from './skins.js?v=31';
import { cloneUiLayoutConfig, readUiLayoutConfig, subscribeUiLayoutConfig } from './ui-layout-config.js?v=12';
import { getUiAsset } from './ui-theme.js?v=2';
import {
    applySessionFromUser,
    bootstrapUserSessionFromStorage,
    getActiveUserId,
    getActiveUserSession,
    isOfflineAuthMode,
    openUserLoginDialog
} from './user-auth.js?v=6';
import { playRewardedAd, REWARDED_AD_PLACEMENTS } from './rewarded-ad-service.js?v=2';

const MENU_PANEL = Object.freeze({
    HOME: 'HOME',
    LEVEL_SELECT: 'LEVEL_SELECT',
    SETTINGS: 'SETTINGS',
    LEADERBOARD: 'LEADERBOARD',
    SKINS: 'SKINS',
    CHECKIN: 'CHECKIN',
    SUPPORT_AUTHOR: 'SUPPORT_AUTHOR',
    PROFILE: 'PROFILE',
    EXIT_CONFIRM: 'EXIT_CONFIRM',
    RESET_PROGRESS_CONFIRM: 'RESET_PROGRESS_CONFIRM'
});

const FEATURE_CONFIG = Object.freeze([
    { id: 'settings', buttonId: 'btnSettings', panelId: MENU_PANEL.SETTINGS, labelKey: 'feature.settings', iconSlot: 'icon.settings', badge: null, enabled: true },
    { id: 'leaderboard', buttonId: 'btnLeaderboard', panelId: MENU_PANEL.LEADERBOARD, labelKey: 'feature.leaderboard', iconSlot: 'icon.leaderboard', badge: null, enabled: true },
    { id: 'skins', buttonId: 'btnSkins', panelId: MENU_PANEL.SKINS, labelKey: 'feature.skins', iconSlot: 'icon.skins', badge: null, enabled: true },
    { id: 'checkin', buttonId: 'btnCheckin', panelId: MENU_PANEL.CHECKIN, labelKey: 'feature.checkin', iconSlot: 'icon.checkin', badge: null, enabled: true },
    { id: 'exit', buttonId: 'btnExit', panelId: MENU_PANEL.EXIT_CONFIRM, labelKey: 'feature.exit', iconSlot: 'icon.exit', badge: null, enabled: true },
    { id: 'support-author', buttonId: 'btnSupportAuthor', panelId: MENU_PANEL.SUPPORT_AUTHOR, labelKey: 'feature.supportAuthor', iconSlot: 'icon.home', badge: null, enabled: true }
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

const LEADERBOARD_MODE = Object.freeze({
    CLEAR: 'clear',
    BADGE: 'badge'
});
const LEADERBOARD_PAGE_SIZE = 20;
const LEADERBOARD_SCROLL_LOAD_THRESHOLD = 120;

const LEVEL_SETTLE_MIN_MS = 700;
const LEVEL_SETTLE_MAX_MS = 1800;
const LEVEL_SETTLE_PER_POINT_MS = 0.4;
const LEVEL_SETTLE_COMBO_EMPHASIS_MS = 420;
const LEVEL_SETTLE_MULTIPLIER_HOLD_MS = 180;
const BGM_LEVEL_GROUP_SIZE = 5;
const CHECKIN_COIN_FLY_COUNT = 6;
const CHECKIN_COIN_FLY_DURATION_MS = 920;
const CHECKIN_COIN_COUNTER_DURATION_MS = 1040;
const REWARD_GUIDE_TEXT = 'Try holding and swiping your finger in reward stages!';
const HOME_MASCOT_VIDEO_SRC = 'assets/audio/bgm/home_dance_h264_v20260421.mp4?v=20260421c';
const HOME_MASCOT_BLACK_KEY_MIN = 18;
const HOME_MASCOT_BLACK_KEY_SOFT = 54;
const HOME_MASCOT_VIDEO_CROP_RIGHT = 70;
const HOME_MASCOT_VIDEO_CROP_BOTTOM = 26;
const PERF_GESTURE_PREP_TAPS = 4;
const HOME_VIDEO_DEBUG_LOG_LIMIT = 80;
const HOME_VIDEO_DEBUG_DECISION_MIN_INTERVAL_MS = 900;

function buildCheckinUiEditorElementOrder() {
    const ids = ['backButton', 'notebook', 'ribbon', 'ribbonTitle', 'mascot'];
    for (let day = 1; day <= 7; day += 1) {
        ids.push(`day${day}-card`);
        ids.push(`day${day}-title`);
        ids.push(`day${day}-icon`);
        ids.push(`day${day}-amount`);
        ids.push(`day${day}-badge`);
    }
    ids.push('rewardTooltip');
    ids.push('status');
    return ids;
}

const CHECKIN_UI_EDITOR_ELEMENT_ORDER = Object.freeze(buildCheckinUiEditorElementOrder());
const GAMEPLAY_UI_EDITOR_ELEMENT_ORDER = Object.freeze([
    'hudTop',
    'settingsButton',
    'settingsIcon',
    'coinChip',
    'coinIcon',
    'coinValue',
    'center',
    'lives',
    'level',
    'timer',
    'timerTrack',
    'timerLabel',
    'combo',
    'comboCount',
    'comboLabel',
    'scorePulse',
    'scoreValue',
    'scoreGain'
]);
const HOME_UI_EDITOR_ELEMENT_ORDER = Object.freeze([
    'homeBgPanelLarge',
    'homeBgSnakeUp',
    'homeBgSnakeDown',
    'homeBgCavePanel',
    'homeTitle',
    'playArea',
    'startButton',
    'startButtonText',
    'levelTag',
    'levelTagLabel',
    'levelTagValue',
    'featurePanel',
    'featureSettings',
    'featureSettingsText',
    'featureLeaderboard',
    'featureLeaderboardText',
    'featureSkins',
    'featureSkinsText',
    'featureCheckin',
    'featureCheckinText',
    'featureExit',
    'featureExitText',
    'featureSupportAuthor',
    'featureSupportAuthorText',
    'profileEntry',
    'loginEntry',
    'loginEntryText',
    'homeCoinChip',
    'versionTag',
    'homeMascot',
    'onlineRewardDock',
    'onlineRewardChest',
    'onlineRewardText'
]);
export class UI {
    constructor(game, options = {}) {
        this.game = game;
        this.options = options || {};
        this.locale = detectInitialLocale();
        this.menuState = MENU_PANEL.HOME;
        this.settingsEntry = SETTINGS_ENTRY.MENU;
        this.settingsConfirmMode = SETTINGS_CONFIRM_MODE.RESET_PROGRESS;
        this.leaderboardMode = LEADERBOARD_MODE.CLEAR;
        this.lastStartTriggerAt = Number.NEGATIVE_INFINITY;
        this.menuBadges = Object.fromEntries(
            FEATURE_CONFIG.map((feature) => [feature.id, feature.badge ?? null])
        );

        this.hud = document.getElementById('hud');
        this.hudTopEl = this.hud?.querySelector('.hud-top') || null;
        this.hudSettingsButtonEl = document.getElementById('btnHudSettings');
        this.hudSettingsIconEl = this.hudSettingsButtonEl?.querySelector('.hud-settings-icon') || null;
        this.hudCoinDisplayEl = document.getElementById('hudCoinDisplay');
        this.hudCoinIconEl = this.hudCoinDisplayEl?.querySelector('.coin-chip-icon') || null;
        this.hudCenterEl = this.hud?.querySelector('.hud-center') || null;
        this.livesEl = document.getElementById('lives');
        this.levelInfoEl = document.getElementById('levelInfo');
        this.timerEl = document.getElementById('timer');
        this.timerTrackEl = this.timerEl?.querySelector('.hud-timer-track') || null;
        this.timerFillEl = document.getElementById('timerFill');
        this.timerLabelEl = document.getElementById('timerLabel');
        this.lastCountdownTickSecond = null;
        this.comboDisplayEl = document.getElementById('comboDisplay');
        this.rewardUnlockToastEl = document.getElementById('rewardUnlockToast');
        this.rewardUnlockToastImageEl = document.getElementById('rewardUnlockToastImage');
        this.rewardUnlockToastTextEl = document.getElementById('rewardUnlockToastText');
        this.rewardUnlockToastTimer = 0;
        this.rewardUnlockToastPending = false;
        this.rewardStageGuideOverlayEl = document.getElementById('rewardStageGuideOverlay');
        this.rewardStageGuideTextEl = document.getElementById('rewardStageGuideText');
        this.rewardStageGuideVisible = false;
        this.hudScorePulseEl = document.getElementById('hudScorePulse');
        this.hudScoreValueEl = document.getElementById('hudScoreValue');
        this.hudScoreGainEl = document.getElementById('hudScoreGain');
        this.hudEnergyLayerEl = document.getElementById('hudEnergyLayer');
        this.energyOrbNodes = new Set();
        this.scorePulseAnimation = null;
        this.scoreGainAnimation = null;

        this.menuOverlay = document.getElementById('menuOverlay');
        this.homeBgPanelLargeEl = document.getElementById('homeBgPanelLarge');
        this.homeBgSnakeUpEl = document.getElementById('homeBgSnakeUp');
        this.homeBgSnakeDownEl = document.getElementById('homeBgSnakeDown');
        this.homeBgCavePanelEl = document.getElementById('homeBgCavePanel');
        this.menuHomeTitleEl = this.menuOverlay?.querySelector('.menu-home-title') || null;
        this.menuPlayAreaEl = this.menuOverlay?.querySelector('.play-area-v2') || null;
        this.menuBottomZoneEl = this.menuOverlay?.querySelector('.menu-bottom-zone-v2') || null;
        this.settingsOverlay = document.getElementById('settingsOverlay');
        this.leaderboardOverlay = document.getElementById('leaderboardOverlay');
        this.leaderboardListEl = this.leaderboardOverlay?.querySelector('.rank-list') || null;
        this.leaderboardScrollHostEl = this.leaderboardOverlay?.querySelector('.leaderboard-panel-body')
            || this.leaderboardOverlay?.querySelector('.panel-body')
            || null;
        this.leaderboardSelfSectionEl = document.getElementById('leaderboardSelfSection');
        this.leaderboardSelfLabelEl = document.getElementById('leaderboardSelfLabel');
        this.leaderboardSelfListEl = document.getElementById('leaderboardSelfList');
        this.leaderboardEmptyStateEl = this.leaderboardOverlay?.querySelector('.empty-state') || null;
        this.leaderboardModeClearButton = document.getElementById('btnLeaderboardModeClear');
        this.leaderboardModeBadgeButton = document.getElementById('btnLeaderboardModeBadge');
        this.skinsOverlay = document.getElementById('skinsOverlay');
        this.checkinOverlay = document.getElementById('checkinOverlay');
        this.supportAuthorOverlay = document.getElementById('supportAuthorOverlay');
        this.profileOverlay = document.getElementById('profileOverlay');
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
        this.levelCompleteDoubleCoinButton = document.getElementById('btnDoubleCoinAd');
        this.levelCompleteButtonsEl = document.querySelector('#levelCompleteOverlay .popup-buttons');
        this.levelCompletePopupBox = this.levelCompleteOverlay?.querySelector('.popup-box') || null;
        this.gameOverContinueByAdButton = document.getElementById('btnContinueByAd');

        this.levelScore = document.getElementById('levelScore');
        this.levelScoreLabel = document.getElementById('levelScoreLabel');
        this.levelScoreValue = document.getElementById('levelScoreValue');
        this.levelScoreMultiplier = document.getElementById('levelScoreMultiplier');
        this.levelBestCombo = document.getElementById('levelBestCombo');
        this.levelBestComboLabel = document.getElementById('levelBestComboLabel');
        this.levelBestComboValue = document.getElementById('levelBestComboValue');
        this.levelScoreBonus = document.getElementById('levelScoreBonus');
        this.levelPerfectStamp = document.getElementById('levelPerfectStamp');
        this.levelGrid = document.getElementById('levelGrid');
        this.gameOverReason = document.getElementById('gameOverReason');
        this.levelTag = document.getElementById('btnLevels');
        this.menuStartButtonEl = document.getElementById('btnPlay');
        this.menuStartButtonLabelEl = document.getElementById('btnPlayLabel');
        this.levelTagLabelEl = document.getElementById('menuLevelTagLabel');
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
        this.menuSettingsButton = document.getElementById('btnSettings');
        this.menuLeaderboardButton = document.getElementById('btnLeaderboard');
        this.menuSkinsButton = document.getElementById('btnSkins');
        this.menuCheckinButton = document.getElementById('btnCheckin');
        this.menuExitButton = document.getElementById('btnExit');
        this.menuSupportAuthorButton = document.getElementById('btnSupportAuthor');
        this.menuFeatureLabelEls = {
            featureSettingsText: this.menuSettingsButton?.querySelector('.feature-label') || null,
            featureLeaderboardText: this.menuLeaderboardButton?.querySelector('.feature-label') || null,
            featureSkinsText: this.menuSkinsButton?.querySelector('.feature-label') || null,
            featureCheckinText: this.menuCheckinButton?.querySelector('.feature-label') || null,
            featureExitText: this.menuExitButton?.querySelector('.feature-label') || null,
            featureSupportAuthorText: this.menuSupportAuthorButton?.querySelector('.feature-label') || null
        };
        this.menuProfileEntryButton = document.getElementById('btnProfileAvatar');
        this.menuProfileAvatarImage = document.getElementById('menuProfileAvatarImage');
        this.menuLoginEntryButton = document.getElementById('btnLoginEntry');
        this.menuLoginEntryTextEl = document.getElementById('menuLoginEntryText');
        this.supportAuthorCountEl = document.getElementById('supportAuthorCount');
        this.supportAuthorStatusEl = document.getElementById('supportAuthorStatus');
        this.supportAuthorThankYouEl = document.getElementById('supportAuthorThankYou');
        this.supportAuthorWatchButton = document.getElementById('btnSupportAuthorWatchAd');
        this.supportAuthorBadgeCountEl = document.getElementById('supportAuthorBadgeCount');
        this.profileUserMetaEl = document.getElementById('profileUserMeta');
        this.profileNicknameInput = document.getElementById('profileNicknameInput');
        this.profilePasswordInput = document.getElementById('profilePasswordInput');
        this.profilePasswordConfirmInput = document.getElementById('profilePasswordConfirmInput');
        this.profileStatusEl = document.getElementById('profileStatus');
        this.profileSaveButton = document.getElementById('btnProfileSave');
        this.menuCoinFlyRestore = null;
        this.skinList = document.getElementById('skinList');
        this.skinsCoinValue = document.getElementById('skinsCoinValue');
        this.levelCoinReward = document.getElementById('levelCoinReward');
        this.levelSettleAnimFrame = 0;
        this.levelSettleRunId = 0;
        this.isLevelSettleAnimating = false;
        this.checkinWeekGridEl = document.getElementById('checkinWeekGrid');
        this.checkinStatusEl = document.getElementById('checkinStatus');
        this.checkinRewardTooltipEl = document.getElementById('checkinRewardTooltip');
        this.checkinEntryRedDotEl = document.getElementById('checkinEntryRedDot');
        this.activeCheckinTooltipDay = 0;
        this.onlineRewardDockEl = document.getElementById('onlineRewardDock');
        this.btnOnlineRewardChest = document.getElementById('btnOnlineRewardChest');
        this.onlineRewardEntryRedDotEl = document.getElementById('onlineRewardEntryRedDot');
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
        this.buildVersionTagEl = document.getElementById('buildVersionTag');
        this.homeDanceMascotEl = document.getElementById('homeDanceMascot');
        this.homeDanceMascotCanvasEl = document.getElementById('homeDanceMascotCanvas');
        this.homeDanceMascotVideoEl = document.getElementById('homeDanceMascotVideo');
        this.homeDanceMascotCanvasCtx = null;
        this.homeDanceMascotRenderRaf = 0;
        this.homeDanceMascotVideoReady = false;
        this.homeDanceMascotUseVideo = false;
        this.homeDanceMascotCanvasWidth = 0;
        this.homeDanceMascotCanvasHeight = 0;
        this.perfDebugPanelEl = document.getElementById('perfDebugPanel');
        this.perfDebugTextEl = document.getElementById('perfDebugText');
        this.btnPerfDebugCopyEl = document.getElementById('btnPerfDebugCopy');
        this.btnPerfDebugCloseEl = document.getElementById('btnPerfDebugClose');
        this.coinDisplayOverride = null;
        this.checkinCoinCounterFrame = 0;
        this.pendingCheckinRewardPayload = null;
        this.pendingOnlineRewardPayload = null;
        this.onlineRewardSettleCoinIconEl = null;
        this.perfDebugUpdateTimer = 0;
        this.perfGestureTapCount = 0;
        this.perfGestureLastTapAt = 0;
        this.perfGestureArmed = false;
        this.perfGestureActivePointerId = null;
        this.perfGestureStartY = 0;
        this.perfGestureStartAt = 0;
        this.perfGestureSwipeTriggered = false;
        this.liveOpsRedDots = {
            checkin: false,
            online: false
        };
        this.homeVideoDebugEvents = [];
        this.homeVideoDebugListenersBound = false;
        this.homeVideoDebugStartAt = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        this.homeVideoLastDecisionTag = '';
        this.homeVideoLastDecisionAt = 0;
        this.homeVideoHttpProbeTarget = '';
        this.homeVideoHttpProbeBasic = 'pending';
        this.homeVideoHttpProbeRange = 'pending';
        this.homeVideoHttpProbeAt = 0;
        this.homeVideoHttpProbeInFlight = false;
        this.rewardedAdPending = false;
        this.profileSavePending = false;
        this.leaderboardOffset = 0;
        this.leaderboardHasMore = true;
        this.leaderboardLoading = false;
        this.leaderboardRequestSeq = 0;
        this.leaderboardSelfRow = null;
        this.leaderboardSelfUserId = '';
        this.leaderboardLoadedUserIdSet = new Set();
        this.uiEditorPreviewOptions = this.options.uiEditorPreview || { enabled: false };
        this.audioEnabled = this.uiEditorPreviewOptions.enabled !== true;
        this.homeDanceMascotAudioUnlocked = !this.audioEnabled;
        this.uiEditorPreviewOverride = null;
        this.uiEditorGameplayPreviewInitialized = false;
        this.uiEditorImageTrimCache = new Map();
        this.uiLayoutConfig = readUiLayoutConfig();
        this.releaseUiLayoutSubscription = subscribeUiLayoutConfig((nextConfig) => {
            this.uiLayoutConfig = nextConfig;
            this.applyHomeLayoutConfig();
            this.applyCheckinLayoutConfig();
            this.applyGameplayLayoutConfig();
            this.refreshCheckinPanel(false);
            this.updateCheckinSceneScale();
        });

        this.bindEvents();
        this.initHomeDanceMascot();
        this.initPerfDebugGesture();
        this.initAudioSettingsUi();
        if (this.audioEnabled) {
            this.setupAudioAutoUnlock();
        }
        this.bindGameCallbacks();
        this.applyThemeAssets();
        this.markUiEditorElements();
        this.applyHomeLayoutConfig();
        this.applyCheckinLayoutConfig();
        this.applyGameplayLayoutConfig();
        this.refreshProfileEntry();
        this.setMenuBadges(this.menuBadges);
        this.refreshLiveOpsRedDotsOnPageLoad();
        this.applyLocalizedText();
        this.refreshCheckinPanel();
        this.updateCheckinSceneScale();
        this.onlineDockTicker = setInterval(() => {
            this.refreshOnlineRewardDock();
        }, 1000);
        window.addEventListener('resize', () => this.updateCheckinSceneScale());
        if (this.audioEnabled) {
            stopBgm();
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
        let lastUnlockAt = 0;
        let unlocked = false;
        const cleanup = () => {
            const unlockEvents = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
            for (const type of unlockEvents) {
                document.removeEventListener(type, unlock, true);
                window.removeEventListener(type, unlock, true);
            }
        };
        const unlock = () => {
            if (unlocked) {
                return;
            }
            const now = Date.now();
            if (now - lastUnlockAt < 300) {
                return;
            }
            lastUnlockAt = now;
            try {
                resumeAudioV31();
            } catch (error) {
                console.warn('Audio resume failed during auto unlock:', error);
            }
            this.homeDanceMascotAudioUnlocked = true;
            this.appendHomeVideoDebugEvent('audio.unlock', 'user gesture captured');
            this.syncHomeDanceMascotMediaAudio();
            this.updateHomeDanceMascotPlayback();
            unlocked = true;
            cleanup();
        };

        const unlockEvents = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
        for (const type of unlockEvents) {
            document.addEventListener(type, unlock, true);
            window.addEventListener(type, unlock, true);
        }
    }

    initAudioSettingsUi() {
        this.syncAudioSettingsUi();
        this.bindAudioSlider(this.settingsMusicVolumeEl, (ratio) => {
            setMusicVolume(ratio);
            this.updateAudioSliderValueText(this.settingsMusicVolumeValueEl, ratio);
            this.syncHomeDanceMascotMediaAudio();
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
        this.syncHomeDanceMascotMediaAudio();
    }

    syncHomeDanceMascotMediaAudio() {
        if (!(this.homeDanceMascotVideoEl instanceof HTMLVideoElement)) {
            return;
        }
        const config = readAudioMixConfig();
        const musicVolume = Math.max(0, Math.min(1, Number(config.music) || 0));
        this.homeDanceMascotVideoEl.volume = musicVolume;
        this.homeDanceMascotVideoEl.muted = !this.audioEnabled
            || musicVolume <= 0.0001
            || this.rewardedAdPending
            || !this.homeDanceMascotAudioUnlocked;
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
        this.bindButton('btnBackFromSupportAuthor', () => this.closeMenuPanel());
        this.bindButton('btnBackFromProfile', () => this.closeMenuPanel());

        this.bindButton('btnSettings', () => this.openSettingsPanel(SETTINGS_ENTRY.MENU));
        this.bindButton('btnHudSettings', () => this.openSettingsFromGame());
        this.bindButton('btnLeaderboard', () => this.openMenuPanel(MENU_PANEL.LEADERBOARD));
        this.bindButton('btnSkins', () => this.openMenuPanel(MENU_PANEL.SKINS));
        this.bindButton('btnCheckin', () => this.openMenuPanel(MENU_PANEL.CHECKIN));
        this.bindButton('btnSupportAuthor', () => this.openMenuPanel(MENU_PANEL.SUPPORT_AUTHOR));
        this.bindButton('btnExit', () => this.openMenuPanel(MENU_PANEL.EXIT_CONFIRM));
        this.bindButton('btnSupportAuthorWatchAd', () => {
            void this.handleSupportAuthorWatchAd();
        });
        this.bindButton('btnLeaderboardModeClear', () => {
            this.setLeaderboardMode(LEADERBOARD_MODE.CLEAR);
        });
        this.bindButton('btnLeaderboardModeBadge', () => {
            this.setLeaderboardMode(LEADERBOARD_MODE.BADGE);
        });
        if (this.leaderboardScrollHostEl) {
            this.leaderboardScrollHostEl.addEventListener('scroll', () => {
                void this.handleLeaderboardScroll();
            }, { passive: true });
        }
        this.bindButton('btnProfileAvatar', () => this.openMenuPanel(MENU_PANEL.PROFILE));
        this.bindButton('btnProfileSave', () => {
            void this.handleProfileSave();
        });
        this.bindButton('btnLoginEntry', () => {
            void this.handleLoginEntry();
        });
        this.bindButton('btnOnlineRewardSettleCloseTop', () => this.closeOnlineRewardSettle(true));
        this.bindButton('btnOnlineRewardSettleClose', () => {
            void this.confirmOnlineRewardSettle();
        });
        this.bindButton('btnCheckinRewardConfirm', () => {
            void this.confirmCheckinRewardSettle();
        });

        if (this.btnOnlineRewardChest) {
            this.btnOnlineRewardChest.addEventListener('click', () => this.onClickOnlineChest());
            this.btnOnlineRewardChest.addEventListener('pointerup', (event) => {
                if (event.pointerType === 'touch') {
                    event.preventDefault();
                    this.onClickOnlineChest();
                }
            });
            this.btnOnlineRewardChest.addEventListener('touchend', (event) => {
                event.preventDefault();
                this.onClickOnlineChest();
            }, { passive: false });
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
        this.bindButton('btnContinueByAd', () => {
            void this.handleGameOverContinueByAd();
        });
        this.bindButton('btnDoubleCoinAd', () => {
            void this.handleDoubleCoinAd();
        });

        this.bindButton('btnLocaleZh', () => this.setLocale('zh-CN'));
        this.bindButton('btnLocaleEn', () => this.setLocale('en-US'));

        this.bindHomeStartVisualFallback();
        this.bindRewardStageGuideEvents();
    }

    initHomeDanceMascot() {
        this.initHomeDanceMascotVideo();
    }

    initHomeDanceMascotVideo() {
        if (!(this.homeDanceMascotCanvasEl instanceof HTMLCanvasElement)
            || !(this.homeDanceMascotVideoEl instanceof HTMLVideoElement)) {
            return;
        }

        const context = this.homeDanceMascotCanvasEl.getContext('2d', { willReadFrequently: true });
        if (!context) {
            this.appendHomeVideoDebugEvent('video.canvas.init.failed', '2d context unavailable');
            return;
        }
        this.homeDanceMascotCanvasCtx = context;

        const videoEl = this.homeDanceMascotVideoEl;
        this.bindHomeVideoDebugEvents(videoEl);
        videoEl.loop = true;
        videoEl.playsInline = true;
        videoEl.preload = 'auto';
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        this.syncHomeDanceMascotMediaAudio();
        if (`${videoEl.getAttribute('src') || ''}`.trim() !== HOME_MASCOT_VIDEO_SRC) {
            videoEl.src = HOME_MASCOT_VIDEO_SRC;
            this.appendHomeVideoDebugEvent('video.src.override', HOME_MASCOT_VIDEO_SRC);
        }

        videoEl.addEventListener('loadeddata', () => {
            this.homeDanceMascotVideoReady = true;
            this.homeDanceMascotUseVideo = true;
            this.homeDanceMascotCanvasEl?.classList.remove('hidden');
            this.syncHomeDanceMascotCanvasSize();
            this.appendHomeVideoDebugEvent('video.loadeddata.ready', `ready=${this.homeDanceMascotVideoReady} useVideo=${this.homeDanceMascotUseVideo}`);
            this.updateHomeDanceMascotPlayback();
        });
        videoEl.addEventListener('error', () => {
            this.homeDanceMascotVideoReady = false;
            this.homeDanceMascotUseVideo = false;
            this.stopHomeDanceMascotRenderLoop();
            this.homeDanceMascotCanvasEl?.classList.add('hidden');
            videoEl.pause();
            this.appendHomeVideoDebugEvent('video.error.fallback-disabled', `error=${this.describeVideoError(videoEl.error)}`);
        });
        this.appendHomeVideoDebugEvent('video.load.call', `src=${videoEl.getAttribute('src') || '-'}`);
        videoEl.load();
    }

    syncHomeDanceMascotCanvasSize() {
        if (!(this.homeDanceMascotCanvasEl instanceof HTMLCanvasElement) || !this.homeDanceMascotEl) {
            return;
        }
        const rect = this.homeDanceMascotEl.getBoundingClientRect();
        const dpr = Math.max(1, Math.min(2, Number(window.devicePixelRatio) || 1));
        const nextWidth = Math.max(2, Math.round(rect.width * dpr));
        const nextHeight = Math.max(2, Math.round(rect.height * dpr));
        if (nextWidth === this.homeDanceMascotCanvasWidth && nextHeight === this.homeDanceMascotCanvasHeight) {
            return;
        }
        this.homeDanceMascotCanvasWidth = nextWidth;
        this.homeDanceMascotCanvasHeight = nextHeight;
        this.homeDanceMascotCanvasEl.width = nextWidth;
        this.homeDanceMascotCanvasEl.height = nextHeight;
    }

    drawHomeDanceMascotVideoFrame() {
        this.homeDanceMascotRenderRaf = 0;
        if (!this.homeDanceMascotUseVideo
            || !(this.homeDanceMascotCanvasEl instanceof HTMLCanvasElement)
            || !(this.homeDanceMascotVideoEl instanceof HTMLVideoElement)
            || !this.homeDanceMascotCanvasCtx) {
            return;
        }
        const ctx = this.homeDanceMascotCanvasCtx;
        const videoEl = this.homeDanceMascotVideoEl;
        if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            this.homeDanceMascotRenderRaf = window.requestAnimationFrame(() => this.drawHomeDanceMascotVideoFrame());
            return;
        }

        this.syncHomeDanceMascotCanvasSize();
        const canvas = this.homeDanceMascotCanvasEl;
        const sourceWidth = Math.max(1, videoEl.videoWidth - HOME_MASCOT_VIDEO_CROP_RIGHT);
        const sourceHeight = Math.max(1, videoEl.videoHeight - HOME_MASCOT_VIDEO_CROP_BOTTOM);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(videoEl, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = frame.data;
        for (let index = 0; index < pixels.length; index += 4) {
            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];
            const alpha = pixels[index + 3];
            const level = Math.max(r, g, b);
            if (level <= HOME_MASCOT_BLACK_KEY_MIN) {
                pixels[index + 3] = 0;
                continue;
            }
            if (level >= HOME_MASCOT_BLACK_KEY_SOFT || alpha === 0) {
                continue;
            }
            const mix = (level - HOME_MASCOT_BLACK_KEY_MIN) / (HOME_MASCOT_BLACK_KEY_SOFT - HOME_MASCOT_BLACK_KEY_MIN);
            pixels[index + 3] = Math.max(0, Math.min(255, Math.round(alpha * mix)));
        }
        ctx.putImageData(frame, 0, 0);
        this.homeDanceMascotRenderRaf = window.requestAnimationFrame(() => this.drawHomeDanceMascotVideoFrame());
    }

    startHomeDanceMascotRenderLoop() {
        if (this.homeDanceMascotRenderRaf) {
            return;
        }
        this.homeDanceMascotRenderRaf = window.requestAnimationFrame(() => this.drawHomeDanceMascotVideoFrame());
    }

    stopHomeDanceMascotRenderLoop() {
        if (this.homeDanceMascotRenderRaf) {
            cancelAnimationFrame(this.homeDanceMascotRenderRaf);
            this.homeDanceMascotRenderRaf = 0;
        }
    }

    shouldPlayHomeDanceMascotVideo() {
        if (this.settingsEntry === SETTINGS_ENTRY.GAME) {
            return false;
        }
        const state = `${this.game?.state || ''}`.trim();
        return [
            'MENU',
            'LEVEL_SELECT',
            'SETTINGS',
            'LEADERBOARD',
            'SKINS',
            'CHECKIN',
            'SUPPORT_AUTHOR',
            'EXIT_CONFIRM',
            'RESET_PROGRESS_CONFIRM'
        ].includes(state);
    }

    shouldRestoreGameplayBgmAfterRewardedAd() {
        const state = `${this.game?.state || ''}`.trim();
        return state === 'PLAYING' || state === 'LEVEL_COMPLETE' || state === 'GAME_OVER';
    }

    restoreGameplayBgmAfterRewardedAd() {
        if (!this.audioEnabled || !this.game || !this.shouldRestoreGameplayBgmAfterRewardedAd()) {
            return;
        }
        const isRewardStage = this.game.isRewardStage === true;
        const options = {};
        if (!isRewardStage) {
            const startTrackIndex = this.resolveGameplayBgmStartTrackIndex();
            if (Number.isFinite(startTrackIndex)) {
                options.startTrackIndex = startTrackIndex;
            }
        }
        playBgmForScene(
            isRewardStage ? BGM_SCENE_KEYS.REWARD : BGM_SCENE_KEYS.NORMAL,
            options
        );
    }

    updateHomeDanceMascotPlayback() {
        if (!(this.homeDanceMascotVideoEl instanceof HTMLVideoElement)) {
            return;
        }
        this.syncHomeDanceMascotMediaAudio();
        if (!this.homeDanceMascotUseVideo || !this.homeDanceMascotVideoReady) {
            this.maybeLogHomeVideoDecision('hold-not-ready', this.homeDanceMascotVideoEl);
            this.stopHomeDanceMascotRenderLoop();
            return;
        }
        if (this.shouldPlayHomeDanceMascotVideo()) {
            this.maybeLogHomeVideoDecision('play-attempt', this.homeDanceMascotVideoEl, `audioUnlocked=${this.homeDanceMascotAudioUnlocked}`);
            const playPromise = this.homeDanceMascotVideoEl.play();
            if (playPromise && typeof playPromise.then === 'function') {
                void playPromise.then(() => {
                    this.appendHomeVideoDebugEvent('video.play.resolved');
                }).catch((error) => {
                    const name = `${error?.name || 'Error'}`.trim();
                    const message = `${error?.message || ''}`.trim();
                    this.appendHomeVideoDebugEvent('video.play.rejected', message ? `${name}: ${message}` : name);
                });
            }
            this.startHomeDanceMascotRenderLoop();
            return;
        }
        this.maybeLogHomeVideoDecision('pause', this.homeDanceMascotVideoEl);
        this.homeDanceMascotVideoEl.pause();
        this.stopHomeDanceMascotRenderLoop();
    }

    bindRewardStageGuideEvents() {
        if (!this.rewardStageGuideOverlayEl) {
            return;
        }
        const dismiss = () => this.hideRewardStageGuide();
        this.rewardStageGuideOverlayEl.addEventListener('click', dismiss);
        this.rewardStageGuideOverlayEl.addEventListener('pointerup', dismiss);
        this.rewardStageGuideOverlayEl.addEventListener('touchend', dismiss, { passive: true });
    }

    appendHomeVideoDebugEvent(eventName, details = '') {
        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        const elapsedMs = Math.max(0, Math.round(now - this.homeVideoDebugStartAt));
        const elapsed = `${(elapsedMs / 1000).toFixed(2)}s`;
        const line = details ? `[${elapsed}] ${eventName} | ${details}` : `[${elapsed}] ${eventName}`;
        this.homeVideoDebugEvents.push(line);
        if (this.homeVideoDebugEvents.length > HOME_VIDEO_DEBUG_LOG_LIMIT) {
            this.homeVideoDebugEvents.splice(0, this.homeVideoDebugEvents.length - HOME_VIDEO_DEBUG_LOG_LIMIT);
        }
    }

    getVideoReadyStateText(value) {
        switch (Number(value) || 0) {
        case 0: return 'HAVE_NOTHING';
        case 1: return 'HAVE_METADATA';
        case 2: return 'HAVE_CURRENT_DATA';
        case 3: return 'HAVE_FUTURE_DATA';
        case 4: return 'HAVE_ENOUGH_DATA';
        default: return 'UNKNOWN';
        }
    }

    getVideoNetworkStateText(value) {
        switch (Number(value) || 0) {
        case 0: return 'NETWORK_EMPTY';
        case 1: return 'NETWORK_IDLE';
        case 2: return 'NETWORK_LOADING';
        case 3: return 'NETWORK_NO_SOURCE';
        default: return 'UNKNOWN';
        }
    }

    describeVideoError(error) {
        if (!error) {
            return 'none';
        }
        const code = Number(error.code) || 0;
        const codeMap = {
            1: 'MEDIA_ERR_ABORTED',
            2: 'MEDIA_ERR_NETWORK',
            3: 'MEDIA_ERR_DECODE',
            4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
        };
        const text = codeMap[code] || 'MEDIA_ERR_UNKNOWN';
        const message = `${error.message || ''}`.trim();
        return message ? `${text}(${code}) ${message}` : `${text}(${code})`;
    }

    formatVideoRanges(ranges) {
        if (!ranges || typeof ranges.length !== 'number' || ranges.length <= 0) {
            return 'none';
        }
        const parts = [];
        for (let i = 0; i < ranges.length; i += 1) {
            try {
                parts.push(`${ranges.start(i).toFixed(2)}-${ranges.end(i).toFixed(2)}`);
            } catch {
                // ignore invalid range index
            }
        }
        return parts.length ? parts.join(', ') : 'none';
    }

    bindHomeVideoDebugEvents(videoEl) {
        if (!(videoEl instanceof HTMLVideoElement) || this.homeVideoDebugListenersBound) {
            return;
        }
        this.homeVideoDebugListenersBound = true;
        const trackedEvents = [
            'loadstart',
            'loadedmetadata',
            'loadeddata',
            'canplay',
            'canplaythrough',
            'play',
            'playing',
            'pause',
            'waiting',
            'stalled',
            'suspend',
            'seeking',
            'seeked',
            'abort',
            'emptied',
            'ended',
            'error'
        ];
        for (const eventName of trackedEvents) {
            videoEl.addEventListener(eventName, () => {
                const details = [
                    `rs=${videoEl.readyState}:${this.getVideoReadyStateText(videoEl.readyState)}`,
                    `ns=${videoEl.networkState}:${this.getVideoNetworkStateText(videoEl.networkState)}`,
                    `muted=${videoEl.muted}`,
                    `paused=${videoEl.paused}`,
                    `t=${Number(videoEl.currentTime || 0).toFixed(2)}/${Number(videoEl.duration || 0).toFixed(2)}`
                ];
                if (eventName === 'loadedmetadata' || eventName === 'loadeddata') {
                    details.push(`size=${videoEl.videoWidth || 0}x${videoEl.videoHeight || 0}`);
                }
                if (eventName === 'error') {
                    details.push(`error=${this.describeVideoError(videoEl.error)}`);
                    details.push(`currentSrc=${videoEl.currentSrc || '-'}`);
                }
                this.appendHomeVideoDebugEvent(`video.${eventName}`, details.join(' '));
            });
        }
        this.appendHomeVideoDebugEvent('video.debug.bound', `src=${videoEl.getAttribute('src') || '-'}`);
    }

    maybeLogHomeVideoDecision(tag, videoEl, detail = '') {
        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        const shouldLog = tag !== this.homeVideoLastDecisionTag
            || (now - this.homeVideoLastDecisionAt) >= HOME_VIDEO_DEBUG_DECISION_MIN_INTERVAL_MS;
        if (!shouldLog) {
            return;
        }
        this.homeVideoLastDecisionTag = tag;
        this.homeVideoLastDecisionAt = now;
        const base = [
            `muted=${videoEl?.muted ?? '-'}`,
            `paused=${videoEl?.paused ?? '-'}`,
            `ready=${videoEl?.readyState ?? '-'}:${this.getVideoReadyStateText(videoEl?.readyState)}`
        ].join(' ');
        this.appendHomeVideoDebugEvent(`video.decision.${tag}`, detail ? `${base} ${detail}` : base);
    }

    initPerfDebugGesture() {
        if (!this.buildVersionTagEl) {
            return;
        }

        let lastToggleAt = Number.NEGATIVE_INFINITY;
        const togglePanel = (event = null) => {
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault();
            }
            if (event && typeof event.stopPropagation === 'function') {
                event.stopPropagation();
            }
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if (now - lastToggleAt < 220) {
                return;
            }
            lastToggleAt = now;
            const isOpen = !!this.perfDebugPanelEl && !this.perfDebugPanelEl.classList.contains('hidden');
            if (isOpen) {
                this.closePerfDebugPanel();
                this.appendHomeVideoDebugEvent('panel.toggle', 'closed by version tap');
                return;
            }
            this.openPerfDebugPanel();
            this.appendHomeVideoDebugEvent('panel.toggle', 'opened by version tap');
        };
        this.buildVersionTagEl.addEventListener('click', togglePanel);
        this.buildVersionTagEl.addEventListener('pointerup', (event) => {
            if (event.pointerType === 'touch') {
                togglePanel(event);
            }
        });
        this.buildVersionTagEl.addEventListener('touchend', togglePanel, { passive: false });

        if (this.btnPerfDebugCopyEl) {
            this.btnPerfDebugCopyEl.addEventListener('click', () => {
                void this.copyPerfDebugText();
            });
        }
        if (this.btnPerfDebugCloseEl) {
            this.btnPerfDebugCloseEl.addEventListener('click', () => this.closePerfDebugPanel());
        }
    }

    resetPerfGestureState() {
        this.perfGestureTapCount = 0;
        this.perfGestureArmed = false;
        this.perfGestureActivePointerId = null;
        this.perfGestureSwipeTriggered = false;
        this.perfGestureStartY = 0;
        this.perfGestureStartAt = 0;
    }

    openPerfDebugPanel() {
        if (!this.perfDebugPanelEl) {
            return;
        }
        this.appendHomeVideoDebugEvent('panel.open', 'perf debug panel opened');
        this.perfDebugPanelEl.classList.remove('hidden');
        this.perfDebugPanelEl.setAttribute('aria-hidden', 'false');
        this.refreshPerfDebugPanel();
        if (this.perfDebugUpdateTimer) {
            clearInterval(this.perfDebugUpdateTimer);
        }
        this.perfDebugUpdateTimer = setInterval(() => {
            this.refreshPerfDebugPanel();
        }, 500);
    }

    closePerfDebugPanel() {
        if (!this.perfDebugPanelEl) {
            return;
        }
        this.perfDebugPanelEl.classList.add('hidden');
        this.perfDebugPanelEl.setAttribute('aria-hidden', 'true');
        if (this.perfDebugUpdateTimer) {
            clearInterval(this.perfDebugUpdateTimer);
            this.perfDebugUpdateTimer = 0;
        }
    }

    async copyPerfDebugText() {
        const content = `${this.perfDebugTextEl?.textContent || ''}`.trim();
        if (!content) {
            return;
        }
        let ok = false;
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(content);
                ok = true;
            } catch {
                ok = false;
            }
        }
        if (!ok && typeof document !== 'undefined') {
            const probe = document.createElement('textarea');
            probe.value = content;
            probe.setAttribute('readonly', 'true');
            probe.style.position = 'fixed';
            probe.style.left = '-9999px';
            probe.style.top = '0';
            document.body.appendChild(probe);
            probe.select();
            try {
                ok = document.execCommand('copy');
            } catch {
                ok = false;
            } finally {
                document.body.removeChild(probe);
            }
        }
        if (this.btnPerfDebugCopyEl) {
            const prev = this.btnPerfDebugCopyEl.textContent || '\u590D\u5236';
            this.btnPerfDebugCopyEl.textContent = ok ? '\u5DF2\u590D\u5236' : '\u590D\u5236\u5931\u8D25';
            window.setTimeout(() => {
                if (this.btnPerfDebugCopyEl) {
                    this.btnPerfDebugCopyEl.textContent = prev;
                }
            }, 1200);
        }
        this.appendHomeVideoDebugEvent('panel.copy', ok ? 'ok' : 'failed');
    }

    kickHomeVideoHttpProbe(videoEl) {
        if (!(videoEl instanceof HTMLVideoElement) || typeof fetch !== 'function' || this.homeVideoHttpProbeInFlight) {
            return;
        }
        const attrSrc = `${videoEl.getAttribute('src') || ''}`.trim();
        if (!attrSrc) {
            return;
        }
        let target = '';
        try {
            target = new URL(attrSrc, window.location.href).href;
        } catch {
            target = attrSrc;
        }
        const now = Date.now();
        const sameTarget = target === this.homeVideoHttpProbeTarget;
        if (sameTarget && now - this.homeVideoHttpProbeAt < 15000) {
            return;
        }
        this.homeVideoHttpProbeTarget = target;
        this.homeVideoHttpProbeAt = now;
        this.homeVideoHttpProbeInFlight = true;
        this.homeVideoHttpProbeBasic = 'probing...';
        this.homeVideoHttpProbeRange = 'probing...';

        const normalizeHeader = (headers, key, fallback = '-') => {
            if (!headers || typeof headers.get !== 'function') {
                return fallback;
            }
            const raw = `${headers.get(key) || ''}`.trim();
            return raw || fallback;
        };

        const readBasic = async () => {
            try {
                const response = await fetch(target, { method: 'HEAD', cache: 'no-store' });
                const contentType = normalizeHeader(response.headers, 'content-type');
                const contentLength = normalizeHeader(response.headers, 'content-length');
                const acceptRanges = normalizeHeader(response.headers, 'accept-ranges');
                return `HEAD ${response.status} type=${contentType} len=${contentLength} accept-ranges=${acceptRanges}`;
            } catch (error) {
                return `HEAD failed: ${error?.name || 'Error'} ${error?.message || ''}`.trim();
            }
        };

        const readRange = async () => {
            try {
                const response = await fetch(target, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { Range: 'bytes=0-1' }
                });
                const contentRange = normalizeHeader(response.headers, 'content-range');
                const acceptRanges = normalizeHeader(response.headers, 'accept-ranges');
                const contentType = normalizeHeader(response.headers, 'content-type');
                const body = await response.arrayBuffer().catch(() => new ArrayBuffer(0));
                const bodyLen = Number(body?.byteLength || 0);
                return `RANGE ${response.status} bytes=${bodyLen} type=${contentType} content-range=${contentRange} accept-ranges=${acceptRanges}`;
            } catch (error) {
                return `RANGE failed: ${error?.name || 'Error'} ${error?.message || ''}`.trim();
            }
        };

        void Promise.all([readBasic(), readRange()])
            .then(([basic, range]) => {
                this.homeVideoHttpProbeBasic = basic;
                this.homeVideoHttpProbeRange = range;
                this.appendHomeVideoDebugEvent('video.http.probe', `${basic} || ${range}`);
            })
            .finally(() => {
                this.homeVideoHttpProbeInFlight = false;
                if (this.perfDebugPanelEl && !this.perfDebugPanelEl.classList.contains('hidden')) {
                    this.refreshPerfDebugPanel();
                }
            });
    }

    refreshPerfDebugPanel() {
        if (!this.perfDebugTextEl) {
            return;
        }
        const lines = [];
        if (this.game && typeof this.game.getPerformanceSnapshot === 'function') {
            const snapshot = this.game.getPerformanceSnapshot();
            const mem = (typeof performance !== 'undefined' && performance && performance.memory)
                ? performance.memory
                : null;
            const memoryText = mem
                ? `${Math.round((Number(mem.usedJSHeapSize) || 0) / 1048576)} / ${Math.round((Number(mem.jsHeapSizeLimit) || 0) / 1048576)} MB`
                : 'n/a';
            const dpr = typeof window !== 'undefined' ? (Number(window.devicePixelRatio) || 1) : 1;
            lines.push(
                '[Perf]',
                `state: ${this.game.state || '-'}`,
                `level: ${this.game.getCurrentStageLabel?.() || this.game.currentLevel || '-'}`,
                `quality: ${snapshot.renderQuality || '-'}`,
                `fps(ema): ${Number(snapshot.fps || 0).toFixed(1)}  frame: ${Number(snapshot.frameMs || 0).toFixed(2)} ms`,
                `render(ema): ${Number(snapshot.renderCostMs || 0).toFixed(2)} ms`,
                `jank>=34ms: ${(Number(snapshot.jankRate || 0) * 100).toFixed(1)}% (${snapshot.sampleFrames || 0}f/${Number(snapshot.sampleSeconds || 0).toFixed(1)}s)`,
                `snakes: ${snapshot.activeLines || 0}/${snapshot.totalLines || 0}`,
                `particles: ${snapshot.particles || 0}  floatingText: ${snapshot.floatingTexts || 0}`,
                `grid: ${snapshot.gridCols || 0}x${snapshot.gridRows || 0}`,
                `canvas: ${snapshot.canvasWidth || 0}x${snapshot.canvasHeight || 0} @dpr ${dpr.toFixed(2)}`,
                `jsHeap: ${memoryText}`,
                ''
            );
        }

        const nav = typeof navigator !== 'undefined' ? navigator : null;
        const ua = `${nav?.userAgent || '-'}`;
        const platform = `${nav?.platform || '-'}`;
        const maxTouchPoints = Number(nav?.maxTouchPoints || 0);
        const activation = nav?.userActivation
            ? `active=${nav.userActivation.isActive} ever=${nav.userActivation.hasBeenActive}`
            : 'n/a';
        const canPlayProbe = typeof document !== 'undefined' ? document.createElement('video') : null;
        const canPlayAvc = canPlayProbe?.canPlayType?.('video/mp4; codecs="avc1.42E01E, mp4a.40.2"') || 'n/a';
        const canPlayHevc = canPlayProbe?.canPlayType?.('video/mp4; codecs="hvc1"') || 'n/a';
        const visibility = (typeof document !== 'undefined' && document.visibilityState) ? document.visibilityState : '-';
        const online = typeof navigator !== 'undefined' ? `${navigator.onLine}` : '-';
        const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
        const connText = conn
            ? `${conn.effectiveType || '-'} downlink=${Number(conn.downlink || 0).toFixed(2)} rtt=${Number(conn.rtt || 0)}`
            : 'n/a';

        lines.push('[Home MP4 Debug]');
        lines.push(`ua: ${ua}`);
        lines.push(`platform: ${platform}  touchPoints: ${maxTouchPoints}`);
        lines.push(`visibility: ${visibility}  online: ${online}  userActivation: ${activation}`);
        lines.push(`connection: ${connText}`);
        lines.push(`canPlay avc1+mp4a: ${canPlayAvc}  canPlay hvc1: ${canPlayHevc}`);

        const videoEl = this.homeDanceMascotVideoEl instanceof HTMLVideoElement ? this.homeDanceMascotVideoEl : null;
        if (!videoEl) {
            lines.push('video element: missing');
        } else {
            this.kickHomeVideoHttpProbe(videoEl);
            const duration = Number(videoEl.duration);
            const durationText = Number.isFinite(duration) && duration > 0 ? duration.toFixed(2) : '-';
            lines.push(`src(attr): ${videoEl.getAttribute('src') || '-'}`);
            lines.push(`src(current): ${videoEl.currentSrc || '-'}`);
            lines.push(`readyState: ${videoEl.readyState} (${this.getVideoReadyStateText(videoEl.readyState)})`);
            lines.push(`networkState: ${videoEl.networkState} (${this.getVideoNetworkStateText(videoEl.networkState)})`);
            lines.push(`time: ${Number(videoEl.currentTime || 0).toFixed(2)} / ${durationText}`);
            lines.push(`size: ${videoEl.videoWidth || 0}x${videoEl.videoHeight || 0}`);
            lines.push(`paused=${videoEl.paused} ended=${videoEl.ended} loop=${videoEl.loop}`);
            lines.push(`muted=${videoEl.muted} volume=${Number(videoEl.volume || 0).toFixed(2)} autoplay=${videoEl.autoplay}`);
            lines.push(`error: ${this.describeVideoError(videoEl.error)}`);
            lines.push(`buffered: ${this.formatVideoRanges(videoEl.buffered)}`);
            lines.push(`played: ${this.formatVideoRanges(videoEl.played)}`);
            lines.push(`seekable: ${this.formatVideoRanges(videoEl.seekable)}`);
            lines.push(`ui flags: ready=${this.homeDanceMascotVideoReady} useVideo=${this.homeDanceMascotUseVideo} audioEnabled=${this.audioEnabled} audioUnlocked=${this.homeDanceMascotAudioUnlocked}`);
            lines.push(`http probe basic: ${this.homeVideoHttpProbeBasic}`);
            lines.push(`http probe range: ${this.homeVideoHttpProbeRange}`);
            const code = Number(videoEl?.error?.code || 0);
            if (code === 4 && videoEl.readyState === 0 && videoEl.networkState === 3) {
                lines.push('hint: iPhone Safari often requires valid byte-range(206) support for MP4.');
            }
        }

        lines.push('', '[Home MP4 Events]');
        const recentEvents = this.homeVideoDebugEvents.slice(-16);
        if (!recentEvents.length) {
            lines.push('-');
        } else {
            lines.push(...recentEvents);
        }

        this.perfDebugTextEl.textContent = lines.join('\n');
    }

    bindButton(id, handler) {
        const element = document.getElementById(id);
        if (!element) return;

        this.bindPressAction(element, handler, { audioId: id });
    }

    bindPressAction(element, handler, options = {}) {
        if (!element || typeof handler !== 'function') {
            return;
        }

        const { audioId = 'dynamic-button' } = options;
        let lastTriggerAt = Number.NEGATIVE_INFINITY;
        const invoke = (event = null) => {
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault();
            }
            if (event && typeof event.stopPropagation === 'function') {
                event.stopPropagation();
            }
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
                console.warn(`Audio click failed for #${audioId}:`, error);
            }

            handler();
        };

        element.addEventListener('click', (event) => invoke(event));
        element.addEventListener('pointerup', (event) => {
            if (event.pointerType === 'touch') {
                invoke(event);
            }
        });
        element.addEventListener('touchend', (event) => invoke(event), { passive: false });
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
        const layout = this.getHomeLayoutConfig?.() || null;
        const playArea = layout?.playArea || null;
        const startButton = layout?.startButton || null;
        const hasCustomStartRect = playArea
            && startButton
            && Number.isFinite(Number(playArea.x))
            && Number.isFinite(Number(playArea.y))
            && Number.isFinite(Number(startButton.x))
            && Number.isFinite(Number(startButton.y))
            && Number.isFinite(Number(startButton.width))
            && Number.isFinite(Number(startButton.height));
        const hit = hasCustomStartRect
            ? {
                x: Number(playArea.x) + Number(startButton.x),
                y: Number(playArea.y) + Number(startButton.y),
                width: Number(startButton.width),
                height: Number(startButton.height)
            }
            : HOME_START_VISUAL_HITBOX;
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
        this.game.onRewardStageUnlocked = (payload) => {
            this.rewardUnlockToastPending = false;
            this.showRewardUnlockToast(payload);
        };
        this.game.onLevelComplete = () => this.showLevelCompletePopup();
        this.game.onGameOver = (reason) => this.showGameOverPopup(reason);
        this.game.onCollision = () => this.triggerErrorVignette();
        this.game.onLiveOpsUpdate = () => {
            if (this.menuState === MENU_PANEL.CHECKIN) {
                this.refreshCheckinPanel(false);
            }
            this.refreshOnlineRewardDock();
        };
    }

    syncGameplayBgm(restart = false) {
        if (!this.audioEnabled) {
            return;
        }
        if (!this.game || this.game.state !== 'PLAYING') {
            return;
        }
        const isRewardStage = this.game.isRewardStage === true;
        const options = { restart };
        if (!isRewardStage) {
            const startTrackIndex = this.resolveGameplayBgmStartTrackIndex();
            if (Number.isFinite(startTrackIndex)) {
                options.startTrackIndex = startTrackIndex;
            }
        }
        playBgmForScene(
            isRewardStage ? BGM_SCENE_KEYS.REWARD : BGM_SCENE_KEYS.NORMAL,
            options
        );
    }

    resolveGameplayBgmStartTrackIndex() {
        if (!this.game || this.game.isRewardStage === true) {
            return null;
        }
        const level = Math.max(1, Math.floor(Number(this.game.currentLevel) || 1));
        return Math.floor((level - 1) / BGM_LEVEL_GROUP_SIZE);
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
        this.updateHomeDanceMascotPlayback();
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
        this.updateHomeDanceMascotPlayback();
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
            if (typeof this.game.suppressInputFor === 'function') {
                this.game.suppressInputFor(420);
            }
            requestAnimationFrame(() => this.forceGameCanvasResize());
            this.updateHUD();
            this.syncGameplayBgm(true);
            this.updateHomeDanceMascotPlayback();
            this.maybeShowRewardStageGuide();
            this.rewardUnlockToastPending = false;
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
            this.updateHomeDanceMascotPlayback();
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
                stopBgm();
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
            this.refreshLeaderboardModeButtons();
            void this.renderLeaderboard();
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

        if (target === MENU_PANEL.SUPPORT_AUTHOR) {
            this.supportAuthorOverlay?.classList.remove('hidden');
            this.game.state = 'SUPPORT_AUTHOR';
            this.refreshSupportAuthorPanel();
        }

        if (target === MENU_PANEL.PROFILE) {
            this.profileOverlay?.classList.remove('hidden');
            this.game.state = 'PROFILE';
            this.refreshProfilePanel();
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
        this.refreshProfileEntry();
        this.refreshCheckinPanel();
        this.refreshOnlineRewardDock();
        this.updateHomeDanceMascotPlayback();
    }

    async renderLeaderboard() {
        if (!this.leaderboardListEl) {
            return;
        }
        this.leaderboardRequestSeq += 1;
        const requestSeq = this.leaderboardRequestSeq;
        const bootSession = bootstrapUserSessionFromStorage();
        this.leaderboardSelfUserId = `${getActiveUserId() || bootSession?.userId || ''}`.trim();
        this.leaderboardSelfRow = null;
        this.leaderboardLoadedUserIdSet.clear();
        this.leaderboardOffset = 0;
        this.leaderboardHasMore = true;
        this.leaderboardLoading = false;
        this.leaderboardListEl.innerHTML = '';
        this.renderLeaderboardSelfRow(null);
        if (this.leaderboardScrollHostEl) {
            this.leaderboardScrollHostEl.scrollTop = 0;
        }
        if (this.leaderboardEmptyStateEl) {
            this.leaderboardEmptyStateEl.textContent = this.getLocaleText('\u6392\u884c\u699c\u52a0\u8f7d\u4e2d...', 'Loading leaderboard...');
        }
        await this.loadLeaderboardPage(requestSeq);
    }

    async handleLeaderboardScroll() {
        if (!this.leaderboardScrollHostEl || this.menuState !== MENU_PANEL.LEADERBOARD) {
            return;
        }
        if (!this.leaderboardHasMore || this.leaderboardLoading) {
            return;
        }
        const remain = this.leaderboardScrollHostEl.scrollHeight
            - (this.leaderboardScrollHostEl.scrollTop + this.leaderboardScrollHostEl.clientHeight);
        if (remain > LEADERBOARD_SCROLL_LOAD_THRESHOLD) {
            return;
        }
        await this.loadLeaderboardPage(this.leaderboardRequestSeq);
    }

    async loadLeaderboardPage(requestSeq) {
        if (!this.leaderboardListEl) {
            return;
        }
        if (requestSeq !== this.leaderboardRequestSeq || this.leaderboardLoading || !this.leaderboardHasMore) {
            return;
        }
        this.leaderboardLoading = true;
        const isInitialPage = this.leaderboardOffset === 0;
        const isBadgeMode = this.leaderboardMode === LEADERBOARD_MODE.BADGE;
        if (!isInitialPage && this.leaderboardEmptyStateEl) {
            this.leaderboardEmptyStateEl.textContent = this.getLocaleText('\u52a0\u8f7d\u66f4\u591a\u4e2d...', 'Loading more...');
        }
        try {
            const leaderboardUrl = new URL('/api/leaderboard', window.location.href);
            leaderboardUrl.searchParams.set('limit', `${LEADERBOARD_PAGE_SIZE}`);
            leaderboardUrl.searchParams.set('offset', `${this.leaderboardOffset}`);
            leaderboardUrl.searchParams.set('mode', this.leaderboardMode);
            if (this.leaderboardSelfUserId) {
                leaderboardUrl.searchParams.set('userId', this.leaderboardSelfUserId);
            }
            const response = await fetch(leaderboardUrl.toString(), {
                method: 'GET',
                cache: 'no-store'
            });
            const payload = await response.json().catch(() => ({}));
            if (requestSeq !== this.leaderboardRequestSeq) {
                return;
            }
            if (!response.ok || payload?.ok !== true) {
                throw new Error(payload?.error || `HTTP ${response.status}`);
            }

            const rows = Array.isArray(payload?.rows) ? payload.rows : [];
            const meRow = payload?.me && typeof payload.me === 'object' ? payload.me : null;
            if (meRow) {
                this.leaderboardSelfRow = meRow;
                const meUserId = `${meRow?.userId || ''}`.trim();
                if (meUserId) {
                    this.leaderboardSelfUserId = meUserId;
                }
            }

            if (isInitialPage && rows.length === 0) {
                this.renderLeaderboardFallbackRows();
                if (this.leaderboardEmptyStateEl) {
                    this.leaderboardEmptyStateEl.textContent = isBadgeMode
                        ? this.getLocaleText('\u6682\u65e0\u5956\u7ae0\u699c\u6570\u636e\u3002', 'No badge leaderboard data yet.')
                        : this.getLocaleText('\u6682\u65e0\u901a\u5173\u699c\u6570\u636e\u3002', 'No leaderboard data yet.');
                }
                this.leaderboardHasMore = false;
                this.refreshLeaderboardSelfRowFromState();
                return;
            }

            for (const row of rows) {
                const rowUserId = `${row?.userId || ''}`.trim();
                if (rowUserId) {
                    this.leaderboardLoadedUserIdSet.add(rowUserId);
                }
                const li = this.buildLeaderboardRow(row, this.leaderboardSelfUserId);
                this.leaderboardListEl.appendChild(li);
            }

            const hasMoreFromPayload = typeof payload?.hasMore === 'boolean'
                ? payload.hasMore
                : rows.length >= LEADERBOARD_PAGE_SIZE;
            this.leaderboardHasMore = hasMoreFromPayload;
            this.leaderboardOffset += rows.length;
            this.refreshLeaderboardSelfRowFromState();
            if (this.leaderboardEmptyStateEl) {
                if (this.leaderboardHasMore) {
                    this.leaderboardEmptyStateEl.textContent = this.getLocaleText(
                        '\u4e0a\u6ed1\u7ee7\u7eed\u52a0\u8f7d 20 \u540d...',
                        'Swipe up to load 20 more...'
                    );
                } else {
                    this.leaderboardEmptyStateEl.textContent = isBadgeMode
                        ? this.getLocaleText(
                            '\u6309\u5956\u7ae0\u6570\u91cf\u6392\u5e8f\uff0c\u5df2\u52a0\u8f7d\u5168\u90e8\u6392\u540d\u3002',
                            'Sorted by support badges. All loaded.'
                        )
                        : this.getLocaleText(
                            '\u6309\u6700\u9ad8\u901a\u5173\u5173\u5361\u6392\u5e8f\uff0c\u5df2\u52a0\u8f7d\u5168\u90e8\u6392\u540d\u3002',
                            'Sorted by highest cleared level. All loaded.'
                        );
                }
            }
        } catch {
            if (isInitialPage) {
                this.renderLeaderboardFallbackRows();
                if (this.leaderboardEmptyStateEl) {
                    this.leaderboardEmptyStateEl.textContent = this.getLocaleText('\u6392\u884c\u699c\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002', 'Failed to load leaderboard.');
                }
            } else if (this.leaderboardEmptyStateEl) {
                this.leaderboardEmptyStateEl.textContent = this.getLocaleText('\u52a0\u8f7d\u66f4\u591a\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002', 'Failed to load more.');
            }
            this.leaderboardHasMore = false;
        } finally {
            this.leaderboardLoading = false;
        }
    }

    renderLeaderboardFallbackRows() {
        if (!this.leaderboardListEl) {
            return;
        }
        this.leaderboardListEl.innerHTML = '';
        for (let i = 1; i <= 5; i += 1) {
            const li = document.createElement('li');
            li.innerHTML = `<span>#${i}</span><span class="rank-player">---</span><span class="rank-level">---</span>`;
            this.leaderboardListEl.appendChild(li);
        }
    }

    refreshLeaderboardSelfRowFromState() {
        const selfUserId = `${this.leaderboardSelfUserId || ''}`.trim();
        const selfRenderedInTop = !!selfUserId && this.leaderboardLoadedUserIdSet.has(selfUserId);
        this.renderLeaderboardSelfRow(selfRenderedInTop ? null : this.leaderboardSelfRow, selfUserId);
    }

    buildLeaderboardRow(row, selfUserId = '') {
        const rank = Math.max(1, Math.floor(Number(row?.rank) || 0));
        const userId = `${row?.userId || ''}`.trim();
        const username = `${row?.username || 'Unknown'}`.trim() || 'Unknown';
        const avatarUrl = `${row?.avatarUrl || 'assets/ui/shared/icons/icon_theme.png'}`.trim();
        const level = Math.max(0, Math.floor(Number(row?.maxClearedLevel) || 0));
        const supportAuthorBadgeCount = Math.max(0, Math.floor(Number(row?.supportAuthorBadgeCount) || 0));
        const isSelf = !!selfUserId && userId === selfUserId;
        const isBadgeMode = this.leaderboardMode === LEADERBOARD_MODE.BADGE;

        const li = document.createElement('li');
        if (isSelf) {
            li.classList.add('is-self');
        }

        const rankEl = document.createElement('span');
        rankEl.textContent = `#${rank}`;

        const playerEl = document.createElement('span');
        playerEl.className = 'rank-player';
        const avatarEl = document.createElement('img');
        avatarEl.className = 'rank-avatar';
        avatarEl.alt = username;
        avatarEl.src = avatarUrl;
        avatarEl.referrerPolicy = 'no-referrer';
        avatarEl.addEventListener('error', () => {
            avatarEl.src = 'assets/ui/shared/icons/icon_theme.png';
        });

        const nameWrapEl = document.createElement('span');
        nameWrapEl.className = 'rank-player-name';
        const nameEl = document.createElement('span');
        nameEl.textContent = username;
        nameWrapEl.appendChild(nameEl);
        if (isSelf) {
            const selfTagEl = document.createElement('span');
            selfTagEl.className = 'rank-self-tag';
            selfTagEl.textContent = this.getLocaleText('(\u6211)', '(Me)');
            nameWrapEl.appendChild(selfTagEl);
        }

        playerEl.appendChild(avatarEl);
        playerEl.appendChild(nameWrapEl);

        const levelEl = document.createElement('span');
        levelEl.className = 'rank-level';
        levelEl.textContent = isBadgeMode
            ? this.getLocaleText(`\u5956\u7ae0 ${supportAuthorBadgeCount}`, `Badges ${supportAuthorBadgeCount}`)
            : (
                level > 0
                    ? this.getLocaleText('\u901a\u5173 ' + level, 'Clear ' + level)
                    : this.getLocaleText('\u672a\u901a\u5173', 'Not Cleared')
            );

        li.appendChild(rankEl);
        li.appendChild(playerEl);
        li.appendChild(levelEl);
        return li;
    }

    renderLeaderboardSelfRow(row, selfUserId = '') {
        if (!this.leaderboardSelfSectionEl || !this.leaderboardSelfListEl) {
            return;
        }
        this.leaderboardSelfListEl.innerHTML = '';
        if (!row) {
            this.leaderboardSelfSectionEl.classList.add('hidden');
            return;
        }
        if (this.leaderboardSelfLabelEl) {
            this.leaderboardSelfLabelEl.textContent = this.leaderboardMode === LEADERBOARD_MODE.BADGE
                ? this.getLocaleText('\u6211\u7684\u5956\u7ae0\u6392\u540d', 'My Badge Rank')
                : this.getLocaleText('\u6211\u7684\u6392\u540d', 'My Rank');
        }
        this.leaderboardSelfListEl.appendChild(this.buildLeaderboardRow(row, selfUserId));
        this.leaderboardSelfSectionEl.classList.remove('hidden');
    }

    setLeaderboardMode(mode) {
        const nextMode = mode === LEADERBOARD_MODE.BADGE
            ? LEADERBOARD_MODE.BADGE
            : LEADERBOARD_MODE.CLEAR;
        if (this.leaderboardMode === nextMode) {
            return;
        }
        this.leaderboardMode = nextMode;
        this.refreshLeaderboardModeButtons();
        if (this.menuState === MENU_PANEL.LEADERBOARD) {
            void this.renderLeaderboard();
        }
    }

    refreshLeaderboardModeButtons() {
        if (this.leaderboardModeClearButton) {
            this.leaderboardModeClearButton.classList.toggle('active', this.leaderboardMode === LEADERBOARD_MODE.CLEAR);
        }
        if (this.leaderboardModeBadgeButton) {
            this.leaderboardModeBadgeButton.classList.toggle('active', this.leaderboardMode === LEADERBOARD_MODE.BADGE);
        }
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

    getCurrentUserSession() {
        return getActiveUserSession() || bootstrapUserSessionFromStorage() || null;
    }

    resolveAvatarUrl(rawUrl) {
        const text = `${rawUrl || ''}`.trim();
        return text || 'assets/ui/shared/icons/icon_theme.png';
    }

    refreshProfileEntry() {
        const session = this.getCurrentUserSession();
        if (this.menuProfileAvatarImage) {
            this.menuProfileAvatarImage.src = this.resolveAvatarUrl(session?.avatarUrl);
            this.menuProfileAvatarImage.alt = `${session?.username || 'player'}`;
            this.menuProfileAvatarImage.onerror = () => {
                this.menuProfileAvatarImage.src = 'assets/ui/shared/icons/icon_theme.png';
            };
        }
        if (this.menuLoginEntryButton) {
            const showLoginLink = !isOfflineAuthMode() && session?.isTempUser !== false;
            this.menuLoginEntryButton.classList.toggle('hidden', !showLoginLink);
        }
    }

    refreshProfilePanel() {
        const session = this.getCurrentUserSession();
        if (this.profileUserMetaEl) {
            const idText = `${session?.userId || '-'}`;
            const roleText = session?.isTempUser === true
                ? this.getLocaleText('\u8bbf\u5ba2', 'Guest')
                : this.getLocaleText('\u8d26\u53f7', 'Account');
            this.profileUserMetaEl.textContent = `${roleText} · ID: ${idText}`;
        }
        if (this.profileNicknameInput) {
            this.profileNicknameInput.value = `${session?.username || ''}`.trim();
            this.profileNicknameInput.disabled = isOfflineAuthMode();
            this.profileNicknameInput.closest('label')?.classList.toggle('hidden', isOfflineAuthMode());
        }
        if (this.profilePasswordInput) {
            this.profilePasswordInput.value = '';
            this.profilePasswordInput.disabled = isOfflineAuthMode();
            this.profilePasswordInput.closest('label')?.classList.toggle('hidden', isOfflineAuthMode());
        }
        if (this.profilePasswordConfirmInput) {
            this.profilePasswordConfirmInput.value = '';
            this.profilePasswordConfirmInput.disabled = isOfflineAuthMode();
            this.profilePasswordConfirmInput.closest('label')?.classList.toggle('hidden', isOfflineAuthMode());
        }
        if (this.profileSaveButton) {
            this.profileSaveButton.classList.toggle('hidden', isOfflineAuthMode());
        }
        this.setProfileStatus('');
    }

    setProfileStatus(text, isError = false) {
        if (!this.profileStatusEl) {
            return;
        }
        this.profileStatusEl.textContent = text || '';
        this.profileStatusEl.style.color = isError ? '#9d2b22' : '#456d26';
    }

    async handleLoginEntry() {
        if (isOfflineAuthMode()) {
            return;
        }
        const prevUserId = `${getActiveUserId() || ''}`.trim();
        const session = await openUserLoginDialog({
            allowTemp: false,
            allowClose: true,
            title: this.getLocaleText('\u8d26\u53f7\u767b\u5f55', 'Login')
        });
        if (!session?.userId) {
            return;
        }
        if (`${session.userId}`.trim() !== prevUserId) {
            window.location.reload();
            return;
        }
        this.refreshProfileEntry();
        this.refreshProfilePanel();
    }

    async handleProfileSave() {
        if (isOfflineAuthMode()) {
            this.setProfileStatus(this.getLocaleText('\u5e73\u53f0\u6a21\u5f0f\u4e0b\u4f7f\u7528\u672c\u5730\u8bbf\u5ba2\u8eab\u4efd\u3002', 'Platform mode uses a local guest profile.'));
            return;
        }
        if (this.profileSavePending) {
            return;
        }
        const session = this.getCurrentUserSession();
        const userId = `${session?.userId || ''}`.trim();
        if (!userId) {
            this.setProfileStatus(this.getLocaleText('\u5f53\u524d\u65e0\u53ef\u7528\u767b\u5f55\u6001\u3002', 'No active user session.'), true);
            return;
        }
        const nickname = `${this.profileNicknameInput?.value || ''}`.trim();
        const password = `${this.profilePasswordInput?.value || ''}`;
        const passwordConfirm = `${this.profilePasswordConfirmInput?.value || ''}`;
        if (!nickname || nickname.length < 2) {
            this.setProfileStatus(this.getLocaleText('\u6635\u79f0\u957f\u5ea6\u81f3\u5c11 2 \u4e2a\u5b57\u7b26\u3002', 'Nickname must be at least 2 characters.'), true);
            return;
        }
        if (password && password.length < 4) {
            this.setProfileStatus(this.getLocaleText('\u5bc6\u7801\u957f\u5ea6\u81f3\u5c11 4 \u4f4d\u3002', 'Password must be at least 4 characters.'), true);
            return;
        }
        if (password && password !== passwordConfirm) {
            this.setProfileStatus(this.getLocaleText('\u4e24\u6b21\u8f93\u5165\u7684\u5bc6\u7801\u4e0d\u4e00\u81f4\u3002', 'Password confirmation does not match.'), true);
            return;
        }

        const payload = {
            userId,
            username: nickname
        };
        if (password) {
            payload.password = password;
        }
        this.profileSavePending = true;
        if (this.profileSaveButton) {
            this.profileSaveButton.disabled = true;
        }
        this.setProfileStatus(this.getLocaleText('\u4fdd\u5b58\u4e2d...', 'Saving...'));
        try {
            const response = await fetch('/api/users/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result?.ok !== true || !result?.user) {
                throw new Error(result?.error || `HTTP ${response.status}`);
            }
            applySessionFromUser(result.user);
            this.refreshProfileEntry();
            this.refreshProfilePanel();
            this.setProfileStatus(this.getLocaleText('\u4e2a\u4eba\u8d44\u6599\u5df2\u66f4\u65b0\u3002', 'Profile updated.'));
        } catch (error) {
            this.setProfileStatus(
                this.getLocaleText('\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002', 'Save failed, please try again.')
                + ` ${error?.message || ''}`,
                true
            );
        } finally {
            this.profileSavePending = false;
            if (this.profileSaveButton) {
                this.profileSaveButton.disabled = false;
            }
        }
    }

    setSupportAuthorStatus(text, isError = false) {
        if (!this.supportAuthorStatusEl) {
            return;
        }
        this.supportAuthorStatusEl.textContent = text || '';
        this.supportAuthorStatusEl.style.color = isError ? '#9d2b22' : '#456d26';
    }

    refreshSupportAuthorPanel() {
        if (!this.game || typeof this.game.getRewardedAdSnapshot !== 'function') {
            return;
        }
        const snapshot = this.game.getRewardedAdSnapshot();
        const watchedToday = Math.max(0, Math.floor(Number(snapshot?.watchedToday) || 0));
        const dailyLimit = Math.max(0, Math.floor(Number(snapshot?.dailyLimit) || 0));
        if (this.supportAuthorCountEl) {
            this.supportAuthorCountEl.textContent = `${watchedToday}/${dailyLimit}`;
        }
        if (this.supportAuthorBadgeCountEl) {
            const badgeCount = Math.max(0, Math.floor(Number(this.game?.getSupportAuthorBadgeCount?.() || 0)));
            this.supportAuthorBadgeCountEl.textContent = `${badgeCount}`;
        }
        if (this.supportAuthorThankYouEl) {
            const localizedFallback = this.getLocaleText(
                '\u611f\u8c22\u4f60\u7684\u652f\u6301\uff0c\u8fd9\u4f1a\u5e2e\u52a9\u6211\u4eec\u6301\u7eed\u66f4\u65b0\u6e38\u620f\u5185\u5bb9\u3002',
                'Thanks for your support. It helps us keep shipping updates.'
            );
            const configuredText = `${snapshot?.thankYouMessage || ''}`.trim();
            this.supportAuthorThankYouEl.textContent = this.locale === 'zh-CN'
                ? (configuredText || localizedFallback)
                : localizedFallback;
        }
        const supportGate = this.game.canWatchRewardedAd(REWARDED_AD_PLACEMENTS.SUPPORT_AUTHOR);
        if (this.supportAuthorWatchButton) {
            this.supportAuthorWatchButton.disabled = !supportGate?.ok || this.rewardedAdPending;
        }
        this.refreshGameOverContinueByAdButton();
        this.refreshDoubleCoinAdButton();
    }

    refreshGameOverContinueByAdButton() {
        if (!this.gameOverContinueByAdButton || !this.game || typeof this.game.canWatchRewardedAd !== 'function') {
            return;
        }
        const canContinue = typeof this.game.canContinueCurrentStageByAd === 'function'
            ? this.game.canContinueCurrentStageByAd()
            : false;
        const gate = this.game.canWatchRewardedAd(REWARDED_AD_PLACEMENTS.FAIL_CONTINUE);
        this.gameOverContinueByAdButton.disabled = !canContinue || !gate?.ok || this.rewardedAdPending;
    }

    refreshDoubleCoinAdButton() {
        if (!this.levelCompleteDoubleCoinButton || !this.game || typeof this.game.canWatchRewardedAd !== 'function') {
            return;
        }
        const canClaim = typeof this.game.canClaimDoubleCoinReward === 'function'
            ? this.game.canClaimDoubleCoinReward()
            : false;
        const gate = this.game.canWatchRewardedAd(REWARDED_AD_PLACEMENTS.DOUBLE_COIN);
        const canWatch = gate?.ok;
        this.levelCompleteDoubleCoinButton.disabled = !(canClaim && canWatch) || this.rewardedAdPending;
        this.levelCompleteDoubleCoinButton.classList.toggle('hidden', !canClaim);
    }

    async runRewardedAdFlow(placement) {
        if (!this.game || this.rewardedAdPending || typeof this.game.canWatchRewardedAd !== 'function') {
            return { ok: false, reason: 'busy' };
        }
        const gate = this.game.canWatchRewardedAd(placement);
        if (!gate?.ok) {
            this.refreshSupportAuthorPanel();
            return {
                ok: false,
                reason: gate?.reason || 'not-available',
                gate
            };
        }

        const shouldRestoreGameplayBgm = this.shouldRestoreGameplayBgmAfterRewardedAd();
        this.rewardedAdPending = true;
        this.syncHomeDanceMascotMediaAudio();
        if (this.audioEnabled) {
            stopBgm();
        }
        this.refreshSupportAuthorPanel();
        try {
            const result = await playRewardedAd(placement);
            if (!result?.rewarded) {
                return { ok: false, reason: result?.error || 'ad-interrupted' };
            }
            const snapshot = this.game.recordRewardedAdWatch(placement);
            this.refreshSupportAuthorPanel();
            return { ok: true, snapshot };
        } finally {
            this.rewardedAdPending = false;
            this.syncHomeDanceMascotMediaAudio();
            if (shouldRestoreGameplayBgm) {
                this.restoreGameplayBgmAfterRewardedAd();
            }
            this.updateHomeDanceMascotPlayback();
            this.refreshSupportAuthorPanel();
        }
    }

    async handleSupportAuthorWatchAd() {
        this.setSupportAuthorStatus('');
        const result = await this.runRewardedAdFlow(REWARDED_AD_PLACEMENTS.SUPPORT_AUTHOR);
        if (!result?.ok) {
            if (result?.reason === 'daily-limit-reached') {
                this.setSupportAuthorStatus(this.getLocaleText('\u4eca\u65e5\u652f\u6301\u6b21\u6570\u5df2\u8fbe\u4e0a\u9650\u3002', 'Daily ad limit reached.'), true);
                return;
            }
            this.setSupportAuthorStatus(this.getLocaleText('\u5e7f\u544a\u672a\u5b8c\u6210\uff0c\u672c\u6b21\u672a\u8ba1\u5165\u652f\u6301\u6b21\u6570\u3002', 'Ad not completed. Support count unchanged.'), true);
            return;
        }
        const badgeCount = Math.max(0, Math.floor(Number(this.game?.getSupportAuthorBadgeCount?.() || 0)));
        this.setSupportAuthorStatus(
            this.getLocaleText(
                '\u611f\u8c22\u4f60\u7684\u652f\u6301\uff01\u5df2\u83b7\u5f97\u5956\u7ae0\uff0c\u5f53\u524d ' + badgeCount + ' \u679a\u3002',
                'Thanks for your support! Badge awarded. Total ' + badgeCount + '.'
            )
        );
    }

    async handleGameOverContinueByAd() {
        const result = await this.runRewardedAdFlow(REWARDED_AD_PLACEMENTS.FAIL_CONTINUE);
        if (!result?.ok) {
            if (this.gameOverReason && result?.reason === 'daily-limit-reached') {
                this.gameOverReason.textContent = this.getLocaleText(
                    '\u4eca\u65e5\u5e7f\u544a\u89c2\u770b\u6b21\u6570\u5df2\u8fbe\u4e0a\u9650\uff0c\u8bf7\u76f4\u63a5\u91cd\u8bd5\u3002',
                    'Daily ad limit reached. Please retry directly.'
                );
            } else if (this.gameOverReason && result?.reason) {
                this.gameOverReason.textContent = this.getLocaleText(
                    '\u5e7f\u544a\u672a\u5b8c\u6210\uff0c\u672a\u80fd\u7ee7\u7eed\u3002',
                    'Ad not completed, unable to continue.'
                );
            }
            return;
        }
        const resumed = typeof this.game?.resumeFromGameOverByAd === 'function'
            ? this.game.resumeFromGameOverByAd()
            : false;
        if (!resumed) {
            this.retryLevel();
            return;
        }
        this.gameOverOverlay?.classList.add('hidden');
        this.hud?.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.forceGameCanvasResize();
        this.updateHUD();
        this.syncGameplayBgm(true);
        this.updateHomeDanceMascotPlayback();
    }

    async handleDoubleCoinAd() {
        if (this.levelScoreBonus) {
            this.levelScoreBonus.classList.add('hidden');
            this.levelScoreBonus.textContent = '';
        }
        const result = await this.runRewardedAdFlow(REWARDED_AD_PLACEMENTS.DOUBLE_COIN);
        if (!result?.ok) {
            if (this.levelScoreBonus && result?.reason === 'daily-limit-reached') {
                this.levelScoreBonus.classList.remove('hidden');
                this.levelScoreBonus.textContent = this.getLocaleText('\u4eca\u65e5\u5e7f\u544a\u6b21\u6570\u5df2\u8fbe\u4e0a\u9650', 'Daily ad limit reached');
            } else if (this.levelScoreBonus && result?.reason === 'placement-disabled') {
                this.levelScoreBonus.classList.remove('hidden');
                this.levelScoreBonus.textContent = this.getLocaleText('\u53ef\u7528\u5e7f\u544a\u4f4d\u672a\u5f00\u542f\uff0c\u8bf7\u5728\u53c2\u6570\u7ba1\u7406\u5f00\u542f\u3002', 'Ad placement is disabled in config.');
            } else if (this.levelScoreBonus && result?.reason) {
                this.levelScoreBonus.classList.remove('hidden');
                this.levelScoreBonus.textContent = this.getLocaleText('\u5e7f\u544a\u672a\u5b8c\u6210\uff0c\u672a\u83b7\u5f97\u53cc\u500d\u5956\u52b1\u3002', 'Ad not completed. Double reward not granted.');
            }
            return;
        }
        const beforeCoins = typeof this.game?.getCoins === 'function'
            ? Math.max(0, Math.floor(Number(this.game.getCoins()) || 0))
            : 0;
        const bonus = typeof this.game?.claimDoubleCoinReward === 'function'
            ? this.game.claimDoubleCoinReward()
            : 0;
        if (bonus > 0) {
            const earned = Math.max(0, this.game.getLastCoinReward() + bonus);
            const totalCoins = Math.max(0, this.game.getCoins());
            this.setLevelSettleCoinText(earned, totalCoins);
            this.updateCoinDisplays();
            this.nextLevel();
            if (totalCoins > beforeCoins) {
                this.stopCheckinCoinCounter();
                this.setCoinDisplayOverride(beforeCoins);
                await this.animateCoinDisplayValue(beforeCoins, totalCoins, 980);
                this.clearCoinDisplayOverride();
            }
        }
        this.refreshDoubleCoinAdButton();
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

    readLiveOpsRedDotsFromGame() {
        const checkin = (this.game && typeof this.game.getCheckinSnapshot === 'function')
            ? this.game.getCheckinSnapshot()
            : null;
        const online = (this.game && typeof this.game.getOnlineRewardSnapshot === 'function')
            ? this.game.getOnlineRewardSnapshot()
            : null;
        return {
            checkin: !!checkin?.canClaimToday,
            online: !!online?.canClaim
        };
    }

    applyLiveOpsRedDots() {
        this.checkinEntryRedDotEl?.classList.toggle('hidden', !this.liveOpsRedDots.checkin);
        this.onlineRewardEntryRedDotEl?.classList.toggle('hidden', !this.liveOpsRedDots.online);
    }

    refreshLiveOpsRedDotsOnPageLoad() {
        this.liveOpsRedDots = this.readLiveOpsRedDotsFromGame();
        this.applyLiveOpsRedDots();
        this.setMenuBadges({
            checkin: ''
        });
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
        this.levelSettleRunId += 1;
        this.isLevelSettleAnimating = false;
        this.levelBestComboValue?.classList.remove('is-emphasis');
        this.levelScoreMultiplier?.classList.add('hidden');
        this.levelScoreMultiplier?.classList.remove('is-visible');
    }

    hideAll() {
        this.hideRewardStageGuide();
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
        this.supportAuthorOverlay?.classList.add('hidden');
        this.profileOverlay?.classList.add('hidden');
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
        this.setSupportAuthorStatus('');
        this.setProfileStatus('');
        this.updateHomeDanceMascotPlayback();
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

    maybeShowRewardStageGuide() {
        if (!this.rewardStageGuideOverlayEl || !this.game) {
            return;
        }
        if (typeof this.game.shouldShowRewardStageGuide === 'function') {
            if (!this.game.shouldShowRewardStageGuide()) {
                return;
            }
        } else if (typeof this.game.hasSeenRewardStageGuide === 'function' && this.game.hasSeenRewardStageGuide()) {
            return;
        }
        this.showRewardStageGuide();
    }

    showRewardStageGuide() {
        if (!this.rewardStageGuideOverlayEl || !this.game || this.rewardStageGuideVisible) {
            return;
        }
        this.rewardStageGuideVisible = true;
        if (this.rewardStageGuideTextEl) {
            this.rewardStageGuideTextEl.textContent = REWARD_GUIDE_TEXT;
        }
        if (typeof this.game.setExternalPaused === 'function') {
            this.game.setExternalPaused(true);
        }
        this.rewardStageGuideOverlayEl.classList.remove('hidden');
        this.rewardStageGuideOverlayEl.setAttribute('aria-hidden', 'false');
    }

    hideRewardStageGuide() {
        if (!this.rewardStageGuideOverlayEl || !this.rewardStageGuideVisible) {
            return;
        }
        this.rewardStageGuideVisible = false;
        this.rewardStageGuideOverlayEl.classList.add('hidden');
        this.rewardStageGuideOverlayEl.setAttribute('aria-hidden', 'true');
        if (typeof this.game?.setExternalPaused === 'function') {
            this.game.setExternalPaused(false);
        }
        if (typeof this.game?.markRewardStageGuideShown === 'function') {
            this.game.markRewardStageGuideShown();
        }
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
        this.homeBgPanelLargeEl?.setAttribute('data-ui-editor-id', 'homeBgPanelLarge');
        this.homeBgSnakeUpEl?.setAttribute('data-ui-editor-id', 'homeBgSnakeUp');
        this.homeBgSnakeDownEl?.setAttribute('data-ui-editor-id', 'homeBgSnakeDown');
        this.homeBgCavePanelEl?.setAttribute('data-ui-editor-id', 'homeBgCavePanel');
        this.menuHomeTitleEl?.setAttribute('data-ui-editor-id', 'homeTitle');
        this.menuPlayAreaEl?.setAttribute('data-ui-editor-id', 'playArea');
        this.menuStartButtonEl?.setAttribute('data-ui-editor-id', 'startButton');
        this.menuStartButtonLabelEl?.setAttribute('data-ui-editor-id', 'startButtonText');
        this.levelTag?.setAttribute('data-ui-editor-id', 'levelTag');
        this.levelTagLabelEl?.setAttribute('data-ui-editor-id', 'levelTagLabel');
        this.levelTagValue?.setAttribute('data-ui-editor-id', 'levelTagValue');
        this.menuBottomZoneEl?.setAttribute('data-ui-editor-id', 'featurePanel');
        this.menuSettingsButton?.setAttribute('data-ui-editor-id', 'featureSettings');
        this.menuFeatureLabelEls?.featureSettingsText?.setAttribute('data-ui-editor-id', 'featureSettingsText');
        this.menuLeaderboardButton?.setAttribute('data-ui-editor-id', 'featureLeaderboard');
        this.menuFeatureLabelEls?.featureLeaderboardText?.setAttribute('data-ui-editor-id', 'featureLeaderboardText');
        this.menuSkinsButton?.setAttribute('data-ui-editor-id', 'featureSkins');
        this.menuFeatureLabelEls?.featureSkinsText?.setAttribute('data-ui-editor-id', 'featureSkinsText');
        this.menuCheckinButton?.setAttribute('data-ui-editor-id', 'featureCheckin');
        this.menuFeatureLabelEls?.featureCheckinText?.setAttribute('data-ui-editor-id', 'featureCheckinText');
        this.menuExitButton?.setAttribute('data-ui-editor-id', 'featureExit');
        this.menuFeatureLabelEls?.featureExitText?.setAttribute('data-ui-editor-id', 'featureExitText');
        this.menuSupportAuthorButton?.setAttribute('data-ui-editor-id', 'featureSupportAuthor');
        this.menuFeatureLabelEls?.featureSupportAuthorText?.setAttribute('data-ui-editor-id', 'featureSupportAuthorText');
        this.menuProfileEntryButton?.setAttribute('data-ui-editor-id', 'profileEntry');
        this.menuLoginEntryButton?.setAttribute('data-ui-editor-id', 'loginEntry');
        this.menuLoginEntryTextEl?.setAttribute('data-ui-editor-id', 'loginEntryText');
        this.menuCoinDisplay?.setAttribute('data-ui-editor-id', 'homeCoinChip');
        this.buildVersionTagEl?.setAttribute('data-ui-editor-id', 'versionTag');
        this.homeDanceMascotEl?.setAttribute('data-ui-editor-id', 'homeMascot');
        this.onlineRewardDockEl?.setAttribute('data-ui-editor-id', 'onlineRewardDock');
        this.btnOnlineRewardChest?.setAttribute('data-ui-editor-id', 'onlineRewardChest');
        this.onlineDockTextEl?.setAttribute('data-ui-editor-id', 'onlineRewardText');
        this.checkinBackButtonEl?.setAttribute('data-ui-editor-id', 'backButton');
        this.checkinCardEl?.setAttribute('data-ui-editor-id', 'notebook');
        this.checkinRibbonEl?.setAttribute('data-ui-editor-id', 'ribbon');
        this.checkinRibbonTitleEl?.setAttribute('data-ui-editor-id', 'ribbonTitle');
        this.checkinMascotEl?.setAttribute('data-ui-editor-id', 'mascot');
        this.checkinRewardTooltipEl?.setAttribute('data-ui-editor-id', 'rewardTooltip');
        this.checkinStatusEl?.setAttribute('data-ui-editor-id', 'status');
        this.markGameplayUiEditorElements();
    }

    markGameplayUiEditorElements() {
        this.hudTopEl?.setAttribute('data-ui-editor-id', 'hudTop');
        this.hudSettingsButtonEl?.setAttribute('data-ui-editor-id', 'settingsButton');
        this.hudSettingsIconEl?.setAttribute('data-ui-editor-id', 'settingsIcon');
        this.hudCoinDisplayEl?.setAttribute('data-ui-editor-id', 'coinChip');
        this.hudCoinIconEl?.setAttribute('data-ui-editor-id', 'coinIcon');
        this.hudCoinValue?.setAttribute('data-ui-editor-id', 'coinValue');
        this.hudCenterEl?.setAttribute('data-ui-editor-id', 'center');
        this.livesEl?.setAttribute('data-ui-editor-id', 'lives');
        this.levelInfoEl?.setAttribute('data-ui-editor-id', 'level');
        this.timerEl?.setAttribute('data-ui-editor-id', 'timer');
        this.timerTrackEl?.setAttribute('data-ui-editor-id', 'timerTrack');
        this.timerLabelEl?.setAttribute('data-ui-editor-id', 'timerLabel');
        this.comboDisplayEl?.setAttribute('data-ui-editor-id', 'combo');
        this.comboDisplayEl?.querySelector('.hud-combo-count')?.setAttribute('data-ui-editor-id', 'comboCount');
        this.comboDisplayEl?.querySelector('.hud-combo-label')?.setAttribute('data-ui-editor-id', 'comboLabel');
        this.hudScorePulseEl?.setAttribute('data-ui-editor-id', 'scorePulse');
        this.hudScoreValueEl?.setAttribute('data-ui-editor-id', 'scoreValue');
        this.hudScoreGainEl?.setAttribute('data-ui-editor-id', 'scoreGain');
    }

    getSceneLayerOrder(sceneId, fallbackIds = []) {
        const sceneLayout = this.uiLayoutConfig?.[sceneId];
        const configured = Array.isArray(sceneLayout?.layerOrder) ? sceneLayout.layerOrder : [];
        const deletedRaw = Array.isArray(sceneLayout?.deletedElements) ? sceneLayout.deletedElements : [];
        const allowed = new Set(fallbackIds);
        const deleted = new Set();
        for (const rawId of deletedRaw) {
            const id = `${rawId || ''}`.trim();
            if (!id || !allowed.has(id)) {
                continue;
            }
            deleted.add(id);
        }
        const seen = new Set();
        const order = [];

        for (const rawId of configured) {
            const id = `${rawId || ''}`.trim();
            if (!id || !allowed.has(id) || deleted.has(id) || seen.has(id)) {
                continue;
            }
            seen.add(id);
            order.push(id);
        }
        for (const id of fallbackIds) {
            if (seen.has(id) || deleted.has(id)) {
                continue;
            }
            seen.add(id);
            order.push(id);
        }
        return order;
    }

    resolveSceneRoot(sceneId) {
        if (sceneId === 'home') {
            return this.menuOverlay;
        }
        if (sceneId === 'checkin') {
            return this.checkinOverlay;
        }
        if (sceneId === 'gameplay') {
            return this.hud;
        }
        return document;
    }

    querySceneEditorNode(sceneId, elementId) {
        const selector = `[data-ui-editor-id="${elementId}"]`;
        const root = this.resolveSceneRoot(sceneId);
        if (root instanceof HTMLElement || root instanceof Document) {
            const scopedNode = root.querySelector(selector);
            if (scopedNode instanceof HTMLElement) {
                return scopedNode;
            }
        }
        const fallbackNode = document.querySelector(selector);
        return fallbackNode instanceof HTMLElement ? fallbackNode : null;
    }

    applySceneLayerOrder(sceneId, fallbackIds = []) {
        if (!Array.isArray(fallbackIds) || fallbackIds.length === 0) {
            return;
        }
        const order = this.getSceneLayerOrder(sceneId, fallbackIds);
        const baseZ = 20;
        const sceneIdSet = new Set(fallbackIds);
        const nodeById = new Map();
        const desiredZById = new Map();
        const inheritedZById = new Map();
        const deletedSet = new Set(
            Array.isArray(this.uiLayoutConfig?.[sceneId]?.deletedElements)
                ? this.uiLayoutConfig[sceneId].deletedElements
                    .map((rawId) => `${rawId || ''}`.trim())
                    .filter((id) => id && sceneIdSet.has(id))
                : []
        );

        order.forEach((elementId, index) => {
            const desiredZ = baseZ + index;
            desiredZById.set(elementId, desiredZ);
        });

        for (const elementId of fallbackIds) {
            const node = this.querySceneEditorNode(sceneId, elementId);
            if (node) {
                nodeById.set(elementId, node);
            }
        }

        for (const elementId of fallbackIds) {
            const node = nodeById.get(elementId);
            if (node) {
                node.style.zIndex = '';
                if (deletedSet.has(elementId)) {
                    node.style.display = 'none';
                }
            }
        }

        for (const [elementId, node] of nodeById.entries()) {
            const z = desiredZById.get(elementId);
            if (!Number.isFinite(z)) {
                continue;
            }
            let parent = node.parentElement;
            while (parent) {
                const parentId = `${parent.dataset?.uiEditorId || ''}`.trim();
                if (parentId && sceneIdSet.has(parentId)) {
                    const prev = inheritedZById.get(parentId);
                    if (!Number.isFinite(prev) || z > prev) {
                        inheritedZById.set(parentId, z);
                    }
                    break;
                }
                parent = parent.parentElement;
            }
        }

        for (const elementId of fallbackIds) {
            const node = nodeById.get(elementId);
            if (!node || deletedSet.has(elementId)) {
                continue;
            }
            const ownZ = desiredZById.get(elementId);
            const inheritedZ = inheritedZById.get(elementId);
            const finalZ = Math.max(
                Number.isFinite(ownZ) ? ownZ : Number.NEGATIVE_INFINITY,
                Number.isFinite(inheritedZ) ? inheritedZ : Number.NEGATIVE_INFINITY
            );
            if (Number.isFinite(finalZ)) {
                node.style.zIndex = `${Math.round(finalZ)}`;
            }
        }
    }

    applyGameplayChildLayout(layout) {
        if (!layout) {
            return;
        }

        if (this.hudSettingsIconEl) {
            this.hudSettingsIconEl.style.position = 'relative';
            this.hudSettingsIconEl.style.left = `${layout.settingsIcon.x}px`;
            this.hudSettingsIconEl.style.top = `${layout.settingsIcon.y}px`;
            this.hudSettingsIconEl.style.width = `${layout.settingsIcon.width}px`;
            this.hudSettingsIconEl.style.height = `${layout.settingsIcon.height}px`;
            this.hudSettingsIconEl.style.display = layout.settingsIcon.visible === false ? 'none' : 'block';
        }
        if (this.hudCoinIconEl) {
            this.hudCoinIconEl.style.position = 'relative';
            this.hudCoinIconEl.style.left = `${layout.coinIcon.x}px`;
            this.hudCoinIconEl.style.top = `${layout.coinIcon.y}px`;
            this.hudCoinIconEl.style.width = `${layout.coinIcon.width}px`;
            this.hudCoinIconEl.style.height = `${layout.coinIcon.height}px`;
            this.hudCoinIconEl.style.display = layout.coinIcon.visible === false ? 'none' : 'block';
        }
        if (this.hudCoinValue) {
            this.hudCoinValue.style.position = 'relative';
            this.hudCoinValue.style.left = `${layout.coinValue.x}px`;
            this.hudCoinValue.style.top = `${layout.coinValue.y}px`;
            this.hudCoinValue.style.width = `${layout.coinValue.width}px`;
            this.hudCoinValue.style.display = layout.coinValue.visible === false ? 'none' : 'inline-block';
            this.hudCoinValue.style.fontSize = `${layout.coinValue.fontSize}px`;
        }
        if (this.livesEl) {
            this.livesEl.style.position = 'relative';
            this.livesEl.style.left = `${layout.lives.x}px`;
            this.livesEl.style.top = `${layout.lives.y}px`;
            this.livesEl.style.width = `${layout.lives.width}px`;
            this.livesEl.style.height = `${layout.lives.height}px`;
            if (layout.lives.visible === false) {
                this.livesEl.style.display = 'none';
            } else {
                this.livesEl.style.display = '';
            }
        }
        if (this.timerTrackEl) {
            this.timerTrackEl.style.position = 'relative';
            this.timerTrackEl.style.left = `${layout.timerTrack.x}px`;
            this.timerTrackEl.style.top = `${layout.timerTrack.y}px`;
            this.timerTrackEl.style.width = `${layout.timerTrack.width}px`;
            this.timerTrackEl.style.height = `${layout.timerTrack.height}px`;
            this.timerTrackEl.style.display = layout.timerTrack.visible === false ? 'none' : 'block';
        }
        if (this.timerLabelEl) {
            this.timerLabelEl.style.position = 'relative';
            this.timerLabelEl.style.left = `${layout.timerLabel.x}px`;
            this.timerLabelEl.style.top = `${layout.timerLabel.y}px`;
            this.timerLabelEl.style.width = `${layout.timerLabel.width}px`;
            this.timerLabelEl.style.fontSize = `${layout.timerLabel.fontSize}px`;
            this.timerLabelEl.style.display = layout.timerLabel.visible === false ? 'none' : 'block';
            this.timerLabelEl.style.textAlign = 'center';
        }
        const comboCountEl = this.comboDisplayEl?.querySelector('.hud-combo-count');
        if (comboCountEl) {
            comboCountEl.style.position = 'relative';
            comboCountEl.style.left = `${layout.comboCount.x}px`;
            comboCountEl.style.top = `${layout.comboCount.y}px`;
            comboCountEl.style.width = `${layout.comboCount.width}px`;
            comboCountEl.style.fontSize = `${layout.comboCount.fontSize}px`;
            comboCountEl.style.display = layout.comboCount.visible === false ? 'none' : 'inline-block';
            comboCountEl.style.textAlign = 'right';
        }
        const comboLabelEl = this.comboDisplayEl?.querySelector('.hud-combo-label');
        if (comboLabelEl) {
            comboLabelEl.style.position = 'relative';
            comboLabelEl.style.left = `${layout.comboLabel.x}px`;
            comboLabelEl.style.top = `${layout.comboLabel.y}px`;
            comboLabelEl.style.width = `${layout.comboLabel.width}px`;
            comboLabelEl.style.fontSize = `${layout.comboLabel.fontSize}px`;
            comboLabelEl.style.display = layout.comboLabel.visible === false ? 'none' : 'inline-block';
        }
        if (this.hudScoreValueEl) {
            this.hudScoreValueEl.style.position = 'relative';
            this.hudScoreValueEl.style.left = `${layout.scoreValue.x}px`;
            this.hudScoreValueEl.style.top = `${layout.scoreValue.y}px`;
            this.hudScoreValueEl.style.width = `${layout.scoreValue.width}px`;
            this.hudScoreValueEl.style.display = layout.scoreValue.visible === false ? 'none' : 'block';
            this.hudScoreValueEl.style.fontSize = `${layout.scoreValue.fontSize}px`;
        }
        if (this.hudScoreGainEl) {
            this.hudScoreGainEl.style.position = 'absolute';
            this.hudScoreGainEl.style.left = `${layout.scoreGain.x}px`;
            this.hudScoreGainEl.style.top = `${layout.scoreGain.y}px`;
            this.hudScoreGainEl.style.width = `${layout.scoreGain.width}px`;
            if (layout.scoreGain.visible === false) {
                this.hudScoreGainEl.style.display = 'none';
            } else if (!this.hudScoreGainEl.classList.contains('hidden')) {
                this.hudScoreGainEl.style.display = 'block';
            } else {
                this.hudScoreGainEl.style.display = '';
            }
            this.hudScoreGainEl.style.fontSize = `${layout.scoreGain.fontSize}px`;
        }
    }

    getCheckinLayoutConfig() {
        return this.uiLayoutConfig?.checkin || readUiLayoutConfig().checkin;
    }

    getGameplayLayoutConfig() {
        return this.uiLayoutConfig?.gameplay || readUiLayoutConfig().gameplay;
    }

    getHomeLayoutConfig() {
        return this.uiLayoutConfig?.home || readUiLayoutConfig().home;
    }

    applyHomeLayoutConfig() {
        const layout = this.getHomeLayoutConfig();
        if (!layout) {
            return;
        }

        const applyRect = (node, rect, visibleDisplay = 'block') => {
            if (!(node instanceof HTMLElement) || !rect) {
                return;
            }
            node.style.position = 'absolute';
            node.style.left = `${rect.x}px`;
            node.style.top = `${rect.y}px`;
            node.style.right = 'auto';
            node.style.bottom = 'auto';
            node.style.width = `${rect.width}px`;
            node.style.height = `${rect.height}px`;
            node.style.display = rect.visible === false ? 'none' : visibleDisplay;
        };
        const resolveEditableText = (textConfig, fallback = '', params = {}) => {
            const raw = this.locale === 'zh-CN' ? textConfig?.textZh : textConfig?.textEn;
            let text = typeof raw === 'string' && raw.length > 0 ? raw : fallback;
            for (const [key, value] of Object.entries(params || {})) {
                text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), `${value}`);
            }
            return text;
        };
        const applyText = (node, textConfig, fallback = '', params = {}) => {
            if (!(node instanceof HTMLElement) || !textConfig) {
                return;
            }
            node.style.position = 'absolute';
            node.style.left = `${textConfig.x}px`;
            node.style.top = `${textConfig.y}px`;
            node.style.right = 'auto';
            node.style.bottom = 'auto';
            node.style.width = `${textConfig.width}px`;
            node.style.height = `${textConfig.height}px`;
            node.style.display = textConfig.visible === false ? 'none' : 'flex';
            node.style.alignItems = 'center';
            node.style.justifyContent = textConfig.align === 'left' ? 'flex-start' : 'center';
            node.style.textAlign = textConfig.align === 'left' ? 'left' : 'center';
            node.style.fontSize = `${textConfig.fontSize}px`;
            node.textContent = resolveEditableText(textConfig, fallback, params);
        };

        applyRect(this.homeBgPanelLargeEl, layout.homeBgPanelLarge, 'block');
        applyRect(this.homeBgSnakeUpEl, layout.homeBgSnakeUp, 'block');
        applyRect(this.homeBgSnakeDownEl, layout.homeBgSnakeDown, 'block');
        applyRect(this.homeBgCavePanelEl, layout.homeBgCavePanel, 'block');

        applyRect(this.menuHomeTitleEl, layout.homeTitle, 'block');
        if (this.menuHomeTitleEl instanceof HTMLElement) {
            this.menuHomeTitleEl.style.transform = 'none';
            this.menuHomeTitleEl.style.margin = '0';
        }

        applyRect(this.menuPlayAreaEl, layout.playArea, 'flex');
        if (this.menuPlayAreaEl instanceof HTMLElement) {
            this.menuPlayAreaEl.style.alignItems = 'flex-end';
            this.menuPlayAreaEl.style.justifyContent = 'flex-start';
            this.menuPlayAreaEl.style.gap = '0';
        }
        applyRect(this.menuStartButtonEl, layout.startButton, 'block');
        applyText(this.menuStartButtonLabelEl, layout.startButtonText, t(this.locale, 'home.start'));
        applyRect(this.levelTag, layout.levelTag, 'inline-flex');
        applyText(this.levelTagLabelEl, layout.levelTagLabel, t(this.locale, 'home.burrowEntry'));
        applyText(this.levelTagValue, layout.levelTagValue, t(this.locale, 'common.levelChip', { level: this.getDefaultStartLevel() }), { level: this.getDefaultStartLevel() });

        applyRect(this.menuBottomZoneEl, layout.featurePanel, 'block');
        applyRect(this.menuSettingsButton, layout.featureSettings, 'block');
        applyText(this.menuFeatureLabelEls?.featureSettingsText, layout.featureSettingsText, t(this.locale, 'feature.settings'));
        applyRect(this.menuLeaderboardButton, layout.featureLeaderboard, 'block');
        applyText(this.menuFeatureLabelEls?.featureLeaderboardText, layout.featureLeaderboardText, t(this.locale, 'feature.leaderboard'));
        applyRect(this.menuSkinsButton, layout.featureSkins, 'block');
        applyText(this.menuFeatureLabelEls?.featureSkinsText, layout.featureSkinsText, t(this.locale, 'feature.skins'));
        applyRect(this.menuCheckinButton, layout.featureCheckin, 'block');
        applyText(this.menuFeatureLabelEls?.featureCheckinText, layout.featureCheckinText, t(this.locale, 'feature.checkin'));
        applyRect(this.menuExitButton, layout.featureExit, 'block');
        applyText(this.menuFeatureLabelEls?.featureExitText, layout.featureExitText, t(this.locale, 'feature.exit'));
        applyRect(this.menuSupportAuthorButton, layout.featureSupportAuthor, 'block');
        applyText(this.menuFeatureLabelEls?.featureSupportAuthorText, layout.featureSupportAuthorText, t(this.locale, 'feature.supportAuthor'));

        applyRect(this.menuProfileEntryButton, layout.profileEntry, 'block');
        applyRect(this.menuLoginEntryButton, layout.loginEntry, 'block');
        applyText(this.menuLoginEntryTextEl, layout.loginEntryText, t(this.locale, 'home.loginLink'));
        applyRect(this.menuCoinDisplay, layout.coinChip, 'inline-flex');
        applyRect(this.buildVersionTagEl, layout.versionTag, 'block');

        applyRect(this.homeDanceMascotEl, layout.mascot, 'block');
        this.syncHomeDanceMascotCanvasSize();

        applyRect(this.onlineRewardDockEl, layout.onlineRewardDock, 'block');
        if (this.onlineRewardDockEl instanceof HTMLElement) {
            this.onlineRewardDockEl.style.transform = 'none';
            this.onlineRewardDockEl.style.flexDirection = 'column';
            this.onlineRewardDockEl.style.alignItems = 'center';
            this.onlineRewardDockEl.style.justifyContent = 'flex-start';
            this.onlineRewardDockEl.style.gap = '0';
        }
        applyRect(this.btnOnlineRewardChest, layout.onlineRewardChest, 'block');
        applyText(this.onlineDockTextEl, layout.onlineRewardText, this.locale === 'zh-CN' ? '可领取' : 'Claim');
        if (this.onlineDockTextEl instanceof HTMLElement) {
            this.onlineDockTextEl.style.marginTop = '0';
            this.onlineDockTextEl.style.marginRight = '0';
            this.onlineDockTextEl.style.minWidth = '0';
            this.onlineDockTextEl.style.padding = '2px 6px';
            this.onlineDockTextEl.style.lineHeight = '1.2';
        }
        this.applySceneLayerOrder('home', HOME_UI_EDITOR_ELEMENT_ORDER);
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
        this.applySceneLayerOrder('checkin', CHECKIN_UI_EDITOR_ELEMENT_ORDER);
    }

    applyGameplayLayoutConfig() {
        const layout = this.getGameplayLayoutConfig();
        if (!layout) {
            return;
        }

        this.markGameplayUiEditorElements();

        if (this.hudTopEl) {
            this.hudTopEl.style.left = `${layout.hudTop.x}px`;
            this.hudTopEl.style.top = `${layout.hudTop.y}px`;
            this.hudTopEl.style.width = `${layout.hudTop.width}px`;
            this.hudTopEl.style.height = `${layout.hudTop.height}px`;
            this.hudTopEl.style.display = layout.hudTop.visible === false ? 'none' : '';
        }
        if (this.hudSettingsButtonEl) {
            this.hudSettingsButtonEl.style.left = `${layout.settingsButton.x}px`;
            this.hudSettingsButtonEl.style.top = `${layout.settingsButton.y}px`;
            this.hudSettingsButtonEl.style.right = 'auto';
            this.hudSettingsButtonEl.style.width = `${layout.settingsButton.width}px`;
            this.hudSettingsButtonEl.style.height = `${layout.settingsButton.height}px`;
            this.hudSettingsButtonEl.style.display = layout.settingsButton.visible === false ? 'none' : '';
        }
        if (this.hudCoinDisplayEl) {
            this.hudCoinDisplayEl.style.left = `${layout.coinChip.x}px`;
            this.hudCoinDisplayEl.style.top = `${layout.coinChip.y}px`;
            this.hudCoinDisplayEl.style.right = 'auto';
            this.hudCoinDisplayEl.style.width = `${layout.coinChip.width}px`;
            this.hudCoinDisplayEl.style.minWidth = `${layout.coinChip.width}px`;
            this.hudCoinDisplayEl.style.height = `${layout.coinChip.height}px`;
            this.hudCoinDisplayEl.style.minHeight = `${layout.coinChip.height}px`;
            this.hudCoinDisplayEl.style.display = layout.coinChip.visible === false ? 'none' : '';
        }
        if (this.hudCoinValue) {
            this.hudCoinValue.style.fontSize = `${layout.coinChip.fontSize}px`;
        }
        if (this.hudCenterEl) {
            this.hudCenterEl.style.left = `${layout.center.x}px`;
            this.hudCenterEl.style.top = `${layout.center.y}px`;
            this.hudCenterEl.style.width = `${layout.center.width}px`;
            this.hudCenterEl.style.height = `${layout.center.height}px`;
            this.hudCenterEl.style.transform = 'none';
            this.hudCenterEl.style.display = layout.center.visible === false ? 'none' : 'block';
        }
        if (this.levelInfoEl) {
            this.levelInfoEl.style.position = 'absolute';
            this.levelInfoEl.style.left = `${layout.level.x}px`;
            this.levelInfoEl.style.top = `${layout.level.y}px`;
            this.levelInfoEl.style.width = `${layout.level.width}px`;
            this.levelInfoEl.style.fontSize = `${layout.level.fontSize}px`;
            this.levelInfoEl.style.display = layout.level.visible === false ? 'none' : 'block';
        }
        if (this.timerEl) {
            this.timerEl.style.position = 'absolute';
            this.timerEl.style.left = `${layout.timer.x}px`;
            this.timerEl.style.top = `${layout.timer.y}px`;
            this.timerEl.style.width = `${layout.timer.width}px`;
            this.timerEl.style.height = `${layout.timer.height}px`;
            this.timerEl.style.minHeight = `${layout.timer.height}px`;
            this.timerEl.style.display = layout.timer.visible === false ? 'none' : '';
        }
        if (this.timerLabelEl) {
            this.timerLabelEl.style.fontSize = `${layout.timer.labelFontSize}px`;
        }
        if (this.comboDisplayEl) {
            this.comboDisplayEl.style.position = 'absolute';
            this.comboDisplayEl.style.left = `${layout.combo.x}px`;
            this.comboDisplayEl.style.top = `${layout.combo.y}px`;
            this.comboDisplayEl.style.width = `${layout.combo.width}px`;
            this.comboDisplayEl.style.height = `${layout.combo.height}px`;
            this.comboDisplayEl.style.maxWidth = `${layout.combo.width}px`;
            this.comboDisplayEl.style.fontSize = `${layout.combo.fontSize}px`;
            this.comboDisplayEl.style.transform = 'none';
            this.comboDisplayEl.style.display = layout.combo.visible === false ? 'none' : '';
        }
        if (this.hudScorePulseEl) {
            this.hudScorePulseEl.style.left = `${layout.scorePulse.x}px`;
            this.hudScorePulseEl.style.top = `${layout.scorePulse.y}px`;
            this.hudScorePulseEl.style.width = `${layout.scorePulse.width}px`;
            this.hudScorePulseEl.style.height = `${layout.scorePulse.height}px`;
            this.hudScorePulseEl.style.minHeight = `${layout.scorePulse.height}px`;
            this.hudScorePulseEl.style.transform = 'none';
            this.hudScorePulseEl.style.display = layout.scorePulse.visible === false ? 'none' : 'flex';
        }
        if (this.hudScoreValueEl) {
            this.hudScoreValueEl.style.fontSize = `${layout.scorePulse.valueFontSize}px`;
        }
        if (this.hudScoreGainEl) {
            this.hudScoreGainEl.style.fontSize = `${layout.scorePulse.gainFontSize}px`;
        }
        this.applyGameplayChildLayout(layout);
        this.applySceneLayerOrder('gameplay', GAMEPLAY_UI_EDITOR_ELEMENT_ORDER);
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

    formatHudLevel(level) {
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
        if (this.locale === 'zh-CN') {
            return `洞穴 ${level}`;
        }
        return `Level ${level}`;
    }

    resolveHomeEditableText(textConfig, fallback = '', params = {}) {
        const raw = this.locale === 'zh-CN' ? textConfig?.textZh : textConfig?.textEn;
        let text = typeof raw === 'string' && raw.length > 0 ? raw : fallback;
        for (const [key, value] of Object.entries(params || {})) {
            text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), `${value}`);
        }
        return text;
    }

    refreshMenuLevelTag() {
        const level = this.getDefaultStartLevel();
        const valueText = this.formatLevel(level);
        const chipText = t(this.locale, 'common.levelChip', { level });
        const layout = this.getHomeLayoutConfig();
        if (this.levelTag) {
            this.levelTag.setAttribute('aria-label', valueText);
        }
        if (this.levelTagLabelEl) {
            this.levelTagLabelEl.textContent = this.resolveHomeEditableText(
                layout?.levelTagLabel,
                t(this.locale, 'home.burrowEntry')
            );
        }
        if (this.levelTagValue) {
            this.levelTagValue.textContent = this.resolveHomeEditableText(layout?.levelTagValue, chipText, { level });
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
        this.refreshProfileEntry();
        this.refreshSupportAuthorPanel();
        this.refreshCheckinPanel(false);
        this.applyHomeLayoutConfig();
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
        this.updateHomeDanceMascotPlayback();
    }

    renderFeatureCards() {
        const layout = this.getHomeLayoutConfig();
        const textConfigByFeatureId = {
            settings: layout?.featureSettingsText,
            leaderboard: layout?.featureLeaderboardText,
            skins: layout?.featureSkinsText,
            checkin: layout?.featureCheckinText,
            exit: layout?.featureExitText,
            'support-author': layout?.featureSupportAuthorText
        };
        for (const feature of FEATURE_CONFIG) {
            const button = document.getElementById(feature.buttonId);
            if (!button) continue;
            button.disabled = !feature.enabled;
            button.classList.toggle('disabled', !feature.enabled);
            button.dataset.panelId = feature.panelId;

            const label = button.querySelector('.feature-label');
            if (label) {
                label.textContent = this.resolveHomeEditableText(
                    textConfigByFeatureId[feature.id],
                    t(this.locale, feature.labelKey)
                );
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
            this.levelInfoEl.textContent = this.formatHudLevel(this.game.currentLevel);
        }

        if (this.livesEl) {
            const showLives = !!this.game.lifeSystemEnabled;
            this.livesEl.classList.toggle('hud-lives-placeholder', !showLives);
            this.livesEl.setAttribute('aria-hidden', showLives ? 'false' : 'true');
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
                icon: skin?.preview || 'assets/ui/shared/icons/icon_gift.png'
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
            return skin?.preview || 'assets/ui/shared/icons/icon_gift.png';
        }
        if (id === 'coin') return 'assets/ui/checkin/icon_coin_pile.png';
        if (id === 'hint') return 'assets/ui/shared/icons/icon_tool_hint.png';
        if (id === 'undo') return 'assets/ui/shared/icons/icon_tool_manual_release.png';
        if (id === 'shuffle') return 'assets/ui/shared/icons/icon_tool_freeze_time.png';
        if (id === 'skin_fragment') return 'assets/ui/shared/icons/icon_theme.png';
        if (id === 'skin') return 'assets/ui/shared/icons/icon_theme.png';
        return 'assets/ui/shared/icons/icon_gift.png';
    }

    showCheckinRewardTooltip(anchorEl, day, rewards = [], pointerEvent = null) {
        if (!this.checkinRewardTooltipEl || !anchorEl || !Array.isArray(rewards) || rewards.length === 0) {
            return;
        }
        const tooltipLayout = this.getCheckinLayoutConfig()?.rewardTooltip || null;
        const title = this.locale === 'zh-CN' ? '\u7b2c' + day + '\u5929\u5956\u52b1' : 'Day ' + day + ' Reward';
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
        const viewportSafePosition = this.clampCheckinTooltipToViewport(left, top, bubbleWidth, bubbleHeight);
        left = viewportSafePosition.left;
        top = viewportSafePosition.top;
        this.checkinRewardTooltipEl.style.left = `${Math.round(left)}px`;
        this.checkinRewardTooltipEl.style.top = `${Math.round(top)}px`;
        this.activeCheckinTooltipDay = day;
    }

    clampCheckinTooltipToViewport(left, top, bubbleWidth, bubbleHeight) {
        const safePadPx = 8;
        let nextLeft = Number(left);
        let nextTop = Number(top);
        if (!Number.isFinite(nextLeft)) {
            nextLeft = 16;
        }
        if (!Number.isFinite(nextTop)) {
            nextTop = 18;
        }

        const fallbackMinLeft = 16;
        const fallbackMaxLeft = Math.max(fallbackMinLeft, 980 - bubbleWidth - 16);
        const fallbackMinTop = 18;
        const fallbackMaxTop = Math.max(fallbackMinTop, 760 - bubbleHeight - 16);

        if (!(this.checkinSceneEl instanceof HTMLElement)) {
            return {
                left: Math.max(fallbackMinLeft, Math.min(fallbackMaxLeft, nextLeft)),
                top: Math.max(fallbackMinTop, Math.min(fallbackMaxTop, nextTop))
            };
        }

        const sceneRect = this.checkinSceneEl.getBoundingClientRect();
        const hostEl = this.checkinOverlay instanceof HTMLElement
            ? this.checkinOverlay
            : (this.checkinSceneEl.parentElement instanceof HTMLElement ? this.checkinSceneEl.parentElement : document.documentElement);
        const hostRect = hostEl.getBoundingClientRect();
        const sceneDesignWidth = Math.max(1, this.checkinSceneEl.offsetWidth || 980);
        const sceneDesignHeight = Math.max(1, this.checkinSceneEl.offsetHeight || 760);
        const scaleX = sceneRect.width / sceneDesignWidth;
        const scaleY = sceneRect.height / sceneDesignHeight;

        if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
            return {
                left: Math.max(fallbackMinLeft, Math.min(fallbackMaxLeft, nextLeft)),
                top: Math.max(fallbackMinTop, Math.min(fallbackMaxTop, nextTop))
            };
        }

        const viewportLeft = Math.max(0, hostRect.left) + safePadPx;
        const viewportRight = Math.min(window.innerWidth || hostRect.right, hostRect.right) - safePadPx;
        const viewportTop = Math.max(0, hostRect.top) + safePadPx;
        const viewportBottom = Math.min(window.innerHeight || hostRect.bottom, hostRect.bottom) - safePadPx;

        const minLeftByViewport = (viewportLeft - sceneRect.left) / scaleX;
        const maxLeftByViewport = (viewportRight - sceneRect.left - bubbleWidth * scaleX) / scaleX;
        const minTopByViewport = (viewportTop - sceneRect.top) / scaleY;
        const maxTopByViewport = (viewportBottom - sceneRect.top - bubbleHeight * scaleY) / scaleY;

        const minLeft = Number.isFinite(minLeftByViewport) ? minLeftByViewport : fallbackMinLeft;
        const maxLeft = Number.isFinite(maxLeftByViewport) ? maxLeftByViewport : fallbackMaxLeft;
        const minTop = Number.isFinite(minTopByViewport) ? minTopByViewport : fallbackMinTop;
        const maxTop = Number.isFinite(maxTopByViewport) ? maxTopByViewport : fallbackMaxTop;

        if (maxLeft >= minLeft) {
            nextLeft = Math.max(minLeft, Math.min(maxLeft, nextLeft));
        } else {
            nextLeft = minLeft;
        }
        if (maxTop >= minTop) {
            nextTop = Math.max(minTop, Math.min(maxTop, nextTop));
        } else {
            nextTop = minTop;
        }

        return {
            left: nextLeft,
            top: nextTop
        };
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
            ? '\u7b2c' + day + '\u5929\u7b7e\u5230\u5956\u52b1\uff1a' + this.formatRewardList(rewards)
            : `Day ${day} check-in reward: ${this.formatRewardList(rewards)}`);

        const title = document.createElement('div');
        title.className = 'checkin-day-title';
        title.textContent = this.locale === 'zh-CN' ? '\u7b2c' + day + '\u5929' : 'Day ' + day;
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
        if (isClaimableDay && this.liveOpsRedDots.checkin) {
            const claimDot = document.createElement('div');
            claimDot.className = 'checkin-day-claim-dot';
            claimDot.setAttribute('aria-hidden', 'true');
            node.appendChild(claimDot);
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

    refreshCheckinPanel() {
        const checkin = this.getCheckinSnapshotForRender();
        if (!checkin) {
            return;
        }
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
                    this.bindPressAction(node, () => this.claimCheckinReward(), {
                        audioId: `checkin-day-${day}`
                    });
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
                ? (this.locale === 'zh-CN' ? '\u70b9\u51fb\u7b2c' + checkin.nextDayIndex + '\u5929\u5956\u52b1\u5361\u5373\u53ef\u9886\u53d6' : 'Tap day ' + checkin.nextDayIndex + ' card to claim')
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
        this.applySceneLayerOrder('checkin', CHECKIN_UI_EDITOR_ELEMENT_ORDER);

    }

    activateUiEditorPreview() {
        const panel = `${this.uiEditorPreviewOptions.panel || 'checkin'}`.trim().toLowerCase();
        if (panel === 'gameplay') {
            this.activateGameplayUiEditorPreview();
            return;
        }
        if (panel === 'home') {
            this.appContainerEl?.classList.add('menu-mode');
            this.openMenuPanel(MENU_PANEL.HOME);
            return;
        }
        this.appContainerEl?.classList.add('menu-mode');
        this.uiEditorPreviewOverride = {
            previewMode: 'claimable',
            claimedDays: 0,
            nextDay: 1
        };
        this.openMenuPanel(MENU_PANEL.CHECKIN);
    }

    activateGameplayUiEditorPreview() {
        if (!this.uiEditorGameplayPreviewInitialized) {
            this.startSpecificLevel(12);
            if (typeof this.game?.setExternalPaused === 'function') {
                this.game.setExternalPaused(true);
            }
            this.game.currentLevel = 12;
            this.game.score = 192000;
            this.game.combo = 11;
            this.game.bestComboThisLevel = 11;
            this.game.lifeSystemEnabled = true;
            this.game.maxLives = Math.max(3, Math.floor(Number(this.game.maxLives) || 3));
            this.game.lives = Math.max(1, Math.min(this.game.maxLives, Math.floor(Number(this.game.lives) || 2)));
            this.game.hasTimer = true;
            this.game.maxTimeRemaining = 120;
            this.game.timeRemaining = 92;
            this.setCoinDisplayOverride(1703);
            this.clearTimerEnergyOrbs();
            this.uiEditorGameplayPreviewInitialized = true;
        }
        this.setMenuChromeVisible(false);
        this.hud.classList.remove('hidden');
        this.updateHUD();
        this.applyGameplayLayoutConfig();
        if (this.hudScoreGainEl) {
            this.hudScoreGainEl.classList.remove('hidden');
            this.hudScoreGainEl.textContent = '+288';
        }
    }

    setUiEditorPreviewState(override = {}) {
        if (!this.uiEditorPreviewOptions.enabled) {
            return;
        }
        const panel = `${this.uiEditorPreviewOptions.panel || 'checkin'}`.trim().toLowerCase();
        if (panel === 'gameplay') {
            this.activateGameplayUiEditorPreview();
            return;
        }
        if (panel === 'home') {
            this.appContainerEl?.classList.add('menu-mode');
            this.openMenuPanel(MENU_PANEL.HOME);
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

    applyUiEditorLayoutConfig(config) {
        this.uiLayoutConfig = cloneUiLayoutConfig(config);
        this.applyHomeLayoutConfig();
        this.applyCheckinLayoutConfig();
        this.applyGameplayLayoutConfig();
        this.refreshCheckinPanel(false);
        this.updateCheckinSceneScale();
    }

    getUiEditorPreviewMeta() {
        return {
            width: 430,
            height: 932
        };
    }

    isUiEditorNodeVisible(node) {
        if (!(node instanceof HTMLElement)) {
            return false;
        }
        if (node.classList.contains('hidden')) {
            return false;
        }
        const style = window.getComputedStyle(node);
        if (!style || style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        const opacity = Number(style.opacity);
        if (Number.isFinite(opacity) && opacity <= 0.01) {
            return false;
        }
        return true;
    }

    isUiEditorNodeVisual(node) {
        if (!(node instanceof HTMLElement)) {
            return false;
        }
        const tag = node.tagName;
        if (tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'SVG') {
            return true;
        }
        const style = window.getComputedStyle(node);
        if (!style) {
            return false;
        }
        if (style.backgroundImage && style.backgroundImage !== 'none') {
            return true;
        }
        const borderWidth =
            (Number.parseFloat(style.borderTopWidth) || 0)
            + (Number.parseFloat(style.borderRightWidth) || 0)
            + (Number.parseFloat(style.borderBottomWidth) || 0)
            + (Number.parseFloat(style.borderLeftWidth) || 0);
        if (borderWidth > 0) {
            return true;
        }
        const text = `${node.textContent || ''}`.trim();
        return text.length > 0;
    }

    unionUiEditorRects(a, b) {
        if (!a) return b;
        if (!b) return a;
        const x1 = Math.min(a.x, b.x);
        const y1 = Math.min(a.y, b.y);
        const x2 = Math.max(a.x + a.width, b.x + b.width);
        const y2 = Math.max(a.y + a.height, b.y + b.height);
        return {
            x: x1,
            y: y1,
            width: Math.max(0, x2 - x1),
            height: Math.max(0, y2 - y1)
        };
    }

    intersectUiEditorRects(a, b) {
        if (!a || !b) {
            return null;
        }
        const x1 = Math.max(a.x, b.x);
        const y1 = Math.max(a.y, b.y);
        const x2 = Math.min(a.x + a.width, b.x + b.width);
        const y2 = Math.min(a.y + a.height, b.y + b.height);
        if (x2 <= x1 || y2 <= y1) {
            return null;
        }
        return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }

    getUiEditorImageTrimRatio(imgEl) {
        if (!(imgEl instanceof HTMLImageElement)) {
            return null;
        }
        const src = `${imgEl.currentSrc || imgEl.src || ''}`.trim();
        const naturalWidth = Number(imgEl.naturalWidth) || 0;
        const naturalHeight = Number(imgEl.naturalHeight) || 0;
        if (!src || naturalWidth <= 0 || naturalHeight <= 0 || !imgEl.complete) {
            return null;
        }
        const cacheKey = `${src}#${naturalWidth}x${naturalHeight}`;
        if (this.uiEditorImageTrimCache.has(cacheKey)) {
            return this.uiEditorImageTrimCache.get(cacheKey);
        }
        try {
            const canvas = document.createElement('canvas');
            canvas.width = naturalWidth;
            canvas.height = naturalHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                return null;
            }
            ctx.clearRect(0, 0, naturalWidth, naturalHeight);
            ctx.drawImage(imgEl, 0, 0, naturalWidth, naturalHeight);
            const data = ctx.getImageData(0, 0, naturalWidth, naturalHeight).data;
            let minX = naturalWidth;
            let minY = naturalHeight;
            let maxX = -1;
            let maxY = -1;
            for (let y = 0; y < naturalHeight; y += 1) {
                const rowOffset = y * naturalWidth * 4;
                for (let x = 0; x < naturalWidth; x += 1) {
                    const alpha = data[rowOffset + x * 4 + 3];
                    if (alpha <= 8) {
                        continue;
                    }
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
            if (maxX < minX || maxY < minY) {
                return null;
            }
            const ratio = {
                left: minX / naturalWidth,
                top: minY / naturalHeight,
                right: (naturalWidth - 1 - maxX) / naturalWidth,
                bottom: (naturalHeight - 1 - maxY) / naturalHeight
            };
            this.uiEditorImageTrimCache.set(cacheKey, ratio);
            return ratio;
        } catch {
            return null;
        }
    }

    trimUiEditorRectByImageRatio(rect, ratio) {
        if (!rect || !ratio) {
            return rect;
        }
        const widthScale = 1 - Number(ratio.left || 0) - Number(ratio.right || 0);
        const heightScale = 1 - Number(ratio.top || 0) - Number(ratio.bottom || 0);
        if (widthScale <= 0 || heightScale <= 0) {
            return rect;
        }
        return {
            x: rect.x + rect.width * Number(ratio.left || 0),
            y: rect.y + rect.height * Number(ratio.top || 0),
            width: rect.width * widthScale,
            height: rect.height * heightScale
        };
    }

    getUiEditorVisualRect(node) {
        if (!(node instanceof HTMLElement)) {
            return null;
        }
        const base = node.getBoundingClientRect();
        if (!Number.isFinite(base.width) || !Number.isFinite(base.height) || base.width <= 0 || base.height <= 0) {
            return null;
        }
        let rect = {
            x: base.left,
            y: base.top,
            width: base.width,
            height: base.height
        };
        if (node instanceof HTMLImageElement) {
            const ratio = this.getUiEditorImageTrimRatio(node);
            rect = this.trimUiEditorRectByImageRatio(rect, ratio);
        }
        return rect;
    }

    getUiEditorTightRect(target) {
        if (!(target instanceof HTMLElement)) {
            return null;
        }
        const baseBounds = target.getBoundingClientRect();
        if (!Number.isFinite(baseBounds.width) || !Number.isFinite(baseBounds.height) || baseBounds.width <= 0 || baseBounds.height <= 0) {
            return null;
        }
        const baseRect = {
            x: baseBounds.left,
            y: baseBounds.top,
            width: baseBounds.width,
            height: baseBounds.height
        };
        const nodes = [target, ...target.querySelectorAll('*')];
        let unionRect = null;
        for (const node of nodes) {
            if (!(node instanceof HTMLElement)) {
                continue;
            }
            if (!this.isUiEditorNodeVisible(node)) {
                continue;
            }
            if (!this.isUiEditorNodeVisual(node)) {
                continue;
            }
            const rect = this.getUiEditorVisualRect(node);
            if (!rect || rect.width < 1 || rect.height < 1) {
                continue;
            }
            unionRect = this.unionUiEditorRects(unionRect, rect);
        }
        if (!unionRect) {
            return baseRect;
        }
        const clipped = this.intersectUiEditorRects(baseRect, unionRect);
        if (!clipped || clipped.width < 1 || clipped.height < 1) {
            return baseRect;
        }
        const baseArea = Math.max(1, baseRect.width * baseRect.height);
        const clippedArea = Math.max(1, clipped.width * clipped.height);
        if (clippedArea / baseArea > 0.995) {
            return baseRect;
        }
        return clipped;
    }

    getUiEditorElementRect(elementId) {
        if (!elementId) {
            return null;
        }
        const target = document.querySelector(`[data-ui-editor-id="${elementId}"]`);
        if (!(target instanceof HTMLElement)) {
            return null;
        }
        const rect = this.getUiEditorTightRect(target) || target.getBoundingClientRect();
        return {
            x: rect.x ?? rect.left,
            y: rect.y ?? rect.top,
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
        if (result?.ok) {
            this.liveOpsRedDots.checkin = false;
            this.applyLiveOpsRedDots();
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
            this.liveOpsRedDots.online = false;
            this.applyLiveOpsRedDots();
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
        const layout = this.getHomeLayoutConfig();
        if (!online.enabled) {
            this.onlineDockTextEl.textContent = this.locale === 'zh-CN' ? '\u672a\u5f00\u542f' : 'Off';
            return;
        }
        if (online.done) {
            this.onlineDockTextEl.textContent = this.locale === 'zh-CN' ? '\u5df2\u9886\u5b8c' : 'Done';
            return;
        }
        if (online.canClaim) {
            this.onlineDockTextEl.textContent = this.resolveHomeEditableText(
                layout?.onlineRewardText,
                this.locale === 'zh-CN' ? '\u53ef\u9886\u53d6' : 'Claim'
            );
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
                ? '\u7b7e\u5230\u6210\u529f\uff0c\u5956\u52b1\u5982\u4e0b\uff1a'
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
            this.btnCheckinRewardConfirm.textContent = this.locale === 'zh-CN' ? '\u786e\u5b9a' : 'Confirm';
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
            coin.src = 'assets/ui/themes/design-v5/icon_coin.png';
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
            this.onlineRewardSettleDescEl.textContent = this.locale === 'zh-CN' ? '\u672c\u6b21\u5728\u7ebf\u5956\u52b1\uff1a' : 'Online reward:';
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
            this.btnOnlineRewardSettleClose.textContent = this.locale === 'zh-CN' ? '\u786e\u5b9a' : 'Confirm';
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
        const digitCount = `${Math.max(0, Math.floor(Number(totalScore) || 0))}`.length;
        const applyDigitScalePenalty = (style) => ({
            ...style,
            scale: Math.max(0.82, Number(style.scale || 1) - Math.max(0, digitCount - 5) * 0.06)
        });
        if (totalScore >= 12000) {
            return applyDigitScalePenalty({
                scale: 1.38,
                color: '#ff77c1',
                shadow: '0 2px 0 rgba(56, 23, 37, 0.68), 0 0 12px rgba(255, 103, 186, 0.56), 0 0 24px rgba(255, 89, 176, 0.34)',
                gainColor: '#ffe8f6'
            });
        }
        if (totalScore >= 8000) {
            return applyDigitScalePenalty({
                scale: 1.30,
                color: '#ff9766',
                shadow: '0 2px 0 rgba(63, 35, 20, 0.65), 0 0 10px rgba(255, 143, 92, 0.46), 0 0 20px rgba(255, 129, 73, 0.26)',
                gainColor: '#fff0d9'
            });
        }
        if (totalScore >= 5000) {
            return applyDigitScalePenalty({
                scale: 1.22,
                color: '#ffcb72',
                shadow: '0 2px 0 rgba(66, 42, 21, 0.62), 0 0 8px rgba(255, 206, 117, 0.42), 0 0 18px rgba(255, 176, 77, 0.22)',
                gainColor: '#fff2c8'
            });
        }
        if (totalScore >= 2500) {
            return applyDigitScalePenalty({
                scale: 1.15,
                color: '#ffe592',
                shadow: '0 2px 0 rgba(62, 43, 22, 0.6), 0 0 8px rgba(255, 234, 162, 0.36)',
                gainColor: '#fff4cf'
            });
        }
        if (totalScore >= 1000) {
            return applyDigitScalePenalty({
                scale: 1.08,
                color: '#f0ffd2',
                shadow: '0 2px 0 rgba(45, 30, 20, 0.58), 0 0 6px rgba(225, 255, 166, 0.3)',
                gainColor: '#f8ffd9'
            });
        }
        return applyDigitScalePenalty({
            scale: 1,
            color: '#e6f4d4',
            shadow: '0 2px 0 rgba(45, 30, 20, 0.58), 0 6px 12px rgba(38, 23, 16, 0.28)',
            gainColor: '#fff4cf'
        });
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
        if (this.scorePulseAnimation && typeof this.scorePulseAnimation.cancel === 'function') {
            this.scorePulseAnimation.cancel();
            this.scorePulseAnimation = null;
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
            { opacity: 0, transform: 'translateY(10px) scale(0.9)' },
            { offset: 0.18, opacity: 1, transform: 'translateY(0px) scale(1)' },
            { offset: 0.72, opacity: 1, transform: 'translateY(-12px) scale(1.03)' },
            { opacity: 0, transform: 'translateY(-26px) scale(1.06)' }
        ], {
            duration: 980,
            easing: 'cubic-bezier(0.2, 0.75, 0.22, 1)',
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
            button.disabled = disabled;
            button.classList.toggle('item-btn-disabled', disabled);
            const armed = item.id === 'undo' && this.game.undoReleaseArmed === true && !disabled;
            button.classList.toggle('item-btn-armed', armed);
            button.setAttribute('aria-pressed', armed ? 'true' : 'false');
        }
    }

    updateTimer() {
        if (!this.timerEl) return;

        if (!this.game.hasTimer) {
            this.clearTimerEnergyOrbs();
            this.timerEl.classList.add('hidden');
            this.timerEl.classList.remove('timer-last10');
            this.lastCountdownTickSecond = null;
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
        const isLastTenSeconds = displaySeconds <= 10 && displaySeconds > 0;
        const gameplayLayout = this.getGameplayLayoutConfig();
        const baseTimerLabelFontSize = Math.max(
            8,
            Number(gameplayLayout?.timerLabel?.fontSize)
                || Number(gameplayLayout?.timer?.labelFontSize)
                || 12
        );
        if (this.timerLabelEl) {
            this.timerLabelEl.textContent = isLastTenSeconds
                ? `${displaySeconds}`
                : `${mins}m${secs.toString().padStart(2, '0')}s`;
            this.timerLabelEl.style.fontSize = isLastTenSeconds
                ? `${Math.round(baseTimerLabelFontSize * 3.5)}px`
                : `${baseTimerLabelFontSize}px`;
        } else {
            this.timerEl.textContent = isLastTenSeconds
                ? `${displaySeconds}`
                : `${mins}m${secs.toString().padStart(2, '0')}s`;
        }

        if (isLastTenSeconds) {
            if (this.lastCountdownTickSecond !== displaySeconds) {
                this.lastCountdownTickSecond = displaySeconds;
                if (this.audioEnabled) {
                    playFinalCountdownTickSound(displaySeconds);
                }
            }
        } else {
            this.lastCountdownTickSecond = null;
        }

        this.timerEl.classList.toggle('timer-last10', isLastTenSeconds);
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
        countEl.setAttribute('data-ui-editor-id', 'comboCount');

        const labelEl = document.createElement('span');
        labelEl.className = 'hud-combo-label';
        labelEl.textContent = 'combo';
        labelEl.setAttribute('data-ui-editor-id', 'comboLabel');

        this.comboDisplayEl.replaceChildren(countEl, labelEl);
        this.applyGameplayChildLayout(this.getGameplayLayoutConfig());
    }

    showRewardUnlockToast(payload = {}) {
        if (!this.rewardUnlockToastEl) {
            return;
        }

        const imageEl = this.rewardUnlockToastImageEl;
        const textEl = this.rewardUnlockToastTextEl;
        const threshold = Math.max(1, Math.floor(Number(payload?.threshold) || 0));
        const hasBannerImage = !!(`${imageEl?.getAttribute?.('src') || ''}`.trim());
        if (textEl) {
            textEl.textContent = threshold > 0
                ? '\u5b8c\u6210 ' + threshold + ' \u8fde\u51fb\u53ef\u89e6\u53d1\u5956\u52b1\u5173\uff01'
                : '\u5956\u52b1\u5173\u5df2\u89e3\u9501\uff0c\u4e0b\u5173\u53ef\u80fd\u8fdb\u5165\u5956\u52b1\u5173\u3002';
            textEl.classList.toggle('hidden', hasBannerImage);
        }
        if (imageEl) {
            imageEl.classList.toggle('hidden', !hasBannerImage);
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
                this.bindPressAction(action, () => {
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
                this.bindPressAction(action, () => {
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

    resolveLevelSettleDuration(deltaScore) {
        const delta = Math.max(0, Math.floor(Number(deltaScore) || 0));
        const duration = LEVEL_SETTLE_MIN_MS + delta * LEVEL_SETTLE_PER_POINT_MS;
        return Math.min(LEVEL_SETTLE_MAX_MS, Math.max(320, Math.round(duration)));
    }

    getLevelSettleCoinByScore(score, scorePerCoin, maxEarnedCoins) {
        const cappedScore = Math.max(0, Math.floor(Number(score) || 0));
        const cappedReward = Math.max(0, Math.floor(Number(maxEarnedCoins) || 0));
        if (cappedScore <= 0 || cappedReward <= 0) {
            return 0;
        }
        const perCoin = Math.max(1, Math.floor(Number(scorePerCoin) || 1));
        const computed = Math.max(1, Math.ceil(cappedScore / perCoin));
        return Math.min(cappedReward, computed);
    }

    setLevelSettleScoreText(score, multiplierText = '', showMultiplier = false) {
        const safeScore = Math.max(0, Math.floor(Number(score) || 0));
        if (this.levelScoreLabel) {
            this.levelScoreLabel.textContent = this.getLocaleText('\u5206\u6570', 'Score');
        }
        if (this.levelScoreValue) {
            this.levelScoreValue.textContent = `${safeScore}`;
        } else if (this.levelScore) {
            this.levelScore.textContent = this.getLocaleText(
                `\u5206\u6570 ${safeScore}`,
                `Score ${safeScore}`
            );
        }
        if (this.levelScoreMultiplier) {
            this.levelScoreMultiplier.textContent = `${multiplierText}`.trim() || 'x1.00';
            this.levelScoreMultiplier.classList.toggle('hidden', !showMultiplier);
            this.levelScoreMultiplier.classList.toggle('is-visible', showMultiplier);
        } else if (this.levelScore && showMultiplier && `${multiplierText}`.trim()) {
            this.levelScore.textContent = `${this.levelScore.textContent || ''} ${multiplierText}`.trim();
        }
    }

    setLevelSettleComboText(bestCombo) {
        const combo = Math.max(0, Math.floor(Number(bestCombo) || 0));
        if (this.levelBestComboLabel) {
            this.levelBestComboLabel.textContent = this.getLocaleText('\u6700\u9ad8\u8fde\u51fb', 'Best Combo');
        }
        if (this.levelBestComboValue) {
            this.levelBestComboValue.textContent = `${combo}`;
        } else if (this.levelBestCombo) {
            this.levelBestCombo.textContent = this.getLocaleText(
                `\u6700\u9ad8\u8fde\u51fb ${combo}`,
                `Best combo ${combo}`
            );
        }
    }

    setLevelSettleCoinText(earnedCoins, totalCoins) {
        if (!this.levelCoinReward) {
            return;
        }
        const earned = Math.max(0, Math.floor(Number(earnedCoins) || 0));
        const total = Math.max(0, Math.floor(Number(totalCoins) || 0));
        this.levelCoinReward.textContent = this.getLocaleText(
            `\u91d1\u5e01 +${earned}\uff08\u603b\u8ba1 ${total}\uff09`,
            `Coins +${earned} (Total ${total})`
        );
    }

    waitForLevelSettleDelay(durationMs, runId) {
        const delay = Math.max(0, Math.floor(Number(durationMs) || 0));
        if (delay <= 0) {
            return Promise.resolve(this.levelSettleRunId === runId);
        }
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(this.levelSettleRunId === runId);
            }, delay);
        });
    }

    animateLevelSettleScore({
        runId,
        fromScore,
        toScore,
        durationMs,
        multiplierText,
        showMultiplier,
        scorePerCoin,
        maxEarnedCoins,
        totalCoinsBeforeReward
    }) {
        const startScore = Math.max(0, Math.floor(Number(fromScore) || 0));
        const endScore = Math.max(0, Math.floor(Number(toScore) || 0));
        const distance = endScore - startScore;
        const safeDuration = Math.max(0, Math.floor(Number(durationMs) || 0));
        const apply = (scoreValue) => {
            this.setLevelSettleScoreText(scoreValue, multiplierText, showMultiplier);
            const earnedCoins = this.getLevelSettleCoinByScore(scoreValue, scorePerCoin, maxEarnedCoins);
            this.setLevelSettleCoinText(earnedCoins, totalCoinsBeforeReward + earnedCoins);
        };

        if (this.levelSettleRunId !== runId) {
            return Promise.resolve(false);
        }
        if (safeDuration <= 0 || distance === 0) {
            apply(endScore);
            return Promise.resolve(this.levelSettleRunId === runId);
        }

        return new Promise((resolve) => {
            const startAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
                ? performance.now()
                : Date.now();

            const step = (now) => {
                if (this.levelSettleRunId !== runId) {
                    this.levelSettleAnimFrame = 0;
                    resolve(false);
                    return;
                }
                const elapsed = Math.max(0, now - startAt);
                const progress = Math.min(1, elapsed / safeDuration);
                const eased = 1 - Math.pow(1 - progress, 3);
                const nextScore = Math.round(startScore + distance * eased);
                apply(nextScore);
                if (progress >= 1) {
                    this.levelSettleAnimFrame = 0;
                    apply(endScore);
                    resolve(true);
                    return;
                }
                this.levelSettleAnimFrame = requestAnimationFrame(step);
            };

            this.levelSettleAnimFrame = requestAnimationFrame(step);
        });
    }

    async playLevelSettleSequence({
        runId,
        baseScore,
        finalScore,
        bestCombo,
        scoreMultiplierText,
        scorePerCoin,
        earnedCoins,
        totalCoinsBeforeReward
    }) {
        if (this.levelSettleRunId !== runId) {
            return;
        }
        this.isLevelSettleAnimating = true;
        this.toggleLevelCompleteButtons(false);
        this.levelBestComboValue?.classList.remove('is-emphasis');
        this.setLevelSettleComboText(bestCombo);
        this.setLevelSettleScoreText(0, scoreMultiplierText, false);
        this.setLevelSettleCoinText(0, totalCoinsBeforeReward);

        const stageOneScore = Math.max(0, Math.floor(Number(baseScore) || 0));
        const stageTwoScore = Math.max(stageOneScore, Math.floor(Number(finalScore) || 0));
        const phase1Done = await this.animateLevelSettleScore({
            runId,
            fromScore: 0,
            toScore: stageOneScore,
            durationMs: this.resolveLevelSettleDuration(stageOneScore),
            multiplierText: scoreMultiplierText,
            showMultiplier: false,
            scorePerCoin,
            maxEarnedCoins: earnedCoins,
            totalCoinsBeforeReward
        });
        if (!phase1Done || this.levelSettleRunId !== runId) {
            return;
        }

        if (this.levelBestComboValue) {
            this.levelBestComboValue.classList.remove('is-emphasis');
            void this.levelBestComboValue.offsetWidth;
            this.levelBestComboValue.classList.add('is-emphasis');
        }
        const emphasized = await this.waitForLevelSettleDelay(LEVEL_SETTLE_COMBO_EMPHASIS_MS, runId);
        if (!emphasized || this.levelSettleRunId !== runId) {
            return;
        }
        this.levelBestComboValue?.classList.remove('is-emphasis');

        this.setLevelSettleScoreText(stageOneScore, scoreMultiplierText, true);
        const held = await this.waitForLevelSettleDelay(LEVEL_SETTLE_MULTIPLIER_HOLD_MS, runId);
        if (!held || this.levelSettleRunId !== runId) {
            return;
        }

        const phase2Done = await this.animateLevelSettleScore({
            runId,
            fromScore: stageOneScore,
            toScore: stageTwoScore,
            durationMs: this.resolveLevelSettleDuration(stageTwoScore - stageOneScore),
            multiplierText: scoreMultiplierText,
            showMultiplier: true,
            scorePerCoin,
            maxEarnedCoins: earnedCoins,
            totalCoinsBeforeReward
        });
        if (!phase2Done || this.levelSettleRunId !== runId) {
            return;
        }

        this.isLevelSettleAnimating = false;
        this.toggleLevelCompleteButtons(true);
    }

    showLevelCompletePopup() {
        this.stopLevelSettleAnimation();
        const runId = this.levelSettleRunId;
        this.levelCompleteOverlay.classList.remove('hidden');
        this.updateCoinDisplays();
        const settleSummary = typeof this.game.getLastLevelSettleSummary === 'function'
            ? this.game.getLastLevelSettleSummary()
            : null;
        const finalScore = Math.max(
            0,
            Math.floor(Number(settleSummary?.finalScore ?? this.game?.score) || 0)
        );
        const baseScore = Math.max(
            0,
            Math.floor(Number(settleSummary?.baseScore ?? finalScore) || 0)
        );
        const bestCombo = Math.max(
            0,
            Math.floor(Number(settleSummary?.bestCombo ?? this.game?.bestComboThisLevel) || 0)
        );
        const comboScoreMultiplier = Math.max(
            1,
            Number(settleSummary?.comboScoreMultiplier) || 1
        );
        const perfectScoreMultiplier = Math.max(
            1,
            Number(settleSummary?.perfectScoreMultiplier) || 1
        );
        const totalScoreMultiplier = Math.max(
            1,
            Number((comboScoreMultiplier * perfectScoreMultiplier).toFixed(2))
        );
        const scoreMultiplierText = `x${totalScoreMultiplier.toFixed(2)}`;
        const perfectComboClear = settleSummary?.perfectComboClear === true;
        const isCampaignComplete = typeof this.game.isCampaignCompleted === 'function'
            && this.game.isCampaignCompleted();
        const willEnterRewardStage = !this.game.isRewardStage
            && Number(this.game.pendingRewardReturnLevel) > 0;
        if (isCampaignComplete && typeof this.game.playCampaignCompleteCelebration === 'function') {
            this.game.playCampaignCompleteCelebration();
        } else if (typeof this.game.playLevelCompleteCelebration === 'function') {
            this.game.playLevelCompleteCelebration();
        }
        if (this.levelCompleteNextButton) {
            this.levelCompleteNextButton.textContent = willEnterRewardStage ? '\u5956\u52b1\u5173' : '\u4e0b\u4e00\u5173';
        }
        if (this.levelCompleteTitleEl) {
            this.levelCompleteTitleEl.textContent = isCampaignComplete ? '\u606d\u559c\u901a\u5173' : '\u606d\u559c\u8fc7\u5173';
        }
        if (this.levelScoreBonus) {
            this.levelScoreBonus.classList.add('hidden');
            this.levelScoreBonus.textContent = '';
        }
        if (this.levelPerfectStamp) {
            this.levelPerfectStamp.classList.toggle('hidden', !perfectComboClear);
            this.levelPerfectStamp.textContent = this.getLocaleText('\u5b8c\u7f8e', 'PERFECT');
        }
        if (this.levelCompletePopupBox) {
            this.levelCompletePopupBox.classList.toggle('is-perfect', perfectComboClear);
        }

        const earnedCoins = typeof this.game.getLastCoinReward === 'function'
            ? this.game.getLastCoinReward()
            : 0;
        const totalCoins = typeof this.game.getCoins === 'function'
            ? this.game.getCoins()
            : 0;
        const totalCoinsBeforeReward = Math.max(0, totalCoins - earnedCoins);
        const scorePerCoin = typeof this.game.getScorePerCoin === 'function'
            ? this.game.getScorePerCoin()
            : 1;

        void this.playLevelSettleSequence({
            runId,
            baseScore,
            finalScore,
            bestCombo,
            scoreMultiplierText,
            scorePerCoin,
            earnedCoins,
            totalCoinsBeforeReward
        });
        this.refreshDoubleCoinAdButton();
    }

    showGameOverPopup(reason) {
        this.gameOverOverlay.classList.remove('hidden');
        if (this.gameOverReason) {
            this.gameOverReason.textContent = reason || t(this.locale, 'panel.over.title');
        }
        this.refreshGameOverContinueByAdButton();
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
                icon.src = 'assets/ui/shared/icons/icon_lock.png';
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


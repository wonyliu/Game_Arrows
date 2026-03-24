import { playClickSound, resumeAudio } from './audio.js?v=20';
import { detectInitialLocale, persistLocale, resolveLocale, t } from './i18n.js?v=5';
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

export class UI {
    constructor(game) {
        this.game = game;
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
        this.hudEnergyLayerEl = document.getElementById('hudEnergyLayer');
        this.energyOrbNodes = new Set();

        this.menuOverlay = document.getElementById('menuOverlay');
        this.settingsOverlay = document.getElementById('settingsOverlay');
        this.leaderboardOverlay = document.getElementById('leaderboardOverlay');
        this.skinsOverlay = document.getElementById('skinsOverlay');
        this.checkinOverlay = document.getElementById('checkinOverlay');
        this.exitOverlay = document.getElementById('exitOverlay');
        this.resetProgressOverlay = document.getElementById('resetProgressOverlay');

        this.levelCompleteOverlay = document.getElementById('levelCompleteOverlay');
        this.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.levelSelectOverlay = document.getElementById('levelSelectOverlay');
        this.levelCompleteTitleEl = document.querySelector('#levelCompleteOverlay .popup-title');
        this.levelCompleteNextButton = document.getElementById('btnNext');

        this.levelScore = document.getElementById('levelScore');
        this.levelGrid = document.getElementById('levelGrid');
        this.gameOverReason = document.getElementById('gameOverReason');
        this.levelTag = document.getElementById('btnLevels');
        this.levelTagValue = document.getElementById('menuLevelTagValue');
        this.levelSelectCurrent = document.getElementById('levelSelectCurrent');
        this.exitFeedback = document.getElementById('exitFeedback');
        this.localeZhBtn = document.getElementById('btnLocaleZh');
        this.localeEnBtn = document.getElementById('btnLocaleEn');
        this.settingsEndRunRow = document.getElementById('settingsEndRunRow');
        this.settingsConfirmTitleEl = document.getElementById('settingsConfirmTitle');
        this.settingsConfirmDescEl = document.getElementById('settingsConfirmDesc');
        this.settingsConfirmActionBtn = document.getElementById('btnResetProgressConfirm');

        this.bindEvents();
        this.bindGameCallbacks();
        this.applyThemeAssets();
        this.setMenuBadges(this.menuBadges);
        this.applyLocalizedText();

        if (this.game.isPlaytestMode) {
            this.startSpecificLevel(this.game.currentLevel);
        } else {
            this.goToMenu();
        }
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
                resumeAudio();
                playClickSound();
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
        this.game.onTimerUpdate = () => this.updateTimer();
        this.game.onTimerEnergyEmit = (payload) => this.spawnTimerEnergyOrb(payload);
        this.game.onTimerEnergyBatchCancel = (batchId) => this.cancelTimerEnergyBatch(batchId);
        this.game.onTimerEnergyClear = () => this.clearTimerEnergyOrbs();
        this.game.onLevelComplete = () => this.showLevelCompletePopup();
        this.game.onGameOver = (reason) => this.showGameOverPopup(reason);
        this.game.onCollision = () => this.triggerErrorVignette();
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
        }

        if (target === MENU_PANEL.LEVEL_SELECT) {
            this.levelSelectOverlay.classList.remove('hidden');
            this.game.state = 'LEVEL_SELECT';
            this.buildLevelGrid();
        }

        if (target === MENU_PANEL.SETTINGS) {
            this.settingsOverlay.classList.remove('hidden');
            this.game.state = 'SETTINGS';
            this.updateSettingsActionRows();
        }

        if (target === MENU_PANEL.LEADERBOARD) {
            this.leaderboardOverlay.classList.remove('hidden');
            this.game.state = 'LEADERBOARD';
        }

        if (target === MENU_PANEL.SKINS) {
            this.skinsOverlay.classList.remove('hidden');
            this.game.state = 'SKINS';
        }

        if (target === MENU_PANEL.CHECKIN) {
            this.checkinOverlay.classList.remove('hidden');
            this.game.state = 'CHECKIN';
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

    hideAll() {
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
        if (!shouldShow) {
            this.comboDisplayEl.textContent = '';
            this.comboDisplayEl.classList.remove('combo-tier-1', 'combo-tier-2', 'combo-tier-3', 'combo-tier-4');
            return;
        }

        this.comboDisplayEl.textContent = `${combo} combo`;
        this.comboDisplayEl.classList.remove('combo-tier-1', 'combo-tier-2', 'combo-tier-3', 'combo-tier-4');
        if (combo >= 100) {
            this.comboDisplayEl.classList.add('combo-tier-4');
            return;
        }
        if (combo >= 50) {
            this.comboDisplayEl.classList.add('combo-tier-3');
            return;
        }
        if (combo >= 10) {
            this.comboDisplayEl.classList.add('combo-tier-2');
            return;
        }
        this.comboDisplayEl.classList.add('combo-tier-1');
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

    showLevelCompletePopup() {
        this.levelCompleteOverlay.classList.remove('hidden');
        const isCampaignComplete = typeof this.game.isCampaignCompleted === 'function'
            && this.game.isCampaignCompleted();
        if (this.levelCompleteNextButton) {
            this.levelCompleteNextButton.textContent = t(
                this.locale,
                isCampaignComplete ? 'common.menu' : 'common.next'
            );
        }
        if (this.levelCompleteTitleEl) {
            this.levelCompleteTitleEl.textContent = isCampaignComplete
                ? (this.locale === 'en-US' ? 'Congratulations!' : '恭喜通关')
                : t(this.locale, 'panel.complete.title');
        }
        if (this.levelScore) {
            this.levelScore.textContent = t(this.locale, 'common.score', { score: this.game.score });
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
                        resumeAudio();
                        playClickSound();
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


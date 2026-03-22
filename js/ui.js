import { playClickSound, resumeAudio } from './audio.js?v=20';
import { detectInitialLocale, persistLocale, resolveLocale, t } from './i18n.js?v=1';
import { getUiAsset } from './ui-theme.js?v=2';

const MENU_PANEL = Object.freeze({
    HOME: 'HOME',
    LEVEL_SELECT: 'LEVEL_SELECT',
    SETTINGS: 'SETTINGS',
    LEADERBOARD: 'LEADERBOARD',
    SKINS: 'SKINS',
    CHECKIN: 'CHECKIN',
    EXIT_CONFIRM: 'EXIT_CONFIRM'
});

const FEATURE_CONFIG = Object.freeze([
    { id: 'settings', buttonId: 'btnSettings', panelId: MENU_PANEL.SETTINGS, labelKey: 'feature.settings', iconSlot: 'icon.settings', badge: null, enabled: true },
    { id: 'leaderboard', buttonId: 'btnLeaderboard', panelId: MENU_PANEL.LEADERBOARD, labelKey: 'feature.leaderboard', iconSlot: 'icon.leaderboard', badge: null, enabled: true },
    { id: 'skins', buttonId: 'btnSkins', panelId: MENU_PANEL.SKINS, labelKey: 'feature.skins', iconSlot: 'icon.skins', badge: null, enabled: true },
    { id: 'checkin', buttonId: 'btnCheckin', panelId: MENU_PANEL.CHECKIN, labelKey: 'feature.checkin', iconSlot: 'icon.checkin', badge: null, enabled: true },
    { id: 'exit', buttonId: 'btnExit', panelId: MENU_PANEL.EXIT_CONFIRM, labelKey: 'feature.exit', iconSlot: 'icon.exit', badge: null, enabled: true }
]);

const HOME_START_VISUAL_HITBOX = Object.freeze({
    x: 92.5,
    y: 332.5,
    width: 245,
    height: 91.1
});

export class UI {
    constructor(game) {
        this.game = game;
        this.locale = detectInitialLocale();
        this.menuState = MENU_PANEL.HOME;
        this.lastStartTriggerAt = Number.NEGATIVE_INFINITY;
        this.menuBadges = Object.fromEntries(
            FEATURE_CONFIG.map((feature) => [feature.id, feature.badge ?? null])
        );

        this.hud = document.getElementById('hud');
        this.livesEl = document.getElementById('lives');
        this.levelInfoEl = document.getElementById('levelInfo');
        this.timerEl = document.getElementById('timer');

        this.menuOverlay = document.getElementById('menuOverlay');
        this.settingsOverlay = document.getElementById('settingsOverlay');
        this.leaderboardOverlay = document.getElementById('leaderboardOverlay');
        this.skinsOverlay = document.getElementById('skinsOverlay');
        this.checkinOverlay = document.getElementById('checkinOverlay');
        this.exitOverlay = document.getElementById('exitOverlay');

        this.levelCompleteOverlay = document.getElementById('levelCompleteOverlay');
        this.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.levelSelectOverlay = document.getElementById('levelSelectOverlay');

        this.levelScore = document.getElementById('levelScore');
        this.levelGrid = document.getElementById('levelGrid');
        this.gameOverReason = document.getElementById('gameOverReason');
        this.levelTag = document.getElementById('btnLevels');
        this.exitFeedback = document.getElementById('exitFeedback');
        this.localeZhBtn = document.getElementById('btnLocaleZh');
        this.localeEnBtn = document.getElementById('btnLocaleEn');

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

        this.bindButton('btnSettings', () => this.openMenuPanel(MENU_PANEL.SETTINGS));
        this.bindButton('btnLeaderboard', () => this.openMenuPanel(MENU_PANEL.LEADERBOARD));
        this.bindButton('btnSkins', () => this.openMenuPanel(MENU_PANEL.SKINS));
        this.bindButton('btnCheckin', () => this.openMenuPanel(MENU_PANEL.CHECKIN));
        this.bindButton('btnExit', () => this.openMenuPanel(MENU_PANEL.EXIT_CONFIRM));

        this.bindButton('btnExitCancelTop', () => this.closeMenuPanel());
        this.bindButton('btnExitCancel', () => this.closeMenuPanel());
        this.bindButton('btnExitConfirm', () => this.handleExitConfirm());

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
        this.game.onLevelComplete = () => this.showLevelCompletePopup();
        this.game.onGameOver = (reason) => this.showGameOverPopup(reason);
        this.game.onCollision = () => this.triggerErrorVignette();
    }

    startGame() {
        const defaultLevel = this.getDefaultStartLevel();
        this.hideAll();
        this.hud.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.game.startLevel(defaultLevel);
        this.updateHUD();
    }

    startSpecificLevel(level) {
        this.hideAll();
        this.hud.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.game.startLevel(level);
        this.updateHUD();
    }

    nextLevel() {
        this.startSpecificLevel(this.game.currentLevel + 1);
    }

    retryLevel() {
        this.startSpecificLevel(this.game.currentLevel);
    }

    goToMenu() {
        this.openMenuPanel(MENU_PANEL.HOME);
    }

    showLevelSelect() {
        this.openMenuPanel(MENU_PANEL.LEVEL_SELECT);
    }

    openMenuPanel(panelId) {
        const target = Object.values(MENU_PANEL).includes(panelId) ? panelId : MENU_PANEL.HOME;
        this.hideAll();
        this.hud.classList.add('hidden');
        this.setMenuChromeVisible(true);

        if (target === MENU_PANEL.HOME) {
            this.menuOverlay.classList.remove('hidden');
            this.game.state = 'MENU';
        }

        if (target === MENU_PANEL.LEVEL_SELECT) {
            this.levelSelectOverlay.classList.remove('hidden');
            this.game.state = 'LEVEL_SELECT';
            this.buildLevelGrid();
        }

        if (target === MENU_PANEL.SETTINGS) {
            this.settingsOverlay.classList.remove('hidden');
            this.game.state = 'SETTINGS';
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

        this.menuState = target;
        this.applyLocalizedText();
        this.refreshMenuLevelTag();
        this.renderFeatureCards();
    }

    closeMenuPanel() {
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
        this.levelCompleteOverlay.classList.add('hidden');
        this.gameOverOverlay.classList.add('hidden');
        this.levelSelectOverlay.classList.add('hidden');
    }

    getDefaultStartLevel() {
        return Math.max(1, this.game.maxUnlockedLevel || this.game.currentLevel || 1);
    }

    formatLevel(level) {
        return t(this.locale, 'common.levelTag', { level });
    }

    refreshMenuLevelTag() {
        if (this.levelTag) {
            this.levelTag.textContent = this.formatLevel(this.getDefaultStartLevel());
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
    }

    updateLocaleButtons() {
        this.localeZhBtn?.classList.toggle('active', this.locale === 'zh-CN');
        this.localeEnBtn?.classList.toggle('active', this.locale === 'en-US');
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
            this.livesEl.innerHTML = '';
            for (let i = 0; i < this.game.maxLives; i++) {
                const heart = document.createElement('span');
                heart.className = `heart${i < this.game.lives ? '' : ' empty'}`;
                const icon = document.createElement('span');
                icon.className = 'heart-icon';
                heart.appendChild(icon);
                this.livesEl.appendChild(heart);
            }
        }

        this.updateTimer();
        this.refreshMenuLevelTag();
    }

    updateTimer() {
        if (!this.timerEl) return;

        if (!this.game.hasTimer) {
            this.timerEl.classList.add('hidden');
            return;
        }

        this.timerEl.classList.remove('hidden');
        const mins = Math.floor(this.game.timeRemaining / 60);
        const secs = this.game.timeRemaining % 60;
        this.timerEl.textContent = `${mins}m${secs.toString().padStart(2, '0')}s`;
        this.timerEl.classList.toggle('timer-danger', this.game.timeRemaining <= 10);
    }

    showLevelCompletePopup() {
        this.levelCompleteOverlay.classList.remove('hidden');
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
        for (let i = 1; i <= 30; i++) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'level-btn';

            if (i <= this.game.maxUnlockedLevel) {
                button.classList.add('unlocked');
                if (i < this.game.maxUnlockedLevel) {
                    button.classList.add('completed');
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

    triggerErrorVignette() {
        const vignette = document.getElementById('errorVignette');
        if (!vignette) return;

        vignette.classList.remove('active');
        void vignette.offsetWidth;
        vignette.classList.add('active');
    }
}

export { MENU_PANEL };

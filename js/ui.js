import { playClickSound, resumeAudio } from './audio.js?v=19';

export class UI {
    constructor(game) {
        this.game = game;

        this.hud = document.getElementById('hud');
        this.livesEl = document.getElementById('lives');
        this.levelInfoEl = document.getElementById('levelInfo');
        this.timerEl = document.getElementById('timer');
        this.progressBarFill = document.getElementById('progressBarFill');
        this.progressThumb = document.getElementById('progressThumb');

        this.menuOverlay = document.getElementById('menuOverlay');
        this.levelCompleteOverlay = document.getElementById('levelCompleteOverlay');
        this.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.levelSelectOverlay = document.getElementById('levelSelectOverlay');
        this.levelScore = document.getElementById('levelScore');
        this.levelGrid = document.getElementById('levelGrid');
        this.gameOverReason = document.getElementById('gameOverReason');

        this.topResources = document.getElementById('topResources');
        this.sideBar = document.getElementById('sideBar');
        this.levelTag = document.querySelector('.current-level-tag');

        this.bindEvents();
        this.bindGameCallbacks();
        if (this.game.isPlaytestMode) {
            this.startSpecificLevel(this.game.currentLevel);
        } else {
            this.goToMenu();
        }
    }

    bindEvents() {
        this.bindButton('btnPlay', () => this.startGame());
        this.bindButton('btnLevels', () => this.showLevelSelect());
        this.bindButton('btnHint', () => this.game.useHint());
        this.bindButton('btnUndo', () => this.game.useUndo());
        this.bindButton('btnShuffle', () => this.game.useShuffle());
        this.bindButton('btnNext', () => this.nextLevel());
        this.bindButton('btnRetry', () => this.retryLevel());
        this.bindButton('btnMenuFromComplete', () => this.goToMenu());
        this.bindButton('btnMenuFromOver', () => this.goToMenu());
        this.bindButton('btnBackFromSelect', () => this.goToMenu());

        document.querySelectorAll('.nav-item, .float-btn, .side-btn, .hud-settings').forEach((button) => {
            button.addEventListener('click', () => playClickSound());
        });

        document.querySelectorAll('.nav-item').forEach((button) => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
                button.classList.add('active');
            });
        });
    }

    bindButton(id, handler) {
        const element = document.getElementById(id);
        if (!element) return;

        element.addEventListener('click', () => {
            resumeAudio();
            playClickSound();
            handler();
        });
    }

    bindGameCallbacks() {
        this.game.onHUDUpdate = () => this.updateHUD();
        this.game.onTimerUpdate = () => this.updateTimer();
        this.game.onLevelComplete = () => this.showLevelCompletePopup();
        this.game.onGameOver = (reason) => this.showGameOverPopup(reason);
        this.game.onCollision = () => this.triggerErrorVignette();
    }

    startGame() {
        this.hideAll();
        this.hud.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.game.startLevel(this.game.currentLevel);
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
        this.hideAll();
        this.menuOverlay.classList.remove('hidden');
        this.setMenuChromeVisible(true);
        this.game.state = 'MENU';
        this.refreshMenuLevelTag();
    }

    showLevelSelect() {
        this.hideAll();
        this.levelSelectOverlay.classList.remove('hidden');
        this.setMenuChromeVisible(false);
        this.game.state = 'LEVEL_SELECT';
        this.buildLevelGrid();
    }

    setMenuChromeVisible(visible) {
        if (this.topResources) {
            this.topResources.classList.toggle('hidden', !visible);
        }
        if (this.sideBar) {
            this.sideBar.classList.toggle('hidden', !visible);
        }
    }

    hideAll() {
        this.hud.classList.add('hidden');
        this.menuOverlay.classList.add('hidden');
        this.levelCompleteOverlay.classList.add('hidden');
        this.gameOverOverlay.classList.add('hidden');
        this.levelSelectOverlay.classList.add('hidden');
    }

    refreshMenuLevelTag() {
        if (this.levelTag) {
            this.levelTag.textContent = `Level ${this.game.currentLevel}`;
        }
    }

    updateHUD() {
        this.levelInfoEl.textContent = `Level ${this.game.currentLevel}`;

        this.livesEl.innerHTML = '';
        for (let i = 0; i < this.game.maxLives; i++) {
            const heart = document.createElement('span');
            heart.className = `heart${i < this.game.lives ? '' : ' empty'}`;
            const icon = document.createElement('span');
            icon.className = 'heart-icon';
            heart.appendChild(icon);
            this.livesEl.appendChild(heart);
        }

        const activeLines = this.game.lines.filter((line) => line.state === 'active').length;
        const totalLines = this.game.lines.length;
        const progress = totalLines > 0 ? (1 - activeLines / totalLines) * 100 : 0;

        if (this.progressBarFill) {
            this.progressBarFill.style.width = `${progress}%`;
        }
        if (this.progressThumb) {
            this.progressThumb.style.left = `${progress}%`;
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
        this.levelScore.textContent = `Score: ${this.game.score}`;
    }

    showGameOverPopup(reason) {
        this.gameOverOverlay.classList.remove('hidden');
        if (this.gameOverReason) {
            this.gameOverReason.textContent = reason || 'Out of lives';
        }
    }

    buildLevelGrid() {
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
                    resumeAudio();
                    playClickSound();
                    this.startSpecificLevel(i);
                });
            } else {
                button.classList.add('locked');
                const icon = document.createElement('img');
                icon.src = 'assets/ui/pixel/lock.svg';
                icon.alt = 'locked';
                icon.className = 'pixel-icon level-lock-icon';
                button.appendChild(icon);
            }

            this.levelGrid.appendChild(button);
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

import { Grid } from './grid.js?v=22';
import { Line } from './line.js?v=22';
import { canMove, findMovableLines } from './collision.js?v=19';
import { getLevelConfig } from './levels.js?v=26';
import { AnimationManager } from './animation.js?v=19';
import { buildPlayableLevel } from './level-builder.js?v=45';
import {
    deserializeLevelData,
    getPreviewLevelRecord,
    getSavedLevelRecord
} from './level-storage.js?v=26';
import {
    playClearSound,
    playErrorSound,
    playGameOverSound,
    playLevelCompleteSound,
    resumeAudio
} from './audio.js?v=19';
import { buildGameSpriteAtlas, drawSprite, hashPoint } from './pixel-art.js?v=2';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.searchParams = new URLSearchParams(window.location.search);
        this.isPlaytestMode = this.searchParams.get('playtest') === '1';
        this.playtestLevel = Number(this.searchParams.get('level') || this.searchParams.get('playtestLevel') || 0);
        this.state = 'MENU';
        this.currentLevel = 3;
        this.maxUnlockedLevel = 3;
        this.grid = null;
        this.lines = [];
        this.lives = 3;
        this.maxLives = 3;
        this.score = 0;
        this.combo = 0;
        this.timeRemaining = 0;
        this.hasTimer = false;
        this.timerInterval = null;
        this.animations = new AnimationManager();
        this.lastTime = 0;
        this.hintLine = null;
        this.undoStack = [];
        this.pixelTheme = null;

        this.loadProgress();

        if (this.isPlaytestMode && this.playtestLevel > 0) {
            this.currentLevel = this.playtestLevel;
            this.maxUnlockedLevel = Math.max(this.maxUnlockedLevel, this.playtestLevel);
        }

        this.canvas.addEventListener('click', (event) => this.handleClick(event));
        this.canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.handleClick(event.touches[0]);
        }, { passive: false });

        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    loadProgress() {
        try {
            const data = JSON.parse(localStorage.getItem('arrowClear_progress') || '{}');
            this.maxUnlockedLevel = Math.max(3, data.maxUnlockedLevel || 3);
            this.currentLevel = Math.max(1, Math.min(this.maxUnlockedLevel, data.currentLevel || 3));
        } catch {
            this.maxUnlockedLevel = 3;
            this.currentLevel = 3;
        }
    }

    saveProgress() {
        localStorage.setItem('arrowClear_progress', JSON.stringify({
            maxUnlockedLevel: this.maxUnlockedLevel,
            currentLevel: this.currentLevel
        }));
    }

    resize() {
        const wrapper = this.canvas.parentElement;
        this.canvas.width = wrapper ? wrapper.clientWidth : window.innerWidth;
        this.canvas.height = wrapper ? wrapper.clientHeight : window.innerHeight;

        if (this.grid) {
            this.grid.resize(this.canvas.width, this.canvas.height);
            this.rebuildPixelScene();
        }
    }

    startLevel(levelNum) {
        resumeAudio();
        this.currentLevel = levelNum;

        const config = getLevelConfig(levelNum);
        const preparedRecord = this.getPreparedLevelRecord(levelNum);
        const levelData = isCompatibleLevelData(preparedRecord?.data) ? preparedRecord.data : null;
        const gridCols = levelData?.gridCols || config.gridCols;
        const gridRows = levelData?.gridRows || config.gridRows;

        this.grid = new Grid(gridCols, gridRows);
        this.grid.resize(this.canvas.width, this.canvas.height);

        const generated = levelData ? null : buildPlayableLevel(config);
        this.lines = levelData
            ? deserializeLevelData(levelData)
            : (Array.isArray(generated) ? generated : (generated?.lines || []));
        if (!Array.isArray(this.lines)) {
            this.lines = [];
        }
        this.grid.clear();
        for (const line of this.lines) {
            this.grid.registerLine(line);
        }
        this.rebuildPixelScene();

        this.lives = config.lives;
        this.maxLives = config.lives;
        this.score = 0;
        this.combo = 0;
        this.hasTimer = config.hasTimer;
        this.timeRemaining = config.timerSeconds;
        this.hintLine = null;
        this.undoStack = [];
        this.state = 'PLAYING';

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        if (this.hasTimer) {
            this.timerInterval = setInterval(() => {
                if (this.state !== 'PLAYING') return;

                this.timeRemaining--;
                this.updateTimerUI();

                if (this.timeRemaining <= 0) {
                    this.gameOver('鏃堕棿鍒颁簡');
                }
            }, 1000);
        }

        this.updateHUD();
    }

    getPreparedLevelRecord(levelNum) {
        if (this.isPlaytestMode && this.playtestLevel === levelNum) {
            return getPreviewLevelRecord(levelNum) || getSavedLevelRecord(levelNum);
        }

        return getSavedLevelRecord(levelNum);
    }

    handleClick(event) {
        if (this.state !== 'PLAYING' || !this.grid) return;

        resumeAudio();
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX || event.pageX) - rect.left;
        const y = (event.clientY || event.pageY) - rect.top;
        const clickedLine = this.findTopLineAtPoint(x, y);
        if (!clickedLine) return;

        const result = canMove(clickedLine, this.lines, this.grid);
        if (result.canMove) {
            this.removeLine(clickedLine);
        } else {
            this.errorOnLine(clickedLine, result.distance);
        }
    }

    findTopLineAt(col, row) {
        const lineIds = this.grid.getLinesAt(col, row);
        let topLine = null;

        for (const lineId of lineIds) {
            const line = this.lines.find((item) => item.id === lineId);
            if (!line || line.state !== 'active') continue;
            if (!topLine || line.zIndex > topLine.zIndex) {
                topLine = line;
            }
        }

        return topLine;
    }

    findTopLineAtPoint(x, y) {
        const activeLines = this.lines
            .filter((line) => line.state === 'active')
            .sort((a, b) => b.zIndex - a.zIndex);

        const threshold = this.grid.cellSize * 0.26;
        const headThreshold = this.grid.cellSize * 0.4;

        for (const line of activeLines) {
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
        this.undoStack.push({
            lineId: line.id,
            combo: this.combo,
            score: this.score,
            lives: this.lives
        });

        this.grid.unregisterLine(line);
        this.combo++;
        const points = 100 * this.combo;
        this.score += points;
        playClearSound(this.combo - 1);

        const headPos = this.grid.gridToScreen(line.headCell.col, line.headCell.row);
        this.animations.addFloatingText(headPos.x, headPos.y, `+${points}`, '#ffffff', 22);
        this.animations.addComboText(this.canvas.width / 2, this.canvas.height / 2, this.combo);
        this.animations.startRemoveAnimation(line, this.grid, () => this.checkLevelComplete());

        this.hintLine = null;
        this.updateHUD();
    }

    errorOnLine(line, distanceCells) {
        this.combo = 0;
        this.lives = Math.max(0, this.lives - 1);
        playErrorSound();

        if (this.onCollision) {
            this.onCollision();
        }

        this.animations.startErrorAnimation(line, distanceCells, this.grid);

        const center = this.grid.gridToScreen(this.grid.cols / 2, this.grid.rows * 0.72);
        this.animations.addFloatingText(center.x, center.y, '鈿?-1', '#3b3650', 18, {
            pill: true,
            pillColor: '#ffffff',
            life: 0.9,
            vy: -30,
            stroke: false
        });

        if (this.lives <= 0) {
            setTimeout(() => this.gameOver('鐢熷懡鑰楀敖'), 450);
        }

        this.updateHUD();
    }

    checkLevelComplete() {
        const remaining = this.lines.filter((line) => line.state === 'active');
        if (remaining.length !== 0) return;

        this.state = 'LEVEL_COMPLETE';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        playLevelCompleteSound();
        this.animations.addConfetti(this.canvas.width * 0.2, this.canvas.height, 80);
        this.animations.addConfetti(this.canvas.width * 0.5, this.canvas.height + 50, 100);
        this.animations.addConfetti(this.canvas.width * 0.8, this.canvas.height, 80);

        if (this.currentLevel >= this.maxUnlockedLevel) {
            this.maxUnlockedLevel = this.currentLevel + 1;
        }
        this.saveProgress();
        this.showLevelComplete();
    }

    gameOver(reason) {
        this.state = 'GAME_OVER';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        playGameOverSound();
        this.animations.addConfetti(this.canvas.width / 2, this.canvas.height / 2, 60, ['#ff0000', '#ffaaaa', '#8b0000'], 'star');
        this.showGameOver(reason);
    }

    useHint() {
        if (this.state !== 'PLAYING') return;
        const movableLines = findMovableLines(this.lines, this.grid);
        this.hintLine = movableLines[0] || null;
    }

    useUndo() {
        if (this.state !== 'PLAYING' || this.undoStack.length === 0) return;

        const undo = this.undoStack.pop();
        const line = this.lines.find((item) => item.id === undo.lineId);
        if (!line || line.state === 'active') return;

        line.state = 'active';
        line.opacity = 1;
        line.trails = [];
        line._removeAnim = null;
        line.removeTint = null;
        this.grid.registerLine(line);
        this.combo = undo.combo;
        this.score = undo.score;
        this.lives = undo.lives;
        this.updateHUD();
    }

    useShuffle() {
        if (this.state !== 'PLAYING') return;

        const activeLines = this.lines.filter((line) => line.state === 'active');
        if (activeLines.length < 2) return;

        const zIndices = activeLines.map((line) => line.zIndex);
        for (let i = zIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [zIndices[i], zIndices[j]] = [zIndices[j], zIndices[i]];
        }

        activeLines.forEach((line, index) => {
            line.zIndex = zIndices[index];
        });
        this.hintLine = null;
    }

    render(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;
        this.animations.update(dt, Array.isArray(this.lines) ? this.lines : []);

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

            const sortedLines = [...this.lines]
                .filter((line) => line.state !== 'removed')
                .sort((a, b) => a.zIndex - b.zIndex);

            for (const line of sortedLines) {
                if (line.trails.length > 0) {
                    line.drawTrails(ctx, this.grid, this.pixelTheme);
                }
            }

            for (const line of sortedLines) {
                if (this.hintLine && line.id === this.hintLine.id) {
                    ctx.save();
                    ctx.shadowColor = '#6a79ff';
                    ctx.shadowBlur = 20;
                    ctx.globalAlpha = 0.95;
                    line.removeTint = '#6a79ff';
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
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const atlas = buildGameSpriteAtlas(this.grid.cellSize, dpr);
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

    updateTimerUI() {
        if (this.onTimerUpdate) {
            this.onTimerUpdate();
        }
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

function isCompatibleLevelData(levelData) {
    if (!levelData || !Array.isArray(levelData.lines) || levelData.lines.length === 0) {
        return false;
    }

    if ((levelData.generatorVersion || 0) >= 5) {
        return true;
    }
    return false;
}

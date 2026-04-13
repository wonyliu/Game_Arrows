import { Grid } from './grid.js?v=40';
import { canMove } from './collision.js?v=40';
import {
    BONUS_LEVEL_ID,
    MAX_NORMAL_LEVEL,
    MAX_REWARD_LEVEL,
    getBaseLevelConfig,
    getNormalLevelCount,
    getRewardLevelCount,
    isRewardLevel,
    rewardIndexFromLevelId,
    toRewardLevelId
} from './levels.js?v=32';
import { buildPlayableLevelRecord, buildWeavePath, DIR_VEC, OPPOSITE } from './level-builder.js?v=58';
import {
    applyStoredSettings,
    buildStoredSettings,
    deletePreviewLevelRecord,
    deleteSavedLevelRecord,
    deserializeLevelData,
    estimateLineCount,
    getLevelCatalog,
    getPreviewLevelRecord,
    getSavedLevelRecord,
    initLevelStorage,
    savePreviewLevelRecord,
    saveSavedLevelRecord,
    saveLevelCatalog
} from './level-storage.js?v=55';

const el = {
    levelSelect: document.getElementById('levelSelect'),
    normalLevelCount: document.getElementById('normalLevelCount'),
    rewardLevelCount: document.getElementById('rewardLevelCount'),
    btnNormalLevelMinus: document.getElementById('btnNormalLevelMinus'),
    btnNormalLevelPlus: document.getElementById('btnNormalLevelPlus'),
    btnRewardLevelMinus: document.getElementById('btnRewardLevelMinus'),
    btnRewardLevelPlus: document.getElementById('btnRewardLevelPlus'),
    btnSaveLevelCatalog: document.getElementById('btnSaveLevelCatalog'),
    levelDisplayNameField: document.getElementById('levelDisplayNameField'),
    levelDisplayName: document.getElementById('levelDisplayName'),
    dimensionMode: document.getElementById('dimensionMode'),
    dimensionValue: document.getElementById('dimensionValue'),
    customGridFields: document.getElementById('customGridFields'),
    customGridCols: document.getElementById('customGridCols'),
    customGridRows: document.getElementById('customGridRows'),
    minLen: document.getElementById('minLen'),
    maxLen: document.getElementById('maxLen'),
    timerSeconds: document.getElementById('timerSeconds'),
    misclickPenaltySeconds: document.getElementById('misclickPenaltySeconds'),
    rewardScorePerBodySegment: document.getElementById('rewardScorePerBodySegment'),
    gridText: document.getElementById('gridText'),
    lineText: document.getElementById('lineText'),
    coverageText: document.getElementById('coverageText'),
    genProgressText: document.getElementById('genProgressText'),
    genProgressFill: document.getElementById('genProgressFill'),
    status: document.getElementById('status'),
    stats: document.getElementById('stats'),
    previewTitle: document.getElementById('previewTitle'),
    canvas: document.getElementById('previewCanvas'),
    btnGenerate: document.getElementById('btnGenerate'),
    btnGenerate2: document.getElementById('btnGenerate2'),
    btnGenerate3: document.getElementById('btnGenerate3'),
    btnGenerate4: document.getElementById('btnGenerate4'),
    btnRestPreview: document.getElementById('btnRestPreview'),
    btnHint: document.getElementById('btnHint'),
    btnSave: document.getElementById('btnSave'),
    btnReset: document.getElementById('btnReset'),
    togglePath: document.getElementById('togglePath'),
    btnPatternSeed: document.getElementById('btnPatternSeed'),
    generate4Tools: document.getElementById('generate4Tools'),
    manualGridCols: document.getElementById('manualGridCols'),
    manualGridRows: document.getElementById('manualGridRows'),
    btnApplyGridSize: document.getElementById('btnApplyGridSize'),
    previewBoardFrame: document.getElementById('previewBoardFrame'),
    previewCanvasHost: document.getElementById('previewCanvasHost'),
    gameFramePreviewMeta: document.getElementById('gameFramePreviewMeta')
};

const ctx = el.canvas.getContext('2d');
const GAME_DESIGN_WIDTH = 430;
const GAME_DESIGN_HEIGHT = 932;
const GAME_HEADER_HEIGHT = 16;
const GAME_CANVAS_TOP_GAP = 58;
const GAME_HUD_BOTTOM_HEIGHT = 108;
const GAME_CONTENT_PAD_X = 5;
const PREVIEW_CANVAS_BASE_WIDTH = 430;
const PREVIEW_CANVAS_BASE_HEIGHT = 664;
let previewRecord = null;
let renderedLevelData = null;
let previewPlayState = null;
let isGenerating = false;
let isGenerate2Mode = false;
let isGenerate4Mode = false;
let activeHamiltonianPath = null;
let currentKeyDir = null; // up, down, left, right
let isLifting = false;
let isRightMouseDown = false;
let isErasing = false; // NEW: Track if we are in erasing mode
let liftedCellsIndices = []; // Indices in activeHamiltonianPath
let rightMouseDownTime = 0;
let rightMouseDownPos = null;
let isPathVisible = true; // NEW: Toggle for Hamiltonian Path visibility
let isDrawingManualLine = false;
let manualDrawStartCell = null;
let manualDrawCells = [];
let levelCatalog = {
    normalCount: getNormalLevelCount(),
    rewardCount: getRewardLevelCount()
};

init().catch((error) => {
    console.error(error);
    setStatus(`管理后台初始化失败：${error?.message || '未知错误'}`);
});

async function init() {
    await initLevelStorage();
    levelCatalog = normalizeCatalog(getLevelCatalog());
    syncCatalogInputs();
    rebuildLevelSelect(3);

    el.levelSelect.addEventListener('change', loadLevelState);
    el.btnNormalLevelMinus?.addEventListener('click', () => adjustCatalogInput('normal', -1));
    el.btnNormalLevelPlus?.addEventListener('click', () => adjustCatalogInput('normal', 1));
    el.btnRewardLevelMinus?.addEventListener('click', () => adjustCatalogInput('reward', -1));
    el.btnRewardLevelPlus?.addEventListener('click', () => adjustCatalogInput('reward', 1));
    el.btnSaveLevelCatalog?.addEventListener('click', onSaveLevelCatalog);
    el.normalLevelCount?.addEventListener('change', () => syncCatalogInputs(readCatalogFromInputs()));
    el.rewardLevelCount?.addEventListener('change', () => syncCatalogInputs(readCatalogFromInputs()));
    el.dimensionMode.addEventListener('change', updateDerived);
    el.dimensionValue.addEventListener('input', updateDerived);
    el.customGridCols?.addEventListener('input', updateDerived);
    el.customGridRows?.addEventListener('input', updateDerived);
    el.minLen.addEventListener('input', updateDerived);
    el.maxLen.addEventListener('input', updateDerived);

    el.btnGenerate.addEventListener('click', () => onGenerate(3));
    el.btnGenerate2.addEventListener('click', onGenerate2);
    el.btnGenerate3.addEventListener('click', () => onGenerate(1));
    el.btnGenerate4.addEventListener('click', onGenerate4);
    el.btnRestPreview.addEventListener('click', onRestPreview);
    el.btnHint.addEventListener('click', onHint);
    el.btnSave.addEventListener('click', onSave);
    el.btnReset.addEventListener('click', onReset);
    el.togglePath.addEventListener('click', onTogglePath);
    el.btnPatternSeed?.addEventListener('click', onGenerate4Pattern);
    el.btnApplyGridSize?.addEventListener('click', onApplyGenerate4GridSize);
    el.manualGridCols?.addEventListener('change', onGenerate4GridInputChange);
    el.manualGridRows?.addEventListener('change', onGenerate4GridInputChange);
    el.canvas.addEventListener('mousedown', onCanvasMouseDown);
    el.canvas.addEventListener('mouseup', onCanvasMouseUp);
    el.canvas.addEventListener('mousemove', onCanvasMouseMove);
    el.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    loadLevelState();
}

function getLevel() {
    const raw = Math.floor(Number(el.levelSelect.value || 1) || 1);
    if (isRewardLevel(raw)) {
        return raw;
    }
    return clampInt(raw, 1, levelCatalog.normalCount, 1);
}

function formatLevelLabel(level) {
    if (isRewardLevel(level)) {
        const rewardIndex = rewardIndexFromLevelId(level);
        return rewardIndex > 0 ? `奖励关 ${rewardIndex}` : '奖励关';
    }
    return `关卡 ${level}`;
}

function updateLevelDisplayNameField(level, value = '') {
    if (!el.levelDisplayNameField || !el.levelDisplayName) {
        return;
    }
    const rewardStage = isRewardLevel(level);
    el.levelDisplayNameField.style.display = rewardStage ? '' : 'none';
    el.levelDisplayName.value = rewardStage ? `${value || ''}` : '';
    if (el.rewardScorePerBodySegment) {
        el.rewardScorePerBodySegment.disabled = !rewardStage;
    }
}

function normalizeCatalog(catalog) {
    return {
        normalCount: clampInt(catalog?.normalCount, 1, MAX_NORMAL_LEVEL, getNormalLevelCount()),
        rewardCount: clampInt(catalog?.rewardCount, 0, MAX_REWARD_LEVEL, getRewardLevelCount())
    };
}

function syncCatalogInputs(catalog = levelCatalog) {
    const normalized = normalizeCatalog(catalog);
    if (el.normalLevelCount) {
        el.normalLevelCount.value = String(normalized.normalCount);
    }
    if (el.rewardLevelCount) {
        el.rewardLevelCount.value = String(normalized.rewardCount);
    }
    return normalized;
}

function readCatalogFromInputs() {
    return normalizeCatalog({
        normalCount: Number(el.normalLevelCount?.value || levelCatalog.normalCount || 1),
        rewardCount: Number(el.rewardLevelCount?.value || levelCatalog.rewardCount || 0)
    });
}

function adjustCatalogInput(type, delta) {
    const current = readCatalogFromInputs();
    if (type === 'reward') {
        current.rewardCount = clampInt(current.rewardCount + delta, 0, MAX_REWARD_LEVEL, current.rewardCount);
    } else {
        current.normalCount = clampInt(current.normalCount + delta, 1, MAX_NORMAL_LEVEL, current.normalCount);
    }
    syncCatalogInputs(current);
}

function rebuildLevelSelect(preferredLevel = null) {
    const selectedBefore = Math.floor(Number(preferredLevel ?? el.levelSelect.value) || 1);
    const catalogSnapshot = normalizeCatalog(levelCatalog);
    el.levelSelect.innerHTML = '';

    for (let level = 1; level <= catalogSnapshot.normalCount; level++) {
        const option = document.createElement('option');
        option.value = String(level);
        option.textContent = `关卡 ${level}`;
        el.levelSelect.appendChild(option);
    }

    for (let rewardIndex = 1; rewardIndex <= catalogSnapshot.rewardCount; rewardIndex++) {
        const option = document.createElement('option');
        option.value = String(toRewardLevelId(rewardIndex));
        option.textContent = `奖励关 ${rewardIndex}`;
        el.levelSelect.appendChild(option);
    }

    const maxRewardId = catalogSnapshot.rewardCount > 0
        ? toRewardLevelId(catalogSnapshot.rewardCount)
        : 0;
    const canUseSelected = (
        selectedBefore >= 1 && selectedBefore <= catalogSnapshot.normalCount
    ) || (
        selectedBefore >= BONUS_LEVEL_ID && selectedBefore <= maxRewardId
    );
    const fallbackLevel = clampInt(
        selectedBefore,
        1,
        catalogSnapshot.normalCount,
        catalogSnapshot.normalCount
    );
    const selectedLevel = canUseSelected ? selectedBefore : fallbackLevel;
    el.levelSelect.value = String(selectedLevel);
}

function collectRemovedLevelIds(previousCatalog, nextCatalog) {
    const removed = [];
    const prev = normalizeCatalog(previousCatalog);
    const next = normalizeCatalog(nextCatalog);

    for (let level = next.normalCount + 1; level <= prev.normalCount; level++) {
        removed.push(level);
    }

    for (let rewardIndex = next.rewardCount + 1; rewardIndex <= prev.rewardCount; rewardIndex++) {
        removed.push(toRewardLevelId(rewardIndex));
    }

    return removed;
}

async function onSaveLevelCatalog() {
    const selectedBefore = getLevel();
    const nextCatalog = readCatalogFromInputs();
    syncCatalogInputs(nextCatalog);
    const prevCatalog = normalizeCatalog(levelCatalog);
    const changed = prevCatalog.normalCount !== nextCatalog.normalCount
        || prevCatalog.rewardCount !== nextCatalog.rewardCount;

    if (!changed) {
        setStatus(`关卡数量未变化。普通关=${prevCatalog.normalCount}，奖励关=${prevCatalog.rewardCount}。`);
        return;
    }

    const removedLevelIds = collectRemovedLevelIds(prevCatalog, nextCatalog);
    const savedToDisk = await saveLevelCatalog(nextCatalog);
    levelCatalog = normalizeCatalog(nextCatalog);
    rebuildLevelSelect(selectedBefore);
    loadLevelState();

    const removedText = removedLevelIds.length > 0
        ? ` 其中 ${removedLevelIds.length} 条超出范围的关卡记录将被忽略。`
        : '';
    if (savedToDisk) {
        setStatus(`关卡数量已保存。普通关=${levelCatalog.normalCount}，奖励关=${levelCatalog.rewardCount}。${removedText}`);
    } else {
        setStatus(`关卡数量仅保存到浏览器缓存（磁盘同步不可用）。${removedText}`);
    }
}

function setGenerateMode(mode = 'normal') {
    const nextMode = `${mode || 'normal'}`.toLowerCase();
    isGenerate2Mode = nextMode === 'generate2';
    isGenerate4Mode = nextMode === 'generate4';
    if (!isGenerate2Mode) {
        liftedCellsIndices = [];
        currentKeyDir = null;
    }
    if (!isGenerate4Mode) {
        isDrawingManualLine = false;
        manualDrawStartCell = null;
        manualDrawCells = [];
    }
    updateGenerate4UiState();
}

function updateGenerate4UiState() {
    const showGenerate4Tools = !!isGenerate4Mode;
    el.generate4Tools?.classList.toggle('hidden', !showGenerate4Tools);
    el.btnPatternSeed?.classList.toggle('hidden', !showGenerate4Tools);
    syncEyeButtonState();
}

function syncManualGridInputs(cols, rows) {
    if (el.manualGridCols) {
        el.manualGridCols.value = String(clampInt(cols, 4, 40, 18));
    }
    if (el.manualGridRows) {
        el.manualGridRows.value = String(clampInt(rows, 4, 40, 26));
    }
    if (el.customGridCols) {
        el.customGridCols.value = String(clampInt(cols, 4, 40, 18));
    }
    if (el.customGridRows) {
        el.customGridRows.value = String(clampInt(rows, 4, 40, 26));
    }
}

function readManualGridSize(fallbackCols, fallbackRows) {
    const colsSource = el.customGridCols?.value || el.manualGridCols?.value || fallbackCols;
    const rowsSource = el.customGridRows?.value || el.manualGridRows?.value || fallbackRows;
    return {
        cols: clampInt(Number(colsSource), 4, 40, fallbackCols),
        rows: clampInt(Number(rowsSource), 4, 40, fallbackRows)
    };
}

function updateDimensionUi(config = null) {
    const mode = `${el.dimensionMode?.value || 'rows'}`.toLowerCase();
    const isCustom = mode === 'custom';
    el.customGridFields?.classList.toggle('hidden', !isCustom);
    if (el.dimensionValue) {
        el.dimensionValue.disabled = isCustom;
    }
    if (!config) return;
    const ratioText = `固定比例：430:664（宽高比约 0.648，行列比约 1:1.544）`;
    if (el.gameFramePreviewMeta) {
        el.gameFramePreviewMeta.textContent = `${config.gridCols} x ${config.gridRows} · 外框 420 x 750 · ${ratioText}`;
    }
}

function updateGameFramePreview(config) {
    if (!el.previewBoardFrame || !el.previewCanvasHost) return;
    const gameContainerHeight = GAME_DESIGN_HEIGHT - GAME_HEADER_HEIGHT;
    const wrapperWidth = GAME_DESIGN_WIDTH - GAME_CONTENT_PAD_X * 2;
    const wrapperHeight = gameContainerHeight - GAME_CANVAS_TOP_GAP - GAME_HUD_BOTTOM_HEIGHT;
    const grid = new Grid(config.gridCols, config.gridRows);
    grid.resize(wrapperWidth, wrapperHeight);
    const gridWidth = grid.cols * grid.cellSize;
    const gridHeight = grid.rows * grid.cellSize;
    const scale = Math.min(
        gridWidth / PREVIEW_CANVAS_BASE_WIDTH,
        gridHeight / PREVIEW_CANVAS_BASE_HEIGHT
    );
    const canvasWidth = Math.max(1, Math.round(PREVIEW_CANVAS_BASE_WIDTH * scale));
    const canvasHeight = Math.max(1, Math.round(PREVIEW_CANVAS_BASE_HEIGHT * scale));
    const canvasLeft = Math.round((wrapperWidth - canvasWidth) / 2);
    const canvasTop = Math.round((wrapperHeight - canvasHeight) / 2);

    el.previewBoardFrame.style.left = `${(GAME_CONTENT_PAD_X / GAME_DESIGN_WIDTH) * 100}%`;
    el.previewBoardFrame.style.top = `${((GAME_HEADER_HEIGHT + GAME_CANVAS_TOP_GAP) / GAME_DESIGN_HEIGHT) * 100}%`;
    el.previewBoardFrame.style.width = `${(wrapperWidth / GAME_DESIGN_WIDTH) * 100}%`;
    el.previewBoardFrame.style.height = `${(wrapperHeight / GAME_DESIGN_HEIGHT) * 100}%`;

    el.previewCanvasHost.style.left = `${(canvasLeft / wrapperWidth) * 100}%`;
    el.previewCanvasHost.style.top = `${(canvasTop / wrapperHeight) * 100}%`;
    el.previewCanvasHost.style.width = `${(canvasWidth / wrapperWidth) * 100}%`;
    el.previewCanvasHost.style.height = `${(canvasHeight / wrapperHeight) * 100}%`;

    if (el.canvas.width !== PREVIEW_CANVAS_BASE_WIDTH || el.canvas.height !== PREVIEW_CANVAS_BASE_HEIGHT) {
        el.canvas.width = PREVIEW_CANVAS_BASE_WIDTH;
        el.canvas.height = PREVIEW_CANVAS_BASE_HEIGHT;
    }
}

function createPreviewGrid(cols, rows) {
    const grid = new Grid(cols, rows);
    grid.resize(PREVIEW_CANVAS_BASE_WIDTH, PREVIEW_CANVAS_BASE_HEIGHT);
    return grid;
}

function buildEmptyRenderedLevelData(gridCols, gridRows) {
    return {
        gridCols,
        gridRows,
        lines: [],
        generatorVersion: 6
    };
}

function loadLevelState() {
    const level = getLevel();
    const levelLabel = formatLevelLabel(level);
    const base = getBaseLevelConfig(level);
    const saved = normalizeRecord(getSavedLevelRecord(level));
    const preview = normalizeRecord(getPreviewLevelRecord(level));
    const record = saved;
    const settings = record?.settings || buildStoredSettings(base, {
        dimensionMode: 'rows',
        dimensionValue: base.gridRows,
        minLen: base.minLen,
        maxLen: base.maxLen
    });

    const dimensionMode = ['rows', 'cols', 'custom'].includes(settings.dimensionMode)
        ? settings.dimensionMode
        : 'rows';
    el.dimensionMode.value = dimensionMode;
    el.dimensionValue.value = String(settings.dimensionValue);
    el.minLen.value = String(settings.minLen);
    el.maxLen.value = String(settings.maxLen);
    el.timerSeconds.value = String(settings.timerSeconds ?? base.timerSeconds ?? 0);
    el.misclickPenaltySeconds.value = String(settings.misclickPenaltySeconds ?? base.misclickPenaltySeconds ?? 1);
    if (el.rewardScorePerBodySegment) {
        el.rewardScorePerBodySegment.value = String(
            settings.rewardScorePerBodySegment
            ?? base.rewardScorePerBodySegment
            ?? 1000
        );
    }
    syncManualGridInputs(
        settings.customGridCols ?? settings.gridCols ?? base.gridCols,
        settings.customGridRows ?? settings.gridRows ?? base.gridRows
    );
    updateLevelDisplayNameField(level, settings.displayName || base.displayName || '');
    el.previewTitle.textContent = `预览 - ${levelLabel}`;
    previewRecord = record || null;
    renderedLevelData = record?.data ? cloneLevelData(record.data) : null;
    resetPreviewPlayState();

    if (record?.data) {
        drawPreviewState();
        setStatus(`已加载 ${levelLabel} 的已保存记录。`);
        drawStats(record);
    } else {
        clearCanvas();
        if (preview?.data) {
            setStatus(`${levelLabel} 暂无已保存记录。检测到旧预览数据但已忽略，请生成后点击“保存”。`);
        } else {
            setStatus(`${levelLabel} 暂无已保存记录。`);
        }
        drawStats(null);
    }

    updateDerived();
    setGenerateProgress(0, '就绪');
    
    // Reset edit modes on level change
    setGenerateMode('normal');
    isPathVisible = false;
    activeHamiltonianPath = null;
    syncEyeButtonState();
}

function normalizeRecord(record) {
    if (!record?.data) {
        return null;
    }
    if ((record.data.generatorVersion || 0) < 5) {
        return null;
    }
    return record;
}

function collectConfig() {
    const level = getLevel();
    const base = getBaseLevelConfig(level);
    const displayName = isRewardLevel(level)
        ? (el.levelDisplayName?.value || '')
        : '';
    const selectedDimensionMode = `${el.dimensionMode.value || 'rows'}`.toLowerCase();
    const shouldUseCustomGrid = isGenerate4Mode || selectedDimensionMode === 'custom';
    const manualSize = readManualGridSize(base.gridCols, base.gridRows);
    const settings = buildStoredSettings(base, {
        dimensionMode: shouldUseCustomGrid ? 'custom' : selectedDimensionMode,
        dimensionValue: Number(el.dimensionValue.value || 0),
        customGridCols: manualSize.cols,
        customGridRows: manualSize.rows,
        minLen: Number(el.minLen.value || 0),
        maxLen: Number(el.maxLen.value || 0),
        timerSeconds: Number(el.timerSeconds.value || 0),
        misclickPenaltySeconds: Number(el.misclickPenaltySeconds.value || 0),
        rewardScorePerBodySegment: Number(el.rewardScorePerBodySegment?.value || 0),
        displayName
    });
    return {
        settings,
        config: applyStoredSettings(base, settings)
    };
}

function updateDerived() {
    const { config } = collectConfig();
    updateDimensionUi(config);
    updateGameFramePreview(config);
    el.gridText.textContent = `${config.gridCols} x ${config.gridRows}`;
    el.lineText.textContent = String(estimateLineCount(config.gridCols, config.gridRows, config.minLen, config.maxLen));

    const cov = previewRecord?.stats
        ? Math.round((previewRecord.stats.coveredCells / previewRecord.stats.totalCells) * 100)
        : 0;
    el.coverageText.textContent = `${cov}%`;
    drawPreviewState();
}

function buildLevelDataSignature(levelData) {
    if (!levelData?.lines || !Array.isArray(levelData.lines)) {
        return '';
    }

    return levelData.lines
        .map((line) => {
            const cells = Array.isArray(line.cells) ? line.cells : [];
            const tail = cells[0] || {};
            const head = cells[cells.length - 1] || {};
            const len = cells.length || 0;
            return `${tail.col ?? -1},${tail.row ?? -1}>${head.col ?? -1},${head.row ?? -1}:${len}:${line.direction ?? ''}`;
        })
        .join('|');
}

function tryGenerateMode3Record(config, settings, avoidSignature = '') {
    let lastError = null;
    let sameSignatureFallback = null;
    const retryCount = 6;

    for (let retry = 0; retry < retryCount; retry++) {
        try {
            const record = buildPlayableLevelRecord(config, settings, 3);
            const signature = buildLevelDataSignature(record.data);
            const result = {
                record,
                usedConfig: config,
                usedSettings: settings
            };

            if (!avoidSignature || signature !== avoidSignature) {
                return result;
            }

            if (!sameSignatureFallback) {
                sameSignatureFallback = result;
            }
        } catch (error) {
            lastError = error;
        }
    }

    if (sameSignatureFallback) {
        return sameSignatureFallback;
    }

    throw (lastError || new Error('Mode 3 generation failed.'));
}

async function onGenerate(mode = 1) {
    if (isGenerating) {
        return;
    }
    isGenerating = true;
    setButtonsDisabled(true);

    const level = getLevel();
    const levelLabel = formatLevelLabel(level);
    const { config, settings } = collectConfig();
    setGenerateMode('normal');
    const previousSignature = mode === 3 ? buildLevelDataSignature(renderedLevelData) : '';
    try {
        setGenerateProgress(8, `Preparing ${levelLabel}...`);
        await nextFrame();

        setGenerateProgress(26, 'Building path graph...');
        await nextFrame();

        setGenerateProgress(54, 'Solving and validating...');
        if (mode === 3) {
            const result = tryGenerateMode3Record(config, settings, previousSignature);
            previewRecord = result.record;
        } else {
            previewRecord = buildPlayableLevelRecord(config, settings, mode);
        }

        setGenerateProgress(78, 'Applying preview state...');
        renderedLevelData = cloneLevelData(previewRecord.data);
        resetPreviewPlayState();
        await nextFrame();

        setGenerateProgress(92, 'Finalizing preview...');

        drawPreviewState();
        drawStats(previewRecord);
        updateDerived();
        setGenerateProgress(100, 'Done');
        const modeLabel = mode === 3 ? 'bent' : 'straight';
        setStatus(`${levelLabel} 已生成到内存预览。点击“保存”后才会持久化。模式=${mode} (${modeLabel})。`);
    } catch (error) {
        setGenerateProgress(0, 'Generation failed');
        setStatus(`生成失败：${error?.message || '未知错误'}`);
    } finally {
        setButtonsDisabled(false);
        isGenerating = false;
    }
}

async function onGenerate2() {
    if (isGenerating) return;
    const { config } = collectConfig();
    setGenerateMode('generate2');
    syncManualGridInputs(config.gridCols, config.gridRows);
    renderedLevelData = buildEmptyRenderedLevelData(config.gridCols, config.gridRows);
    previewRecord = null;
    resetPreviewPlayState();
    
    setStatus('正在生成哈密顿路径...');
    activeHamiltonianPath = buildWeavePath(config.gridCols, config.gridRows);
    
    drawPreviewState();
    setStatus('Generate2 模式：按住右键刷选，再按 ASDW 创建箭头。右键可翻转。');
}

function onGenerate4() {
    if (isGenerating) return;
    setGenerateMode('generate4');

    const { config } = collectConfig();
    syncManualGridInputs(config.gridCols, config.gridRows);
    renderedLevelData = buildEmptyRenderedLevelData(config.gridCols, config.gridRows);
    previewRecord = null;
    activeHamiltonianPath = null;
    liftedCellsIndices = [];
    isPathVisible = false;
    isErasing = false;
    isRightMouseDown = false;
    isDrawingManualLine = false;
    manualDrawStartCell = null;
    manualDrawCells = [];
    resetPreviewPlayState();
    drawPreviewState();
    updateDerived();
    syncEyeButtonState();
    setStatus('Generate4 模式：已启用自由编辑。左键拖拽绘制箭头，右键擦除。');
}

function onGenerate4GridInputChange() {
    if (!isGenerate4Mode) {
        return;
    }
    const { config } = collectConfig();
    syncManualGridInputs(config.gridCols, config.gridRows);
    updateDerived();
}

function onApplyGenerate4GridSize() {
    if (!isGenerate4Mode) {
        setStatus('请先切换到 Generate4 模式。');
        return;
    }
    const { config } = collectConfig();
    syncManualGridInputs(config.gridCols, config.gridRows);
    renderedLevelData = buildEmptyRenderedLevelData(config.gridCols, config.gridRows);
    previewRecord = null;
    activeHamiltonianPath = null;
    liftedCellsIndices = [];
    isPathVisible = false;
    isDrawingManualLine = false;
    manualDrawStartCell = null;
    manualDrawCells = [];
    resetPreviewPlayState();
    drawPreviewState();
    updateDerived();
    syncEyeButtonState();
    setStatus(`Generate4 网格已应用：${config.gridCols} x ${config.gridRows}。`);
}

function onGenerate4Pattern() {
    if (!isGenerate4Mode) {
        setStatus('图案生成功能仅在 Generate4 模式可用。');
        return;
    }
    const { config, settings } = collectConfig();
    syncManualGridInputs(config.gridCols, config.gridRows);

    const recipes = [buildGenerate4RayPattern, buildGenerate4SpiralPattern];
    const startIndex = Math.floor(Math.random() * recipes.length);
    let selected = null;
    for (let step = 0; step < recipes.length; step++) {
        const recipe = recipes[(startIndex + step) % recipes.length];
        const candidate = recipe(config);
        if (candidate && Array.isArray(candidate.lines) && candidate.lines.length > 0) {
            selected = candidate;
            break;
        }
    }

    if (!selected) {
        setStatus('按当前网格/长度设置无法生成有效图案。');
        return;
    }

    renderedLevelData = {
        gridCols: config.gridCols,
        gridRows: config.gridRows,
        lines: selected.lines,
        path: selected.path || null,
        generatorVersion: 6
    };
    activeHamiltonianPath = selected.path || null;
    if (!activeHamiltonianPath) {
        isPathVisible = false;
    }
    liftedCellsIndices = [];
    syncEyeButtonState();
    previewRecord = {
        settings,
        data: cloneLevelData(renderedLevelData),
        stats: {
            lineCount: renderedLevelData.lines.length,
            coveredCells: countCoveredCells(renderedLevelData.lines),
            totalCells: renderedLevelData.gridCols * renderedLevelData.gridRows
        },
        updatedAt: new Date().toISOString()
    };
    resetPreviewPlayState();
    drawPreviewState();
    drawStats(previewRecord);
    updateDerived();
    setStatus(`Generate4 图案已就绪：${selected.name}，线条数 ${selected.lines.length}。`);
}

function buildGenerate4RayPattern(config) {
    const gridCols = clampInt(config.gridCols, 4, 40, 18);
    const gridRows = clampInt(config.gridRows, 4, 40, 26);
    const minLen = clampInt(config.minLen, 2, 999, 2);
    const maxLen = clampInt(config.maxLen, minLen, 999, minLen);
    const centerRow = Math.floor((gridRows - 1) / 2);
    const maxDistance = Math.max(1, Math.max(centerRow, gridRows - 1 - centerRow));
    const segments = [];

    for (let row = 0; row < gridRows; row++) {
        const distance = Math.abs(row - centerRow);
        const ratio = 1 - (distance / maxDistance);
        const span = clampInt(
            Math.round(gridCols * (0.34 + ratio * 0.66)),
            2,
            gridCols,
            gridCols
        );
        if (span < minLen) {
            continue;
        }

        const startCol = Math.floor((gridCols - span) / 2);
        const endCol = startCol + span - 1;
        const cells = [];

        if (row % 2 === 0) {
            for (let col = startCol; col <= endCol; col++) {
                cells.push({ col, row });
            }
        } else {
            for (let col = endCol; col >= startCol; col--) {
                cells.push({ col, row });
            }
        }
        segments.push(cells);
    }

    if (segments.length === 0) {
        for (let col = 0; col < gridCols; col++) {
            const cells = [];
            if (col % 2 === 0) {
                for (let row = 0; row < gridRows; row++) {
                    cells.push({ col, row });
                }
            } else {
                for (let row = gridRows - 1; row >= 0; row--) {
                    cells.push({ col, row });
                }
            }
            segments.push(cells);
        }
    }

    const lines = buildGenerate4LinesFromSegments(segments, minLen, maxLen, config.colors);
    if (!lines.length) {
        return null;
    }
    return {
        name: 'Center Rays',
        lines,
        path: null
    };
}

function buildGenerate4SpiralPattern(config) {
    const gridCols = clampInt(config.gridCols, 4, 40, 18);
    const gridRows = clampInt(config.gridRows, 4, 40, 26);
    const minLen = clampInt(config.minLen, 2, 999, 2);
    const maxLen = clampInt(config.maxLen, minLen, 999, minLen);
    const spiralPath = buildGenerate4SpiralPath(gridCols, gridRows);
    const segments = splitGenerate4SegmentByLength(spiralPath, minLen, maxLen);
    const lines = buildGenerate4LinesFromSegments(segments, minLen, maxLen, config.colors);

    if (!lines.length) {
        return null;
    }
    return {
        name: 'Spiral Burst',
        lines,
        path: spiralPath
    };
}

function buildGenerate4SpiralPath(gridCols, gridRows) {
    const path = [];
    let left = 0;
    let right = gridCols - 1;
    let top = 0;
    let bottom = gridRows - 1;

    while (left <= right && top <= bottom) {
        for (let col = left; col <= right; col++) {
            path.push({ col, row: top });
        }
        top += 1;

        for (let row = top; row <= bottom; row++) {
            path.push({ col: right, row });
        }
        right -= 1;

        if (top <= bottom) {
            for (let col = right; col >= left; col--) {
                path.push({ col, row: bottom });
            }
            bottom -= 1;
        }

        if (left <= right) {
            for (let row = bottom; row >= top; row--) {
                path.push({ col: left, row });
            }
            left += 1;
        }
    }

    return path;
}

function buildGenerate4LinesFromSegments(segments, minLen, maxLen, palette) {
    const colors = Array.isArray(palette) && palette.length ? palette : ['#1a1c3c'];
    const lines = [];
    const occupiedCells = new Set();

    for (const rawSegment of segments) {
        if (!Array.isArray(rawSegment) || rawSegment.length < minLen) {
            continue;
        }

        const chunks = splitGenerate4SegmentByLength(rawSegment, minLen, maxLen);
        for (const chunk of chunks) {
            if (!Array.isArray(chunk) || chunk.length < minLen) {
                continue;
            }

            const duplicated = chunk.some((cell) => occupiedCells.has(`${cell.col},${cell.row}`));
            if (duplicated) {
                continue;
            }

            const lineId = lines.length;
            for (const cell of chunk) {
                occupiedCells.add(`${cell.col},${cell.row}`);
            }

            lines.push({
                id: lineId,
                cells: chunk.map((cell) => ({ col: cell.col, row: cell.row })),
                direction: inferDirectionFromCells(chunk),
                color: colors[lineId % colors.length],
                zIndex: lineId
            });
        }
    }

    return lines;
}

function splitGenerate4SegmentByLength(segment, minLen, maxLen) {
    const total = Array.isArray(segment) ? segment.length : 0;
    if (total < minLen) {
        return [];
    }

    const plan = partitionGenerate4Lengths(total, minLen, maxLen);
    if (!plan.length) {
        return [];
    }

    const chunks = [];
    let cursor = 0;
    for (const length of plan) {
        chunks.push(segment.slice(cursor, cursor + length));
        cursor += length;
    }
    return chunks;
}

function partitionGenerate4Lengths(total, minLen, maxLen) {
    const maxTake = Math.max(minLen, maxLen);
    const dp = new Array(total + 1).fill(null);
    dp[0] = [];

    for (let length = 1; length <= total; length++) {
        for (let take = Math.min(maxTake, length); take >= minLen; take--) {
            const prev = dp[length - take];
            if (!prev) {
                continue;
            }
            dp[length] = [...prev, take];
            break;
        }
    }

    return dp[total] || [];
}

function onKeyDown(e) {
    if (e.repeat) return; // Critical: Ignore auto-repeated key events from OS
    const key = e.key.toLowerCase();
    let dir = null;
    if (key === 'w') dir = 'up';
    else if (key === 'a') dir = 'left';
    else if (key === 's') dir = 'down';
    else if (key === 'd') dir = 'right';

    if (dir && isGenerate2Mode && isRightMouseDown) {
        currentKeyDir = dir;
        finishLifting(); // Trigger generation immediately on key press if right mouse is down
    }
}

// Find nearest cell ID in Hamiltonian Path within pixel radius
function findNearestPathCell(point, radius) {
    if (!activeHamiltonianPath || !previewPlayState) return -1;
    let minD = radius * radius;
    let bestIdx = -1;
    for (let i = 0; i < activeHamiltonianPath.length; i++) {
        const p = activeHamiltonianPath[i];
        const screenP = previewPlayState.grid.gridToScreen(p.col, p.row);
        const d2 = (point.x - screenP.x)**2 + (point.y - screenP.y)**2;
        if (d2 < minD) {
            minD = d2;
            bestIdx = i;
        }
    }
    return bestIdx;
}

let lastMousePos = null; // Track mouse global pos for instant trigger

function onKeyUp(e) {
    // We no longer trigger creation on keyup if we use the "KB during MouseDown" mode
    // currentKeyDir = null;
    // drawPreviewState();
}

function finishLifting() {
    if (liftedCellsIndices.length < 2) return;
    
    // Convert indices to a segment
    const segment = liftedCellsIndices.map(idx => activeHamiltonianPath[idx]);
    
    // Direction Check
    const finalDir = inferDirectionFromCells(segment);
    if (finalDir !== currentKeyDir) {
        setStatus(`方向不匹配：路径段方向为 ${finalDir}，你按下的是 ${currentKeyDir}。`);
        return;
    }

    const { config } = collectConfig();
    if (segment.length < config.minLen || segment.length > config.maxLen) {
        setStatus(`长度不合法：当前 ${segment.length} 格，要求 ${config.minLen}-${config.maxLen} 格。`);
        return;
    }

    // Check occupation
    const isOccupied = segment.some(s => findLineByCell(renderedLevelData, s.col, s.row));
    if (isOccupied) {
        setStatus('目标区域已被占用。');
        return;
    }

    // Create Line
    const colors = config.colors?.length ? config.colors : ['#1a1c3c'];
    const lineId = renderedLevelData.lines.length;
    const newLine = {
        id: lineId,
        cells: segment,
        direction: currentKeyDir,
        color: colors[lineId % colors.length],
        zIndex: lineId
    };
    
    renderedLevelData.lines.push(newLine);
    
    // Save
    const settings = collectConfig().settings;
    previewRecord = {
        settings,
        data: cloneLevelData(renderedLevelData),
        stats: {
            lineCount: renderedLevelData.lines.length,
            coveredCells: countCoveredCells(renderedLevelData.lines),
            totalCells: renderedLevelData.gridCols * renderedLevelData.gridRows
        },
        updatedAt: new Date().toISOString()
    };
    drawStats(previewRecord);
    resetPreviewPlayState();
    drawPreviewState();
    setStatus(`已成功刷出一条箭头。当前总线条：${renderedLevelData.lines.length}`);
}

function onRestPreview() {
    if (!renderedLevelData) {
        setStatus('暂无预览数据，请先生成。');
        return;
    }
    resetPreviewPlayState();
    drawPreviewState();
    setStatus('预览已重置。左键试玩，右键翻转。');
}

function onHint() {
    console.log('Hint button clicked'); // debug only
    try {
        if (!previewPlayState) {
            setStatus('暂无预览数据，请先点击“生成”。');
            return;
        }

        setStatus('正在检查可移动箭头...');
        
        const movableLines = previewPlayState.lines.filter((line) => {
            if (line.state !== 'active') return false;
            return canMove(line, previewPlayState.lines, previewPlayState.grid).canMove;
        });

        if (movableLines.length === 0) {
            setStatus('当前状态下没有可移动箭头。');
            return;
        }

        // Highlight them
        // Highlight them
        for (const line of movableLines) {
            line.isHighlighted = true;
        }
        console.log("Movable Arrow IDs:", movableLines.map(l => l.id));
        drawPreviewState();
        setStatus(`已高亮 ${movableLines.length} 条可移动箭头，持续 4 秒。`);

        // Clear highlight after 4 seconds
        if (window._hintTimeout) clearTimeout(window._hintTimeout);
        window._hintTimeout = setTimeout(() => {
            for (const line of movableLines) {
                line.isHighlighted = false;
            }
            drawPreviewState();
            setStatus('提示已清除。');
        }, 4000);
    } catch (err) {
        console.error('Hint error:', err);
        setStatus(`提示失败：${err.message}`);
    }
}

async function onSave() {
    const level = getLevel();
    const levelLabel = formatLevelLabel(level);
    if (!previewRecord && !renderedLevelData) {
        await onGenerate();
        if (!previewRecord && !renderedLevelData) {
            return;
        }
    }

    const recordToSave = buildRecordForSave();
    if (!recordToSave) {
        setStatus(`${levelLabel} 没有可保存的有效预览数据。`);
        return;
    }

    previewRecord = recordToSave;
    const [previewOk, savedOk] = await Promise.all([
        savePreviewLevelRecord(level, recordToSave),
        saveSavedLevelRecord(level, recordToSave)
    ]);
    if (savedOk && previewOk) {
        setStatus(`${levelLabel} 已永久保存到本地文件，游戏将优先读取该记录。`);
    } else {
        setStatus(`${levelLabel} 仅保存到浏览器缓存（磁盘同步不可用）。`);
    }
}

function buildRecordForSave() {
    const { settings } = collectConfig();
    const sourceData = previewRecord?.data || renderedLevelData;
    if (!sourceData) {
        return null;
    }

    const data = cloneLevelData(sourceData);
    const lines = Array.isArray(data.lines) ? data.lines : [];
    const totalCells = Math.max(0, Number(data.gridCols || 0) * Number(data.gridRows || 0));
    const fallbackStats = {
        lineCount: lines.length,
        coveredCells: countCoveredCells(lines),
        totalCells
    };

    return {
        ...(previewRecord || {}),
        settings,
        data,
        stats: previewRecord?.stats || fallbackStats,
        updatedAt: new Date().toISOString()
    };
}

async function onReset() {
    const level = getLevel();
    const levelLabel = formatLevelLabel(level);
    const [previewDeleted, savedDeleted] = await Promise.all([
        deletePreviewLevelRecord(level),
        deleteSavedLevelRecord(level)
    ]);
    previewRecord = null;
    renderedLevelData = null;
    previewPlayState = null;
    loadLevelState();
    if (previewDeleted && savedDeleted) {
        setStatus(`${levelLabel} 已重置并从本地文件删除。`);
    } else {
        setStatus(`${levelLabel} 仅在浏览器缓存中重置（磁盘同步不可用）。`);
    }
}

function onCanvasMouseDown(event) {
    const point = getCanvasPoint(event);
    if (event.button === 2) {
        if (isGenerate4Mode) {
            const cell = previewPlayState?.grid?.screenToGrid(point.x, point.y);
            if (!cell) return;
            const targetLine = findLineByCell(renderedLevelData, cell.col, cell.row);
            if (!targetLine) return;
            isErasing = true;
            isRightMouseDown = true;
            rightMouseDownTime = Date.now();
            rightMouseDownPos = point;
            deleteLine(targetLine.id);
            return;
        }

        // Right Click: Check if clicking on an arrow to Erase
        const targetCell = previewPlayState?.grid?.screenToGrid(point.x, point.y);
        const targetLine = targetCell
            ? findLineByCell(renderedLevelData, targetCell.col, targetCell.row)
            : null;
        
        if (targetLine && isPathVisible) {
            isErasing = true;
            isRightMouseDown = true;
            rightMouseDownTime = Date.now();
            rightMouseDownPos = point;
            
            // Delete immediately
            deleteLine(targetLine.id);
            return;
        }

        // Potential Flip OR Start Brushing
        if (isGenerate2Mode && activeHamiltonianPath && isPathVisible) {
            isRightMouseDown = true;
            rightMouseDownTime = Date.now();
            rightMouseDownPos = point;
            liftedCellsIndices = [];
            
            const nearestIdx = findNearestPathCell(point, 40);
            if (nearestIdx !== -1) {
                liftedCellsIndices.push(nearestIdx);
                drawPreviewState();
            }
        } else {
            onCanvasFlip(event);
        }
        return;
    }
    if (event.button === 0) {
        if (isGenerate4Mode) {
            const cell = previewPlayState?.grid?.screenToGrid(point.x, point.y);
            if (!cell) return;
            isDrawingManualLine = true;
            manualDrawStartCell = { col: cell.col, row: cell.row };
            manualDrawCells = [{ col: cell.col, row: cell.row }];
            drawPreviewState();
            return;
        }
        onCanvasPlay(event);
    }
}

function onCanvasMouseUp(event) {
    if (event.button === 0 && isGenerate4Mode && isDrawingManualLine) {
        finalizeGenerate4ManualLine();
        return;
    }

    if (event.button === 2 && isRightMouseDown) {
        if (isGenerate4Mode) {
            isRightMouseDown = false;
            isErasing = false;
            return;
        }
        const point = getCanvasPoint(event);
        const duration = Date.now() - rightMouseDownTime;
        const dist = Math.hypot(point.x - rightMouseDownPos.x, point.y - rightMouseDownPos.y);
        
        // Threshold for a "click" vs "drag" - only flip if NOT erasing
        if (duration < 300 && dist < 10 && !isErasing) {
            // It's a click: Trigger flip
            onCanvasFlip(event);
        }

        // Finalize state
        isRightMouseDown = false;
        isErasing = false;
        liftedCellsIndices = [];
        currentKeyDir = null;
        drawPreviewState();
    }
}

function deleteLine(lineId) {
    if (!renderedLevelData) return;
    const idx = renderedLevelData.lines.findIndex(l => l.id === lineId);
    if (idx !== -1) {
        renderedLevelData.lines.splice(idx, 1);
        updatePreviewRecord();
        resetPreviewPlayState();
        drawPreviewState();
        setStatus(`已删除线条 ${lineId}。`);
    }
}

function updatePreviewRecord() {
    const { settings } = collectConfig();
    previewRecord = {
        settings,
        data: cloneLevelData(renderedLevelData),
        stats: {
            lineCount: renderedLevelData.lines.length,
            coveredCells: countCoveredCells(renderedLevelData.lines),
            totalCells: renderedLevelData.gridCols * renderedLevelData.gridRows
        },
        updatedAt: new Date().toISOString()
    };
    drawStats(previewRecord);
}

function onCanvasMouseMove(event) {
    const point = getCanvasPoint(event);
    lastMousePos = point; // Update for keydown trigger

    if (isGenerate4Mode) {
        if (isDrawingManualLine) {
            updateGenerate4ManualDraft(point);
            return;
        }
        if (isErasing && isRightMouseDown) {
            const cell = previewPlayState?.grid?.screenToGrid(point.x, point.y);
            if (!cell) return;
            const targetLine = findLineByCell(renderedLevelData, cell.col, cell.row);
            if (targetLine) {
                deleteLine(targetLine.id);
            }
        }
        return;
    }

    if (isErasing && isRightMouseDown) {
        const cell = previewPlayState?.grid?.screenToGrid(point.x, point.y);
        if (cell) {
            const targetLine = findLineByCell(renderedLevelData, cell.col, cell.row);
            if (targetLine) {
                deleteLine(targetLine.id);
            }
        }
        if (!isGenerate2Mode || !activeHamiltonianPath) {
            return;
        }
    }

    if (!isGenerate2Mode || !isRightMouseDown || !activeHamiltonianPath) return;
    if (isErasing) {
        return;
    }
    
    if (!isPathVisible) return; // Mode check
    
    // Nearest search instead of strict grid snap
    const pathIdx = findNearestPathCell(point, 50); 
    if (pathIdx === -1) return;
    
    if (liftedCellsIndices.length === 0) {
        liftedCellsIndices.push(pathIdx);
        drawPreviewState();
    } else {
        const lastIdx = liftedCellsIndices[liftedCellsIndices.length - 1];
        if (pathIdx === lastIdx) return;

        // Backtrack / Undo logic
        if (liftedCellsIndices.length >= 2 && pathIdx === liftedCellsIndices[liftedCellsIndices.length - 2]) {
            liftedCellsIndices.pop();
            drawPreviewState();
            return;
        }

        // Forward / Auto-complete logic - INCREASED DISTANCE (50)
        const dist = Math.abs(pathIdx - lastIdx);
        if (dist >= 1 && dist <= 50) { 
            const step = (pathIdx > lastIdx) ? 1 : -1;
            let current = lastIdx + step;
            while (true) {
                if (!liftedCellsIndices.includes(current)) {
                    liftedCellsIndices.push(current);
                }
                if (current === pathIdx) break;
                current += step;
            }
            drawPreviewState();
        }
    }
}

function updateGenerate4ManualDraft(point) {
    if (!isDrawingManualLine || !previewPlayState?.grid) {
        return;
    }
    const cell = previewPlayState.grid.screenToGrid(point.x, point.y);
    if (!cell) {
        return;
    }
    manualDrawCells = extendGenerate4ManualPath(
        manualDrawCells,
        { col: cell.col, row: cell.row }
    );
    drawPreviewState();
}

function extendGenerate4ManualPath(pathCells, nextCell) {
    const path = Array.isArray(pathCells)
        ? pathCells.map((cell) => ({
            col: Math.round(Number(cell?.col) || 0),
            row: Math.round(Number(cell?.row) || 0)
        }))
        : [];
    const target = {
        col: Math.round(Number(nextCell?.col) || 0),
        row: Math.round(Number(nextCell?.row) || 0)
    };
    if (path.length === 0) {
        return [target];
    }

    const last = path[path.length - 1];
    if (last.col === target.col && last.row === target.row) {
        return path;
    }

    const bridge = buildGenerate4ManualBridge(path, target);
    for (const cell of bridge) {
        const existingIndex = path.findIndex((item) => item.col === cell.col && item.row === cell.row);
        if (existingIndex >= 0) {
            if (existingIndex === path.length - 2) {
                path.pop();
                continue;
            }
            path.length = existingIndex + 1;
            continue;
        }
        path.push(cell);
    }
    return path;
}

function buildGenerate4ManualBridge(path, target) {
    const last = path[path.length - 1];
    const prev = path.length >= 2 ? path[path.length - 2] : null;
    const dx = target.col - last.col;
    const dy = target.row - last.row;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const hasPrev = !!prev;
    const prevHorizontal = hasPrev ? (prev.row === last.row) : false;
    const preferHorizontal = hasPrev ? prevHorizontal : (absDx >= absDy);
    const cells = [];
    let col = last.col;
    let row = last.row;

    const pushStep = (nextCol, nextRow) => {
        col = nextCol;
        row = nextRow;
        cells.push({ col, row });
    };

    if (preferHorizontal) {
        const stepX = dx >= 0 ? 1 : -1;
        for (let i = 0; i < absDx; i++) {
            pushStep(col + stepX, row);
        }
        const stepY = dy >= 0 ? 1 : -1;
        for (let i = 0; i < absDy; i++) {
            pushStep(col, row + stepY);
        }
    } else {
        const stepY = dy >= 0 ? 1 : -1;
        for (let i = 0; i < absDy; i++) {
            pushStep(col, row + stepY);
        }
        const stepX = dx >= 0 ? 1 : -1;
        for (let i = 0; i < absDx; i++) {
            pushStep(col + stepX, row);
        }
    }

    return cells;
}

function finalizeGenerate4ManualLine() {
    const segment = Array.isArray(manualDrawCells) ? manualDrawCells.map((cell) => ({ ...cell })) : [];
    isDrawingManualLine = false;
    manualDrawStartCell = null;
    manualDrawCells = [];

    if (segment.length < 2) {
        drawPreviewState();
        return;
    }

    appendGenerate4ManualLine(segment);
}

function appendGenerate4ManualLine(segment) {
    if (!renderedLevelData) {
        return;
    }

    const { config } = collectConfig();
    if (segment.length < config.minLen || segment.length > config.maxLen) {
        setStatus(`长度不合法：当前 ${segment.length} 格，要求 ${config.minLen}-${config.maxLen} 格。`);
        drawPreviewState();
        return;
    }

    const isOccupied = segment.some((cell) => findLineByCell(renderedLevelData, cell.col, cell.row));
    if (isOccupied) {
        setStatus('目标区域已被占用。');
        drawPreviewState();
        return;
    }

    const colors = config.colors?.length ? config.colors : ['#1a1c3c'];
    const lineId = renderedLevelData.lines.length;
    renderedLevelData.lines.push({
        id: lineId,
        cells: segment.map((cell) => ({ col: cell.col, row: cell.row })),
        direction: inferDirectionFromCells(segment),
        color: colors[lineId % colors.length],
        zIndex: lineId
    });

    updatePreviewRecord();
    resetPreviewPlayState();
    drawPreviewState();
    setStatus(`Generate4：已新增线条 ${lineId}。当前总线条：${renderedLevelData.lines.length}。`);
}

function onCanvasGenerate2Click(event) {
    if (!activeHamiltonianPath) return;
    const point = getCanvasPoint(event);
    const cell = previewPlayState.grid.screenToGrid(point.x, point.y);
    if (!cell) return;

    // Find cell in path
    const pathIdx = activeHamiltonianPath.findIndex(p => p.col === cell.col && p.row === cell.row);
    if (pathIdx === -1) return;

    // We want to slice a segment from the path that ends at this cell
    // and has the requested direction.
    // However, the requested direction currentKeyDir is the DESIRED head direction.
    // The path is a fixed sequence. Let's find if the path segment leading to pathIdx
    // or starting from pathIdx matches the direction.
    
    // Easier approach: Just find a sequence of cells in the path and Force transform them.
    // Real logic: Find a segment of length [minLen, maxLen] that includes pathIdx
    // and whose END matches currentKeyDir (in reverse sense, since the path is Hamiltonian)
    
    const { config } = collectConfig();
    const minLen = config.minLen;
    const maxLen = config.maxLen;
    
    // Precise selection: The clicked cell MUST be the HEAD of the arrow.
    // We look BACKWARDS in the path (or forwards if needed) to build the tail.
    
    // Helper to try building a line ending at pathIdx
    const tryBuildAt = (targetIdx, searchForward) => {
        for (let len = maxLen; len >= minLen; len--) {
            let segment;
            if (searchForward) {
                // Clicking pathIdx, but we want it to be the head, so tail is pathIdx+1...
                const start = targetIdx;
                const end = targetIdx + len - 1;
                if (end >= activeHamiltonianPath.length) continue;
                segment = activeHamiltonianPath.slice(start, end + 1).reverse();
            } else {
                // Clicking pathIdx, tail is pathIdx-1...
                const start = targetIdx - len + 1;
                const end = targetIdx;
                if (start < 0) continue;
                segment = activeHamiltonianPath.slice(start, end + 1);
            }
            
            if (inferDirectionFromCells(segment) === currentKeyDir) {
                return segment;
            }
        }
        return null;
    };

    let segment = tryBuildAt(pathIdx, false) || tryBuildAt(pathIdx, true);

    if (!segment) {
        setStatus(`无法在该位置按路径创建 ${currentKeyDir} 方向箭头。`);
        return;
    }

    // Check if any cell in segment is already occupied by an existing line
    const isOccupied = segment.some(s => findLineByCell(renderedLevelData, s.col, s.row));
    if (isOccupied) {
        setStatus('目标区域已被占用。');
        return;
    }

    // Create the line
    const colors = config.colors?.length ? config.colors : ['#1a1c3c'];
    const lineId = renderedLevelData.lines.length;
    const newLine = {
        id: lineId,
        cells: segment,
        direction: currentKeyDir,
        color: colors[lineId % colors.length],
        zIndex: lineId
    };
    
    renderedLevelData.lines.push(newLine);
    
    // Update preview state
    const settings = collectConfig().settings;
    previewRecord = {
        settings,
        data: cloneLevelData(renderedLevelData),
        stats: {
            lineCount: renderedLevelData.lines.length,
            coveredCells: countCoveredCells(renderedLevelData.lines),
            totalCells: renderedLevelData.gridCols * renderedLevelData.gridRows
        },
        updatedAt: new Date().toISOString()
    };
    resetPreviewPlayState();
    drawPreviewState();
    setStatus(`已添加 ${currentKeyDir} 方向箭头。当前总线条：${renderedLevelData.lines.length}`);
}

function onCanvasFlip(event) {
    if (!renderedLevelData?.lines?.length) {
        setStatus('暂无可编辑的预览数据，请先生成。');
        return;
    }

    const point = getCanvasPoint(event);
    const grid = new Grid(renderedLevelData.gridCols, renderedLevelData.gridRows);
    grid.resize(el.canvas.width, el.canvas.height);
    const cell = grid.screenToGrid(point.x, point.y);
    if (!cell) {
        setStatus('点击位置不在网格内。');
        return;
    }

    const target = findLineByCell(renderedLevelData, cell.col, cell.row);
    if (!target) {
        setStatus(`格子 (${cell.col}, ${cell.row}) 上没有线条。`);
        return;
    }

    const lineData = renderedLevelData.lines.find((item) => item.id === target.id);
    if (!lineData || !Array.isArray(lineData.cells) || lineData.cells.length < 2) {
        return;
    }

    lineData.cells = [...lineData.cells].reverse();
    lineData.direction = inferDirectionFromCells(lineData.cells);

    const settings = previewRecord?.settings || collectConfig().settings;
    previewRecord = {
        settings,
        data: cloneLevelData(renderedLevelData),
        stats: {
            lineCount: renderedLevelData.lines.length,
            coveredCells: countCoveredCells(renderedLevelData.lines),
            totalCells: renderedLevelData.gridCols * renderedLevelData.gridRows
        },
        updatedAt: new Date().toISOString()
    };
    syncPlayStateLine(lineData.id, lineData.cells, lineData.direction);

    drawPreviewState();
    drawStats(previewRecord);
    updateDerived();
    setStatus(`已翻转线条 ${target.id}，当前改动尚未保存。`);
}

function onCanvasPlay(event) {
    if (!previewPlayState) {
        setStatus('暂无预览状态，请先生成。');
        return;
    }

    const point = getCanvasPoint(event);
    const clickedLine = findTopLineAtPoint(previewPlayState, point.x, point.y);
    if (!clickedLine) {
        setStatus('该位置没有可选中的线条。');
        return;
    }

    const result = canMove(clickedLine, previewPlayState.lines, previewPlayState.grid);
    if (result.canMove) {
        previewPlayState.grid.unregisterLine(clickedLine);
        clickedLine.state = 'removed';
        drawPreviewState();

        const remaining = previewPlayState.lines.filter((line) => line.state === 'active').length;
        if (remaining === 0) {
            setStatus('预览已清空，点击“重置预览”可再次试玩。');
        } else {
            setStatus(`已清除线条 ${clickedLine.id}，剩余：${remaining}`);
        }
    } else {
        setStatus(`线条 ${clickedLine.id} 当前不可移动，需要出口空间。`);
    }
}

function setStatus(text) {
    el.status.textContent = text;
}

function setGenerateProgress(percent, text) {
    if (el.genProgressFill) {
        el.genProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
    if (el.genProgressText) {
        el.genProgressText.textContent = text;
    }
}

function setButtonsDisabled(disabled) {
    el.btnGenerate.disabled = disabled;
    el.btnRestPreview.disabled = disabled;
    el.btnHint.disabled = disabled;
    el.btnSave.disabled = disabled;
    el.btnReset.disabled = disabled;
}

function drawStats(record) {
    el.stats.innerHTML = '';
    if (!record?.stats) {
        pushStat('格子覆盖：0 / 0');
        pushStat('线条数量：0');
        pushStat('计时器：关闭');
        pushStat('误触惩罚：1秒');
        pushStat('更新时间：-');
        return;
    }
    const total = record.stats.totalCells;
    const covered = record.stats.coveredCells;
    const pct = Math.round((covered / total) * 100);
    if (record.settings?.displayName) {
        pushStat(`关卡名称：${record.settings.displayName}`);
    }
    pushStat(`系统：v6.0 | 覆盖率：${pct}%`);
    pushStat(`线条数量：${record.stats.lineCount}`);
    pushStat(`计时器：${formatSeconds(record.settings?.timerSeconds ?? 0)}`);
    pushStat(`误触惩罚：${formatPenaltySeconds(record.settings?.misclickPenaltySeconds ?? 1)}`);
    pushStat(`更新时间：${formatTime(record.updatedAt)}`);
}

function pushStat(text) {
    const li = document.createElement('li');
    li.textContent = text;
    el.stats.appendChild(li);
}

function clearCanvas() {
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);
}

function drawLevel(levelData) {
    const grid = createPreviewGrid(levelData.gridCols, levelData.gridRows);
    const lines = deserializeLevelData(levelData);

    clearCanvas();
    drawDots(grid);
    for (const line of lines) {
        line.draw(ctx, grid);
    }
}

function resetPreviewPlayState() {
    if (!renderedLevelData) {
        previewPlayState = null;
        return;
    }
    const grid = createPreviewGrid(renderedLevelData.gridCols, renderedLevelData.gridRows);
    const lines = deserializeLevelData(renderedLevelData).map((line) => {
        line.state = 'active';
        return line;
    });
    for (const line of lines) {
        grid.registerLine(line);
    }
    
    // Sync activeHamiltonianPath from data (for both Generate and Generate2 modes)
    if (renderedLevelData.path) {
        activeHamiltonianPath = renderedLevelData.path;
    } else if (!isGenerate2Mode) {
        activeHamiltonianPath = null;
    }

    previewPlayState = { grid, lines };
    console.log("Solvability Engine V5.0 - High Density Mode + Path Sync");
}

function syncPlayStateLine(lineId, cells, direction) {
    if (!previewPlayState?.lines?.length) {
        return;
    }
    const line = previewPlayState.lines.find((item) => item.id === lineId);
    if (!line) {
        return;
    }
    line.cells = cells.map((cell) => ({ col: cell.col, row: cell.row }));
    line.headCell = line.cells[line.cells.length - 1];
    line.direction = direction;
}

function drawPreviewState() {
    if (!previewPlayState) {
        clearCanvas();
        return;
    }
    clearCanvas();
    drawDots(previewPlayState.grid);
    
    // Draw Hamiltonian Path if visibility is ON and path exists
    // (Now works for both normal Generate and Generate2)
    if (activeHamiltonianPath && isPathVisible) {
        drawHamiltonianPath(previewPlayState.grid, activeHamiltonianPath, liftedCellsIndices);
    }

    const drawLines = previewPlayState.lines
        .filter((line) => line.state === 'active')
        .sort((a, b) => a.zIndex - b.zIndex);
    for (const line of drawLines) {
        line.draw(ctx, previewPlayState.grid);
    }

    if (isGenerate4Mode && Array.isArray(manualDrawCells) && manualDrawCells.length > 0) {
        drawGenerate4ManualDraft(previewPlayState.grid, manualDrawCells);
    }
}

function drawGenerate4ManualDraft(grid, cells) {
    if (!grid || !Array.isArray(cells) || cells.length === 0) {
        return;
    }

    const points = cells.map((cell) => grid.gridToScreen(cell.col, cell.row));
    const dashA = Math.max(4, grid.cellSize * 0.4);
    const dashB = Math.max(3, grid.cellSize * 0.24);

    ctx.save();
    ctx.strokeStyle = 'rgba(21, 24, 40, 0.68)';
    ctx.lineWidth = Math.max(2, grid.cellSize * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([dashA, dashB]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const tail = points[points.length - 1];
    ctx.fillStyle = 'rgba(21, 24, 40, 0.88)';
    ctx.beginPath();
    ctx.arc(tail.x, tail.y, Math.max(2, grid.cellSize * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawHamiltonianPath(grid, path, highlightIndices = []) {
    if (!path || path.length < 2) return;
    
    // Draw Base Path
    ctx.strokeStyle = '#cccccc'; // Lighter base
    ctx.lineWidth = 2;
    ctx.beginPath();
    let start = grid.gridToScreen(path[0].col, path[0].row);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < path.length; i++) {
        const p = grid.gridToScreen(path[i].col, path[i].row);
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Draw Highlight ("Brushed" section)
    if (highlightIndices.length > 0) {
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (highlightIndices.length === 1) {
            // Draw a dot if only 1 cell is selected
            const p = grid.gridToScreen(path[highlightIndices[0]].col, path[highlightIndices[0]].row);
            ctx.beginPath();
            ctx.arc(p.x, p.y, grid.cellSize * 0.35, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Draw segment
            ctx.beginPath();
            ctx.lineWidth = 6;
            const p0 = grid.gridToScreen(path[highlightIndices[0]].col, path[highlightIndices[0]].row);
            ctx.moveTo(p0.x, p0.y);
            for (let i = 1; i < highlightIndices.length; i++) {
                const p = grid.gridToScreen(path[highlightIndices[i]].col, path[highlightIndices[i]].row);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        // Draw Length Label at mouse position or last point
        const lastIdx = highlightIndices[highlightIndices.length - 1];
        const lastCell = path[lastIdx];
        const gridPos = grid.gridToScreen(lastCell.col, lastCell.row);
        
        // Use lastMousePos if available for real-time tracking, otherwise fallback to grid point
        const labelPos = lastMousePos || gridPos;
        
        ctx.save();
        ctx.font = '14px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        const text = String(highlightIndices.length);
        let yOffset = -15; // Adjusted for smaller font
        
        // Boundary check: if text goes above canvas, show it below the cursor
        if (labelPos.y + yOffset < 20) {
            yOffset = 25; // Show below the cursor
        }
        
        // Text Shadow/Background for readability
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3; // Reduced for smaller font
        ctx.strokeText(text, labelPos.x, labelPos.y + yOffset);
        
        ctx.fillStyle = '#000000';
        ctx.fillText(text, labelPos.x, labelPos.y + yOffset);
        ctx.restore();
    }
}

function findLineByCell(levelData, col, row) {
    const lines = [...(levelData.lines || [])].sort((a, b) => (b.zIndex ?? b.id) - (a.zIndex ?? a.id));
    for (const line of lines) {
        for (const cell of line.cells || []) {
            if (cell.col === col && cell.row === row) {
                return line;
            }
        }
    }
    return null;
}

function findTopLineAtPoint(state, x, y) {
    const threshold = state.grid.cellSize * 0.26;
    const headThreshold = state.grid.cellSize * 0.4;
    const activeLines = state.lines
        .filter((line) => line.state === 'active')
        .sort((a, b) => b.zIndex - a.zIndex);

    for (const line of activeLines) {
        const points = line.getScreenPoints(state.grid);
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
    return null;
}

function getCanvasPoint(event) {
    const rect = el.canvas.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) * el.canvas.width) / rect.width,
        y: ((event.clientY - rect.top) * el.canvas.height) / rect.height
    };
}

function inferDirectionFromCells(cells) {
    if (!cells || cells.length < 2) {
        return 'right';
    }
    const prev = cells[cells.length - 2];
    const head = cells[cells.length - 1];
    const dx = head.col - prev.col;
    const dy = head.row - prev.row;
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'down' : 'up';
}

function countCoveredCells(lines) {
    const cells = new Set();
    for (const line of lines) {
        for (const cell of line.cells || []) {
            cells.add(`${cell.col},${cell.row}`);
        }
    }
    return cells.size;
}

function cloneLevelData(levelData) {
    return JSON.parse(JSON.stringify(levelData));
}

function syncEyeButtonState() {
    const eyeOpen = el.togglePath?.querySelector('.eye-open');
    const eyeClosed = el.togglePath?.querySelector('.eye-closed');
    if (!eyeOpen || !eyeClosed) {
        return;
    }
    eyeOpen.style.display = isPathVisible ? 'block' : 'none';
    eyeClosed.style.display = isPathVisible ? 'none' : 'block';
}

function onTogglePath() {
    if (isGenerate4Mode) {
        const hasHelperPath = Array.isArray(activeHamiltonianPath) && activeHamiltonianPath.length > 1;
        if (!hasHelperPath) {
            isPathVisible = false;
            syncEyeButtonState();
            drawPreviewState();
            setStatus('Generate4 当前没有辅助路径，请先点击花形按钮生成图案。');
            return;
        }

        isPathVisible = !isPathVisible;
        syncEyeButtonState();
        drawPreviewState();
        setStatus(isPathVisible ? 'Generate4 辅助路径已显示。' : 'Generate4 辅助路径已隐藏。');
        return;
    }

    if (!isPathVisible && (!isGenerate2Mode || !activeHamiltonianPath)) {
        const { config } = collectConfig();
        setGenerateMode('generate2');
        activeHamiltonianPath = buildWeavePath(config.gridCols, config.gridRows);
        if (
            !renderedLevelData
            || renderedLevelData.gridCols !== config.gridCols
            || renderedLevelData.gridRows !== config.gridRows
        ) {
            renderedLevelData = buildEmptyRenderedLevelData(config.gridCols, config.gridRows);
            previewRecord = null;
        }
        resetPreviewPlayState();
    }

    isPathVisible = !isPathVisible;
    syncEyeButtonState();
    drawPreviewState();
    setStatus(isPathVisible ? '辅助模式已开启：哈密顿路径可见。' : '普通模式：辅助路径已隐藏。');
}
function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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

function drawDots(grid) {
    ctx.fillStyle = '#ececf4';
    for (let row = 0; row <= grid.rows; row++) {
        for (let col = 0; col <= grid.cols; col++) {
            const x = grid.offsetX + col * grid.cellSize;
            const y = grid.offsetY + row * grid.cellSize;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function formatTime(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) {
        return '-';
    }
    return d.toLocaleString();
}

function formatSeconds(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    if (seconds <= 0) {
        return '关闭';
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs.toString().padStart(2, '0')}秒`;
}

function formatPenaltySeconds(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    if (seconds <= 0) {
        return '0秒（关闭）';
    }
    return `${seconds}秒`;
}

function clampInt(value, min, max, fallback) {
    const parsed = Math.round(Number(value));
    const base = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, base));
}



import { Grid } from './grid.js?v=40';
import { canMove } from './collision.js?v=40';
import { getBaseLevelConfig } from './levels.js?v=40';
import { buildPlayableLevelRecord, buildWeavePath, DIR_VEC, OPPOSITE } from './level-builder.js?v=48';
import {
    applyStoredSettings,
    buildStoredSettings,
    deletePreviewLevelRecord,
    deleteSavedLevelRecord,
    deserializeLevelData,
    estimateLineCount,
    getPreviewLevelRecord,
    getSavedLevelRecord,
    initLevelStorage,
    savePreviewLevelRecord,
    saveSavedLevelRecord
} from './level-storage.js?v=47';

const el = {
    levelSelect: document.getElementById('levelSelect'),
    dimensionMode: document.getElementById('dimensionMode'),
    dimensionValue: document.getElementById('dimensionValue'),
    minLen: document.getElementById('minLen'),
    maxLen: document.getElementById('maxLen'),
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
    btnRestPreview: document.getElementById('btnRestPreview'),
    btnHint: document.getElementById('btnHint'),
    btnSave: document.getElementById('btnSave'),
    btnReset: document.getElementById('btnReset'),
    togglePath: document.getElementById('togglePath')
};

const ctx = el.canvas.getContext('2d');
let previewRecord = null;
let renderedLevelData = null;
let previewPlayState = null;
let isGenerating = false;
let isGenerate2Mode = false;
let activeHamiltonianPath = null;
let currentKeyDir = null; // up, down, left, right
let isLifting = false;
let isRightMouseDown = false;
let isErasing = false; // NEW: Track if we are in erasing mode
let liftedCellsIndices = []; // Indices in activeHamiltonianPath
let rightMouseDownTime = 0;
let rightMouseDownPos = null;
let isPathVisible = true; // NEW: Toggle for Hamiltonian Path visibility

init().catch((error) => {
    console.error(error);
    setStatus(`Admin init failed: ${error?.message || 'unknown error'}`);
});

async function init() {
    await initLevelStorage();

    for (let i = 1; i <= 30; i++) {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = `Level ${i}`;
        el.levelSelect.appendChild(option);
    }
    el.levelSelect.value = '3';

    el.levelSelect.addEventListener('change', loadLevelState);
    el.dimensionMode.addEventListener('change', updateDerived);
    el.dimensionValue.addEventListener('input', updateDerived);
    el.minLen.addEventListener('input', updateDerived);
    el.maxLen.addEventListener('input', updateDerived);

    el.btnGenerate.addEventListener('click', () => onGenerate(3));
    el.btnGenerate2.addEventListener('click', onGenerate2);
    el.btnGenerate3.addEventListener('click', () => onGenerate(1));
    el.btnRestPreview.addEventListener('click', onRestPreview);
    el.btnHint.addEventListener('click', onHint);
    el.btnSave.addEventListener('click', onSave);
    el.btnReset.addEventListener('click', onReset);
    el.togglePath.addEventListener('click', onTogglePath);
    el.canvas.addEventListener('mousedown', onCanvasMouseDown);
    el.canvas.addEventListener('mouseup', onCanvasMouseUp);
    el.canvas.addEventListener('mousemove', onCanvasMouseMove);
    el.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    loadLevelState();
}

function getLevel() {
    return Number(el.levelSelect.value || 1);
}

function loadLevelState() {
    const level = getLevel();
    const base = getBaseLevelConfig(level);
    const saved = normalizeRecord(getSavedLevelRecord(level));
    const preview = normalizeRecord(getPreviewLevelRecord(level));
    const record = preview || saved;
    const settings = record?.settings || buildStoredSettings(base, {
        dimensionMode: 'rows',
        dimensionValue: base.gridRows,
        minLen: base.minLen,
        maxLen: base.maxLen
    });

    el.dimensionMode.value = settings.dimensionMode;
    el.dimensionValue.value = String(settings.dimensionValue);
    el.minLen.value = String(settings.minLen);
    el.maxLen.value = String(settings.maxLen);
    el.previewTitle.textContent = `Preview - Level ${level}`;
    previewRecord = preview || null;
    renderedLevelData = record?.data ? cloneLevelData(record.data) : null;
    resetPreviewPlayState();

    if (record?.data) {
        drawPreviewState();
        setStatus(`Loaded ${preview ? 'preview' : 'saved'} record for level ${level}.`);
        drawStats(record);
    } else {
        clearCanvas();
        setStatus(`No generated record for level ${level}.`);
        drawStats(null);
    }

    updateDerived();
    setGenerateProgress(0, 'Ready');
    
    // Reset Edit Modes on Level Change
    isGenerate2Mode = false;
    isPathVisible = false;
    activeHamiltonianPath = null;
    const eyeOpen = el.togglePath.querySelector('.eye-open');
    const eyeClosed = el.togglePath.querySelector('.eye-closed');
    eyeOpen.style.display = 'none';
    eyeClosed.style.display = 'block';
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
    const base = getBaseLevelConfig(getLevel());
    const settings = buildStoredSettings(base, {
        dimensionMode: el.dimensionMode.value,
        dimensionValue: Number(el.dimensionValue.value || 0),
        minLen: Number(el.minLen.value || 0),
        maxLen: Number(el.maxLen.value || 0)
    });
    return {
        settings,
        config: applyStoredSettings(base, settings)
    };
}

function updateDerived() {
    const { config } = collectConfig();
    el.gridText.textContent = `${config.gridCols} x ${config.gridRows}`;
    el.lineText.textContent = String(estimateLineCount(config.gridCols, config.gridRows, config.minLen, config.maxLen));

    const cov = previewRecord?.stats
        ? Math.round((previewRecord.stats.coveredCells / previewRecord.stats.totalCells) * 100)
        : 0;
    el.coverageText.textContent = `${cov}%`;
}

async function onGenerate(mode = 1) {
    if (isGenerating) {
        return;
    }
    isGenerating = true;
    setButtonsDisabled(true);

    const level = getLevel();
    const { config, settings } = collectConfig();
    try {
        setGenerateProgress(8, `Preparing level ${level}...`);
        await nextFrame();

        setGenerateProgress(26, 'Building path graph...');
        await nextFrame();

        setGenerateProgress(54, 'Solving and validating...');
        previewRecord = buildPlayableLevelRecord(config, settings, mode);

        setGenerateProgress(78, 'Applying preview state...');
        renderedLevelData = cloneLevelData(previewRecord.data);
        resetPreviewPlayState();
        await nextFrame();

        setGenerateProgress(92, 'Saving local records...');
        const [previewOk, savedOk] = await Promise.all([
            savePreviewLevelRecord(level, previewRecord),
            saveSavedLevelRecord(level, previewRecord)
        ]);

        drawPreviewState();
        drawStats(previewRecord);
        updateDerived();
        setGenerateProgress(100, 'Done');
        const modeLabel = mode === 3 ? 'bent' : 'straight';
        if (previewOk && savedOk) {
            setStatus(`Level ${level} generated and persisted to local files. Mode=${mode} (${modeLabel}).`);
        } else {
            setStatus(`Level ${level} generated, but disk sync is unavailable. Saved to browser cache only. Mode=${mode} (${modeLabel}).`);
        }
    } catch (error) {
        setGenerateProgress(0, 'Generation failed');
        setStatus(`Generate failed: ${error?.message || 'unknown error'}`);
    } finally {
        setButtonsDisabled(false);
        isGenerating = false;
    }
}

async function onGenerate2() {
    if (isGenerating) return;
    const { config } = collectConfig();
    isGenerate2Mode = true;
    renderedLevelData = {
        gridCols: config.gridCols,
        gridRows: config.gridRows,
        lines: [],
        generatorVersion: 6
    };
    previewRecord = null;
    resetPreviewPlayState();
    
    setStatus('Generating Hamiltonian Path...');
    activeHamiltonianPath = buildWeavePath(config.gridCols, config.gridRows);
    
    drawPreviewState();
    setStatus('Generate2 Mode: Hold Right Mouse Button to brush, then press ASDW to create an arrow. Right click to flip.');
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
        setStatus(`Invalid direction! Path segment leads ${finalDir}, but you held ${currentKeyDir}.`);
        return;
    }

    const { config } = collectConfig();
    if (segment.length < config.minLen || segment.length > config.maxLen) {
        setStatus(`Invalid length! Segment is ${segment.length} cells, need ${config.minLen}-${config.maxLen}.`);
        return;
    }

    // Check occupation
    const isOccupied = segment.some(s => findLineByCell(renderedLevelData, s.col, s.row));
    if (isOccupied) {
        setStatus('Space already occupied.');
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
    const level = getLevel();
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
    savePreviewLevelRecord(level, previewRecord);
    drawStats(previewRecord);
    resetPreviewPlayState();
    drawPreviewState();
    setStatus(`Successfully "brushed" an arrow. Total lines: ${renderedLevelData.lines.length}`);
}

function onRestPreview() {
    if (!renderedLevelData) {
        setStatus('No preview data. Generate first.');
        return;
    }
    resetPreviewPlayState();
    drawPreviewState();
    setStatus('Preview reset. Left click to play, right click to flip.');
}

function onHint() {
    console.log('Hint button clicked'); // 仅供调试
    try {
        if (!previewPlayState) {
            setStatus('�?No preview data. Click "Generate" first.');
            return;
        }

        setStatus('🔍 Checking for movable arrows...');
        
        const movableLines = previewPlayState.lines.filter((line) => {
            if (line.state !== 'active') return false;
            return canMove(line, previewPlayState.lines, previewPlayState.grid).canMove;
        });

        if (movableLines.length === 0) {
            setStatus('⚠️ No movable arrows found in current state.');
            return;
        }

        // Highlight them
        // Highlight them
        for (const line of movableLines) {
            line.isHighlighted = true;
        }
        console.log("Movable Arrow IDs:", movableLines.map(l => l.id));
        drawPreviewState();
        setStatus(`�?Highlighted ${movableLines.length} movable arrow(s). It will last 4s.`);

        // Clear highlight after 4 seconds
        if (window._hintTimeout) clearTimeout(window._hintTimeout);
        window._hintTimeout = setTimeout(() => {
            for (const line of movableLines) {
                line.isHighlighted = false;
            }
            drawPreviewState();
            setStatus('Hint cleared.');
        }, 4000);
    } catch (err) {
        console.error('Hint error:', err);
        setStatus(`�?Hint failed: ${err.message}`);
    }
}

async function onSave() {
    const level = getLevel();
    if (!previewRecord) {
        await onGenerate();
        if (!previewRecord) {
            return;
        }
    }
    const savedOk = await saveSavedLevelRecord(level, previewRecord);
    if (savedOk) {
        setStatus(`Level ${level} saved permanently to local file. Game will load this record first.`);
    } else {
        setStatus(`Level ${level} saved to browser cache only (disk sync unavailable).`);
    }
}

async function onReset() {
    const level = getLevel();
    const [previewDeleted, savedDeleted] = await Promise.all([
        deletePreviewLevelRecord(level),
        deleteSavedLevelRecord(level)
    ]);
    previewRecord = null;
    renderedLevelData = null;
    previewPlayState = null;
    loadLevelState();
    if (previewDeleted && savedDeleted) {
        setStatus(`Level ${level} reset and removed from local files.`);
    } else {
        setStatus(`Level ${level} reset in browser cache only (disk sync unavailable).`);
    }
}

function onCanvasMouseDown(event) {
    const point = getCanvasPoint(event);
    if (event.button === 2) {
        // Right Click: Check if clicking on an arrow to Erase
        const targetLine = findLineByCell(renderedLevelData, 
            ...Object.values(previewPlayState.grid.screenToGrid(point.x, point.y) || {}));
        
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
        onCanvasPlay(event);
    }
}

function onCanvasMouseUp(event) {
    if (event.button === 2 && isRightMouseDown) {
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
        setStatus(`Deleted line ${lineId}.`);
    }
}

function updatePreviewRecord() {
    const level = getLevel();
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
    savePreviewLevelRecord(level, previewRecord);
    drawStats(previewRecord);
}

function onCanvasMouseMove(event) {
    const point = getCanvasPoint(event);
    lastMousePos = point; // Update for keydown trigger
    
    if (!isGenerate2Mode || !isRightMouseDown || !activeHamiltonianPath) return;

    if (isErasing) {
        const cell = previewPlayState.grid.screenToGrid(point.x, point.y);
        if (cell) {
            const targetLine = findLineByCell(renderedLevelData, cell.col, cell.row);
            if (targetLine) {
                deleteLine(targetLine.id);
            }
        }
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
        setStatus(`Cannot create ${currentKeyDir} arrow here using the path.`);
        return;
    }

    // Check if any cell in segment is already occupied by an existing line
    const isOccupied = segment.some(s => findLineByCell(renderedLevelData, s.col, s.row));
    if (isOccupied) {
        setStatus('Space already occupied.');
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
    const level = getLevel();
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
    savePreviewLevelRecord(level, previewRecord);
    resetPreviewPlayState();
    drawPreviewState();
    setStatus(`Added ${currentKeyDir} arrow. Total lines: ${renderedLevelData.lines.length}`);
}

function onCanvasFlip(event) {
    if (!renderedLevelData?.lines?.length) {
        setStatus('No preview data to edit. Generate first.');
        return;
    }

    const point = getCanvasPoint(event);
    const grid = new Grid(renderedLevelData.gridCols, renderedLevelData.gridRows);
    grid.resize(el.canvas.width, el.canvas.height);
    const cell = grid.screenToGrid(point.x, point.y);
    if (!cell) {
        setStatus('Clicked outside grid.');
        return;
    }

    const target = findLineByCell(renderedLevelData, cell.col, cell.row);
    if (!target) {
        setStatus(`No line at cell (${cell.col}, ${cell.row}).`);
        return;
    }

    const lineData = renderedLevelData.lines.find((item) => item.id === target.id);
    if (!lineData || !Array.isArray(lineData.cells) || lineData.cells.length < 2) {
        return;
    }

    lineData.cells = [...lineData.cells].reverse();
    lineData.direction = inferDirectionFromCells(lineData.cells);

    const level = getLevel();
    const base = getBaseLevelConfig(level);
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
    savePreviewLevelRecord(level, previewRecord);
    saveSavedLevelRecord(level, previewRecord);
    syncPlayStateLine(lineData.id, lineData.cells, lineData.direction);

    drawPreviewState();
    drawStats(previewRecord);
    updateDerived();
    setStatus(`Flipped line ${target.id}. Changes saved locally.`);
}

function onCanvasPlay(event) {
    if (!previewPlayState) {
        setStatus('No preview state. Generate first.');
        return;
    }

    const point = getCanvasPoint(event);
    const clickedLine = findTopLineAtPoint(previewPlayState, point.x, point.y);
    if (!clickedLine) {
        setStatus('No selectable line at this point.');
        return;
    }

    const result = canMove(clickedLine, previewPlayState.lines, previewPlayState.grid);
    if (result.canMove) {
        previewPlayState.grid.unregisterLine(clickedLine);
        clickedLine.state = 'removed';
        drawPreviewState();

        const remaining = previewPlayState.lines.filter((line) => line.state === 'active').length;
        if (remaining === 0) {
            setStatus('Preview cleared. Click restpreview to play again.');
        } else {
            setStatus(`Cleared line ${clickedLine.id}. Remaining: ${remaining}`);
        }
    } else {
        setStatus(`Blocked line ${clickedLine.id}. Need exit space.`);
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
        pushStat('Cells: 0 / 0');
        pushStat('Lines: 0');
        pushStat('Updated: -');
        return;
    }
    const total = record.stats.totalCells;
    const covered = record.stats.coveredCells;
    const pct = Math.round((covered / total) * 100);
    pushStat(`Sys: v6.0 | Pct: ${pct}%`);
    pushStat(`Lines: ${record.stats.lineCount}`);
    pushStat(`Updated: ${formatTime(record.updatedAt)}`);
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
    const grid = new Grid(levelData.gridCols, levelData.gridRows);
    grid.resize(el.canvas.width, el.canvas.height);
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
    const grid = new Grid(renderedLevelData.gridCols, renderedLevelData.gridRows);
    grid.resize(el.canvas.width, el.canvas.height);
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

function onTogglePath() {
    if (!isPathVisible) {
        // Turning ON: Auto-enable Generate2 mode if needed
        if (!isGenerate2Mode || !activeHamiltonianPath) {
            const { config } = collectConfig();
            isGenerate2Mode = true;
            activeHamiltonianPath = buildWeavePath(config.gridCols, config.gridRows);
            resetPreviewPlayState();
            setStatus('Helper mode enabled automatically. Path generated.');
        }
    }

    isPathVisible = !isPathVisible;
    const eyeOpen = el.togglePath.querySelector('.eye-open');
    const eyeClosed = el.togglePath.querySelector('.eye-closed');
    
    if (isPathVisible) {
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
        setStatus('Helper mode ON: Hamiltonian path visible.');
    } else {
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
        setStatus('Normal mode: Helper path hidden.');
    }
    
    drawPreviewState();
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

import { Line } from './line.js?v=19';

const OPPOSITE = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left'
};

const DIRS = ['up', 'down', 'left', 'right'];

const DIR_VEC = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};

export function generateLevel(config) {
    const {
        gridCols,
        gridRows,
        lineCount,
        maxTurns,
        colors,
        fillRatio = 0.84,
        minLen = 2,
        maxLen = 6,
        maxCellUsage = 1 // New rules work best with 1 usage
    } = config;

    // RULE 1 & 2: Pre-allocate Row/Column directions to prevent opposites
    // Row maps to horizontal (left/right or none), Column maps to vertical (up/down or none)
    const rowDirs = Array.from({ length: gridRows }, () => (Math.random() > 0.5 ? 'left' : 'right'));
    const colDirs = Array.from({ length: gridCols }, () => (Math.random() > 0.5 ? 'up' : 'down'));

    // Ensure all 4 directions exist
    if (!rowDirs.includes('left')) rowDirs[0] = 'left';
    if (!rowDirs.includes('right')) rowDirs[1 % gridRows] = 'right';
    if (!colDirs.includes('up')) colDirs[0] = 'up';
    if (!colDirs.includes('down')) colDirs[1 % gridCols] = 'down';

    const lines = [];
    const cellUsage = new Map();
    const headUsage = new Set();
    const totalCells = gridCols * gridRows;
    const targetUniqueCells = Math.min(totalCells, Math.floor(totalCells * fillRatio));

    // For better filling, we try multiple passes or more aggressive head selection
    let attempts = 0;
    while (getUniqueCellCount(cellUsage) < targetUniqueCells && lines.length < lineCount && attempts < 200) {
        attempts++;
        const options = [];
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const key = cellKey(c, r);
                if (headUsage.has(key) || (cellUsage.get(key) || 0) > 0) continue;
                
                // Only allow directions matching row/col pre-allocation
                options.push({ col: c, row: r, direction: rowDirs[r] });
                options.push({ col: c, row: r, direction: colDirs[c] });
            }
        }
        
        if (options.length === 0) break;
        shuffle(options);

        let created = null;
        for (const option of options) {
            // Check RULE 3: Path protection before creating
            if (!isSafeFromOppositeRay(option.col, option.row, option.direction, lines, gridCols, gridRows)) {
                continue;
            }

            created = tryCreateLine(
                lines.length,
                option.direction,
                option.col,
                option.row,
                gridCols,
                gridRows,
                cellUsage,
                headUsage,
                maxTurns,
                colors,
                minLen,
                maxLen,
                maxCellUsage
            );

            if (created) break;
        }

        if (created) {
            lines.push(created);
            for (const cell of created.cells) {
                increaseUsage(cellUsage, cellKey(cell.col, cell.row));
            }
            headUsage.add(cellKey(created.headCell.col, created.headCell.row));
        }
    }

    return lines;
}

// RULE 3: Ray/Body protection for opposite arrows
function isSafeFromOppositeRay(col, row, direction, existingLines, gridCols, gridRows) {
    const opp = OPPOSITE[direction];
    const vec = DIR_VEC[direction];
    
    // Check if what we are about to PLACE would point at an existing opposite body
    let r = row + vec.dy;
    let c = col + vec.dx;
    while (isInBounds(c, r, gridCols, gridRows)) {
        for (const line of existingLines) {
            if (line.direction === opp) {
                for (const cell of line.cells) {
                    if (cell.col === c && cell.row === r) return false;
                }
            }
        }
        c += vec.dx;
        r += vec.dy;
    }

    // Also check if any existing opposite arrow's ray points at us
    for (const line of existingLines) {
        if (line.direction === opp) {
            const lVec = DIR_VEC[line.direction];
            let lc = line.headCell.col + lVec.dx;
            let lr = line.headCell.row + lVec.dy;
            while (isInBounds(lc, lr, gridCols, gridRows)) {
                if (lc === col && lr === row) return false;
                lc += lVec.dx;
                lr += lVec.dy;
            }
        }
    }

    return true;
}

export function generateSafeLevel(config) {
    const {
        gridCols,
        gridRows,
        lineCount,
        maxTurns,
        colors,
        fillRatio = 0.72,
        minLen = 2,
        maxLen = 4
    } = config;

    const lines = [];
    const occupied = new Set();
    const blocked = new Set();
    const targetCells = Math.floor(gridCols * gridRows * Math.min(fillRatio, 0.68));
    const targetLines = Math.max(8, Math.min(lineCount, Math.ceil(targetCells / 3)));

    let idleRounds = 0;
    while (occupied.size < targetCells && lines.length < targetLines && idleRounds < 8) {
        const headOptions = collectSafeHeadOptions(gridCols, gridRows, occupied, blocked);
        if (headOptions.length === 0) {
            idleRounds++;
            continue;
        }

        shuffle(headOptions);
        let created = null;

        for (const option of headOptions) {
            created = tryCreateSafeLine(
                lines.length,
                option.direction,
                option.col,
                option.row,
                gridCols,
                gridRows,
                occupied,
                blocked,
                maxTurns,
                colors,
                Math.min(minLen, 2),
                Math.min(maxLen, 4)
            );

            if (created) break;
        }

        if (!created) {
            idleRounds++;
            continue;
        }

        idleRounds = 0;
        lines.push(created);
        for (const cell of created.cells) {
            occupied.add(cellKey(cell.col, cell.row));
        }
        for (const exitCell of created.getExitCells(gridCols, gridRows)) {
            blocked.add(cellKey(exitCell.col, exitCell.row));
        }
    }

    return lines;
}

function collectHeadOptions(gridCols, gridRows, cellUsage, headUsage) {
    const options = [];

    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            const key = cellKey(col, row);
            if (headUsage.has(key)) continue;
            if ((cellUsage.get(key) || 0) > 0) continue;

            for (const direction of DIRS) {
                if (hasClearExit(col, row, direction, gridCols, gridRows, cellUsage)) {
                    options.push({ col, row, direction });
                }
            }
        }
    }

    return options;
}

function collectSafeHeadOptions(gridCols, gridRows, occupied, blocked) {
    const options = [];

    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            const key = cellKey(col, row);
            if (occupied.has(key) || blocked.has(key)) continue;

            for (const direction of DIRS) {
                if (hasSafeExit(col, row, direction, gridCols, gridRows, occupied, blocked)) {
                    options.push({ col, row, direction });
                }
            }
        }
    }

    return options;
}

function hasClearExit(col, row, direction, gridCols, gridRows, cellUsage) {
    const vector = DIR_VEC[direction];
    let nextCol = col + vector.dx;
    let nextRow = row + vector.dy;

    while (isInBounds(nextCol, nextRow, gridCols, gridRows)) {
        if ((cellUsage.get(cellKey(nextCol, nextRow)) || 0) > 0) {
            return false;
        }
        nextCol += vector.dx;
        nextRow += vector.dy;
    }

    return true;
}

function hasSafeExit(col, row, direction, gridCols, gridRows, occupied, blocked) {
    const vector = DIR_VEC[direction];
    let nextCol = col + vector.dx;
    let nextRow = row + vector.dy;

    while (isInBounds(nextCol, nextRow, gridCols, gridRows)) {
        const key = cellKey(nextCol, nextRow);
        if (occupied.has(key) || blocked.has(key)) {
            return false;
        }
        nextCol += vector.dx;
        nextRow += vector.dy;
    }

    return true;
}

function tryCreateLine(
    id,
    direction,
    headCol,
    headRow,
    gridCols,
    gridRows,
    cellUsage,
    headUsage,
    maxTurns,
    colors,
    minLen,
    maxLen,
    maxCellUsage
) {
    const headKey = cellKey(headCol, headRow);
    if (headUsage.has(headKey) || (cellUsage.get(headKey) || 0) > 0) {
        return null;
    }

    const cells = [{ col: headCol, row: headRow }];
    const reserved = new Set([headKey]);
    let currentCol = headCol;
    let currentRow = headRow;
    let currentDir = OPPOSITE[direction];
    let turnsLeft = maxTurns;
    const desiredLength = randomInt(minLen, maxLen);

    for (let i = 1; i < desiredLength; i++) {
        const nextStep = chooseNextStep(
            currentCol,
            currentRow,
            currentDir,
            turnsLeft,
            gridCols,
            gridRows,
            reserved,
            cellUsage,
            maxCellUsage
        );
        if (!nextStep) break;

        currentCol = nextStep.col;
        currentRow = nextStep.row;
        currentDir = nextStep.direction;
        turnsLeft = nextStep.turnsLeft;

        cells.push({ col: currentCol, row: currentRow });
        reserved.add(cellKey(currentCol, currentRow));
    }

    if (cells.length < minLen) return null;

    cells.reverse();
    const line = new Line(id, cells, direction, colors[id % colors.length]);
    if (headUsage.has(cellKey(line.headCell.col, line.headCell.row))) {
        return null;
    }
    return line;
}

function tryCreateSafeLine(
    id,
    direction,
    headCol,
    headRow,
    gridCols,
    gridRows,
    occupied,
    blocked,
    maxTurns,
    colors,
    minLen,
    maxLen
) {
    const headKey = cellKey(headCol, headRow);
    if (occupied.has(headKey) || blocked.has(headKey)) {
        return null;
    }

    const cells = [{ col: headCol, row: headRow }];
    const reserved = new Set([headKey]);
    let currentCol = headCol;
    let currentRow = headRow;
    let currentDir = OPPOSITE[direction];
    let turnsLeft = Math.min(maxTurns, 3);
    const desiredLength = randomInt(minLen, maxLen);

    for (let i = 1; i < desiredLength; i++) {
        const nextStep = chooseSafeNextStep(
            currentCol,
            currentRow,
            currentDir,
            turnsLeft,
            gridCols,
            gridRows,
            reserved,
            occupied,
            blocked
        );
        if (!nextStep) break;

        currentCol = nextStep.col;
        currentRow = nextStep.row;
        currentDir = nextStep.direction;
        turnsLeft = nextStep.turnsLeft;
        cells.push({ col: currentCol, row: currentRow });
        reserved.add(cellKey(currentCol, currentRow));
    }

    if (cells.length < minLen) {
        return null;
    }

    cells.reverse();
    return new Line(id, cells, direction, colors[id % colors.length]);
}

function chooseNextStep(col, row, direction, turnsLeft, gridCols, gridRows, reserved, cellUsage, maxCellUsage) {
    const candidates = [];
    const straight = moveOne(col, row, direction);

    if (canOccupy(straight.col, straight.row, gridCols, gridRows, reserved, cellUsage, maxCellUsage)) {
        candidates.push({
            ...straight,
            direction,
            turnsLeft,
            weight: 2
        });
    }

    if (turnsLeft > 0) {
        const perpendicularDirs = direction === 'up' || direction === 'down'
            ? ['left', 'right']
            : ['up', 'down'];

        for (const nextDir of perpendicularDirs) {
            const turned = moveOne(col, row, nextDir);
            if (!canOccupy(turned.col, turned.row, gridCols, gridRows, reserved, cellUsage, maxCellUsage)) {
                continue;
            }

            candidates.push({
                ...turned,
                direction: nextDir,
                turnsLeft: turnsLeft - 1,
                weight: 2
            });
        }
    }

    if (candidates.length === 0) return null;
    return weightedPick(candidates);
}

function chooseSafeNextStep(col, row, direction, turnsLeft, gridCols, gridRows, reserved, occupied, blocked) {
    const candidates = [];
    const straight = moveOne(col, row, direction);

    if (canOccupySafe(straight.col, straight.row, gridCols, gridRows, reserved, occupied, blocked)) {
        candidates.push({
            ...straight,
            direction,
            turnsLeft,
            weight: 2
        });
    }

    if (turnsLeft > 0) {
        const perpendicularDirs = direction === 'up' || direction === 'down' ? ['left', 'right'] : ['up', 'down'];
        for (const nextDir of perpendicularDirs) {
            const turned = moveOne(col, row, nextDir);
            if (!canOccupySafe(turned.col, turned.row, gridCols, gridRows, reserved, occupied, blocked)) {
                continue;
            }

            candidates.push({
                ...turned,
                direction: nextDir,
                turnsLeft: turnsLeft - 1,
                weight: 2
            });
        }
    }

    if (candidates.length === 0) return null;
    return weightedPick(candidates);
}

function canOccupy(col, row, gridCols, gridRows, reserved, cellUsage, maxCellUsage) {
    if (!isInBounds(col, row, gridCols, gridRows)) return false;

    const key = cellKey(col, row);
    if (reserved.has(key)) return false;

    return (cellUsage.get(key) || 0) < maxCellUsage;
}

function canOccupySafe(col, row, gridCols, gridRows, reserved, occupied, blocked) {
    if (!isInBounds(col, row, gridCols, gridRows)) return false;
    const key = cellKey(col, row);
    if (reserved.has(key) || occupied.has(key) || blocked.has(key)) return false;
    return true;
}

function weightedPick(candidates) {
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const candidate of candidates) {
        roll -= candidate.weight;
        if (roll <= 0) return candidate;
    }

    return candidates[candidates.length - 1];
}

function moveOne(col, row, direction) {
    const vector = DIR_VEC[direction];
    return {
        col: col + vector.dx,
        row: row + vector.dy
    };
}

function isInBounds(col, row, gridCols, gridRows) {
    return col >= 0 && col < gridCols && row >= 0 && row < gridRows;
}

function increaseUsage(cellUsage, key) {
    cellUsage.set(key, (cellUsage.get(key) || 0) + 1);
}

function getUniqueCellCount(cellUsage) {
    return cellUsage.size;
}

function cellKey(col, row) {
    return `${col},${row}`;
}

function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
}

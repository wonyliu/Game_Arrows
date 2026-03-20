import { buildPlayableLevel, summarizeDirections } from '../js/level-builder.js';

const config = {
    level: 3,
    gridCols: 19,
    gridRows: 30,
    minLen: 2,
    maxLen: 6,
    colors: ['#1a1c3c']
};

function checkConflicts(lines) {
    const rowDirs = new Map(); // row -> Set of directions
    const colDirs = new Map(); // col -> Set of directions

    for (const line of lines) {
        const dir = line.direction;
        for (const cell of line.cells) {
            if (dir === 'left' || dir === 'right') {
                if (!rowDirs.has(cell.row)) rowDirs.set(cell.row, new Set());
                rowDirs.get(cell.row).add(dir);
            } else {
                if (!colDirs.has(cell.col)) colDirs.set(cell.col, new Set());
                colDirs.get(cell.col).add(dir);
            }
        }
    }

    const rowConflicts = [];
    for (const [row, dirs] of rowDirs.entries()) {
        if (dirs.has('left') && dirs.has('right')) {
            const linesInRow = lines.filter(l => l.cells.some(c => c.row === row) && (l.direction === 'left' || l.direction === 'right'));
            rowConflicts.push({ row, dirs: Array.from(dirs), lines: linesInRow.map(l => ({ id: l.id, dir: l.direction, cells: l.cells })) });
        }
    }

    const colConflicts = [];
    for (const [col, dirs] of colDirs.entries()) {
        if (dirs.has('up') && dirs.has('down')) {
            const linesInCol = lines.filter(l => l.cells.some(c => c.col === col) && (l.direction === 'up' || l.direction === 'down'));
            colConflicts.push({ col, dirs: Array.from(dirs), lines: linesInCol.map(l => ({ id: l.id, dir: l.direction, cells: l.cells })) });
        }
    }

    return { rowConflicts, colConflicts };
}

console.log("Testing 100 generations...");
let successCount = 0;
for (let i = 0; i < 100; i++) { 
    const { lines, path } = buildPlayableLevel(config);
    const { rowConflicts, colConflicts } = checkConflicts(lines);
    if (rowConflicts.length === 0 && colConflicts.length === 0) {
        successCount++;
    } else {
        console.log(`Generation ${i} failed:`);
        if (rowConflicts.length > 0) {
             console.log("  Row Conflict Details:");
             rowConflicts.forEach(c => {
                 console.log(`    Row ${c.row}: [${c.dirs}]`);
                 c.lines.forEach(l => console.log(`      Line ${l.id} [${l.dir}]: ${JSON.stringify(l.cells)}`));
             });
        }
        if (colConflicts.length > 0) {
             console.log("  Col Conflict Details:");
             colConflicts.forEach(c => {
                console.log(`    Col ${c.col}: [${c.dirs}]`);
                c.lines.forEach(l => console.log(`      Line ${l.id} [${l.dir}]: ${JSON.stringify(l.cells)}`));
             });
        }
        break; 
    }
}
console.log(`Success rate: ${successCount}/100`);

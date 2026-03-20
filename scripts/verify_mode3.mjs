import { buildPlayableLevel } from '../js/level-builder.js';

const config = {
    level: 3,
    gridCols: 19,
    gridRows: 30,
    minLen: 2,
    maxLen: 6,
    colors: ['#1a1c3c']
};

function checkAllEdgeConflicts(lines) {
    const rowDirs = new Map(); 
    const colDirs = new Map(); 

    for (const line of lines) {
        for (let i = 0; i < line.cells.length - 1; i++) {
            const c1 = line.cells[i];
            const c2 = line.cells[i+1];
            
            if (c1.row === c2.row) {
                const dir = c1.col < c2.col ? 'right' : 'left';
                if (!rowDirs.has(c1.row)) rowDirs.set(c1.row, new Set());
                rowDirs.get(c1.row).add(dir);
            } else {
                const dir = c1.row < c2.row ? 'down' : 'up';
                if (!colDirs.has(c1.col)) colDirs.set(c1.col, new Set());
                colDirs.get(c1.col).add(dir);
            }
        }
    }

    const rowErr = [];
    for (const [r, dirs] of rowDirs.entries()) if (dirs.size > 1) rowErr.push(r);
    const colErr = [];
    for (const [c, dirs] of colDirs.entries()) if (dirs.size > 1) colErr.push(c);

    return { rowConflicts: rowErr, colConflicts: colErr };
}

console.log("Verifying Mode 3 (Bent Arrows) - 100 iterations");
let success = 0;
for (let i = 0; i < 100; i++) {
    const { lines } = buildPlayableLevel(config, 3);
    const { rowConflicts, colConflicts } = checkAllEdgeConflicts(lines);
    if (rowConflicts.length === 0 && colConflicts.length === 0) {
        success++;
    } else {
        console.log(`[!] Failure in run ${i}: Rows: [${rowConflicts}], Cols: [${colConflicts}]`);
    }
}
console.log(`Final Result: ${success}/50`);

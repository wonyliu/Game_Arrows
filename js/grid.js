/**
 * Grid System - 绠＄悊2D缃戞牸鍧愭爣绯荤粺
 */
export class Grid {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.cellSize = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.occupancy = new Map(); // "col,row" -> Set<lineId>
    }

    resize(canvasWidth, canvasHeight) {
        const margin = 10;
        const availW = canvasWidth - margin * 2;
        const availH = canvasHeight - margin * 2;

        this.cellSize = Math.max(1, Math.floor(Math.min(availW / this.cols, availH / this.rows)));
        this.offsetX = Math.floor((canvasWidth - this.cols * this.cellSize) / 2);
        this.offsetY = Math.floor((canvasHeight - this.rows * this.cellSize) / 2);
    }

    gridToScreen(col, row) {
        return {
            x: this.offsetX + col * this.cellSize + this.cellSize / 2,
            y: this.offsetY + row * this.cellSize + this.cellSize / 2
        };
    }

    screenToGrid(x, y) {
        const col = Math.floor((x - this.offsetX) / this.cellSize);
        const row = Math.floor((y - this.offsetY) / this.cellSize);
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
        return { col, row };
    }

    isInBounds(col, row) {
        return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
    }

    cellKey(col, row) {
        return `${col},${row}`;
    }

    registerLine(line) {
        for (const cell of line.cells) {
            const key = this.cellKey(cell.col, cell.row);
            if (!this.occupancy.has(key)) this.occupancy.set(key, new Set());
            this.occupancy.get(key).add(line.id);
        }
    }

    unregisterLine(line) {
        for (const cell of line.cells) {
            const key = this.cellKey(cell.col, cell.row);
            if (this.occupancy.has(key)) {
                this.occupancy.get(key).delete(line.id);
            }
        }
    }

    getLinesAt(col, row) {
        const key = this.cellKey(col, row);
        return this.occupancy.get(key) || new Set();
    }

    clear() {
        this.occupancy.clear();
    }
}

export const DIR_VECTORS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};

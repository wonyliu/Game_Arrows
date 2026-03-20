/**
 * Collision - 核心遮挡检测与路径碰撞算法
 */

/**
 * 判断目标线条是否可以移动
 * @returns {{ canMove: boolean, reason: string|null }}
 */
export function canMove(targetLine, allLines, grid) {
    // 1. 层级压制检查：不需要，因为现在的管道是纯平面的，没有任何重叠

    // 2. 路径碰撞检查：沿箭头方向到屏幕边缘的路径上是否有其他 active 线条
    const exitCells = targetLine.getExitCells(grid.cols, grid.rows);
    let distance = 0;
    for (const cell of exitCells) {
        let isBlocked = false;
        const lineIds = grid.getLinesAt(cell.col, cell.row);
        for (const lineId of lineIds) {
            if (lineId === targetLine.id) continue;
            const otherLine = allLines.find(l => l.id === lineId);
            if (!otherLine || otherLine.state !== 'active') continue;
            isBlocked = true;
            break;
        }
        if (isBlocked) {
            return { canMove: false, reason: 'path_blocked', distance };
        }
        distance++;
    }

    return { canMove: true, reason: null, distance };
}

/**
 * 查找当前所有可移动的线条（用于 Hint 功能）
 */
export function findMovableLines(allLines, grid) {
    return allLines.filter(line =>
        line.state === 'active' && canMove(line, allLines, grid).canMove
    );
}

import { DIR_VECTORS } from './grid.js?v=40';
import { drawArrowPathPixels } from './pixel-art.js?v=21';

export class Line {
    constructor(id, cells, direction, color = '#1a1c3d') {
        this.id = id;
        this.cells = cells;
        this.direction = direction;
        this.color = color;
        this.state = 'active';
        this.zIndex = id;
        this.opacity = 1;
        this.headCell = cells[cells.length - 1];
        this.shakeAmount = 0;
        this.flashRed = 0;
        this.removeTint = null;
        this.trails = [];
        this.maxTrails = 5;
        this.currentRenderPts = [];
        this.isHighlighted = false;
        this.wiggleTime = Math.random() * Math.PI * 2;
        this.softPulse = 0;
        this.curiousRemaining = 0;
        this.headExpression = 'default';
    }

    update(dt, globalIdleSeconds = Infinity) {
        if (this.curiousRemaining > 0) {
            this.curiousRemaining = Math.max(0, this.curiousRemaining - dt);
        }
        if (this.curiousRemaining > 0) {
            this.headExpression = 'curious';
        } else if (globalIdleSeconds >= 10) {
            this.headExpression = 'sleepy';
        } else {
            this.headExpression = 'default';
        }

        const removeBoost = this.state === 'removing' ? 2 : 0;
        this.wiggleTime += dt * (2.6 + removeBoost + this.softPulse * 5);
        this.softPulse = Math.max(0, this.softPulse - dt * 2.4);

        // Removed trail afterimage layer to avoid square translucent overlay artifacts.
        this.trails = [];
    }

    draw(ctx, grid, pixelTheme = null) {
        if (this.state === 'removed') return;

        const cellSize = grid.cellSize;
        const points = this.getScreenPoints(grid);
        let renderPts = [...points];
        const activeHeadDirection = this.getHeadDirection();

        if (this.state === 'removing' && this._removeAnim) {
            renderPts = getSubPath(renderPts, this._removeAnim.dist, activeHeadDirection).pts;
        } else if (this.state === 'bumping' && this._bumpAnim) {
            renderPts = getSubPath(renderPts, this._bumpAnim.dist, activeHeadDirection).pts;
        }

        this.currentRenderPts = renderPts;

        const shakeX = this.shakeAmount > 0 ? (Math.random() - 0.5) * this.shakeAmount : 0;
        const shakeY = this.shakeAmount > 0 ? (Math.random() - 0.5) * this.shakeAmount : 0;
        const strokeColor = this.flashRed > 0
            ? `rgb(255, ${255 * (1 - this.flashRed)}, ${255 * (1 - this.flashRed)})`
            : (this.removeTint || this.color);

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(shakeX, shakeY);

        const pathHeadDirection = this.getHeadDirectionFromPoints(renderPts);

        if (renderPts.length > 0 && pixelTheme?.atlas) {
            drawArrowPathPixels(ctx, renderPts, pathHeadDirection, {
                atlas: pixelTheme.atlas,
                alpha: this.opacity,
                style: pickPixelStyle(this, strokeColor),
                lineId: this.id,
                wiggleTime: this.wiggleTime,
                softPulse: this.softPulse,
                headExpression: this.headExpression
            });
        } else if (renderPts.length > 0) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = this.isHighlighted ? cellSize * 0.35 : cellSize * 0.24;
            ctx.strokeStyle = strokeColor;
            const headDirection = pathHeadDirection;
            const arrowMetrics = this.getArrowMetrics(cellSize);
            const bodyPts = trimEndForArrow(renderPts, arrowMetrics.length * 0.82);

            ctx.beginPath();
            ctx.moveTo(bodyPts[0].x, bodyPts[0].y);
            for (let i = 1; i < bodyPts.length; i++) {
                ctx.lineTo(bodyPts[i].x, bodyPts[i].y);
            }
            ctx.stroke();
            const head = renderPts[renderPts.length - 1];
            this.drawArrowHead(ctx, head.x, head.y, strokeColor, headDirection, arrowMetrics);
        }

        ctx.restore();
    }

    drawArrowHead(ctx, x, y, fillColor, direction, arrowMetrics) {
        ctx.save();
        ctx.translate(x, y);

        switch (direction) {
            case 'down':
                ctx.rotate(Math.PI / 2);
                break;
            case 'left':
                ctx.rotate(Math.PI);
                break;
            case 'up':
                ctx.rotate(-Math.PI / 2);
                break;
            default:
                break;
        }

        ctx.fillStyle = this.flashRed > 0 ? '#ff2c48' : fillColor;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowMetrics.length, -arrowMetrics.width);
        ctx.lineTo(-arrowMetrics.length, arrowMetrics.width);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    getArrowMetrics(cellSize) {
        return {
            width: cellSize * 0.24,
            length: cellSize * 0.46
        };
    }

    getHeadDirection() {
        if (this.cells.length < 2) {
            return this.direction;
        }

        const prev = this.cells[this.cells.length - 2];
        const head = this.cells[this.cells.length - 1];
        const dx = head.col - prev.col;
        const dy = head.row - prev.row;

        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? 'right' : 'left';
        }

        return dy >= 0 ? 'down' : 'up';
    }

    getHeadDirectionFromPoints(points) {
        if (!points || points.length < 2) {
            return this.getHeadDirection();
        }

        const prev = points[points.length - 2];
        const head = points[points.length - 1];
        const dx = head.x - prev.x;
        const dy = head.y - prev.y;

        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? 'right' : 'left';
        }

        return dy >= 0 ? 'down' : 'up';
    }

    getScreenPoints(grid) {
        return this.cells.map((cell) => grid.gridToScreen(cell.col, cell.row));
    }

    getExitCells(gridCols, gridRows) {
        const vector = DIR_VECTORS[this.getHeadDirection()];
        const cells = [];
        let col = this.headCell.col + vector.dx;
        let row = this.headCell.row + vector.dy;

        while (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
            cells.push({ col, row });
            col += vector.dx;
            row += vector.dy;
        }

        return cells;
    }

    drawTrails(ctx, grid, pixelTheme = null) {
        for (const trail of this.trails) {
            if (!trail.pts || trail.pts.length < 2) continue;

            if (pixelTheme?.atlas) {
                drawArrowPathPixels(ctx, trail.pts, this.getHeadDirectionFromPoints(trail.pts), {
                    atlas: pixelTheme.atlas,
                    alpha: trail.opacity * 0.22,
                    style: 'remove',
                    lineId: this.id,
                    wiggleTime: this.wiggleTime + 0.5,
                    softPulse: this.softPulse * 0.5
                });
                continue;
            }

            ctx.save();
            ctx.globalAlpha = trail.opacity * 0.25;
            ctx.strokeStyle = this.removeTint || this.color;
            ctx.lineWidth = grid.cellSize * 0.24;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(trail.pts[0].x, trail.pts[0].y);
            for (let i = 1; i < trail.pts.length; i++) {
                ctx.lineTo(trail.pts[i].x, trail.pts[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    pokeSoft(strength = 1) {
        this.softPulse = Math.max(this.softPulse, strength);
    }

    onClicked() {
        this.curiousRemaining = Math.max(this.curiousRemaining, 0.75);
        this.headExpression = 'curious';
    }
}

function pickPixelStyle(line, strokeColor) {
    if (line.flashRed > 0 || `${strokeColor}`.includes('255')) {
        return 'error';
    }
    if (line.isHighlighted) {
        return 'highlight';
    }
    if (line.removeTint) {
        return 'remove';
    }
    return 'normal';
}

function trimEndForArrow(points, trimLength) {
    if (points.length < 2 || trimLength <= 0) {
        return points;
    }

    const trimmed = points.map((point) => ({ ...point }));
    const head = trimmed[trimmed.length - 1];
    const prev = trimmed[trimmed.length - 2];
    const dx = head.x - prev.x;
    const dy = head.y - prev.y;
    const len = Math.hypot(dx, dy);

    if (len <= trimLength || len === 0) {
        return trimmed;
    }

    const ratio = (len - trimLength) / len;
    trimmed[trimmed.length - 1] = {
        x: prev.x + dx * ratio,
        y: prev.y + dy * ratio
    };

    return trimmed;
}

function getSubPath(points, pixelDistance, headDir) {
    if (points.length === 0) {
        return { pts: [] };
    }

    const segments = [];
    let totalLength = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        const len = Math.hypot(dx, dy);
        segments.push({ dx, dy, len, p1: points[i], p2: points[i + 1] });
        totalLength += len;
    }

    const head = points[points.length - 1];
    const vector = DIR_VECTORS[headDir];
    const newHead = {
        x: head.x + vector.dx * pixelDistance,
        y: head.y + vector.dy * pixelDistance
    };

    segments.push({
        dx: newHead.x - head.x,
        dy: newHead.y - head.y,
        len: pixelDistance,
        p1: head,
        p2: newHead
    });

    const result = [newHead];
    let remaining = totalLength;

    for (let i = segments.length - 1; i >= 0; i--) {
        const segment = segments[i];
        if (remaining > segment.len) {
            result.push(segment.p1);
            remaining -= segment.len;
        } else {
            const ratio = remaining / segment.len;
            result.push({
                x: segment.p2.x - segment.dx * ratio,
                y: segment.p2.y - segment.dy * ratio
            });
            break;
        }
    }

    result.reverse();
    return { pts: result };
}


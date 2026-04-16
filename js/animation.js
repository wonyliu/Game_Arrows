import { drawPixelParticle } from './pixel-art.js?v=51';
import { readGameplayParams } from './game-params.js?v=6';

const GAMEPLAY_PARAMS = readGameplayParams();
const REMOVE_SPEED_MULTIPLIER = GAMEPLAY_PARAMS.snakeRemoveSpeedMultiplier;
const REMOVE_ACCEL_MULTIPLIER = GAMEPLAY_PARAMS.snakeRemoveAccelMultiplier;

const DIR_VEC = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};
const MAX_REWARD_FIREWORKS_FULL = 42;
const MAX_REWARD_FIREWORKS_LITE = 16;
const REWARD_FIREWORK_COLORS = Object.freeze([
    { core: '#fff5cf', edge: '#9ed6ff', spark: '#e8fbff' },
    { core: '#fff0d0', edge: '#ffb0b8', spark: '#ffeef1' },
    { core: '#f8ffd6', edge: '#9be5b4', spark: '#effff5' },
    { core: '#f8f3ff', edge: '#c6b5ff', spark: '#f5f2ff' }
]);

export class AnimationManager {
    constructor() {
        this.floatingTexts = [];
        this.particles = [];
        this.rewardFireworks = [];
        this.screenShake = 0;
        this.screenShakeDecay = 0;
        this.quality = 'full';
    }

    setQuality(quality = 'full') {
        this.quality = quality === 'lite' ? 'lite' : 'full';
    }

    startRemoveAnimation(line, grid, options = null) {
        const onComplete = typeof options === 'function'
            ? options
            : options?.onComplete;
        const onSegment = typeof options === 'function'
            ? null
            : options?.onSegment;
        const onTailSegment = typeof options === 'function'
            ? null
            : options?.onTailSegment;

        line.state = 'removing';
        // Keep removal motion clean: no extra blue tint/trail overlay.
        line.removeTint = null;
        line.trails = [];

        const cellSize = grid.cellSize;
        const segmentSources = line.getScreenPoints(grid).slice().reverse();
        const tailSegmentSources = line.getScreenPoints(grid).slice();
        const headDirection = typeof line.getHeadDirection === 'function'
            ? line.getHeadDirection()
            : 'right';
        const directionVec = DIR_VEC[headDirection] || DIR_VEC.right;
        const headSource = segmentSources[0] || null;
        line._removeAnim = {
            speed: cellSize * 4.5 * REMOVE_SPEED_MULTIPLIER,
            accel: cellSize * 2.2 * REMOVE_ACCEL_MULTIPLIER,
            maxDist: Math.max(grid.cols, grid.rows) * cellSize + line.cells.length * cellSize + cellSize * 4,
            dist: 0,
            onComplete,
            onSegment,
            onTailSegment,
            segmentStepDist: Math.max(1, cellSize * 0.9),
            segmentExitStartDist: computeSegmentExitStartDist(headSource, directionVec, grid, cellSize),
            segmentSources,
            emittedSegments: 0,
            tailSegmentStepDist: Math.max(1, cellSize * 0.9),
            tailSegmentSources,
            emittedTailSegments: 0
        };

        this.screenShake = 2;
        this.screenShakeDecay = 3;
    }

    startErrorAnimation(line, distanceCells, grid) {
        line.state = 'bumping';
        line.shakeAmount = 0;
        line.flashRed = 0;

        const cellSize = grid.cellSize;
        line._bumpAnim = {
            phase: 'forward',
            dist: 0,
            maxDist: distanceCells * cellSize + cellSize * 0.25,
            speed: cellSize * 15,
            hitElapsed: 0,
            hitDuration: 0.28,
            grid
        };
    }

    addFloatingText(x, y, text, color = '#ffffff', size = 28, options = {}) {
        if (this.quality === 'lite' && this.floatingTexts.length >= 8) {
            return;
        }
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            size,
            opacity: 1,
            vy: options.vy ?? -78,
            life: options.life ?? 1.0,
            scale: options.scale ?? 1,
            scaleDecay: options.scaleDecay ?? 1,
            pill: options.pill ?? false,
            pillColor: options.pillColor ?? '#ffffff',
            stroke: options.stroke ?? !options.pill
        });
    }

    addComboText(x, y, combo, label = 'COMBO') {
        if (combo < 2) return;

        this.addFloatingText(x, y - 30, `${combo} ${label}`, '#ffd180', 26, {
            life: 1.1,
            vy: -36,
            scale: 1.35,
            scaleDecay: 0.97
        });
    }

    update(dt, lines, globalIdleSeconds = 0) {
        if (this.screenShake > 0) {
            this.screenShake -= this.screenShakeDecay * dt * 5;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        for (const line of lines) {
            line.update(dt, globalIdleSeconds);

            if (line._removeAnim) {
                const animation = line._removeAnim;
                animation.speed += animation.accel * dt;
                animation.dist += animation.speed * dt;

                if (typeof animation.onSegment === 'function' && Array.isArray(animation.segmentSources)) {
                    while (
                        animation.emittedSegments < animation.segmentSources.length &&
                        animation.dist >= animation.segmentExitStartDist + animation.emittedSegments * animation.segmentStepDist
                    ) {
                        const segmentIndex = animation.emittedSegments;
                        const source = animation.segmentSources[segmentIndex];
                        try {
                            animation.onSegment(source, segmentIndex, animation.segmentSources.length);
                        } catch (error) {
                            console.warn('[animation] remove segment callback failed', error);
                        }
                        animation.emittedSegments++;
                    }
                }

                if (typeof animation.onTailSegment === 'function' && Array.isArray(animation.tailSegmentSources)) {
                    while (
                        animation.emittedTailSegments < animation.tailSegmentSources.length &&
                        animation.dist >= animation.emittedTailSegments * animation.tailSegmentStepDist
                    ) {
                        const segmentIndex = animation.emittedTailSegments;
                        const source = animation.tailSegmentSources[segmentIndex];
                        try {
                            animation.onTailSegment(source, segmentIndex, animation.tailSegmentSources.length);
                        } catch (error) {
                            console.warn('[animation] remove tail segment callback failed', error);
                        }
                        animation.emittedTailSegments++;
                    }
                }

                if (animation.dist > animation.maxDist) {
                    line.state = 'removed';
                    line.opacity = 0;
                    line._removeAnim = null;
                    line.removeTint = null;
                    if (animation.onComplete) animation.onComplete();
                }
            }

            if (line._bumpAnim) {
                const animation = line._bumpAnim;

                if (animation.phase === 'forward') {
                    animation.dist += animation.speed * dt;
                    if (animation.dist >= animation.maxDist) {
                        animation.dist = animation.maxDist;
                        animation.phase = 'hit';
                        line.shakeAmount = 8;
                        line.flashRed = 1;

                        const headPos = animation.grid.gridToScreen(line.headCell.col, line.headCell.row);
                        const dirVec = DIR_VEC[line.getHeadDirection()];
                        const hitX = headPos.x + dirVec.dx * animation.maxDist;
                        const hitY = headPos.y + dirVec.dy * animation.maxDist;
                        this.addConfetti(hitX, hitY, 14, ['#ff3355', '#ffd050', '#ffffff'], 'star');
                    }
                } else if (animation.phase === 'hit') {
                    animation.hitElapsed += dt;
                    const progress = animation.hitElapsed / animation.hitDuration;

                    if (progress >= 1) {
                        animation.phase = 'backward';
                        line.shakeAmount = 0;
                        line.flashRed = 0;
                    } else {
                        line.shakeAmount = 8 * (1 - progress);
                        line.flashRed = Math.max(0, 1 - progress * 1.5);
                    }
                } else if (animation.phase === 'backward') {
                    animation.dist -= animation.speed * dt * 1.5;
                    if (animation.dist <= 0) {
                        animation.dist = 0;
                        line.state = 'active';
                        line._bumpAnim = null;
                        line.shakeAmount = 0;
                        line.flashRed = 0;
                    }
                }
            }
        }

        for (const floatingText of this.floatingTexts) {
            floatingText.y += floatingText.vy * dt;
            floatingText.life -= dt;
            floatingText.opacity = Math.max(0, floatingText.life);
            floatingText.scale *= floatingText.scaleDecay;
        }
        this.floatingTexts = this.floatingTexts.filter((item) => item.life > 0);

        for (const particle of this.particles) {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy += 800 * dt;
            particle.life -= dt;
            particle.rotation += particle.vr * dt;
        }
        this.particles = this.particles.filter((item) => item.life > 0);

        for (const firework of this.rewardFireworks) {
            firework.life -= dt;
            firework.progress = 1 - (firework.life / firework.duration);
        }
        this.rewardFireworks = this.rewardFireworks.filter((item) => item.life > 0);
    }

    drawFloatingTexts(ctx) {
        const liteMode = this.quality === 'lite';
        const items = liteMode ? this.floatingTexts.slice(-6) : this.floatingTexts;
        for (const floatingText of items) {
            ctx.save();
            ctx.globalAlpha = floatingText.opacity;
            ctx.font = `900 ${floatingText.size}px Nunito, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (floatingText.scale !== 1) {
                ctx.translate(floatingText.x, floatingText.y);
                ctx.scale(floatingText.scale, floatingText.scale);
                ctx.translate(-floatingText.x, -floatingText.y);
            }

            if (floatingText.pill) {
                const metrics = ctx.measureText(floatingText.text);
                const width = metrics.width + 34;
                const height = floatingText.size + 16;
                roundRect(ctx, floatingText.x - width / 2, floatingText.y - height / 2, width, height, 16);
                ctx.fillStyle = floatingText.pillColor;
                if (!liteMode) {
                    ctx.shadowColor = 'rgba(0,0,0,0.12)';
                    ctx.shadowBlur = 12;
                    ctx.shadowOffsetY = 4;
                }
                ctx.fill();
                if (!liteMode) {
                    ctx.shadowColor = 'transparent';
                }
            }

            if (floatingText.stroke && !liteMode) {
                ctx.strokeStyle = 'rgba(25, 26, 57, 0.18)';
                ctx.lineWidth = 4;
                ctx.strokeText(floatingText.text, floatingText.x, floatingText.y);
            }

            ctx.fillStyle = floatingText.color;
            ctx.fillText(floatingText.text, floatingText.x, floatingText.y);
            ctx.restore();
        }
    }

    addConfetti(
        x,
        y,
        count = 50,
        colors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b'],
        type = 'confetti',
        options = {}
    ) {
        if (this.quality === 'lite') {
            count = Math.max(0, Math.floor(count * 0.15));
            if (count <= 0) {
                return;
            }
        }
        const speedMin = Math.max(1, Number(options.speedMin) || 150);
        const speedMax = Math.max(speedMin, Number(options.speedMax) || 550);
        const riseBias = Number(options.riseBias) || 200;
        const sizeMin = Math.max(0.5, Number(options.sizeMin) || 6);
        const sizeMax = Math.max(sizeMin, Number(options.sizeMax) || 14);
        const lifeMin = Math.max(0.08, Number(options.lifeMin) || 1.5);
        const lifeMax = Math.max(lifeMin, Number(options.lifeMax) || 3.0);
        const rotationSpeed = Number(options.rotationSpeed) || 10;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = speedMin + Math.random() * (speedMax - speedMin);
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - riseBias,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: sizeMin + Math.random() * (sizeMax - sizeMin),
                rotation: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * rotationSpeed,
                life: lifeMin + Math.random() * (lifeMax - lifeMin),
                type
            });
        }
    }

    drawParticles(ctx, pixelTheme = null) {
        if (this.quality === 'lite') {
            return;
        }
        for (const particle of this.particles) {
            if (pixelTheme?.atlas) {
                drawPixelParticle(ctx, particle, pixelTheme);
                continue;
            }

            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            ctx.globalAlpha = Math.min(1, particle.life / 0.5);
            ctx.fillStyle = particle.color;

            if (particle.type === 'confetti') {
                ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            } else {
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    ctx.lineTo(
                        Math.cos((18 + i * 72) / 180 * Math.PI) * particle.size,
                        -Math.sin((18 + i * 72) / 180 * Math.PI) * particle.size
                    );
                    ctx.lineTo(
                        Math.cos((54 + i * 72) / 180 * Math.PI) * particle.size * 0.4,
                        -Math.sin((54 + i * 72) / 180 * Math.PI) * particle.size * 0.4
                    );
                }
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }
    }

    addRewardFirework(x, y, options = {}) {
        const isLite = this.quality === 'lite';
        const duration = Math.max(0.16, Number(options.duration) || (isLite ? 0.3 : 0.38));
        const maxRadius = Math.max(8, Number(options.maxRadius) || (isLite ? 22 : 34));
        const endScale = Math.max(3.1, Number(options.endScale) || (isLite ? 3.1 : 3.6));
        const lineWidth = Math.max(0.9, Number(options.lineWidth) || (isLite ? 1.4 : 2.1));
        const palette = REWARD_FIREWORK_COLORS[
            Math.floor(Math.random() * REWARD_FIREWORK_COLORS.length)
        ];
        const colorCore = `${options.colorCore || palette.core}`;
        const colorEdge = `${options.colorEdge || palette.edge}`;
        const colorSpark = `${options.colorSpark || palette.spark}`;
        const rayCount = clampInt(
            Number(options.rayCount) || (isLite ? 14 : 24),
            8,
            isLite ? 20 : 36,
            isLite ? 14 : 24
        );
        const ringCount = isLite ? 1 : 2;
        const seed = Number(options.seed) || Math.random() * Math.PI * 2;
        const rays = [];
        for (let i = 0; i < rayCount; i++) {
            const angle = seed + (i / rayCount) * Math.PI * 2;
            rays.push({
                ux: Math.cos(angle),
                uy: Math.sin(angle),
                lengthScale: 0.86 + Math.random() * 0.28,
                delay: (i % 3) * 0.012,
                widthScale: 0.85 + Math.random() * 0.55
            });
        }
        const ringDots = [];
        for (let ring = 0; ring < ringCount; ring++) {
            const dotCount = isLite ? (9 + ring * 4) : (14 + ring * 8);
            const ringSeed = seed + ring * 0.23;
            const radiusScale = ringCount === 1
                ? 0.78
                : (ring === 0 ? 0.58 : 0.9);
            for (let i = 0; i < dotCount; i++) {
                const angle = ringSeed + (i / dotCount) * Math.PI * 2;
                ringDots.push({
                    ux: Math.cos(angle),
                    uy: Math.sin(angle),
                    radiusScale,
                    delay: ring * 0.045 + (i % 2) * 0.008,
                    size: (isLite ? 1.4 : 1.8) + Math.random() * (isLite ? 0.8 : 1.4)
                });
            }
        }
        this.rewardFireworks.push({
            x,
            y,
            duration,
            life: duration,
            progress: 0,
            maxRadius,
            endScale,
            lineWidth,
            colorCore,
            colorEdge,
            colorSpark,
            rays,
            ringDots
        });
        const maxCount = isLite ? MAX_REWARD_FIREWORKS_LITE : MAX_REWARD_FIREWORKS_FULL;
        if (this.rewardFireworks.length > maxCount) {
            this.rewardFireworks.splice(0, this.rewardFireworks.length - maxCount);
        }
    }

    drawRewardFireworks(ctx) {
        if (!this.rewardFireworks.length) {
            return;
        }
        for (const firework of this.rewardFireworks) {
            const t = Math.max(0, Math.min(1, Number(firework.progress) || 0));
            const easeOut = 1 - Math.pow(1 - t, 2.35);
            const growth = 1 + (Math.max(1, Number(firework.endScale) || 1) - 1) * easeOut;
            const radius = firework.maxRadius * (0.32 + 0.68 * easeOut) * growth;
            const alpha = Math.max(0, Math.pow(1 - t, 0.62));
            const rays = Array.isArray(firework.rays) ? firework.rays : [];
            const ringDots = Array.isArray(firework.ringDots) ? firework.ringDots : [];

            ctx.save();
            ctx.translate(firework.x, firework.y);
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = firework.colorCore;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1.2, radius * 0.28), 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = alpha * 0.25;
            ctx.strokeStyle = firework.colorCore;
            ctx.lineWidth = Math.max(0.8, firework.lineWidth * 0.82);
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1, radius * 0.74), 0, Math.PI * 2);
            ctx.stroke();

            ctx.globalAlpha = alpha * 0.88;
            ctx.strokeStyle = firework.colorEdge;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const ray of rays) {
                const localT = clamp01((t - ray.delay) / Math.max(0.001, 1 - ray.delay));
                if (localT <= 0) continue;
                const inner = firework.maxRadius * (0.04 + 0.2 * localT);
                const outer = firework.maxRadius * (0.32 + 0.8 * localT) * ray.lengthScale;
                ctx.moveTo(ray.ux * inner, ray.uy * inner);
                ctx.lineTo(ray.ux * outer, ray.uy * outer);
            }
            ctx.lineWidth = Math.max(0.7, firework.lineWidth * (1 - t * 0.25));
            ctx.stroke();

            ctx.globalAlpha = alpha * 0.72;
            ctx.fillStyle = firework.colorSpark;
            for (const dot of ringDots) {
                const localT = clamp01((t - dot.delay) / Math.max(0.001, 1 - dot.delay));
                if (localT <= 0) continue;
                const dotRadius = firework.maxRadius * dot.radiusScale * localT;
                const px = dot.ux * dotRadius;
                const py = dot.uy * dotRadius;
                const size = dot.size * (1 - localT * 0.35);
                ctx.beginPath();
                ctx.arc(px, py, Math.max(0.6, size), 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    getScreenShakeOffset() {
        if (this.screenShake <= 0) {
            return { x: 0, y: 0 };
        }

        return {
            x: (Math.random() - 0.5) * this.screenShake * 2,
            y: (Math.random() - 0.5) * this.screenShake * 2
        };
    }
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function computeSegmentExitStartDist(headPoint, direction, grid, cellSize) {
    if (!headPoint || !direction || !grid) {
        return 0;
    }

    const minX = Number(grid.offsetX) || 0;
    const minY = Number(grid.offsetY) || 0;
    const spanX = Math.max(0, (Number(grid.cols) || 0) * (Number(grid.cellSize) || Number(cellSize) || 0));
    const spanY = Math.max(0, (Number(grid.rows) || 0) * (Number(grid.cellSize) || Number(cellSize) || 0));
    const maxX = minX + spanX;
    const maxY = minY + spanY;
    const x = Number(headPoint.x) || 0;
    const y = Number(headPoint.y) || 0;

    let dist = 0;
    if (direction.dx > 0) {
        dist = maxX - x;
    } else if (direction.dx < 0) {
        dist = x - minX;
    } else if (direction.dy > 0) {
        dist = maxY - y;
    } else if (direction.dy < 0) {
        dist = y - minY;
    }

    const outPadding = Math.max(1, (Number(cellSize) || 0) * 0.08);
    return Math.max(0, dist + outPadding);
}

function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return 0;
    }
    if (n <= 0) return 0;
    if (n >= 1) return 1;
    return n;
}


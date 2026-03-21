import { drawPixelParticle } from './pixel-art.js?v=16';

const DIR_VEC = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};

export class AnimationManager {
    constructor() {
        this.floatingTexts = [];
        this.particles = [];
        this.screenShake = 0;
        this.screenShakeDecay = 0;
    }

    startRemoveAnimation(line, grid, onComplete) {
        line.state = 'removing';
        // Keep removal motion clean: no extra blue tint/trail overlay.
        line.removeTint = null;
        line.trails = [];

        const cellSize = grid.cellSize;
        line._removeAnim = {
            speed: cellSize * 4.5,
            accel: cellSize * 2.2,
            maxDist: Math.max(grid.cols, grid.rows) * cellSize + line.cells.length * cellSize + cellSize * 4,
            dist: 0,
            onComplete
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
    }

    drawFloatingTexts(ctx) {
        for (const floatingText of this.floatingTexts) {
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
                ctx.shadowColor = 'rgba(0,0,0,0.12)';
                ctx.shadowBlur = 12;
                ctx.shadowOffsetY = 4;
                ctx.fill();
                ctx.shadowColor = 'transparent';
            }

            if (floatingText.stroke) {
                ctx.strokeStyle = 'rgba(25, 26, 57, 0.18)';
                ctx.lineWidth = 4;
                ctx.strokeText(floatingText.text, floatingText.x, floatingText.y);
            }

            ctx.fillStyle = floatingText.color;
            ctx.fillText(floatingText.text, floatingText.x, floatingText.y);
            ctx.restore();
        }
    }

    addConfetti(x, y, count = 50, colors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b'], type = 'confetti') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 150 + Math.random() * 400;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 200,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 6 + Math.random() * 8,
                rotation: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 10,
                life: 1.5 + Math.random() * 1.5,
                type
            });
        }
    }

    drawParticles(ctx, pixelTheme = null) {
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

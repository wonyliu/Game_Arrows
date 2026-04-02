import {
    getGameSfxPresetId,
    getSfxPresetById,
    getSfxPresetSample,
    getSkinSfxPresetId,
    initSfxStorage,
    normalizeRecipe
} from './sfx-storage.js?v=5';
import { synthRecipe } from './sfx-synth.js?v=2';

let audioCtx = null;
let initPromise = null;
let currentSkinId = 'classic-burrow';
const RELEASE_PIANO_SCALE = Object.freeze([261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]);
const sampleBufferCache = new Map();

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive'
        });
    }
    return audioCtx;
}

function getActiveRecipe() {
    const presetId = getSkinSfxPresetId(currentSkinId, 'candy-crunch');
    const preset = getSfxPresetById(presetId);
    return normalizeRecipe(
        {
            presetId: preset.id,
            params: { ...preset.defaults }
        },
        preset.id
    );
}

function getGameEventRecipe(eventKey, fallbackPresetId = 'candy-crunch') {
    const presetId = getGameSfxPresetId(eventKey, fallbackPresetId);
    const preset = getSfxPresetById(presetId);
    return normalizeRecipe(
        {
            presetId: preset.id,
            params: { ...preset.defaults }
        },
        preset.id
    );
}

function dataUrlToArrayBuffer(dataUrl) {
    const idx = dataUrl.indexOf(',');
    if (idx <= 0) {
        throw new Error('invalid data url');
    }
    const base64 = dataUrl.slice(idx + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function decodePresetSampleBuffer(ctx, presetId) {
    const sample = getSfxPresetSample(presetId);
    if (!sample?.dataUrl) {
        return null;
    }
    const signature = `${presetId}:${sample.dataUrl.length}:${sample.fileName || ''}`;
    const cached = sampleBufferCache.get(presetId);
    if (cached && cached.signature === signature && cached.buffer) {
        return cached.buffer;
    }
    const arrayBuffer = dataUrlToArrayBuffer(sample.dataUrl);
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    sampleBufferCache.set(presetId, {
        signature,
        buffer: decoded
    });
    return decoded;
}

function buildSamplePlaybackPlan(params = {}, seed = Date.now()) {
    const impact = clamp(Number(params.impact) || 1, 0.1, 1.8);
    const pitchSemitone = clamp(Number(params.pitchSemitone) || 0, -24, 24);
    const length = clamp(Number(params.length) || 1, 0.35, 2.2);
    const randomness = clamp(Number(params.randomness) || 0, 0, 1);
    const bounce = clamp(Number(params.bounce) || 0, 0, 1);
    const repeats = Math.max(1, Math.min(6, Math.round(Number(params.repeats) || 1)));
    const pitchRate = Math.pow(2, pitchSemitone / 12);
    const stretchRate = 1 / Math.max(0.35, length);
    const baseRate = clamp(pitchRate * stretchRate, 0.45, 2.2);
    const jitter = (index, scale = 0.08) => {
        const x = Math.sin((seed + index * 131) * 0.01731) * 0.5 + 0.5;
        return 1 + (x - 0.5) * scale * randomness;
    };
    const impactGain = clamp(Math.pow(impact / 0.8, 1.15), 0.08, 2.9);
    return { impact, impactGain, bounce, repeats, baseRate, jitter };
}

async function playPresetSample(recipe, gainBoost = 1, playbackRateMul = 1) {
    const presetId = recipe?.presetId || '';
    const ctx = getAudioContext();
    const buffer = await decodePresetSampleBuffer(ctx, presetId);
    if (!buffer) {
        return false;
    }
    const plan = buildSamplePlaybackPlan(recipe?.params || {}, Date.now());
    let cursor = ctx.currentTime + 0.003;
    for (let i = 0; i < plan.repeats; i += 1) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const rate = clamp(plan.baseRate * playbackRateMul * plan.jitter(i), 0.45, 2.2);
        source.playbackRate.setValueAtTime(rate, cursor);

        const gain = ctx.createGain();
        const repeatDecay = Math.pow(0.82 - plan.bounce * 0.14, i);
        gain.gain.setValueAtTime(clamp(plan.impactGain * gainBoost * repeatDecay, 0.02, 3.2), cursor);
        source.connect(gain);
        gain.connect(ctx.destination);

        source.start(cursor);
        const renderedDuration = buffer.duration / rate;
        source.stop(cursor + renderedDuration + 0.02);
        const overlapFactor = clamp(0.62 - plan.bounce * 0.22, 0.28, 0.72);
        cursor += renderedDuration * overlapFactor;
    }
    return true;
}

function withCurrentRecipe(mutator) {
    const base = getActiveRecipe();
    const next = mutator && typeof mutator === 'function' ? mutator(base) : base;
    return normalizeRecipe(next, base.presetId);
}

export function initAudioProfileStorage() {
    if (initPromise) {
        return initPromise;
    }
    initPromise = initSfxStorage().catch((error) => {
        console.warn('[audio] sfx storage init failed', error);
    });
    return initPromise;
}

export function setAudioSkinId(skinId) {
    const normalized = `${skinId || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    currentSkinId = normalized || 'classic-burrow';
}

export function resumeAudio() {
    void initAudioProfileStorage();
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        void ctx.resume();
    }
}

export function playClearSound() {
    void initAudioProfileStorage();
    const recipe = getActiveRecipe();
    void playPresetSample(recipe, 1.05, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.01, Date.now() + 131, 1.05, recipe.presetId);
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.01, Date.now() + 131, 1.05, recipe.presetId);
    });
}

export function playReleaseScaleSound(comboCount = 0) {
    void initAudioProfileStorage();
    const ctx = getAudioContext();
    const safeCombo = Math.max(0, Math.floor(Number(comboCount) || 0));
    const idx = Math.min(safeCombo, RELEASE_PIANO_SCALE.length - 1);
    const freq = RELEASE_PIANO_SCALE[idx];
    const start = ctx.currentTime + 0.002;

    const oscMain = ctx.createOscillator();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(freq, start);
    const gainMain = ctx.createGain();
    gainMain.gain.setValueAtTime(0.0001, start);
    gainMain.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
    gainMain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    oscMain.connect(gainMain);
    gainMain.connect(ctx.destination);
    oscMain.start(start);
    oscMain.stop(start + 0.3);

    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(freq * 2, start);
    const gainHarm = ctx.createGain();
    gainHarm.gain.setValueAtTime(0.0001, start);
    gainHarm.gain.exponentialRampToValueAtTime(0.07, start + 0.008);
    gainHarm.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    oscHarm.connect(gainHarm);
    gainHarm.connect(ctx.destination);
    oscHarm.start(start);
    oscHarm.stop(start + 0.2);
}

export function playErrorSound() {
    void initAudioProfileStorage();
    const recipe = getGameEventRecipe('error', 'fail-plop');
    void playPresetSample(recipe, 0.96, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 73, 0.96, recipe.presetId);
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 73, 0.96, recipe.presetId);
    });
}

export function playLevelCompleteSound() {
    void initAudioProfileStorage();
    const ctx = getAudioContext();
    const base = getGameEventRecipe('levelComplete', 'candy-crunch');
    void playPresetSample(base, 0.95, 1).then((played) => {
        if (played) {
            return;
        }
        const notes = [0, 4, 7, 12];
        let cursor = ctx.currentTime + 0.01;
        for (let i = 0; i < notes.length; i += 1) {
            const recipe = normalizeRecipe({
                presetId: base.presetId === 'fail-plop' ? 'candy-crunch' : base.presetId,
                params: {
                    ...base.params,
                    pitchSemitone: clamp(base.params.pitchSemitone + notes[i], -24, 24),
                    impact: clamp(base.params.impact * (0.9 + i * 0.08), 0.1, 1.8),
                    repeats: 1,
                    length: clamp(base.params.length * 0.78, 0.35, 2.2),
                    randomness: clamp(base.params.randomness * 0.45, 0, 1),
                    bounce: clamp(base.params.bounce + 0.08, 0, 1)
                }
            }, base.presetId);
            cursor = synthRecipe(ctx, recipe, cursor, Date.now() + i * 211, 0.95, recipe.presetId) + 0.012;
        }
    }).catch(() => {});
}

export function playGameOverSound() {
    void initAudioProfileStorage();
    const ctx = getAudioContext();
    const base = getGameEventRecipe('gameOver', 'fail-plop');
    void playPresetSample(base, 0.92, 1).then((played) => {
        if (played) {
            return;
        }
        const notes = [0, -3, -7, -12];
        let cursor = ctx.currentTime + 0.01;
        for (let i = 0; i < notes.length; i += 1) {
            const recipe = normalizeRecipe({
                presetId: 'fail-plop',
                params: {
                    ...base.params,
                    pitchSemitone: clamp(base.params.pitchSemitone + notes[i], -24, 24),
                    impact: clamp(base.params.impact * (0.9 - i * 0.08), 0.1, 1.8),
                    repeats: 1,
                    length: clamp(base.params.length * 0.86, 0.35, 2.2),
                    randomness: clamp(base.params.randomness * 0.3, 0, 1),
                    bounce: clamp(base.params.bounce * 0.2, 0, 1)
                }
            }, base.presetId);
            cursor = synthRecipe(ctx, recipe, cursor, Date.now() + i * 307, 0.92, recipe.presetId) + 0.018;
        }
    }).catch(() => {});
}

export function playClickSound() {
    void initAudioProfileStorage();
    const recipe = getGameEventRecipe('click', 'syrup-pop');
    void playPresetSample(recipe, 0.84, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 19, 0.84, recipe.presetId);
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 19, 0.84, recipe.presetId);
    });
}

export function playCoinPopSound() {
    void initAudioProfileStorage();
    const recipe = getGameEventRecipe('coin', 'syrup-pop');
    void playPresetSample(recipe, 0.9, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 47, 0.9, recipe.presetId);
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 47, 0.9, recipe.presetId);
    });
}

void initAudioProfileStorage();

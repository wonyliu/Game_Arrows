import { normalizeRecipe } from './sfx-storage.js?v=12';

const noiseBufferCache = new Map();

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function semitoneToRatio(semitone) {
    return 2 ** (Number(semitone) / 12);
}

function createRng(seed) {
    let stateSeed = (Number(seed) >>> 0) || 1;
    return () => {
        stateSeed ^= stateSeed << 13;
        stateSeed ^= stateSeed >>> 17;
        stateSeed ^= stateSeed << 5;
        return ((stateSeed >>> 0) % 1_000_000) / 1_000_000;
    };
}

function randSigned(rng) {
    return rng() * 2 - 1;
}

function getNoiseBuffer(ctx, durationSeconds = 0.2) {
    const frameCount = Math.max(64, Math.round(durationSeconds * ctx.sampleRate));
    const key = `${ctx.sampleRate}:${frameCount}`;
    const cached = noiseBufferCache.get(key);
    if (cached) {
        return cached;
    }
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
        channel[i] = (Math.random() * 2 - 1) * (1 - (i / channel.length) * 0.25);
    }
    noiseBufferCache.set(key, buffer);
    return buffer;
}

function shapeTransient(gainParam, startTime, peakGain, attackSeconds, releaseSeconds) {
    const safePeak = Math.max(0.0001, peakGain);
    const attackEnd = startTime + Math.max(0.001, attackSeconds);
    const releaseEnd = attackEnd + Math.max(0.01, releaseSeconds);
    gainParam.cancelScheduledValues(startTime);
    gainParam.setValueAtTime(0.0001, startTime);
    gainParam.exponentialRampToValueAtTime(safePeak, attackEnd);
    gainParam.exponentialRampToValueAtTime(0.0001, releaseEnd);
}

function createMasterBus(ctx, startTime, boost = 1, outputNode = null) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, startTime);
    compressor.knee.setValueAtTime(12, startTime);
    compressor.ratio.setValueAtTime(4, startTime);
    compressor.attack.setValueAtTime(0.002, startTime);
    compressor.release.setValueAtTime(0.12, startTime);
    compressor.connect(outputNode || ctx.destination);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.88 * clamp(boost, 0.7, 1.5), startTime);
    gain.connect(compressor);
    return gain;
}

function synthCandyCrunch(ctx, bus, startTime, params, rng) {
    const pitchRatio = semitoneToRatio(params.pitchSemitone);
    const repeatInterval = 0.055 * params.length;
    for (let i = 0; i < params.repeats; i += 1) {
        const t = startTime + i * repeatInterval;
        const jitter = randSigned(rng) * params.randomness;
        const burstDuration = clamp(0.055 * params.length * (1 + jitter * 0.45), 0.02, 0.18);

        const noise = ctx.createBufferSource();
        noise.buffer = getNoiseBuffer(ctx, 0.22);
        noise.playbackRate.setValueAtTime(clamp(pitchRatio * (1 + jitter * 0.6), 0.35, 2.8), t);

        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(580 + 900 * params.impact, t);

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(clamp(2300 * pitchRatio * (1 + jitter * 0.6), 750, 5200), t);
        bandpass.Q.setValueAtTime(1.2 + params.randomness * 8, t);

        const noiseGain = ctx.createGain();
        shapeTransient(noiseGain.gain, t, 0.19 * params.impact, 0.001, burstDuration);

        noise.connect(highpass);
        highpass.connect(bandpass);
        bandpass.connect(noiseGain);
        noiseGain.connect(bus);
        noise.start(t);
        noise.stop(t + burstDuration + 0.02);

        const click = ctx.createOscillator();
        click.type = 'triangle';
        click.frequency.setValueAtTime(clamp(1700 * pitchRatio * (1 + jitter * 0.4), 700, 4200), t);
        click.frequency.exponentialRampToValueAtTime(
            clamp(420 * pitchRatio, 120, 1200),
            t + Math.max(0.016, burstDuration * 0.8)
        );
        const clickGain = ctx.createGain();
        shapeTransient(clickGain.gain, t, 0.11 * params.impact, 0.001, Math.max(0.03, burstDuration * 0.7));
        click.connect(clickGain);
        clickGain.connect(bus);
        click.start(t);
        click.stop(t + burstDuration + 0.03);
    }

    if (params.bounce > 0.06) {
        const thud = ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(170 * pitchRatio, startTime);
        thud.frequency.exponentialRampToValueAtTime(82 * pitchRatio, startTime + 0.12 * params.length);
        const thudGain = ctx.createGain();
        shapeTransient(
            thudGain.gain,
            startTime,
            0.06 * params.impact * params.bounce,
            0.002,
            0.12 * params.length + 0.04
        );
        thud.connect(thudGain);
        thudGain.connect(bus);
        thud.start(startTime);
        thud.stop(startTime + 0.22 * params.length);
    }

    return startTime + Math.max(0, params.repeats - 1) * repeatInterval + 0.24 * params.length;
}

function synthJellyDuang(ctx, bus, startTime, params, rng) {
    const pitchRatio = semitoneToRatio(params.pitchSemitone);
    const coreDuration = 0.36 * params.length;
    const baseFreq = clamp(144 * pitchRatio, 64, 420);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 + 1500 * params.bounce, startTime);
    filter.Q.setValueAtTime(0.8 + 1.4 * params.bounce, startTime);
    filter.connect(bus);

    for (let i = 0; i < params.repeats; i += 1) {
        const t = startTime + i * (0.085 * params.length);
        const jitter = randSigned(rng) * params.randomness * 0.2;

        const body = ctx.createOscillator();
        body.type = 'sine';
        body.frequency.setValueAtTime(baseFreq * (1.65 + jitter), t);
        body.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, t + coreDuration * 0.66);
        body.frequency.exponentialRampToValueAtTime(baseFreq * 0.94, t + coreDuration + 0.04);
        const bodyGain = ctx.createGain();
        shapeTransient(bodyGain.gain, t, 0.23 * params.impact, 0.005, coreDuration + 0.11 + params.bounce * 0.08);
        body.connect(bodyGain);
        bodyGain.connect(filter);
        body.start(t);
        body.stop(t + coreDuration + 0.22);
    }

    const bounceCount = Math.round(1 + params.bounce * 3);
    for (let i = 0; i < bounceCount; i += 1) {
        const t = startTime + 0.11 * params.length + i * 0.095 * params.length;
        const bounceOsc = ctx.createOscillator();
        bounceOsc.type = 'triangle';
        const freq = baseFreq * (1.04 + i * 0.11);
        bounceOsc.frequency.setValueAtTime(freq, t);
        bounceOsc.frequency.exponentialRampToValueAtTime(freq * 0.84, t + 0.08 * params.length);
        const bounceGain = ctx.createGain();
        const peak = 0.08 * params.impact * (1 - i / Math.max(1, bounceCount));
        shapeTransient(bounceGain.gain, t, peak, 0.003, 0.1 * params.length);
        bounceOsc.connect(bounceGain);
        bounceGain.connect(filter);
        bounceOsc.start(t);
        bounceOsc.stop(t + 0.14 * params.length);
    }

    return startTime + coreDuration + params.bounce * 0.32 + Math.max(0, params.repeats - 1) * (0.085 * params.length);
}

function synthSyrupPop(ctx, bus, startTime, params, rng) {
    const pitchRatio = semitoneToRatio(params.pitchSemitone);
    const duration = 0.16 * params.length;
    const repeatInterval = 0.06 * params.length;

    for (let i = 0; i < params.repeats; i += 1) {
        const t = startTime + i * repeatInterval;
        const jitter = randSigned(rng) * params.randomness * 0.35;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const startFreq = clamp(780 * pitchRatio * (1 + jitter), 260, 3200);
        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 1.45, t + duration * 0.32);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 0.68, t + duration);
        const gain = ctx.createGain();
        shapeTransient(gain.gain, t, 0.2 * params.impact, 0.002, duration + 0.02);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(t);
        osc.stop(t + duration + 0.03);
    }

    return startTime + duration + Math.max(0, params.repeats - 1) * repeatInterval + params.bounce * 0.06;
}

function synthGummyStretch(ctx, bus, startTime, params, rng) {
    const pitchRatio = semitoneToRatio(params.pitchSemitone);
    const duration = 0.42 * params.length;
    const jitter = randSigned(rng) * params.randomness * 0.22;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = clamp(180 * pitchRatio * (1 + jitter), 70, 620);
    osc.frequency.setValueAtTime(baseFreq * 0.64, startTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.18 + params.bounce * 0.4), startTime + duration * 0.46);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.78, startTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(560 + params.bounce * 1200, startTime);
    filter.Q.setValueAtTime(1.1, startTime);

    const gain = ctx.createGain();
    shapeTransient(gain.gain, startTime, 0.17 * params.impact, 0.01, duration + 0.12);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.16);

    return startTime + duration + 0.18 + params.bounce * 0.08;
}

function synthFailPlop(ctx, bus, startTime, params, rng) {
    const pitchRatio = semitoneToRatio(params.pitchSemitone);
    const duration = 0.22 * params.length;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(clamp(210 * pitchRatio, 55, 540), startTime);
    osc.frequency.exponentialRampToValueAtTime(clamp(92 * pitchRatio, 40, 260), startTime + duration);
    const gain = ctx.createGain();
    shapeTransient(gain.gain, startTime, 0.12 * params.impact, 0.002, duration + 0.08);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.09);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx, 0.18);
    noise.playbackRate.setValueAtTime(1 + randSigned(rng) * 0.16, startTime);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(380, startTime);
    const noiseGain = ctx.createGain();
    shapeTransient(noiseGain.gain, startTime, 0.06 * params.impact, 0.001, 0.11);
    noise.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(bus);
    noise.start(startTime);
    noise.stop(startTime + 0.12);

    return startTime + duration + 0.12;
}

export function estimateRecipeDuration(recipe, fallbackPresetId = 'candy-crunch') {
    const normalized = normalizeRecipe(recipe, fallbackPresetId);
    const p = normalized.params;
    let duration = 0.2;
    switch (normalized.presetId) {
    case 'candy-crunch': {
        const repeatTail = Math.max(0, p.repeats - 1) * (0.055 * p.length);
        duration = repeatTail + 0.24 * p.length;
        break;
    }
    case 'jelly-duang': {
        duration = 0.36 * p.length + p.bounce * 0.32 + Math.max(0, p.repeats - 1) * (0.085 * p.length);
        break;
    }
    case 'syrup-pop': {
        duration = 0.16 * p.length + Math.max(0, p.repeats - 1) * (0.06 * p.length) + p.bounce * 0.06;
        break;
    }
    case 'gummy-stretch': {
        duration = 0.42 * p.length + 0.18 + p.bounce * 0.08;
        break;
    }
    case 'fail-plop': {
        duration = 0.22 * p.length + 0.12;
        break;
    }
    default: {
        duration = 0.24 * p.length;
        break;
    }
    }
    return clamp(duration, 0.12, 6.0);
}

export function synthRecipe(
    ctx,
    recipe,
    startTime = 0,
    seed = Date.now(),
    gainBoost = 1,
    fallbackPresetId = 'candy-crunch',
    outputNode = null
) {
    const normalized = normalizeRecipe(recipe, fallbackPresetId);
    const rng = createRng(seed || Date.now());
    const bus = createMasterBus(ctx, startTime, gainBoost, outputNode);
    const p = normalized.params;

    switch (normalized.presetId) {
    case 'candy-crunch':
        return synthCandyCrunch(ctx, bus, startTime, p, rng);
    case 'jelly-duang':
        return synthJellyDuang(ctx, bus, startTime, p, rng);
    case 'syrup-pop':
        return synthSyrupPop(ctx, bus, startTime, p, rng);
    case 'gummy-stretch':
        return synthGummyStretch(ctx, bus, startTime, p, rng);
    case 'fail-plop':
        return synthFailPlop(ctx, bus, startTime, p, rng);
    default:
        return synthCandyCrunch(ctx, bus, startTime, p, rng);
    }
}

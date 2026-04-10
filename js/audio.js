import {
    getGameSfxPresetId,
    getSfxPresetById,
    getSfxPresetSample,
    getSkinSfxPresetId,
    initSfxStorage,
    normalizeRecipe
} from './sfx-storage.js?v=6';
import { estimateRecipeDuration, synthRecipe } from './sfx-synth.js?v=2';
import { BGM_SCENE_KEYS, initBgmStorage, readBgmConfig } from './bgm-storage.js?v=7';

export { BGM_SCENE_KEYS };

const AUDIO_MIX_STORAGE_KEY = 'arrowClear_audioMix_v1';
const DEFAULT_AUDIO_MIX = Object.freeze({
    music: 0.65,
    sfx: 0.55
});

let audioCtx = null;
let initPromise = null;
let currentSkinId = 'classic-burrow';
const RELEASE_PIANO_SCALE = Object.freeze([261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]);
const sampleBufferCache = new Map();
const bgmBufferCache = new Map();
let clearSoundExclusiveUntil = 0;
let bgmAudioEl = null;
let bgmSceneKey = '';
let bgmPlaylist = [];
let bgmTrackIndex = 0;
let bgmPlaylistSignature = '';
let bgmConsecutiveErrorCount = 0;
let bgmWebGainNode = null;
let bgmWebSourceNode = null;
let bgmWebAudioActive = false;
let bgmHtmlMediaSourceNode = null;
let bgmHtmlMediaGainNode = null;
let htmlMediaVolumeWritable = null;
let bgmStorageReady = false;
let pendingSceneReplayAfterStorage = '';
let bgmSceneVolume = 1;
let bgmSceneTrackVolumes = new Map();
let pendingBgmPlay = false;
let bgmRetryTimer = 0;
let bgmMutedBootstrap = false;
let bgmUnmuteTimer = 0;
let bgmUnmuteAttemptCount = 0;
const BGM_UNMUTE_MAX_ATTEMPTS = 20;
const BGM_UNMUTE_INTERVAL_MS = 600;
let bgmUnmutePollingTimer = 0;
let earlyBootstrapDone = false;
let sfxMasterGainNode = null;
let audioMix = readAudioMixFromStorage();
const ENABLE_BGM_DEBUG_LOGS = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('debug') === '1';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function logBgm(step, payload = null) {
    if (!ENABLE_BGM_DEBUG_LOGS) {
        return;
    }
    if (payload === null || payload === undefined) {
        console.info(`[bgm] ${step}`);
        return;
    }
    try {
        console.info(`[bgm] ${step}`, payload);
    } catch {
        console.info(`[bgm] ${step}`);
    }
}

function readAudioMixFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return { ...DEFAULT_AUDIO_MIX };
    }
    try {
        const raw = JSON.parse(window.localStorage.getItem(AUDIO_MIX_STORAGE_KEY) || 'null');
        const rawMusic = Number(raw?.music);
        const rawSfx = Number(raw?.sfx);
        return {
            music: Number.isFinite(rawMusic) ? clamp(rawMusic, 0, 1) : DEFAULT_AUDIO_MIX.music,
            sfx: Number.isFinite(rawSfx) ? clamp(rawSfx, 0, 1) : DEFAULT_AUDIO_MIX.sfx
        };
    } catch {
        return { ...DEFAULT_AUDIO_MIX };
    }
}

function persistAudioMix() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(AUDIO_MIX_STORAGE_KEY, JSON.stringify(audioMix));
    } catch (error) {
        console.warn('[audio] failed to persist audio mix', error);
    }
}

function getSfxOutputNode(ctx) {
    if (!sfxMasterGainNode || sfxMasterGainNode.context !== ctx) {
        sfxMasterGainNode = ctx.createGain();
        sfxMasterGainNode.gain.setValueAtTime(audioMix.sfx, ctx.currentTime);
        sfxMasterGainNode.connect(ctx.destination);
    }
    return sfxMasterGainNode;
}

function applySfxMixVolume() {
    const ctx = audioCtx;
    if (!ctx || !sfxMasterGainNode) {
        return;
    }
    sfxMasterGainNode.gain.setValueAtTime(clamp(audioMix.sfx, 0, 1), ctx.currentTime);
}

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive'
        });
        applySfxMixVolume();
    }
    return audioCtx;
}

function getBgmWebGainNode(ctx) {
    if (!bgmWebGainNode || bgmWebGainNode.context !== ctx) {
        bgmWebGainNode = ctx.createGain();
        bgmWebGainNode.gain.setValueAtTime(0, ctx.currentTime);
        bgmWebGainNode.connect(ctx.destination);
    }
    return bgmWebGainNode;
}

function canControlHtmlMediaVolumeDirectly() {
    if (htmlMediaVolumeWritable !== null) {
        return htmlMediaVolumeWritable;
    }
    try {
        const probe = document.createElement('audio');
        const baseline = Number(probe.volume);
        probe.volume = 0.37;
        const after = Number(probe.volume);
        htmlMediaVolumeWritable = Number.isFinite(after)
            && Math.abs(after - 0.37) < 0.001
            && Math.abs(after - baseline) > 0.001;
    } catch {
        htmlMediaVolumeWritable = true;
    }
    return htmlMediaVolumeWritable;
}

function isIosLikeDevice() {
    if (typeof navigator === 'undefined') {
        return false;
    }
    const ua = `${navigator.userAgent || ''}`.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
        return true;
    }
    return /macintosh/.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
}

function shouldPreferWebAudioVolumeControl() {
    if (isIosLikeDevice()) {
        return true;
    }
    return !canControlHtmlMediaVolumeDirectly();
}

function ensureHtmlBgmGainRouting() {
    if (!bgmAudioEl) {
        return false;
    }
    if (!shouldPreferWebAudioVolumeControl()) {
        return false;
    }
    const ctx = getAudioContext();
    if (!bgmHtmlMediaGainNode || bgmHtmlMediaGainNode.context !== ctx) {
        bgmHtmlMediaGainNode = ctx.createGain();
        bgmHtmlMediaGainNode.gain.setValueAtTime(1, ctx.currentTime);
        bgmHtmlMediaGainNode.connect(ctx.destination);
    }
    if (!bgmHtmlMediaSourceNode) {
        try {
            bgmHtmlMediaSourceNode = ctx.createMediaElementSource(bgmAudioEl);
            bgmHtmlMediaSourceNode.connect(bgmHtmlMediaGainNode);
        } catch (error) {
            console.warn('[audio] failed to route html bgm through gain node', error);
            return false;
        }
    }
    return true;
}

function stopWebAudioBgm() {
    if (bgmWebSourceNode) {
        try {
            bgmWebSourceNode.onended = null;
            bgmWebSourceNode.stop();
        } catch {
            // noop
        }
        try {
            bgmWebSourceNode.disconnect();
        } catch {
            // noop
        }
    }
    bgmWebSourceNode = null;
    bgmWebAudioActive = false;
}

async function decodeBgmBuffer(src) {
    const url = `${src || ''}`.trim();
    if (!url) {
        throw new Error('empty bgm url');
    }
    const cached = bgmBufferCache.get(url);
    if (cached) {
        return cached;
    }
    logBgm('webaudio decode start', { src: url });
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
        if (controller) {
            controller.abort();
        }
    }, 5000);
    const response = await fetch(url, {
        method: 'GET',
        cache: 'force-cache',
        signal: controller ? controller.signal : undefined
    });
    clearTimeout(timeoutId);
    logBgm('webaudio fetch done', { src: url, status: response.status });
    if (!response.ok) {
        throw new Error(`bgm fetch failed (${response.status})`);
    }
    const bytes = await response.arrayBuffer();
    const ctx = getAudioContext();
    logBgm('webaudio decode begin', { src: url, byteLength: bytes.byteLength, ctxState: ctx.state });
    const decoded = await Promise.race([
        ctx.decodeAudioData(bytes.slice(0)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('decode timeout')), 5000))
    ]);
    logBgm('webaudio decode done', { src: url, duration: decoded.duration });
    bgmBufferCache.set(url, decoded);
    return decoded;
}

async function startWebAudioBgmFallback(reason = '') {
    logBgm('webaudio fallback attempt', {
        reason,
        scene: bgmSceneKey,
        playlistSize: bgmPlaylist.length
    });
    if (isHtmlBgmPlaying()) {
        logBgm('webaudio fallback skipped: html audio already playing', { reason });
        return false;
    }
    if (!bgmPlaylist.length) {
        return false;
    }
    let ctx = null;
    try {
        ctx = getAudioContext();
    } catch (error) {
        logBgm('webaudio fallback blocked: context create failed', {
            reason,
            errorName: error?.name || '',
            errorMessage: error?.message || ''
        });
        return false;
    }
    if (ctx.state === 'suspended') {
        try {
            await Promise.race([
                ctx.resume(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('resume timeout')), 1200))
            ]);
        } catch (error) {
            logBgm('webaudio fallback resume blocked', {
                state: ctx.state,
                reason,
                errorName: error?.name || '',
                errorMessage: error?.message || ''
            });
        }
    }
    if (ctx.state !== 'running') {
        logBgm('webaudio fallback blocked: context not running', { state: ctx.state, reason });
        return false;
    }
    const safeIndex = Math.max(0, Math.min(bgmPlaylist.length - 1, bgmTrackIndex));
    const src = bgmPlaylist[safeIndex];
    try {
        const buffer = await decodeBgmBuffer(src);
        if (isHtmlBgmPlaying()) {
            logBgm('webaudio fallback skipped after decode: html audio already playing', { src, reason });
            return false;
        }
        stopWebAudioBgm();
        const gain = getBgmWebGainNode(ctx);
        gain.gain.setValueAtTime(clamp(bgmSceneVolume * audioMix.music * getCurrentTrackVolume(), 0, 1), ctx.currentTime);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.onended = () => {
            if (!bgmWebAudioActive || bgmWebSourceNode !== source) {
                return;
            }
            if (!bgmPlaylist.length) {
                return;
            }
            bgmTrackIndex = (bgmTrackIndex + 1) % bgmPlaylist.length;
            void startWebAudioBgmFallback('track-ended');
        };
        source.start(ctx.currentTime + 0.01);
        bgmWebSourceNode = source;
        bgmWebAudioActive = true;
        pendingBgmPlay = false;
        clearBgmRetryTimer();
        logBgm('webaudio fallback started', { src, reason, index: safeIndex });
        return true;
    } catch (error) {
        logBgm('webaudio fallback failed', {
            src,
            reason,
            errorName: error?.name || '',
            errorMessage: error?.message || ''
        });
        return false;
    }
}

function clearBgmRetryTimer() {
    if (!bgmRetryTimer) {
        return;
    }
    clearTimeout(bgmRetryTimer);
    bgmRetryTimer = 0;
}

function clearBgmUnmuteTimer() {
    if (!bgmUnmuteTimer) {
        return;
    }
    clearTimeout(bgmUnmuteTimer);
    bgmUnmuteTimer = 0;
}

function stopBgmUnmutePolling() {
    if (bgmUnmutePollingTimer) {
        clearInterval(bgmUnmutePollingTimer);
        bgmUnmutePollingTimer = 0;
    }
}

function tryUnmuteBgm() {
    if (!bgmAudioEl) {
        return false;
    }
    if (!bgmAudioEl.muted && !bgmMutedBootstrap) {
        stopBgmUnmutePolling();
        return true;
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        void audioCtx.resume().catch(() => {});
    }
    bgmAudioEl.muted = false;
    bgmMutedBootstrap = false;
    updateBgmElementVolume();
    const stillPlaying = !bgmAudioEl.paused;
    const hasUserActivation = !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
    if (stillPlaying && hasUserActivation) {
        logBgm('unmute success (polling)', { attempt: bgmUnmuteAttemptCount });
        stopBgmUnmutePolling();
        return true;
    }
    if (stillPlaying) {
        logBgm('unmute applied (no user activation yet)', { attempt: bgmUnmuteAttemptCount });
        stopBgmUnmutePolling();
        return true;
    }
    bgmAudioEl.muted = true;
    bgmMutedBootstrap = true;
    return false;
}

function startBgmUnmutePolling() {
    if (bgmUnmutePollingTimer) {
        return;
    }
    bgmUnmuteAttemptCount = 0;
    bgmUnmutePollingTimer = setInterval(() => {
        bgmUnmuteAttemptCount += 1;
        if (bgmUnmuteAttemptCount >= BGM_UNMUTE_MAX_ATTEMPTS) {
            logBgm('unmute polling exhausted; waiting for user interaction');
            stopBgmUnmutePolling();
            return;
        }
        tryUnmuteBgm();
    }, BGM_UNMUTE_INTERVAL_MS);
}

function scheduleBgmUnmute() {
    if (bgmUnmuteTimer) {
        return;
    }
    bgmUnmuteTimer = setTimeout(() => {
        bgmUnmuteTimer = 0;
        if (!bgmAudioEl) {
            return;
        }
        const ok = tryUnmuteBgm();
        if (!ok) {
            startBgmUnmutePolling();
        }
    }, 800);
}

function scheduleBgmRetry() {
    if (bgmRetryTimer || !pendingBgmPlay) {
        return;
    }
    bgmRetryTimer = setTimeout(() => {
        bgmRetryTimer = 0;
        attemptBgmPlayback();
    }, 900);
}

function updateBgmElementVolume() {
    const composed = clamp(bgmSceneVolume * audioMix.music * getCurrentTrackVolume(), 0, 1);
    if (bgmAudioEl) {
        if (ensureHtmlBgmGainRouting() && bgmHtmlMediaGainNode?.context) {
            bgmAudioEl.volume = 1;
            bgmHtmlMediaGainNode.gain.setValueAtTime(composed, bgmHtmlMediaGainNode.context.currentTime);
        } else {
            bgmAudioEl.volume = composed;
        }
    }
    if (bgmWebGainNode && bgmWebGainNode.context?.state === 'running') {
        bgmWebGainNode.gain.setValueAtTime(composed, bgmWebGainNode.context.currentTime);
    }
}

function getCurrentTrackVolume() {
    if (!bgmPlaylist.length) {
        return 1;
    }
    const safeIndex = Math.max(0, Math.min(bgmPlaylist.length - 1, bgmTrackIndex));
    const currentSrc = `${bgmPlaylist[safeIndex] || ''}`.trim();
    if (!currentSrc) {
        return 1;
    }
    const raw = Number(bgmSceneTrackVolumes.get(currentSrc));
    return Number.isFinite(raw) ? clamp(raw, 0, 1) : 1;
}

function isHtmlBgmPlaying() {
    return !!(bgmAudioEl && !bgmAudioEl.paused);
}

function attemptBgmPlayback() {
    if (bgmWebAudioActive) {
        logBgm('skip html audio play: webaudio fallback active');
        return;
    }
    if (!bgmPlaylist.length) {
        logBgm('skip play: empty playlist');
        pendingBgmPlay = false;
        clearBgmRetryTimer();
        return;
    }
    const audio = getBgmAudioElement();
    logBgm('play attempt', {
        src: audio.currentSrc || audio.src || '',
        paused: audio.paused,
        muted: audio.muted,
        volume: audio.volume,
        scene: bgmSceneKey
    });
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        void playPromise.then(() => {
            stopWebAudioBgm();
            logBgm('play success', {
                src: audio.currentSrc || audio.src || '',
                muted: audio.muted,
                volume: audio.volume
            });
            pendingBgmPlay = false;
            clearBgmRetryTimer();
            bgmConsecutiveErrorCount = 0;
            if (audio.muted || bgmMutedBootstrap) {
                scheduleBgmUnmute();
            }
        }).catch((error) => {
            logBgm('play failed (will try muted bootstrap)', {
                src: audio.currentSrc || audio.src || '',
                muted: audio.muted,
                scene: bgmSceneKey,
                errorName: error?.name || '',
                errorMessage: error?.message || '',
                visibility: document.visibilityState,
                hasUserActivation: !!(navigator.userActivation && navigator.userActivation.hasBeenActive)
            });
            if (!audio.muted) {
                audio.muted = true;
                bgmMutedBootstrap = true;
                const mutedPromise = audio.play();
                if (mutedPromise && typeof mutedPromise.catch === 'function') {
                    void mutedPromise.then(() => {
                        logBgm('muted bootstrap success', {
                            src: audio.currentSrc || audio.src || ''
                        });
                        pendingBgmPlay = false;
                        clearBgmRetryTimer();
                        bgmConsecutiveErrorCount = 0;
                        scheduleBgmUnmute();
                    }).catch((mutedError) => {
                        logBgm('muted bootstrap failed; schedule retry', {
                            src: audio.currentSrc || audio.src || '',
                            errorName: mutedError?.name || '',
                            errorMessage: mutedError?.message || '',
                            visibility: document.visibilityState,
                            hasUserActivation: !!(navigator.userActivation && navigator.userActivation.hasBeenActive)
                        });
                        void startWebAudioBgmFallback('muted-bootstrap-failed').then((ok) => {
                            if (ok) {
                                return;
                            }
                            pendingBgmPlay = true;
                            scheduleBgmRetry();
                        });
                    });
                    return;
                }
            }
            logBgm('schedule retry after play failure');
            void startWebAudioBgmFallback('play-failed').then((ok) => {
                if (ok) {
                    return;
                }
                pendingBgmPlay = true;
                scheduleBgmRetry();
            });
        });
    } else {
        logBgm('play resolved without promise');
        pendingBgmPlay = false;
        clearBgmRetryTimer();
        if (audio.muted || bgmMutedBootstrap) {
            scheduleBgmUnmute();
        }
    }
}

function ensureBgmStorageReadyForReplay(sceneKey) {
    pendingSceneReplayAfterStorage = `${sceneKey || ''}`.trim() || BGM_SCENE_KEYS.HOME;
    logBgm('storage not ready; queue replay', { scene: pendingSceneReplayAfterStorage });
    void initBgmStorage().then(() => {
        bgmStorageReady = true;
        const replayScene = pendingSceneReplayAfterStorage || BGM_SCENE_KEYS.HOME;
        pendingSceneReplayAfterStorage = '';
        if (replayScene) {
            logBgm('storage ready; replay scene', { scene: replayScene });
            playBgmForScene(replayScene, { restart: true });
        }
    }).catch(() => {
        logBgm('storage init failed; keep local fallback');
        // ignore; local fallback is still usable
    });
}

function getBgmAudioElement() {
    if (!bgmAudioEl) {
        bgmAudioEl = document.createElement('audio');
        bgmAudioEl.preload = 'auto';
        bgmAudioEl.autoplay = true;
        bgmAudioEl.playsInline = true;
        bgmAudioEl.loop = false;
        bgmAudioEl.style.position = 'fixed';
        bgmAudioEl.style.width = '1px';
        bgmAudioEl.style.height = '1px';
        bgmAudioEl.style.opacity = '0';
        bgmAudioEl.style.pointerEvents = 'none';
        bgmAudioEl.style.left = '-9999px';
        if (document.body && !document.body.contains(bgmAudioEl)) {
            document.body.appendChild(bgmAudioEl);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body && !document.body.contains(bgmAudioEl)) {
                    document.body.appendChild(bgmAudioEl);
                }
            }, { once: true });
        }
        bgmAudioEl.addEventListener('playing', () => {
            logBgm('audio playing event', {
                src: bgmAudioEl?.currentSrc || '',
                muted: bgmAudioEl?.muted
            });
            pendingBgmPlay = false;
            clearBgmRetryTimer();
            if (bgmAudioEl?.muted || bgmMutedBootstrap) {
                scheduleBgmUnmute();
            }
        });
        bgmAudioEl.addEventListener('ended', () => {
            bgmConsecutiveErrorCount = 0;
            logBgm('track ended; next');
            playNextBgmTrack();
        });
        bgmAudioEl.addEventListener('error', () => {
            const errCode = Number(bgmAudioEl?.error?.code || 0);
            logBgm('audio element error', {
                code: errCode,
                src: bgmAudioEl?.currentSrc || bgmAudioEl?.src || '',
                consecutiveErrors: bgmConsecutiveErrorCount + 1
            });
            bgmConsecutiveErrorCount += 1;
            if (bgmConsecutiveErrorCount >= Math.max(1, bgmPlaylist.length)) {
                bgmPlaylist = ['assets/audio/bgm/\u5c0f\u86c7\u51fa\u4e0d\u53bb1.mp3'];
                bgmSceneTrackVolumes = new Map([[bgmPlaylist[0], 1]]);
                bgmTrackIndex = 0;
                bgmPlaylistSignature = playlistSignature(bgmPlaylist);
                bgmConsecutiveErrorCount = 0;
                logBgm('fallback to default track after consecutive errors', { src: bgmPlaylist[0] });
                playCurrentBgmTrack();
                return;
            }
            playNextBgmTrack();
        });
        updateBgmElementVolume();
        if (typeof document !== 'undefined') {
            const retry = () => {
                if (pendingBgmPlay) {
                    attemptBgmPlayback();
                }
            };
            document.addEventListener('visibilitychange', retry);
            window.addEventListener('focus', retry);
            window.addEventListener('pageshow', retry);
        }
    }
    return bgmAudioEl;
}

function getBgmSceneConfig(sceneKey) {
    const config = readBgmConfig();
    const scenes = config?.scenes || {};
    const fallbackKey = BGM_SCENE_KEYS.HOME;
    const key = Object.prototype.hasOwnProperty.call(scenes, sceneKey)
        ? sceneKey
        : fallbackKey;
    const scene = scenes[key] || {};
    const normalizedPlaylist = normalizePlaylistForPlayback(scene.playlist);
    const playlist = normalizedPlaylist.map((item) => item.url);
    const trackVolumes = new Map(normalizedPlaylist.map((item) => [item.url, item.volume]));
    const volume = Math.max(0, Math.min(1, Number(scene.volume) || 0));
    return {
        playlist,
        trackVolumes,
        volume
    };
}

function normalizePlaylistForPlayback(rawPlaylist) {
    const rows = Array.isArray(rawPlaylist) ? rawPlaylist : [];
    const out = [];
    const seen = new Set();
    for (const row of rows) {
        let url = '';
        let volume = 1;
        if (typeof row === 'string') {
            url = row.trim();
        } else if (row && typeof row === 'object') {
            url = `${row.url || row.src || row.path || ''}`.trim();
            volume = clamp(Number(row.volume), 0, 1);
        }
        if (!url || seen.has(url)) {
            continue;
        }
        out.push({ url, volume });
        seen.add(url);
    }
    return out;
}

function playlistSignature(playlist) {
    return Array.isArray(playlist) ? playlist.join('\n') : '';
}

function playCurrentBgmTrack(options = {}) {
    const forceReload = options?.forceReload === true;
    if (!bgmPlaylist.length) {
        return;
    }
    const audio = getBgmAudioElement();
    const safeIndex = Math.max(0, Math.min(bgmPlaylist.length - 1, bgmTrackIndex));
    const nextSrc = bgmPlaylist[safeIndex];
    if (!nextSrc) {
        return;
    }
    stopWebAudioBgm();
    if (forceReload || audio.src !== nextSrc) {
        logBgm('load track', { src: nextSrc, index: safeIndex, total: bgmPlaylist.length });
        if (forceReload && !audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
        audio.src = nextSrc;
        if (!navigator.userActivation?.hasBeenActive) {
            audio.muted = true;
            bgmMutedBootstrap = true;
        }
        audio.load();
    }
    updateBgmElementVolume();
    pendingBgmPlay = true;
    if (!navigator.userActivation?.hasBeenActive && audio.autoplay && audio.muted) {
        logBgm('wait native muted autoplay before manual play', { src: nextSrc });
        clearBgmRetryTimer();
        bgmRetryTimer = setTimeout(() => {
            bgmRetryTimer = 0;
            if (audio.paused) {
                attemptBgmPlayback();
            }
        }, 700);
    } else {
        attemptBgmPlayback();
    }
}

function playNextBgmTrack() {
    if (!bgmPlaylist.length) {
        return;
    }
    bgmTrackIndex = (bgmTrackIndex + 1) % bgmPlaylist.length;
    const audio = getBgmAudioElement();
    stopWebAudioBgm();
    logBgm('switch next track', {
        index: bgmTrackIndex,
        src: bgmPlaylist[bgmTrackIndex],
        total: bgmPlaylist.length
    });
    audio.src = bgmPlaylist[bgmTrackIndex];
    audio.load();
    updateBgmElementVolume();
    pendingBgmPlay = true;
    attemptBgmPlayback();
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
        gain.connect(getSfxOutputNode(ctx));

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

export function readAudioMixConfig() {
    return { ...audioMix };
}

export function setMusicVolume(value, options = {}) {
    const next = clamp(Number(value), 0, 1);
    if (!Number.isFinite(next)) {
        return audioMix.music;
    }
    audioMix.music = next;
    if (options.persist !== false) {
        persistAudioMix();
    }
    updateBgmElementVolume();
    attemptBgmPlayback();
    return audioMix.music;
}

export function setSfxVolume(value, options = {}) {
    const next = clamp(Number(value), 0, 1);
    if (!Number.isFinite(next)) {
        return audioMix.sfx;
    }
    audioMix.sfx = next;
    if (options.persist !== false) {
        persistAudioMix();
    }
    applySfxMixVolume();
    return audioMix.sfx;
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
    void initBgmStorage().then(() => {
        bgmStorageReady = true;
        logBgm('storage ready from resumeAudio');
    }).catch(() => {});
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        void ctx.resume();
    }
    if (bgmAudioEl) {
        bgmAudioEl.muted = false;
        bgmMutedBootstrap = false;
        clearBgmUnmuteTimer();
        stopBgmUnmutePolling();
    }
    applySfxMixVolume();
    updateBgmElementVolume();
    attemptBgmPlayback();
}

export function stopBgm() {
    bgmSceneKey = '';
    bgmPlaylist = [];
    bgmTrackIndex = 0;
    bgmPlaylistSignature = '';
    bgmSceneVolume = 1;
    bgmSceneTrackVolumes = new Map();
    pendingBgmPlay = false;
    clearBgmRetryTimer();
    clearBgmUnmuteTimer();
    stopBgmUnmutePolling();
    bgmMutedBootstrap = false;
    stopWebAudioBgm();
    if (!bgmAudioEl) {
        return;
    }
    bgmAudioEl.muted = false;
    bgmAudioEl.pause();
    bgmAudioEl.removeAttribute('src');
    bgmAudioEl.load();
}

export function playBgmForScene(sceneKey, options = {}) {
    const requestedSceneKey = `${sceneKey || ''}`.trim() || BGM_SCENE_KEYS.HOME;
    const sceneChanged = !!bgmSceneKey && bgmSceneKey !== requestedSceneKey;
    const restart = options?.restart === true || sceneChanged;
    if (!bgmStorageReady) {
        ensureBgmStorageReadyForReplay(requestedSceneKey);
        return;
    }
    const scene = getBgmSceneConfig(requestedSceneKey);
    const signature = playlistSignature(scene.playlist);
    const audio = getBgmAudioElement();
    bgmSceneVolume = scene.volume;
    bgmSceneTrackVolumes = scene.trackVolumes || new Map();
    updateBgmElementVolume();
    logBgm('play scene', {
        scene: requestedSceneKey,
        restart,
        playlist: scene.playlist,
        volume: scene.volume
    });

    if (!scene.playlist.length) {
        stopBgm();
        return;
    }

    if (!restart && signature === bgmPlaylistSignature) {
        bgmSceneKey = requestedSceneKey;
        if (audio.paused) {
            logBgm('reuse current playlist; resume');
            pendingBgmPlay = true;
            attemptBgmPlayback();
        }
        return;
    }

    bgmSceneKey = requestedSceneKey;
    bgmPlaylist = [...scene.playlist];
    bgmTrackIndex = 0;
    bgmPlaylistSignature = signature;
    playCurrentBgmTrack({ forceReload: restart });
}

export function playClearSound() {
    void initAudioProfileStorage();
    const recipe = getActiveRecipe();
    void playPresetSample(recipe, 1.05, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.01, Date.now() + 131, 1.05, recipe.presetId, getSfxOutputNode(ctx));
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.01, Date.now() + 131, 1.05, recipe.presetId, getSfxOutputNode(ctx));
    });
}

export function playClearSoundExclusive() {
    void initAudioProfileStorage();
    const recipe = getActiveRecipe();
    const ctx = getAudioContext();
    const estimatedDuration = estimateRecipeDuration(recipe, recipe.presetId);
    if (ctx.currentTime < clearSoundExclusiveUntil) {
        return;
    }
    clearSoundExclusiveUntil = ctx.currentTime + estimatedDuration + 0.03;

    void playPresetSample(recipe, 1.05, 1).then((played) => {
        if (!played) {
            const start = ctx.currentTime + 0.01;
            const endAt = synthRecipe(ctx, recipe, start, Date.now() + 131, 1.05, recipe.presetId, getSfxOutputNode(ctx));
            clearSoundExclusiveUntil = Math.max(clearSoundExclusiveUntil, endAt + 0.01);
        }
    }).catch(() => {
        const start = ctx.currentTime + 0.01;
        const endAt = synthRecipe(ctx, recipe, start, Date.now() + 131, 1.05, recipe.presetId, getSfxOutputNode(ctx));
        clearSoundExclusiveUntil = Math.max(clearSoundExclusiveUntil, endAt + 0.01);
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
    gainMain.connect(getSfxOutputNode(ctx));
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
    gainHarm.connect(getSfxOutputNode(ctx));
    oscHarm.start(start);
    oscHarm.stop(start + 0.2);
}

export function playErrorSound() {
    void initAudioProfileStorage();
    const recipe = getGameEventRecipe('error', 'fail-plop');
    void playPresetSample(recipe, 0.96, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 73, 0.96, recipe.presetId, getSfxOutputNode(ctx));
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 73, 0.96, recipe.presetId, getSfxOutputNode(ctx));
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
            cursor = synthRecipe(ctx, recipe, cursor, Date.now() + i * 211, 0.95, recipe.presetId, getSfxOutputNode(ctx)) + 0.012;
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
            cursor = synthRecipe(ctx, recipe, cursor, Date.now() + i * 307, 0.92, recipe.presetId, getSfxOutputNode(ctx)) + 0.018;
        }
    }).catch(() => {});
}

export function playClickSound() {
    void initAudioProfileStorage();
    const recipe = getGameEventRecipe('click', 'syrup-pop');
    void playPresetSample(recipe, 0.84, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 19, 0.84, recipe.presetId, getSfxOutputNode(ctx));
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 19, 0.84, recipe.presetId, getSfxOutputNode(ctx));
    });
}

export function playCoinPopSound() {
    void initAudioProfileStorage();
    const recipe = getGameEventRecipe('coin', 'syrup-pop');
    void playPresetSample(recipe, 0.9, 1).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 47, 0.9, recipe.presetId, getSfxOutputNode(ctx));
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 47, 0.9, recipe.presetId, getSfxOutputNode(ctx));
    });
}

export function playCheckinRewardCoinSound() {
    void initAudioProfileStorage();
    const recipe = getGameEventRecipe('checkinCoinTrail', 'syrup-pop');
    void playPresetSample(recipe, 0.88, 1.06).then((played) => {
        if (!played) {
            const ctx = getAudioContext();
            synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 61, 0.88, recipe.presetId, getSfxOutputNode(ctx));
        }
    }).catch(() => {
        const ctx = getAudioContext();
        synthRecipe(ctx, recipe, ctx.currentTime + 0.005, Date.now() + 61, 0.88, recipe.presetId, getSfxOutputNode(ctx));
    });
}

export function earlyBgmBootstrap() {
    if (earlyBootstrapDone) {
        return;
    }
    earlyBootstrapDone = true;
    logBgm('early bootstrap start');
    const defaultSrc = 'assets/audio/bgm/\u5c0f\u86c7\u51fa\u4e0d\u53bb1.mp3';
    const audio = getBgmAudioElement();
    bgmSceneKey = 'home';
    bgmPlaylist = [defaultSrc];
    bgmTrackIndex = 0;
    bgmPlaylistSignature = defaultSrc;
    bgmSceneVolume = 0.65;
    bgmSceneTrackVolumes = new Map([[defaultSrc, 1]]);
    audio.src = defaultSrc;
    audio.muted = true;
    bgmMutedBootstrap = true;
    audio.load();
    updateBgmElementVolume();
    pendingBgmPlay = true;
    const playMuted = audio.play();
    if (playMuted && typeof playMuted.then === 'function') {
        void playMuted.then(() => {
            logBgm('early muted autoplay started', { src: defaultSrc });
            scheduleBgmUnmute();
        }).catch((err) => {
            logBgm('early muted autoplay failed', {
                errorName: err?.name || '',
                errorMessage: err?.message || ''
            });
            pendingBgmPlay = true;
        });
    }
}

void initAudioProfileStorage();



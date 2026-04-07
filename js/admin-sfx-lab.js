import { getSkinCatalog, isLegacyColorVariantSkinId } from './skins.js?v=23';
import {
    BUILTIN_SFX_PRESETS,
    SFX_PARAM_SCHEMA,
    deleteCustomSfxPreset,
    getSfxPresetById,
    getSfxPresetCatalog,
    getSfxPresetSample,
    getGameSfxPresetId,
    initSfxStorage,
    normalizeRecipe,
    readGameSfxBindings,
    readSfxLabState,
    readSkinSfxBindings,
    setCustomSfxPresetSample,
    setGameSfxPresetId,
    setSfxPresetParamOverride,
    setSkinSfxPresetId,
    upsertCustomSfxPreset,
    writeGameSfxBindings,
    writeSfxLabState,
    writeSkinSfxBindings
} from './sfx-storage.js?v=6';
import { estimateRecipeDuration, synthRecipe } from './sfx-synth.js?v=2';
import { BGM_SCENE_KEYS, initBgmStorage, readBgmConfig, writeBgmConfig } from './bgm-storage.js?v=5';

const EXPORT_SAMPLE_RATE = 48_000;
const PACK_VARIANT_COUNT = 5;
const DEFAULT_SKIN_ID = 'classic-burrow';

const paramFieldConfig = [
    { key: 'impact', rangeId: 'sfxImpactRange', numberId: 'sfxImpactNumber' },
    { key: 'pitchSemitone', rangeId: 'sfxPitchRange', numberId: 'sfxPitchNumber' },
    { key: 'length', rangeId: 'sfxLengthRange', numberId: 'sfxLengthNumber' },
    { key: 'randomness', rangeId: 'sfxRandomnessRange', numberId: 'sfxRandomnessNumber' },
    { key: 'bounce', rangeId: 'sfxBounceRange', numberId: 'sfxBounceNumber' },
    { key: 'repeats', rangeId: 'sfxRepeatsRange', numberId: 'sfxRepeatsNumber' }
];

const el = {
    musicSfxTabButtons: Array.from(document.querySelectorAll('[data-music-sfx-tab-target]')),
    musicSfxTabPanels: Array.from(document.querySelectorAll('[data-music-sfx-tab-panel]')),

    presetSelect: document.getElementById('sfxPresetSelect'),
    presetHint: document.getElementById('sfxPresetHint'),
    estimatedDuration: document.getElementById('sfxEstimatedDuration'),
    presetLibraryList: document.getElementById('sfxPresetLibraryList'),
    customName: document.getElementById('sfxCustomName'),
    customDesc: document.getElementById('sfxCustomDesc'),
    status: document.getElementById('sfxStatus'),
    btnPlay: document.getElementById('btnSfxPlay'),
    btnPlayBurst: document.getElementById('btnSfxPlayBurst'),
    btnDownloadWav: document.getElementById('btnSfxDownloadWav'),
    btnDownloadPack: document.getElementById('btnSfxDownloadPack'),
    btnReset: document.getElementById('btnSfxReset'),
    btnSaveAsNewPreset: document.getElementById('btnSfxSaveAsNewPreset'),
    btnUpdatePreset: document.getElementById('btnSfxUpdatePreset'),
    btnDeletePreset: document.getElementById('btnSfxDeletePreset'),
    skinSelect: document.getElementById('skinSfxSkinSelect'),
    skinPresetSelect: document.getElementById('skinSfxPresetSelect'),
    btnSkinSave: document.getElementById('btnSkinSfxSave'),
    btnSkinReset: document.getElementById('btnSkinSfxReset'),
    skinStatus: document.getElementById('skinSfxStatus'),
    skinBindingList: document.getElementById('skinSfxBindingList'),
    gameSfxClickPresetSelect: document.getElementById('gameSfxClickPresetSelect'),
    gameSfxCoinPresetSelect: document.getElementById('gameSfxCoinPresetSelect'),
    gameSfxCheckinCoinTrailPresetSelect: document.getElementById('gameSfxCheckinCoinTrailPresetSelect'),
    gameSfxErrorPresetSelect: document.getElementById('gameSfxErrorPresetSelect'),
    gameSfxLevelCompletePresetSelect: document.getElementById('gameSfxLevelCompletePresetSelect'),
    gameSfxGameOverPresetSelect: document.getElementById('gameSfxGameOverPresetSelect'),
    btnGameSfxSave: document.getElementById('btnGameSfxSave'),
    btnGameSfxReset: document.getElementById('btnGameSfxReset'),
    gameSfxStatus: document.getElementById('gameSfxStatus'),
    btnGameSfxPreviewClick: document.getElementById('btnGameSfxPreviewClick'),
    btnGameSfxPreviewCoin: document.getElementById('btnGameSfxPreviewCoin'),
    btnGameSfxPreviewCheckinCoinTrail: document.getElementById('btnGameSfxPreviewCheckinCoinTrail'),
    btnGameSfxPreviewError: document.getElementById('btnGameSfxPreviewError'),
    btnGameSfxPreviewLevelComplete: document.getElementById('btnGameSfxPreviewLevelComplete'),
    btnGameSfxPreviewGameOver: document.getElementById('btnGameSfxPreviewGameOver'),
    gameMusicHomeTracks: document.getElementById('gameMusicHomeTracks'),
    gameMusicHomeVolume: document.getElementById('gameMusicHomeVolume'),
    gameMusicNormalTracks: document.getElementById('gameMusicNormalTracks'),
    gameMusicNormalVolume: document.getElementById('gameMusicNormalVolume'),
    gameMusicRewardTracks: document.getElementById('gameMusicRewardTracks'),
    gameMusicRewardVolume: document.getElementById('gameMusicRewardVolume'),
    gameMusicCompleteTracks: document.getElementById('gameMusicCompleteTracks'),
    gameMusicCompleteVolume: document.getElementById('gameMusicCompleteVolume'),
    btnGameMusicRefreshLibrary: document.getElementById('btnGameMusicRefreshLibrary'),
    btnGameMusicSave: document.getElementById('btnGameMusicSave'),
    btnGameMusicReset: document.getElementById('btnGameMusicReset'),
    gameMusicStatus: document.getElementById('gameMusicStatus'),
    gameMusicLibraryHint: document.getElementById('gameMusicLibraryHint'),

    sourceMode: document.getElementById('sfxSourceMode'),
    sourceSynthPanel: document.getElementById('sfxSourceSynthPanel'),
    sourceUploadPanel: document.getElementById('sfxSourceUploadPanel'),
    sourceFreesoundPanel: document.getElementById('sfxSourceFreesoundPanel'),
    sourceStablePanel: document.getElementById('sfxSourceStablePanel'),

    sampleFile: document.getElementById('sfxSampleFile'),
    fsQuery: document.getElementById('sfxFsQuery'),
    fsLicense: document.getElementById('sfxFsLicense'),
    btnFsSearch: document.getElementById('btnSfxFsSearch'),
    fsStatus: document.getElementById('sfxFsStatus'),
    fsResults: document.getElementById('sfxFsResults'),
    aiPrompt: document.getElementById('sfxAiPrompt'),
    aiDuration: document.getElementById('sfxAiDuration'),
    btnAiGenerate: document.getElementById('btnSfxAiGenerate'),
    aiStatus: document.getElementById('sfxAiStatus'),

    externalPreviewWrap: document.getElementById('sfxExternalPreviewWrap'),
    externalPreviewAudio: document.getElementById('sfxExternalPreviewAudio'),
    externalSourceLabel: document.getElementById('sfxExternalSourceLabel'),
    trimStart: document.getElementById('sfxTrimStart'),
    trimEnd: document.getElementById('sfxTrimEnd'),
    btnApplyTrim: document.getElementById('btnSfxApplyTrim'),
    btnResetTrim: document.getElementById('btnSfxResetTrim'),
    trimStatus: document.getElementById('sfxTrimStatus'),
    btnUseExternalAsPreview: document.getElementById('btnSfxUseExternalAsPreview'),
    btnBindExternalToPreset: document.getElementById('btnSfxBindExternalToPreset'),
    btnClearExternal: document.getElementById('btnSfxClearExternal')
};

for (const field of paramFieldConfig) {
    field.range = document.getElementById(field.rangeId);
    field.number = document.getElementById(field.numberId);
}

const state = {
    presetId: BUILTIN_SFX_PRESETS[0].id,
    params: { ...BUILTIN_SFX_PRESETS[0].defaults },
    skinRows: [],
    skinBindings: {},
    gameSfxBindings: {},
    sourceMode: 'synth',
    previewMode: 'synth',
    providerCaps: {
        freesound: false,
        stableAudioOpen: false,
        stableAudioFal: false,
        stableAudioHf: false,
        stableAudioBackend: ''
    },
    bgmTrackLibrary: [],
    bgmPreview: {
        audio: null,
        trackUrl: '',
        isPlaying: false
    },
    externalSample: null,
    externalTrim: null
};

let realtimeAudioCtx = null;
const presetSampleBufferCache = new Map();

function sanitizeId(rawId) {
    return `${rawId || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeName(rawName, fallback = '') {
    const text = `${rawName || ''}`.replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function normalizeSavedSkinRows(rawRows) {
    const rows = Array.isArray(rawRows) ? rawRows : [];
    const candidateBaseIdSet = new Set(rows.map((row) => sanitizeId(row?.id)).filter(Boolean));
    candidateBaseIdSet.add(DEFAULT_SKIN_ID);
    const out = [];
    const seen = new Set();
    for (const row of rows) {
        const id = sanitizeId(row?.id);
        if (!id || seen.has(id) || row?.complete !== true) {
            continue;
        }
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        out.push({
            id,
            nameZh: normalizeName(row?.nameZh, id)
        });
        seen.add(id);
    }
    return out;
}

async function fetchSavedSkinRows() {
    try {
        const response = await fetch('/api/skin-gen/saved-skins', {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json().catch(() => ({}));
        return normalizeSavedSkinRows(payload?.skins);
    } catch {
        return [];
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function setStatus(text, isError = false) {
    if (!el.status) return;
    el.status.textContent = text || '';
    el.status.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setSkinStatus(text, isError = false) {
    if (!el.skinStatus) return;
    el.skinStatus.textContent = text || '';
    el.skinStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setGameSfxStatus(text, isError = false) {
    if (!el.gameSfxStatus) return;
    el.gameSfxStatus.textContent = text || '';
    el.gameSfxStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setGameMusicStatus(text, isError = false) {
    if (!el.gameMusicStatus) return;
    el.gameMusicStatus.textContent = text || '';
    el.gameMusicStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setFsStatus(text, isError = false) {
    if (!el.fsStatus) return;
    el.fsStatus.textContent = text || '';
    el.fsStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setAiStatus(text, isError = false) {
    if (!el.aiStatus) return;
    el.aiStatus.textContent = text || '';
    el.aiStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setTrimStatus(text, isError = false) {
    if (!el.trimStatus) return;
    el.trimStatus.textContent = text || '';
    el.trimStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function sanitizeLabel(text, fallback = 'external-sfx') {
    const normalized = `${text || ''}`.trim();
    return normalized || fallback;
}

function slugifyLabel(text, fallback = 'external-sfx') {
    const normalized = `${text || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function setSourceMode(mode) {
    const nextMode = ['synth', 'upload', 'freesound', 'stable-audio'].includes(mode) ? mode : 'synth';
    state.sourceMode = nextMode;
    if (el.sourceMode) el.sourceMode.value = nextMode;

    const panelMap = [
        { mode: 'synth', node: el.sourceSynthPanel },
        { mode: 'upload', node: el.sourceUploadPanel },
        { mode: 'freesound', node: el.sourceFreesoundPanel },
        { mode: 'stable-audio', node: el.sourceStablePanel }
    ];
    for (const item of panelMap) {
        if (!item.node) continue;
        item.node.classList.toggle('is-active', item.mode === nextMode);
    }
}

function setMusicSfxSubTab(tabId) {
    const targetId = `${tabId || ''}`.trim() || 'sfx-lab';
    for (const button of el.musicSfxTabButtons) {
        const isActive = button.dataset.musicSfxTabTarget === targetId;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    for (const panel of el.musicSfxTabPanels) {
        const isActive = panel.dataset.musicSfxTabPanel === targetId;
        panel.classList.toggle('is-active', isActive);
    }
}

function clearExternalPreviewAudioUrl() {
    const url = el.externalPreviewAudio?.dataset?.objectUrl || '';
    if (url) {
        URL.revokeObjectURL(url);
        if (el.externalPreviewAudio?.dataset) {
            delete el.externalPreviewAudio.dataset.objectUrl;
        }
    }
}

function renderExternalSampleState() {
    const hasExternal = !!state.externalSample;
    if (el.externalPreviewWrap) {
        el.externalPreviewWrap.hidden = !hasExternal;
    }
    if (!hasExternal) {
        clearExternalPreviewAudioUrl();
        if (el.externalPreviewAudio) {
            el.externalPreviewAudio.removeAttribute('src');
            el.externalPreviewAudio.load();
        }
        if (el.externalSourceLabel) el.externalSourceLabel.textContent = '-';
        if (el.trimStart) el.trimStart.value = '0';
        if (el.trimEnd) el.trimEnd.value = '0';
        setTrimStatus('未裁切。');
        return;
    }
    if (el.externalSourceLabel) {
        el.externalSourceLabel.textContent = sanitizeLabel(state.externalSample.sourceLabel, 'external');
    }
    if (el.externalPreviewAudio) {
        clearExternalPreviewAudioUrl();
        const objectUrl = URL.createObjectURL(state.externalSample.blob);
        el.externalPreviewAudio.src = objectUrl;
        el.externalPreviewAudio.dataset.objectUrl = objectUrl;
    }
    const duration = Number(state.externalSample?.buffer?.duration || 0);
    if (el.trimStart) el.trimStart.value = '0';
    if (el.trimEnd) el.trimEnd.value = duration > 0 ? duration.toFixed(2) : '0';
    if (!state.externalTrim) {
        setTrimStatus(`原始时长：${duration.toFixed(2)}s（未裁切）`);
    } else {
        const trimmedDuration = Math.max(0, Number(state.externalTrim.end) - Number(state.externalTrim.start));
        setTrimStatus(
            `已裁切：${state.externalTrim.start.toFixed(2)}s - ${state.externalTrim.end.toFixed(2)}s（${trimmedDuration.toFixed(2)}s）`
        );
    }
}

function clearExternalSample() {
    state.externalSample = null;
    state.externalTrim = null;
    state.previewMode = 'synth';
    renderExternalSampleState();
    refreshCustomEditorByPreset();
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read sample failed'));
        reader.onload = () => resolve(`${reader.result || ''}`);
        reader.readAsDataURL(blob);
    });
}

function dataUrlToArrayBuffer(dataUrl) {
    const idx = `${dataUrl || ''}`.indexOf(',');
    if (idx <= 0) {
        throw new Error('invalid audio data url');
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
    const cached = presetSampleBufferCache.get(presetId);
    if (cached && cached.signature === signature && cached.buffer) {
        return cached.buffer;
    }
    const arrayBuffer = dataUrlToArrayBuffer(sample.dataUrl);
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    presetSampleBufferCache.set(presetId, {
        signature,
        buffer: decoded
    });
    return decoded;
}

async function playPresetSample(ctx, presetId, params = {}, startAt = 0.01, gainValue = 1, playbackRate = 1) {
    const buffer = await decodePresetSampleBuffer(ctx, presetId);
    if (!buffer) {
        return false;
    }
    const plan = buildExternalPlaybackPlan(params, Date.now());
    let cursor = startAt;
    for (let i = 0; i < plan.repeats; i += 1) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const rate = clamp(plan.baseRate * playbackRate * plan.jitter(i), 0.45, 2.2);
        source.playbackRate.setValueAtTime(rate, cursor);
        const gain = ctx.createGain();
        const repeatDecay = Math.pow(0.82 - plan.bounce * 0.14, i);
        gain.gain.setValueAtTime(clamp(plan.impact * gainValue * repeatDecay, 0.03, 1.8), cursor);
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(cursor);
        const renderedDuration = buffer.duration / rate;
        source.stop(cursor + renderedDuration + 0.02);
        cursor += renderedDuration * clamp(0.62 - plan.bounce * 0.22, 0.28, 0.72);
    }
    return true;
}

async function setExternalSampleFromBlob(blob, sourceLabel = 'external-sfx', explicitFileName = '') {
    if (!(blob instanceof Blob) || blob.size <= 0) {
        throw new Error('empty audio blob');
    }
    const ctx = ensureAudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    state.externalSample = {
        blob,
        buffer: decoded,
        sourceLabel: sanitizeLabel(sourceLabel, 'external-sfx'),
        fileName: sanitizeLabel(explicitFileName || sourceLabel, 'external-sfx')
    };
    state.previewMode = 'external';
    renderExternalSampleState();
    refreshCustomEditorByPreset();
}

function getPreviewMode() {
    if (state.previewMode === 'external' && state.externalSample?.buffer) {
        return 'external';
    }
    return 'synth';
}

function resolveExternalTrimWindow() {
    const sample = state.externalSample;
    const duration = Number(sample?.buffer?.duration || 0);
    if (!sample?.buffer || duration <= 0) {
        return null;
    }
    const start = clamp(Number(state.externalTrim?.start || 0), 0, Math.max(0, duration - 0.01));
    const end = clamp(Number(state.externalTrim?.end || duration), start + 0.01, duration);
    return { start, end, duration };
}

function buildExternalPlaybackPlan(params = {}, seed = Date.now()) {
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
    return { impact, impactGain, randomness, bounce, repeats, baseRate, jitter };
}

function playExternalSample(ctx, startAt = 0, params = {}, gainBoost = 1, playbackRateMul = 1) {
    const sample = state.externalSample;
    if (!sample?.buffer) return startAt;
    const trim = resolveExternalTrimWindow();
    const offset = trim ? trim.start : 0;
    const partDuration = trim ? Math.max(0.01, trim.end - trim.start) : sample.buffer.duration;
    const plan = buildExternalPlaybackPlan(params, Date.now());

    let cursor = startAt;
    for (let i = 0; i < plan.repeats; i += 1) {
        const source = ctx.createBufferSource();
        source.buffer = sample.buffer;
        const rate = clamp(plan.baseRate * playbackRateMul * plan.jitter(i), 0.45, 2.2);
        source.playbackRate.setValueAtTime(rate, cursor);

        const gain = ctx.createGain();
        const repeatDecay = Math.pow(0.82 - plan.bounce * 0.14, i);
        const gainValue = clamp(plan.impactGain * gainBoost * repeatDecay, 0.02, 3.2);
        gain.gain.setValueAtTime(gainValue, cursor);
        source.connect(gain);
        gain.connect(ctx.destination);

        source.start(cursor, offset, partDuration);
        const renderedDuration = partDuration / rate;
        source.stop(cursor + renderedDuration + 0.02);
        const overlapFactor = clamp(0.62 - plan.bounce * 0.22, 0.28, 0.72);
        cursor += renderedDuration * overlapFactor;
    }
    return cursor;
}

async function fetchJsonWithError(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const detail = payload?.detail ? ` ${payload.detail}` : '';
        throw new Error(payload?.error ? `${payload.error}${detail}` : `request failed (${response.status})`);
    }
    return response.json();
}

async function fetchProviderCaps() {
    try {
        const data = await fetchJsonWithError('/api/sfx/providers');
        state.providerCaps = {
            freesound: !!data?.providers?.freesound,
            stableAudioOpen: !!data?.providers?.stableAudioOpen,
            stableAudioFal: !!data?.providers?.stableAudioFal,
            stableAudioHf: !!data?.providers?.stableAudioHf,
            stableAudioBackend: `${data?.providers?.stableAudioBackend || ''}`.trim().toLowerCase()
        };
    } catch {
        state.providerCaps = {
            freesound: false,
            stableAudioOpen: false,
            stableAudioFal: false,
            stableAudioHf: false,
            stableAudioBackend: ''
        };
    }

    if (el.btnFsSearch) {
        el.btnFsSearch.disabled = !state.providerCaps.freesound;
    }
    if (el.btnAiGenerate) {
        el.btnAiGenerate.disabled = !state.providerCaps.stableAudioOpen;
    }
    if (!state.providerCaps.freesound) {
        setFsStatus('Freesound 未配置：请在启动服务时设置 FREESOUND_API_KEY。', true);
    } else {
        setFsStatus('就绪。');
    }
    if (!state.providerCaps.stableAudioOpen) {
        setAiStatus('Stable Audio 未配置：请设置 FAL_KEY（推荐）或 HUGGINGFACE_API_TOKEN。', true);
    } else if (state.providerCaps.stableAudioBackend === 'fal' || state.providerCaps.stableAudioFal) {
        setAiStatus('就绪。当前后端：fal.ai');
    } else if (state.providerCaps.stableAudioHf) {
        setAiStatus('就绪。当前后端：Hugging Face');
    } else {
        setAiStatus('就绪。');
    }
}

function getCurrentRecipe() {
    return {
        presetId: state.presetId,
        params: { ...state.params }
    };
}

function formatParamNumber(key, value) {
    const schema = SFX_PARAM_SCHEMA[key];
    if (!schema) return `${value}`;
    if (schema.integer) return `${Math.round(value)}`;
    return Number(value).toFixed(schema.digits);
}

function syncParamFieldsFromState() {
    for (const field of paramFieldConfig) {
        const value = state.params[field.key];
        const text = formatParamNumber(field.key, value);
        if (field.range) field.range.value = text;
        if (field.number) field.number.value = text;
    }
}

function estimateDurationSeconds(recipe) {
    return estimateRecipeDuration(recipe, state.presetId);
}

function refreshPresetSummary() {
    const preset = getSfxPresetById(state.presetId);
    if (el.presetHint) el.presetHint.textContent = preset.description || '-';
    if (el.estimatedDuration) el.estimatedDuration.textContent = `${estimateDurationSeconds(getCurrentRecipe()).toFixed(2)}s`;
}

function persistLabState() {
    writeSfxLabState(getCurrentRecipe());
}

function applyRecipe(recipe, persist = true) {
    const normalized = normalizeRecipe(recipe, state.presetId);
    state.presetId = normalized.presetId;
    state.params = { ...normalized.params };
    if (el.presetSelect) el.presetSelect.value = state.presetId;
    syncParamFieldsFromState();
    refreshPresetSummary();
    refreshCustomEditorByPreset();
    refreshPresetLibraryList();
    if (persist) persistLabState();
}

function setPreset(presetId, persist = true) {
    const preset = getSfxPresetById(presetId);
    applyRecipe(
        {
            presetId: preset.id,
            params: { ...preset.defaults }
        },
        persist
    );
}

function updateSingleParam(key, rawValue) {
    const schema = SFX_PARAM_SCHEMA[key];
    if (!schema) return;
    const fallback = state.params[key];
    const parsed = Number(rawValue);
    const safe = Number.isFinite(parsed) ? parsed : fallback;
    const clamped = clamp(safe, schema.min, schema.max);
    state.params[key] = schema.integer ? Math.round(clamped) : clamped;
    syncParamFieldsFromState();
    refreshPresetSummary();
    persistLabState();
    setSfxPresetParamOverride(state.presetId, state.params);
}

function bindDualField(field) {
    if (!field.range || !field.number) return;
    field.range.addEventListener('input', () => updateSingleParam(field.key, field.range.value));
    field.number.addEventListener('input', () => updateSingleParam(field.key, field.number.value));
    field.number.addEventListener('blur', () => updateSingleParam(field.key, field.number.value));
}

function refreshPresetSelectOptions() {
    if (!el.presetSelect) return;
    const previous = sanitizeId(state.presetId);
    const presets = getSfxPresetCatalog();
    el.presetSelect.innerHTML = '';
    for (const preset of presets) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.custom ? `${preset.name} (Custom)` : preset.name;
        el.presetSelect.appendChild(option);
    }
    state.presetId = presets.some((preset) => preset.id === previous) ? previous : (presets[0]?.id || BUILTIN_SFX_PRESETS[0].id);
    el.presetSelect.value = state.presetId;
}

function refreshPresetLibraryList() {
    if (!el.presetLibraryList) return;
    el.presetLibraryList.innerHTML = '';
    const presets = getSfxPresetCatalog();
    for (const preset of presets) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'sfx-preset-card';
        card.classList.toggle('is-active', preset.id === state.presetId);

        const title = document.createElement('div');
        title.className = 'sfx-preset-title';
        const name = document.createElement('strong');
        name.textContent = preset.name || preset.id;
        const id = document.createElement('span');
        id.className = 'sfx-preset-id';
        id.textContent = preset.id;
        title.append(name, id);
        card.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'sfx-preset-desc';
        desc.textContent = preset.description || 'No description';
        card.appendChild(desc);

        const tag = document.createElement('span');
        tag.className = 'sfx-preset-tag';
        const hasSample = !!getSfxPresetSample(preset.id);
        if (hasSample) {
            tag.textContent = preset.custom ? 'Custom + Sample' : 'Built-in + Sample';
        } else {
            tag.textContent = preset.custom ? 'Custom' : 'Built-in';
        }
        card.appendChild(tag);

        card.addEventListener('click', () => {
            setPreset(preset.id, true);
            setStatus(`Switched preset: ${preset.name}`);
        });
        el.presetLibraryList.appendChild(card);
    }
}

function refreshCustomEditorByPreset() {
    const preset = getSfxPresetById(state.presetId);
    const isCustom = !!preset.custom;
    if (el.customName) el.customName.value = isCustom ? (preset.name || '') : '';
    if (el.customDesc) el.customDesc.value = isCustom ? (preset.description || '') : '';
    if (el.btnUpdatePreset) el.btnUpdatePreset.disabled = !isCustom;
    if (el.btnDeletePreset) el.btnDeletePreset.disabled = !isCustom;
    if (el.btnBindExternalToPreset) {
        const hasExternalSample = !!state.externalSample?.blob;
        el.btnBindExternalToPreset.disabled = !isCustom || !hasExternalSample;
    }
}

function ensureAudioContext() {
    if (!realtimeAudioCtx) {
        realtimeAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: EXPORT_SAMPLE_RATE });
    }
    return realtimeAudioCtx;
}

async function ensureAudioReady() {
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }
    return ctx;
}

function createVariantRecipe(baseRecipe, index) {
    const safe = normalizeRecipe(baseRecipe, state.presetId);
    const amount = safe.params.randomness;
    const jitter = (scale) => (Math.sin((Date.now() + index * 997) * (0.003 + scale * 0.001)) * 0.5 + 0.5 - 0.5) * scale * amount;
    return normalizeRecipe({
        presetId: safe.presetId,
        params: {
            impact: safe.params.impact * (1 + jitter(0.4)),
            pitchSemitone: safe.params.pitchSemitone + jitter(8),
            length: safe.params.length * (1 + jitter(0.24)),
            randomness: safe.params.randomness,
            bounce: safe.params.bounce + jitter(0.3),
            repeats: safe.params.repeats + Math.round(jitter(2.2))
        }
    }, safe.presetId);
}

function writeWavString(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) {
        view.setUint8(offset + i, text.charCodeAt(i));
    }
}

function audioBufferSegmentToWavBlob(buffer, startSeconds = 0, endSeconds = null) {
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;
    const totalFrames = buffer.length;
    const startFrame = Math.max(0, Math.min(totalFrames, Math.floor((Number(startSeconds) || 0) * sampleRate)));
    const rawEnd = endSeconds === null ? totalFrames : Math.floor((Number(endSeconds) || 0) * sampleRate);
    const endFrame = Math.max(startFrame + 1, Math.min(totalFrames, rawEnd));
    const frameCount = endFrame - startFrame;

    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataSize = frameCount * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);

    writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeWavString(view, 8, 'WAVE');
    writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeWavString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    const data = [];
    for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
    for (let i = startFrame; i < endFrame; i += 1) {
        for (let c = 0; c < channels; c += 1) {
            const sample = clamp(data[c][i], -1, 1);
            const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            view.setInt16(offset, pcm, true);
            offset += bytesPerSample;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function audioBufferToWavBlob(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const frameCount = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataSize = frameCount * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);

    writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeWavString(view, 8, 'WAVE');
    writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeWavString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    const data = [];
    for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
    for (let i = 0; i < frameCount; i += 1) {
        for (let c = 0; c < channels; c += 1) {
            const sample = clamp(data[c][i], -1, 1);
            const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            view.setInt16(offset, pcm, true);
            offset += bytesPerSample;
        }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function buildFilename(presetId, suffix = '') {
    const stamp = new Date().toISOString().replace(/[.:]/g, '-');
    return `${presetId}-${stamp}${suffix ? `-${suffix}` : ''}.wav`;
}

async function renderRecipeToWav(recipe, seed) {
    const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtor) throw new Error('当前浏览器不支持 OfflineAudioContext');
    const duration = estimateDurationSeconds(recipe) + 0.25;
    const frames = Math.ceil(duration * EXPORT_SAMPLE_RATE);
    const ctx = new OfflineCtor(2, frames, EXPORT_SAMPLE_RATE);
    synthRecipe(ctx, recipe, 0.02, seed, 1, state.presetId);
    const rendered = await ctx.startRendering();
    return audioBufferToWavBlob(rendered);
}

async function renderExternalToWav(playbackRate = 1) {
    const sample = state.externalSample;
    if (!sample?.buffer) {
        throw new Error('no external sample');
    }
    const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtor) throw new Error('当前浏览器不支持 OfflineAudioContext');
    const rate = clamp(Number(playbackRate) || 1, 0.5, 1.8);
    const trim = resolveExternalTrimWindow();
    const baseDuration = trim ? Math.max(0.01, trim.end - trim.start) : sample.buffer.duration;
    const offset = trim ? trim.start : 0;
    const duration = baseDuration / rate + 0.08;
    const frames = Math.ceil(duration * EXPORT_SAMPLE_RATE);
    const ctx = new OfflineCtor(2, frames, EXPORT_SAMPLE_RATE);
    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.setValueAtTime(rate, 0.01);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, 0.01);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0.01, offset, baseDuration);
    source.stop(0.01 + baseDuration / rate + 0.02);
    const rendered = await ctx.startRendering();
    return audioBufferToWavBlob(rendered);
}

async function renderExternalRecipeToWav(recipe, seed = Date.now()) {
    const sample = state.externalSample;
    if (!sample?.buffer) {
        throw new Error('no external sample');
    }
    const OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtor) throw new Error('当前浏览器不支持 OfflineAudioContext');
    const trim = resolveExternalTrimWindow();
    const partDuration = trim ? Math.max(0.01, trim.end - trim.start) : sample.buffer.duration;
    const offset = trim ? trim.start : 0;
    const plan = buildExternalPlaybackPlan(recipe?.params || {}, seed);

    const sourceDurations = [];
    let total = 0;
    for (let i = 0; i < plan.repeats; i += 1) {
        const rate = clamp(plan.baseRate * plan.jitter(i), 0.45, 2.2);
        const renderedDuration = partDuration / rate;
        sourceDurations.push(renderedDuration);
        total += i === 0 ? renderedDuration : renderedDuration * clamp(0.62 - plan.bounce * 0.22, 0.28, 0.72);
    }
    const duration = Math.max(0.12, total + 0.2);
    const frames = Math.ceil(duration * EXPORT_SAMPLE_RATE);
    const ctx = new OfflineCtor(2, frames, EXPORT_SAMPLE_RATE);

    let cursor = 0.01;
    for (let i = 0; i < plan.repeats; i += 1) {
        const source = ctx.createBufferSource();
        source.buffer = sample.buffer;
        const rate = clamp(plan.baseRate * plan.jitter(i), 0.45, 2.2);
        source.playbackRate.setValueAtTime(rate, cursor);

        const gain = ctx.createGain();
        const repeatDecay = Math.pow(0.82 - plan.bounce * 0.14, i);
        gain.gain.setValueAtTime(clamp(plan.impactGain * repeatDecay, 0.02, 3.2), cursor);
        source.connect(gain);
        gain.connect(ctx.destination);

        source.start(cursor, offset, partDuration);
        source.stop(cursor + sourceDurations[i] + 0.02);
        cursor += sourceDurations[i] * clamp(0.62 - plan.bounce * 0.22, 0.28, 0.72);
    }

    const rendered = await ctx.startRendering();
    return audioBufferToWavBlob(rendered);
}

async function handlePlay() {
    try {
        const ctx = await ensureAudioReady();
        if (getPreviewMode() === 'external') {
            playExternalSample(ctx, ctx.currentTime + 0.01, state.params, 1, 1);
            setStatus(`Previewed external sample: ${state.externalSample?.sourceLabel || 'external'}`);
        } else {
            const recipe = getCurrentRecipe();
            const samplePlayed = await playPresetSample(ctx, recipe.presetId, recipe.params, ctx.currentTime + 0.02, 1, 1);
            if (!samplePlayed) {
                synthRecipe(ctx, recipe, ctx.currentTime + 0.02, Date.now(), 1, recipe.presetId);
            }
            setStatus(`Previewed: ${getSfxPresetById(state.presetId).name}`);
        }
    } catch (error) {
        setStatus(`Preview failed: ${error?.message || 'Unknown error'}`, true);
    }
}

async function playPresetPreview(presetId, skinLabel = '') {
    try {
        const ctx = await ensureAudioReady();
        const preset = getSfxPresetById(presetId);
        const recipe = normalizeRecipe(
            {
                presetId: preset.id,
                params: { ...preset.defaults }
            },
            preset.id
        );
        const samplePlayed = await playPresetSample(ctx, preset.id, recipe.params, ctx.currentTime + 0.02, 1, 1);
        if (!samplePlayed) {
            synthRecipe(ctx, recipe, ctx.currentTime + 0.02, Date.now(), 1, recipe.presetId);
        }
        setSkinStatus(`试听：${skinLabel || preset.id} -> ${preset.name}`);
    } catch (error) {
        setSkinStatus(`试听失败：${error?.message || 'Unknown error'}`, true);
    }
}

async function handlePlayBurst() {
    try {
        const ctx = await ensureAudioReady();
        let start = ctx.currentTime + 0.02;
        if (getPreviewMode() === 'external') {
            for (let i = 0; i < 3; i += 1) {
                const variant = createVariantRecipe(getCurrentRecipe(), i + 1);
                start = playExternalSample(ctx, start, variant.params, 1, 1) + 0.04;
            }
            setStatus('Played 3 external sample variants.');
            return;
        }
        const base = getCurrentRecipe();
        for (let i = 0; i < 3; i += 1) {
            const samplePlayed = await playPresetSample(
                ctx,
                base.presetId,
                base.params,
                start,
                1,
                clamp(0.92 + Math.random() * 0.18, 0.85, 1.15)
            );
            if (samplePlayed) {
                start += 0.26;
            } else {
                const variant = createVariantRecipe(base, i + 1);
                start = synthRecipe(ctx, variant, start, Date.now() + i * 17, 1, variant.presetId) + 0.04;
            }
        }
        setStatus('Played 3 variants.');
    } catch (error) {
        setStatus(`Burst preview failed: ${error?.message || 'Unknown error'}`, true);
    }
}

async function handleDownloadSingle() {
    try {
        if (getPreviewMode() === 'external') {
            const sampleName = slugifyLabel(
                state.externalSample?.fileName || state.externalSample?.sourceLabel,
                'external-sfx'
            );
            const blob = await renderExternalRecipeToWav(getCurrentRecipe(), Date.now());
            downloadBlob(blob, buildFilename(sampleName));
        } else {
            const recipe = getCurrentRecipe();
            const blob = await renderRecipeToWav(recipe, Date.now());
            downloadBlob(blob, buildFilename(recipe.presetId));
        }
        setStatus('WAV downloaded.');
    } catch (error) {
        setStatus(`Export failed: ${error?.message || 'Unknown error'}`, true);
    }
}

async function handleDownloadPack() {
    try {
        const previewMode = getPreviewMode();
        const base = getCurrentRecipe();
        const packBaseName = previewMode === 'external'
            ? slugifyLabel(state.externalSample?.fileName || state.externalSample?.sourceLabel, 'external-sfx')
            : base.presetId;
        for (let i = 0; i < PACK_VARIANT_COUNT; i += 1) {
            setStatus(`正在生成变体 ${i + 1}/${PACK_VARIANT_COUNT}...`);
            const blob = previewMode === 'external'
                ? await renderExternalRecipeToWav(createVariantRecipe(base, i + 1), Date.now() + i * 997)
                : await renderRecipeToWav(createVariantRecipe(base, i + 1), Date.now() + i * 997);
            downloadBlob(blob, buildFilename(packBaseName, `v${i + 1}`));
        }
        setStatus(`Downloaded ${PACK_VARIANT_COUNT} variants.`);
    } catch (error) {
        setStatus(`Batch export failed: ${error?.message || 'Unknown error'}`, true);
    }
}

function renderFreesoundResults(rows = []) {
    if (!el.fsResults) return;
    el.fsResults.innerHTML = '';
    if (!Array.isArray(rows) || rows.length <= 0) {
        const empty = document.createElement('div');
        empty.className = 'sfx-source-result-item';
        empty.textContent = '无结果，请尝试更换关键词。';
        el.fsResults.appendChild(empty);
        return;
    }

    for (const row of rows) {
        const item = document.createElement('div');
        item.className = 'sfx-source-result-item';

        const title = document.createElement('h5');
        title.textContent = row.name || `sound-${row.id}`;
        item.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'sfx-source-result-meta';
        meta.textContent = `by ${row.user || 'unknown'} | ${Number(row.duration || 0).toFixed(2)}s | ${row.licenseTag || 'unknown'}`;
        item.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'sfx-source-result-actions';

        const btnPreview = document.createElement('button');
        btnPreview.type = 'button';
        btnPreview.textContent = '试听';
        btnPreview.addEventListener('click', () => {
            if (!row.previewUrl) return;
            const proxyUrl = `/api/sfx/freesound/proxy?url=${encodeURIComponent(row.previewUrl)}`;
            if (el.externalPreviewAudio) {
                clearExternalPreviewAudioUrl();
                el.externalPreviewAudio.src = proxyUrl;
                el.externalPreviewAudio.play().catch(() => {});
            }
            setFsStatus(`试听：${row.name}`);
        });
        actions.appendChild(btnPreview);

        const btnUse = document.createElement('button');
        btnUse.type = 'button';
        btnUse.className = 'primary';
        btnUse.textContent = '导入工坊';
        btnUse.addEventListener('click', async () => {
            if (!row.previewUrl) return;
            btnUse.disabled = true;
            try {
                const proxyUrl = `/api/sfx/freesound/proxy?url=${encodeURIComponent(row.previewUrl)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) {
                    throw new Error(`proxy fetch failed (${response.status})`);
                }
                const blob = await response.blob();
                await setExternalSampleFromBlob(
                    blob,
                    `Freesound: ${row.name} (#${row.id})`,
                    `${slugifyLabel(row.name || `fs-${row.id}`, `freesound-${row.id}`)}.wav`
                );
                setFsStatus(`已导入：${row.name}`);
                setStatus(`External sample ready: ${row.name}`);
            } catch (error) {
                setFsStatus(`导入失败：${error?.message || 'Unknown error'}`, true);
            } finally {
                btnUse.disabled = false;
            }
        });
        actions.appendChild(btnUse);

        item.appendChild(actions);
        el.fsResults.appendChild(item);
    }
}

async function handleFreesoundSearch() {
    if (!state.providerCaps.freesound) {
        setFsStatus('Freesound 未配置 API Key。', true);
        return;
    }
    const query = `${el.fsQuery?.value || ''}`.trim();
    if (!query) {
        setFsStatus('请输入关键词。', true);
        return;
    }
    const license = `${el.fsLicense?.value || 'all'}`.trim();
    setFsStatus('正在搜索...');
    if (el.btnFsSearch) el.btnFsSearch.disabled = true;
    try {
        const url = `/api/sfx/freesound/search?q=${encodeURIComponent(query)}&license=${encodeURIComponent(license)}&page_size=12`;
        const data = await fetchJsonWithError(url);
        const rows = Array.isArray(data?.results) ? data.results : [];
        renderFreesoundResults(rows);
        setFsStatus(`搜索完成：${rows.length} 条结果。`);
    } catch (error) {
        renderFreesoundResults([]);
        setFsStatus(`搜索失败：${error?.message || 'Unknown error'}`, true);
    } finally {
        if (el.btnFsSearch) el.btnFsSearch.disabled = !state.providerCaps.freesound;
    }
}

async function handleStableAudioGenerate() {
    if (!state.providerCaps.stableAudioOpen) {
        setAiStatus('Stable Audio 未配置：请设置 FAL_KEY 或 HUGGINGFACE_API_TOKEN。', true);
        return;
    }
    const prompt = `${el.aiPrompt?.value || ''}`.trim();
    if (!prompt) {
        setAiStatus('请输入文本提示词。', true);
        return;
    }
    const durationSeconds = clamp(Number(el.aiDuration?.value || 2), 1, 10);
    setAiStatus('正在生成...');
    if (el.btnAiGenerate) el.btnAiGenerate.disabled = true;
    try {
        const response = await fetch('/api/sfx/stable-audio/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                durationSeconds
            })
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.error || `request failed (${response.status})`);
        }
        const blob = await response.blob();
        await setExternalSampleFromBlob(
            blob,
            `Stable Audio Open: ${prompt.slice(0, 48)}`,
            `${slugifyLabel(prompt.slice(0, 48), 'stable-audio')}.wav`
        );
        if (state.providerCaps.stableAudioBackend === 'fal' || state.providerCaps.stableAudioFal) {
            setAiStatus('生成成功（fal.ai），已导入工坊。');
        } else {
            setAiStatus('生成成功，已导入工坊。');
        }
        setStatus('Stable Audio sample ready.');
    } catch (error) {
        setAiStatus(`生成失败：${error?.message || 'Unknown error'}`, true);
    } finally {
        if (el.btnAiGenerate) el.btnAiGenerate.disabled = !state.providerCaps.stableAudioOpen;
    }
}

async function handleSampleUpload(file) {
    if (!file) return;
    try {
        await setExternalSampleFromBlob(file, `本地采样: ${file.name}`, file.name);
        setStatus(`Loaded local sample: ${file.name}`);
    } catch (error) {
        setStatus(`Load sample failed: ${error?.message || 'Unknown error'}`, true);
    }
}

async function refreshSkinState() {
    const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
    const mergedRows = [];
    const seen = new Set();
    for (const skin of catalog) {
        const id = sanitizeId(skin?.id);
        if (!id || seen.has(id)) {
            continue;
        }
        mergedRows.push({
            id,
            nameZh: normalizeName(skin?.name?.['zh-CN'], id)
        });
        seen.add(id);
    }

    const savedRows = await fetchSavedSkinRows();
    for (const row of savedRows) {
        if (!row?.id || seen.has(row.id)) {
            continue;
        }
        mergedRows.push({
            id: row.id,
            nameZh: normalizeName(row.nameZh, row.id)
        });
        seen.add(row.id);
    }

    state.skinRows = mergedRows;
    state.skinBindings = readSkinSfxBindings();
}

function getSkinLabel(row) {
    return `${row.nameZh || row.id} (${row.id})`;
}

function resolveSkinBindingPreset(skinId) {
    const key = sanitizeId(skinId);
    return getSfxPresetById(state.skinBindings[key] || BUILTIN_SFX_PRESETS[0].id).id;
}

function refreshSkinSelectOptions() {
    if (!el.skinSelect) return;
    const previous = sanitizeId(el.skinSelect.value || state.skinRows[0]?.id || '');
    el.skinSelect.innerHTML = '';
    for (const row of state.skinRows) {
        const option = document.createElement('option');
        option.value = row.id;
        option.textContent = getSkinLabel(row);
        el.skinSelect.appendChild(option);
    }
    el.skinSelect.value = state.skinRows.some((row) => row.id === previous) ? previous : (state.skinRows[0]?.id || '');
}

function refreshSkinPresetSelectOptions() {
    if (!el.skinPresetSelect) return;
    const current = sanitizeId(el.skinPresetSelect.value || state.presetId);
    const presets = getSfxPresetCatalog();
    el.skinPresetSelect.innerHTML = '';
    for (const preset of presets) {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.custom ? `${preset.name} (Custom)` : preset.name;
        el.skinPresetSelect.appendChild(option);
    }
    el.skinPresetSelect.value = presets.some((preset) => preset.id === current) ? current : (presets[0]?.id || BUILTIN_SFX_PRESETS[0].id);
}

function syncSelectedSkinBindingUi() {
    if (!el.skinSelect || !el.skinPresetSelect) return;
    el.skinPresetSelect.value = resolveSkinBindingPreset(el.skinSelect.value);
}

function renderSkinBindingList() {
    if (!el.skinBindingList) return;
    el.skinBindingList.innerHTML = '';
    const presets = getSfxPresetCatalog();
    for (const row of state.skinRows) {
        const item = document.createElement('div');
        item.className = 'skin-sfx-binding-row';

        const meta = document.createElement('div');
        meta.className = 'skin-sfx-binding-meta';
        const title = document.createElement('strong');
        title.textContent = row.nameZh || row.id;
        const sub = document.createElement('span');
        sub.textContent = row.id;
        meta.append(title, sub);
        item.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'skin-sfx-binding-actions';

        const select = document.createElement('select');
        for (const preset of presets) {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.custom ? `${preset.name} (Custom)` : preset.name;
            select.appendChild(option);
        }
        select.value = resolveSkinBindingPreset(row.id);
        select.addEventListener('change', () => {
            state.skinBindings = setSkinSfxPresetId(row.id, select.value);
            if (sanitizeId(el.skinSelect?.value || '') === row.id) {
                el.skinPresetSelect.value = getSfxPresetById(select.value).id;
            }
            setSkinStatus(`Updated: ${row.nameZh || row.id} -> ${getSfxPresetById(select.value).name}`);
        });
        actions.appendChild(select);

        const btnPreview = document.createElement('button');
        btnPreview.type = 'button';
        btnPreview.className = 'skin-sfx-preview-btn';
        btnPreview.textContent = '试听';
        btnPreview.addEventListener('click', () => {
            void playPresetPreview(select.value, row.nameZh || row.id);
        });
        actions.appendChild(btnPreview);

        item.appendChild(actions);
        el.skinBindingList.appendChild(item);
    }
}

async function refreshSkinBindingUi() {
    const previousSkinId = sanitizeId(el.skinSelect?.value || state.skinRows[0]?.id || '');
    await refreshSkinState();
    refreshSkinSelectOptions();
    if (el.skinSelect && previousSkinId && state.skinRows.some((row) => row.id === previousSkinId)) {
        el.skinSelect.value = previousSkinId;
    }
    syncSelectedSkinBindingUi();
    renderSkinBindingList();
}

const GAME_SFX_EVENT_FIELD_MAP = Object.freeze({
    click: 'gameSfxClickPresetSelect',
    coin: 'gameSfxCoinPresetSelect',
    checkinCoinTrail: 'gameSfxCheckinCoinTrailPresetSelect',
    error: 'gameSfxErrorPresetSelect',
    levelComplete: 'gameSfxLevelCompletePresetSelect',
    gameOver: 'gameSfxGameOverPresetSelect'
});

function refreshGameSfxState() {
    state.gameSfxBindings = readGameSfxBindings();
}

function refreshGameSfxPresetOptions() {
    const presets = getSfxPresetCatalog();
    for (const [eventKey, fieldName] of Object.entries(GAME_SFX_EVENT_FIELD_MAP)) {
        const select = el[fieldName];
        if (!select) {
            continue;
        }
        const previous = sanitizeId(select.value || '');
        select.innerHTML = '';
        for (const preset of presets) {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.custom ? `${preset.name} (Custom)` : preset.name;
            select.appendChild(option);
        }
        const boundPresetId = getGameSfxPresetId(eventKey);
        const fallbackPresetId = presets[0]?.id || BUILTIN_SFX_PRESETS[0].id;
        const nextValue = presets.some((preset) => preset.id === previous)
            ? previous
            : (presets.some((preset) => preset.id === boundPresetId) ? boundPresetId : fallbackPresetId);
        select.value = nextValue;
    }
}

function saveGameSfxBindingsFromUi() {
    for (const [eventKey, fieldName] of Object.entries(GAME_SFX_EVENT_FIELD_MAP)) {
        const select = el[fieldName];
        if (!select) {
            continue;
        }
        state.gameSfxBindings = setGameSfxPresetId(eventKey, select.value);
    }
    setGameSfxStatus('已保存游戏音效配置。');
}

function resetGameSfxBindingsToDefault() {
    state.gameSfxBindings = writeGameSfxBindings({});
    refreshGameSfxState();
    refreshGameSfxPresetOptions();
    setGameSfxStatus('已恢复默认游戏音效。');
}

const GAME_MUSIC_SCENE_FIELD_MAP = Object.freeze({
    [BGM_SCENE_KEYS.HOME]: { tracks: 'gameMusicHomeTracks', volume: 'gameMusicHomeVolume', label: '主界面' },
    [BGM_SCENE_KEYS.NORMAL]: { tracks: 'gameMusicNormalTracks', volume: 'gameMusicNormalVolume', label: '普通关卡' },
    [BGM_SCENE_KEYS.REWARD]: { tracks: 'gameMusicRewardTracks', volume: 'gameMusicRewardVolume', label: '奖励关卡' },
    [BGM_SCENE_KEYS.CAMPAIGN_COMPLETE]: { tracks: 'gameMusicCompleteTracks', volume: 'gameMusicCompleteVolume', label: '全部通关' }
});

function clampMusicVolume(value, fallback = 0.7) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(0, Math.min(1, parsed));
}

function decodeUriLoose(text) {
    let out = `${text || ''}`.trim();
    for (let i = 0; i < 2; i += 1) {
        try {
            const next = decodeURIComponent(out);
            if (next === out) {
                break;
            }
            out = next;
        } catch {
            break;
        }
    }
    return out;
}

function normalizeTrackValueForMatch(value) {
    let text = decodeUriLoose(value).replace(/\\/g, '/').trim();
    if (!text) {
        return '';
    }
    if (/^https?:\/\//i.test(text)) {
        try {
            const parsed = new URL(text, window.location.origin);
            text = parsed.pathname || text;
        } catch {
            // keep original text
        }
    }
    return text;
}

function getTrackBaseName(value) {
    const normalized = normalizeTrackValueForMatch(value);
    if (!normalized) {
        return '';
    }
    const chunks = normalized.split('/');
    return chunks[chunks.length - 1] || '';
}

function buildTrackMatchKeys(value) {
    const normalized = normalizeTrackValueForMatch(value);
    if (!normalized) {
        return [];
    }
    const baseName = getTrackBaseName(normalized);
    const keys = [normalized];
    if (baseName) {
        keys.push(baseName);
    }
    return Array.from(new Set(keys.map((item) => item.toLowerCase())));
}

function formatTrackLabel(value) {
    const baseName = decodeUriLoose(getTrackBaseName(value));
    return baseName || decodeUriLoose(value);
}

function getSelectedValues(containerEl) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) {
        return [];
    }
    return Array.from(containerEl.querySelectorAll('input[type="checkbox"][data-track-url]'))
        .filter((input) => input.checked)
        .map((input) => `${input.getAttribute('data-track-url') || ''}`.trim())
        .filter(Boolean);
}

function setSelectedValues(containerEl, values) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) {
        return [];
    }
    const rawValues = Array.isArray(values) ? values.map((item) => `${item || ''}`.trim()).filter(Boolean) : [];
    const selected = new Set(rawValues.flatMap((item) => buildTrackMatchKeys(item)));
    const matchedRawValues = new Set();
    for (const input of Array.from(containerEl.querySelectorAll('input[type="checkbox"][data-track-url]'))) {
        const trackUrl = `${input.getAttribute('data-track-url') || ''}`.trim();
        const trackFile = `${input.getAttribute('data-track-file') || ''}`.trim();
        const row = input.closest('.game-music-track-row');
        const keys = [...buildTrackMatchKeys(trackUrl), ...buildTrackMatchKeys(trackFile)];
        const isMatched = keys.some((key) => selected.has(key));
        input.checked = isMatched;
        row?.classList.toggle('is-selected', isMatched);
        if (isMatched) {
            for (const raw of rawValues) {
                const rawKeys = buildTrackMatchKeys(raw);
                if (rawKeys.some((key) => keys.includes(key))) {
                    matchedRawValues.add(raw);
                }
            }
        }
    }
    return rawValues.filter((item) => !matchedRawValues.has(item));
}

async function fetchBgmTrackLibrary() {
    try {
        const response = await fetch('/api/bgm/list', {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json().catch(() => ({}));
        const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
        return tracks
            .map((track) => {
                const url = `${track?.url || ''}`.trim();
                const name = `${track?.name || ''}`.trim();
                const fileName = `${track?.fileName || ''}`.trim();
                if (!url) {
                    return null;
                }
                return {
                    url,
                    name: name || fileName || url,
                    fileName: fileName || name || url
                };
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

function renderGameMusicTrackOptions() {
    for (const sceneFields of Object.values(GAME_MUSIC_SCENE_FIELD_MAP)) {
        const container = el[sceneFields.tracks];
        if (!container || !(container instanceof HTMLElement)) {
            continue;
        }
        const existingSelected = getSelectedValues(container);
        container.innerHTML = '';
        for (const track of state.bgmTrackLibrary) {
            const row = document.createElement('label');
            row.className = 'game-music-track-row';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.setAttribute('data-track-url', track.url);
            checkbox.setAttribute('data-track-file', track.fileName || track.name || '');
            checkbox.value = track.url;
            checkbox.checked = existingSelected.includes(track.url);
            checkbox.addEventListener('change', () => {
                row.classList.toggle('is-selected', checkbox.checked);
                refreshGameMusicSelectionSummary();
            });
            const name = document.createElement('span');
            name.className = 'game-music-track-name';
            name.textContent = track.name;
            name.title = track.fileName;
            const previewBtn = document.createElement('button');
            previewBtn.type = 'button';
            previewBtn.className = 'game-music-preview-btn';
            previewBtn.setAttribute('data-track-url', track.url);
            previewBtn.textContent = '试听';
            previewBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await toggleBgmTrackPreview(track.url);
            });
            row.appendChild(checkbox);
            row.appendChild(name);
            row.appendChild(previewBtn);
            container.appendChild(row);
        }
        setSelectedValues(container, existingSelected);
    }
    refreshBgmPreviewButtons();
}

function ensureGameMusicSceneSummary(container) {
    if (!container || !(container instanceof HTMLElement)) {
        return null;
    }
    let summary = container.parentElement?.querySelector('.game-music-selection-summary');
    if (!summary) {
        summary = document.createElement('div');
        summary.className = 'game-music-selection-summary';
        container.insertAdjacentElement('afterend', summary);
    }
    return summary;
}

function refreshGameMusicSelectionSummary() {
    for (const sceneFields of Object.values(GAME_MUSIC_SCENE_FIELD_MAP)) {
        const container = el[sceneFields.tracks];
        const summary = ensureGameMusicSceneSummary(container);
        if (!container || !summary) {
            continue;
        }
        const checkedLabels = Array.from(container.querySelectorAll('input[type="checkbox"][data-track-url]'))
            .filter((input) => input.checked)
            .map((input) => {
                const row = input.closest('.game-music-track-row');
                const label = row?.querySelector('.game-music-track-name')?.textContent || '';
                return `${label}`.trim() || formatTrackLabel(input.getAttribute('data-track-url') || '');
            })
            .filter(Boolean);
        const unmatched = `${container.dataset.unmatchedTracks || ''}`
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean);
        const selectedText = checkedLabels.length > 0
            ? `当前已选：${checkedLabels.join('、')}`
            : '当前已选：无';
        const unmatchedText = unmatched.length > 0
            ? `；未匹配到曲库：${unmatched.map((item) => formatTrackLabel(item)).join('、')}`
            : '';
        summary.textContent = `${selectedText}${unmatchedText}`;
    }
}

function getBgmPreviewAudio() {
    if (state.bgmPreview.audio) {
        return state.bgmPreview.audio;
    }
    const audio = new Audio();
    audio.preload = 'none';
    audio.autoplay = false;
    audio.loop = false;
    audio.addEventListener('ended', () => {
        state.bgmPreview.isPlaying = false;
        state.bgmPreview.trackUrl = '';
        refreshBgmPreviewButtons();
    });
    state.bgmPreview.audio = audio;
    return audio;
}

function stopBgmTrackPreview() {
    const audio = state.bgmPreview.audio;
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
    }
    state.bgmPreview.trackUrl = '';
    state.bgmPreview.isPlaying = false;
    refreshBgmPreviewButtons();
}

async function toggleBgmTrackPreview(trackUrl) {
    const safeUrl = `${trackUrl || ''}`.trim();
    if (!safeUrl) {
        return;
    }
    const audio = getBgmPreviewAudio();
    if (state.bgmPreview.trackUrl === safeUrl) {
        if (state.bgmPreview.isPlaying) {
            audio.pause();
            state.bgmPreview.isPlaying = false;
        } else {
            try {
                await audio.play();
                state.bgmPreview.isPlaying = true;
            } catch (error) {
                setGameMusicStatus(`试听失败：${error?.message || 'Unknown error'}`, true);
                state.bgmPreview.isPlaying = false;
            }
        }
        refreshBgmPreviewButtons();
        return;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.src = safeUrl;
    state.bgmPreview.trackUrl = safeUrl;
    try {
        await audio.play();
        state.bgmPreview.isPlaying = true;
        setGameMusicStatus(`正在试听：${formatTrackLabel(safeUrl)}`);
    } catch (error) {
        state.bgmPreview.isPlaying = false;
        setGameMusicStatus(`试听失败：${error?.message || 'Unknown error'}`, true);
    }
    refreshBgmPreviewButtons();
}

function refreshBgmPreviewButtons() {
    const allButtons = Array.from(document.querySelectorAll('.game-music-preview-btn'));
    for (const button of allButtons) {
        const url = `${button.getAttribute('data-track-url') || ''}`.trim();
        const isCurrent = url && url === state.bgmPreview.trackUrl;
        const isPlaying = isCurrent && state.bgmPreview.isPlaying;
        button.textContent = isPlaying ? '暂停' : (isCurrent ? '继续' : '试听');
        button.classList.toggle('is-active', isPlaying);
    }
}

function refreshGameMusicUiFromConfig() {
    const config = readBgmConfig();
    const scenes = config?.scenes || {};
    for (const [sceneKey, sceneFields] of Object.entries(GAME_MUSIC_SCENE_FIELD_MAP)) {
        const container = el[sceneFields.tracks];
        const volumeInput = el[sceneFields.volume];
        const scene = scenes[sceneKey] || {};
        const playlist = Array.isArray(scene.playlist) ? scene.playlist : [];
        const volume = clampMusicVolume(scene.volume, 0.7);
        const unmatchedTracks = setSelectedValues(container, playlist);
        if (container) {
            container.dataset.unmatchedTracks = unmatchedTracks.join('\n');
        }
        if (volumeInput) {
            volumeInput.value = volume.toFixed(2);
        }
    }
    refreshGameMusicSelectionSummary();
}

function collectGameMusicConfigFromUi() {
    const current = readBgmConfig();
    const nextScenes = { ...(current?.scenes || {}) };
    for (const [sceneKey, sceneFields] of Object.entries(GAME_MUSIC_SCENE_FIELD_MAP)) {
        const container = el[sceneFields.tracks];
        const volumeInput = el[sceneFields.volume];
        nextScenes[sceneKey] = {
            playlist: getSelectedValues(container),
            volume: clampMusicVolume(volumeInput?.value, 0.7)
        };
    }
    return {
        ...current,
        scenes: nextScenes
    };
}

async function refreshGameMusicTrackLibrary() {
    state.bgmTrackLibrary = await fetchBgmTrackLibrary();
    renderGameMusicTrackOptions();
    refreshGameMusicUiFromConfig();
    if (el.gameMusicLibraryHint) {
        if (state.bgmTrackLibrary.length > 0) {
            el.gameMusicLibraryHint.textContent = `曲库：已加载 ${state.bgmTrackLibrary.length} 首`;
            el.gameMusicLibraryHint.style.color = '#3f6b22';
        } else {
            el.gameMusicLibraryHint.textContent = '曲库为空：请先把音乐文件放到 assets/audio/bgm';
            el.gameMusicLibraryHint.style.color = '#c21f4e';
        }
    }
}

function saveGameMusicConfigFromUi() {
    const payload = collectGameMusicConfigFromUi();
    writeBgmConfig(payload);
    setGameMusicStatus('已保存游戏音乐配置。');
}

function resetGameMusicConfigToDefault() {
    writeBgmConfig({});
    refreshGameMusicUiFromConfig();
    setGameMusicStatus('已恢复默认音乐配置。');
}

function saveSelectedSkinBinding() {
    const skinId = sanitizeId(el.skinSelect?.value || '');
    if (!skinId) return setSkinStatus('Please select a skin first.', true);
    const presetId = getSfxPresetById(el.skinPresetSelect?.value || '').id;
    state.skinBindings = setSkinSfxPresetId(skinId, presetId);
    renderSkinBindingList();
    setSkinStatus(`Saved: ${skinId} -> ${getSfxPresetById(presetId).name}`);
}

function resetSelectedSkinBinding() {
    const skinId = sanitizeId(el.skinSelect?.value || '');
    if (!skinId) return setSkinStatus('Please select a skin first.', true);
    const next = { ...state.skinBindings };
    delete next[skinId];
    state.skinBindings = writeSkinSfxBindings(next);
    syncSelectedSkinBindingUi();
    renderSkinBindingList();
    setSkinStatus(`Reset to default SFX: ${skinId}`);
}

function saveAsNewPreset() {
    const name = `${el.customName?.value || ''}`.trim();
    if (!name) return setStatus('Please input a preset name.', true);
    const description = `${el.customDesc?.value || ''}`.trim();
    void Promise.resolve(buildExternalSamplePayloadFromState()).then((samplePayload) => {
        const saved = upsertCustomSfxPreset({
            name,
            description,
            params: state.params,
            sample: samplePayload || undefined
        });
        refreshPresetSelectOptions();
        refreshSkinPresetSelectOptions();
        refreshGameSfxPresetOptions();
        setPreset(saved.id, true);
        renderSkinBindingList();
        setStatus(samplePayload
            ? `Saved preset with sample: ${saved.name}`
            : `Saved preset: ${saved.name}`);
    }).catch((error) => {
        setStatus(`Save preset failed: ${error?.message || 'Unknown error'}`, true);
    });
}

async function bindExternalSampleToCurrentPreset() {
    const preset = getSfxPresetById(state.presetId);
    if (!preset?.custom) {
        setStatus('请选择一个自定义模板，再保存外部采样。', true);
        return;
    }
    if (!state.externalSample?.blob) {
        setStatus('请先导入外部采样（Freesound/上传/Stable Audio）。', true);
        return;
    }
    try {
        const samplePayload = await buildExternalSamplePayloadFromState();
        if (!samplePayload) {
            throw new Error('missing external sample');
        }
        const saved = setCustomSfxPresetSample(preset.id, {
            ...samplePayload,
            fileName: samplePayload.fileName || `${preset.id}.wav`
        });
        if (!saved) {
            throw new Error('save preset sample failed');
        }
        refreshPresetSelectOptions();
        refreshSkinPresetSelectOptions();
        refreshGameSfxPresetOptions();
        setPreset(saved.id, true);
        renderSkinBindingList();
        setStatus(`已保存外部采样到模板：${saved.name}`);
    } catch (error) {
        setStatus(`保存外部采样失败：${error?.message || 'Unknown error'}`, true);
    }
}

async function buildExternalSamplePayloadFromState() {
    if (!state.externalSample?.blob) {
        return null;
    }
    const trim = resolveExternalTrimWindow();
    const sourceBlob = trim
        ? audioBufferSegmentToWavBlob(state.externalSample.buffer, trim.start, trim.end)
        : state.externalSample.blob;
    const dataUrl = await blobToDataUrl(sourceBlob);
    return {
        dataUrl,
        mimeType: sourceBlob.type || state.externalSample.blob.type || 'audio/wav',
        fileName: state.externalSample.fileName || `${state.presetId}.wav`,
        sourceLabel: state.externalSample.sourceLabel || 'external sample'
    };
}

function applyExternalTrimFromUi() {
    const sample = state.externalSample;
    if (!sample?.buffer) {
        return setTrimStatus('请先导入外部采样。', true);
    }
    const duration = Number(sample.buffer.duration || 0);
    if (duration <= 0) {
        return setTrimStatus('采样时长无效。', true);
    }
    const rawStart = Number(el.trimStart?.value || 0);
    const rawEnd = Number(el.trimEnd?.value || duration);
    const start = clamp(Number.isFinite(rawStart) ? rawStart : 0, 0, Math.max(0, duration - 0.01));
    const end = clamp(Number.isFinite(rawEnd) ? rawEnd : duration, start + 0.01, duration);
    state.externalTrim = { start, end };
    if (el.trimStart) el.trimStart.value = start.toFixed(2);
    if (el.trimEnd) el.trimEnd.value = end.toFixed(2);
    setTrimStatus(`已裁切：${start.toFixed(2)}s - ${end.toFixed(2)}s（${(end - start).toFixed(2)}s）`);
}

function resetExternalTrim() {
    const sample = state.externalSample;
    const duration = Number(sample?.buffer?.duration || 0);
    state.externalTrim = null;
    if (el.trimStart) el.trimStart.value = '0';
    if (el.trimEnd) el.trimEnd.value = duration > 0 ? duration.toFixed(2) : '0';
    setTrimStatus(duration > 0 ? `原始时长：${duration.toFixed(2)}s（未裁切）` : '未裁切。');
}

function updateCurrentPreset() {
    const preset = getSfxPresetById(state.presetId);
    if (!preset.custom) {
        return setStatus('Current preset is built-in. Use Save As New to create custom preset.', true);
    }
    const name = `${el.customName?.value || ''}`.trim() || preset.name || 'Custom SFX';
    const description = `${el.customDesc?.value || ''}`.trim();
    void Promise.resolve(buildExternalSamplePayloadFromState()).then((samplePayload) => {
        const saved = upsertCustomSfxPreset(
            {
                id: preset.id,
                name,
                description,
                params: state.params,
                sample: samplePayload || preset.sample || undefined
            },
            { enforceUpdateId: preset.id }
        );
        refreshPresetSelectOptions();
        refreshSkinPresetSelectOptions();
        refreshGameSfxPresetOptions();
        setPreset(saved.id, true);
        renderSkinBindingList();
        setStatus(samplePayload
            ? `Updated preset with sample: ${saved.name}`
            : `Updated preset: ${saved.name}`);
    }).catch((error) => {
        setStatus(`Update preset failed: ${error?.message || 'Unknown error'}`, true);
    });
}

function removeCurrentPreset() {
    const preset = getSfxPresetById(state.presetId);
    if (!preset.custom) {
        return setStatus('Built-in preset cannot be deleted.', true);
    }
    if (!deleteCustomSfxPreset(preset.id)) {
        return setStatus('Delete preset failed.', true);
    }
    refreshPresetSelectOptions();
    refreshSkinPresetSelectOptions();
    refreshGameSfxPresetOptions();
    setPreset(BUILTIN_SFX_PRESETS[0].id, true);
    renderSkinBindingList();
    setStatus(`Deleted preset: ${preset.name}`);
}

function bindEvents() {
    for (const field of paramFieldConfig) bindDualField(field);

    for (const button of el.musicSfxTabButtons) {
        button.addEventListener('click', () => {
            setMusicSfxSubTab(button.dataset.musicSfxTabTarget || 'sfx-lab');
        });
    }

    el.presetSelect?.addEventListener('change', () => {
        setPreset(el.presetSelect.value, true);
        setStatus(`Switched preset: ${getSfxPresetById(el.presetSelect.value).name}`);
    });

    el.btnPlay?.addEventListener('click', handlePlay);
    el.btnPlayBurst?.addEventListener('click', handlePlayBurst);
    el.btnDownloadWav?.addEventListener('click', handleDownloadSingle);
    el.btnDownloadPack?.addEventListener('click', handleDownloadPack);
    el.btnReset?.addEventListener('click', () => {
        setPreset(state.presetId, true);
        setStatus('Reset to preset defaults.');
    });
    el.btnSaveAsNewPreset?.addEventListener('click', saveAsNewPreset);
    el.btnUpdatePreset?.addEventListener('click', updateCurrentPreset);
    el.btnDeletePreset?.addEventListener('click', removeCurrentPreset);
    el.btnBindExternalToPreset?.addEventListener('click', () => {
        void bindExternalSampleToCurrentPreset();
    });

    el.sourceMode?.addEventListener('change', () => {
        setSourceMode(el.sourceMode.value);
    });
    el.sampleFile?.addEventListener('change', async () => {
        const file = el.sampleFile?.files?.[0];
        await handleSampleUpload(file);
        if (el.sampleFile) el.sampleFile.value = '';
    });
    el.btnFsSearch?.addEventListener('click', handleFreesoundSearch);
    el.fsQuery?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void handleFreesoundSearch();
        }
    });
    el.btnAiGenerate?.addEventListener('click', handleStableAudioGenerate);

    el.btnUseExternalAsPreview?.addEventListener('click', () => {
        if (!state.externalSample) {
            setStatus('No external sample loaded.', true);
            return;
        }
        state.previewMode = 'external';
        setStatus(`Using external sample: ${state.externalSample.sourceLabel}`);
    });
    el.btnApplyTrim?.addEventListener('click', applyExternalTrimFromUi);
    el.btnResetTrim?.addEventListener('click', resetExternalTrim);
    el.btnClearExternal?.addEventListener('click', () => {
        clearExternalSample();
        setStatus('Cleared external sample, fallback to synth.');
    });

    el.skinSelect?.addEventListener('change', syncSelectedSkinBindingUi);
    el.btnSkinSave?.addEventListener('click', saveSelectedSkinBinding);
    el.btnSkinReset?.addEventListener('click', resetSelectedSkinBinding);

    el.btnGameSfxSave?.addEventListener('click', saveGameSfxBindingsFromUi);
    el.btnGameSfxReset?.addEventListener('click', resetGameSfxBindingsToDefault);
    el.btnGameSfxPreviewClick?.addEventListener('click', () => {
        void playPresetPreview(el.gameSfxClickPresetSelect?.value || getGameSfxPresetId('click'), '点击反馈');
    });
    el.btnGameSfxPreviewCoin?.addEventListener('click', () => {
        void playPresetPreview(el.gameSfxCoinPresetSelect?.value || getGameSfxPresetId('coin'), '金币获得');
    });
    el.btnGameSfxPreviewCheckinCoinTrail?.addEventListener('click', () => {
        void playPresetPreview(
            el.gameSfxCheckinCoinTrailPresetSelect?.value || getGameSfxPresetId('checkinCoinTrail'),
            '签到飞金币'
        );
    });
    el.btnGameSfxPreviewError?.addEventListener('click', () => {
        void playPresetPreview(el.gameSfxErrorPresetSelect?.value || getGameSfxPresetId('error'), '错误惩罚');
    });
    el.btnGameSfxPreviewLevelComplete?.addEventListener('click', () => {
        void playPresetPreview(el.gameSfxLevelCompletePresetSelect?.value || getGameSfxPresetId('levelComplete'), '通关');
    });
    el.btnGameSfxPreviewGameOver?.addEventListener('click', () => {
        void playPresetPreview(el.gameSfxGameOverPresetSelect?.value || getGameSfxPresetId('gameOver'), '失败');
    });

    el.btnGameMusicRefreshLibrary?.addEventListener('click', () => {
        void refreshGameMusicTrackLibrary().then(() => {
            setGameMusicStatus('已刷新曲库。');
        });
    });
    el.btnGameMusicSave?.addEventListener('click', saveGameMusicConfigFromUi);
    el.btnGameMusicReset?.addEventListener('click', resetGameMusicConfigToDefault);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopBgmTrackPreview();
        }
    });
    window.addEventListener('beforeunload', () => {
        stopBgmTrackPreview();
    });
}

async function init() {
    if (!el.presetSelect) return;
    await initSfxStorage();
    await initBgmStorage();
    await fetchProviderCaps();

    setMusicSfxSubTab('sfx-lab');
    refreshPresetSelectOptions();
    refreshSkinPresetSelectOptions();
    refreshGameSfxState();
    refreshGameSfxPresetOptions();
    await refreshGameMusicTrackLibrary();
    await refreshSkinBindingUi();
    refreshGameMusicUiFromConfig();
    applyRecipe(readSfxLabState(), false);
    setSourceMode(el.sourceMode?.value || state.sourceMode || 'synth');
    renderFreesoundResults([]);
    renderExternalSampleState();
    bindEvents();
    stopBgmTrackPreview();

    window.addEventListener('admin-skin-catalog-updated', () => {
        void refreshSkinBindingUi();
    });

    setStatus('SFX lab ready.');
    setSkinStatus('Skin SFX binding ready.');
    setGameSfxStatus('Game SFX binding ready.');
    setGameMusicStatus('游戏音乐配置已就绪。');
}

init();




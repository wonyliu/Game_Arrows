import { getSkinCatalog, isLegacyColorVariantSkinId } from './skins.js?v=31';
import {
    BUILTIN_SFX_PRESETS,
    SFX_PARAM_SCHEMA,
    deleteCustomSfxPreset,
    deleteAudioLibraryItem,
    getAudioLibraryCatalog,
    getSfxPresetById,
    getSfxPresetCatalog,
    getSfxPresetSample,
    getGameSfxBindingOptions,
    getSkinSfxAudioItemId,
    initSfxStorage,
    normalizeRecipe,
    planAudioLibraryItemIdentity,
    readAudioLibrary,
    readGameSfxBindings,
    readSfxLabState,
    readSkinSfxBindings,
    setGameSfxBindingOptions,
    setCustomSfxPresetSample,
    setSfxPresetParamOverride,
    setSkinSfxAudioItemId,
    setSkinSfxPresetId,
    upsertAudioLibraryItem,
    upsertCustomSfxPreset,
    writeGameSfxBindings,
    writeSfxLabState,
    writeSkinSfxBindings
} from './sfx-storage.js?v=11';
import { estimateRecipeDuration, synthRecipe } from './sfx-synth.js?v=3';
import { BGM_SCENE_KEYS, initBgmStorage, readBgmConfig, writeBgmConfig, writeBgmConfigAndSync } from './bgm-storage.js?v=9';

const EXPORT_SAMPLE_RATE = 48_000;
const PACK_VARIANT_COUNT = 5;
const DEFAULT_SKIN_ID = 'classic-burrow';
const GAME_MUSIC_AUTO_SAVE_DELAY_MS = 260;
const AUDIO_LIBRARY_ASSET_API_BASE = '/api/audio-library/assets';

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
    gameSfxBindingList: document.getElementById('gameSfxBindingList'),
    btnGameSfxSave: document.getElementById('btnGameSfxSave'),
    btnGameSfxReset: document.getElementById('btnGameSfxReset'),
    gameSfxStatus: document.getElementById('gameSfxStatus'),
    gameMusicHomeTracks: document.getElementById('gameMusicHomeTracks'),
    gameMusicHomeVolume: document.getElementById('gameMusicHomeVolume'),
    gameMusicNormalTracks: document.getElementById('gameMusicNormalTracks'),
    gameMusicNormalVolume: document.getElementById('gameMusicNormalVolume'),
    gameMusicRewardTracks: document.getElementById('gameMusicRewardTracks'),
    gameMusicRewardVolume: document.getElementById('gameMusicRewardVolume'),
    gameMusicLevelPassTracks: document.getElementById('gameMusicLevelPassTracks'),
    gameMusicLevelPassVolume: document.getElementById('gameMusicLevelPassVolume'),
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
    fsPreviewPanel: document.getElementById('sfxFsPreviewPanel'),
    fsPreviewAudio: document.getElementById('sfxFsPreviewAudio'),
    fsPreviewTitle: document.getElementById('sfxFsPreviewTitle'),
    fsPreviewState: document.getElementById('sfxFsPreviewState'),
    fsCurrentTime: document.getElementById('sfxFsCurrentTime'),
    fsDuration: document.getElementById('sfxFsDuration'),
    fsSeek: document.getElementById('sfxFsSeek'),
    fsLoadFill: document.getElementById('sfxFsLoadFill'),
    fsLoadText: document.getElementById('sfxFsLoadText'),
    btnFsTogglePlay: document.getElementById('btnSfxFsTogglePlay'),
    btnFsStop: document.getElementById('btnSfxFsStop'),
    fsPreviewError: document.getElementById('sfxFsPreviewError'),
    fsResults: document.getElementById('sfxFsResults'),
    audioLibrarySearch: document.getElementById('audioLibrarySearch'),
    btnAudioLibraryRefresh: document.getElementById('btnAudioLibraryRefresh'),
    audioLibraryName: document.getElementById('audioLibraryName'),
    audioLibraryKeywords: document.getElementById('audioLibraryKeywords'),
    audioLibraryVolume: document.getElementById('audioLibraryVolume'),
    audioLibraryTrimStart: document.getElementById('audioLibraryTrimStart'),
    audioLibraryTrimEnd: document.getElementById('audioLibraryTrimEnd'),
    audioLibraryMeta: document.getElementById('audioLibraryMeta'),
    audioLibraryPreviewAudio: document.getElementById('audioLibraryPreviewAudio'),
    btnAudioLibraryPreview: document.getElementById('btnAudioLibraryPreview'),
    btnAudioLibraryImport: document.getElementById('btnAudioLibraryImport'),
    btnAudioLibrarySave: document.getElementById('btnAudioLibrarySave'),
    btnAudioLibraryDelete: document.getElementById('btnAudioLibraryDelete'),
    audioLibraryStatus: document.getElementById('audioLibraryStatus'),
    audioLibraryList: document.getElementById('audioLibraryList'),
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
    btnImportExternalToLibrary: document.getElementById('btnImportExternalToLibrary'),
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
    gameSfxDraftByEvent: {},
    sourceMode: 'freesound',
    previewMode: 'synth',
    providerCaps: {
        freesound: false,
        stableAudioOpen: false,
        stableAudioFal: false,
        stableAudioHf: false,
        stableAudioBackend: ''
    },
    fsPreview: {
        rowId: 0,
        title: '',
        sourceUrl: '',
        duration: 0,
        currentTime: 0,
        loadRatio: 0,
        bufferedEnd: 0,
        isLoading: false,
        isReady: false,
        isPlaying: false,
        statusText: '未开始',
        error: ''
    },
    audioLibrary: [],
    selectedAudioLibraryId: '',
    audioLibraryPreview: {
        itemId: '',
        trimStart: 0,
        trimEnd: 0
    },
    bgmTrackLibrary: [],
    bgmPreview: {
        audio: null,
        trackUrl: '',
        isPlaying: false
    },
    gameMusicAutoSaveTimer: 0,
    externalSample: null,
    externalTrim: null
};

let realtimeAudioCtx = null;
const presetSampleBufferCache = new Map();
const audioLibraryBufferCache = new Map();
const gameSfxPreviewLoops = new Map();

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

function setAudioLibraryStatus(text, isError = false) {
    if (!el.audioLibraryStatus) return;
    el.audioLibraryStatus.textContent = text || '';
    el.audioLibraryStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
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
    const nextMode = ['synth', 'upload', 'freesound', 'stable-audio'].includes(mode) ? mode : 'freesound';
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

function formatAudioClock(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function describeAudioElementError(audio) {
    const code = Number(audio?.error?.code || 0);
    switch (code) {
        case 1:
            return '加载已取消。';
        case 2:
            return '音频网络请求失败。';
        case 3:
            return '音频解码失败，可能格式不受支持。';
        case 4:
            return '浏览器不支持当前音频格式或地址无效。';
        default:
            return '音频加载失败。';
    }
}

function updateFsPreviewLoadProgress() {
    const audio = el.fsPreviewAudio;
    const duration = Number(audio?.duration || state.fsPreview.duration || 0);
    if (!audio || !Number.isFinite(duration) || duration <= 0 || !audio.buffered || audio.buffered.length <= 0) {
        return;
    }
    const bufferedEnd = Math.max(0, Number(audio.buffered.end(audio.buffered.length - 1)) || 0);
    state.fsPreview.bufferedEnd = bufferedEnd;
    state.fsPreview.loadRatio = Math.max(0, Math.min(1, bufferedEnd / duration));
    renderFsPreviewState();
}

function renderFsPreviewState() {
    const preview = state.fsPreview;
    const visible = !!(
        preview.title
        || preview.isLoading
        || preview.isReady
        || preview.error
        || preview.loadRatio > 0
    );
    if (el.fsPreviewPanel) {
        el.fsPreviewPanel.hidden = !visible;
    }
    if (!visible) {
        return;
    }

    const duration = Math.max(0, Number(preview.duration) || 0);
    const currentTime = Math.max(0, Math.min(duration || Number.POSITIVE_INFINITY, Number(preview.currentTime) || 0));
    const loadRatio = Math.max(0, Math.min(1, Number(preview.loadRatio) || 0));
    const canSeek = preview.isReady && duration > 0;
    let loadText = '未加载';
    if (preview.isLoading) {
        if (duration > 0 && preview.bufferedEnd > 0) {
            loadText = `已缓冲 ${Math.round(loadRatio * 100)}% (${formatAudioClock(preview.bufferedEnd)} / ${formatAudioClock(duration)})`;
        } else {
            loadText = '正在建立连接...';
        }
    } else if (preview.isReady) {
        if (duration > 0 && preview.bufferedEnd > 0 && preview.bufferedEnd < duration) {
            loadText = `已缓冲 ${Math.round(loadRatio * 100)}% (${formatAudioClock(preview.bufferedEnd)} / ${formatAudioClock(duration)})`;
        } else {
            loadText = '已可播放，后续按需加载';
        }
    } else if (preview.error) {
        loadText = '加载失败';
    }

    if (el.fsPreviewTitle) {
        el.fsPreviewTitle.textContent = preview.title || '未选择试听音频';
    }
    if (el.fsPreviewState) {
        el.fsPreviewState.textContent = preview.statusText || '未开始';
        el.fsPreviewState.style.color = preview.error
            ? '#c21f4e'
            : (preview.isLoading ? '#4a5fc1' : '#456016');
    }
    if (el.fsCurrentTime) {
        el.fsCurrentTime.textContent = formatAudioClock(currentTime);
    }
    if (el.fsDuration) {
        el.fsDuration.textContent = formatAudioClock(duration);
    }
    if (el.fsSeek) {
        el.fsSeek.disabled = !canSeek;
        el.fsSeek.value = canSeek ? `${Math.round((currentTime / duration) * 1000)}` : '0';
    }
    if (el.fsLoadFill) {
        el.fsLoadFill.style.width = `${Math.round(loadRatio * 100)}%`;
    }
    if (el.fsLoadText) {
        el.fsLoadText.textContent = loadText;
    }
    if (el.btnFsTogglePlay) {
        el.btnFsTogglePlay.disabled = !preview.isReady;
        el.btnFsTogglePlay.textContent = preview.isPlaying ? '暂停' : '播放';
    }
    if (el.btnFsStop) {
        el.btnFsStop.disabled = !(preview.isReady || preview.isLoading);
    }
    if (el.fsPreviewError) {
        el.fsPreviewError.textContent = preview.error || ' ';
        el.fsPreviewError.style.color = preview.error ? '#c21f4e' : '#3f6b22';
    }
}

function syncFsPreviewFromAudio() {
    const audio = el.fsPreviewAudio;
    if (!audio) return;
    state.fsPreview.currentTime = Math.max(0, Number(audio.currentTime) || 0);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
        state.fsPreview.duration = audio.duration;
    }
    updateFsPreviewLoadProgress();
    renderFsPreviewState();
}

function resetFsPreviewTransport(clearTitle = false) {
    const audio = el.fsPreviewAudio;
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute('src');
        audio.load();
    }
    state.fsPreview.sourceUrl = '';
    state.fsPreview.isLoading = false;
    state.fsPreview.isReady = false;
    state.fsPreview.isPlaying = false;
    state.fsPreview.duration = 0;
    state.fsPreview.currentTime = 0;
    state.fsPreview.loadRatio = 0;
    state.fsPreview.bufferedEnd = 0;
    state.fsPreview.statusText = '未开始';
    state.fsPreview.error = '';
    state.fsPreview.rowId = clearTitle ? 0 : state.fsPreview.rowId;
    if (clearTitle) {
        state.fsPreview.title = '';
    }
    renderFsPreviewState();
}

function stopFsPreviewPlayback() {
    const audio = el.fsPreviewAudio;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    state.fsPreview.currentTime = 0;
    state.fsPreview.isPlaying = false;
    state.fsPreview.isLoading = false;
    state.fsPreview.isReady = !!audio.src;
    state.fsPreview.statusText = '已停止';
    renderFsPreviewState();
}

async function waitForFsPreviewMetadata(audio) {
    if (!audio) {
        throw new Error('preview audio element not found');
    }
    if (audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0) {
        return;
    }
    await new Promise((resolve, reject) => {
        const cleanup = () => {
            audio.removeEventListener('loadedmetadata', onReady);
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('error', onError);
        };
        const onReady = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error(describeAudioElementError(audio)));
        };
        audio.addEventListener('loadedmetadata', onReady);
        audio.addEventListener('canplay', onReady);
        audio.addEventListener('error', onError);
    });
}

async function playFsPreviewAudio() {
    const audio = el.fsPreviewAudio;
    if (!audio || !audio.src) {
        throw new Error('当前没有可播放的试听音频。');
    }
    try {
        state.fsPreview.error = '';
        await audio.play();
    } catch (error) {
        state.fsPreview.isPlaying = false;
        state.fsPreview.statusText = '播放失败';
        state.fsPreview.error = error?.message || '浏览器阻止了音频播放。';
        renderFsPreviewState();
        throw error;
    }
}

async function startFsPreview(row) {
    const originKey = Number(row?.id) > 0 ? `freesound:${Number(row.id)}` : '';
    const cachedItem = findAudioLibraryItemByOriginKey(originKey);
    const previewUrl = getAudioSamplePlayableUrl(cachedItem?.sample) || row?.previewUrl || '';
    if (!previewUrl) {
        setFsStatus('该结果没有可试听的预览地址。', true);
        return;
    }

    if (state.fsPreview.rowId === row.id && state.fsPreview.isReady) {
        const audio = el.fsPreviewAudio;
        if (audio) {
            audio.currentTime = 0;
        }
        state.fsPreview.currentTime = 0;
        state.fsPreview.error = '';
        state.fsPreview.statusText = '准备播放';
        renderFsPreviewState();
        try {
            await playFsPreviewAudio();
            setFsStatus(`试听：${row.name}`);
        } catch (error) {
            setFsStatus(`试听失败：${error?.message || 'Unknown error'}`, true);
        }
        return;
    }

    resetFsPreviewTransport(false);
    state.fsPreview.rowId = Number(row.id) || 0;
    state.fsPreview.title = row.name || `sound-${row.id || 'unknown'}`;
    state.fsPreview.duration = Math.max(0, Number(row.duration) || 0);
    state.fsPreview.statusText = '正在加载...';
    state.fsPreview.error = '';
    state.fsPreview.isLoading = true;
    state.fsPreview.isReady = false;
    state.fsPreview.isPlaying = false;
    state.fsPreview.sourceUrl = previewUrl;
    renderFsPreviewState();
    setFsStatus(cachedItem ? `使用本地素材库试听：${state.fsPreview.title}` : `正在流式加载试听：${state.fsPreview.title}`);

    try {
        const audio = el.fsPreviewAudio;
        if (!audio) {
            throw new Error('preview audio element not found');
        }

        audio.pause();
        audio.currentTime = 0;
        audio.src = getAudioSamplePlayableUrl(cachedItem?.sample)
            || `/api/sfx/freesound/proxy?url=${encodeURIComponent(row.previewUrl)}`;
        audio.load();

        await waitForFsPreviewMetadata(audio);
        state.fsPreview.isLoading = false;
        state.fsPreview.isReady = true;
        state.fsPreview.duration = Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : Math.max(0, Number(row.duration) || 0);
        state.fsPreview.currentTime = 0;
        state.fsPreview.statusText = '已就绪';
        updateFsPreviewLoadProgress();
        renderFsPreviewState();

        await playFsPreviewAudio();
        setFsStatus(`试听：${state.fsPreview.title}`);
    } catch (error) {
        state.fsPreview.isLoading = false;
        state.fsPreview.isReady = false;
        state.fsPreview.isPlaying = false;
        state.fsPreview.statusText = '加载失败';
        state.fsPreview.error = error?.message || 'Unknown error';
        renderFsPreviewState();
        setFsStatus(`试听失败：${state.fsPreview.error}`, true);
    }
}

function renderExternalSampleState() {
    const hasExternal = !!state.externalSample;
    if (el.externalPreviewWrap) {
        el.externalPreviewWrap.hidden = !hasExternal;
    }
    if (el.btnUseExternalAsPreview) {
        el.btnUseExternalAsPreview.disabled = !hasExternal;
    }
    if (el.btnImportExternalToLibrary) {
        el.btnImportExternalToLibrary.disabled = !hasExternal;
        el.btnImportExternalToLibrary.title = hasExternal
            ? '将当前工坊里这条音频保存到音频库'
            : '先把音频载入工坊，或直接在 Freesound 搜索结果里点“导入音频库”';
    }
    if (el.btnApplyTrim) {
        el.btnApplyTrim.disabled = !hasExternal;
    }
    if (el.btnResetTrim) {
        el.btnResetTrim.disabled = !hasExternal;
    }
    if (el.btnClearExternal) {
        el.btnClearExternal.disabled = !hasExternal;
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

function parseDataUrlMimeType(dataUrl, fallback = 'audio/wav') {
    const match = `${dataUrl || ''}`.match(/^data:([^;,]+)[;,]/i);
    return match?.[1] ? match[1].toLowerCase() : fallback;
}

function dataUrlToBlob(dataUrl, fallbackMime = 'audio/wav') {
    const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
    const mimeType = parseDataUrlMimeType(dataUrl, fallbackMime);
    return new Blob([arrayBuffer], { type: mimeType });
}

function normalizeResourceUrl(value) {
    if (typeof value === 'string') {
        const text = value.trim();
        if (!text || text === '[object Object]') {
            return '';
        }
        return text;
    }
    if (value && typeof value === 'object') {
        const nested = value.url || value.src || value.path || value.href || '';
        if (typeof nested !== 'string') {
            return '';
        }
        const text = nested.trim();
        if (!text || text === '[object Object]') {
            return '';
        }
        return text;
    }
    return '';
}

function buildAudioSampleSignature(sample, fallback = '') {
    if (sample?.dataUrl) {
        return `data:${sample.dataUrl.length}:${sample.fileName || fallback}`;
    }
    const sampleUrl = normalizeResourceUrl(sample?.url);
    if (sampleUrl) {
        return `url:${sampleUrl}:${sample.fileName || fallback}`;
    }
    if (sample?.refKind === 'preset-sample' && sample?.refId) {
        return `ref:${sample.refKind}:${sample.refId}:${sample.fileName || fallback}`;
    }
    return `missing:${fallback}`;
}

function getAudioSamplePlayableUrl(sample) {
    if (sample?.dataUrl) {
        return sample.dataUrl;
    }
    const sampleUrl = normalizeResourceUrl(sample?.url);
    if (sampleUrl) {
        return sampleUrl;
    }
    if (sample?.refKind === 'preset-sample' && sample?.refId) {
        return getSfxPresetSample(sample.refId)?.dataUrl || '';
    }
    return '';
}

async function sampleToArrayBuffer(sample, fallbackMime = 'audio/wav') {
    if (sample?.dataUrl) {
        return dataUrlToArrayBuffer(sample.dataUrl);
    }
    const sampleUrl = normalizeResourceUrl(sample?.url);
    if (sampleUrl) {
        const response = await fetch(sampleUrl, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`音频拉取失败 (${response.status})`);
        }
        return response.arrayBuffer();
    }
    if (sample?.refKind === 'preset-sample' && sample?.refId) {
        const presetSample = getSfxPresetSample(sample.refId);
        if (presetSample?.dataUrl) {
            return dataUrlToArrayBuffer(presetSample.dataUrl);
        }
    }
    throw new Error('素材缺少可读取的音频源');
}

async function resolveAudioDurationFromSample(sample, fallbackMime = 'audio/wav') {
    const ctx = ensureAudioContext();
    const arrayBuffer = await sampleToArrayBuffer(sample, fallbackMime);
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return Math.max(0, Number(decoded.duration || 0));
}

async function uploadAudioLibrarySampleAsset(itemId, blob, fileName = '', mimeType = 'audio/wav') {
    const safeItemId = `${itemId || ''}`.trim();
    if (!safeItemId) {
        throw new Error('invalid audio item id');
    }
    const response = await fetch(`${AUDIO_LIBRARY_ASSET_API_BASE}/${encodeURIComponent(safeItemId)}?fileName=${encodeURIComponent(fileName || '')}`, {
        method: 'PUT',
        headers: {
            'Content-Type': `${mimeType || blob?.type || 'application/octet-stream'}`
        },
        body: blob
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `audio asset upload failed (${response.status})`);
    }
    return payload;
}

async function deleteAudioLibrarySampleAsset(itemId) {
    const safeItemId = `${itemId || ''}`.trim();
    if (!safeItemId) {
        return;
    }
    await fetch(`${AUDIO_LIBRARY_ASSET_API_BASE}/${encodeURIComponent(safeItemId)}`, {
        method: 'DELETE'
    }).catch(() => {});
}

async function buildStoredAudioLibrarySample(blob, sampleInfo = {}, itemId = '') {
    const sourceLabel = `${sampleInfo.sourceLabel || 'audio item'}`.trim() || 'audio item';
    const fileName = `${sampleInfo.fileName || `${itemId || 'audio-item'}.wav`}`.trim() || `${itemId || 'audio-item'}.wav`;
    const mimeType = `${sampleInfo.mimeType || blob?.type || 'audio/wav'}`.trim() || 'audio/wav';
    const uploaded = await uploadAudioLibrarySampleAsset(itemId, blob, fileName, mimeType);
    return {
        dataUrl: '',
        url: `${uploaded?.url || ''}`.trim(),
        refKind: '',
        refId: '',
        mimeType,
        fileName,
        sourceLabel
    };
}

function splitKeywordText(rawText) {
    return `${rawText || ''}`
        .split(/[,\n]/g)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}

function buildKeywordListFromQuery(query, extras = []) {
    const base = `${query || ''}`
        .split(/[\s,]+/g)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    const merged = [...base, ...extras];
    return Array.from(new Set(merged)).slice(0, 24);
}

function trimFileExtension(text) {
    const value = `${text || ''}`.trim();
    const dotIndex = value.lastIndexOf('.');
    return dotIndex > 0 ? value.slice(0, dotIndex) : value;
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

function refreshAudioLibraryState(preferredId = '') {
    state.audioLibrary = readAudioLibrary();
    const nextId = sanitizeId(preferredId || state.selectedAudioLibraryId || '');
    if (nextId && state.audioLibrary.some((item) => item.id === nextId)) {
        state.selectedAudioLibraryId = nextId;
    } else {
        state.selectedAudioLibraryId = state.audioLibrary[0]?.id || '';
    }
}

function getSelectedAudioLibraryItem() {
    const itemId = sanitizeId(state.selectedAudioLibraryId);
    return state.audioLibrary.find((item) => item.id === itemId) || null;
}

function findAudioLibraryItemByOriginKey(originKey) {
    const key = `${originKey || ''}`.trim();
    if (!key) {
        return null;
    }
    return state.audioLibrary.find((item) => item.originKey === key) || null;
}

function findStoredAudioLibraryItemByOriginKey(originKey) {
    const key = `${originKey || ''}`.trim();
    if (!key) {
        return null;
    }
    return readAudioLibrary().find((item) => item.originKey === key) || null;
}

function isProjectManagedAudioItem(item) {
    const kind = `${item?.sourceKind || ''}`.trim().toLowerCase();
    return kind === 'bgm' || kind === 'preset-sample' || kind === 'preset-render';
}

function buildAudioLibraryDraft(item = getSelectedAudioLibraryItem()) {
    if (!item) {
        return null;
    }
    const useEditorValues = item.id === sanitizeId(state.selectedAudioLibraryId);
    const duration = Math.max(0, Number(item.durationSeconds || 0));
    const rawStart = Number(useEditorValues ? (el.audioLibraryTrimStart?.value || item.trimStart || 0) : (item.trimStart || 0));
    const rawEnd = Number(useEditorValues ? (el.audioLibraryTrimEnd?.value || item.trimEnd || duration) : (item.trimEnd || duration));
    const start = duration > 0 ? clamp(Number.isFinite(rawStart) ? rawStart : 0, 0, Math.max(0, duration - 0.01)) : 0;
    const end = duration > 0 ? clamp(Number.isFinite(rawEnd) ? rawEnd : duration, start + 0.01, duration) : 0;
    const rawVolume = Number(useEditorValues ? (el.audioLibraryVolume?.value || item.volume || 1) : (item.volume || 1));
    const volume = clamp(Number.isFinite(rawVolume) ? rawVolume : 1, 0, 2);
    return {
        ...item,
        name: useEditorValues
            ? (`${el.audioLibraryName?.value || ''}`.trim() || item.name || item.id)
            : (item.name || item.id),
        keywords: useEditorValues
            ? splitKeywordText(el.audioLibraryKeywords?.value || item.keywords || '')
            : (Array.isArray(item.keywords) ? [...item.keywords] : []),
        trimStart: Number(start.toFixed(2)),
        trimEnd: Number(end.toFixed(2)),
        volume: Number(volume.toFixed(2))
    };
}

async function resolveAudioDurationFromDataUrl(dataUrl, fallbackMime = 'audio/wav') {
    const blob = dataUrlToBlob(dataUrl, fallbackMime);
    const ctx = ensureAudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return Math.max(0, Number(decoded.duration || 0));
}

async function upsertProjectAudioLibraryItem({
    originKey = '',
    sourceKind = 'manual',
    audioType = 'sfx',
    sourceLabel = '',
    name = '',
    description = '',
    fileName = '',
    keywords = [],
    sample = null,
    mimeType = '',
    params = null
} = {}) {
    if (!originKey || !sample) {
        return null;
    }
    const existing = findStoredAudioLibraryItemByOriginKey(originKey);
    const nextMimeType = `${mimeType || sample?.mimeType || 'audio/wav'}`.trim() || 'audio/wav';
    const nextName = `${name || existing?.name || fileName || 'audio-item'}`.trim();
    const nextSourceLabel = `${sourceLabel || existing?.sourceLabel || name || fileName || 'audio item'}`.trim();
    const nextFileName = `${fileName || sample?.fileName || existing?.sample?.fileName || nextName || 'audio-item'}`.trim();
    const itemIdentity = planAudioLibraryItemIdentity(
        {
            id: existing?.id || '',
            name: nextName,
            originKey,
            sample
        },
        existing ? { enforceUpdateId: existing.id } : {}
    );
    const targetItemId = `${itemIdentity?.id || existing?.id || ''}`.trim();
    const existingSampleUrl = normalizeResourceUrl(existing?.sample?.url);
    const incomingSampleUrl = normalizeResourceUrl(sample?.url);
    const nextSample = {
        ...(existing?.sample || {}),
        ...sample,
        mimeType: nextMimeType,
        fileName: nextFileName,
        sourceLabel: `${sample?.sourceLabel || existing?.sample?.sourceLabel || nextSourceLabel}`.trim()
    };
    if (!incomingSampleUrl && existingSampleUrl) {
        nextSample.url = existingSampleUrl;
    }
    if (sourceKind === 'preset-render' && targetItemId) {
        const resolvedUrl = normalizeResourceUrl(nextSample.url);
        const dataUrl = `${nextSample?.dataUrl || ''}`.trim();
        if (!resolvedUrl && dataUrl.startsWith('data:audio/')) {
            try {
                const renderedBlob = dataUrlToBlob(dataUrl, nextMimeType);
                const storedSample = await buildStoredAudioLibrarySample(
                    renderedBlob,
                    {
                        fileName: nextFileName,
                        mimeType: nextMimeType,
                        sourceLabel: nextSample.sourceLabel || nextSourceLabel
                    },
                    targetItemId
                );
                Object.assign(nextSample, storedSample);
            } catch (error) {
                console.warn('[admin-sfx-lab] preset-render sample upload failed, fallback to dataUrl', error);
            }
        } else if (resolvedUrl) {
            nextSample.dataUrl = '';
        }
    }
    const sampleChanged = buildAudioSampleSignature(existing?.sample, existing?.id || originKey) !== buildAudioSampleSignature(nextSample, originKey);
    let durationSeconds = Math.max(0, Number(existing?.durationSeconds || 0));
    if (sampleChanged || durationSeconds <= 0) {
        durationSeconds = await resolveAudioDurationFromSample(nextSample, nextMimeType);
    }
    const mergedKeywords = Array.from(new Set([
        ...(Array.isArray(existing?.keywords) ? existing.keywords : []),
        ...(Array.isArray(keywords) ? keywords : [])
    ])).slice(0, 24);
    const saved = upsertAudioLibraryItem({
        ...(existing || {}),
        id: targetItemId || undefined,
        name: nextName,
        description: `${existing?.description || description || ''}`.trim(),
        audioType,
        sourceKind,
        sourceLabel: nextSourceLabel,
        originKey,
        keywords: mergedKeywords,
        params: audioType === 'sfx'
            ? normalizeRecipe({ presetId: state.presetId, params: params || existing?.params || state.params }, state.presetId).params
            : null,
        durationSeconds,
        volume: Number.isFinite(Number(existing?.volume)) ? Number(existing.volume) : 1,
        trimStart: sampleChanged ? 0 : Number(existing?.trimStart || 0),
        trimEnd: sampleChanged ? durationSeconds : Number(existing?.trimEnd || durationSeconds),
        sample: nextSample
    }, existing ? { enforceUpdateId: existing.id } : {});
    if (saved && sampleChanged) {
        audioLibraryBufferCache.delete(saved.id);
    }
    return saved;
}

function buildPresetRenderSeed(presetId = '') {
    let hash = 2166136261;
    const text = `${presetId || ''}`.trim().toLowerCase();
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

async function buildRenderedPresetLibrarySample(preset) {
    const recipe = normalizeRecipe({
        presetId: preset.id,
        params: { ...preset.defaults }
    }, preset.id);
    const blob = await renderRecipeToWav(recipe, buildPresetRenderSeed(preset.id));
    const dataUrl = await blobToDataUrl(blob);
    return {
        dataUrl,
        url: '',
        refKind: '',
        refId: '',
        mimeType: blob.type || 'audio/wav',
        fileName: `${preset.id}.wav`,
        sourceLabel: `合成预设：${preset.name}`
    };
}

async function syncPresetSamplesToAudioLibrary(expectedOriginKeys) {
    const presets = getSfxPresetCatalog();
    for (const preset of presets) {
        const hasPresetSample = !!preset?.sample?.dataUrl;
        const originKey = hasPresetSample
            ? `preset-sample:${preset.id}`
            : `preset-render:${preset.id}`;
        expectedOriginKeys.add(originKey);
        const sample = hasPresetSample
            ? {
                dataUrl: '',
                url: '',
                refKind: 'preset-sample',
                refId: preset.id,
                mimeType: preset.sample?.mimeType || parseDataUrlMimeType(preset.sample.dataUrl, 'audio/wav'),
                fileName: preset.sample?.fileName || `${preset.id}.wav`,
                sourceLabel: `模板采样：${preset.name}`
            }
            : await buildRenderedPresetLibrarySample(preset);
        await upsertProjectAudioLibraryItem({
            originKey,
            audioType: 'sfx',
            sourceKind: hasPresetSample ? 'preset-sample' : 'preset-render',
            sourceLabel: hasPresetSample ? `模板采样：${preset.name}` : `合成预设：${preset.name}`,
            name: hasPresetSample ? `${preset.name}（模板采样）` : `${preset.name}（原合成音效）`,
            description: preset.description || '',
            fileName: sample.fileName || `${preset.id}.wav`,
            keywords: buildKeywordListFromQuery(
                preset.name,
                hasPresetSample ? ['sfx', 'preset'] : ['sfx', 'preset', 'legacy', 'synth']
            ),
            sample,
            mimeType: sample.mimeType || 'audio/wav',
            params: preset.defaults
        });
    }
}

async function syncBgmTracksToAudioLibrary(expectedOriginKeys) {
    for (const track of state.bgmTrackLibrary) {
        const originKey = `bgm:${track.url}`;
        expectedOriginKeys.add(originKey);
        await upsertProjectAudioLibraryItem({
            originKey,
            audioType: 'music',
            sourceKind: 'bgm',
            sourceLabel: `游戏音乐：${track.name}`,
            name: `${track.name}（音乐）`,
            fileName: track.fileName || track.name || formatTrackLabel(track.url),
            keywords: buildKeywordListFromQuery(track.name || track.fileName || track.url, ['music', 'bgm']),
            sample: {
                dataUrl: '',
                url: track.url,
                refKind: '',
                refId: '',
                mimeType: 'audio/mpeg',
                fileName: track.fileName || track.name || formatTrackLabel(track.url),
                sourceLabel: `游戏音乐：${track.name}`
            },
            mimeType: 'audio/mpeg'
        });
    }
}

async function syncProjectAudioLibrary(options = {}) {
    const refreshBgm = options.refreshBgm !== false;
    const expectedOriginKeys = new Set();
    const errors = [];
    try {
        await syncPresetSamplesToAudioLibrary(expectedOriginKeys);
    } catch (error) {
        errors.push(`模板采样同步失败：${error?.message || 'Unknown error'}`);
    }
    try {
        if (refreshBgm || !Array.isArray(state.bgmTrackLibrary) || state.bgmTrackLibrary.length <= 0) {
            state.bgmTrackLibrary = await fetchBgmTrackLibrary();
        }
        await syncBgmTracksToAudioLibrary(expectedOriginKeys);
    } catch (error) {
        errors.push(`项目音乐同步失败：${error?.message || 'Unknown error'}`);
    }
    const current = readAudioLibrary();
    for (const item of current) {
        if (isProjectManagedAudioItem(item) && !expectedOriginKeys.has(item.originKey)) {
            deleteAudioLibraryItem(item.id);
            audioLibraryBufferCache.delete(item.id);
        }
    }
    refreshAudioLibraryState(state.selectedAudioLibraryId);
    return {
        total: state.audioLibrary.length,
        errors
    };
}

function syncAudioLibraryEditorFromSelection() {
    const item = getSelectedAudioLibraryItem();
    const hasItem = !!item;
    const isSfxItem = hasItem && `${item.audioType || 'sfx'}`.trim().toLowerCase() === 'sfx';
    if (el.audioLibraryName) {
        el.audioLibraryName.value = hasItem ? (item.name || '') : '';
        el.audioLibraryName.disabled = !hasItem;
    }
    if (el.audioLibraryKeywords) {
        el.audioLibraryKeywords.value = hasItem ? (Array.isArray(item.keywords) ? item.keywords.join(', ') : '') : '';
        el.audioLibraryKeywords.disabled = !hasItem;
    }
    if (el.audioLibraryVolume) {
        el.audioLibraryVolume.value = hasItem ? Number(item.volume || 1).toFixed(2) : '1.00';
        el.audioLibraryVolume.disabled = !hasItem;
    }
    if (el.audioLibraryTrimStart) {
        el.audioLibraryTrimStart.value = hasItem ? Number(item.trimStart || 0).toFixed(2) : '0';
        el.audioLibraryTrimStart.disabled = !hasItem;
    }
    if (el.audioLibraryTrimEnd) {
        const duration = Number(item?.durationSeconds || 0);
        el.audioLibraryTrimEnd.value = hasItem ? Number(item.trimEnd || duration || 0).toFixed(2) : '0';
        el.audioLibraryTrimEnd.disabled = !hasItem;
    }
    if (el.audioLibraryMeta) {
        if (!hasItem) {
            el.audioLibraryMeta.textContent = '未选择素材。';
        } else {
            const keywords = Array.isArray(item.keywords) && item.keywords.length > 0
                ? item.keywords.join(', ')
                : '无';
            const projectHint = isProjectManagedAudioItem(item)
                ? ' | 项目自动汇总资源'
                : '';
            el.audioLibraryMeta.textContent = `类型：${getAudioTypeLabel(item.audioType)} | 来源：${item.sourceLabel || '-'} | 时长：${Number(item.durationSeconds || 0).toFixed(2)}s | 关键词：${keywords}${projectHint}`;
        }
    }
    if (el.btnAudioLibraryPreview) {
        el.btnAudioLibraryPreview.disabled = !hasItem;
    }
    if (el.btnAudioLibraryImport) {
        el.btnAudioLibraryImport.disabled = !hasItem || !isSfxItem;
        el.btnAudioLibraryImport.title = !hasItem
            ? ''
            : (isSfxItem ? '将当前音效导回工坊继续编辑' : '音乐素材不能导入音效工坊');
    }
    if (el.btnAudioLibrarySave) {
        el.btnAudioLibrarySave.disabled = !hasItem;
    }
    if (el.btnAudioLibraryDelete) {
        el.btnAudioLibraryDelete.disabled = !hasItem || isProjectManagedAudioItem(item);
    }
}

function renderAudioLibraryList() {
    if (!el.audioLibraryList) return;
    const query = `${el.audioLibrarySearch?.value || ''}`.trim().toLowerCase();
    el.audioLibraryList.innerHTML = '';
    const rows = state.audioLibrary.filter((item) => {
        if (!query) {
            return true;
        }
        const haystack = [
            item.name,
            getAudioTypeLabel(item.audioType),
            item.audioType,
            item.sourceLabel,
            item.description,
            ...(Array.isArray(item.keywords) ? item.keywords : [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });
    if (rows.length <= 0) {
        const empty = document.createElement('div');
        empty.className = 'sfx-source-result-item';
        empty.textContent = query ? '没有匹配的素材。' : '素材库为空。先从音效工坊导入一些音频。';
        el.audioLibraryList.appendChild(empty);
        return;
    }
    for (const item of rows) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'audio-library-card';
        card.classList.toggle('is-active', item.id === state.selectedAudioLibraryId);

        const title = document.createElement('strong');
        title.textContent = item.name || item.id;
        card.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'audio-library-card-meta';
        meta.textContent = `${getAudioTypeLabel(item.audioType)} | ${item.sourceLabel || item.sourceKind || '-'} | ${Number(item.durationSeconds || 0).toFixed(2)}s | 音量 ${Number(item.volume || 1).toFixed(2)}`;
        card.appendChild(meta);

        const keywordLine = document.createElement('div');
        keywordLine.className = 'audio-library-card-keywords';
        keywordLine.textContent = Array.isArray(item.keywords) && item.keywords.length > 0
            ? item.keywords.map((keyword) => `#${keyword}`).join(' ')
            : '#无关键词';
        card.appendChild(keywordLine);

        card.addEventListener('click', () => {
            state.selectedAudioLibraryId = item.id;
            syncAudioLibraryEditorFromSelection();
            renderAudioLibraryList();
        });
        el.audioLibraryList.appendChild(card);
    }
}

function refreshAudioLibraryUi(preferredId = '') {
    refreshAudioLibraryState(preferredId);
    syncAudioLibraryEditorFromSelection();
    renderAudioLibraryList();
    refreshSkinPresetSelectOptions();
    syncSelectedSkinBindingUi();
    renderSkinBindingList();
    renderGameSfxBindingList();
}

async function decodeAudioLibraryBuffer(item) {
    if (!item?.sample) {
        throw new Error('素材缺少音频数据');
    }
    const signature = `${item.id}:${buildAudioSampleSignature(item.sample, item.updatedAt || '')}:${item.updatedAt || ''}`;
    const cached = audioLibraryBufferCache.get(item.id);
    if (cached && cached.signature === signature && cached.buffer) {
        return cached.buffer;
    }
    const ctx = ensureAudioContext();
    const arrayBuffer = await sampleToArrayBuffer(item.sample, item.sample?.mimeType || 'audio/wav');
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    audioLibraryBufferCache.set(item.id, {
        signature,
        buffer: decoded
    });
    return decoded;
}

async function buildProcessedAudioLibraryBlob(item) {
    const buffer = await decodeAudioLibraryBuffer(item);
    const duration = Number(buffer.duration || item.durationSeconds || 0);
    const start = clamp(Number(item.trimStart || 0), 0, Math.max(0, duration - 0.01));
    const end = clamp(Number(item.trimEnd || duration), start + 0.01, duration);
    const gain = clamp(Number(item.volume || 1), 0, 2);
    return audioBufferSegmentToWavBlob(buffer, start, end, gain);
}

async function saveCurrentExternalSampleToLibrary(overrides = {}) {
    if (!state.externalSample?.blob) {
        throw new Error('当前工坊没有外部采样');
    }
    const trim = resolveExternalTrimWindow();
    const sourceBlob = trim
        ? audioBufferSegmentToWavBlob(state.externalSample.buffer, trim.start, trim.end)
        : state.externalSample.blob;
    const duration = trim
        ? Math.max(0.01, trim.end - trim.start)
        : Math.max(0, Number(state.externalSample?.buffer?.duration || 0));
    const nextName = `${overrides.name || trimFileExtension(state.externalSample?.fileName || 'audio-item')}`.trim() || 'audio-item';
    const identity = planAudioLibraryItemIdentity({
        id: overrides.id,
        name: nextName,
        originKey: overrides.originKey || ''
    }, overrides.enforceUpdateId ? { enforceUpdateId: overrides.enforceUpdateId } : {});
    const storedSample = await buildStoredAudioLibrarySample(sourceBlob, {
        fileName: state.externalSample?.fileName || `${identity.id}.wav`,
        mimeType: sourceBlob.type || state.externalSample?.blob?.type || 'audio/wav',
        sourceLabel: overrides.sourceLabel || state.externalSample?.sourceLabel || '工坊导入音效'
    }, identity.id);
    const saved = upsertAudioLibraryItem({
        id: identity.id,
        name: nextName,
        description: overrides.description || '',
        audioType: overrides.audioType || 'sfx',
        sourceKind: overrides.sourceKind || 'manual',
        sourceLabel: overrides.sourceLabel || state.externalSample?.sourceLabel || storedSample.sourceLabel,
        originKey: overrides.originKey || '',
        keywords: Array.isArray(overrides.keywords)
            ? overrides.keywords
            : splitKeywordText(el.audioLibraryKeywords?.value || ''),
        params: normalizeRecipe({ presetId: state.presetId, params: overrides.params || state.params }, state.presetId).params,
        durationSeconds: duration,
        volume: Number.isFinite(Number(overrides.volume)) ? Number(overrides.volume) : 1,
        trimStart: 0,
        trimEnd: duration,
        sample: storedSample
    }, overrides.enforceUpdateId ? { enforceUpdateId: overrides.enforceUpdateId } : {});
    if (!saved) {
        throw new Error('保存素材失败');
    }
    refreshAudioLibraryUi(saved.id);
    return saved;
}

async function importCurrentExternalToAudioLibrary() {
    if (!state.externalSample?.blob) {
        throw new Error('请先在工坊中载入一个音频');
    }
    const saved = await saveCurrentExternalSampleToLibrary({
        name: trimFileExtension(state.externalSample.fileName || state.externalSample.sourceLabel || 'audio-item'),
        sourceKind: state.sourceMode === 'stable-audio'
            ? 'stable-audio'
            : (state.sourceMode === 'upload' ? 'upload' : (state.sourceMode === 'freesound' ? 'freesound' : 'manual')),
        sourceLabel: state.externalSample.sourceLabel || '工坊导入音效',
        keywords: buildKeywordListFromQuery(
            [
                el.fsQuery?.value,
                el.aiPrompt?.value,
                trimFileExtension(state.externalSample.fileName || '')
            ].filter(Boolean).join(' ')
        ),
        audioType: 'sfx',
        params: state.params
    });
    setAudioLibraryStatus(`已导入音频库：${saved.name}`);
    setMusicSfxSubTab('audio-library');
    return saved;
}

function buildFreesoundRowKeywords(row) {
    return buildKeywordListFromQuery(el.fsQuery?.value, [row?.licenseTag, 'freesound']);
}

async function fetchFreesoundRowBlob(row) {
    if (!row?.previewUrl) {
        throw new Error('该结果没有可导入的音频地址');
    }
    const proxyUrl = `/api/sfx/freesound/proxy?url=${encodeURIComponent(row.previewUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`proxy fetch failed (${response.status})`);
    }
    return response.blob();
}

async function importFreesoundRowToAudioLibrary(row) {
    const originKey = Number(row?.id) > 0 ? `freesound:${Number(row.id)}` : '';
    const searchKeywords = buildFreesoundRowKeywords(row);
    const cached = findAudioLibraryItemByOriginKey(originKey);
    if (cached) {
        const mergedKeywords = Array.from(new Set([...(cached.keywords || []), ...searchKeywords]));
        const saved = mergedKeywords.length !== (cached.keywords || []).length
            ? (upsertAudioLibraryItem({
                ...cached,
                keywords: mergedKeywords
            }, { enforceUpdateId: cached.id }) || cached)
            : cached;
        refreshAudioLibraryUi(saved.id);
        setMusicSfxSubTab('audio-library');
        setAudioLibraryStatus(`音频已在库中：${saved.name}`);
        return saved;
    }

    const blob = await fetchFreesoundRowBlob(row);
    await setExternalSampleFromBlob(
        blob,
        `Freesound: ${row.name} (#${row.id})`,
        `${slugifyLabel(row.name || `fs-${row.id}`, `freesound-${row.id}`)}.wav`
    );
    state.previewMode = 'external';
    const saved = await saveCurrentExternalSampleToLibrary({
        name: trimFileExtension(state.externalSample?.fileName || row.name || `freesound-${row.id}`),
        audioType: 'sfx',
        sourceKind: 'freesound',
        sourceLabel: `Freesound: ${row.name} (#${row.id})`,
        originKey,
        keywords: searchKeywords,
        params: state.params
    });
    setMusicSfxSubTab('audio-library');
    setAudioLibraryStatus(`已导入音频库：${saved.name}`);
    setStatus(`已从 Freesound 导入音频库：${saved.name}`);
    return saved;
}

async function importAudioLibraryItemToWorkbench(item = getSelectedAudioLibraryItem()) {
    if (!item) {
        throw new Error('请先选择素材');
    }
    if (`${item.audioType || 'sfx'}`.trim().toLowerCase() !== 'sfx') {
        throw new Error('音乐素材不能导入音效工坊');
    }
    const draft = buildAudioLibraryDraft(item) || item;
    const processedBlob = await buildProcessedAudioLibraryBlob(draft);
    await setExternalSampleFromBlob(
        processedBlob,
        draft.sourceLabel || draft.name || 'audio library item',
        `${slugifyLabel(draft.name || draft.sample?.fileName || draft.id, 'audio-library')}.wav`
    );
    applyRecipe(
        {
            presetId: state.presetId,
            params: draft.params || state.params
        },
        true
    );
    setMusicSfxSubTab('sfx-lab');
    setStatus(`已从素材库导入到工坊：${draft.name}`);
}

function stopAudioLibraryPreview(reset = false) {
    const audio = el.audioLibraryPreviewAudio;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    state.audioLibraryPreview.itemId = '';
    state.audioLibraryPreview.trimStart = 0;
    state.audioLibraryPreview.trimEnd = 0;
    if (reset) {
        audio.removeAttribute('src');
        audio.load();
    }
}

async function previewAudioLibraryItem(item = getSelectedAudioLibraryItem()) {
    if (!item) {
        throw new Error('请先选择素材');
    }
    const draft = buildAudioLibraryDraft(item) || item;
    const audio = el.audioLibraryPreviewAudio;
    if (!audio) {
        throw new Error('preview audio element not found');
    }
    const duration = Math.max(0, Number(draft.durationSeconds || 0));
    const trimStart = clamp(Number(draft.trimStart || 0), 0, Math.max(0, duration - 0.01));
    const trimEnd = duration > 0
        ? clamp(Number(draft.trimEnd || duration), trimStart + 0.01, duration)
        : 0;
    state.audioLibraryPreview.itemId = draft.id;
    state.audioLibraryPreview.trimStart = trimStart;
    state.audioLibraryPreview.trimEnd = trimEnd;
    audio.volume = clamp(Number(draft.volume || 1), 0, 2);
    const sampleUrl = getAudioSamplePlayableUrl(draft.sample);
    if (!sampleUrl) {
        throw new Error('素材缺少可播放音频');
    }
    if (audio.src !== sampleUrl) {
        audio.src = sampleUrl;
        audio.load();
    }
    if (audio.readyState < 1) {
        await new Promise((resolve, reject) => {
            const cleanup = () => {
                audio.removeEventListener('loadedmetadata', onReady);
                audio.removeEventListener('canplay', onReady);
                audio.removeEventListener('error', onError);
            };
            const onReady = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error('素材预览加载失败'));
            };
            audio.addEventListener('loadedmetadata', onReady, { once: true });
            audio.addEventListener('canplay', onReady, { once: true });
            audio.addEventListener('error', onError, { once: true });
        });
    }
    audio.currentTime = trimStart;
    await audio.play();
    setAudioLibraryStatus(`试听素材：${draft.name}`);
}

function saveSelectedAudioLibraryEdits() {
    const item = getSelectedAudioLibraryItem();
    if (!item) {
        setAudioLibraryStatus('请先选择素材。', true);
        return;
    }
    const draft = buildAudioLibraryDraft(item);
    const saved = upsertAudioLibraryItem(draft, { enforceUpdateId: item.id });
    if (!saved) {
        setAudioLibraryStatus('保存素材修改失败。', true);
        return;
    }
    if (state.audioLibraryPreview.itemId === saved.id && el.audioLibraryPreviewAudio) {
        el.audioLibraryPreviewAudio.volume = saved.volume;
        state.audioLibraryPreview.trimStart = saved.trimStart;
        state.audioLibraryPreview.trimEnd = saved.trimEnd;
    }
    refreshAudioLibraryUi(saved.id);
    setAudioLibraryStatus(`已保存素材：${saved.name}`);
}

async function deleteSelectedAudioLibraryRecord() {
    const item = getSelectedAudioLibraryItem();
    if (!item) {
        setAudioLibraryStatus('请先选择素材。', true);
        return;
    }
    if (isProjectManagedAudioItem(item)) {
        setAudioLibraryStatus('这是项目自动汇总的资源，请在原始模板或音乐资源处移除。', true);
        return;
    }
    if (!deleteAudioLibraryItem(item.id)) {
        setAudioLibraryStatus('删除素材失败。', true);
        return;
    }
    await deleteAudioLibrarySampleAsset(item.id);
    audioLibraryBufferCache.delete(item.id);
    stopAudioLibraryPreview(true);
    refreshAudioLibraryUi('');
    setAudioLibraryStatus(`已删除素材：${item.name}`);
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

function audioBufferSegmentToWavBlob(buffer, startSeconds = 0, endSeconds = null, gainMultiplier = 1) {
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
    const gain = Number.isFinite(Number(gainMultiplier)) ? Math.max(0, Number(gainMultiplier)) : 1;
    for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
    for (let i = startFrame; i < endFrame; i += 1) {
        for (let c = 0; c < channels; c += 1) {
            const sample = clamp(data[c][i] * gain, -1, 1);
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
        const originKey = Number(row?.id) > 0 ? `freesound:${Number(row.id)}` : '';
        const cachedItem = findAudioLibraryItemByOriginKey(originKey);
        const item = document.createElement('div');
        item.className = 'sfx-source-result-item';

        const title = document.createElement('h5');
        title.textContent = row.name || `sound-${row.id}`;
        item.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'sfx-source-result-meta';
        meta.textContent = `by ${row.user || 'unknown'} | ${Number(row.duration || 0).toFixed(2)}s | ${row.licenseTag || 'unknown'}${cachedItem ? ' | 已入库' : ''}`;
        item.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'sfx-source-result-actions';

        const btnPreview = document.createElement('button');
        btnPreview.type = 'button';
        btnPreview.textContent = '试听';
        btnPreview.disabled = !row.previewUrl;
        btnPreview.addEventListener('click', () => {
            void startFsPreview(row);
        });
        actions.appendChild(btnPreview);

        const btnUse = document.createElement('button');
        btnUse.type = 'button';
        btnUse.className = 'primary';
        btnUse.textContent = cachedItem ? '载入工坊编辑（库）' : '载入工坊编辑';
        btnUse.addEventListener('click', async () => {
            if (!row.previewUrl) return;
            btnUse.disabled = true;
            try {
                const searchKeywords = buildFreesoundRowKeywords(row);
                const cached = findAudioLibraryItemByOriginKey(originKey);
                if (cached) {
                    const mergedKeywords = Array.from(new Set([...(cached.keywords || []), ...searchKeywords]));
                    const reusable = mergedKeywords.length !== (cached.keywords || []).length
                        ? (upsertAudioLibraryItem({
                            ...cached,
                            keywords: mergedKeywords
                        }, { enforceUpdateId: cached.id }) || cached)
                        : cached;
                    refreshAudioLibraryUi(reusable.id);
                    await importAudioLibraryItemToWorkbench(reusable);
                    setFsStatus(`已从素材库导入：${reusable.name}`);
                    return;
                }
                const blob = await fetchFreesoundRowBlob(row);
                await setExternalSampleFromBlob(
                    blob,
                    `Freesound: ${row.name} (#${row.id})`,
                    `${slugifyLabel(row.name || `fs-${row.id}`, `freesound-${row.id}`)}.wav`
                );
                state.previewMode = 'external';
                setFsStatus(`已载入工坊，可继续裁剪/调参数：${row.name}`);
                setStatus(`已载入工坊：${row.name}`);
            } catch (error) {
                setFsStatus(`导入失败：${error?.message || 'Unknown error'}`, true);
            } finally {
                btnUse.disabled = false;
            }
        });
        actions.appendChild(btnUse);

        const btnImportLibrary = document.createElement('button');
        btnImportLibrary.type = 'button';
        btnImportLibrary.textContent = cachedItem ? '导入音频库（已入库）' : '导入音频库';
        btnImportLibrary.addEventListener('click', async () => {
            btnImportLibrary.disabled = true;
            try {
                const saved = await importFreesoundRowToAudioLibrary(row);
                setFsStatus(`已导入音频库：${saved.name}`);
            } catch (error) {
                setFsStatus(`导入音频库失败：${error?.message || 'Unknown error'}`, true);
            } finally {
                btnImportLibrary.disabled = false;
            }
        });
        actions.appendChild(btnImportLibrary);

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
            setAiStatus('生成成功（fal.ai），已导入工坊，可继续编辑后导入音频库。');
        } else {
            setAiStatus('生成成功，已导入工坊，可继续编辑后导入音频库。');
        }
        setStatus('Stable Audio 音频已载入工坊。');
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
        state.previewMode = 'external';
        setStatus(`已载入工坊：${file.name}`);
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

function getAudioTypeLabel(audioType = 'sfx') {
    return `${audioType || ''}`.trim().toLowerCase() === 'music' ? '音乐' : '音效';
}

function buildLegacyPresetSelectOption(bindingId) {
    const presetId = sanitizeId(bindingId);
    if (!presetId) {
        return null;
    }
    const preset = getSfxPresetById(presetId);
    if (preset.id !== presetId) {
        return null;
    }
    return {
        value: presetId,
        label: `合成预设：${preset.name || presetId}`
    };
}

function resolveSkinBindingSelectionState(skinId) {
    const itemId = getSkinSfxAudioItemId(skinId, '');
    if (itemId) {
        return { value: itemId, legacyOption: null };
    }
    const bindings = readSkinSfxBindings();
    const bindingId = sanitizeId(bindings[sanitizeId(skinId)]);
    return {
        value: bindingId,
        legacyOption: buildLegacyPresetSelectOption(bindingId)
    };
}

function getSfxAudioLibraryOptions() {
    return state.audioLibrary
        .filter((item) => item.audioType === 'sfx')
        .sort((a, b) => {
            const aManaged = isProjectManagedAudioItem(a) ? 1 : 0;
            const bManaged = isProjectManagedAudioItem(b) ? 1 : 0;
            if (aManaged !== bManaged) {
                return aManaged - bManaged;
            }
            return `${a.name || a.id}`.localeCompare(`${b.name || b.id}`, 'zh-CN');
        });
}

function fillSfxAudioLibrarySelect(select, preferredId = '', legacyOption = null) {
    if (!select) {
        return;
    }
    const options = getSfxAudioLibraryOptions();
    const preferred = sanitizeId(preferredId);
    select.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '未设置（使用默认合成音效）';
    select.appendChild(empty);
    if (legacyOption && sanitizeId(legacyOption.value) === preferred && !options.some((item) => item.id === preferred)) {
        const option = document.createElement('option');
        option.value = preferred;
        option.textContent = legacyOption.label;
        select.appendChild(option);
    }
    for (const item of options) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name || item.id;
        select.appendChild(option);
    }
    if (options.some((item) => item.id === preferred)) {
        select.value = preferred;
        return;
    }
    if (legacyOption && sanitizeId(legacyOption.value) === preferred) {
        select.value = preferred;
        return;
    }
    select.value = '';
}

function stopGameSfxPreviewLoop(previewKey = '') {
    const key = `${previewKey || ''}`.trim();
    if (!key) {
        return;
    }
    const node = gameSfxPreviewLoops.get(key);
    if (!node) {
        return;
    }
    try {
        node.source.onended = null;
        node.source.stop();
    } catch {
        // noop
    }
    try {
        node.source.disconnect();
    } catch {
        // noop
    }
    try {
        node.gain.disconnect();
    } catch {
        // noop
    }
    gameSfxPreviewLoops.delete(key);
}

function stopAllGameSfxPreviewLoops() {
    const keys = Array.from(gameSfxPreviewLoops.keys());
    for (const key of keys) {
        stopGameSfxPreviewLoop(key);
    }
}

async function playAudioLibraryBindingPreview(itemId, label = '', options = {}) {
    const statusTarget = options?.statusTarget === 'game' ? 'game' : 'skin';
    const setStatus = statusTarget === 'game' ? setGameSfxStatus : setSkinStatus;
    const loop = options?.loop === true;
    const previewKey = `${options?.previewKey || ''}`.trim();
    const item = state.audioLibrary.find((row) => row.id === sanitizeId(itemId));
    if (!item) {
        const legacyOption = buildLegacyPresetSelectOption(itemId);
        if (legacyOption) {
            setStatus(`当前绑定为${legacyOption.label}，游戏内可正常播放；后台试听仅支持音频库条目。`);
            return;
        }
        setStatus('请先从音频库选择一个音效。', true);
        return;
    }
    try {
        const ctx = await ensureAudioReady();
        const buffer = await decodeAudioLibraryBuffer(item);
        const duration = Math.max(0, Number(buffer.duration || item.durationSeconds || 0));
        const trimStart = duration > 0 ? clamp(Number(item.trimStart || 0), 0, Math.max(0, duration - 0.01)) : 0;
        const trimEnd = duration > 0 ? clamp(Number(item.trimEnd || duration), trimStart + 0.01, duration) : duration;
        const plan = buildExternalPlaybackPlan(item.params || {}, Date.now());
        const volumeGain = clamp(Number(item.volume || 1), 0, 2);
        if (loop && previewKey) {
            if (gameSfxPreviewLoops.has(previewKey)) {
                stopGameSfxPreviewLoop(previewKey);
                setStatus(`已停止循环试听：${label || item.name}`);
                return;
            }
            stopGameSfxPreviewLoop(previewKey);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.loopStart = trimStart;
            source.loopEnd = Math.max(trimStart + 0.01, trimEnd);
            source.playbackRate.setValueAtTime(clamp(plan.baseRate, 0.45, 2.2), ctx.currentTime);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(clamp(plan.impactGain * volumeGain, 0.02, 4), ctx.currentTime);
            source.connect(gain);
            gain.connect(ctx.destination);
            source.onended = () => {
                if (gameSfxPreviewLoops.get(previewKey)?.source === source) {
                    gameSfxPreviewLoops.delete(previewKey);
                }
            };
            source.start(ctx.currentTime + 0.01, trimStart);
            gameSfxPreviewLoops.set(previewKey, { source, gain });
            setStatus(`开始循环试听：${label || item.name}`);
            return;
        }
        let cursor = ctx.currentTime + 0.02;
        for (let i = 0; i < plan.repeats; i += 1) {
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const rate = clamp(plan.baseRate * plan.jitter(i), 0.45, 2.2);
            source.playbackRate.setValueAtTime(rate, cursor);

            const gain = ctx.createGain();
            const repeatDecay = Math.pow(0.82 - plan.bounce * 0.14, i);
            gain.gain.setValueAtTime(clamp(plan.impactGain * volumeGain * repeatDecay, 0.02, 4), cursor);
            source.connect(gain);
            gain.connect(ctx.destination);

            const partDuration = Math.max(0.01, trimEnd - trimStart);
            source.start(cursor, trimStart, partDuration);
            source.stop(cursor + partDuration / rate + 0.02);
            cursor += (partDuration / rate) * clamp(0.62 - plan.bounce * 0.22, 0.28, 0.72);
        }
        setStatus(`试听：${label || item.name}`);
    } catch (error) {
        setStatus(`试听失败：${error?.message || 'Unknown error'}`, true);
    }
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
    const state = resolveSkinBindingSelectionState(el.skinSelect?.value || '');
    fillSfxAudioLibrarySelect(el.skinPresetSelect, state.value, state.legacyOption);
}

function syncSelectedSkinBindingUi() {
    if (!el.skinSelect || !el.skinPresetSelect) return;
    const state = resolveSkinBindingSelectionState(el.skinSelect.value);
    fillSfxAudioLibrarySelect(el.skinPresetSelect, state.value, state.legacyOption);
}

function renderSkinBindingList() {
    if (!el.skinBindingList) return;
    el.skinBindingList.innerHTML = '';
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
        const bindingState = resolveSkinBindingSelectionState(row.id);
        fillSfxAudioLibrarySelect(select, bindingState.value, bindingState.legacyOption);
        select.addEventListener('change', () => {
            state.skinBindings = setSkinSfxAudioItemId(row.id, select.value);
            if (sanitizeId(el.skinSelect?.value || '') === row.id) {
                el.skinPresetSelect.value = sanitizeId(select.value || '');
            }
            const selectedItem = state.audioLibrary.find((audioItem) => audioItem.id === sanitizeId(select.value));
            setSkinStatus(`Updated: ${row.nameZh || row.id} -> ${selectedItem?.name || '默认合成音效'}`);
        });
        actions.appendChild(select);

        const btnPreview = document.createElement('button');
        btnPreview.type = 'button';
        btnPreview.className = 'skin-sfx-preview-btn';
        btnPreview.textContent = '试听';
        btnPreview.addEventListener('click', () => {
            void playAudioLibraryBindingPreview(select.value, row.nameZh || row.id);
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
    click: '点击反馈音效',
    coin: '金币获得音效',
    checkinCoinTrail: '签到飞金币音效',
    error: '错误/惩罚音效',
    levelComplete: '通关音效',
    gameOver: '失败音效'
});

function refreshGameSfxState() {
    state.gameSfxBindings = readGameSfxBindings();
    const draft = {};
    for (const eventKey of Object.keys(GAME_SFX_EVENT_FIELD_MAP)) {
        const rows = getGameSfxBindingOptions(eventKey, '')
            .map((row) => ({
                audioItemId: sanitizeId(row?.audioItemId || ''),
                loop: row?.loop === true
            }))
            .filter((row) => !!row.audioItemId);
        draft[eventKey] = rows.length > 0 ? rows : [{ audioItemId: '', loop: false }];
    }
    state.gameSfxDraftByEvent = draft;
}

function renderGameSfxBindingList() {
    if (!el.gameSfxBindingList) {
        return;
    }
    stopAllGameSfxPreviewLoops();
    el.gameSfxBindingList.innerHTML = '';
    for (const [eventKey, label] of Object.entries(GAME_SFX_EVENT_FIELD_MAP)) {
        const options = state.gameSfxDraftByEvent[eventKey] || [{ audioItemId: '', loop: false }];

        const card = document.createElement('div');
        card.className = 'game-sfx-event-card';

        const head = document.createElement('div');
        head.className = 'game-sfx-event-head';
        const title = document.createElement('strong');
        title.textContent = label;
        const btnAdd = document.createElement('button');
        btnAdd.type = 'button';
        btnAdd.className = 'game-sfx-mini-btn';
        btnAdd.textContent = '+';
        btnAdd.title = `为「${label}」增加一条音频配置`;
        btnAdd.addEventListener('click', () => {
            options.push({ audioItemId: '', loop: false });
            state.gameSfxDraftByEvent[eventKey] = options;
            renderGameSfxBindingList();
        });
        head.append(title, btnAdd);
        card.appendChild(head);

        const list = document.createElement('div');
        list.className = 'game-sfx-option-list';
        for (let index = 0; index < options.length; index += 1) {
            const row = options[index];
            const previewKey = `${eventKey}:${index}`;
            const node = document.createElement('div');
            node.className = 'game-sfx-option-row';

            const select = document.createElement('select');
            fillSfxAudioLibrarySelect(select, row.audioItemId || '');
            select.addEventListener('change', () => {
                row.audioItemId = sanitizeId(select.value || '');
                const selectedItem = state.audioLibrary.find((item) => item.id === row.audioItemId);
                setGameSfxStatus(`已更新：${label} -> ${selectedItem?.name || '未设置'}`);
            });
            node.appendChild(select);

            const loopLabel = document.createElement('label');
            loopLabel.className = 'game-sfx-loop-label';
            const loopInput = document.createElement('input');
            loopInput.type = 'checkbox';
            loopInput.checked = row.loop === true;
            const loopText = document.createElement('span');
            loopText.textContent = '循环';
            loopLabel.append(loopInput, loopText);
            loopInput.addEventListener('change', () => {
                row.loop = loopInput.checked === true;
                if (!row.loop) {
                    stopGameSfxPreviewLoop(previewKey);
                }
            });
            node.appendChild(loopLabel);

            const btnPreview = document.createElement('button');
            btnPreview.type = 'button';
            btnPreview.className = 'game-sfx-mini-btn';
            btnPreview.textContent = '试听';
            btnPreview.addEventListener('click', () => {
                void playAudioLibraryBindingPreview(row.audioItemId, `${label} ${index + 1}`, {
                    statusTarget: 'game',
                    loop: row.loop === true,
                    previewKey
                });
            });
            node.appendChild(btnPreview);

            const btnRemove = document.createElement('button');
            btnRemove.type = 'button';
            btnRemove.className = 'game-sfx-mini-btn is-danger';
            btnRemove.textContent = '删';
            btnRemove.disabled = options.length <= 1;
            btnRemove.addEventListener('click', () => {
                stopGameSfxPreviewLoop(previewKey);
                options.splice(index, 1);
                if (options.length <= 0) {
                    options.push({ audioItemId: '', loop: false });
                }
                state.gameSfxDraftByEvent[eventKey] = options;
                renderGameSfxBindingList();
            });
            node.appendChild(btnRemove);

            list.appendChild(node);
        }
        card.appendChild(list);
        el.gameSfxBindingList.appendChild(card);
    }
}

function saveGameSfxBindingsFromUi() {
    stopAllGameSfxPreviewLoops();
    for (const eventKey of Object.keys(GAME_SFX_EVENT_FIELD_MAP)) {
        const rows = Array.isArray(state.gameSfxDraftByEvent[eventKey]) ? state.gameSfxDraftByEvent[eventKey] : [];
        const payload = rows
            .map((row) => ({
                audioItemId: sanitizeId(row?.audioItemId || ''),
                loop: row?.loop === true
            }))
            .filter((row) => !!row.audioItemId);
        state.gameSfxBindings = setGameSfxBindingOptions(eventKey, payload);
    }
    refreshGameSfxState();
    renderGameSfxBindingList();
    setGameSfxStatus('已保存游戏音效配置。');
}

function resetGameSfxBindingsToDefault() {
    stopAllGameSfxPreviewLoops();
    state.gameSfxBindings = writeGameSfxBindings({});
    refreshGameSfxState();
    renderGameSfxBindingList();
    setGameSfxStatus('已恢复默认游戏音效。');
}

const GAME_MUSIC_SCENE_FIELD_MAP = Object.freeze({
    [BGM_SCENE_KEYS.HOME]: { tracks: 'gameMusicHomeTracks', volume: 'gameMusicHomeVolume', label: '主界面' },
    [BGM_SCENE_KEYS.NORMAL]: { tracks: 'gameMusicNormalTracks', volume: 'gameMusicNormalVolume', label: '普通关卡' },
    [BGM_SCENE_KEYS.REWARD]: { tracks: 'gameMusicRewardTracks', volume: 'gameMusicRewardVolume', label: '奖励关卡' },
    [BGM_SCENE_KEYS.LEVEL_PASS]: { tracks: 'gameMusicLevelPassTracks', volume: 'gameMusicLevelPassVolume', label: '过关' },
    [BGM_SCENE_KEYS.CAMPAIGN_COMPLETE]: { tracks: 'gameMusicCompleteTracks', volume: 'gameMusicCompleteVolume', label: '全部通关' }
});

function clampMusicVolume(value, fallback = 0.7) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(0, Math.min(1, parsed));
}

function clampTrackVolume(value, fallback = 1) {
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

function getSelectedTrackEntries(containerEl) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) {
        return [];
    }
    const out = [];
    for (const input of Array.from(containerEl.querySelectorAll('input[type="checkbox"][data-track-url]'))) {
        if (!input.checked) {
            continue;
        }
        const url = `${input.getAttribute('data-track-url') || ''}`.trim();
        if (!url) {
            continue;
        }
        const row = input.closest('.game-music-track-row');
        const volumeInput = row?.querySelector('.game-music-track-volume');
        out.push({
            url,
            volume: clampTrackVolume(volumeInput?.value, 1)
        });
    }
    return out;
}

function setSelectedValues(containerEl, values) {
    if (!containerEl || !(containerEl instanceof HTMLElement)) {
        return [];
    }
    const rows = Array.isArray(values) ? values : [];
    const normalizedRows = rows.map((item) => {
        if (typeof item === 'string') {
            const safeUrl = normalizeResourceUrl(item);
            return safeUrl ? { raw: safeUrl, url: safeUrl, volume: 1 } : null;
        }
        if (item && typeof item === 'object') {
            const raw = normalizeResourceUrl(item.url || item.src || item.path || '');
            return raw ? { raw, url: raw, volume: clampTrackVolume(item.volume, 1) } : null;
        }
        return null;
    }).filter((item) => item && item.url);
    const selected = new Set(normalizedRows.flatMap((item) => buildTrackMatchKeys(item.url)));
    const sourceByKey = new Map();
    for (const row of normalizedRows) {
        for (const key of buildTrackMatchKeys(row.url)) {
            if (!sourceByKey.has(key)) {
                sourceByKey.set(key, row);
            }
        }
    }
    const matchedRawValues = new Set();
    for (const input of Array.from(containerEl.querySelectorAll('input[type="checkbox"][data-track-url]'))) {
        const trackUrl = `${input.getAttribute('data-track-url') || ''}`.trim();
        const trackFile = `${input.getAttribute('data-track-file') || ''}`.trim();
        const row = input.closest('.game-music-track-row');
        const volumeInput = row?.querySelector('.game-music-track-volume');
        const volumeValue = row?.querySelector('.game-music-track-volume-value');
        const keys = [...buildTrackMatchKeys(trackUrl), ...buildTrackMatchKeys(trackFile)];
        const isMatched = keys.some((key) => selected.has(key));
        input.checked = isMatched;
        row?.classList.toggle('is-selected', isMatched);
        if (volumeInput) {
            const matchedSource = keys.map((key) => sourceByKey.get(key)).find(Boolean);
            if (matchedSource) {
                volumeInput.value = clampTrackVolume(matchedSource.volume, 1).toFixed(2);
            } else if (!volumeInput.value) {
                volumeInput.value = '1.00';
            }
            volumeInput.disabled = !isMatched;
            if (volumeValue) {
                volumeValue.textContent = Number(volumeInput.value || 1).toFixed(2);
            }
        }
        if (isMatched) {
            for (const sourceRow of normalizedRows) {
                const rawKeys = buildTrackMatchKeys(sourceRow.url);
                if (rawKeys.some((key) => keys.includes(key))) {
                    matchedRawValues.add(sourceRow.raw);
                }
            }
        }
    }
    return normalizedRows
        .map((item) => item.raw)
        .filter((item) => item && !matchedRawValues.has(item));
}

function setupSceneVolumeSlider(input) {
    if (!input) {
        return;
    }
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    if (!input.value) {
        input.value = '0.70';
    }
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
                const url = normalizeResourceUrl(track?.url);
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
        const existingSelected = getSelectedTrackEntries(container);
        container.innerHTML = '';
        for (const track of state.bgmTrackLibrary) {
            const row = document.createElement('label');
            row.className = 'game-music-track-row';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.setAttribute('data-track-url', track.url);
            checkbox.setAttribute('data-track-file', track.fileName || track.name || '');
            checkbox.value = track.url;
            checkbox.checked = false;
            checkbox.addEventListener('change', () => {
                row.classList.toggle('is-selected', checkbox.checked);
                volumeInput.disabled = !checkbox.checked;
                refreshGameMusicSelectionSummary();
                scheduleAutoSaveGameMusicConfig('track-select');
            });
            const name = document.createElement('span');
            name.className = 'game-music-track-name';
            name.textContent = track.name;
            name.title = track.fileName;
            const volumeInput = document.createElement('input');
            volumeInput.type = 'range';
            volumeInput.min = '0';
            volumeInput.max = '1';
            volumeInput.step = '0.01';
            volumeInput.value = '1.00';
            volumeInput.className = 'game-music-track-volume';
            volumeInput.title = '单曲音量';
            volumeInput.disabled = !checkbox.checked;
            const volumeValue = document.createElement('span');
            volumeValue.className = 'game-music-track-volume-value';
            volumeValue.textContent = '1.00';
            volumeInput.addEventListener('input', () => {
                volumeInput.value = clampTrackVolume(volumeInput.value, 1).toFixed(2);
                volumeValue.textContent = Number(volumeInput.value || 1).toFixed(2);
                refreshGameMusicSelectionSummary();
                scheduleAutoSaveGameMusicConfig('track-volume');
            });
            const volumeWrap = document.createElement('div');
            volumeWrap.className = 'game-music-track-volume-wrap';
            volumeWrap.appendChild(volumeInput);
            volumeWrap.appendChild(volumeValue);
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
            row.appendChild(volumeWrap);
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
                const volumeInput = row?.querySelector('.game-music-track-volume');
                const vol = clampTrackVolume(volumeInput?.value, 1).toFixed(2);
                const safeLabel = `${label}`.trim() || formatTrackLabel(input.getAttribute('data-track-url') || '');
                return `${safeLabel}(音量 ${vol})`;
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
            playlist: getSelectedTrackEntries(container),
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
    const result = await syncProjectAudioLibrary({ refreshBgm: false });
    refreshAudioLibraryUi(state.selectedAudioLibraryId);
    if (result.errors.length > 0) {
        setAudioLibraryStatus(result.errors.join('；'), true);
    }
}

async function saveGameMusicConfigFromUi() {
    const payload = collectGameMusicConfigFromUi();
    const result = await writeBgmConfigAndSync(payload);
    if (result?.ok) {
        setGameMusicStatus('已保存游戏音乐配置。');
    } else {
        setGameMusicStatus('保存失败：服务器未确认写入。', true);
    }
}

function saveGameMusicConfigFromUiSilently() {
    const payload = collectGameMusicConfigFromUi();
    writeBgmConfig(payload);
    setGameMusicStatus('已自动保存音乐配置。');
}

function scheduleAutoSaveGameMusicConfig() {
    if (state.gameMusicAutoSaveTimer) {
        clearTimeout(state.gameMusicAutoSaveTimer);
        state.gameMusicAutoSaveTimer = 0;
    }
    state.gameMusicAutoSaveTimer = setTimeout(() => {
        state.gameMusicAutoSaveTimer = 0;
        saveGameMusicConfigFromUiSilently();
    }, GAME_MUSIC_AUTO_SAVE_DELAY_MS);
}

async function resetGameMusicConfigToDefault() {
    const result = await writeBgmConfigAndSync({});
    refreshGameMusicUiFromConfig();
    if (result?.ok) {
        setGameMusicStatus('已恢复默认音乐配置。');
    } else {
        setGameMusicStatus('重置失败：服务器未确认写入。', true);
    }
}

function saveSelectedSkinBinding() {
    const skinId = sanitizeId(el.skinSelect?.value || '');
    if (!skinId) return setSkinStatus('Please select a skin first.', true);
    const audioItemId = sanitizeId(el.skinPresetSelect?.value || '');
    state.skinBindings = setSkinSfxAudioItemId(skinId, audioItemId);
    renderSkinBindingList();
    const item = state.audioLibrary.find((row) => row.id === audioItemId);
    setSkinStatus(`Saved: ${skinId} -> ${item?.name || '默认合成音效'}`);
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
        renderGameSfxBindingList();
        setPreset(saved.id, true);
        renderSkinBindingList();
        setStatus(samplePayload
            ? `Saved preset with sample: ${saved.name}`
            : `Saved preset: ${saved.name}`);
        if (samplePayload) {
            void syncProjectAudioLibrary({ refreshBgm: false }).then(() => {
                refreshAudioLibraryUi();
            });
        }
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
        renderGameSfxBindingList();
        setPreset(saved.id, true);
        renderSkinBindingList();
        setStatus(`已保存外部采样到模板：${saved.name}`);
        const syncResult = await syncProjectAudioLibrary({ refreshBgm: false });
        refreshAudioLibraryUi();
        if (syncResult.errors.length > 0) {
            setAudioLibraryStatus(syncResult.errors.join('；'), true);
        }
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
        renderGameSfxBindingList();
        setPreset(saved.id, true);
        renderSkinBindingList();
        setStatus(samplePayload
            ? `Updated preset with sample: ${saved.name}`
            : `Updated preset: ${saved.name}`);
        if (samplePayload || preset.sample) {
            void syncProjectAudioLibrary({ refreshBgm: false }).then(() => {
                refreshAudioLibraryUi();
            });
        }
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
    renderGameSfxBindingList();
    setPreset(BUILTIN_SFX_PRESETS[0].id, true);
    renderSkinBindingList();
    setStatus(`Deleted preset: ${preset.name}`);
    void syncProjectAudioLibrary({ refreshBgm: false }).then(() => {
        refreshAudioLibraryUi();
    });
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
    el.btnReset?.addEventListener('click', () => {
        const fallbackPreset = BUILTIN_SFX_PRESETS[0];
        applyRecipe(
            {
                presetId: fallbackPreset.id,
                params: { ...fallbackPreset.defaults }
            },
            true
        );
        setStatus('已恢复默认参数。');
    });
    el.btnSaveAsNewPreset?.addEventListener('click', saveAsNewPreset);
    el.btnUpdatePreset?.addEventListener('click', updateCurrentPreset);
    el.btnDeletePreset?.addEventListener('click', removeCurrentPreset);
    el.btnImportExternalToLibrary?.addEventListener('click', () => {
        void importCurrentExternalToAudioLibrary().catch((error) => {
            setStatus(`导入音频库失败：${error?.message || 'Unknown error'}`, true);
        });
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
    el.fsSeek?.addEventListener('input', () => {
        const audio = el.fsPreviewAudio;
        const duration = Number(audio?.duration || state.fsPreview.duration || 0);
        if (!audio || !Number.isFinite(duration) || duration <= 0) {
            return;
        }
        const ratio = Math.max(0, Math.min(1, Number(el.fsSeek.value || 0) / 1000));
        audio.currentTime = duration * ratio;
        state.fsPreview.currentTime = audio.currentTime;
        state.fsPreview.statusText = audio.paused ? '已跳转' : '正在播放';
        renderFsPreviewState();
    });
    el.btnFsTogglePlay?.addEventListener('click', () => {
        const audio = el.fsPreviewAudio;
        if (!audio || !state.fsPreview.isReady) {
            return;
        }
        if (audio.paused) {
            void playFsPreviewAudio().then(() => {
                setFsStatus(`试听：${state.fsPreview.title}`);
            }).catch((error) => {
                setFsStatus(`试听失败：${error?.message || 'Unknown error'}`, true);
            });
            return;
        }
        audio.pause();
    });
    el.btnFsStop?.addEventListener('click', () => {
        stopFsPreviewPlayback();
    });
    el.fsPreviewAudio?.addEventListener('loadedmetadata', syncFsPreviewFromAudio);
    el.fsPreviewAudio?.addEventListener('durationchange', syncFsPreviewFromAudio);
    el.fsPreviewAudio?.addEventListener('timeupdate', syncFsPreviewFromAudio);
    el.fsPreviewAudio?.addEventListener('progress', updateFsPreviewLoadProgress);
    el.fsPreviewAudio?.addEventListener('playing', () => {
        state.fsPreview.isLoading = false;
        state.fsPreview.isReady = true;
        state.fsPreview.isPlaying = true;
        state.fsPreview.error = '';
        state.fsPreview.statusText = '正在播放';
        syncFsPreviewFromAudio();
    });
    el.fsPreviewAudio?.addEventListener('pause', () => {
        if (state.fsPreview.isLoading) {
            return;
        }
        state.fsPreview.isPlaying = false;
        if (state.fsPreview.isReady && state.fsPreview.statusText !== '已停止' && state.fsPreview.statusText !== '播放结束') {
            state.fsPreview.statusText = '已暂停';
        }
        renderFsPreviewState();
    });
    el.fsPreviewAudio?.addEventListener('waiting', () => {
        if (!state.fsPreview.isReady) {
            return;
        }
        state.fsPreview.statusText = '缓冲中...';
        renderFsPreviewState();
    });
    el.fsPreviewAudio?.addEventListener('ended', () => {
        state.fsPreview.isPlaying = false;
        state.fsPreview.currentTime = state.fsPreview.duration;
        state.fsPreview.statusText = '播放结束';
        renderFsPreviewState();
    });
    el.fsPreviewAudio?.addEventListener('error', () => {
        state.fsPreview.isLoading = false;
        state.fsPreview.isPlaying = false;
        state.fsPreview.isReady = false;
        state.fsPreview.statusText = '播放失败';
        state.fsPreview.error = describeAudioElementError(el.fsPreviewAudio);
        renderFsPreviewState();
        setFsStatus(`试听失败：${state.fsPreview.error}`, true);
    });
    el.btnAiGenerate?.addEventListener('click', handleStableAudioGenerate);
    el.audioLibrarySearch?.addEventListener('input', () => {
        renderAudioLibraryList();
    });
    el.btnAudioLibraryRefresh?.addEventListener('click', () => {
        void syncProjectAudioLibrary({ refreshBgm: true }).then((result) => {
            refreshAudioLibraryUi(state.selectedAudioLibraryId);
            if (result.errors.length > 0) {
                setAudioLibraryStatus(result.errors.join('；'), true);
                return;
            }
            setAudioLibraryStatus(`总库已同步，共 ${state.audioLibrary.length} 条。`);
        }).catch((error) => {
            setAudioLibraryStatus(`同步失败：${error?.message || 'Unknown error'}`, true);
        });
    });
    el.btnAudioLibraryPreview?.addEventListener('click', () => {
        void previewAudioLibraryItem().catch((error) => {
            setAudioLibraryStatus(`试听失败：${error?.message || 'Unknown error'}`, true);
        });
    });
    el.btnAudioLibraryImport?.addEventListener('click', () => {
        void importAudioLibraryItemToWorkbench().then(() => {
            const item = buildAudioLibraryDraft();
            if (item) {
                setAudioLibraryStatus(`已导入到工坊：${item.name}`);
            }
        }).catch((error) => {
            setAudioLibraryStatus(`导入失败：${error?.message || 'Unknown error'}`, true);
        });
    });
    el.btnAudioLibrarySave?.addEventListener('click', saveSelectedAudioLibraryEdits);
    el.btnAudioLibraryDelete?.addEventListener('click', deleteSelectedAudioLibraryRecord);
    el.audioLibraryPreviewAudio?.addEventListener('loadedmetadata', () => {
        const audio = el.audioLibraryPreviewAudio;
        if (!audio) {
            return;
        }
        if (state.audioLibraryPreview.trimStart > 0) {
            audio.currentTime = state.audioLibraryPreview.trimStart;
        }
    });
    el.audioLibraryPreviewAudio?.addEventListener('play', () => {
        const audio = el.audioLibraryPreviewAudio;
        if (!audio) {
            return;
        }
        audio.volume = clamp(Number(buildAudioLibraryDraft()?.volume || 1), 0, 2);
        if (audio.currentTime < state.audioLibraryPreview.trimStart) {
            audio.currentTime = state.audioLibraryPreview.trimStart;
        }
    });
    el.audioLibraryPreviewAudio?.addEventListener('timeupdate', () => {
        const audio = el.audioLibraryPreviewAudio;
        if (!audio) {
            return;
        }
        if (audio.currentTime < state.audioLibraryPreview.trimStart) {
            audio.currentTime = state.audioLibraryPreview.trimStart;
            return;
        }
        if (state.audioLibraryPreview.trimEnd > state.audioLibraryPreview.trimStart
            && audio.currentTime >= state.audioLibraryPreview.trimEnd) {
            audio.pause();
            audio.currentTime = state.audioLibraryPreview.trimStart;
            const item = getSelectedAudioLibraryItem();
            if (item) {
                setAudioLibraryStatus(`试听完成：${item.name}`);
            }
        }
    });
    el.audioLibraryPreviewAudio?.addEventListener('error', () => {
        setAudioLibraryStatus('素材预览加载失败。', true);
    });

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

    el.btnGameMusicRefreshLibrary?.addEventListener('click', () => {
        void refreshGameMusicTrackLibrary().then(() => {
            setGameMusicStatus('已刷新曲库。');
        });
    });
    el.btnGameMusicSave?.addEventListener('click', saveGameMusicConfigFromUi);
    el.btnGameMusicReset?.addEventListener('click', resetGameMusicConfigToDefault);
    for (const sceneFields of Object.values(GAME_MUSIC_SCENE_FIELD_MAP)) {
        const volumeInput = el[sceneFields.volume];
        setupSceneVolumeSlider(volumeInput);
        volumeInput?.addEventListener('input', () => {
            volumeInput.value = clampMusicVolume(volumeInput.value, 0.7).toFixed(2);
            scheduleAutoSaveGameMusicConfig();
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopFsPreviewPlayback();
            stopAudioLibraryPreview();
            stopAllGameSfxPreviewLoops();
            stopBgmTrackPreview();
        }
    });
    window.addEventListener('beforeunload', () => {
        resetFsPreviewTransport(true);
        stopAudioLibraryPreview(true);
        stopAllGameSfxPreviewLoops();
        stopBgmTrackPreview();
    });
}

async function init() {
    if (!el.sourceMode) return;
    await initSfxStorage();
    await initBgmStorage();
    await fetchProviderCaps();

    setMusicSfxSubTab('sfx-lab');
    refreshPresetSelectOptions();
    await refreshGameMusicTrackLibrary();
    const initialLibrarySync = await syncProjectAudioLibrary({ refreshBgm: false });
    refreshAudioLibraryUi();
    refreshGameSfxState();
    renderGameSfxBindingList();
    await refreshSkinBindingUi();
    refreshGameMusicUiFromConfig();
    applyRecipe(readSfxLabState(), false);
    setSourceMode(el.sourceMode?.value || state.sourceMode || 'freesound');
    renderFsPreviewState();
    renderFreesoundResults([]);
    renderExternalSampleState();
    bindEvents();
    stopBgmTrackPreview();

    window.addEventListener('admin-skin-catalog-updated', () => {
        void refreshSkinBindingUi();
    });

    setStatus('音效工坊已就绪。');
    if (initialLibrarySync.errors.length > 0) {
        setAudioLibraryStatus(initialLibrarySync.errors.join('；'), true);
    } else {
        setAudioLibraryStatus(`素材库已就绪，共 ${state.audioLibrary.length} 条。`);
    }
    setSkinStatus('皮肤音效绑定已就绪。');
    setGameSfxStatus('游戏音效绑定已就绪。');
    setGameMusicStatus('游戏音乐配置已就绪。');
}

init();





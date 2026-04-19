import {
    clearSkinPriceOverrides,
    getDefaultCoinCostBySkinId,
    getSkinCatalog,
    isBuiltInSkinId,
    readSkinPriceOverrides,
    writeSkinPriceOverrides
} from './skins.js?v=32';
import {
    clearGameplayParams,
    DEFAULT_GAMEPLAY_PARAMS,
    normalizeGameplayParams,
    readGameplayParams,
    writeGameplayParams
} from './game-params.js?v=6';

const ACTIVE_TAB_STORAGE_KEY = 'arrowClear_adminActiveTab';
const LOCAL_SKIN_PRICE_OVERRIDE_STORAGE_KEY = 'arrowClear_localSkinPriceOverrides_v1';

const el = {
    tabButtons: Array.from(document.querySelectorAll('[data-tab-target]')),
    tabPanels: Array.from(document.querySelectorAll('[data-tab-panel]')),

    skinPriceSelect: document.getElementById('skinPriceSelect'),
    skinPriceDefault: document.getElementById('skinPriceDefault'),
    skinPriceCurrent: document.getElementById('skinPriceCurrent'),
    skinPriceInput: document.getElementById('skinPriceInput'),
    skinPriceJson: document.getElementById('skinPriceJson'),
    skinPriceStatus: document.getElementById('skinPriceStatus'),
    btnSaveSkinPrice: document.getElementById('btnSaveSkinPrice'),
    btnResetSkinPrice: document.getElementById('btnResetSkinPrice'),
    btnResetAllSkinPrices: document.getElementById('btnResetAllSkinPrices'),
    btnImportSkinPriceJson: document.getElementById('btnImportSkinPriceJson'),
    btnCopySkinPriceJson: document.getElementById('btnCopySkinPriceJson'),

    paramScorePerCoin: document.getElementById('paramScorePerCoin'),
    paramReleaseSfxEveryNScoreEvents: document.getElementById('paramReleaseSfxEveryNScoreEvents'),
    paramScoreBurstStarCount: document.getElementById('paramScoreBurstStarCount'),
    paramSnakeRemoveSpeedMultiplier: document.getElementById('paramSnakeRemoveSpeedMultiplier'),
    paramSnakeRemoveAccelMultiplier: document.getElementById('paramSnakeRemoveAccelMultiplier'),
    paramComboWindowMs: document.getElementById('paramComboWindowMs'),
    paramRewardComboThreshold: document.getElementById('paramRewardComboThreshold'),
    paramMisclickPenaltyTextDurationSeconds: document.getElementById('paramMisclickPenaltyTextDurationSeconds'),
    paramReleasableHitAreaScale: document.getElementById('paramReleasableHitAreaScale'),
    hitAreaPreviewScaleText: document.getElementById('hitAreaPreviewScaleText'),
    hitAreaPreviewHit: document.getElementById('hitAreaPreviewHit'),
    hitAreaPreviewMeta: document.getElementById('hitAreaPreviewMeta'),
    gameParamJson: document.getElementById('gameParamJson'),
    paramStatus: document.getElementById('paramStatus'),
    btnSaveGameParams: document.getElementById('btnSaveGameParams'),
    btnResetGameParams: document.getElementById('btnResetGameParams'),
    btnImportGameParamJson: document.getElementById('btnImportGameParamJson'),
    btnCopyGameParamJson: document.getElementById('btnCopyGameParamJson')
};

const state = {
    skinCatalog: [],
    skinPriceOverrides: {},
    localSkinPriceOverrides: {},
    selectedSkinId: '',
    gameplayParams: { ...DEFAULT_GAMEPLAY_PARAMS }
};

function readLocalSkinPriceOverrides() {
    try {
        const raw = localStorage.getItem(LOCAL_SKIN_PRICE_OVERRIDE_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeLocalSkinPriceOverrides(overrides) {
    const source = overrides && typeof overrides === 'object' ? overrides : {};
    const normalized = {};
    for (const [rawId, rawCost] of Object.entries(source)) {
        const skinId = `${rawId || ''}`.trim();
        if (!skinId) {
            continue;
        }
        normalized[skinId] = Math.max(0, Math.floor(Number(rawCost) || 0));
    }
    localStorage.setItem(LOCAL_SKIN_PRICE_OVERRIDE_STORAGE_KEY, JSON.stringify(normalized, null, 2));
    return normalized;
}

function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function setSkinStatus(text, isError = false) {
    if (!el.skinPriceStatus) {
        return;
    }
    el.skinPriceStatus.textContent = text || '';
    el.skinPriceStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setParamStatus(text, isError = false) {
    if (!el.paramStatus) {
        return;
    }
    el.paramStatus.textContent = text || '';
    el.paramStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setActiveTab(tabId, persist = true) {
    const targetId = `${tabId || ''}`.trim();
    if (!targetId) {
        return;
    }

    for (const button of el.tabButtons) {
        const isActive = button.dataset.tabTarget === targetId;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    for (const panel of el.tabPanels) {
        const isActive = panel.dataset.tabPanel === targetId;
        panel.classList.toggle('is-active', isActive);
    }

    if (persist) {
        localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, targetId);
    }
}

function initTabs() {
    if (el.tabButtons.length === 0 || el.tabPanels.length === 0) {
        return;
    }
    for (const button of el.tabButtons) {
        button.addEventListener('click', () => {
            setActiveTab(button.dataset.tabTarget, true);
        });
    }

    const storedTab = `${localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || ''}`.trim();
    const hasStoredTab = el.tabPanels.some((panel) => panel.dataset.tabPanel === storedTab);
    setActiveTab(hasStoredTab ? storedTab : 'levels', false);
}

function getSkinOptionLabel(skin) {
    if (!skin) {
        return '';
    }
    return `${skin.name?.['zh-CN'] || skin.id} (${skin.id})`;
}

function refreshSkinPriceJson() {
    if (!el.skinPriceJson) {
        return;
    }
    el.skinPriceJson.value = JSON.stringify(state.skinPriceOverrides, null, 2);
}

function findSkinById(skinId) {
    return state.skinCatalog.find((skin) => skin.id === skinId) || null;
}

function updateSelectedSkinPriceView() {
    const selectedSkin = findSkinById(state.selectedSkinId);
    const builtIn = isBuiltInSkinId(state.selectedSkinId);
    const defaultCost = builtIn ? getDefaultCoinCostBySkinId(state.selectedSkinId) : 0;
    const currentCost = selectedSkin
        ? Math.max(0, Math.floor(Number(selectedSkin.coinCost) || 0))
        : (builtIn
            ? defaultCost
            : Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[state.selectedSkinId]) || 0)));

    if (el.skinPriceDefault) {
        el.skinPriceDefault.textContent = `${defaultCost}`;
    }
    if (el.skinPriceCurrent) {
        el.skinPriceCurrent.textContent = `${currentCost}`;
    }
    if (el.skinPriceInput) {
        el.skinPriceInput.value = `${currentCost}`;
    }
}

function refreshSkinCatalogAndSelection(keepSelection = true) {
    const previousSelected = state.selectedSkinId;
    state.skinCatalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
    state.skinPriceOverrides = readSkinPriceOverrides();
    state.localSkinPriceOverrides = readLocalSkinPriceOverrides();

    if (el.skinPriceSelect) {
        el.skinPriceSelect.innerHTML = '';
        for (const skin of state.skinCatalog) {
            const option = document.createElement('option');
            option.value = skin.id;
            option.textContent = getSkinOptionLabel(skin);
            el.skinPriceSelect.appendChild(option);
        }
    }

    const fallbackSkinId = state.skinCatalog[0]?.id || '';
    const candidateSkinId = keepSelection ? previousSelected : '';
    state.selectedSkinId = state.skinCatalog.some((skin) => skin.id === candidateSkinId)
        ? candidateSkinId
        : fallbackSkinId;

    if (el.skinPriceSelect) {
        el.skinPriceSelect.value = state.selectedSkinId;
        el.skinPriceSelect.dispatchEvent(new Event('change'));
    }

    updateSelectedSkinPriceView();
    refreshSkinPriceJson();
}

function saveCurrentSkinPrice() {
    if (!state.selectedSkinId) {
        setSkinStatus('请先选择皮肤。', true);
        return;
    }

    const builtIn = isBuiltInSkinId(state.selectedSkinId);
    const defaultCost = builtIn ? getDefaultCoinCostBySkinId(state.selectedSkinId) : 0;
    const nextCost = clampInt(el.skinPriceInput?.value, 0, 99999, defaultCost);
    if (builtIn) {
        const nextOverrides = {
            ...state.skinPriceOverrides
        };
        if (nextCost === defaultCost) {
            delete nextOverrides[state.selectedSkinId];
        } else {
            nextOverrides[state.selectedSkinId] = nextCost;
        }
        state.skinPriceOverrides = writeSkinPriceOverrides(nextOverrides);
        if (Object.prototype.hasOwnProperty.call(state.localSkinPriceOverrides, state.selectedSkinId)) {
            delete state.localSkinPriceOverrides[state.selectedSkinId];
            state.localSkinPriceOverrides = writeLocalSkinPriceOverrides(state.localSkinPriceOverrides);
        }
    } else {
        state.localSkinPriceOverrides = writeLocalSkinPriceOverrides({
            ...state.localSkinPriceOverrides,
            [state.selectedSkinId]: nextCost
        });
    }
    refreshSkinCatalogAndSelection(true);
    setSkinStatus(`已保存 ${state.selectedSkinId} 价格：${nextCost} 金币。`);
}

function resetCurrentSkinPrice() {
    if (!state.selectedSkinId) {
        setSkinStatus('请先选择皮肤。', true);
        return;
    }
    if (isBuiltInSkinId(state.selectedSkinId)) {
        const nextOverrides = {
            ...state.skinPriceOverrides
        };
        delete nextOverrides[state.selectedSkinId];
        state.skinPriceOverrides = writeSkinPriceOverrides(nextOverrides);
        if (Object.prototype.hasOwnProperty.call(state.localSkinPriceOverrides, state.selectedSkinId)) {
            delete state.localSkinPriceOverrides[state.selectedSkinId];
            state.localSkinPriceOverrides = writeLocalSkinPriceOverrides(state.localSkinPriceOverrides);
        }
    } else {
        delete state.localSkinPriceOverrides[state.selectedSkinId];
        state.localSkinPriceOverrides = writeLocalSkinPriceOverrides(state.localSkinPriceOverrides);
    }
    refreshSkinCatalogAndSelection(true);
    setSkinStatus(`已恢复 ${state.selectedSkinId} 默认价格。`);
}

function resetAllSkinPrices() {
    clearSkinPriceOverrides();
    state.skinPriceOverrides = {};
    state.localSkinPriceOverrides = writeLocalSkinPriceOverrides({});
    refreshSkinCatalogAndSelection(true);
    setSkinStatus('已清空全部皮肤价格覆盖。');
}

function importSkinPriceJson() {
    try {
        const parsed = JSON.parse(el.skinPriceJson?.value || '{}');
        state.skinPriceOverrides = writeSkinPriceOverrides(parsed);
        refreshSkinCatalogAndSelection(true);
        setSkinStatus('价格 JSON 导入成功。');
    } catch {
        setSkinStatus('价格 JSON 格式错误，导入失败。', true);
    }
}

async function copyText(value, onSuccess, onError) {
    try {
        await navigator.clipboard.writeText(value || '');
        onSuccess?.();
    } catch {
        onError?.();
    }
}

function initSkinPricePanel() {
    if (!el.skinPriceSelect) {
        return;
    }

    refreshSkinCatalogAndSelection(false);

    el.skinPriceSelect.addEventListener('change', () => {
        state.selectedSkinId = el.skinPriceSelect.value || '';
        updateSelectedSkinPriceView();
    });
    el.btnSaveSkinPrice?.addEventListener('click', saveCurrentSkinPrice);
    el.btnResetSkinPrice?.addEventListener('click', resetCurrentSkinPrice);
    el.btnResetAllSkinPrices?.addEventListener('click', resetAllSkinPrices);
    el.btnImportSkinPriceJson?.addEventListener('click', importSkinPriceJson);
    el.btnCopySkinPriceJson?.addEventListener('click', () => {
        copyText(
            el.skinPriceJson?.value || '{}',
            () => setSkinStatus('价格 JSON 已复制。'),
            () => setSkinStatus('复制失败，请手动复制。', true)
        );
    });

    window.addEventListener('storage', (event) => {
        if (
            event.key !== null
            && event.key !== 'arrowClear_skinPriceOverrides_v1'
            && event.key !== LOCAL_SKIN_PRICE_OVERRIDE_STORAGE_KEY
            && event.key !== 'arrowClear_localSkinCatalog_v1'
        ) {
            return;
        }
        refreshSkinCatalogAndSelection(true);
    });
    window.addEventListener('admin-skin-catalog-updated', () => {
        refreshSkinCatalogAndSelection(true);
    });
}

function fillGameParamInputs(params) {
    if (el.paramScorePerCoin) el.paramScorePerCoin.value = `${params.scorePerCoin}`;
    if (el.paramReleaseSfxEveryNScoreEvents) el.paramReleaseSfxEveryNScoreEvents.value = `${params.releaseSfxEveryNScoreEvents}`;
    if (el.paramScoreBurstStarCount) el.paramScoreBurstStarCount.value = `${params.scoreBurstStarCount}`;
    if (el.paramSnakeRemoveSpeedMultiplier) el.paramSnakeRemoveSpeedMultiplier.value = `${params.snakeRemoveSpeedMultiplier}`;
    if (el.paramSnakeRemoveAccelMultiplier) el.paramSnakeRemoveAccelMultiplier.value = `${params.snakeRemoveAccelMultiplier}`;
    if (el.paramComboWindowMs) el.paramComboWindowMs.value = `${params.comboWindowMs}`;
    if (el.paramRewardComboThreshold) el.paramRewardComboThreshold.value = `${params.rewardComboThreshold}`;
    if (el.paramMisclickPenaltyTextDurationSeconds) el.paramMisclickPenaltyTextDurationSeconds.value = `${params.misclickPenaltyTextDurationSeconds}`;
    if (el.paramReleasableHitAreaScale) el.paramReleasableHitAreaScale.value = `${params.releasableHitAreaScale}`;
    renderHitAreaPreview(params.releasableHitAreaScale);
}

function renderHitAreaPreview(scaleValue) {
    const scale = Math.max(1, Math.min(2.2, Number(scaleValue) || 1));
    const baseSize = 52;
    const hitSize = Math.round(baseSize * scale);
    if (el.hitAreaPreviewScaleText) {
        el.hitAreaPreviewScaleText.textContent = `倍率 x${scale.toFixed(2)}`;
    }
    if (el.hitAreaPreviewHit) {
        el.hitAreaPreviewHit.style.width = `${hitSize}px`;
        el.hitAreaPreviewHit.style.height = `${hitSize}px`;
    }
    if (el.hitAreaPreviewMeta) {
        const basePct = 26;
        const scaledPct = (basePct * scale).toFixed(1);
        el.hitAreaPreviewMeta.textContent = `基础半径 ${basePct}% · 当前 ${scaledPct}%`;
    }
}

function collectGameParamInputs() {
    return {
        scorePerCoin: Number(el.paramScorePerCoin?.value),
        releaseSfxEveryNScoreEvents: Number(el.paramReleaseSfxEveryNScoreEvents?.value),
        scoreBurstStarCount: Number(el.paramScoreBurstStarCount?.value),
        snakeRemoveSpeedMultiplier: Number(el.paramSnakeRemoveSpeedMultiplier?.value),
        snakeRemoveAccelMultiplier: Number(el.paramSnakeRemoveAccelMultiplier?.value),
        comboWindowMs: Number(el.paramComboWindowMs?.value),
        rewardComboThreshold: Number(el.paramRewardComboThreshold?.value),
        misclickPenaltyTextDurationSeconds: Number(el.paramMisclickPenaltyTextDurationSeconds?.value),
        releasableHitAreaScale: Number(el.paramReleasableHitAreaScale?.value)
    };
}

function refreshGameParamJson() {
    if (!el.gameParamJson) {
        return;
    }
    el.gameParamJson.value = JSON.stringify(state.gameplayParams, null, 2);
}

function saveGameParamsFromInputs() {
    const raw = collectGameParamInputs();
    const normalized = normalizeGameplayParams(raw);
    state.gameplayParams = writeGameplayParams(normalized);
    fillGameParamInputs(state.gameplayParams);
    refreshGameParamJson();
    setParamStatus('参数已保存，刷新游戏页后生效。');
}

function resetGameParams() {
    state.gameplayParams = clearGameplayParams();
    fillGameParamInputs(state.gameplayParams);
    refreshGameParamJson();
    setParamStatus('已恢复默认参数。');
}

function importGameParamJson() {
    try {
        const parsed = JSON.parse(el.gameParamJson?.value || '{}');
        state.gameplayParams = writeGameplayParams(parsed);
        fillGameParamInputs(state.gameplayParams);
        refreshGameParamJson();
        setParamStatus('参数 JSON 导入成功。');
    } catch {
        setParamStatus('参数 JSON 格式错误，导入失败。', true);
    }
}

function initGameParamPanel() {
    if (!el.paramScorePerCoin) {
        return;
    }
    state.gameplayParams = readGameplayParams();
    fillGameParamInputs(state.gameplayParams);
    refreshGameParamJson();

    el.btnSaveGameParams?.addEventListener('click', saveGameParamsFromInputs);
    el.btnResetGameParams?.addEventListener('click', resetGameParams);
    el.btnImportGameParamJson?.addEventListener('click', importGameParamJson);
    el.paramReleasableHitAreaScale?.addEventListener('input', () => {
        renderHitAreaPreview(el.paramReleasableHitAreaScale?.value);
    });
    el.btnCopyGameParamJson?.addEventListener('click', () => {
        copyText(
            el.gameParamJson?.value || '{}',
            () => setParamStatus('参数 JSON 已复制。'),
            () => setParamStatus('复制失败，请手动复制。', true)
        );
    });

    window.addEventListener('storage', (event) => {
        if (event.key !== null && event.key !== 'arrowClear_gameplayParams_v1') {
            return;
        }
        state.gameplayParams = readGameplayParams();
        fillGameParamInputs(state.gameplayParams);
        refreshGameParamJson();
        setParamStatus('检测到参数变更，已刷新。');
    });
}

function init() {
    initTabs();
    initSkinPricePanel();
    initGameParamPanel();
}

init();











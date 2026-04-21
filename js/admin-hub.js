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
} from './game-params.js?v=7';
import {
    DEFAULT_SUPPORT_ADS_CONFIG,
    initSupportAdsConfig,
    readSupportAdsConfig,
    writeSupportAdsConfig
} from './support-ads-config.js?v=1';

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
    paramSupportAdsDefaultDailyLimit: document.getElementById('paramSupportAdsDefaultDailyLimit'),
    paramSupportAdsThankYouMessage: document.getElementById('paramSupportAdsThankYouMessage'),
    paramSupportAdsEnableSupportAuthor: document.getElementById('paramSupportAdsEnableSupportAuthor'),
    paramSupportAdsEnableFailContinue: document.getElementById('paramSupportAdsEnableFailContinue'),
    paramSupportAdsEnableDoubleCoin: document.getElementById('paramSupportAdsEnableDoubleCoin'),
    paramSupportAdsUnitSupportAuthor: document.getElementById('paramSupportAdsUnitSupportAuthor'),
    paramSupportAdsUnitFailContinue: document.getElementById('paramSupportAdsUnitFailContinue'),
    paramSupportAdsUnitDoubleCoin: document.getElementById('paramSupportAdsUnitDoubleCoin'),
    btnEditComboScoreMultipliers: document.getElementById('btnEditComboScoreMultipliers'),
    comboScoreMultiplierPanel: document.getElementById('comboScoreMultiplierPanel'),
    comboScoreMultiplierSummary: document.getElementById('comboScoreMultiplierSummary'),
    comboScoreMultiplierRows: document.getElementById('comboScoreMultiplierRows'),
    btnAddComboScoreMultiplierRow: document.getElementById('btnAddComboScoreMultiplierRow'),
    btnResetComboScoreMultiplierRows: document.getElementById('btnResetComboScoreMultiplierRows'),
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
    gameplayParams: { ...DEFAULT_GAMEPLAY_PARAMS },
    supportAdsConfig: { ...DEFAULT_SUPPORT_ADS_CONFIG },
    comboScoreMultiplierRows: []
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

function clampFloat(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}

function cloneComboScoreMultiplierRows(rows) {
    const fallback = Array.isArray(DEFAULT_GAMEPLAY_PARAMS.comboScoreMultipliers)
        ? DEFAULT_GAMEPLAY_PARAMS.comboScoreMultipliers
        : [];
    const source = Array.isArray(rows) && rows.length > 0 ? rows : fallback;
    const mapped = source
        .map((row) => {
            const threshold = Math.max(1, Math.floor(Number(row?.threshold) || 0));
            const multiplier = Math.max(1, Number(row?.multiplier) || 0);
            if (!Number.isFinite(threshold) || !Number.isFinite(multiplier)) {
                return null;
            }
            return {
                threshold,
                multiplier: Number(multiplier.toFixed(2))
            };
        })
        .filter(Boolean);
    if (mapped.length > 0) {
        return mapped;
    }
    return [{ threshold: 10, multiplier: 1.1 }];
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
    state.comboScoreMultiplierRows = cloneComboScoreMultiplierRows(params.comboScoreMultipliers);
    renderComboScoreMultiplierRows();
    renderHitAreaPreview(params.releasableHitAreaScale);
}

function fillSupportAdsInputs(config) {
    const next = config && typeof config === 'object'
        ? config
        : DEFAULT_SUPPORT_ADS_CONFIG;
    if (el.paramSupportAdsDefaultDailyLimit) {
        el.paramSupportAdsDefaultDailyLimit.value = `${Math.max(0, Math.floor(Number(next.defaultDailyLimit) || 0))}`;
    }
    if (el.paramSupportAdsThankYouMessage) {
        el.paramSupportAdsThankYouMessage.value = `${next.thankYouMessage || ''}`.trim();
    }
    if (el.paramSupportAdsEnableSupportAuthor) {
        el.paramSupportAdsEnableSupportAuthor.checked = next?.enabledPlacements?.support_author !== false;
    }
    if (el.paramSupportAdsEnableFailContinue) {
        el.paramSupportAdsEnableFailContinue.checked = next?.enabledPlacements?.fail_continue !== false;
    }
    if (el.paramSupportAdsEnableDoubleCoin) {
        el.paramSupportAdsEnableDoubleCoin.checked = next?.enabledPlacements?.double_coin !== false;
    }
    if (el.paramSupportAdsUnitSupportAuthor) {
        el.paramSupportAdsUnitSupportAuthor.value = `${next?.adUnitIds?.support_author || ''}`.trim();
    }
    if (el.paramSupportAdsUnitFailContinue) {
        el.paramSupportAdsUnitFailContinue.value = `${next?.adUnitIds?.fail_continue || ''}`.trim();
    }
    if (el.paramSupportAdsUnitDoubleCoin) {
        el.paramSupportAdsUnitDoubleCoin.value = `${next?.adUnitIds?.double_coin || ''}`.trim();
    }
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

function updateComboScoreMultiplierSummary() {
    if (!el.comboScoreMultiplierSummary) {
        return;
    }
    const sorted = [...state.comboScoreMultiplierRows]
        .sort((left, right) => left.threshold - right.threshold);
    if (sorted.length <= 0) {
        el.comboScoreMultiplierSummary.textContent = '\u672a\u914d\u7f6e';
        return;
    }
    const preview = sorted
        .slice(0, 4)
        .map((row) => `${row.threshold}->x${row.multiplier.toFixed(2)}`)
        .join(', ');
    const suffix = sorted.length > 4 ? ` ... \u5171 ${sorted.length} \u6863` : '';
    el.comboScoreMultiplierSummary.textContent = `${preview}${suffix}`;
}

function renderComboScoreMultiplierRows() {
    if (!el.comboScoreMultiplierRows) {
        return;
    }
    state.comboScoreMultiplierRows = cloneComboScoreMultiplierRows(state.comboScoreMultiplierRows);
    el.comboScoreMultiplierRows.innerHTML = '';
    state.comboScoreMultiplierRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="number" min="1" max="1000" step="1" value="${row.threshold}"></td>
            <td><input type="number" min="1" max="5" step="0.01" value="${row.multiplier.toFixed(2)}"></td>
            <td><button type="button">Delete</button></td>
        `;
        const thresholdInput = tr.children[0].querySelector('input');
        const multiplierInput = tr.children[1].querySelector('input');
        const removeButton = tr.children[2].querySelector('button');

        thresholdInput?.addEventListener('change', () => {
            row.threshold = clampInt(thresholdInput.value, 1, 1000, row.threshold);
            thresholdInput.value = `${row.threshold}`;
            updateComboScoreMultiplierSummary();
        });
        multiplierInput?.addEventListener('change', () => {
            row.multiplier = Number(clampFloat(multiplierInput.value, 1, 5, row.multiplier).toFixed(2));
            multiplierInput.value = row.multiplier.toFixed(2);
            updateComboScoreMultiplierSummary();
        });
        removeButton?.addEventListener('click', () => {
            state.comboScoreMultiplierRows.splice(index, 1);
            if (state.comboScoreMultiplierRows.length <= 0) {
                state.comboScoreMultiplierRows = cloneComboScoreMultiplierRows();
            }
            renderComboScoreMultiplierRows();
        });
        el.comboScoreMultiplierRows.appendChild(tr);
    });
    updateComboScoreMultiplierSummary();
}

function toggleComboScoreMultiplierPanel(forceVisible = null) {
    if (!el.comboScoreMultiplierPanel) {
        return;
    }
    const shouldShow = typeof forceVisible === 'boolean'
        ? forceVisible
        : el.comboScoreMultiplierPanel.classList.contains('hidden');
    el.comboScoreMultiplierPanel.classList.toggle('hidden', !shouldShow);
    if (el.btnEditComboScoreMultipliers) {
        el.btnEditComboScoreMultipliers.textContent = shouldShow
            ? '\u6536\u8d77\u8fde\u51fb\u79ef\u5206\u7cfb\u6570'
            : '\u914d\u7f6e\u8fde\u51fb\u79ef\u5206\u7cfb\u6570';
    }
    if (shouldShow) {
        renderComboScoreMultiplierRows();
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
        releasableHitAreaScale: Number(el.paramReleasableHitAreaScale?.value),
        comboScoreMultipliers: cloneComboScoreMultiplierRows(state.comboScoreMultiplierRows)
    };
}

function collectSupportAdsInputs() {
    const fallback = state.supportAdsConfig && typeof state.supportAdsConfig === 'object'
        ? state.supportAdsConfig
        : DEFAULT_SUPPORT_ADS_CONFIG;
    const parsedLimit = Number(el.paramSupportAdsDefaultDailyLimit?.value ?? fallback.defaultDailyLimit);
    const defaultDailyLimit = Number.isFinite(parsedLimit)
        ? Math.max(0, Math.min(200, Math.floor(parsedLimit)))
        : Math.max(0, Math.min(200, Math.floor(Number(fallback.defaultDailyLimit) || 0)));
    return {
        ...fallback,
        defaultDailyLimit,
        thankYouMessage: `${el.paramSupportAdsThankYouMessage?.value || fallback.thankYouMessage || ''}`.trim(),
        enabledPlacements: {
            ...(fallback.enabledPlacements || {}),
            support_author: el.paramSupportAdsEnableSupportAuthor?.checked !== false,
            fail_continue: el.paramSupportAdsEnableFailContinue?.checked !== false,
            double_coin: el.paramSupportAdsEnableDoubleCoin?.checked !== false
        },
        adUnitIds: {
            ...(fallback.adUnitIds || {}),
            support_author: `${el.paramSupportAdsUnitSupportAuthor?.value || fallback?.adUnitIds?.support_author || ''}`.trim(),
            fail_continue: `${el.paramSupportAdsUnitFailContinue?.value || fallback?.adUnitIds?.fail_continue || ''}`.trim(),
            double_coin: `${el.paramSupportAdsUnitDoubleCoin?.value || fallback?.adUnitIds?.double_coin || ''}`.trim()
        }
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
    state.supportAdsConfig = writeSupportAdsConfig(collectSupportAdsInputs(), { syncServer: true });
    fillGameParamInputs(state.gameplayParams);
    fillSupportAdsInputs(state.supportAdsConfig);
    refreshGameParamJson();
    setParamStatus('参数已保存，刷新游戏页后生效。');
}

function resetGameParams() {
    state.gameplayParams = clearGameplayParams();
    state.supportAdsConfig = writeSupportAdsConfig(DEFAULT_SUPPORT_ADS_CONFIG, { syncServer: true });
    fillGameParamInputs(state.gameplayParams);
    fillSupportAdsInputs(state.supportAdsConfig);
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
    state.supportAdsConfig = readSupportAdsConfig();
    fillGameParamInputs(state.gameplayParams);
    fillSupportAdsInputs(state.supportAdsConfig);
    refreshGameParamJson();
    toggleComboScoreMultiplierPanel(false);
    void initSupportAdsConfig().then(() => {
        state.supportAdsConfig = readSupportAdsConfig();
        fillSupportAdsInputs(state.supportAdsConfig);
    }).catch(() => {
        // ignore init failure and keep local/default values
    });

    el.btnSaveGameParams?.addEventListener('click', saveGameParamsFromInputs);
    el.btnResetGameParams?.addEventListener('click', resetGameParams);
    el.btnImportGameParamJson?.addEventListener('click', importGameParamJson);
    el.btnEditComboScoreMultipliers?.addEventListener('click', () => {
        toggleComboScoreMultiplierPanel();
    });
    el.btnAddComboScoreMultiplierRow?.addEventListener('click', () => {
        const last = state.comboScoreMultiplierRows[state.comboScoreMultiplierRows.length - 1] || { threshold: 0, multiplier: 1 };
        state.comboScoreMultiplierRows.push({
            threshold: clampInt((Number(last.threshold) || 0) + 10, 1, 1000, 10),
            multiplier: Number(clampFloat((Number(last.multiplier) || 1) + 0.1, 1, 5, 1).toFixed(2))
        });
        renderComboScoreMultiplierRows();
    });
    el.btnResetComboScoreMultiplierRows?.addEventListener('click', () => {
        state.comboScoreMultiplierRows = cloneComboScoreMultiplierRows(DEFAULT_GAMEPLAY_PARAMS.comboScoreMultipliers);
        renderComboScoreMultiplierRows();
    });
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
        if (
            event.key !== null
            && event.key !== 'arrowClear_gameplayParams_v1'
            && event.key !== 'arrowClear_supportAdsConfig_v1'
        ) {
            return;
        }
        state.gameplayParams = readGameplayParams();
        state.supportAdsConfig = readSupportAdsConfig();
        fillGameParamInputs(state.gameplayParams);
        fillSupportAdsInputs(state.supportAdsConfig);
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

import {
    initUiLayoutStorage,
    getDefaultUiLayoutConfig,
    PANEL_LAYOUT_DEFINITIONS,
    readUiLayoutConfig,
    writeUiLayoutConfig
} from './ui-layout-config.js?v=14';
import {
    getLocalDayKey,
    readLiveOpsConfig,
    readLiveOpsPlayerState
} from './liveops-storage.js?v=5';

const el = {
    sceneSelect: document.getElementById('uiEditorSceneSelect'),
    previewMode: document.getElementById('uiEditorPreviewMode'),
    claimedDays: document.getElementById('uiEditorClaimedDays'),
    nextDay: document.getElementById('uiEditorNextDay'),
    elementList: document.getElementById('uiEditorElementList'),
    checkinStateFields: document.getElementById('uiEditorCheckinStateFields'),
    previewTitle: document.getElementById('uiEditorPreviewTitle'),
    previewDesc: document.getElementById('uiEditorPreviewDesc'),
    propertyGrid: document.getElementById('uiEditorPropertyGrid'),
    scalePercent: document.getElementById('uiEditorScalePercent'),
    btnScaleApply: document.getElementById('btnUiEditorScaleApply'),
    btnScaleDown: document.getElementById('btnUiEditorScaleDown'),
    btnScaleUp: document.getElementById('btnUiEditorScaleUp'),
    viewport: document.getElementById('uiEditorPreviewViewport'),
    stageWrap: document.getElementById('uiEditorPreviewStageWrap'),
    previewFrame: document.getElementById('uiEditorPreviewFrame'),
    overlay: document.getElementById('uiEditorOverlay'),
    assistLayer: document.getElementById('uiEditorAssistLayer'),
    followMousePanel: document.getElementById('uiEditorFollowMousePanel'),
    followMouseStage: document.getElementById('uiEditorFollowMouseStage'),
    followMousePreview: document.getElementById('uiEditorFollowMousePreview'),
    followMouseHint: document.getElementById('uiEditorFollowMouseHint'),
    elementSizeInfo: document.getElementById('uiEditorElementSizeInfo'),
    previewCanvasSize: document.getElementById('uiEditorPreviewCanvasSize'),
    previewSelectionSize: document.getElementById('uiEditorPreviewSelectionSize'),
    json: document.getElementById('uiEditorJson'),
    status: document.getElementById('uiEditorStatus'),
    btnDeleteElement: document.getElementById('btnUiEditorDeleteElement'),
    btnResetElement: document.getElementById('btnUiEditorResetElement'),
    btnResetScene: document.getElementById('btnUiEditorResetScene'),
    btnCopyJson: document.getElementById('btnUiEditorCopyJson'),
    btnImportJson: document.getElementById('btnUiEditorImportJson')
};

const state = {
    config: readUiLayoutConfig(),
    sceneId: 'checkin',
    selectedElementId: 'day1-icon',
    selectedElementIds: new Set(['day1-icon']),
    propertyInputs: {},
    previewScale: 1,
    previewMode: 'claimable',
    claimedDays: 0,
    nextDay: 1,
    drag: null,
    dragAssist: null,
    listDrag: null,
    followMouseDrag: null,
    liveopsConfig: readLiveOpsConfig(),
    liveopsPlayer: readLiveOpsPlayerState(),
    frameReady: false
};

const CHECKIN_ELEMENTS = [
    ...buildElementDescriptors(),
    { id: 'rewardTooltip', label: 'Reward Tooltip' },
    { id: 'status', label: 'Checkin Status' }
];

const GAMEPLAY_ELEMENTS = [
    { id: 'hudTop', label: 'HUD Top' },
    { id: 'settingsButton', label: 'Settings Button' },
    { id: 'settingsIcon', label: 'Settings Icon' },
    { id: 'coinChip', label: 'Coin Chip' },
    { id: 'coinIcon', label: 'Coin Icon' },
    { id: 'coinValue', label: 'Coin Value' },
    { id: 'center', label: 'Center HUD' },
    { id: 'lives', label: 'Lives' },
    { id: 'level', label: 'Level Title' },
    { id: 'timer', label: 'Timer' },
    { id: 'timerTrack', label: 'Timer Track' },
    { id: 'timerLabel', label: 'Timer Label' },
    { id: 'combo', label: 'Combo Container' },
    { id: 'comboCount', label: 'Combo Count' },
    { id: 'comboLabel', label: 'Combo Label' },
    { id: 'scorePulse', label: 'Score Pulse' },
    { id: 'scoreValue', label: 'Score Value' },
    { id: 'scoreGain', label: 'Score Gain' }
];

const HOME_ELEMENTS = [
    { id: 'homeBgPanelLarge', label: 'BG Panel Large' },
    { id: 'homeBgSnakeUp', label: 'BG Snake Up' },
    { id: 'homeBgSnakeDown', label: 'BG Snake Down' },
    { id: 'homeBgCavePanel', label: 'BG Cave Panel' },
    { id: 'homeTitle', label: 'Home Title' },
    { id: 'playArea', label: 'Play Area' },
    { id: 'startButton', label: 'Start Button' },
    { id: 'startButtonText', label: 'Start Text' },
    { id: 'levelTag', label: 'Level Tag' },
    { id: 'levelTagLabel', label: 'Level Tag Label' },
    { id: 'levelTagValue', label: 'Level Tag Value' },
    { id: 'featurePanel', label: 'Feature Panel' },
    { id: 'featureSettings', label: 'Feature Settings' },
    { id: 'featureSettingsText', label: 'Settings Text' },
    { id: 'featureLeaderboard', label: 'Feature Leaderboard' },
    { id: 'featureLeaderboardText', label: 'Leaderboard Text' },
    { id: 'featureSkins', label: 'Feature Skins' },
    { id: 'featureSkinsText', label: 'Skins Text' },
    { id: 'featureCheckin', label: 'Feature Checkin' },
    { id: 'featureCheckinText', label: 'Checkin Text' },
    { id: 'featureExit', label: 'Feature Exit' },
    { id: 'featureExitText', label: 'Exit Text' },
    { id: 'featureSupportAuthor', label: 'Feature Support' },
    { id: 'featureSupportAuthorText', label: 'Support Text' },
    { id: 'profileEntry', label: 'Profile Entry' },
    { id: 'loginEntry', label: 'Login Entry' },
    { id: 'loginEntryText', label: 'Login Text' },
    { id: 'homeCoinChip', label: 'Home Coin Chip' },
    { id: 'versionTag', label: 'Version Tag' },
    { id: 'homeMascot', label: 'Home Mascot' },
    { id: 'onlineRewardDock', label: 'Online Dock' },
    { id: 'onlineRewardChest', label: 'Online Chest' },
    { id: 'onlineRewardText', label: 'Online Text' }
];

const PANEL_SCENES = Object.freeze(Object.fromEntries(
    Object.entries(PANEL_LAYOUT_DEFINITIONS).map(([sceneId, definition]) => [
        sceneId,
        Object.freeze({
            label: definition.label || sceneId,
            previewTitle: definition.previewTitle || `${definition.label || sceneId} Preview`,
            previewDesc: 'Drag and tune this panel. Text fields support Chinese and English for localization.',
            frameSrc: `index.html?uiEditorPreview=1&uiEditorPanel=${definition.previewPanel || sceneId}`,
            defaultElementId: definition.defaultElementId || definition.elements?.[0]?.id || '',
            showCheckinState: false,
            elements: (definition.elements || []).map((item) => ({ id: item.id, label: item.label || item.id }))
        })
    ])
));

const SCENES = Object.freeze({
    checkin: Object.freeze({
        label: 'Check-in',
        previewTitle: 'Check-in Preview',
        previewDesc: 'Drag elements to adjust layout. Hold Shift while dragging to show align guides and pixel spacing.',
        frameSrc: 'index.html?uiEditorPreview=1&uiEditorPanel=checkin',
        defaultElementId: 'day1-icon',
        showCheckinState: true,
        elements: CHECKIN_ELEMENTS
    }),
    gameplay: Object.freeze({
        label: 'Gameplay',
        previewTitle: 'Gameplay Preview',
        previewDesc: 'Tune gameplay HUD with drag and property edits. Hold Shift while dragging for smart alignment guides.',
        frameSrc: 'index.html?uiEditorPreview=1&uiEditorPanel=gameplay',
        defaultElementId: 'scorePulse',
        showCheckinState: false,
        elements: GAMEPLAY_ELEMENTS
    }),
    home: Object.freeze({
        label: 'Home',
        previewTitle: 'Home Preview',
        previewDesc: 'Drag and tune home UI. Hold Shift while dragging for smart alignment guides and spacing.',
        frameSrc: 'index.html?uiEditorPreview=1&uiEditorPanel=home',
        defaultElementId: 'startButton',
        showCheckinState: false,
        elements: HOME_ELEMENTS
    }),
    ...PANEL_SCENES
});

function buildElementDescriptors() {
    const items = [
        { id: 'backButton', label: 'Back Button' },
        { id: 'notebook', label: 'Notebook' },
        { id: 'ribbon', label: 'Top Ribbon' },
        { id: 'ribbonTitle', label: 'Ribbon Title' },
        { id: 'mascot', label: 'Mascot' }
    ];
    for (let day = 1; day <= 7; day += 1) {
        items.push({ id: `day${day}-card`, label: `Day ${day} Card` });
        items.push({ id: `day${day}-title`, label: `Day ${day} Title` });
        items.push({ id: `day${day}-icon`, label: `Day ${day} Icon` });
        items.push({ id: `day${day}-amount`, label: `Day ${day} Amount` });
        items.push({ id: `day${day}-badge`, label: `Day ${day} Badge` });
    }
    return items;
}

function getSceneMeta(sceneId = state.sceneId) {
    return SCENES[sceneId] || SCENES.checkin;
}

function getSceneElementDescriptorMap(sceneId = state.sceneId) {
    const items = getSceneMeta(sceneId).elements || CHECKIN_ELEMENTS;
    return new Map(items.map((item) => [item.id, item]));
}

function normalizeDeletedElementIds(deletedIds, fallbackOrder) {
    const allowed = new Set(fallbackOrder);
    const seen = new Set();
    const normalized = [];
    if (Array.isArray(deletedIds)) {
        for (const rawId of deletedIds) {
            const id = `${rawId || ''}`.trim();
            if (!id || !allowed.has(id) || seen.has(id)) {
                continue;
            }
            seen.add(id);
            normalized.push(id);
        }
    }
    return normalized;
}

function normalizeLayerOrder(order, fallbackOrder) {
    const allowed = new Set(fallbackOrder);
    const seen = new Set();
    const normalized = [];

    if (Array.isArray(order)) {
        for (const rawId of order) {
            const id = `${rawId || ''}`.trim();
            if (!id || !allowed.has(id) || seen.has(id)) {
                continue;
            }
            seen.add(id);
            normalized.push(id);
        }
    }

    for (const id of fallbackOrder) {
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        normalized.push(id);
    }

    return normalized;
}

function getSceneLayerOrder(sceneId = state.sceneId) {
    const descriptorMap = getSceneElementDescriptorMap(sceneId);
    const allIds = Array.from(descriptorMap.keys());
    const sceneConfig = state.config?.[sceneId];
    const deleted = normalizeDeletedElementIds(sceneConfig?.deletedElements, allIds);
    const deletedSet = new Set(deleted);
    const fallbackOrder = allIds.filter((id) => !deletedSet.has(id));
    return normalizeLayerOrder(sceneConfig?.layerOrder, fallbackOrder);
}

function syncSceneLayerOrder(sceneId = state.sceneId) {
    const sceneConfig = state.config?.[sceneId];
    if (!sceneConfig || typeof sceneConfig !== 'object') {
        return getSceneLayerOrder(sceneId);
    }
    const descriptorMap = getSceneElementDescriptorMap(sceneId);
    const allIds = Array.from(descriptorMap.keys());
    sceneConfig.deletedElements = normalizeDeletedElementIds(sceneConfig.deletedElements, allIds);
    const normalizedOrder = getSceneLayerOrder(sceneId);
    sceneConfig.layerOrder = normalizedOrder;
    return normalizedOrder;
}

function getSceneElements(sceneId = state.sceneId) {
    const descriptorMap = getSceneElementDescriptorMap(sceneId);
    return getSceneLayerOrder(sceneId)
        .map((id) => descriptorMap.get(id))
        .filter(Boolean);
}

function isUiEditorActive() {
    return document.querySelector('[data-tab-panel="ui-editor"]')?.classList.contains('is-active');
}

function setStatus(text, isError = false) {
    if (!el.status) {
        return;
    }
    el.status.textContent = text || '';
    el.status.style.color = isError ? '#c21f4e' : '#4f5482';
}

function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getSelectedDescriptor() {
    const elements = getSceneElements();
    return elements.find((item) => item.id === state.selectedElementId) || elements[0];
}

function isElementSelected(elementId) {
    return state.selectedElementIds.has(elementId);
}

function parseDayElementId(elementId) {
    const match = /^day(\d+)-(card|title|icon|amount|badge)$/.exec(`${elementId || ''}`);
    if (!match) {
        return null;
    }
    return {
        day: Number(match[1]),
        part: match[2]
    };
}

function getElementTarget(config, elementId) {
    if (state.sceneId === 'home') {
        const scene = config?.home;
        if (!scene) {
            return null;
        }
        if (elementId === 'homeMascot') return scene.mascot || null;
        if (elementId === 'homeCoinChip') return scene.coinChip || null;
        return scene[elementId] || null;
    }
    if (state.sceneId === 'gameplay') {
        const scene = config?.gameplay;
        if (!scene) {
            return null;
        }
        return scene[elementId] || null;
    }
    if (PANEL_LAYOUT_DEFINITIONS[state.sceneId]) {
        const scene = config?.[state.sceneId];
        if (!scene) {
            return null;
        }
        return scene[elementId] || null;
    }
    const scene = config?.checkin;
    if (!scene) {
        return null;
    }
    if (elementId === 'backButton') return scene.backButton;
    if (elementId === 'notebook') return scene.notebook;
    if (elementId === 'ribbon') return scene.ribbon;
    if (elementId === 'ribbonTitle') return scene.ribbonTitle;
    if (elementId === 'mascot') return scene.mascot;
    if (elementId === 'rewardTooltip') return scene.rewardTooltip;
    if (elementId === 'status') return scene.status;
    const parsed = parseDayElementId(elementId);
    if (!parsed) {
        return null;
    }
    return scene.days?.[parsed.day]?.[parsed.part] || null;
}

function resolveBoundTarget(fieldSource, elementId) {
    if (fieldSource === 'scene') {
        return state.config?.checkin?.scene || null;
    }
    return getElementTarget(state.config, elementId);
}

function legacyGetElementFields(elementId) {
    if (elementId === 'backButton') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            { name: 'fontSize', label: '瀛楀彿', step: 1 }
        ];
    }
    if (elementId === 'notebook') {
        return [
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            { name: 'paddingTop', label: '椤堕儴鐣欑櫧', step: 1, wide: true },
            { name: 'scaleMultiplier', label: '娓告垙缂╂斁鍊嶇巼', step: 0.05, source: 'scene', wide: true }
        ];
    }
    if (elementId === 'ribbon') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 }
        ];
    }
    if (elementId === 'ribbonTitle') {
        return [
            { name: 'x', label: '鍋忕ЩX', step: 1 },
            { name: 'y', label: '鍋忕ЩY', step: 1 },
            { name: 'fontSize', label: '瀛楀彿', step: 1 }
        ];
    }
    if (elementId === 'mascot') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 }
        ];
    }

    const parsed = parseDayElementId(elementId);
    if (!parsed) {
        return [];
    }
    if (parsed.part === 'card' || parsed.part === 'icon') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 }
        ];
    }
    if (parsed.part === 'title') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'fontSize', label: '瀛楀彿', step: 1 },
            { name: 'align', label: '瀵归綈', type: 'select', options: ['center', 'left'], wide: true }
        ];
    }
    if (parsed.part === 'amount') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'fontSize', label: '瀛楀彿', step: 1 }
        ];
    }
    if (parsed.part === 'badge') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'size', label: '灏哄', step: 1 }
        ];
    }
    return [];
}

function syncPreviewInputsFromLiveState() {
    const rawConfig = state.liveopsConfig?.activities?.checkin || {};
    const cycleDays = Math.max(1, Math.floor(Number(rawConfig.cycleDays) || 7));
    const playerState = state.liveopsPlayer?.checkin || {};
    const claimedCount = Math.max(0, Math.floor(Number(playerState.claimedCount) || 0));
    const lastClaimDayKey = `${playerState.lastClaimDayKey || ''}`.trim();
    const todayKey = getLocalDayKey(new Date());

    state.claimedDays = claimedCount % cycleDays;
    state.nextDay = Math.min(cycleDays, state.claimedDays + 1);
    state.previewMode = rawConfig.enabled !== false && lastClaimDayKey !== todayKey ? 'claimable' : 'claimed';

    if (el.previewMode) {
        el.previewMode.value = state.previewMode;
    }
    if (el.claimedDays) {
        el.claimedDays.value = `${state.claimedDays}`;
    }
    if (el.nextDay) {
        el.nextDay.value = `${state.nextDay}`;
    }
}

function getPreviewOverride() {
    return {
        previewMode: state.previewMode,
        claimedDays: state.claimedDays,
        nextDay: state.nextDay
    };
}

function getPreviewWindow() {
    return el.previewFrame?.contentWindow || null;
}

function getPreviewApi() {
    return getPreviewWindow()?.__arrowUiEditorPreview || null;
}

function fitPreviewScale() {
    if (!el.viewport || !el.stageWrap) {
        return;
    }
    const previewApi = getPreviewApi();
    const meta = previewApi?.getMeta?.() || { width: 430, height: 932 };
    const availableWidth = Math.max(360, el.viewport.clientWidth - 32);
    const availableHeight = Math.max(420, el.viewport.clientHeight - 32);
    const scale = Math.min(1, availableWidth / meta.width, availableHeight / meta.height);
    state.previewScale = scale;
    el.stageWrap.style.width = `${meta.width}px`;
    el.stageWrap.style.height = `${meta.height}px`;
    if (el.previewFrame) {
        el.previewFrame.style.width = `${meta.width}px`;
        el.previewFrame.style.height = `${meta.height}px`;
    }
    if (el.overlay) {
        el.overlay.style.width = `${meta.width}px`;
        el.overlay.style.height = `${meta.height}px`;
    }
    if (el.assistLayer) {
        el.assistLayer.style.width = `${meta.width}px`;
        el.assistLayer.style.height = `${meta.height}px`;
    }
    el.stageWrap.style.transform = `translate(-50%, -50%) scale(${scale})`;
    el.stageWrap.style.left = '50%';
    el.stageWrap.style.top = '50%';
    updateSizeReadout();
}

function parseNumericDraft(value) {
    const text = `${value ?? ''}`.trim();
    if (!text || text === '-' || text === '.' || text === '-.') {
        return null;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function bindNumericFieldInput(input, target, fieldName, elementId = state.selectedElementId, fieldSource = 'target') {
    const previewDraft = () => {
        renderPreview();
        setStatus(`Preview updated: ${getSelectedDescriptor().label}.`);
    };

    const commit = () => {
        const liveTarget = resolveBoundTarget(fieldSource, elementId);
        const parsed = parseNumericDraft(input.value);
        if (parsed === null) {
            input.value = `${liveTarget?.[fieldName] ?? ''}`;
            return;
        }
        if (!liveTarget) {
            return;
        }
        if (liveTarget?.[fieldName] === parsed) {
            input.value = `${parsed}`;
            return;
        }
        liveTarget[fieldName] = parsed;
        persistLayout(`Updated ${getSelectedDescriptor().label}.`);
    };

    input.addEventListener('input', () => {
        const liveTarget = resolveBoundTarget(fieldSource, elementId);
        const parsed = parseNumericDraft(input.value);
        if (parsed === null || !liveTarget) {
            return;
        }
        liveTarget[fieldName] = parsed;
        previewDraft();
    });
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            input.blur();
        }
    });
}

function renderElementOptions() {
    if (!el.elementList) {
        return;
    }
    const layerOrder = syncSceneLayerOrder();
    const items = getSceneElements();
    const total = items.length;
    el.elementList.innerHTML = '';
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const target = getElementTarget(state.config, item.id);
        const isHidden = target?.visible === false;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ui-editor-element-item';
        if (isElementSelected(item.id)) {
            button.classList.add('is-selected');
        }
        button.draggable = true;
        button.dataset.elementId = item.id;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', isElementSelected(item.id) ? 'true' : 'false');
        const layerIndex = layerOrder.indexOf(item.id);
        const layerRank = total - (Number.isInteger(layerIndex) ? layerIndex : index);
        button.innerHTML = `
            <span class="ui-editor-element-drag" aria-hidden="true">≡</span>
            <span class="ui-editor-element-layer">L${layerRank}</span>
            <span class="ui-editor-element-label">${item.label}${isHidden ? '<span class="ui-editor-element-flag">hidden</span>' : ''}</span>
        `;
        el.elementList.appendChild(button);
    }
}

function legacyRenderPropertyGrid() {
    if (!el.propertyGrid) {
        return;
    }
    el.propertyGrid.innerHTML = '';
    state.propertyInputs = {};
    const fields = getElementFields(state.selectedElementId);

    for (const field of fields) {
        const target = field.source === 'scene'
            ? state.config?.checkin?.scene
            : getElementTarget(state.config, state.selectedElementId);
        if (!target) {
            continue;
        }

        const label = document.createElement('label');
        label.className = `field${field.wide ? ' is-wide' : ''}`;

        const caption = document.createElement('span');
        caption.textContent = field.label;
        label.appendChild(caption);

        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            for (const optionValue of field.options || []) {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue;
                input.appendChild(option);
            }
            input.value = `${target[field.name] ?? field.options?.[0] ?? ''}`;
            input.addEventListener('change', () => {
                target[field.name] = input.value;
                persistLayout(`Updated ${getSelectedDescriptor().label}.`);
            });
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.step = `${field.step || 1}`;
            input.value = `${target[field.name] ?? ''}`;
            bindNumericFieldInput(input, target, field.name, state.selectedElementId, field.source || 'target');
        }

        state.propertyInputs[field.name] = { input, source: field.source || 'target' };
        label.appendChild(input);
        el.propertyGrid.appendChild(label);
    }
}

function legacyRefreshPropertyValues() {
    const target = getElementTarget(state.config, state.selectedElementId);
    const scene = state.config?.checkin?.scene;
    for (const [name, meta] of Object.entries(state.propertyInputs)) {
        const source = meta.source === 'scene' ? scene : target;
        if (!source || !meta.input) {
            continue;
        }
        meta.input.value = `${source[name] ?? ''}`;
    }
}

function updateJsonEditor() {
    if (el.json) {
        el.json.value = JSON.stringify(state.config, null, 2);
    }
}

const RESIZE_EDGE_HIT = 10;
const RESIZE_CORNER_HIT = 14;
const MIN_RESIZE_SIZE = 8;
const ALIGN_SNAP_THRESHOLD = 6;
const GUIDE_LINE_MARGIN = 8;

function normalizeRect(rect) {
    if (!rect) {
        return null;
    }
    const x = Number(rect.x ?? rect.left);
    const y = Number(rect.y ?? rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
    }
    if (width <= 0 || height <= 0) {
        return null;
    }
    const left = x;
    const top = y;
    const right = x + width;
    const bottom = y + height;
    return {
        x,
        y,
        width,
        height,
        left,
        top,
        right,
        bottom,
        cx: left + width / 2,
        cy: top + height / 2
    };
}

function rectToAnchors(rect, axis) {
    if (!rect) {
        return [];
    }
    if (axis === 'x') {
        return [
            { name: 'left', value: rect.left },
            { name: 'center', value: rect.cx },
            { name: 'right', value: rect.right }
        ];
    }
    return [
        { name: 'top', value: rect.top },
        { name: 'center', value: rect.cy },
        { name: 'bottom', value: rect.bottom }
    ];
}

function offsetRect(rect, dx, dy) {
    if (!rect) {
        return null;
    }
    return normalizeRect({
        x: rect.x + dx,
        y: rect.y + dy,
        width: rect.width,
        height: rect.height
    });
}

function getElementMeasuredRect(elementId) {
    const target = getElementTarget(state.config, elementId);
    if (target && Number.isFinite(Number(target.x)) && Number.isFinite(Number(target.y))) {
        if (Number.isFinite(Number(target.width)) && Number.isFinite(Number(target.height))) {
            return normalizeRect({
                x: Number(target.x),
                y: Number(target.y),
                width: Number(target.width),
                height: Number(target.height)
            });
        }
        if (Number.isFinite(Number(target.size))) {
            const side = Math.max(1, Number(target.size));
            return normalizeRect({
                x: Number(target.x),
                y: Number(target.y),
                width: side,
                height: side
            });
        }
    }
    return normalizeRect(rectFromTarget(elementId));
}

function collectReferenceRects(excludedIds = new Set()) {
    const refs = [];
    for (const item of getSceneElements()) {
        if (!item?.id || excludedIds.has(item.id)) {
            continue;
        }
        const rect = getElementMeasuredRect(item.id);
        if (!rect) {
            continue;
        }
        refs.push({ id: item.id, rect });
    }
    return refs;
}

function findAxisSnap(activeRect, refs, axis) {
    if (!activeRect || !Array.isArray(refs) || refs.length === 0) {
        return null;
    }
    const activeAnchors = rectToAnchors(activeRect, axis);
    let best = null;

    for (const ref of refs) {
        const refAnchors = rectToAnchors(ref.rect, axis);
        for (const a of activeAnchors) {
            for (const b of refAnchors) {
                const delta = b.value - a.value;
                const abs = Math.abs(delta);
                if (abs > ALIGN_SNAP_THRESHOLD) {
                    continue;
                }
                if (!best || abs < best.abs) {
                    best = {
                        axis,
                        abs,
                        delta,
                        linePos: b.value,
                        refId: ref.id,
                        refRect: ref.rect,
                        activeAnchor: a.name,
                        refAnchor: b.name
                    };
                }
            }
        }
    }
    return best;
}

function findNearestReference(activeRect, refs) {
    if (!activeRect || !Array.isArray(refs) || refs.length === 0) {
        return null;
    }
    let best = null;
    for (const ref of refs) {
        const dx = (ref.rect.cx - activeRect.cx);
        const dy = (ref.rect.cy - activeRect.cy);
        const d2 = dx * dx + dy * dy;
        if (!best || d2 < best.d2) {
            best = { id: ref.id, rect: ref.rect, d2 };
        }
    }
    return best;
}

function calcHorizontalDistance(activeRect, refRect) {
    if (!activeRect || !refRect) {
        return null;
    }
    let start = 0;
    let end = 0;
    if (activeRect.right <= refRect.left) {
        start = activeRect.right;
        end = refRect.left;
    } else if (refRect.right <= activeRect.left) {
        start = refRect.right;
        end = activeRect.left;
    } else {
        return null;
    }
    const overlapTop = Math.max(activeRect.top, refRect.top);
    const overlapBottom = Math.min(activeRect.bottom, refRect.bottom);
    const y = overlapBottom > overlapTop ? (overlapTop + overlapBottom) / 2 : (activeRect.cy + refRect.cy) / 2;
    return {
        axis: 'x',
        distance: Math.round(Math.abs(end - start)),
        x1: Math.min(start, end),
        x2: Math.max(start, end),
        y
    };
}

function calcVerticalDistance(activeRect, refRect) {
    if (!activeRect || !refRect) {
        return null;
    }
    let start = 0;
    let end = 0;
    if (activeRect.bottom <= refRect.top) {
        start = activeRect.bottom;
        end = refRect.top;
    } else if (refRect.bottom <= activeRect.top) {
        start = refRect.bottom;
        end = activeRect.top;
    } else {
        return null;
    }
    const overlapLeft = Math.max(activeRect.left, refRect.left);
    const overlapRight = Math.min(activeRect.right, refRect.right);
    const x = overlapRight > overlapLeft ? (overlapLeft + overlapRight) / 2 : (activeRect.cx + refRect.cx) / 2;
    return {
        axis: 'y',
        distance: Math.round(Math.abs(end - start)),
        y1: Math.min(start, end),
        y2: Math.max(start, end),
        x
    };
}

function clearAssistLayer() {
    if (!el.assistLayer) {
        return;
    }
    el.assistLayer.innerHTML = '';
}

function appendAssistLine(line, typeClass) {
    if (!el.assistLayer || !line) {
        return;
    }
    const node = document.createElement('div');
    node.className = `ui-editor-guide-line ${typeClass}`;
    node.style.left = `${line.left}px`;
    node.style.top = `${line.top}px`;
    node.style.width = `${line.width}px`;
    node.style.height = `${line.height}px`;
    el.assistLayer.appendChild(node);
}

function appendDistanceMeasure(distance) {
    if (!el.assistLayer || !distance) {
        return;
    }
    const line = document.createElement('div');
    line.className = `ui-editor-distance-line ${distance.axis === 'x' ? 'is-horizontal' : 'is-vertical'}`;
    if (distance.axis === 'x') {
        line.style.left = `${distance.x1}px`;
        line.style.top = `${distance.y}px`;
        line.style.width = `${Math.max(1, distance.x2 - distance.x1)}px`;
        line.style.height = '0px';
    } else {
        line.style.left = `${distance.x}px`;
        line.style.top = `${distance.y1}px`;
        line.style.width = '0px';
        line.style.height = `${Math.max(1, distance.y2 - distance.y1)}px`;
    }
    el.assistLayer.appendChild(line);

    const label = document.createElement('div');
    label.className = 'ui-editor-distance-label';
    label.textContent = `${Math.max(0, distance.distance)}px`;
    if (distance.axis === 'x') {
        label.style.left = `${(distance.x1 + distance.x2) / 2}px`;
        label.style.top = `${distance.y - 12}px`;
    } else {
        label.style.left = `${distance.x + 18}px`;
        label.style.top = `${(distance.y1 + distance.y2) / 2}px`;
    }
    el.assistLayer.appendChild(label);
}

function renderDragAssist(payload) {
    if (!el.assistLayer) {
        return;
    }
    clearAssistLayer();
    if (!payload) {
        return;
    }
    const layerWidth = el.assistLayer.clientWidth || 430;
    const layerHeight = el.assistLayer.clientHeight || 932;

    if (payload.snapX) {
        appendAssistLine({
            left: payload.snapX.linePos,
            top: GUIDE_LINE_MARGIN,
            width: 0,
            height: Math.max(1, layerHeight - GUIDE_LINE_MARGIN * 2)
        }, 'is-vertical');
    }
    if (payload.snapY) {
        appendAssistLine({
            left: GUIDE_LINE_MARGIN,
            top: payload.snapY.linePos,
            width: Math.max(1, layerWidth - GUIDE_LINE_MARGIN * 2),
            height: 0
        }, 'is-horizontal');
    }
    appendDistanceMeasure(payload.distanceX);
    appendDistanceMeasure(payload.distanceY);
}

function updateSizeReadout() {
    const previewApi = getPreviewApi();
    const meta = previewApi?.getMeta?.() || { width: 430, height: 932 };
    const selectedRect = getElementMeasuredRect(state.selectedElementId);
    const selectedLabel = getSelectedDescriptor()?.label || state.selectedElementId || '-';

    if (el.previewCanvasSize) {
        el.previewCanvasSize.textContent = `画布：${Math.round(Number(meta.width) || 430)} × ${Math.round(Number(meta.height) || 932)} px`;
    }
    if (el.previewSelectionSize) {
        el.previewSelectionSize.textContent = selectedRect
            ? `元素：${selectedLabel} ${Math.round(selectedRect.width)} × ${Math.round(selectedRect.height)} px`
            : `元素：${selectedLabel} -`;
    }
    if (el.elementSizeInfo) {
        if (!selectedRect) {
            el.elementSizeInfo.textContent = `元素尺寸：${selectedLabel} -`;
            return;
        }
        el.elementSizeInfo.textContent = `元素尺寸：${selectedLabel}  W ${Math.round(selectedRect.width)} px · H ${Math.round(selectedRect.height)} px`;
    }
}

function detectResizeMode(node, event) {
    if (!(node instanceof HTMLElement)) {
        return null;
    }
    const rect = node.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
        return null;
    }
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const edgeHit = Math.min(RESIZE_EDGE_HIT, Math.max(4, Math.min(rect.width, rect.height) / 3));
    const cornerHit = Math.min(RESIZE_CORNER_HIT, Math.max(6, Math.min(rect.width, rect.height) / 2));

    const nearLeft = localX <= edgeHit;
    const nearRight = localX >= rect.width - edgeHit;
    const nearTop = localY <= edgeHit;
    const nearBottom = localY >= rect.height - edgeHit;

    const nearCornerLeft = localX <= cornerHit;
    const nearCornerRight = localX >= rect.width - cornerHit;
    const nearCornerTop = localY <= cornerHit;
    const nearCornerBottom = localY >= rect.height - cornerHit;

    if (nearCornerLeft && nearCornerTop) return 'nw';
    if (nearCornerRight && nearCornerTop) return 'ne';
    if (nearCornerLeft && nearCornerBottom) return 'sw';
    if (nearCornerRight && nearCornerBottom) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';
    return null;
}

function cursorByResizeMode(mode) {
    switch (mode) {
        case 'n':
        case 's':
            return 'ns-resize';
        case 'e':
        case 'w':
            return 'ew-resize';
        case 'ne':
        case 'sw':
            return 'nesw-resize';
        case 'nw':
        case 'se':
            return 'nwse-resize';
        default:
            return 'move';
    }
}

function targetSupportsResize(elementId) {
    const target = getElementTarget(state.config, elementId);
    return !!target
        && Number.isFinite(Number(target.x))
        && Number.isFinite(Number(target.y))
        && Number.isFinite(Number(target.width))
        && Number.isFinite(Number(target.height));
}

function onOverlayPointerMove(event) {
    const node = event.currentTarget;
    if (!(node instanceof HTMLElement)) {
        return;
    }
    const elementId = node.dataset.elementId || '';
    if (!targetSupportsResize(elementId)) {
        node.style.cursor = 'move';
        return;
    }
    const resizeMode = detectResizeMode(node, event);
    node.style.cursor = cursorByResizeMode(resizeMode);
}

function onOverlayPointerLeave(event) {
    const node = event.currentTarget;
    if (!(node instanceof HTMLElement)) {
        return;
    }
    node.style.cursor = 'move';
}

function createOverlayElement(elementId, rect) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'ui-editor-element is-selectable';
    if (isElementSelected(elementId)) {
        node.classList.add('is-selected');
    }
    node.dataset.elementId = elementId;
    node.style.left = `${rect.x}px`;
    node.style.top = `${rect.y}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    node.addEventListener('pointerdown', onOverlayPointerDown);
    node.addEventListener('pointermove', onOverlayPointerMove);
    node.addEventListener('pointerleave', onOverlayPointerLeave);
    return node;
}

function rectFromTarget(elementId) {
    return getPreviewApi()?.getElementRect?.(elementId) || null;
}

function renderOverlay() {
    if (!el.overlay) {
        return;
    }
    el.overlay.innerHTML = '';
    for (const item of getSceneElements()) {
        const rect = rectFromTarget(item.id);
        if (!rect) {
            continue;
        }
        el.overlay.appendChild(createOverlayElement(item.id, rect));
    }
    updateSizeReadout();
}

function renderPreview() {
    state.liveopsConfig = readLiveOpsConfig();
    state.liveopsPlayer = readLiveOpsPlayerState();

    const previewApi = getPreviewApi();
    if (previewApi && typeof previewApi.setLayoutConfig === 'function') {
        previewApi.setLayoutConfig(state.config);
    }
    if (previewApi && typeof previewApi.render === 'function') {
        previewApi.render(state.sceneId === 'checkin' ? getPreviewOverride() : { sceneId: state.sceneId });
    }

    fitPreviewScale();
    renderOverlay();
    renderFollowMouseStage();
    updateSizeReadout();
}

function isFollowMouseElement(elementId) {
    return state.sceneId === 'checkin' && elementId === 'rewardTooltip';
}

function getFollowMouseTarget() {
    if (!isFollowMouseElement(state.selectedElementId)) {
        return null;
    }
    const target = getElementTarget(state.config, state.selectedElementId);
    return target?.followMouse ? target : null;
}

function getPreviewDocument() {
    try {
        return el.previewFrame?.contentDocument || null;
    } catch {
        return null;
    }
}

function getFollowMouseSourceNode() {
    const doc = getPreviewDocument();
    if (!doc) {
        return null;
    }
    return doc.querySelector(`[data-ui-editor-id="${state.selectedElementId}"]`);
}

function positionFollowMousePreview(node, target) {
    if (!(node instanceof HTMLElement) || !target || !el.followMousePreview) {
        return;
    }
    const hostWidth = el.followMousePreview.clientWidth || 420;
    const hostHeight = el.followMousePreview.clientHeight || 240;
    const centerX = Math.round(hostWidth / 2);
    const centerY = Math.round(hostHeight / 2);
    node.style.left = `${Math.round(centerX + (Number(target.x) || 0))}px`;
    node.style.top = `${Math.round(centerY + (Number(target.y) || 0))}px`;
}

function onFollowMousePointerDown(event) {
    const target = getFollowMouseTarget();
    if (!target) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    state.followMouseDrag = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: Number(target.x) || 0,
        startY: Number(target.y) || 0
    };
    window.addEventListener('pointermove', onFollowMousePointerMove);
    window.addEventListener('pointerup', onFollowMousePointerUp);
}

function onFollowMousePointerMove(event) {
    if (!state.followMouseDrag) {
        return;
    }
    const target = getFollowMouseTarget();
    if (!target) {
        onFollowMousePointerUp();
        return;
    }
    target.x = Math.round(state.followMouseDrag.startX + (event.clientX - state.followMouseDrag.startClientX));
    target.y = Math.round(state.followMouseDrag.startY + (event.clientY - state.followMouseDrag.startClientY));
    persistLayout(`Updated ${getSelectedDescriptor().label} follow-mouse offset.`);
}

function onFollowMousePointerUp() {
    state.followMouseDrag = null;
    window.removeEventListener('pointermove', onFollowMousePointerMove);
    window.removeEventListener('pointerup', onFollowMousePointerUp);
}

function renderFollowMouseStage() {
    if (!el.followMousePanel || !el.followMousePreview || !el.followMouseHint) {
        return;
    }
    const target = getFollowMouseTarget();
    const enabled = !!target;
    el.followMousePanel.hidden = !enabled;
    el.followMousePreview.innerHTML = '';
    if (!enabled) {
        return;
    }
    const sourceNode = getFollowMouseSourceNode();
    if (!(sourceNode instanceof HTMLElement)) {
        el.followMouseHint.textContent = 'Current element is hidden. Make it visible first, then adjust follow-mouse offset.';
        return;
    }
    el.followMouseHint.textContent = 'Crosshair is the mouse position. Drag below proxy or edit X/Y to tune relative offset.';
    const previewNode = sourceNode.cloneNode(true);
    previewNode.classList.remove('hidden');
    previewNode.classList.add('ui-editor-follow-mouse-proxy');
    previewNode.style.width = target.width ? `${target.width}px` : '';
    previewNode.style.maxWidth = target.width ? `${target.width}px` : '';
    previewNode.style.visibility = 'hidden';
    previewNode.addEventListener('pointerdown', onFollowMousePointerDown);
    el.followMousePreview.appendChild(previewNode);
    positionFollowMousePreview(previewNode, target);
    previewNode.style.visibility = '';
}

function persistLayout(message = 'Layout synced to preview.') {
    state.config = writeUiLayoutConfig(state.config);
    renderElementOptions();
    updateJsonEditor();
    renderPreview();
    refreshPropertyValues();
    setStatus(message);
}

function scaleNumericField(target, fieldName, factor) {
    const current = Number(target?.[fieldName]);
    if (!Number.isFinite(current)) {
        return false;
    }
    target[fieldName] = Math.round(current * factor);
    return true;
}

function applyScaleToSelected(factor) {
    const normalizedFactor = Number(factor);
    if (!Number.isFinite(normalizedFactor) || normalizedFactor <= 0) {
        setStatus('Invalid scale factor.', true);
        return;
    }

    let changed = false;
    for (const elementId of state.selectedElementIds) {
        const target = getElementTarget(state.config, elementId);
        if (!target) {
            continue;
        }
        changed = scaleNumericField(target, 'width', normalizedFactor) || changed;
        changed = scaleNumericField(target, 'height', normalizedFactor) || changed;
        changed = scaleNumericField(target, 'fontSize', normalizedFactor) || changed;
        changed = scaleNumericField(target, 'size', normalizedFactor) || changed;
        changed = scaleNumericField(target, 'labelFontSize', normalizedFactor) || changed;
        changed = scaleNumericField(target, 'valueFontSize', normalizedFactor) || changed;
        changed = scaleNumericField(target, 'gainFontSize', normalizedFactor) || changed;
    }

    if (!changed) {
        setStatus('Selected element has no scalable size fields.', true);
        return;
    }

    persistLayout(`Scaled ${getSelectedDescriptor().label} to ${(normalizedFactor * 100).toFixed(0)}%.`);
}

function setSelectedElements(ids, primaryId) {
    const nextIds = ids.length > 0 ? ids : [primaryId || state.selectedElementId];
    state.selectedElementId = primaryId || nextIds[nextIds.length - 1];
    state.selectedElementIds = new Set(nextIds);
    clearAssistLayer();
    renderElementOptions();
    renderPropertyGrid();
    renderOverlay();
    renderFollowMouseStage();
    updateSizeReadout();
    requestAnimationFrame(() => {
        el.viewport?.focus();
    });
}

function setSelectedElement(elementId, additive = false) {
    if (additive) {
        const next = new Set(state.selectedElementIds);
        if (next.has(elementId)) {
            next.delete(elementId);
        } else {
            next.add(elementId);
        }
        setSelectedElements(Array.from(next), elementId);
    } else {
        setSelectedElements([elementId], elementId);
    }
}

function targetSupportsDrag(elementId) {
    const target = getElementTarget(state.config, elementId);
    return !!target && typeof target.x === 'number' && typeof target.y === 'number';
}

function applyResizeByMode(target, dragState, deltaX, deltaY) {
    if (!target || !dragState) {
        return;
    }
    const mode = dragState.resizeMode;
    const startRect = dragState.startRect;
    const minSize = MIN_RESIZE_SIZE;

    let nextX = startRect.x;
    let nextY = startRect.y;
    let nextWidth = startRect.width;
    let nextHeight = startRect.height;

    if (mode === 'e') {
        nextWidth = Math.max(minSize, startRect.width + deltaX);
    } else if (mode === 'w') {
        nextWidth = Math.max(minSize, startRect.width - deltaX);
        nextX = startRect.x + (startRect.width - nextWidth);
    } else if (mode === 's') {
        nextHeight = Math.max(minSize, startRect.height + deltaY);
    } else if (mode === 'n') {
        nextHeight = Math.max(minSize, startRect.height - deltaY);
        nextY = startRect.y + (startRect.height - nextHeight);
    } else {
        const horizontalSign = mode.includes('e') ? 1 : -1;
        const verticalSign = mode.includes('s') ? 1 : -1;
        const rawScaleX = (startRect.width + horizontalSign * deltaX) / Math.max(1, startRect.width);
        const rawScaleY = (startRect.height + verticalSign * deltaY) / Math.max(1, startRect.height);
        const useScaleX = Math.abs(rawScaleX - 1) >= Math.abs(rawScaleY - 1);
        let scale = useScaleX ? rawScaleX : rawScaleY;
        const minScale = Math.max(
            minSize / Math.max(1, startRect.width),
            minSize / Math.max(1, startRect.height)
        );
        if (!Number.isFinite(scale)) {
            scale = 1;
        }
        scale = Math.max(minScale, scale);
        nextWidth = Math.max(minSize, startRect.width * scale);
        nextHeight = Math.max(minSize, startRect.height * scale);

        if (mode.includes('w')) {
            nextX = startRect.x + (startRect.width - nextWidth);
        }
        if (mode.includes('n')) {
            nextY = startRect.y + (startRect.height - nextHeight);
        }
    }

    target.x = Math.round(nextX);
    target.y = Math.round(nextY);
    target.width = Math.round(nextWidth);
    target.height = Math.round(nextHeight);
}

function onOverlayPointerDown(event) {
    const node = event.currentTarget;
    const elementId = node?.dataset?.elementId;
    if (!elementId) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();

    const resizeMode = targetSupportsResize(elementId) ? detectResizeMode(node, event) : null;
    if (resizeMode) {
        setSelectedElement(elementId, false);
        const target = getElementTarget(state.config, elementId);
        const referenceRects = collectReferenceRects(new Set([elementId]));
        if (!target) {
            return;
        }
        state.drag = {
            type: 'resize',
            elementId,
            referenceRects,
            resizeMode,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startRect: {
                x: Number(target.x) || 0,
                y: Number(target.y) || 0,
                width: Math.max(MIN_RESIZE_SIZE, Number(target.width) || MIN_RESIZE_SIZE),
                height: Math.max(MIN_RESIZE_SIZE, Number(target.height) || MIN_RESIZE_SIZE)
            }
        };
        window.addEventListener('pointermove', onWindowPointerMove);
        window.addEventListener('pointerup', onWindowPointerUp);
        return;
    }

    const additive = event.ctrlKey || event.metaKey;
    setSelectedElement(elementId, additive);

    const moveIds = Array.from(state.selectedElementIds)
        .filter((id) => targetSupportsDrag(id));
    if (moveIds.length === 0) {
        return;
    }
    const primaryId = state.selectedElementId;
    const primaryRect = getElementMeasuredRect(primaryId);
    const referenceRects = collectReferenceRects(new Set(moveIds));

    state.drag = {
        type: 'move',
        primaryId,
        primaryRect,
        referenceRects,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targets: moveIds.map((id) => {
            const target = getElementTarget(state.config, id);
            return {
                id,
                startX: Number(target?.x) || 0,
                startY: Number(target?.y) || 0
            };
        })
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
}

function onWindowPointerMove(event) {
    if (!state.drag) {
        return;
    }
    const scale = Math.max(0.01, Number(state.previewScale) || 1);
    const deltaX = (event.clientX - state.drag.startClientX) / scale;
    const deltaY = (event.clientY - state.drag.startClientY) / scale;
    state.dragAssist = null;
    if (state.drag.type === 'resize') {
        const target = getElementTarget(state.config, state.drag.elementId);
        if (!target) {
            return;
        }
        applyResizeByMode(target, state.drag, deltaX, deltaY);
        persistLayout(`Resized ${getSelectedDescriptor().label}.`);
        if (event.shiftKey) {
            const activeRect = getElementMeasuredRect(state.drag.elementId);
            const refs = Array.isArray(state.drag.referenceRects) ? state.drag.referenceRects : [];
            const snapX = findAxisSnap(activeRect, refs, 'x');
            const snapY = findAxisSnap(activeRect, refs, 'y');
            const nearest = findNearestReference(activeRect, refs);
            state.dragAssist = {
                snapX,
                snapY,
                distanceX: calcHorizontalDistance(activeRect, nearest?.rect),
                distanceY: calcVerticalDistance(activeRect, nearest?.rect)
            };
            renderDragAssist(state.dragAssist);
        } else {
            clearAssistLayer();
        }
        return;
    }
    let adjustedDeltaX = deltaX;
    let adjustedDeltaY = deltaY;
    if (event.shiftKey && state.drag.primaryRect) {
        const candidateRect = offsetRect(state.drag.primaryRect, deltaX, deltaY);
        const refs = Array.isArray(state.drag.referenceRects) ? state.drag.referenceRects : [];
        const snapX = findAxisSnap(candidateRect, refs, 'x');
        const snapY = findAxisSnap(candidateRect, refs, 'y');
        if (snapX) {
            adjustedDeltaX += snapX.delta;
        }
        if (snapY) {
            adjustedDeltaY += snapY.delta;
        }
        const snappedRect = offsetRect(state.drag.primaryRect, adjustedDeltaX, adjustedDeltaY);
        const nearest = findNearestReference(snappedRect, refs);
        state.dragAssist = {
            snapX,
            snapY,
            distanceX: calcHorizontalDistance(snappedRect, nearest?.rect),
            distanceY: calcVerticalDistance(snappedRect, nearest?.rect)
        };
    }
    for (const item of state.drag.targets) {
        const target = getElementTarget(state.config, item.id);
        if (!target) {
            continue;
        }
        target.x = Math.round(item.startX + adjustedDeltaX);
        target.y = Math.round(item.startY + adjustedDeltaY);
    }
    persistLayout(`Dragged ${getSelectedDescriptor().label}.`);
    if (event.shiftKey && state.dragAssist) {
        renderDragAssist(state.dragAssist);
    } else {
        clearAssistLayer();
    }
}

function onWindowPointerUp() {
    state.drag = null;
    state.dragAssist = null;
    clearAssistLayer();
    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
}

function nudgeSelected(dx, dy) {
    let moved = false;
    for (const elementId of state.selectedElementIds) {
        const target = getElementTarget(state.config, elementId);
        if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
            continue;
        }
        target.x += dx;
        target.y += dy;
        moved = true;
    }
    if (moved) {
        persistLayout(`Nudged ${getSelectedDescriptor().label}.`);
    }
}

function onEditorKeyDown(event) {
    if (!isUiEditorActive()) {
        return;
    }
    const activeEl = document.activeElement;
    const blocked = activeEl
        && activeEl !== el.elementList
        && activeEl !== el.viewport
        && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
    if (blocked) {
        return;
    }

    const step = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelected(-step, 0);
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelected(step, 0);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelected(0, -step);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelected(0, step);
    }
}

function onResetCurrentElement() {
    const defaults = getDefaultUiLayoutConfig();
    const sceneConfig = state.config?.[state.sceneId];
    if (sceneConfig && Array.isArray(sceneConfig.deletedElements) && sceneConfig.deletedElements.length > 0) {
        const selected = new Set(Array.from(state.selectedElementIds || []));
        sceneConfig.deletedElements = sceneConfig.deletedElements.filter((id) => !selected.has(id));
    }
    for (const elementId of state.selectedElementIds) {
        const target = getElementTarget(state.config, elementId);
        const fallback = getElementTarget(defaults, elementId);
        if (!target || !fallback) {
            continue;
        }
        Object.keys(target).forEach((key) => delete target[key]);
        Object.assign(target, JSON.parse(JSON.stringify(fallback)));
    }
    persistLayout(`Reset ${getSelectedDescriptor().label}.`);
}

function onDeleteCurrentElement() {
    const selectedIds = Array.from(state.selectedElementIds || []).filter(Boolean);
    if (selectedIds.length === 0) {
        setStatus('没有可删除的已选元素。', true);
        return;
    }
    const sceneConfig = state.config?.[state.sceneId];
    if (!sceneConfig || typeof sceneConfig !== 'object') {
        setStatus('当前场景配置不可用，无法删除。', true);
        return;
    }
    const currentElements = getSceneElements(state.sceneId);
    if (currentElements.length <= selectedIds.length) {
        setStatus('至少保留 1 个元素，不能全部删除。', true);
        return;
    }

    const plural = selectedIds.length > 1;
    const confirmed = window.confirm(
        plural
            ? `确认删除这 ${selectedIds.length} 个元素？\n删除后将从元素列表移除。`
            : '确认删除当前元素？\n删除后将从元素列表移除。'
    );
    if (!confirmed) {
        return;
    }

    const descriptorMap = getSceneElementDescriptorMap(state.sceneId);
    const allIds = Array.from(descriptorMap.keys());
    const deletedSet = new Set(normalizeDeletedElementIds(sceneConfig.deletedElements, allIds));
    let changed = 0;
    for (const elementId of selectedIds) {
        if (!descriptorMap.has(elementId) || deletedSet.has(elementId)) {
            continue;
        }
        deletedSet.add(elementId);
        changed += 1;
    }

    if (changed <= 0) {
        setStatus('所选元素已删除。');
        return;
    }

    sceneConfig.deletedElements = Array.from(deletedSet);
    syncSceneLayerOrder(state.sceneId);

    const remaining = getSceneElements(state.sceneId);
    const nextSelectedId = remaining[0]?.id || '';
    state.selectedElementId = nextSelectedId;
    state.selectedElementIds = nextSelectedId ? new Set([nextSelectedId]) : new Set();

    persistLayout(plural ? `已删除 ${changed} 个元素。` : `已删除元素。`);
}

function onResetScene() {
    const defaults = getDefaultUiLayoutConfig();
    state.config = writeUiLayoutConfig({
        ...state.config,
        [state.sceneId]: JSON.parse(JSON.stringify(defaults[state.sceneId]))
    });
    updateJsonEditor();
    renderPropertyGrid();
    renderPreview();
    refreshPropertyValues();
    setStatus(`Restored default layout for ${getSceneMeta().label}.`);
}

async function onCopyJson() {
    try {
        await navigator.clipboard.writeText(el.json?.value || '');
        setStatus('Layout JSON copied.');
    } catch {
        setStatus('Copy failed, please copy manually.', true);
    }
}

function onImportJson() {
    try {
        const parsed = JSON.parse(el.json?.value || '{}');
        state.config = writeUiLayoutConfig(parsed);
        updateJsonEditor();
        renderPropertyGrid();
        renderPreview();
        refreshPropertyValues();
        setStatus('Layout JSON imported.');
    } catch {
        setStatus('Invalid Layout JSON.', true);
    }
}

function getGameplayElementFields(elementId, visibilityField) {
    if (elementId === 'hudTop' || elementId === 'settingsButton' || elementId === 'center') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'settingsIcon' || elementId === 'coinIcon' || elementId === 'lives' || elementId === 'timerTrack') {
        return [
            { name: 'x', label: 'Offset X', step: 1 },
            { name: 'y', label: 'Offset Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'coinChip') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'coinValue' || elementId === 'timerLabel' || elementId === 'comboCount' || elementId === 'comboLabel' || elementId === 'scoreValue' || elementId === 'scoreGain') {
        return [
            { name: 'x', label: 'Offset X', step: 1 },
            { name: 'y', label: 'Offset Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'level') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'timer') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'combo') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'scorePulse') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    return [];
}

function getHomeElementFields(elementId, visibilityField) {
    const target = getElementTarget(state.config, elementId);
    if (target && typeof target.textZh === 'string') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            { name: 'align', label: 'Align', type: 'select', options: ['center', 'left'], wide: true },
            { name: 'textZh', label: '中文文字', type: 'text', wide: true },
            { name: 'textEn', label: 'English Text', type: 'text', wide: true },
            visibilityField
        ];
    }
    if (target && typeof target.x === 'number' && typeof target.y === 'number') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    return [];
}

function getPanelElementFields(elementId, visibilityField) {
    const target = getElementTarget(state.config, elementId);
    if (!target || typeof target !== 'object') {
        return [];
    }
    const fields = [];
    if (typeof target.x === 'number') {
        fields.push({ name: 'x', label: 'X', step: 1 });
    }
    if (typeof target.y === 'number') {
        fields.push({ name: 'y', label: 'Y', step: 1 });
    }
    if (typeof target.width === 'number') {
        fields.push({ name: 'width', label: 'Width', step: 1 });
    }
    if (typeof target.height === 'number') {
        fields.push({ name: 'height', label: 'Height', step: 1 });
    }
    if (typeof target.fontSize === 'number') {
        fields.push({ name: 'fontSize', label: 'Font', step: 1 });
    }
    if (typeof target.align === 'string') {
        fields.push({ name: 'align', label: 'Align', type: 'select', options: ['center', 'left'], wide: true });
    }
    if (typeof target.textZh === 'string') {
        fields.push({ name: 'textZh', label: '中文文字', type: 'text', wide: true });
    }
    if (typeof target.textEn === 'string') {
        fields.push({ name: 'textEn', label: 'English Text', type: 'text', wide: true });
    }
    fields.push(visibilityField);
    return fields;
}

function getElementFields(elementId) {
    const visibilityField = { name: 'visible', label: '鏄剧ず', type: 'checkbox', wide: true };
    if (state.sceneId === 'home') {
        return getHomeElementFields(elementId, visibilityField);
    }
    if (state.sceneId === 'gameplay') {
        return getGameplayElementFields(elementId, visibilityField);
    }
    if (PANEL_LAYOUT_DEFINITIONS[state.sceneId]) {
        return getPanelElementFields(elementId, visibilityField);
    }
    if (elementId === 'backButton') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'notebook') {
        return [
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            { name: 'paddingTop', label: 'Padding Top', step: 1, wide: true },
            { name: 'scaleMultiplier', label: 'Scene Scale', step: 0.05, source: 'scene', wide: true },
            visibilityField
        ];
    }
    if (elementId === 'ribbon') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'ribbonTitle') {
        return [
            { name: 'x', label: 'Offset X', step: 1 },
            { name: 'y', label: 'Offset Y', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'mascot') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'rewardTooltip') {
        return [
            { name: 'followMouse', label: '鐠虹喖娈㈡Η鐘崇垼', type: 'checkbox', wide: true },
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            visibilityField
        ];
    }
    if (elementId === 'status') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            visibilityField
        ];
    }

    const parsed = parseDayElementId(elementId);
    if (!parsed) {
        return [];
    }
    if (parsed.part === 'card' || parsed.part === 'icon') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'height', label: 'Height', step: 1 },
            visibilityField
        ];
    }
    if (parsed.part === 'title') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: 'Width', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            { name: 'align', label: 'Align', type: 'select', options: ['center', 'left'], wide: true },
            visibilityField
        ];
    }
    if (parsed.part === 'amount') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'fontSize', label: 'Font', step: 1 },
            visibilityField
        ];
    }
    if (parsed.part === 'badge') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'size', label: 'Size', step: 1 },
            visibilityField
        ];
    }
    return [];
}

function renderPropertyGrid() {
    if (!el.propertyGrid) {
        return;
    }
    el.propertyGrid.innerHTML = '';
    state.propertyInputs = {};
    const fields = getElementFields(state.selectedElementId);
    const boundElementId = state.selectedElementId;

    for (const field of fields) {
        const fieldSource = field.source || 'target';
        const target = resolveBoundTarget(fieldSource, boundElementId);
        if (!target) {
            continue;
        }

        const label = document.createElement('label');
        label.className = `field${field.wide ? ' is-wide' : ''}`;

        const caption = document.createElement('span');
        caption.textContent = field.label;
        label.appendChild(caption);

        let input;
        if (field.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!target[field.name];
            input.addEventListener('change', () => {
                const liveTarget = resolveBoundTarget(fieldSource, boundElementId);
                if (!liveTarget) {
                    return;
                }
                liveTarget[field.name] = !!input.checked;
                persistLayout(`Updated ${getSelectedDescriptor().label}.`);
            });
        } else if (field.type === 'select') {
            input = document.createElement('select');
            for (const optionValue of field.options || []) {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue;
                input.appendChild(option);
            }
            input.value = `${target[field.name] ?? field.options?.[0] ?? ''}`;
            input.addEventListener('change', () => {
                const liveTarget = resolveBoundTarget(fieldSource, boundElementId);
                if (!liveTarget) {
                    return;
                }
                liveTarget[field.name] = input.value;
                persistLayout(`Updated ${getSelectedDescriptor().label}.`);
            });
        } else if (field.type === 'text') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = `${target[field.name] ?? ''}`;
            input.addEventListener('input', () => {
                const liveTarget = resolveBoundTarget(fieldSource, boundElementId);
                if (!liveTarget) {
                    return;
                }
                liveTarget[field.name] = input.value;
                persistLayout(`Updated ${getSelectedDescriptor().label}.`);
            });
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.step = `${field.step || 1}`;
            input.value = `${target[field.name] ?? ''}`;
            bindNumericFieldInput(input, target, field.name, boundElementId, fieldSource);
        }

        state.propertyInputs[field.name] = { input, source: fieldSource };
        label.appendChild(input);
        el.propertyGrid.appendChild(label);
    }
}

function refreshPropertyValues() {
    const target = getElementTarget(state.config, state.selectedElementId);
    const scene = state.config?.[state.sceneId]?.scene;
    for (const [name, meta] of Object.entries(state.propertyInputs)) {
        const source = meta.source === 'scene' ? scene : target;
        if (!source || !meta.input) {
            continue;
        }
        if (meta.input.type === 'checkbox') {
            meta.input.checked = !!source[name];
        } else {
            meta.input.value = `${source[name] ?? ''}`;
        }
    }
    updateSizeReadout();
}

function syncSceneSelectOptions() {
    if (!el.sceneSelect) {
        return;
    }
    const currentValue = el.sceneSelect.value;
    el.sceneSelect.innerHTML = '';
    for (const [sceneId, scene] of Object.entries(SCENES)) {
        const option = document.createElement('option');
        option.value = sceneId;
        option.textContent = scene.label || sceneId;
        el.sceneSelect.appendChild(option);
    }
    el.sceneSelect.value = SCENES[currentValue] ? currentValue : state.sceneId;
}

function applySceneMeta() {
    const scene = getSceneMeta();
    if (el.sceneSelect) {
        el.sceneSelect.value = state.sceneId;
    }
    if (el.checkinStateFields) {
        el.checkinStateFields.hidden = !scene.showCheckinState;
    }
    if (el.previewTitle) {
        el.previewTitle.textContent = scene.previewTitle;
    }
    if (el.previewDesc) {
        el.previewDesc.textContent = scene.previewDesc;
    }
}

function setScene(sceneId) {
    const nextSceneId = SCENES[sceneId] ? sceneId : 'checkin';
    state.sceneId = nextSceneId;
    clearAssistLayer();
    applySceneMeta();

    const elements = getSceneElements(nextSceneId);
    const nextSelectedId = elements.some((item) => item.id === state.selectedElementId)
        ? state.selectedElementId
        : (getSceneMeta(nextSceneId).defaultElementId || elements[0]?.id || '');
    state.selectedElementId = nextSelectedId;
    state.selectedElementIds = new Set(nextSelectedId ? [nextSelectedId] : []);

    renderElementOptions();
    renderPropertyGrid();
    updateJsonEditor();
    refreshPropertyValues();
    renderOverlay();
    renderFollowMouseStage();

    const nextSrc = getSceneMeta(nextSceneId).frameSrc;
    if (el.previewFrame && el.previewFrame.getAttribute('src') !== nextSrc) {
        state.frameReady = false;
        el.previewFrame.setAttribute('src', nextSrc);
        return;
    }
    if (getPreviewApi()) {
        renderPreview();
    }
}

function bindSceneSelect() {
    el.sceneSelect?.addEventListener('change', () => {
        setScene(el.sceneSelect.value);
    });
}

function bindPreviewStateInputs() {
    el.previewMode?.addEventListener('change', () => {
        state.previewMode = el.previewMode.value || 'claimable';
        renderPreview();
    });
    el.claimedDays?.addEventListener('input', () => {
        state.claimedDays = clampInt(el.claimedDays.value, 0, 7, state.claimedDays);
        renderPreview();
    });
    el.nextDay?.addEventListener('input', () => {
        state.nextDay = clampInt(el.nextDay.value, 1, 7, state.nextDay);
        renderPreview();
    });
}

function clearElementListDragMarkers() {
    if (!el.elementList) {
        return;
    }
    for (const node of el.elementList.querySelectorAll('.drop-before, .drop-after')) {
        node.classList.remove('drop-before', 'drop-after');
    }
}

function moveElementLayer(dragId, anchorId, position = 'after') {
    const sceneConfig = state.config?.[state.sceneId];
    if (!sceneConfig || !dragId || !anchorId || dragId === anchorId) {
        return false;
    }
    const currentOrder = getSceneLayerOrder(state.sceneId);
    const dragIndex = currentOrder.indexOf(dragId);
    const anchorIndex = currentOrder.indexOf(anchorId);
    if (dragIndex < 0 || anchorIndex < 0) {
        return false;
    }
    const nextOrder = currentOrder.slice();
    nextOrder.splice(dragIndex, 1);
    const nextAnchorIndex = nextOrder.indexOf(anchorId);
    if (nextAnchorIndex < 0) {
        return false;
    }
    const insertIndex = position === 'before' ? nextAnchorIndex : (nextAnchorIndex + 1);
    nextOrder.splice(insertIndex, 0, dragId);
    sceneConfig.layerOrder = nextOrder;
    return true;
}

function onElementListClick(event) {
    const node = event.target?.closest?.('.ui-editor-element-item');
    if (!node) {
        return;
    }
    const elementId = node.dataset.elementId || '';
    if (!elementId) {
        return;
    }
    const additive = event.ctrlKey || event.metaKey;
    setSelectedElement(elementId, additive);
}

function onElementListKeyDown(event) {
    if (event.key.startsWith('Arrow')) {
        event.preventDefault();
    }
}

function onElementListDragStart(event) {
    const node = event.target?.closest?.('.ui-editor-element-item');
    if (!node || (typeof event.button === 'number' && event.button !== 0)) {
        event.preventDefault();
        return;
    }
    const elementId = node.dataset.elementId || '';
    if (!elementId) {
        event.preventDefault();
        return;
    }
    state.listDrag = {
        dragId: elementId,
        dropId: null,
        dropPosition: 'after'
    };
    node.classList.add('is-dragging');
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', elementId);
    }
}

function onElementListDragOver(event) {
    if (!state.listDrag || !el.elementList) {
        return;
    }
    const node = event.target?.closest?.('.ui-editor-element-item');
    if (!node) {
        return;
    }
    const dropId = node.dataset.elementId || '';
    if (!dropId || dropId === state.listDrag.dragId) {
        return;
    }
    event.preventDefault();
    const rect = node.getBoundingClientRect();
    const dropPosition = event.clientY < (rect.top + rect.height / 2) ? 'before' : 'after';
    clearElementListDragMarkers();
    node.classList.add(dropPosition === 'before' ? 'drop-before' : 'drop-after');
    state.listDrag.dropId = dropId;
    state.listDrag.dropPosition = dropPosition;
}

function onElementListDrop(event) {
    if (!state.listDrag) {
        return;
    }
    event.preventDefault();
    const { dragId, dropId, dropPosition } = state.listDrag;
    const moved = moveElementLayer(dragId, dropId, dropPosition);
    clearElementListDragMarkers();
    state.listDrag = null;
    if (!moved) {
        renderElementOptions();
        return;
    }
    persistLayout('Layer order updated.');
}

function onElementListDragEnd() {
    if (!el.elementList) {
        return;
    }
    clearElementListDragMarkers();
    for (const node of el.elementList.querySelectorAll('.is-dragging')) {
        node.classList.remove('is-dragging');
    }
    state.listDrag = null;
}

function bindElementList() {
    el.elementList?.addEventListener('click', onElementListClick);
    el.elementList?.addEventListener('keydown', onElementListKeyDown);
    el.elementList?.addEventListener('dragstart', onElementListDragStart);
    el.elementList?.addEventListener('dragover', onElementListDragOver);
    el.elementList?.addEventListener('drop', onElementListDrop);
    el.elementList?.addEventListener('dragend', onElementListDragEnd);
    el.elementList?.addEventListener('dragleave', () => {
        if (!state.listDrag) {
            clearElementListDragMarkers();
        }
    });
}

function bindScaleTools() {
    el.btnScaleApply?.addEventListener('click', () => {
        const percent = clampInt(el.scalePercent?.value, 1, 1000, 100);
        if (el.scalePercent) {
            el.scalePercent.value = `${percent}`;
        }
        applyScaleToSelected(percent / 100);
    });
    el.btnScaleDown?.addEventListener('click', () => applyScaleToSelected(0.9));
    el.btnScaleUp?.addEventListener('click', () => applyScaleToSelected(1.1));
}

function bindStorageSync() {
    window.addEventListener('storage', (event) => {
        if (event.key === 'arrowClear_liveopsConfig_v1' || event.key === 'arrowClear_liveopsPlayer_v1') {
            state.liveopsConfig = readLiveOpsConfig();
            state.liveopsPlayer = readLiveOpsPlayerState();
            syncPreviewInputsFromLiveState();
            renderPreview();
            setStatus('Synced latest live-ops config and check-in state.');
        }
        if (event.key === 'arrowClear_uiLayoutConfig_v1') {
            state.config = readUiLayoutConfig();
            updateJsonEditor();
            renderPropertyGrid();
            renderPreview();
            refreshPropertyValues();
        }
    });
}

function initPreviewFrame() {
    if (!el.previewFrame) {
        return;
    }
    el.previewFrame.addEventListener('load', () => {
        const waitForApi = () => {
            if (getPreviewApi()) {
                state.frameReady = true;
                renderPreview();
                return;
            }
            window.setTimeout(waitForApi, 80);
        };
        waitForApi();
    });
}

async function init() {
    if (!el.viewport || !el.stageWrap || !el.overlay) {
        return;
    }
    await initUiLayoutStorage().catch((error) => {
        console.warn('[admin-ui-editor] ui layout init failed', error);
    });
    state.config = readUiLayoutConfig();
    syncSceneSelectOptions();
    state.sceneId = SCENES[el.sceneSelect?.value] ? el.sceneSelect.value : 'checkin';
    syncPreviewInputsFromLiveState();
    applySceneMeta();
    updateJsonEditor();
    fitPreviewScale();
    bindSceneSelect();
    bindPreviewStateInputs();
    bindElementList();
    bindScaleTools();
    bindStorageSync();
    initPreviewFrame();
    el.btnDeleteElement?.addEventListener('click', onDeleteCurrentElement);
    el.btnResetElement?.addEventListener('click', onResetCurrentElement);
    el.btnResetScene?.addEventListener('click', onResetScene);
    el.btnCopyJson?.addEventListener('click', onCopyJson);
    el.btnImportJson?.addEventListener('click', onImportJson);
    window.addEventListener('keydown', onEditorKeyDown);
    window.addEventListener('resize', () => {
        fitPreviewScale();
        renderOverlay();
    });
    setScene(state.sceneId);
}

void init();



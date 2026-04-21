import {
    initUiLayoutStorage,
    getDefaultUiLayoutConfig,
    readUiLayoutConfig,
    writeUiLayoutConfig
} from './ui-layout-config.js?v=7';
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
    elementSelect: document.getElementById('uiEditorElementSelect'),
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
    followMousePanel: document.getElementById('uiEditorFollowMousePanel'),
    followMouseStage: document.getElementById('uiEditorFollowMouseStage'),
    followMousePreview: document.getElementById('uiEditorFollowMousePreview'),
    followMouseHint: document.getElementById('uiEditorFollowMouseHint'),
    json: document.getElementById('uiEditorJson'),
    status: document.getElementById('uiEditorStatus'),
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
    { id: 'hudTop', label: '顶部 HUD 容器' },
    { id: 'settingsButton', label: '设置按钮' },
    { id: 'settingsIcon', label: '设置图标' },
    { id: 'coinChip', label: '金币条' },
    { id: 'coinIcon', label: '金币图标' },
    { id: 'coinValue', label: '金币数值' },
    { id: 'center', label: '中央信息区' },
    { id: 'lives', label: '生命值行' },
    { id: 'level', label: '关卡标题' },
    { id: 'timer', label: '计时区' },
    { id: 'timerTrack', label: '计时条轨道' },
    { id: 'timerLabel', label: '计时文本' },
    { id: 'combo', label: 'Combo 容器' },
    { id: 'comboCount', label: 'Combo 数值' },
    { id: 'comboLabel', label: 'Combo 标签' },
    { id: 'scorePulse', label: '积分区' },
    { id: 'scoreValue', label: '总积分' },
    { id: 'scoreGain', label: '得分增量' }
];

const HOME_ELEMENTS = [
    { id: 'mascot', label: '首页小蛇动画' }
];

const SCENES = Object.freeze({
    checkin: Object.freeze({
        label: '签到页',
        previewTitle: '签到页预览',
        previewDesc: '点击元素选中后可拖拽。方向键移动 1px，Shift + 方向键移动 10px。',
        frameSrc: 'index.html?uiEditorPreview=1&uiEditorPanel=checkin',
        defaultElementId: 'day1-icon',
        showCheckinState: true,
        elements: CHECKIN_ELEMENTS
    }),
    gameplay: Object.freeze({
        label: '游戏界面',
        previewTitle: '游戏界面预览',
        previewDesc: '支持对游戏 HUD 的容器和子元素做细分调整，拖拽后会直接写入布局配置。',
        frameSrc: 'index.html?uiEditorPreview=1&uiEditorPanel=gameplay',
        defaultElementId: 'scorePulse',
        showCheckinState: false,
        elements: GAMEPLAY_ELEMENTS
    }),
    home: Object.freeze({
        label: '主界面',
        previewTitle: '主界面预览',
        previewDesc: '可拖拽和微调首页跳舞小蛇动画的位置与尺寸。',
        frameSrc: 'index.html?uiEditorPreview=1&uiEditorPanel=home',
        defaultElementId: 'mascot',
        showCheckinState: false,
        elements: HOME_ELEMENTS
    })
});

function buildElementDescriptors() {
    const items = [
        { id: 'backButton', label: '返回按钮' },
        { id: 'notebook', label: '签到卡片' },
        { id: 'ribbon', label: '顶部丝带' },
        { id: 'ribbonTitle', label: '签到标题' },
        { id: 'mascot', label: '右下角小蛇' }
    ];
    for (let day = 1; day <= 7; day += 1) {
        items.push({ id: `day${day}-card`, label: `第${day}天卡片` });
        items.push({ id: `day${day}-title`, label: `第${day}天标题` });
        items.push({ id: `day${day}-icon`, label: `第${day}天图标` });
        items.push({ id: `day${day}-amount`, label: `第${day}天数量` });
        items.push({ id: `day${day}-badge`, label: `第${day}天角标` });
    }
    return items;
}

function getSceneMeta(sceneId = state.sceneId) {
    return SCENES[sceneId] || SCENES.checkin;
}

function getSceneElements(sceneId = state.sceneId) {
    return getSceneMeta(sceneId).elements || CHECKIN_ELEMENTS;
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
        if (elementId === 'mascot') return scene.mascot;
        return null;
    }
    if (state.sceneId === 'gameplay') {
        const scene = config?.gameplay;
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

function legacyGetElementFields(elementId) {
    if (elementId === 'backButton') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: '宽', step: 1 },
            { name: 'height', label: '高', step: 1 },
            { name: 'fontSize', label: '字号', step: 1 }
        ];
    }
    if (elementId === 'notebook') {
        return [
            { name: 'width', label: '宽', step: 1 },
            { name: 'height', label: '高', step: 1 },
            { name: 'paddingTop', label: '顶部留白', step: 1, wide: true },
            { name: 'scaleMultiplier', label: '游戏缩放倍率', step: 0.05, source: 'scene', wide: true }
        ];
    }
    if (elementId === 'ribbon') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: '宽', step: 1 },
            { name: 'height', label: '高', step: 1 }
        ];
    }
    if (elementId === 'ribbonTitle') {
        return [
            { name: 'x', label: '偏移X', step: 1 },
            { name: 'y', label: '偏移Y', step: 1 },
            { name: 'fontSize', label: '字号', step: 1 }
        ];
    }
    if (elementId === 'mascot') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: '宽', step: 1 },
            { name: 'height', label: '高', step: 1 }
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
            { name: 'width', label: '宽', step: 1 },
            { name: 'height', label: '高', step: 1 }
        ];
    }
    if (parsed.part === 'title') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'width', label: '宽', step: 1 },
            { name: 'fontSize', label: '字号', step: 1 },
            { name: 'align', label: '对齐', type: 'select', options: ['center', 'left'], wide: true }
        ];
    }
    if (parsed.part === 'amount') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'fontSize', label: '字号', step: 1 }
        ];
    }
    if (parsed.part === 'badge') {
        return [
            { name: 'x', label: 'X', step: 1 },
            { name: 'y', label: 'Y', step: 1 },
            { name: 'size', label: '尺寸', step: 1 }
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
    el.stageWrap.style.transform = `translate(-50%, -50%) scale(${scale})`;
    el.stageWrap.style.left = '50%';
    el.stageWrap.style.top = '50%';
}

function parseNumericDraft(value) {
    const text = `${value ?? ''}`.trim();
    if (!text || text === '-' || text === '.' || text === '-.') {
        return null;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function bindNumericFieldInput(input, target, fieldName) {
    const commit = () => {
        const parsed = parseNumericDraft(input.value);
        if (parsed === null) {
            input.value = `${target?.[fieldName] ?? ''}`;
            return;
        }
        if (target?.[fieldName] === parsed) {
            input.value = `${parsed}`;
            return;
        }
        target[fieldName] = parsed;
        persistLayout(`已更新 ${getSelectedDescriptor().label}。`);
    };

    input.addEventListener('input', () => {
        const parsed = parseNumericDraft(input.value);
        if (parsed === null) {
            return;
        }
        target[fieldName] = parsed;
        persistLayout(`已更新 ${getSelectedDescriptor().label}。`);
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
    if (!el.elementSelect) {
        return;
    }
    el.elementSelect.innerHTML = '';
    for (const item of getSceneElements()) {
        const target = getElementTarget(state.config, item.id);
        const isHidden = target?.visible === false;
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = isHidden ? `${item.label} [hidden]` : item.label;
        option.selected = isElementSelected(item.id);
        el.elementSelect.appendChild(option);
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
                persistLayout(`已更新 ${getSelectedDescriptor().label}。`);
            });
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.step = `${field.step || 1}`;
            input.value = `${target[field.name] ?? ''}`;
            bindNumericFieldInput(input, target, field.name);
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
    persistLayout(`已更新 ${getSelectedDescriptor().label} 的跟随鼠标偏移。`);
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
        el.followMouseHint.textContent = '当前元素还没有显示出来，先让它显示，再调整跟随鼠标偏移。';
        return;
    }
    el.followMouseHint.textContent = '中间十字代表鼠标位置。拖拽下方元素，或直接修改 X / Y，来调整相对鼠标的偏移。';
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

function persistLayout(message = '布局已同步到预览。') {
    state.config = writeUiLayoutConfig(state.config);
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
        setStatus('缩放比例无效。', true);
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
        setStatus('当前选中元素没有可按比例调整的尺寸字段。', true);
        return;
    }

    persistLayout(`已按 ${(normalizedFactor * 100).toFixed(0)}% 缩放 ${getSelectedDescriptor().label}。`);
}

function setSelectedElements(ids, primaryId) {
    const nextIds = ids.length > 0 ? ids : [primaryId || state.selectedElementId];
    state.selectedElementId = primaryId || nextIds[nextIds.length - 1];
    state.selectedElementIds = new Set(nextIds);
    renderElementOptions();
    renderPropertyGrid();
    renderOverlay();
    renderFollowMouseStage();
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

function onOverlayPointerDown(event) {
    const elementId = event.currentTarget?.dataset?.elementId;
    if (!elementId) {
        return;
    }
    event.preventDefault();
    event.stopPropagation();

    const additive = event.ctrlKey || event.metaKey;
    setSelectedElement(elementId, additive);

    const moveIds = (additive ? Array.from(state.selectedElementIds) : Array.from(state.selectedElementIds))
        .filter((id) => targetSupportsDrag(id));
    if (moveIds.length === 0) {
        return;
    }

    state.drag = {
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
    for (const item of state.drag.targets) {
        const target = getElementTarget(state.config, item.id);
        if (!target) {
            continue;
        }
        target.x = Math.round(item.startX + deltaX);
        target.y = Math.round(item.startY + deltaY);
    }
    persistLayout(`已拖拽 ${getSelectedDescriptor().label}。`);
}

function onWindowPointerUp() {
    state.drag = null;
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
        persistLayout(`已微调 ${getSelectedDescriptor().label}。`);
    }
}

function onEditorKeyDown(event) {
    if (!isUiEditorActive()) {
        return;
    }
    const activeEl = document.activeElement;
    const blocked = activeEl
        && activeEl !== el.elementSelect
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
    for (const elementId of state.selectedElementIds) {
        const target = getElementTarget(state.config, elementId);
        const fallback = getElementTarget(defaults, elementId);
        if (!target || !fallback) {
            continue;
        }
        Object.keys(target).forEach((key) => delete target[key]);
        Object.assign(target, JSON.parse(JSON.stringify(fallback)));
    }
    persistLayout(`已重置 ${getSelectedDescriptor().label}。`);
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
    setStatus(`已恢复${getSceneMeta().label}默认布局。`);
}

async function onCopyJson() {
    try {
        await navigator.clipboard.writeText(el.json?.value || '');
        setStatus('布局 JSON 已复制。');
    } catch {
        setStatus('复制失败，请手动复制。', true);
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
        setStatus('布局 JSON 导入成功。');
    } catch {
        setStatus('布局 JSON 格式错误。', true);
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
    if (elementId === 'mascot') {
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

function getElementFields(elementId) {
    const visibilityField = { name: 'visible', label: '显示', type: 'checkbox', wide: true };
    if (state.sceneId === 'home') {
        return getHomeElementFields(elementId, visibilityField);
    }
    if (state.sceneId === 'gameplay') {
        return getGameplayElementFields(elementId, visibilityField);
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
            { name: 'followMouse', label: '璺熼殢榧犳爣', type: 'checkbox', wide: true },
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

    for (const field of fields) {
        const target = field.source === 'scene'
            ? state.config?.[state.sceneId]?.scene
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
        if (field.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!target[field.name];
            input.addEventListener('change', () => {
                target[field.name] = !!input.checked;
                persistLayout(`已更新 ${getSelectedDescriptor().label}。`);
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
                target[field.name] = input.value;
                persistLayout(`已更新 ${getSelectedDescriptor().label}。`);
            });
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.step = `${field.step || 1}`;
            input.value = `${target[field.name] ?? ''}`;
            bindNumericFieldInput(input, target, field.name);
        }

        state.propertyInputs[field.name] = { input, source: field.source || 'target' };
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

function bindElementSelect() {
    el.elementSelect?.addEventListener('change', () => {
        const selected = Array.from(el.elementSelect.selectedOptions || []).map((option) => option.value);
        if (selected.length === 0) {
            return;
        }
        setSelectedElements(selected, selected[selected.length - 1]);
    });
    el.elementSelect?.addEventListener('keydown', (event) => {
        if (event.key.startsWith('Arrow')) {
            event.preventDefault();
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
            setStatus('已同步当前活动配置和签到状态。');
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
    state.sceneId = SCENES[el.sceneSelect?.value] ? el.sceneSelect.value : 'checkin';
    syncPreviewInputsFromLiveState();
    applySceneMeta();
    updateJsonEditor();
    fitPreviewScale();
    bindSceneSelect();
    bindPreviewStateInputs();
    bindElementSelect();
    bindScaleTools();
    bindStorageSync();
    initPreviewFrame();
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

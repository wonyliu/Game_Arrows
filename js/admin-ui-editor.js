import {
    getDefaultUiLayoutConfig,
    readUiLayoutConfig,
    resetUiLayoutConfig,
    writeUiLayoutConfig
} from './ui-layout-config.js?v=3';
import {
    getLocalDayKey,
    readLiveOpsConfig,
    readLiveOpsPlayerState
} from './liveops-storage.js?v=1';

const el = {
    previewMode: document.getElementById('uiEditorPreviewMode'),
    claimedDays: document.getElementById('uiEditorClaimedDays'),
    nextDay: document.getElementById('uiEditorNextDay'),
    elementSelect: document.getElementById('uiEditorElementSelect'),
    propertyGrid: document.getElementById('uiEditorPropertyGrid'),
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

const ELEMENTS = [
    ...buildElementDescriptors(),
    { id: 'rewardTooltip', label: 'Reward Tooltip' },
    { id: 'status', label: 'Checkin Status' }
];

function buildElementDescriptors() {
    const items = [
        { id: 'backButton', label: '返回按钮' },
        { id: 'notebook', label: '签到纸张' },
        { id: 'ribbon', label: '顶部丝带' },
        { id: 'ribbonTitle', label: '签到标题' },
        { id: 'mascot', label: '右下角小蛇' }
    ];
    for (let day = 1; day <= 7; day += 1) {
        items.push({ id: `day${day}-card`, label: `第${day}天卡片` });
        items.push({ id: `day${day}-title`, label: `第${day}天标题` });
        items.push({ id: `day${day}-icon`, label: `第${day}天图标` });
        items.push({ id: `day${day}-amount`, label: `第${day}天数量` });
        items.push({ id: `day${day}-badge`, label: `第${day}天绿勾` });
    }
    return items;
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
    return ELEMENTS.find((item) => item.id === state.selectedElementId) || ELEMENTS[0];
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

function renderElementOptions() {
    if (!el.elementSelect) {
        return;
    }
    el.elementSelect.innerHTML = '';
    for (const item of ELEMENTS) {
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
            input.addEventListener('input', () => {
                const parsed = Number(input.value);
                if (!Number.isFinite(parsed)) {
                    return;
                }
                target[field.name] = parsed;
                persistLayout(`已更新 ${getSelectedDescriptor().label}。`);
            });
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
    for (const item of ELEMENTS) {
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
    if (previewApi && typeof previewApi.render === 'function') {
        previewApi.render(getPreviewOverride());
    }

    fitPreviewScale();
    renderOverlay();
    renderFollowMouseStage();
}

function isFollowMouseElement(elementId) {
    return elementId === 'rewardTooltip';
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
    persistLayout(`已更新 ${getSelectedDescriptor().label} 的跟随鼠标偏移`);
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
        el.followMouseHint.textContent = '当前元素还没有显示出来，先把它显示出来，再调整跟随鼠标偏移。';
        return;
    }
    el.followMouseHint.textContent = '中央箭头代表鼠标位置。拖拽下方元素，或直接修改 X / Y，调整相对鼠标的偏移。';
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

function persistLayout(message = '布局已同步到游戏页。') {
    state.config = writeUiLayoutConfig(state.config);
    updateJsonEditor();
    renderPreview();
    refreshPropertyValues();
    setStatus(message);
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
    state.config = resetUiLayoutConfig();
    updateJsonEditor();
    renderPropertyGrid();
    renderPreview();
    refreshPropertyValues();
    setStatus('已恢复签到页默认布局。');
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

function getElementFields(elementId) {
    const visibilityField = { name: 'visible', label: '显示', type: 'checkbox', wide: true };
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
            { name: 'followMouse', label: '跟随鼠标', type: 'checkbox', wide: true },
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
        if (field.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!target[field.name];
            input.addEventListener('change', () => {
                target[field.name] = !!input.checked;
                persistLayout(`已更新 ${getSelectedDescriptor().label}`);
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
                persistLayout(`已更新 ${getSelectedDescriptor().label}`);
            });
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.step = `${field.step || 1}`;
            input.value = `${target[field.name] ?? ''}`;
            input.addEventListener('input', () => {
                const parsed = Number(input.value);
                if (!Number.isFinite(parsed)) {
                    return;
                }
                target[field.name] = parsed;
                persistLayout(`已更新 ${getSelectedDescriptor().label}`);
            });
        }

        state.propertyInputs[field.name] = { input, source: field.source || 'target' };
        label.appendChild(input);
        el.propertyGrid.appendChild(label);
    }
}

function refreshPropertyValues() {
    const target = getElementTarget(state.config, state.selectedElementId);
    const scene = state.config?.checkin?.scene;
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

function bindStorageSync() {
    window.addEventListener('storage', (event) => {
        if (event.key === 'arrowClear_liveopsConfig_v1' || event.key === 'arrowClear_liveopsPlayer_v1') {
            state.liveopsConfig = readLiveOpsConfig();
            state.liveopsPlayer = readLiveOpsPlayerState();
            syncPreviewInputsFromLiveState();
            renderPreview();
            setStatus('已同步当前活动配置和签到状态。');
        }
        if (event.key === 'arrowClear_uiLayout_v1') {
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

function init() {
    if (!el.viewport || !el.stageWrap || !el.overlay) {
        return;
    }
    syncPreviewInputsFromLiveState();
    renderElementOptions();
    renderPropertyGrid();
    updateJsonEditor();
    fitPreviewScale();
    bindPreviewStateInputs();
    bindElementSelect();
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
}

init();

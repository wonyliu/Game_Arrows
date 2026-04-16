const STORAGE_API_BASE = '/api/storage';
const UI_LAYOUT_STORAGE_FILE = 'ui-layout-config-v1';
const UI_LAYOUT_STATIC_CONFIG_PATH = 'data/managed-config/ui-layout-config-v1.json';
const BROADCAST_CHANNEL_NAME = 'arrowClear_uiLayout_sync';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function readNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readBool(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

function createDefaultDayLayout(day) {
    const cardMap = {
        1: { x: 267, y: 209, width: 137, height: 154 },
        2: { x: 412, y: 209, width: 137, height: 154 },
        3: { x: 558, y: 210, width: 137, height: 154 },
        4: { x: 267, y: 366, width: 137, height: 154 },
        5: { x: 412, y: 368, width: 137, height: 154 },
        6: { x: 558, y: 366, width: 137, height: 154 },
        7: { x: 264, y: 531, width: 329, height: 154 }
    };
    if (day === 7) {
        return {
            card: { ...cardMap[7], visible: true },
            title: { x: 24, y: 18, width: 120, fontSize: 28, align: 'left', visible: true },
            icon: { x: 160, y: 53, width: 60, height: 60, visible: true },
            amount: { x: 289, y: 115, fontSize: 23, visible: true },
            badge: { x: 160, y: 53, size: 32, visible: true }
        };
    }
    return {
        card: { ...cardMap[day], visible: true },
        title: { x: 14, y: 12, width: 109, fontSize: 16, align: 'center', visible: true },
        icon: { x: 68.5, y: 78, width: 46, height: 46, visible: true },
        amount: { x: 68.5, y: 120, fontSize: 17, visible: true },
        badge: { x: 68.5, y: 78, size: 28, visible: true }
    };
}

function createDefaultCheckinLayout() {
    const days = {};
    for (let day = 1; day <= 7; day += 1) {
        days[day] = createDefaultDayLayout(day);
    }
    return {
        scene: {
            scaleMultiplier: 1.8
        },
        backButton: {
            x: 16,
            y: 16,
            width: 88,
            height: 42,
            fontSize: 18,
            visible: true
        },
        notebook: {
            width: 980,
            height: 760,
            paddingTop: 126,
            visible: true
        },
        ribbon: {
            x: 230,
            y: 40,
            width: 520,
            height: 170,
            visible: true
        },
        ribbonTitle: {
            x: 0,
            y: -4,
            fontSize: 60,
            visible: true
        },
        mascot: {
            x: 565,
            y: 506,
            width: 132,
            height: 176,
            visible: false
        },
        rewardTooltip: {
            x: 42,
            y: 34,
            width: 220,
            followMouse: false,
            visible: false
        },
        status: {
            x: 300,
            y: 698,
            width: 380,
            fontSize: 13,
            visible: false
        },
        days
    };
}

function createDefaultGameplayLayout() {
    return {
        hudTop: {
            x: 0,
            y: 24,
            width: 430,
            height: 76,
            visible: true
        },
        settingsButton: {
            x: 376,
            y: -4,
            width: 46,
            height: 46,
            visible: true
        },
        coinChip: {
            x: 280,
            y: 4,
            width: 78,
            height: 34,
            fontSize: 18,
            visible: true
        },
        center: {
            x: 93,
            y: 0,
            width: 244,
            height: 76,
            visible: true
        },
        level: {
            x: 0,
            y: 0,
            width: 244,
            fontSize: 17,
            visible: true
        },
        timer: {
            x: 0,
            y: 26,
            width: 168,
            height: 32,
            labelFontSize: 12,
            visible: true
        },
        combo: {
            x: 176,
            y: 24,
            width: 108,
            height: 42,
            fontSize: 22,
            visible: true
        },
        scorePulse: {
            x: 121,
            y: 78,
            width: 188,
            height: 48,
            valueFontSize: 16,
            gainFontSize: 15,
            visible: true
        }
    };
}

export function getDefaultUiLayoutConfig() {
    return {
        checkin: createDefaultCheckinLayout(),
        gameplay: createDefaultGameplayLayout()
    };
}

function mergeRect(defaultRect, partialRect) {
    return {
        x: readNumber(partialRect?.x, defaultRect.x),
        y: readNumber(partialRect?.y, defaultRect.y),
        width: readNumber(partialRect?.width, defaultRect.width),
        height: readNumber(partialRect?.height, defaultRect.height),
        visible: readBool(partialRect?.visible, defaultRect.visible ?? true)
    };
}

function mergeText(defaultText, partialText) {
    return {
        x: readNumber(partialText?.x, defaultText.x),
        y: readNumber(partialText?.y, defaultText.y),
        width: readNumber(partialText?.width, defaultText.width),
        fontSize: readNumber(partialText?.fontSize, defaultText.fontSize),
        align: `${partialText?.align || defaultText.align || 'center'}`.toLowerCase() === 'left' ? 'left' : 'center',
        visible: readBool(partialText?.visible, defaultText.visible ?? true)
    };
}

function mergePointSize(defaultValue, partialValue) {
    return {
        x: readNumber(partialValue?.x, defaultValue.x),
        y: readNumber(partialValue?.y, defaultValue.y),
        size: readNumber(partialValue?.size, defaultValue.size),
        visible: readBool(partialValue?.visible, defaultValue.visible ?? true)
    };
}

function mergePointText(defaultValue, partialValue) {
    return {
        x: readNumber(partialValue?.x, defaultValue.x),
        y: readNumber(partialValue?.y, defaultValue.y),
        fontSize: readNumber(partialValue?.fontSize, defaultValue.fontSize),
        visible: readBool(partialValue?.visible, defaultValue.visible ?? true)
    };
}

function normalizeCheckinLayout(layout) {
    const defaults = createDefaultCheckinLayout();
    const normalizedDays = {};
    for (let day = 1; day <= 7; day += 1) {
        const fallback = defaults.days[day];
        const partial = layout?.days?.[day] || layout?.days?.[`${day}`] || {};
        normalizedDays[day] = {
            card: mergeRect(fallback.card, partial.card),
            title: mergeText(fallback.title, partial.title),
            icon: mergeRect(fallback.icon, partial.icon),
            amount: mergePointText(fallback.amount, partial.amount),
            badge: mergePointSize(fallback.badge, partial.badge)
        };
    }

    return {
        scene: {
            scaleMultiplier: readNumber(layout?.scene?.scaleMultiplier, defaults.scene.scaleMultiplier)
        },
        backButton: {
            x: readNumber(layout?.backButton?.x, defaults.backButton.x),
            y: readNumber(layout?.backButton?.y, defaults.backButton.y),
            width: readNumber(layout?.backButton?.width, defaults.backButton.width),
            height: readNumber(layout?.backButton?.height, defaults.backButton.height),
            fontSize: readNumber(layout?.backButton?.fontSize, defaults.backButton.fontSize),
            visible: readBool(layout?.backButton?.visible, defaults.backButton.visible)
        },
        notebook: {
            width: readNumber(layout?.notebook?.width, defaults.notebook.width),
            height: readNumber(layout?.notebook?.height, defaults.notebook.height),
            paddingTop: readNumber(layout?.notebook?.paddingTop, defaults.notebook.paddingTop),
            visible: readBool(layout?.notebook?.visible, defaults.notebook.visible)
        },
        ribbon: mergeRect(defaults.ribbon, layout?.ribbon),
        ribbonTitle: {
            x: readNumber(layout?.ribbonTitle?.x, defaults.ribbonTitle.x),
            y: readNumber(layout?.ribbonTitle?.y, defaults.ribbonTitle.y),
            fontSize: readNumber(layout?.ribbonTitle?.fontSize, defaults.ribbonTitle.fontSize),
            visible: readBool(layout?.ribbonTitle?.visible, defaults.ribbonTitle.visible)
        },
        mascot: mergeRect(defaults.mascot, layout?.mascot),
        rewardTooltip: {
            x: readNumber(layout?.rewardTooltip?.x, defaults.rewardTooltip.x),
            y: readNumber(layout?.rewardTooltip?.y, defaults.rewardTooltip.y),
            width: readNumber(layout?.rewardTooltip?.width, defaults.rewardTooltip.width),
            followMouse: readBool(layout?.rewardTooltip?.followMouse, defaults.rewardTooltip.followMouse),
            visible: readBool(layout?.rewardTooltip?.visible, defaults.rewardTooltip.visible)
        },
        status: {
            x: readNumber(layout?.status?.x, defaults.status.x),
            y: readNumber(layout?.status?.y, defaults.status.y),
            width: readNumber(layout?.status?.width, defaults.status.width),
            fontSize: readNumber(layout?.status?.fontSize, defaults.status.fontSize),
            visible: readBool(layout?.status?.visible, defaults.status.visible)
        },
        days: normalizedDays
    };
}

function normalizeGameplayLayout(layout) {
    const defaults = createDefaultGameplayLayout();
    return {
        hudTop: mergeRect(defaults.hudTop, layout?.hudTop),
        settingsButton: mergeRect(defaults.settingsButton, layout?.settingsButton),
        coinChip: {
            ...mergeRect(defaults.coinChip, layout?.coinChip),
            fontSize: readNumber(layout?.coinChip?.fontSize, defaults.coinChip.fontSize)
        },
        center: mergeRect(defaults.center, layout?.center),
        level: {
            x: readNumber(layout?.level?.x, defaults.level.x),
            y: readNumber(layout?.level?.y, defaults.level.y),
            width: readNumber(layout?.level?.width, defaults.level.width),
            fontSize: readNumber(layout?.level?.fontSize, defaults.level.fontSize),
            visible: readBool(layout?.level?.visible, defaults.level.visible)
        },
        timer: {
            ...mergeRect(defaults.timer, layout?.timer),
            labelFontSize: readNumber(layout?.timer?.labelFontSize, defaults.timer.labelFontSize)
        },
        combo: {
            ...mergeRect(defaults.combo, layout?.combo),
            fontSize: readNumber(layout?.combo?.fontSize, defaults.combo.fontSize)
        },
        scorePulse: {
            ...mergeRect(defaults.scorePulse, layout?.scorePulse),
            valueFontSize: readNumber(layout?.scorePulse?.valueFontSize, defaults.scorePulse.valueFontSize),
            gainFontSize: readNumber(layout?.scorePulse?.gainFontSize, defaults.scorePulse.gainFontSize)
        }
    };
}

export function normalizeUiLayoutConfig(config) {
    return {
        checkin: normalizeCheckinLayout(config?.checkin),
        gameplay: normalizeGameplayLayout(config?.gameplay)
    };
}

let uiLayoutState = normalizeUiLayoutConfig(getDefaultUiLayoutConfig());
let uiLayoutInitPromise = null;
const listeners = new Set();
let syncChannel = null;

export async function initUiLayoutStorage() {
    if (uiLayoutInitPromise) {
        return uiLayoutInitPromise;
    }
    uiLayoutInitPromise = (async () => {
        const remote = await fetchUiLayoutFromServer();
        if (remote) {
            uiLayoutState = normalizeUiLayoutConfig(remote);
            emitUiLayoutChange(uiLayoutState);
            broadcastUiLayoutState(uiLayoutState);
        }
    })().catch((error) => {
        console.warn('[ui-layout-config] init failed', error);
    });
    return uiLayoutInitPromise;
}

export function readUiLayoutConfig() {
    return cloneUiLayoutConfig(uiLayoutState);
}

export function writeUiLayoutConfig(config, options = {}) {
    const normalized = normalizeUiLayoutConfig(config);
    uiLayoutState = normalized;
    emitUiLayoutChange(normalized);
    broadcastUiLayoutState(normalized);
    if (options.syncServer !== false) {
        void persistUiLayoutToServer(normalized);
    }
    return cloneUiLayoutConfig(normalized);
}

export function resetUiLayoutConfig(options = {}) {
    const defaults = normalizeUiLayoutConfig(getDefaultUiLayoutConfig());
    uiLayoutState = defaults;
    emitUiLayoutChange(defaults);
    broadcastUiLayoutState(defaults);
    if (options.syncServer !== false) {
        void persistUiLayoutToServer(defaults);
    }
    return cloneUiLayoutConfig(defaults);
}

export function subscribeUiLayoutConfig(listener) {
    if (typeof listener !== 'function') {
        return () => {};
    }
    listeners.add(listener);
    ensureSyncChannel();
    listener(cloneUiLayoutConfig(uiLayoutState));
    return () => {
        listeners.delete(listener);
    };
}

export function cloneUiLayoutConfig(config) {
    return clone(normalizeUiLayoutConfig(config));
}

async function fetchUiLayoutFromServer() {
    if (typeof fetch !== 'function') {
        return null;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${UI_LAYOUT_STORAGE_FILE}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (response.ok) {
            const data = await response.json();
            return isPlainObject(data) ? data : null;
        }
    } catch {
        // continue to static fallback
    }

    try {
        const response = await fetch(UI_LAYOUT_STATIC_CONFIG_PATH, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            return null;
        }
        const data = await response.json();
        return isPlainObject(data) ? data : null;
    } catch {
        return null;
    }
}

async function persistUiLayoutToServer(config) {
    if (typeof fetch !== 'function') {
        return false;
    }
    try {
        const response = await fetch(`${STORAGE_API_BASE}/${UI_LAYOUT_STORAGE_FILE}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return response.ok;
    } catch {
        return false;
    }
}

function emitUiLayoutChange(config, skipListener = null) {
    for (const listener of listeners) {
        if (listener === skipListener) {
            continue;
        }
        try {
            listener(cloneUiLayoutConfig(config));
        } catch {
            // noop
        }
    }
}

function ensureSyncChannel() {
    if (syncChannel || typeof BroadcastChannel === 'undefined') {
        return;
    }
    try {
        syncChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        syncChannel.addEventListener('message', (event) => {
            const payload = event?.data;
            if (!isPlainObject(payload) || payload.type !== 'ui-layout-sync') {
                return;
            }
            const normalized = normalizeUiLayoutConfig(payload.config);
            uiLayoutState = normalized;
            emitUiLayoutChange(normalized);
        });
    } catch {
        syncChannel = null;
    }
}

function broadcastUiLayoutState(config) {
    ensureSyncChannel();
    if (!syncChannel) {
        return;
    }
    try {
        syncChannel.postMessage({
            type: 'ui-layout-sync',
            config: cloneUiLayoutConfig(config)
        });
    } catch {
        // noop
    }
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

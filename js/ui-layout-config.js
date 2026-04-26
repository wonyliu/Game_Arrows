const STORAGE_API_BASE = '/api/storage';
const UI_LAYOUT_STORAGE_FILE = 'ui-layout-config-v1';
const UI_LAYOUT_STATIC_CONFIG_PATH = 'data/managed-config/ui-layout-config-v1.json';
const BROADCAST_CHANNEL_NAME = 'arrowClear_uiLayout_sync';
const UI_LAYOUT_LOCAL_STORAGE_KEY = 'arrowClear_uiLayoutConfig_v1';

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

function readString(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}

function createCheckinLayerOrder() {
    const order = ['backButton', 'notebook', 'ribbon', 'ribbonTitle', 'mascot'];
    for (let day = 1; day <= 7; day += 1) {
        order.push(`day${day}-card`);
        order.push(`day${day}-title`);
        order.push(`day${day}-icon`);
        order.push(`day${day}-amount`);
        order.push(`day${day}-badge`);
    }
    order.push('rewardTooltip');
    order.push('status');
    return order;
}

const CHECKIN_LAYER_ORDER = Object.freeze(createCheckinLayerOrder());
const GAMEPLAY_LAYER_ORDER = Object.freeze([
    'hudTop',
    'settingsButton',
    'settingsIcon',
    'coinChip',
    'coinIcon',
    'coinValue',
    'center',
    'lives',
    'level',
    'timer',
    'timerTrack',
    'timerLabel',
    'combo',
    'comboCount',
    'comboLabel',
    'scorePulse',
    'scoreValue',
    'scoreGain'
]);
const HOME_LAYER_ORDER = Object.freeze([
    'homeBgPanelLarge',
    'homeBgSnakeUp',
    'homeBgSnakeDown',
    'homeBgCavePanel',
    'homeTitle',
    'playArea',
    'startButton',
    'startButtonText',
    'levelTag',
    'levelTagLabel',
    'levelTagValue',
    'featurePanel',
    'featureSettings',
    'featureSettingsText',
    'featureLeaderboard',
    'featureLeaderboardText',
    'featureSkins',
    'featureSkinsText',
    'featureCheckin',
    'featureCheckinText',
    'featureExit',
    'featureExitText',
    'featureSupportAuthor',
    'featureSupportAuthorText',
    'profileEntry',
    'loginEntry',
    'loginEntryText',
    'homeCoinChip',
    'versionTag',
    'homeMascot',
    'onlineRewardDock',
    'onlineRewardChest',
    'onlineRewardText'
]);

function copyLayerOrder(order) {
    return Array.isArray(order) ? order.slice() : [];
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
        layerOrder: copyLayerOrder(CHECKIN_LAYER_ORDER),
        deletedElements: [],
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
        layerOrder: copyLayerOrder(GAMEPLAY_LAYER_ORDER),
        deletedElements: [],
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
        settingsIcon: {
            x: 0,
            y: 0,
            width: 43,
            height: 43,
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
        coinIcon: {
            x: 0,
            y: 0,
            width: 16,
            height: 16,
            visible: true
        },
        coinValue: {
            x: 0,
            y: 0,
            width: 42,
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
        lives: {
            x: 0,
            y: 0,
            width: 96,
            height: 26,
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
        timerTrack: {
            x: 0,
            y: 0,
            width: 168,
            height: 14,
            visible: true
        },
        timerLabel: {
            x: 0,
            y: 0,
            width: 168,
            fontSize: 12,
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
        comboCount: {
            x: 0,
            y: 0,
            width: 52,
            fontSize: 22,
            visible: true
        },
        comboLabel: {
            x: 0,
            y: 0,
            width: 44,
            fontSize: 18,
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
        },
        scoreValue: {
            x: 0,
            y: 0,
            width: 188,
            fontSize: 16,
            visible: true
        },
        scoreGain: {
            x: 0,
            y: 0,
            width: 188,
            fontSize: 15,
            visible: true
        }
    };
}

function createDefaultHomeLayout() {
    return {
        layerOrder: copyLayerOrder(HOME_LAYER_ORDER),
        deletedElements: [],
        homeBgPanelLarge: {
            x: 24,
            y: 737,
            width: 198,
            height: 143,
            visible: true
        },
        homeBgSnakeUp: {
            x: 156,
            y: 362,
            width: 126,
            height: 44,
            visible: true
        },
        homeBgSnakeDown: {
            x: 224,
            y: 274,
            width: 154,
            height: 95,
            visible: true
        },
        homeBgCavePanel: {
            x: 16,
            y: 42,
            width: 138,
            height: 308,
            visible: true
        },
        homeTitle: {
            x: 79,
            y: 42,
            width: 272,
            height: 96,
            visible: true
        },
        playArea: {
            x: 116,
            y: 92,
            width: 292,
            height: 192,
            visible: true
        },
        startButton: {
            x: 1,
            y: 0,
            width: 291,
            height: 108,
            visible: true
        },
        startButtonText: {
            x: 0,
            y: 0,
            width: 291,
            height: 108,
            fontSize: 34,
            align: 'center',
            textZh: '进入游戏',
            textEn: 'Enter Game',
            visible: true
        },
        levelTag: {
            x: 160,
            y: 120,
            width: 132,
            height: 66,
            visible: true
        },
        levelTagLabel: {
            x: 8,
            y: 12,
            width: 116,
            height: 16,
            fontSize: 9,
            align: 'center',
            textZh: '洞穴入口',
            textEn: 'Burrow',
            visible: true
        },
        levelTagValue: {
            x: 8,
            y: 28,
            width: 116,
            height: 24,
            fontSize: 15,
            align: 'center',
            textZh: '洞穴 {level}',
            textEn: 'Burrow {level}',
            visible: true
        },
        featurePanel: {
            x: 13,
            y: 566,
            width: 404,
            height: 340,
            visible: true
        },
        featureSettings: {
            x: 8,
            y: 8,
            width: 129,
            height: 162,
            visible: true
        },
        featureSettingsText: {
            x: 8,
            y: 105,
            width: 113,
            height: 36,
            fontSize: 24,
            align: 'center',
            textZh: '设置',
            textEn: 'Settings',
            visible: true
        },
        featureLeaderboard: {
            x: 138,
            y: 8,
            width: 129,
            height: 162,
            visible: true
        },
        featureLeaderboardText: {
            x: 8,
            y: 105,
            width: 113,
            height: 36,
            fontSize: 21,
            align: 'center',
            textZh: '排行榜',
            textEn: 'Leaderboard',
            visible: true
        },
        featureSkins: {
            x: 268,
            y: 8,
            width: 129,
            height: 162,
            visible: true
        },
        featureSkinsText: {
            x: 8,
            y: 105,
            width: 113,
            height: 36,
            fontSize: 24,
            align: 'center',
            textZh: '皮肤',
            textEn: 'Skins',
            visible: true
        },
        featureCheckin: {
            x: 8,
            y: 176,
            width: 129,
            height: 162,
            visible: true
        },
        featureCheckinText: {
            x: 8,
            y: 105,
            width: 113,
            height: 36,
            fontSize: 24,
            align: 'center',
            textZh: '签到',
            textEn: 'Check-In',
            visible: true
        },
        featureExit: {
            x: 138,
            y: 176,
            width: 129,
            height: 162,
            visible: true
        },
        featureExitText: {
            x: 8,
            y: 105,
            width: 113,
            height: 36,
            fontSize: 24,
            align: 'center',
            textZh: '退出',
            textEn: 'Exit',
            visible: true
        },
        featureSupportAuthor: {
            x: 268,
            y: 176,
            width: 129,
            height: 162,
            visible: true
        },
        featureSupportAuthorText: {
            x: 8,
            y: 105,
            width: 113,
            height: 36,
            fontSize: 21,
            align: 'center',
            textZh: '支持作者',
            textEn: 'Support Author',
            visible: true
        },
        profileEntry: {
            x: 18,
            y: 100,
            width: 44,
            height: 44,
            visible: true
        },
        loginEntry: {
            x: 8,
            y: 146,
            width: 64,
            height: 24,
            visible: true
        },
        loginEntryText: {
            x: 0,
            y: 0,
            width: 64,
            height: 24,
            fontSize: 14,
            align: 'center',
            textZh: '登录',
            textEn: 'Login',
            visible: true
        },
        coinChip: {
            x: 336,
            y: 24,
            width: 78,
            height: 34,
            visible: true
        },
        versionTag: {
            x: 304,
            y: 896,
            width: 112,
            height: 24,
            visible: true
        },
        mascot: {
            x: 156,
            y: 362,
            width: 126,
            height: 154,
            visible: false
        },
        onlineRewardDock: {
            x: 334,
            y: 392,
            width: 88,
            height: 112,
            visible: true
        },
        onlineRewardChest: {
            x: 0,
            y: 0,
            width: 88,
            height: 88,
            visible: true
        },
        onlineRewardText: {
            x: 6,
            y: 76,
            width: 76,
            height: 24,
            fontSize: 12,
            align: 'center',
            textZh: '可领取',
            textEn: 'Claim',
            visible: true
        }
    };
}

export function getDefaultUiLayoutConfig() {
    return {
        checkin: createDefaultCheckinLayout(),
        gameplay: createDefaultGameplayLayout(),
        home: createDefaultHomeLayout()
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

function mergeEditableText(defaultText, partialText) {
    return {
        x: readNumber(partialText?.x, defaultText.x),
        y: readNumber(partialText?.y, defaultText.y),
        width: readNumber(partialText?.width, defaultText.width),
        height: readNumber(partialText?.height, defaultText.height),
        fontSize: readNumber(partialText?.fontSize, defaultText.fontSize),
        align: `${partialText?.align || defaultText.align || 'center'}`.toLowerCase() === 'left' ? 'left' : 'center',
        textZh: readString(partialText?.textZh, defaultText.textZh),
        textEn: readString(partialText?.textEn, defaultText.textEn),
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

function normalizeLayerOrder(layerOrder, fallbackOrder) {
    const allowed = new Set(fallbackOrder);
    const seen = new Set();
    const normalized = [];

    if (Array.isArray(layerOrder)) {
        for (const rawId of layerOrder) {
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

function normalizeDeletedElements(deletedElements, fallbackOrder) {
    const allowed = new Set(fallbackOrder);
    const seen = new Set();
    const normalized = [];
    if (Array.isArray(deletedElements)) {
        for (const rawId of deletedElements) {
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

function normalizeCheckinLayout(layout) {
    const defaults = createDefaultCheckinLayout();
    const deletedElements = normalizeDeletedElements(layout?.deletedElements, defaults.layerOrder);
    const activeFallbackOrder = defaults.layerOrder.filter((id) => !deletedElements.includes(id));
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
        layerOrder: normalizeLayerOrder(layout?.layerOrder, activeFallbackOrder),
        deletedElements,
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
    const deletedElements = normalizeDeletedElements(layout?.deletedElements, defaults.layerOrder);
    const activeFallbackOrder = defaults.layerOrder.filter((id) => !deletedElements.includes(id));
    return {
        layerOrder: normalizeLayerOrder(layout?.layerOrder, activeFallbackOrder),
        deletedElements,
        hudTop: mergeRect(defaults.hudTop, layout?.hudTop),
        settingsButton: mergeRect(defaults.settingsButton, layout?.settingsButton),
        settingsIcon: mergeRect(defaults.settingsIcon, layout?.settingsIcon),
        coinChip: {
            ...mergeRect(defaults.coinChip, layout?.coinChip),
            fontSize: readNumber(layout?.coinChip?.fontSize, defaults.coinChip.fontSize)
        },
        coinIcon: mergeRect(defaults.coinIcon, layout?.coinIcon),
        coinValue: {
            x: readNumber(layout?.coinValue?.x, defaults.coinValue.x),
            y: readNumber(layout?.coinValue?.y, defaults.coinValue.y),
            width: readNumber(layout?.coinValue?.width, defaults.coinValue.width),
            fontSize: readNumber(layout?.coinValue?.fontSize, defaults.coinValue.fontSize),
            visible: readBool(layout?.coinValue?.visible, defaults.coinValue.visible)
        },
        center: mergeRect(defaults.center, layout?.center),
        lives: mergeRect(defaults.lives, layout?.lives),
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
        timerTrack: mergeRect(defaults.timerTrack, layout?.timerTrack),
        timerLabel: {
            x: readNumber(layout?.timerLabel?.x, defaults.timerLabel.x),
            y: readNumber(layout?.timerLabel?.y, defaults.timerLabel.y),
            width: readNumber(layout?.timerLabel?.width, defaults.timerLabel.width),
            fontSize: readNumber(layout?.timerLabel?.fontSize, defaults.timerLabel.fontSize),
            visible: readBool(layout?.timerLabel?.visible, defaults.timerLabel.visible)
        },
        combo: {
            ...mergeRect(defaults.combo, layout?.combo),
            fontSize: readNumber(layout?.combo?.fontSize, defaults.combo.fontSize)
        },
        comboCount: {
            x: readNumber(layout?.comboCount?.x, defaults.comboCount.x),
            y: readNumber(layout?.comboCount?.y, defaults.comboCount.y),
            width: readNumber(layout?.comboCount?.width, defaults.comboCount.width),
            fontSize: readNumber(layout?.comboCount?.fontSize, defaults.comboCount.fontSize),
            visible: readBool(layout?.comboCount?.visible, defaults.comboCount.visible)
        },
        comboLabel: {
            x: readNumber(layout?.comboLabel?.x, defaults.comboLabel.x),
            y: readNumber(layout?.comboLabel?.y, defaults.comboLabel.y),
            width: readNumber(layout?.comboLabel?.width, defaults.comboLabel.width),
            fontSize: readNumber(layout?.comboLabel?.fontSize, defaults.comboLabel.fontSize),
            visible: readBool(layout?.comboLabel?.visible, defaults.comboLabel.visible)
        },
        scorePulse: {
            ...mergeRect(defaults.scorePulse, layout?.scorePulse),
            valueFontSize: readNumber(layout?.scorePulse?.valueFontSize, defaults.scorePulse.valueFontSize),
            gainFontSize: readNumber(layout?.scorePulse?.gainFontSize, defaults.scorePulse.gainFontSize)
        },
        scoreValue: {
            x: readNumber(layout?.scoreValue?.x, defaults.scoreValue.x),
            y: readNumber(layout?.scoreValue?.y, defaults.scoreValue.y),
            width: readNumber(layout?.scoreValue?.width, defaults.scoreValue.width),
            fontSize: readNumber(layout?.scoreValue?.fontSize, defaults.scoreValue.fontSize),
            visible: readBool(layout?.scoreValue?.visible, defaults.scoreValue.visible)
        },
        scoreGain: {
            x: readNumber(layout?.scoreGain?.x, defaults.scoreGain.x),
            y: readNumber(layout?.scoreGain?.y, defaults.scoreGain.y),
            width: readNumber(layout?.scoreGain?.width, defaults.scoreGain.width),
            fontSize: readNumber(layout?.scoreGain?.fontSize, defaults.scoreGain.fontSize),
            visible: readBool(layout?.scoreGain?.visible, defaults.scoreGain.visible)
        }
    };
}

function normalizeHomeLayout(layout) {
    const defaults = createDefaultHomeLayout();
    const deletedElements = normalizeDeletedElements(layout?.deletedElements, defaults.layerOrder);
    const activeFallbackOrder = defaults.layerOrder.filter((id) => !deletedElements.includes(id));
    return {
        layerOrder: normalizeLayerOrder(layout?.layerOrder, activeFallbackOrder),
        deletedElements,
        homeBgPanelLarge: mergeRect(defaults.homeBgPanelLarge, layout?.homeBgPanelLarge),
        homeBgSnakeUp: mergeRect(defaults.homeBgSnakeUp, layout?.homeBgSnakeUp),
        homeBgSnakeDown: mergeRect(defaults.homeBgSnakeDown, layout?.homeBgSnakeDown),
        homeBgCavePanel: mergeRect(defaults.homeBgCavePanel, layout?.homeBgCavePanel),
        homeTitle: mergeRect(defaults.homeTitle, layout?.homeTitle),
        playArea: mergeRect(defaults.playArea, layout?.playArea),
        startButton: mergeRect(defaults.startButton, layout?.startButton),
        startButtonText: mergeEditableText(defaults.startButtonText, layout?.startButtonText),
        levelTag: mergeRect(defaults.levelTag, layout?.levelTag),
        levelTagLabel: mergeEditableText(defaults.levelTagLabel, layout?.levelTagLabel),
        levelTagValue: mergeEditableText(defaults.levelTagValue, layout?.levelTagValue),
        featurePanel: mergeRect(defaults.featurePanel, layout?.featurePanel),
        featureSettings: mergeRect(defaults.featureSettings, layout?.featureSettings),
        featureSettingsText: mergeEditableText(defaults.featureSettingsText, layout?.featureSettingsText),
        featureLeaderboard: mergeRect(defaults.featureLeaderboard, layout?.featureLeaderboard),
        featureLeaderboardText: mergeEditableText(defaults.featureLeaderboardText, layout?.featureLeaderboardText),
        featureSkins: mergeRect(defaults.featureSkins, layout?.featureSkins),
        featureSkinsText: mergeEditableText(defaults.featureSkinsText, layout?.featureSkinsText),
        featureCheckin: mergeRect(defaults.featureCheckin, layout?.featureCheckin),
        featureCheckinText: mergeEditableText(defaults.featureCheckinText, layout?.featureCheckinText),
        featureExit: mergeRect(defaults.featureExit, layout?.featureExit),
        featureExitText: mergeEditableText(defaults.featureExitText, layout?.featureExitText),
        featureSupportAuthor: mergeRect(defaults.featureSupportAuthor, layout?.featureSupportAuthor),
        featureSupportAuthorText: mergeEditableText(defaults.featureSupportAuthorText, layout?.featureSupportAuthorText),
        profileEntry: mergeRect(defaults.profileEntry, layout?.profileEntry),
        loginEntry: mergeRect(defaults.loginEntry, layout?.loginEntry),
        loginEntryText: mergeEditableText(defaults.loginEntryText, layout?.loginEntryText),
        coinChip: mergeRect(defaults.coinChip, layout?.coinChip),
        versionTag: mergeRect(defaults.versionTag, layout?.versionTag),
        mascot: mergeRect(defaults.mascot, layout?.mascot),
        onlineRewardDock: mergeRect(defaults.onlineRewardDock, layout?.onlineRewardDock),
        onlineRewardChest: mergeRect(defaults.onlineRewardChest, layout?.onlineRewardChest),
        onlineRewardText: mergeEditableText(defaults.onlineRewardText, layout?.onlineRewardText)
    };
}

export function normalizeUiLayoutConfig(config) {
    return {
        checkin: normalizeCheckinLayout(config?.checkin),
        gameplay: normalizeGameplayLayout(config?.gameplay),
        home: normalizeHomeLayout(config?.home)
    };
}

let uiLayoutState = normalizeUiLayoutConfig(readUiLayoutFromLocalStorage() || getDefaultUiLayoutConfig());
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
    persistUiLayoutToLocalStorage(normalized);
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
    persistUiLayoutToLocalStorage(defaults);
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
    const local = readUiLayoutFromLocalStorage();
    if (local) {
        return local;
    }
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

function readUiLayoutFromLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(UI_LAYOUT_LOCAL_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return isPlainObject(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function persistUiLayoutToLocalStorage(config) {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }
    try {
        window.localStorage.setItem(UI_LAYOUT_LOCAL_STORAGE_KEY, JSON.stringify(config));
        return true;
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

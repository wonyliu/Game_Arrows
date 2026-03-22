const DEFAULT_LOCALE = 'zh-CN';
const STORAGE_KEY = 'arrowClear_locale';

const DICTIONARY = {
    'zh-CN': {
        'app.title': '萌蛇洞穴大逃脱',
        'app.description': '点击释放可爱小蛇，清空洞穴迷宫。',
        'home.brandTop': '萌蛇',
        'home.brandBottom': '出发',
        'home.menuTitle': '蛇蛇大冒险',
        'home.heroTitle': '洞穴大厅',
        'home.heroSubtitle': '规划每一步，释放每一条小蛇。',
        'home.start': '开始冒险',
        'home.burrowEntry': '洞穴入口',
        'home.featuresTitle': '功能入口',
        'home.account': '探险档案',
        'home.accountSub': '离线大厅预览',
        'home.coin': '金币',
        'home.energy': '体力',
        'feature.settings': '设置',
        'feature.leaderboard': '排行榜',
        'feature.skins': '皮肤',
        'feature.checkin': '签到',
        'feature.exit': '退出',
        'feature.more': '功能入口',
        'panel.settings.title': '设置',
        'panel.settings.language': '语言',
        'panel.settings.languageDesc': '切换 UI 语言，不影响存档。',
        'panel.settings.audio': '音频',
        'panel.settings.audioDesc': '后续版本开放细项调节。',
        'panel.settings.music': '音乐',
        'panel.settings.sfx': '音效',
        'panel.settings.graphics': '画质',
        'panel.settings.graphicsDesc': '后续版本开放性能档位。',
        'panel.settings.graphicsLow': '低',
        'panel.settings.graphicsMid': '中',
        'panel.settings.graphicsHigh': '高',
        'panel.settings.reset': '重置进度',
        'panel.settings.resetDesc': '将关卡进度恢复到第一关。',
        'panel.leaderboard.title': '排行榜',
        'panel.leaderboard.empty': '排行榜功能开发中，敬请期待。',
        'panel.skins.title': '皮肤中心',
        'panel.skins.empty': '皮肤系统开发中，当前为占位卡片。',
        'panel.checkin.title': '每日签到',
        'panel.checkin.empty': '签到奖励开发中，后续接入服务端。',
        'panel.exit.title': '退出游戏',
        'panel.exit.desc': '确认退出当前游戏？进度会自动保存在本地。',
        'panel.exit.confirm': '确认退出',
        'panel.exit.cancel': '取消',
        'panel.exit.feedback': '当前环境通常无法由网页主动关闭窗口。',
        'panel.reset.title': '重置进度',
        'panel.reset.desc': '确认将关卡进度清零并从第一关重新开始吗？',
        'panel.reset.confirm': '确认重置',
        'panel.reset.cancel': '取消',
        'panel.levelSelect.title': '选择关卡',
        'panel.levelSelect.startFrom': '默认从以下关卡开始',
        'panel.levelSelect.tip': '可点击已解锁关卡直接进入游戏。',
        'panel.complete.title': '全部通关',
        'panel.over.title': '小蛇累了',
        'common.back': '返回',
        'common.close': '关闭',
        'common.next': '下一关',
        'common.retry': '再试一次',
        'common.menu': '返回菜单',
        'common.levelTag': '洞穴 {level}',
        'common.levelChip': '第{level}关',
        'common.score': '分数: {score}',
        'common.comingSoon': '开发中',
        'common.locked': '未解锁',
        'settings.locale.zh': '简体中文',
        'settings.locale.en': 'English'
    },
    'en-US': {
        'app.title': 'Snake Burrow Escape',
        'app.description': 'Tap snakes, clear the burrow maze, and escape.',
        'home.brandTop': 'Snake',
        'home.brandBottom': 'Launch',
        'home.menuTitle': 'Snake Adventure',
        'home.heroTitle': 'Burrow Lobby',
        'home.heroSubtitle': 'Plan every move and free every snake.',
        'home.start': 'Start Adventure',
        'home.burrowEntry': 'Burrow',
        'home.featuresTitle': 'Feature Hub',
        'home.account': 'Explorer Profile',
        'home.accountSub': 'Offline lobby preview',
        'home.coin': 'Coins',
        'home.energy': 'Energy',
        'feature.settings': 'Settings',
        'feature.leaderboard': 'Leaderboard',
        'feature.skins': 'Skins',
        'feature.checkin': 'Check-In',
        'feature.exit': 'Exit',
        'feature.more': 'More',
        'panel.settings.title': 'Settings',
        'panel.settings.language': 'Language',
        'panel.settings.languageDesc': 'Switch UI language without affecting save data.',
        'panel.settings.audio': 'Audio',
        'panel.settings.audioDesc': 'Detailed controls will be available in a future update.',
        'panel.settings.music': 'Music',
        'panel.settings.sfx': 'SFX',
        'panel.settings.graphics': 'Graphics',
        'panel.settings.graphicsDesc': 'Performance presets will be available in a future update.',
        'panel.settings.graphicsLow': 'Low',
        'panel.settings.graphicsMid': 'Mid',
        'panel.settings.graphicsHigh': 'High',
        'panel.settings.reset': 'Reset Progress',
        'panel.settings.resetDesc': 'Reset campaign progress back to level one.',
        'panel.leaderboard.title': 'Leaderboard',
        'panel.leaderboard.empty': 'Leaderboard is under development.',
        'panel.skins.title': 'Skin Center',
        'panel.skins.empty': 'Skin system is under development. Cards are placeholders.',
        'panel.checkin.title': 'Daily Check-In',
        'panel.checkin.empty': 'Reward flow is under development and will connect to backend later.',
        'panel.exit.title': 'Exit Game',
        'panel.exit.desc': 'Do you want to exit now? Progress is saved locally.',
        'panel.exit.confirm': 'Exit Now',
        'panel.exit.cancel': 'Cancel',
        'panel.exit.feedback': 'Most browsers cannot be closed directly by page script.',
        'panel.reset.title': 'Reset Progress',
        'panel.reset.desc': 'Reset your campaign progress and start from level one?',
        'panel.reset.confirm': 'Reset Now',
        'panel.reset.cancel': 'Cancel',
        'panel.levelSelect.title': 'Select Level',
        'panel.levelSelect.startFrom': 'Default start level',
        'panel.levelSelect.tip': 'Tap any unlocked level to enter directly.',
        'panel.complete.title': 'All Cleared',
        'panel.over.title': 'Snake Is Tired',
        'common.back': 'Back',
        'common.close': 'Close',
        'common.next': 'Next',
        'common.retry': 'Retry',
        'common.menu': 'Back to Menu',
        'common.levelTag': 'Burrow {level}',
        'common.levelChip': 'Lv {level}',
        'common.score': 'Score: {score}',
        'common.comingSoon': 'Coming Soon',
        'common.locked': 'Locked',
        'settings.locale.zh': '简体中文',
        'settings.locale.en': 'English'
    }
};

export function getSupportedLocales() {
    return Object.keys(DICTIONARY);
}

export function resolveLocale(locale) {
    if (!locale) return DEFAULT_LOCALE;
    if (DICTIONARY[locale]) return locale;

    const normalized = locale.toLowerCase();
    for (const candidate of getSupportedLocales()) {
        if (candidate.toLowerCase() === normalized) {
            return candidate;
        }
    }

    if (normalized.startsWith('zh')) return 'zh-CN';
    if (normalized.startsWith('en')) return 'en-US';
    return DEFAULT_LOCALE;
}

export function detectInitialLocale() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return resolveLocale(stored);
        }
    } catch {
        // Ignore storage access issues.
    }

    return resolveLocale(navigator.language || DEFAULT_LOCALE);
}

export function persistLocale(locale) {
    try {
        localStorage.setItem(STORAGE_KEY, locale);
    } catch {
        // Ignore storage access issues.
    }
}

export function t(locale, key, params = {}) {
    const resolved = resolveLocale(locale);
    const primary = DICTIONARY[resolved] || {};
    const fallback = DICTIONARY[DEFAULT_LOCALE] || {};

    let template = primary[key] || fallback[key] || key;
    for (const [name, value] of Object.entries(params)) {
        template = template.replace(new RegExp(`\\{${name}\\}`, 'g'), `${value}`);
    }

    return template;
}

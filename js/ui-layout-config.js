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

const panelText = (x, y, width, height, fontSize, textZh, textEn, align = 'center') => ({
    x,
    y,
    width,
    height,
    fontSize,
    align,
    textZh,
    textEn,
    visible: true
});

const panelRect = (x, y, width, height) => ({
    x,
    y,
    width,
    height,
    visible: true
});

export const PANEL_LAYOUT_DEFINITIONS = Object.freeze({
    levelComplete: Object.freeze({
        label: 'Level Complete',
        previewTitle: 'Level Complete Preview',
        previewPanel: 'levelComplete',
        defaultElementId: 'levelDoubleCoinButton',
        elements: Object.freeze([
            { id: 'levelCompleteBox', label: 'Popup Box' },
            { id: 'levelCompleteTitle', label: 'Title' },
            { id: 'levelPerfectStamp', label: 'Perfect Stamp' },
            { id: 'levelScore', label: 'Score Row' },
            { id: 'levelScoreLabel', label: 'Score Label' },
            { id: 'levelScoreValue', label: 'Score Value' },
            { id: 'levelScoreMultiplier', label: 'Multiplier' },
            { id: 'levelBestCombo', label: 'Combo Row' },
            { id: 'levelBestComboLabel', label: 'Combo Label' },
            { id: 'levelBestComboValue', label: 'Combo Value' },
            { id: 'levelCoinReward', label: 'Coin Reward' },
            { id: 'levelCompleteButtons', label: 'Button Group' },
            { id: 'levelDoubleCoinButton', label: 'Double Coin Button' },
            { id: 'levelNextButton', label: 'Next Button' }
        ]),
        defaults: Object.freeze({
            levelCompleteBox: panelRect(42, 306, 346, 360),
            levelCompleteTitle: panelText(52, 30, 170, 54, 34, '\u606d\u559c\u8fc7\u5173', 'Level Clear'),
            levelPerfectStamp: panelText(214, 20, 120, 64, 28, '\u5b8c\u7f8e', 'PERFECT'),
            levelScore: panelRect(78, 104, 210, 56),
            levelScoreLabel: panelText(0, 14, 70, 28, 23, '\u5206\u6570', 'Score'),
            levelScoreValue: panelText(78, 0, 92, 48, 44, '360', '360'),
            levelScoreMultiplier: panelText(172, 14, 70, 28, 24, 'x1.50', 'x1.50'),
            levelBestCombo: panelRect(110, 160, 160, 34),
            levelBestComboLabel: panelText(0, 4, 100, 24, 18, '\u6700\u9ad8\u8fde\u51fb', 'Best Combo'),
            levelBestComboValue: panelText(110, 0, 44, 32, 32, '4', '4'),
            levelCoinReward: panelText(84, 198, 180, 28, 18, '\u91d1\u5e01 +1\uff08\u603b\u8ba1 1\uff09', 'Coins +1 (Total 1)'),
            levelCompleteButtons: panelRect(28, 228, 290, 116),
            levelDoubleCoinButton: panelText(0, 0, 290, 52, 22, '\u770b\u5e7f\u544a\u53cc\u500d\u91d1\u5e01', 'Watch Ad for Double Coins'),
            levelNextButton: panelText(0, 64, 290, 52, 24, '\u4e0b\u4e00\u5173', 'Next')
        })
    }),
    gameOver: Object.freeze({
        label: 'Game Over',
        previewTitle: 'Game Over Preview',
        previewPanel: 'gameOver',
        defaultElementId: 'gameOverContinueButton',
        elements: Object.freeze([
            { id: 'gameOverBox', label: 'Popup Box' },
            { id: 'gameOverTitle', label: 'Title' },
            { id: 'gameOverReason', label: 'Reason' },
            { id: 'gameOverButtons', label: 'Button Group' },
            { id: 'gameOverContinueButton', label: 'Continue Ad Button' },
            { id: 'gameOverRetryButton', label: 'Retry Button' },
            { id: 'gameOverMenuButton', label: 'Menu Button' }
        ]),
        defaults: Object.freeze({
            gameOverBox: panelRect(46, 322, 338, 286),
            gameOverTitle: panelText(36, 28, 266, 48, 34, '\u5c0f\u86c7\u7d2f\u4e86', 'Snake Is Tired'),
            gameOverReason: panelText(42, 92, 254, 44, 24, '\u65f6\u95f4\u5230', 'Time is up'),
            gameOverButtons: panelRect(32, 150, 274, 116),
            gameOverContinueButton: panelText(0, 0, 274, 48, 22, '\u770b\u5e7f\u544a\u7ee7\u7eed', 'Watch Ad to Continue'),
            gameOverRetryButton: panelText(0, 58, 132, 48, 22, '\u518d\u8bd5\u4e00\u6b21', 'Retry'),
            gameOverMenuButton: panelText(142, 58, 132, 48, 20, '\u8fd4\u56de\u83dc\u5355', 'Menu')
        })
    }),
    supportAuthor: Object.freeze({
        label: 'Support Author',
        previewTitle: 'Support Author Preview',
        previewPanel: 'supportAuthor',
        menuPanel: 'SUPPORT_AUTHOR',
        defaultElementId: 'supportAuthorWatchButton',
        elements: Object.freeze([
            { id: 'supportAuthorShell', label: 'Panel Shell' },
            { id: 'supportAuthorTitle', label: 'Title' },
            { id: 'supportAuthorBack', label: 'Back Button' },
            { id: 'supportAuthorThankYou', label: 'Thank You Text' },
            { id: 'supportAuthorCounter', label: 'Progress Row' },
            { id: 'supportAuthorCounterLabel', label: 'Progress Label' },
            { id: 'supportAuthorCount', label: 'Progress Count' },
            { id: 'supportAuthorBadge', label: 'Badge Row' },
            { id: 'supportAuthorBadgeLabel', label: 'Badge Label' },
            { id: 'supportAuthorBadgeCount', label: 'Badge Count' },
            { id: 'supportAuthorWatchButton', label: 'Watch Ad Button' },
            { id: 'supportAuthorStatus', label: 'Status Text' }
        ]),
        defaults: Object.freeze({
            supportAuthorShell: panelRect(39, 138, 352, 430),
            supportAuthorTitle: panelText(24, 24, 220, 76, 36, '\u652f\u6301\u4f5c\u8005', 'Support Author', 'left'),
            supportAuthorBack: panelText(252, 38, 76, 48, 22, '\u8fd4\u56de', 'Back'),
            supportAuthorThankYou: panelText(24, 122, 304, 70, 18, '\u611f\u8c22\u4f60\u7684\u652f\u6301\uff0c\u8fd9\u4f1a\u5e2e\u52a9\u6211\u4eec\u6301\u7eed\u66f4\u65b0\u6e38\u620f\u5185\u5bb9\u3002', 'Thank you for your support. It helps us keep improving the game.', 'left'),
            supportAuthorCounter: panelRect(24, 202, 304, 56),
            supportAuthorCounterLabel: panelText(16, 8, 210, 36, 18, '\u4eca\u65e5\u652f\u6301\u8fdb\u5ea6', 'Today Support Progress', 'left'),
            supportAuthorCount: panelText(236, 6, 52, 40, 28, '0/5', '0/5'),
            supportAuthorBadge: panelRect(24, 268, 304, 56),
            supportAuthorBadgeLabel: panelText(16, 8, 210, 36, 18, '\u652f\u6301\u5956\u7ae0', 'Support Badges', 'left'),
            supportAuthorBadgeCount: panelText(236, 6, 52, 40, 28, '0', '0'),
            supportAuthorWatchButton: panelText(24, 334, 304, 58, 27, '\u64ad\u653e\u652f\u6301\u5e7f\u544a', 'Watch Support Ad'),
            supportAuthorStatus: panelText(24, 398, 304, 24, 14, '', '')
        })
    }),
    settings: Object.freeze({
        label: 'Settings',
        previewTitle: 'Settings Preview',
        previewPanel: 'settings',
        menuPanel: 'SETTINGS',
        defaultElementId: 'settingsTitle',
        elements: Object.freeze([
            { id: 'settingsShell', label: 'Panel Shell' },
            { id: 'settingsTitle', label: 'Title' },
            { id: 'settingsBack', label: 'Back Button' },
            { id: 'settingsBody', label: 'Body' },
            { id: 'settingsLanguageRow', label: 'Language Row' },
            { id: 'settingsLanguageTitle', label: 'Language Title' },
            { id: 'settingsLanguageDesc', label: 'Language Desc' },
            { id: 'settingsLocaleZh', label: 'Chinese Button' },
            { id: 'settingsLocaleEn', label: 'English Button' },
            { id: 'settingsAudioRow', label: 'Audio Row' },
            { id: 'settingsAudioTitle', label: 'Audio Title' },
            { id: 'settingsAudioDesc', label: 'Audio Desc' },
            { id: 'settingsResetRow', label: 'Reset Row' },
            { id: 'settingsResetButton', label: 'Reset Button' },
            { id: 'settingsEndRunRow', label: 'End Run Row' },
            { id: 'settingsEndRunButton', label: 'End Run Button' }
        ]),
        defaults: Object.freeze({
            settingsShell: panelRect(29, 82, 372, 720),
            settingsTitle: panelText(24, 24, 220, 48, 32, '\u8bbe\u7f6e', 'Settings', 'left'),
            settingsBack: panelText(276, 28, 72, 42, 20, '\u8fd4\u56de', 'Back'),
            settingsBody: panelRect(24, 92, 324, 592),
            settingsLanguageRow: panelRect(0, 0, 324, 132),
            settingsLanguageTitle: panelText(0, 0, 150, 28, 20, '\u8bed\u8a00', 'Language', 'left'),
            settingsLanguageDesc: panelText(0, 34, 210, 42, 13, '\u5207\u6362\u754c\u9762\u8bed\u8a00', 'Switch UI language', 'left'),
            settingsLocaleZh: panelText(216, 12, 96, 38, 15, '\u7b80\u4f53\u4e2d\u6587', 'Chinese'),
            settingsLocaleEn: panelText(216, 58, 96, 38, 15, 'English', 'English'),
            settingsAudioRow: panelRect(0, 144, 324, 164),
            settingsAudioTitle: panelText(0, 0, 150, 28, 20, '\u97f3\u9891', 'Audio', 'left'),
            settingsAudioDesc: panelText(0, 34, 280, 42, 13, '\u8c03\u6574\u97f3\u4e50\u548c\u97f3\u6548\u97f3\u91cf', 'Adjust music and SFX volume', 'left'),
            settingsResetRow: panelRect(0, 326, 324, 92),
            settingsResetButton: panelText(196, 20, 112, 42, 17, '\u91cd\u7f6e', 'Reset'),
            settingsEndRunRow: panelRect(0, 432, 324, 92),
            settingsEndRunButton: panelText(196, 20, 112, 42, 17, '\u7ed3\u675f', 'End')
        })
    }),
    leaderboard: Object.freeze({
        label: 'Leaderboard',
        previewTitle: 'Leaderboard Preview',
        previewPanel: 'leaderboard',
        menuPanel: 'LEADERBOARD',
        defaultElementId: 'leaderboardList',
        elements: Object.freeze([
            { id: 'leaderboardShell', label: 'Panel Shell' },
            { id: 'leaderboardTitle', label: 'Title' },
            { id: 'leaderboardBack', label: 'Back Button' },
            { id: 'leaderboardBody', label: 'Body' },
            { id: 'leaderboardModeSwitch', label: 'Mode Switch' },
            { id: 'leaderboardModeClear', label: 'Clear Rank Button' },
            { id: 'leaderboardModeBadge', label: 'Badge Rank Button' },
            { id: 'leaderboardList', label: 'Rank List' },
            { id: 'leaderboardSelfSection', label: 'My Rank Section' },
            { id: 'leaderboardSelfLabel', label: 'My Rank Label' },
            { id: 'leaderboardEmptyState', label: 'Empty State' }
        ]),
        defaults: Object.freeze({
            leaderboardShell: panelRect(30, 58, 370, 822),
            leaderboardTitle: panelText(24, 20, 220, 46, 32, '\u6392\u884c\u699c', 'Leaderboard', 'left'),
            leaderboardBack: panelText(276, 22, 72, 42, 20, '\u8fd4\u56de', 'Back'),
            leaderboardBody: panelRect(22, 82, 326, 704),
            leaderboardModeSwitch: panelRect(0, 0, 326, 54),
            leaderboardModeClear: panelText(0, 0, 158, 46, 18, '\u901a\u5173\u699c', 'Clear Rank'),
            leaderboardModeBadge: panelText(168, 0, 158, 46, 18, '\u5956\u7ae0\u699c', 'Badge Rank'),
            leaderboardList: panelRect(0, 66, 326, 520),
            leaderboardSelfSection: panelRect(0, 596, 326, 96),
            leaderboardSelfLabel: panelText(0, 0, 326, 28, 16, '\u6211\u7684\u6392\u540d', 'My Rank', 'left'),
            leaderboardEmptyState: panelText(0, 260, 326, 42, 16, '\u6682\u65e0\u6570\u636e', 'No data')
        })
    }),
    skins: Object.freeze({
        label: 'Skins',
        previewTitle: 'Skins Preview',
        previewPanel: 'skins',
        menuPanel: 'SKINS',
        defaultElementId: 'skinList',
        elements: Object.freeze([
            { id: 'skinsShell', label: 'Panel Shell' },
            { id: 'skinsTitle', label: 'Title' },
            { id: 'skinsBack', label: 'Back Button' },
            { id: 'skinsBody', label: 'Body' },
            { id: 'skinsCoinPill', label: 'Coin Pill' },
            { id: 'skinsRateValue', label: 'Rate Text' },
            { id: 'skinList', label: 'Skin Grid' },
            { id: 'skinCard', label: 'Skin Card Template' },
            { id: 'skinPreview', label: 'Skin Preview' },
            { id: 'skinName', label: 'Skin Name' },
            { id: 'skinDesc', label: 'Skin Description' },
            { id: 'skinStatus', label: 'Skin Status' },
            { id: 'skinActionButton', label: 'Skin Action Button' }
        ]),
        defaults: Object.freeze({
            skinsShell: panelRect(30, 70, 370, 800),
            skinsTitle: panelText(24, 22, 220, 46, 32, '\u76ae\u80a4', 'Skins', 'left'),
            skinsBack: panelText(276, 24, 72, 42, 20, '\u8fd4\u56de', 'Back'),
            skinsBody: panelRect(22, 84, 326, 676),
            skinsCoinPill: panelRect(0, 0, 120, 38),
            skinsRateValue: panelText(138, 4, 188, 30, 14, '', '', 'left'),
            skinList: panelRect(0, 52, 326, 612),
            skinCard: panelRect(0, 0, 308, 90),
            skinPreview: panelRect(8, 13, 64, 64),
            skinName: panelText(82, 10, 122, 22, 15, '\u76ae\u80a4\u540d\u79f0', 'Skin Name', 'left'),
            skinDesc: panelText(82, 32, 122, 34, 11, '\u76ae\u80a4\u63cf\u8ff0', 'Skin description', 'left'),
            skinStatus: panelText(82, 66, 122, 16, 11, '\u5df2\u89e3\u9501', 'Unlocked', 'left'),
            skinActionButton: panelText(214, 27, 92, 36, 12, '\u88c5\u5907', 'Use')
        })
    }),
    profile: Object.freeze({
        label: 'Profile',
        previewTitle: 'Profile Preview',
        previewPanel: 'profile',
        menuPanel: 'PROFILE',
        defaultElementId: 'profileNicknameField',
        elements: Object.freeze([
            { id: 'profileShell', label: 'Panel Shell' },
            { id: 'profileTitle', label: 'Title' },
            { id: 'profileBack', label: 'Back Button' },
            { id: 'profileUserMeta', label: 'User Meta' },
            { id: 'profileNicknameField', label: 'Nickname Field' },
            { id: 'profilePasswordField', label: 'Password Field' },
            { id: 'profilePasswordConfirmField', label: 'Confirm Field' },
            { id: 'profileSaveButton', label: 'Save Button' },
            { id: 'profileStatus', label: 'Status Text' }
        ]),
        defaults: Object.freeze({
            profileShell: panelRect(39, 142, 352, 430),
            profileTitle: panelText(24, 24, 220, 48, 32, '\u4e2a\u4eba\u8d44\u6599', 'Profile', 'left'),
            profileBack: panelText(252, 28, 76, 42, 20, '\u8fd4\u56de', 'Back'),
            profileUserMeta: panelText(24, 92, 304, 30, 14, 'ID: -', 'ID: -', 'left'),
            profileNicknameField: panelRect(24, 132, 304, 58),
            profilePasswordField: panelRect(24, 202, 304, 58),
            profilePasswordConfirmField: panelRect(24, 272, 304, 58),
            profileSaveButton: panelText(24, 346, 304, 54, 22, '\u4fdd\u5b58\u8d44\u6599', 'Save'),
            profileStatus: panelText(24, 402, 304, 24, 14, '', '')
        })
    }),
    levelSelect: Object.freeze({
        label: 'Level Select',
        previewTitle: 'Level Select Preview',
        previewPanel: 'levelSelect',
        menuPanel: 'LEVEL_SELECT',
        defaultElementId: 'levelGrid',
        elements: Object.freeze([
            { id: 'levelSelectShell', label: 'Panel Shell' },
            { id: 'levelSelectTitle', label: 'Title' },
            { id: 'levelSelectBack', label: 'Back Button' },
            { id: 'levelSelectBody', label: 'Body' },
            { id: 'levelSelectMeta', label: 'Meta' },
            { id: 'levelSelectLabel', label: 'Start Label' },
            { id: 'levelSelectCurrent', label: 'Current Level' },
            { id: 'levelSelectTip', label: 'Tip' },
            { id: 'levelGrid', label: 'Level Grid' }
        ]),
        defaults: Object.freeze({
            levelSelectShell: panelRect(30, 68, 370, 800),
            levelSelectTitle: panelText(24, 22, 220, 46, 32, '\u9009\u62e9\u5173\u5361', 'Select Level', 'left'),
            levelSelectBack: panelText(276, 24, 72, 42, 20, '\u8fd4\u56de', 'Back'),
            levelSelectBody: panelRect(22, 84, 326, 676),
            levelSelectMeta: panelRect(0, 0, 326, 96),
            levelSelectLabel: panelText(14, 12, 190, 24, 15, '\u9ed8\u8ba4\u4ece\u4ee5\u4e0b\u5173\u5361\u5f00\u59cb', 'Start from', 'left'),
            levelSelectCurrent: panelText(214, 8, 96, 32, 20, '\u6d1e\u7a74 1', 'Burrow 1'),
            levelSelectTip: panelText(14, 50, 296, 32, 13, '\u53ef\u70b9\u51fb\u5df2\u89e3\u9501\u5173\u5361\u76f4\u63a5\u8fdb\u5165\u6e38\u620f\u3002', 'Tap an unlocked level to play.', 'left'),
            levelGrid: panelRect(0, 112, 326, 544)
        })
    }),
    exitConfirm: Object.freeze({
        label: 'Exit Confirm',
        previewTitle: 'Exit Confirm Preview',
        previewPanel: 'exitConfirm',
        menuPanel: 'EXIT_CONFIRM',
        defaultElementId: 'exitConfirmButton',
        elements: Object.freeze([
            { id: 'exitShell', label: 'Panel Shell' },
            { id: 'exitTitle', label: 'Title' },
            { id: 'exitBack', label: 'Close Button' },
            { id: 'exitDesc', label: 'Description' },
            { id: 'exitActions', label: 'Actions' },
            { id: 'exitConfirmButton', label: 'Confirm Button' },
            { id: 'exitCancelButton', label: 'Cancel Button' },
            { id: 'exitFeedback', label: 'Feedback' }
        ]),
        defaults: Object.freeze({
            exitShell: panelRect(39, 218, 352, 310),
            exitTitle: panelText(24, 24, 220, 46, 32, '\u9000\u51fa\u6e38\u620f', 'Exit Game', 'left'),
            exitBack: panelText(252, 26, 76, 42, 20, '\u5173\u95ed', 'Close'),
            exitDesc: panelText(24, 94, 304, 70, 18, '\u73b0\u5728\u9000\u51fa\u5417\uff1f\u8fdb\u5ea6\u5df2\u5728\u672c\u5730\u4fdd\u5b58\u3002', 'Exit now? Progress is saved locally.', 'left'),
            exitActions: panelRect(24, 178, 304, 58),
            exitConfirmButton: panelText(0, 0, 146, 52, 20, '\u7acb\u5373\u9000\u51fa', 'Exit Now'),
            exitCancelButton: panelText(158, 0, 146, 52, 20, '\u53d6\u6d88', 'Cancel'),
            exitFeedback: panelText(24, 248, 304, 30, 13, '\u591a\u6570\u6d4f\u89c8\u5668\u4e0d\u5141\u8bb8\u76f4\u63a5\u5173\u95ed\u9875\u9762\u3002', 'Most browsers cannot be closed by script.')
        })
    }),
    resetProgress: Object.freeze({
        label: 'Reset Progress',
        previewTitle: 'Reset Progress Preview',
        previewPanel: 'resetProgress',
        menuPanel: 'RESET_PROGRESS_CONFIRM',
        defaultElementId: 'resetProgressConfirmButton',
        elements: Object.freeze([
            { id: 'resetProgressShell', label: 'Panel Shell' },
            { id: 'resetProgressTitle', label: 'Title' },
            { id: 'resetProgressBack', label: 'Close Button' },
            { id: 'resetProgressDesc', label: 'Description' },
            { id: 'resetProgressActions', label: 'Actions' },
            { id: 'resetProgressConfirmButton', label: 'Confirm Button' },
            { id: 'resetProgressCancelButton', label: 'Cancel Button' }
        ]),
        defaults: Object.freeze({
            resetProgressShell: panelRect(39, 218, 352, 310),
            resetProgressTitle: panelText(24, 24, 220, 46, 30, '\u91cd\u7f6e\u8fdb\u5ea6', 'Reset Progress', 'left'),
            resetProgressBack: panelText(252, 26, 76, 42, 20, '\u5173\u95ed', 'Close'),
            resetProgressDesc: panelText(24, 94, 304, 70, 18, '\u91cd\u7f6e\u5173\u5361\u8fdb\u5ea6\u5e76\u4ece\u7b2c\u4e00\u5173\u5f00\u59cb\uff1f', 'Reset campaign progress and start from level one?', 'left'),
            resetProgressActions: panelRect(24, 178, 304, 58),
            resetProgressConfirmButton: panelText(0, 0, 146, 52, 20, '\u786e\u8ba4\u91cd\u7f6e', 'Reset Now'),
            resetProgressCancelButton: panelText(158, 0, 146, 52, 20, '\u53d6\u6d88', 'Cancel')
        })
    }),
    checkinRewardSettle: Object.freeze({
        label: 'Check-in Reward',
        previewTitle: 'Check-in Reward Preview',
        previewPanel: 'checkinRewardSettle',
        defaultElementId: 'checkinRewardConfirm',
        elements: Object.freeze([
            { id: 'checkinRewardShell', label: 'Panel Shell' },
            { id: 'checkinRewardTitle', label: 'Title' },
            { id: 'checkinRewardDesc', label: 'Description' },
            { id: 'checkinRewardCoinHero', label: 'Coin Hero' },
            { id: 'checkinRewardList', label: 'Reward List' },
            { id: 'checkinRewardActions', label: 'Actions' },
            { id: 'checkinRewardConfirm', label: 'Confirm Button' }
        ]),
        defaults: Object.freeze({
            checkinRewardShell: panelRect(39, 182, 352, 360),
            checkinRewardTitle: panelText(24, 24, 304, 46, 30, '\u7b7e\u5230\u5956\u52b1', 'Check-in Reward', 'left'),
            checkinRewardDesc: panelText(24, 84, 304, 42, 18, '\u7b7e\u5230\u6210\u529f\uff0c\u5956\u52b1\u5982\u4e0b\uff1a', 'Claimed rewards:', 'left'),
            checkinRewardCoinHero: panelRect(84, 134, 184, 70),
            checkinRewardList: panelRect(24, 214, 304, 58),
            checkinRewardActions: panelRect(24, 286, 304, 52),
            checkinRewardConfirm: panelText(60, 0, 184, 52, 22, '\u786e\u5b9a', 'OK')
        })
    }),
    onlineRewardSettle: Object.freeze({
        label: 'Online Reward',
        previewTitle: 'Online Reward Preview',
        previewPanel: 'onlineRewardSettle',
        defaultElementId: 'onlineRewardSettleClose',
        elements: Object.freeze([
            { id: 'onlineRewardShell', label: 'Panel Shell' },
            { id: 'onlineRewardTitle', label: 'Title' },
            { id: 'onlineRewardCloseTop', label: 'Top Close' },
            { id: 'onlineRewardDesc', label: 'Description' },
            { id: 'onlineRewardList', label: 'Reward List' },
            { id: 'onlineRewardActions', label: 'Actions' },
            { id: 'onlineRewardSettleClose', label: 'Close Button' }
        ]),
        defaults: Object.freeze({
            onlineRewardShell: panelRect(39, 192, 352, 340),
            onlineRewardTitle: panelText(24, 24, 220, 46, 30, '\u5728\u7ebf\u5956\u52b1', 'Online Reward', 'left'),
            onlineRewardCloseTop: panelText(252, 26, 76, 42, 20, '\u5173\u95ed', 'Close'),
            onlineRewardDesc: panelText(24, 86, 304, 42, 18, '\u672c\u6b21\u9886\u53d6\uff1a', 'Claimed:', 'left'),
            onlineRewardList: panelRect(24, 140, 304, 104),
            onlineRewardActions: panelRect(24, 260, 304, 52),
            onlineRewardSettleClose: panelText(60, 0, 184, 52, 22, '\u786e\u5b9a', 'OK')
        })
    })
});

export const PANEL_LAYOUT_SCENE_IDS = Object.freeze(Object.keys(PANEL_LAYOUT_DEFINITIONS));

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
            visible: false
        },
        homeBgSnakeDown: {
            x: 224,
            y: 274,
            width: 154,
            height: 95,
            visible: false
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
        home: createDefaultHomeLayout(),
        ...createDefaultPanelLayouts()
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

function createDefaultPanelLayout(sceneId) {
    const definition = PANEL_LAYOUT_DEFINITIONS[sceneId];
    if (!definition) {
        return null;
    }
    const elementIds = definition.elements.map((item) => item.id);
    return {
        layerOrder: copyLayerOrder(elementIds),
        deletedElements: [],
        ...clone(definition.defaults || {})
    };
}

function createDefaultPanelLayouts() {
    const layouts = {};
    for (const sceneId of PANEL_LAYOUT_SCENE_IDS) {
        layouts[sceneId] = createDefaultPanelLayout(sceneId);
    }
    return layouts;
}

function mergePanelElement(defaultValue, partialValue) {
    if (!defaultValue || typeof defaultValue !== 'object') {
        return {};
    }
    const base = {
        x: readNumber(partialValue?.x, defaultValue.x),
        y: readNumber(partialValue?.y, defaultValue.y),
        visible: readBool(partialValue?.visible, defaultValue.visible ?? true)
    };
    if ('width' in defaultValue) {
        base.width = readNumber(partialValue?.width, defaultValue.width);
    }
    if ('height' in defaultValue) {
        base.height = readNumber(partialValue?.height, defaultValue.height);
    }
    if ('fontSize' in defaultValue) {
        base.fontSize = readNumber(partialValue?.fontSize, defaultValue.fontSize);
    }
    if ('align' in defaultValue || 'textZh' in defaultValue || 'textEn' in defaultValue) {
        const align = `${partialValue?.align || defaultValue.align || 'center'}`.toLowerCase();
        base.align = align === 'left' ? 'left' : 'center';
    }
    if ('textZh' in defaultValue) {
        base.textZh = readString(partialValue?.textZh, defaultValue.textZh);
    }
    if ('textEn' in defaultValue) {
        base.textEn = readString(partialValue?.textEn, defaultValue.textEn);
    }
    return base;
}

function normalizePanelLayout(sceneId, layout) {
    const defaults = createDefaultPanelLayout(sceneId);
    const definition = PANEL_LAYOUT_DEFINITIONS[sceneId];
    if (!defaults || !definition) {
        return null;
    }
    const fallbackOrder = definition.elements.map((item) => item.id);
    const deletedElements = normalizeDeletedElements(layout?.deletedElements, fallbackOrder);
    const activeFallbackOrder = fallbackOrder.filter((id) => !deletedElements.includes(id));
    const normalized = {
        layerOrder: normalizeLayerOrder(layout?.layerOrder, activeFallbackOrder),
        deletedElements
    };
    for (const elementId of fallbackOrder) {
        normalized[elementId] = mergePanelElement(defaults[elementId], layout?.[elementId]);
    }
    return normalized;
}

function normalizePanelLayouts(config) {
    const layouts = {};
    for (const sceneId of PANEL_LAYOUT_SCENE_IDS) {
        layouts[sceneId] = normalizePanelLayout(sceneId, config?.[sceneId]);
    }
    return layouts;
}

export function normalizeUiLayoutConfig(config) {
    return {
        checkin: normalizeCheckinLayout(config?.checkin),
        gameplay: normalizeGameplayLayout(config?.gameplay),
        home: normalizeHomeLayout(config?.home),
        ...normalizePanelLayouts(config)
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

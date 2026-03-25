const DEFAULT_SKIN_ID = 'classic-burrow';

export const SCORE_PER_COIN = 1000;
export const DEFAULT_UNLOCKED_SKINS = Object.freeze([DEFAULT_SKIN_ID]);

const SKIN_CATALOG = Object.freeze([
    Object.freeze({
        id: DEFAULT_SKIN_ID,
        coinCost: 0,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'classic-moss', hueShift: 0, saturation: 1.32, lightness: 1.03, contrast: 1.04 }),
            Object.freeze({ id: 'classic-amber', hueShift: -34, saturation: 1.38, lightness: 1.02, contrast: 1.05 }),
            Object.freeze({ id: 'classic-mint', hueShift: 58, saturation: 1.35, lightness: 1.03, contrast: 1.04 }),
            Object.freeze({ id: 'classic-sky', hueShift: 102, saturation: 1.33, lightness: 1.04, contrast: 1.03 }),
            Object.freeze({ id: 'classic-berry', hueShift: 138, saturation: 1.34, lightness: 1.03, contrast: 1.03 }),
            Object.freeze({ id: 'classic-coral', hueShift: -68, saturation: 1.36, lightness: 1.02, contrast: 1.04 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(37, 23, 14, 0.24)',
            segmentShadowBlur: 2.6,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(37, 23, 14, 0.30)',
            headShadowBlur: 3.4,
            headShadowOffsetY: 1
        }),
        preview: 'assets/design-v4/clean/snake_head.png',
        name: Object.freeze({
            'zh-CN': '\u6d1e\u7a74\u7ecf\u5178',
            'en-US': 'Burrow Classic'
        }),
        description: Object.freeze({
            'zh-CN': '\u9ed8\u8ba4\u5916\u89c2\uff0c\u62e5\u6709\u968f\u673a\u8272\u8c03\u53d8\u5316\u3002',
            'en-US': 'Default look with per-line hue variation.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/design-v4/clean/snake_head.png',
            snakeHeadCurious: 'assets/design-v4/clean/snake_head_curious_r2.png',
            snakeHeadSleepy: 'assets/design-v4/clean/snake_head_sleepy_r2.png',
            snakeHeadSurprised: 'assets/design-v4/clean/snake_head_surprised_r2.png',
            snakeSegA: 'assets/design-v4/clean/snake_seg_a.png',
            snakeSegB: 'assets/design-v4/clean/snake_seg_b.png',
            snakeTailBase: 'assets/design-v4/clean/snake_tail_base.png',
            snakeTailTip: 'assets/design-v4/clean/snake_tail_tip.png'
        })
    }),
    Object.freeze({
        id: 'gemini-candy',
        coinCost: 18,
        allowHueVariants: false,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'candy-strawberry', hueShift: -18, saturation: 1.58, lightness: 1.01, contrast: 1.10 }),
            Object.freeze({ id: 'candy-peach', hueShift: -38, saturation: 1.54, lightness: 1.02, contrast: 1.09 }),
            Object.freeze({ id: 'candy-lemon', hueShift: -58, saturation: 1.52, lightness: 1.03, contrast: 1.08 }),
            Object.freeze({ id: 'candy-mint', hueShift: 92, saturation: 1.46, lightness: 1.02, contrast: 1.09 }),
            Object.freeze({ id: 'candy-sky', hueShift: 126, saturation: 1.48, lightness: 1.02, contrast: 1.08 }),
            Object.freeze({ id: 'candy-grape', hueShift: 28, saturation: 1.50, lightness: 1.01, contrast: 1.10 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(45, 25, 63, 0.34)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(45, 25, 63, 0.40)',
            headShadowBlur: 4.2,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1.08, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1.08, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1.18, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/gemini-candy/snake_head.png',
        name: Object.freeze({
            'zh-CN': '\u7cd6\u679c\u6591\u70b9\u86c7',
            'en-US': 'Candy Spots'
        }),
        description: Object.freeze({
            'zh-CN': '\u9a6c\u5361\u9f99\u7cd6\u679c\u6591\u70b9\u4e3b\u9898\uff0c\u68cb\u76d8\u5185\u53ef\u51fa\u73b0\u591a\u8272\u7cd6\u679c\u7cfb\u86c7\u4f53\u3002',
            'en-US': 'Pastel candy-dot theme with multi-color candy variants across the board.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/gemini-candy/snake_head.png',
            snakeHeadCurious: 'assets/skins/gemini-candy/snake_head_curious.png',
            snakeHeadSleepy: 'assets/skins/gemini-candy/snake_head_sleepy.png',
            snakeHeadSurprised: 'assets/skins/gemini-candy/snake_head_surprised.png',
            snakeSegA: 'assets/skins/gemini-candy/snake_seg_a.png',
            snakeSegB: 'assets/skins/gemini-candy/snake_seg_b.png',
            snakeTailBase: 'assets/skins/gemini-candy/snake_tail_base.png',
            snakeTailTip: 'assets/skins/gemini-candy/snake_tail_tip.png'
        })
    }),
    Object.freeze({
        id: 'candy-dream',
        coinCost: 28,
        allowHueVariants: false,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'dream-rose', hueShift: -12, saturation: 1.56, lightness: 1.02, contrast: 1.10 }),
            Object.freeze({ id: 'dream-mango', hueShift: -42, saturation: 1.54, lightness: 1.03, contrast: 1.09 }),
            Object.freeze({ id: 'dream-lemon', hueShift: -62, saturation: 1.50, lightness: 1.04, contrast: 1.08 }),
            Object.freeze({ id: 'dream-mint', hueShift: 84, saturation: 1.46, lightness: 1.03, contrast: 1.09 }),
            Object.freeze({ id: 'dream-sky', hueShift: 118, saturation: 1.48, lightness: 1.03, contrast: 1.08 }),
            Object.freeze({ id: 'dream-lilac', hueShift: 20, saturation: 1.52, lightness: 1.02, contrast: 1.10 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(45, 25, 63, 0.34)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(45, 25, 63, 0.40)',
            headShadowBlur: 4.2,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1.22, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1.08, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1.08, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1.18, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/candy-dream/snake_head.png',
        name: Object.freeze({
            'zh-CN': '\u7cd6\u8c46\u68a6\u5883\u86c7',
            'en-US': 'Candy Dream'
        }),
        description: Object.freeze({
            'zh-CN': '\u7cd6\u8c46\u5f69\u70b9 + \u5927\u773c\u840c\u989c\u98ce\u683c\uff0c\u6574\u76d8\u8f93\u51fa\u7cd6\u679c\u7cfb\u591a\u8272\u86c7\u7fa4\u3002',
            'en-US': 'Big-eye candy-dot skin with dreamy pastel multi-color variants.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/candy-dream/snake_head.png?v=4',
            snakeHeadCurious: 'assets/skins/candy-dream/snake_head_curious.png?v=4',
            snakeHeadSleepy: 'assets/skins/candy-dream/snake_head_sleepy.png?v=4',
            snakeHeadSurprised: 'assets/skins/candy-dream/snake_head_surprised.png?v=4',
            snakeSegA: 'assets/skins/candy-dream/snake_seg_a.png?v=4',
            snakeSegB: 'assets/skins/candy-dream/snake_seg_b.png?v=4',
            snakeTailBase: 'assets/skins/candy-dream/snake_tail_base.png?v=4',
            snakeTailTip: 'assets/skins/candy-dream/snake_tail_tip.png?v=4'
        })
    })
]);

const SKIN_INDEX = new Map(SKIN_CATALOG.map((skin) => [skin.id, skin]));
const SKIN_ORDER = SKIN_CATALOG.map((skin) => skin.id);

export function getSkinCatalog() {
    return SKIN_CATALOG;
}

export function getDefaultSkinId() {
    return DEFAULT_SKIN_ID;
}

export function getSkinById(skinId) {
    const key = `${skinId || ''}`.trim();
    return SKIN_INDEX.get(key) || SKIN_INDEX.get(DEFAULT_SKIN_ID);
}

export function resolveSkinAssets(skinId) {
    return getSkinById(skinId).assets;
}

export function normalizeUnlockedSkins(rawUnlocked) {
    const unlocked = new Set(DEFAULT_UNLOCKED_SKINS);
    if (Array.isArray(rawUnlocked)) {
        for (const value of rawUnlocked) {
            const id = `${value || ''}`.trim();
            if (!id || !SKIN_INDEX.has(id)) {
                continue;
            }
            unlocked.add(id);
        }
    }

    return SKIN_ORDER.filter((id) => unlocked.has(id));
}

export function ensureSelectedSkin(selectedSkinId, unlockedSkinIds) {
    const unlocked = new Set(normalizeUnlockedSkins(unlockedSkinIds));
    const normalizedSelected = `${selectedSkinId || ''}`.trim();
    if (normalizedSelected && unlocked.has(normalizedSelected)) {
        return normalizedSelected;
    }
    return DEFAULT_SKIN_ID;
}

export function getSkinDisplayName(skin, locale = 'en-US') {
    if (!skin) {
        return '';
    }
    if (skin.name?.[locale]) {
        return skin.name[locale];
    }
    return skin.name?.['en-US'] || skin.id;
}

export function getSkinDescription(skin, locale = 'en-US') {
    if (!skin) {
        return '';
    }
    if (skin.description?.[locale]) {
        return skin.description[locale];
    }
    return skin.description?.['en-US'] || '';
}

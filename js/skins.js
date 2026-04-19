const DEFAULT_SKIN_ID = 'classic-burrow';

export const SCORE_PER_COIN = 1000;
export const DEFAULT_UNLOCKED_SKINS = Object.freeze([DEFAULT_SKIN_ID]);
export const SKIN_PRICE_OVERRIDE_STORAGE_KEY = 'arrowClear_skinPriceOverrides_v1';
export const LOCAL_SKIN_CATALOG_STORAGE_KEY = 'arrowClear_localSkinCatalog_v1';
export const LOCAL_SKIN_PRICE_OVERRIDE_STORAGE_KEY = 'arrowClear_localSkinPriceOverrides_v1';
export const LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY = 'arrowClear_localSkinColorVariants_v1';
export const SKIN_VISIBLE_IDS_STORAGE_KEY = 'arrowClear_skinVisibleSkinIds_v1';
export const SKIN_DESC_ZH_OVERRIDE_STORAGE_KEY = 'arrowClear_skinDescZhOverrides_v1';
export const SKIN_DESC_EN_OVERRIDE_STORAGE_KEY = 'arrowClear_skinDescEnOverrides_v1';

function createAtlasPartAsset(src, x, y, width, height, chromaKey = null, sourceWidth = 1984, sourceHeight = 2174) {
    return Object.freeze({
        src,
        crop: Object.freeze({ x, y, width, height, sourceWidth, sourceHeight }),
        ...(chromaKey ? { chromaKey: Object.freeze({ ...chromaKey }) } : {})
    });
}

const GEMINI_ATLAS_SHEET_PATH = 'assets/skins/gemini-atlas-sheet/skin_atlas.png?v=1';
const GEMINI_ATLAS_PREVIEW_PATH = 'assets/skins/gemini-atlas-sheet/skin_preview.png?v=1';
const GEMINI_ATLAS_GREEN_KEY = Object.freeze({
    color: '#239638',
    tolerance: 74,
    feather: 18
});
const SKIN_ASSET_KEYS = Object.freeze([
    'snakeHead',
    'snakeHeadCurious',
    'snakeHeadSleepy',
    'snakeHeadSurprised',
    'snakeSegA',
    'snakeSegB',
    'snakeTailBase',
    'snakeTailTip'
]);

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
        preview: 'assets/skins/classic-burrow/snake_head.png',
        name: Object.freeze({
            'zh-CN': '\u6d1e\u7a74\u7ecf\u5178',
            'en-US': 'Burrow Classic'
        }),
        description: Object.freeze({
            'zh-CN': '\u9ed8\u8ba4\u5916\u89c2\uff0c\u62e5\u6709\u968f\u673a\u8272\u8c03\u53d8\u5316\u3002',
            'en-US': 'Default look with per-line hue variation.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/classic-burrow/snake_head.png',
            snakeHeadCurious: 'assets/skins/classic-burrow/snake_head_curious.png',
            snakeHeadSleepy: 'assets/skins/classic-burrow/snake_head_sleepy.png',
            snakeHeadSurprised: 'assets/skins/classic-burrow/snake_head_surprised.png',
            snakeSegA: 'assets/skins/classic-burrow/snake_seg_a.png',
            snakeSegB: 'assets/skins/classic-burrow/snake_seg_b.png',
            snakeTailBase: 'assets/skins/classic-burrow/snake_tail_base.png',
            snakeTailTip: 'assets/skins/classic-burrow/snake_tail_tip.png'
        })
    }),
    Object.freeze({
        id: 'gemini-atlas-sheet',
        coinCost: 36,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'atlas-fuchsia', hueShift: 0, saturation: 1.08, lightness: 1.00, contrast: 1.04 }),
            Object.freeze({ id: 'atlas-tangerine', hueShift: -22, saturation: 1.10, lightness: 1.01, contrast: 1.05 }),
            Object.freeze({ id: 'atlas-lemon', hueShift: -40, saturation: 1.10, lightness: 1.02, contrast: 1.04 }),
            Object.freeze({ id: 'atlas-lime', hueShift: 62, saturation: 1.08, lightness: 1.01, contrast: 1.04 }),
            Object.freeze({ id: 'atlas-cyan', hueShift: 108, saturation: 1.08, lightness: 1.00, contrast: 1.04 }),
            Object.freeze({ id: 'atlas-violet', hueShift: 148, saturation: 1.10, lightness: 1.00, contrast: 1.05 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(12, 10, 18, 0.30)',
            segmentShadowBlur: 3.2,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(10, 8, 16, 0.34)',
            headShadowBlur: 3.8,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: GEMINI_ATLAS_PREVIEW_PATH,
        name: Object.freeze({
            'zh-CN': '\u7cd6\u679c\u8d34\u56fe\u96c6',
            'en-US': 'Candy Atlas Sheet'
        }),
        description: Object.freeze({
            'zh-CN': '\u5355\u5f20 atlas \u8d34\u56fe\u76f4\u63a5\u88c1\u51fa 4 \u4e2a\u5934\u90e8\u8868\u60c5\uff0c1 \u4e2a\u8eab\u4f53\uff0c1 \u4e2a\u5c3e\u5df4\uff0c\u7528\u4e8e\u9a8c\u8bc1\u5355\u56fe\u76ae\u80a4\u6e32\u67d3\u903b\u8f91\u3002',
            'en-US': 'Single atlas-sheet skin prototype with 4 head expressions, 1 body part, and 1 tail part sampled directly from one texture.'
        }),
        assets: Object.freeze({
            snakeHead: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 98, 80, 824, 646, GEMINI_ATLAS_GREEN_KEY),
            snakeHeadCurious: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 1051, 80, 827, 646, GEMINI_ATLAS_GREEN_KEY),
            snakeHeadSleepy: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 98, 792, 824, 644, GEMINI_ATLAS_GREEN_KEY),
            snakeHeadSurprised: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 1053, 792, 827, 644, GEMINI_ATLAS_GREEN_KEY),
            snakeSegA: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 104, 1493, 848, 613, GEMINI_ATLAS_GREEN_KEY),
            snakeSegB: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 104, 1493, 848, 613, GEMINI_ATLAS_GREEN_KEY),
            snakeTailBase: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 1059, 1516, 817, 519, GEMINI_ATLAS_GREEN_KEY),
            snakeTailTip: createAtlasPartAsset(GEMINI_ATLAS_SHEET_PATH, 1059, 1516, 817, 519, GEMINI_ATLAS_GREEN_KEY)
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
            segmentShadowColor: 'rgba(8, 8, 10, 0.34)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(6, 6, 8, 0.42)',
            headShadowBlur: 4.2,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/gemini-candy/snake_head.png',
        name: Object.freeze({
            'zh-CN': '\u7cd6\u679c\u6591\u70b9',
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
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({
                id: 'mono-white',
                hueShift: 0,
                saturation: 1,
                lightness: 1,
                contrast: 1,
                neutralTintStrength: 0,
                forceBinaryMonochrome: true,
                invertBinaryMonochrome: false,
                monochromeThreshold: 0.62
            }),
            Object.freeze({
                id: 'mono-black',
                hueShift: 0,
                saturation: 1,
                lightness: 1,
                contrast: 1,
                neutralTintStrength: 0,
                forceBinaryMonochrome: true,
                invertBinaryMonochrome: true,
                monochromeThreshold: 0.62
            })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(45, 25, 63, 0.34)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'transparent',
            headShadowBlur: 0,
            headShadowOffsetY: 0,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/candy-dream/snake_head.png',
        name: Object.freeze({
            'zh-CN': '\u9ed1\u767d\u7eaf\u51c0',
            'en-US': 'Pure Mono Snake'
        }),
        description: Object.freeze({
            'zh-CN': '\u57fa\u7840\u4e3a\u7eaf\u767d\u8d34\u56fe\uff0c\u5934\u90e8\u4fdd\u7559\u4e94\u5b98\u7ebf\u6761\uff1b\u6e38\u620f\u4e2d\u4ec5\u4f7f\u7528\u7eaf\u9ed1/\u7eaf\u767d\u4e24\u79cd\u86c7\u4f53\u3002',
            'en-US': 'Pure white base with facial line details; gameplay uses only pure black and pure white snakes.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/candy-dream/snake_head.png?v=10',
            snakeHeadCurious: 'assets/skins/candy-dream/snake_head_curious.png?v=10',
            snakeHeadSleepy: 'assets/skins/candy-dream/snake_head_sleepy.png?v=10',
            snakeHeadSurprised: 'assets/skins/candy-dream/snake_head_surprised.png?v=10',
            snakeSegA: 'assets/skins/candy-dream/snake_seg_a.png?v=9',
            snakeSegB: 'assets/skins/candy-dream/snake_seg_b.png?v=9',
            snakeTailBase: 'assets/skins/candy-dream/snake_tail_base.png?v=9',
            snakeTailTip: 'assets/skins/candy-dream/snake_tail_tip.png?v=9'
        })
    }),
    Object.freeze({
        id: 'aurora-jelly',
        coinCost: 42,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'aurora-candy-blue', hueShift: 0, saturation: 1.66, lightness: 1.00, contrast: 1.10 }),
            Object.freeze({ id: 'aurora-candy-red', hueShift: 151, saturation: 1.72, lightness: 1.00, contrast: 1.12 }),
            Object.freeze({ id: 'aurora-candy-orange', hueShift: 175, saturation: 1.72, lightness: 1.04, contrast: 1.11 }),
            Object.freeze({ id: 'aurora-candy-yellow', hueShift: 199, saturation: 1.66, lightness: 1.10, contrast: 1.10 }),
            Object.freeze({ id: 'aurora-candy-green', hueShift: -101, saturation: 1.72, lightness: 1.00, contrast: 1.11 }),
            Object.freeze({ id: 'aurora-candy-purple', hueShift: 68, saturation: 1.74, lightness: 1.00, contrast: 1.12 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(22, 18, 44, 0.30)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(18, 14, 38, 0.38)',
            headShadowBlur: 4.3,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/aurora-jelly/snake_head.png?v=5',
        name: Object.freeze({
            'zh-CN': '\u6781\u5149\u679c\u51bb',
            'en-US': 'Aurora Jelly'
        }),
        description: Object.freeze({
            'zh-CN': '\u7cd6\u679c\u8f6f\u7cd6\u7acb\u4f53\u611f\uff1a\u7eaf\u8272\u65e0\u82b1\u7eb9\uff0c\u4ec5\u4fdd\u7559\u4e94\u5b98\u4e0e\u63cf\u8fb9\u3002',
            'en-US': 'Candy-crush glossy solids: no body pattern, with facial features and outlines preserved.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/aurora-jelly/snake_head.png?v=5',
            snakeHeadCurious: 'assets/skins/aurora-jelly/snake_head_curious.png?v=5',
            snakeHeadSleepy: 'assets/skins/aurora-jelly/snake_head_sleepy.png?v=5',
            snakeHeadSurprised: 'assets/skins/aurora-jelly/snake_head_surprised.png?v=5',
            snakeSegA: 'assets/skins/aurora-jelly/snake_seg_a.png?v=5',
            snakeSegB: 'assets/skins/aurora-jelly/snake_seg_b.png?v=5',
            snakeTailBase: 'assets/skins/aurora-jelly/snake_tail_base.png?v=5',
            snakeTailTip: 'assets/skins/aurora-jelly/snake_tail_tip.png?v=5'
        })
    }),
    Object.freeze({
        id: 'aqua-jelly-snake',
        coinCost: 46,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'aqua-cyan', hueShift: 0, saturation: 1.66, lightness: 1.00, contrast: 1.10 }),
            Object.freeze({ id: 'aqua-blue', hueShift: 22, saturation: 1.72, lightness: 1.00, contrast: 1.12 }),
            Object.freeze({ id: 'aqua-violet', hueShift: 66, saturation: 1.70, lightness: 1.00, contrast: 1.11 }),
            Object.freeze({ id: 'aqua-mint', hueShift: -86, saturation: 1.68, lightness: 1.03, contrast: 1.10 }),
            Object.freeze({ id: 'aqua-green', hueShift: -104, saturation: 1.70, lightness: 1.02, contrast: 1.11 }),
            Object.freeze({ id: 'aqua-lime', hueShift: -122, saturation: 1.66, lightness: 1.06, contrast: 1.09 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(22, 18, 44, 0.30)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(18, 14, 38, 0.38)',
            headShadowBlur: 4.3,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/aqua-jelly-snake/snake_head.png?v=1',
        name: Object.freeze({
            'zh-CN': '\u78a7\u84dd\u679c\u51bb\u86c7',
            'en-US': 'Aqua Jelly Snake'
        }),
        description: Object.freeze({
            'zh-CN': '\u78a7\u84dd\u679c\u51bb\u4e3b\u9898\uff0c\u7cd6\u679c\u8d28\u611f\u660e\u4eae\u901a\u900f\u3002',
            'en-US': 'Aqua jelly theme with bright glossy candy texture.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/aqua-jelly-snake/snake_head.png?v=1',
            snakeHeadCurious: 'assets/skins/aqua-jelly-snake/snake_head_curious.png?v=1',
            snakeHeadSleepy: 'assets/skins/aqua-jelly-snake/snake_head_sleepy.png?v=1',
            snakeHeadSurprised: 'assets/skins/aqua-jelly-snake/snake_head_surprised.png?v=1',
            snakeSegA: 'assets/skins/aqua-jelly-snake/snake_seg_a.png?v=1',
            snakeSegB: 'assets/skins/aqua-jelly-snake/snake_seg_b.png?v=1',
            snakeTailBase: 'assets/skins/aqua-jelly-snake/snake_tail_base.png?v=1',
            snakeTailTip: 'assets/skins/aqua-jelly-snake/snake_tail_tip.png?v=1'
        })
    }),
    Object.freeze({
        id: 'candy-heart-snake',
        coinCost: 52,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'heart-rose', hueShift: 0, saturation: 1.64, lightness: 1.02, contrast: 1.10 }),
            Object.freeze({ id: 'heart-coral', hueShift: -20, saturation: 1.62, lightness: 1.04, contrast: 1.09 }),
            Object.freeze({ id: 'heart-peach', hueShift: -36, saturation: 1.58, lightness: 1.06, contrast: 1.08 }),
            Object.freeze({ id: 'heart-lilac', hueShift: 52, saturation: 1.60, lightness: 1.03, contrast: 1.09 }),
            Object.freeze({ id: 'heart-grape', hueShift: 76, saturation: 1.62, lightness: 1.01, contrast: 1.10 }),
            Object.freeze({ id: 'heart-mint', hueShift: -90, saturation: 1.56, lightness: 1.04, contrast: 1.08 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(38, 20, 42, 0.30)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(34, 18, 38, 0.38)',
            headShadowBlur: 4.3,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/candy-heart-snake/snake_head.png?v=1',
        name: Object.freeze({
            'zh-CN': '\u7cd6\u5fc3\u86c7\u76ae',
            'en-US': 'Candy Heart Snake'
        }),
        description: Object.freeze({
            'zh-CN': '\u751c\u5fc3\u7cd6\u679c\u914d\u8272\uff0c\u8f6e\u5ed3\u6e05\u6670\u3002',
            'en-US': 'Sweet heart-candy palette with clear outlines.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/candy-heart-snake/snake_head.png?v=1',
            snakeHeadCurious: 'assets/skins/candy-heart-snake/snake_head_curious.png?v=1',
            snakeHeadSleepy: 'assets/skins/candy-heart-snake/snake_head_sleepy.png?v=1',
            snakeHeadSurprised: 'assets/skins/candy-heart-snake/snake_head_surprised.png?v=1',
            snakeSegA: 'assets/skins/candy-heart-snake/snake_seg_a.png?v=1',
            snakeSegB: 'assets/skins/candy-heart-snake/snake_seg_b.png?v=1',
            snakeTailBase: 'assets/skins/candy-heart-snake/snake_tail_base.png?v=1',
            snakeTailTip: 'assets/skins/candy-heart-snake/snake_tail_tip.png?v=1'
        })
    }),
    Object.freeze({
        id: 'candy-star-snake',
        coinCost: 56,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'star-gold', hueShift: -48, saturation: 1.64, lightness: 1.08, contrast: 1.09 }),
            Object.freeze({ id: 'star-orange', hueShift: -22, saturation: 1.66, lightness: 1.05, contrast: 1.10 }),
            Object.freeze({ id: 'star-pink', hueShift: 10, saturation: 1.62, lightness: 1.04, contrast: 1.10 }),
            Object.freeze({ id: 'star-blue', hueShift: 122, saturation: 1.62, lightness: 1.02, contrast: 1.10 }),
            Object.freeze({ id: 'star-violet', hueShift: 62, saturation: 1.64, lightness: 1.02, contrast: 1.10 }),
            Object.freeze({ id: 'star-mint', hueShift: -92, saturation: 1.58, lightness: 1.05, contrast: 1.08 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(36, 24, 18, 0.30)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(34, 22, 18, 0.38)',
            headShadowBlur: 4.3,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/candy-star-snake/snake_head.png?v=1',
        name: Object.freeze({
            'zh-CN': '\u7cd6\u679c\u661f\u8fb0',
            'en-US': 'Candy Star Snake'
        }),
        description: Object.freeze({
            'zh-CN': '\u7cd6\u679c\u661f\u7a7a\u98ce\u683c\uff0c\u4eae\u8272\u6e10\u53d8\u66f4\u4e30\u5bcc\u3002',
            'en-US': 'Star candy theme with glossy highlights and warm layers.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/candy-star-snake/snake_head.png?v=1',
            snakeHeadCurious: 'assets/skins/candy-star-snake/snake_head_curious.png?v=1',
            snakeHeadSleepy: 'assets/skins/candy-star-snake/snake_head_sleepy.png?v=1',
            snakeHeadSurprised: 'assets/skins/candy-star-snake/snake_head_surprised.png?v=1',
            snakeSegA: 'assets/skins/candy-star-snake/snake_seg_a.png?v=1',
            snakeSegB: 'assets/skins/candy-star-snake/snake_seg_b.png?v=1',
            snakeTailBase: 'assets/skins/candy-star-snake/snake_tail_base.png?v=1',
            snakeTailTip: 'assets/skins/candy-star-snake/snake_tail_tip.png?v=1'
        })
    }),
    Object.freeze({
        id: 'orange-jelly-snake',
        coinCost: 60,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'orange-amber', hueShift: -24, saturation: 1.70, lightness: 1.04, contrast: 1.10 }),
            Object.freeze({ id: 'orange-gold', hueShift: -40, saturation: 1.66, lightness: 1.08, contrast: 1.09 }),
            Object.freeze({ id: 'orange-red', hueShift: -6, saturation: 1.72, lightness: 1.02, contrast: 1.11 }),
            Object.freeze({ id: 'orange-pink', hueShift: 18, saturation: 1.64, lightness: 1.03, contrast: 1.10 }),
            Object.freeze({ id: 'orange-lime', hueShift: -98, saturation: 1.58, lightness: 1.05, contrast: 1.08 }),
            Object.freeze({ id: 'orange-sky', hueShift: 118, saturation: 1.58, lightness: 1.03, contrast: 1.08 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(44, 24, 16, 0.30)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(40, 20, 14, 0.38)',
            headShadowBlur: 4.3,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/orange-jelly-snake/snake_head.png?v=1',
        name: Object.freeze({
            'zh-CN': '\u6a59\u8272\u679c\u51bb\u86c7',
            'en-US': 'Orange Jelly Snake'
        }),
        description: Object.freeze({
            'zh-CN': '\u6a59\u8c03\u679c\u51bb\u4e3b\u9898\uff0c\u6696\u8272\u9ad8\u9971\u548c\u3002',
            'en-US': 'Warm orange jelly palette with bright translucent highlights.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/orange-jelly-snake/snake_head.png?v=1',
            snakeHeadCurious: 'assets/skins/orange-jelly-snake/snake_head_curious.png?v=1',
            snakeHeadSleepy: 'assets/skins/orange-jelly-snake/snake_head_sleepy.png?v=1',
            snakeHeadSurprised: 'assets/skins/orange-jelly-snake/snake_head_surprised.png?v=1',
            snakeSegA: 'assets/skins/orange-jelly-snake/snake_seg_a.png?v=1',
            snakeSegB: 'assets/skins/orange-jelly-snake/snake_seg_b.png?v=1',
            snakeTailBase: 'assets/skins/orange-jelly-snake/snake_tail_base.png?v=1',
            snakeTailTip: 'assets/skins/orange-jelly-snake/snake_tail_tip.png?v=1'
        })
    }),
    Object.freeze({
        id: 'rainbow-jelly-snake',
        coinCost: 64,
        allowHueVariants: true,
        colorVariants: Object.freeze([
            Object.freeze({ id: 'rainbow-cyan', hueShift: 0, saturation: 1.68, lightness: 1.02, contrast: 1.10 }),
            Object.freeze({ id: 'rainbow-blue', hueShift: 24, saturation: 1.70, lightness: 1.01, contrast: 1.11 }),
            Object.freeze({ id: 'rainbow-purple', hueShift: 56, saturation: 1.72, lightness: 1.01, contrast: 1.11 }),
            Object.freeze({ id: 'rainbow-pink', hueShift: 142, saturation: 1.70, lightness: 1.02, contrast: 1.11 }),
            Object.freeze({ id: 'rainbow-orange', hueShift: -164, saturation: 1.68, lightness: 1.03, contrast: 1.10 }),
            Object.freeze({ id: 'rainbow-lime', hueShift: -94, saturation: 1.66, lightness: 1.05, contrast: 1.09 })
        ]),
        renderProfile: Object.freeze({
            segmentShadowColor: 'rgba(30, 18, 44, 0.30)',
            segmentShadowBlur: 3.4,
            segmentShadowOffsetY: 1,
            headShadowColor: 'rgba(26, 14, 40, 0.38)',
            headShadowBlur: 4.3,
            headShadowOffsetY: 1,
            spriteScale: 1,
            partFit: Object.freeze({
                headDefault: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headCurious: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSleepy: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                headSurprised: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segA: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                segB: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 }),
                tailTip: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            })
        }),
        preview: 'assets/skins/rainbow-jelly-snake/snake_head.png?v=1',
        name: Object.freeze({
            'zh-CN': '\u5f69\u8679\u679c\u51bb',
            'en-US': 'Rainbow Jelly Snake'
        }),
        description: Object.freeze({
            'zh-CN': '\u5f69\u8679\u679c\u51bb\u4e3b\u9898\uff0c\u6e10\u53d8\u8272\u66f4\u52a0\u4e30\u5bcc\u3002',
            'en-US': 'Rainbow jelly theme with richer multi-color gradients.'
        }),
        assets: Object.freeze({
            snakeHead: 'assets/skins/rainbow-jelly-snake/snake_head.png?v=1',
            snakeHeadCurious: 'assets/skins/rainbow-jelly-snake/snake_head_curious.png?v=1',
            snakeHeadSleepy: 'assets/skins/rainbow-jelly-snake/snake_head_sleepy.png?v=1',
            snakeHeadSurprised: 'assets/skins/rainbow-jelly-snake/snake_head_surprised.png?v=1',
            snakeSegA: 'assets/skins/rainbow-jelly-snake/snake_seg_a.png?v=1',
            snakeSegB: 'assets/skins/rainbow-jelly-snake/snake_seg_b.png?v=1',
            snakeTailBase: 'assets/skins/rainbow-jelly-snake/snake_tail_base.png?v=1',
            snakeTailTip: 'assets/skins/rainbow-jelly-snake/snake_tail_tip.png?v=1'
        })
    })

]);

const SKIN_INDEX = new Map(SKIN_CATALOG.map((skin) => [skin.id, skin]));
const SKIN_ORDER = SKIN_CATALOG.map((skin) => skin.id);

function getStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    return window.localStorage;
}

function sanitizeSkinId(rawId) {
    return `${rawId || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeSkinIdSet(rawIds) {
    const out = new Set();
    if (rawIds instanceof Set) {
        for (const value of rawIds.values()) {
            const id = sanitizeSkinId(value);
            if (id) {
                out.add(id);
            }
        }
        return out;
    }
    if (!Array.isArray(rawIds)) {
        return out;
    }
    for (const value of rawIds) {
        const id = sanitizeSkinId(value);
        if (id) {
            out.add(id);
        }
    }
    return out;
}

function resolveLegacyVariantBaseId(skinId, candidateBaseIdSet = null) {
    const id = sanitizeSkinId(skinId);
    if (!id) {
        return '';
    }
    const match = id.match(/^(.*)-([0-9a-f]{6})$/i);
    if (!match) {
        return '';
    }
    const baseId = sanitizeSkinId(match[1]);
    if (!baseId || baseId === id) {
        return '';
    }
    if (candidateBaseIdSet instanceof Set && candidateBaseIdSet.size > 0 && !candidateBaseIdSet.has(baseId)) {
        return '';
    }
    return baseId;
}

export function isLegacyColorVariantSkinId(skinId, candidateBaseIds = null) {
    const candidateSet = normalizeSkinIdSet(candidateBaseIds);
    return Boolean(resolveLegacyVariantBaseId(skinId, candidateSet.size > 0 ? candidateSet : null));
}

function sanitizeDisplayText(rawText, fallback = '') {
    const cleaned = `${rawText || ''}`.replace(/\s+/g, ' ').trim();
    return cleaned || fallback;
}

function normalizeAssetPath(rawPath, fallbackPath = '') {
    const cleaned = `${rawPath || ''}`.trim().replace(/\\/g, '/');
    if (!cleaned) {
        return fallbackPath;
    }
    const withoutOrigin = cleaned.replace(/^https?:\/\/[^/]+/i, '');
    const normalized = withoutOrigin.startsWith('/') ? withoutOrigin.slice(1) : withoutOrigin;
    if (!normalized.startsWith('assets/skins/')) {
        return fallbackPath;
    }
    return normalized;
}

function normalizeCropRect(rawCrop) {
    if (!rawCrop || typeof rawCrop !== 'object') {
        return null;
    }
    const x = Math.max(0, Math.round(Number(rawCrop.x) || 0));
    const y = Math.max(0, Math.round(Number(rawCrop.y) || 0));
    const width = Math.max(1, Math.round(Number(rawCrop.width ?? rawCrop.w) || 0));
    const height = Math.max(1, Math.round(Number(rawCrop.height ?? rawCrop.h) || 0));
    const sourceWidth = Math.max(1, Math.round(Number(rawCrop.sourceWidth ?? rawCrop.basisWidth ?? rawCrop.sheetWidth) || 0)) || null;
    const sourceHeight = Math.max(1, Math.round(Number(rawCrop.sourceHeight ?? rawCrop.basisHeight ?? rawCrop.sheetHeight) || 0)) || null;
    return Object.freeze({
        x,
        y,
        width,
        height,
        ...(sourceWidth ? { sourceWidth } : {}),
        ...(sourceHeight ? { sourceHeight } : {})
    });
}

function normalizeChromaKey(rawKey) {
    if (!rawKey || typeof rawKey !== 'object') {
        return null;
    }
    const color = `${rawKey.color || ''}`.trim().toLowerCase();
    const normalizedColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#00ff00';
    const tolerance = Math.max(1, Math.min(441.68, Number(rawKey.tolerance) || 60));
    const feather = Math.max(0, Math.min(tolerance, Number(rawKey.feather) || 0));
    return Object.freeze({ color: normalizedColor, tolerance, feather });
}

function normalizeAssetSpec(rawAsset, fallbackPath = '') {
    if (typeof rawAsset === 'string') {
        return normalizeAssetPath(rawAsset, fallbackPath) || fallbackPath;
    }
    if (!rawAsset || typeof rawAsset !== 'object') {
        return fallbackPath;
    }
    const src = normalizeAssetPath(rawAsset.src || rawAsset.path || '', fallbackPath) || fallbackPath;
    if (!src) {
        return fallbackPath;
    }
    const crop = normalizeCropRect(rawAsset.crop || rawAsset.region || rawAsset.rect);
    const chromaKey = normalizeChromaKey(rawAsset.chromaKey || rawAsset.alphaKey || rawAsset.bgKey);
    return Object.freeze({
        src,
        ...(crop ? { crop } : {}),
        ...(chromaKey ? { chromaKey } : {})
    });
}

function buildLocalSkinAssets(skinId) {
    const id = sanitizeSkinId(skinId);
    const base = `assets/skins/${id}`;
    return {
        snakeHead: `${base}/snake_head.png`,
        snakeHeadCurious: `${base}/snake_head_curious.png`,
        snakeHeadSleepy: `${base}/snake_head_sleepy.png`,
        snakeHeadSurprised: `${base}/snake_head_surprised.png`,
        snakeSegA: `${base}/snake_seg_a.png`,
        snakeSegB: `${base}/snake_seg_b.png`,
        snakeTailBase: `${base}/snake_tail_base.png`,
        snakeTailTip: `${base}/snake_tail_tip.png`
    };
}

function normalizeLocalSkinAssets(rawAssets, skinId) {
    const fallbackAssets = buildLocalSkinAssets(skinId);
    if (!rawAssets || typeof rawAssets !== 'object') {
        return Object.freeze(fallbackAssets);
    }
    const normalized = {};
    for (const key of SKIN_ASSET_KEYS) {
        normalized[key] = normalizeAssetSpec(rawAssets[key], fallbackAssets[key]);
    }
    return Object.freeze(normalized);
}

function readRawLocalSkinCatalog() {
    const storage = getStorage();
    if (!storage) {
        return [];
    }
    try {
        const raw = storage.getItem(LOCAL_SKIN_CATALOG_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        if (parsed && typeof parsed === 'object') {
            return Object.values(parsed);
        }
        return [];
    } catch {
        return [];
    }
}

function readRawVisibleSkinIds() {
    const storage = getStorage();
    if (!storage) {
        return null;
    }
    try {
        const raw = storage.getItem(SKIN_VISIBLE_IDS_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function normalizeVisibleSkinIdSet(rawIds) {
    if (!Array.isArray(rawIds)) {
        return null;
    }
    const allIds = rawIds.map((value) => sanitizeSkinId(value)).filter(Boolean);
    const candidateBaseIdSet = new Set([...SKIN_ORDER, ...allIds]);
    const set = new Set();
    for (const id of allIds) {
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        set.add(id);
    }
    set.add(DEFAULT_SKIN_ID);
    return set;
}

function normalizeLocalSkinCatalog(rawCatalog = []) {
    const normalized = [];
    const seen = new Set();
    const rows = Array.isArray(rawCatalog) ? rawCatalog : [];
    const allIds = rows.map((row) => sanitizeSkinId(row?.id)).filter(Boolean);
    const candidateBaseIdSet = new Set([...SKIN_ORDER, ...allIds]);
    for (const row of rows) {
        if (!row || typeof row !== 'object') {
            continue;
        }
        const id = sanitizeSkinId(row.id);
        if (!id || id === DEFAULT_SKIN_ID || SKIN_INDEX.has(id) || seen.has(id)) {
            continue;
        }
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        const fallbackPreview = `assets/skins/${id}/snake_head.png`;
        const preview = normalizeAssetPath(row.preview, fallbackPreview) || fallbackPreview;
        const nameZh = sanitizeDisplayText(row.nameZh, id);
        const nameEn = sanitizeDisplayText(row.nameEn, id);
        const descriptionZh = sanitizeDisplayText(row.descriptionZh, 'AI generated skin.');
        const descriptionEn = sanitizeDisplayText(row.descriptionEn, 'AI generated skin.');
        const coinCost = normalizeCoinCost(row.coinCost, 0);

        normalized.push({
            id,
            coinCost,
            allowHueVariants: row.allowHueVariants !== false,
            colorVariants: Object.freeze([]),
            preview,
            name: Object.freeze({
                'zh-CN': nameZh,
                'en-US': nameEn
            }),
            description: Object.freeze({
                'zh-CN': descriptionZh,
                'en-US': descriptionEn
            }),
            assets: normalizeLocalSkinAssets(row.assets, id)
        });
        seen.add(id);
    }
    return normalized;
}

function readRawLocalSkinColorVariantMap() {
    const storage = getStorage();
    if (!storage) {
        return {};
    }
    try {
        const raw = storage.getItem(LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeColorVariantEntry(rawVariant, fallbackId) {
    const source = rawVariant && typeof rawVariant === 'object' ? rawVariant : {};
    const safeId = sanitizeDisplayText(source.id, fallbackId || 'variant');
    const hueShift = Number(source.hueShift);
    const saturation = Number(source.saturation);
    const lightness = Number(source.lightness);
    const contrast = Number(source.contrast);
    return Object.freeze({
        id: safeId,
        hueShift: Number.isFinite(hueShift) ? Math.max(-360, Math.min(360, hueShift)) : 0,
        saturation: Number.isFinite(saturation) ? Math.max(0.6, Math.min(2.2, saturation)) : 1,
        lightness: Number.isFinite(lightness) ? Math.max(0.7, Math.min(1.3, lightness)) : 1,
        contrast: Number.isFinite(contrast) ? Math.max(0.8, Math.min(1.4, contrast)) : 1
    });
}

function normalizeLocalSkinColorVariantMap(rawMap = {}) {
    const source = rawMap && typeof rawMap === 'object' ? rawMap : {};
    const sourceIds = Object.keys(source).map((skinId) => sanitizeSkinId(skinId)).filter(Boolean);
    const candidateBaseIdSet = new Set([...SKIN_ORDER, ...sourceIds]);
    const normalized = {};
    for (const [rawSkinId, rawVariants] of Object.entries(source)) {
        const skinId = sanitizeSkinId(rawSkinId);
        if (!skinId || !Array.isArray(rawVariants) || rawVariants.length === 0) {
            continue;
        }
        if (isLegacyColorVariantSkinId(skinId, candidateBaseIdSet) || isLegacyColorVariantSkinId(skinId)) {
            continue;
        }
        const next = [];
        for (let i = 0; i < rawVariants.length; i += 1) {
            const entry = normalizeColorVariantEntry(rawVariants[i], `variant-${i + 1}`);
            if (!entry.id) {
                continue;
            }
            next.push(entry);
        }
        if (next.length > 0) {
            normalized[skinId] = Object.freeze(next);
        }
    }
    return normalized;
}

function getCatalogBase() {
    const localCatalog = normalizeLocalSkinCatalog(readRawLocalSkinCatalog());
    return Object.freeze([...SKIN_CATALOG, ...localCatalog]);
}

function normalizeCoinCost(rawCost, fallbackCost) {
    const parsed = Number(rawCost);
    if (!Number.isFinite(parsed)) {
        return Math.max(0, Math.floor(Number(fallbackCost) || 0));
    }
    return Math.max(0, Math.floor(parsed));
}

function readRawSkinPriceOverrides() {
    const storage = getStorage();
    if (!storage) {
        return {};
    }
    try {
        const raw = storage.getItem(SKIN_PRICE_OVERRIDE_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeSkinPriceOverrides(rawOverrides = {}) {
    const raw = rawOverrides && typeof rawOverrides === 'object' ? rawOverrides : {};
    const normalized = {};
    for (const [skinId, rawCost] of Object.entries(raw)) {
        const baseSkin = SKIN_INDEX.get(`${skinId || ''}`.trim());
        if (!baseSkin) {
            continue;
        }
        const defaultCost = normalizeCoinCost(baseSkin.coinCost, 0);
        const normalizedCost = normalizeCoinCost(rawCost, defaultCost);
        if (normalizedCost !== defaultCost) {
            normalized[baseSkin.id] = normalizedCost;
        }
    }
    return normalized;
}

function readRawLocalSkinPriceOverrides() {
    const storage = getStorage();
    if (!storage) {
        return {};
    }
    try {
        const raw = storage.getItem(LOCAL_SKIN_PRICE_OVERRIDE_STORAGE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeLocalSkinPriceOverrides(rawOverrides = {}) {
    const raw = rawOverrides && typeof rawOverrides === 'object' ? rawOverrides : {};
    const normalized = {};
    for (const [skinId, rawCost] of Object.entries(raw)) {
        const id = sanitizeSkinId(skinId);
        if (!id) {
            continue;
        }
        normalized[id] = normalizeCoinCost(rawCost, 0);
    }
    return normalized;
}

function readRawSkinDescriptionOverrides(storageKey) {
    const storage = getStorage();
    if (!storage) {
        return {};
    }
    try {
        const raw = storage.getItem(storageKey);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeSkinDescriptionOverrides(rawOverrides = {}) {
    const raw = rawOverrides && typeof rawOverrides === 'object' ? rawOverrides : {};
    const normalized = {};
    for (const [skinId, rawDesc] of Object.entries(raw)) {
        const id = sanitizeSkinId(skinId);
        if (!id) {
            continue;
        }
        const desc = sanitizeDisplayText(rawDesc, '');
        if (!desc) {
            continue;
        }
        normalized[id] = desc;
    }
    return normalized;
}

function applySkinPriceOverride(baseSkin, overrides) {
    if (!baseSkin) {
        return SKIN_INDEX.get(DEFAULT_SKIN_ID);
    }
    const defaultCost = normalizeCoinCost(baseSkin.coinCost, 0);
    const overrideCost = normalizeCoinCost(overrides?.[baseSkin.id], defaultCost);
    if (overrideCost === defaultCost) {
        return baseSkin;
    }
    return {
        ...baseSkin,
        coinCost: overrideCost
    };
}

export function readSkinPriceOverrides() {
    return normalizeSkinPriceOverrides(readRawSkinPriceOverrides());
}

export function writeSkinPriceOverrides(rawOverrides) {
    const normalized = normalizeSkinPriceOverrides(rawOverrides);
    const storage = getStorage();
    if (storage) {
        storage.setItem(SKIN_PRICE_OVERRIDE_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
}

export function clearSkinPriceOverrides() {
    const storage = getStorage();
    if (storage) {
        storage.removeItem(SKIN_PRICE_OVERRIDE_STORAGE_KEY);
    }
}

export function getDefaultCoinCostBySkinId(skinId) {
    const key = sanitizeSkinId(skinId);
    const baseCatalog = getCatalogBase();
    const base = baseCatalog.find((skin) => skin.id === key)
        || baseCatalog.find((skin) => skin.id === DEFAULT_SKIN_ID)
        || SKIN_INDEX.get(DEFAULT_SKIN_ID);
    return normalizeCoinCost(base?.coinCost, 0);
}

export function isBuiltInSkinId(skinId) {
    const key = sanitizeSkinId(skinId);
    return !!key && SKIN_INDEX.has(key);
}

export function getSkinCatalog() {
    const builtInOverrides = readSkinPriceOverrides();
    const localOverrides = normalizeLocalSkinPriceOverrides(readRawLocalSkinPriceOverrides());
    const localColorVariants = normalizeLocalSkinColorVariantMap(readRawLocalSkinColorVariantMap());
    const descZhOverrides = normalizeSkinDescriptionOverrides(
        readRawSkinDescriptionOverrides(SKIN_DESC_ZH_OVERRIDE_STORAGE_KEY)
    );
    const descEnOverrides = normalizeSkinDescriptionOverrides(
        readRawSkinDescriptionOverrides(SKIN_DESC_EN_OVERRIDE_STORAGE_KEY)
    );
    const baseCatalog = getCatalogBase();
    return baseCatalog.map((skin) => {
        const defaultCost = normalizeCoinCost(skin.coinCost, 0);
        const overrideCost = Object.prototype.hasOwnProperty.call(localOverrides, skin.id)
            ? normalizeCoinCost(localOverrides[skin.id], defaultCost)
            : normalizeCoinCost(builtInOverrides?.[skin.id], defaultCost);
        let nextSkin = skin;
        if (overrideCost !== defaultCost) {
            nextSkin = {
                ...nextSkin,
                coinCost: overrideCost
            };
        }

        const nextDescZh = descZhOverrides[skin.id];
        const nextDescEn = descEnOverrides[skin.id];
        if (nextDescZh || nextDescEn) {
            nextSkin = {
                ...nextSkin,
                description: Object.freeze({
                    ...(nextSkin.description || {}),
                    ...(nextDescZh ? { 'zh-CN': nextDescZh } : {}),
                    ...(nextDescEn ? { 'en-US': nextDescEn } : {})
                })
            };
        }

        const variantOverride = localColorVariants[skin.id];
        if (Array.isArray(variantOverride) && variantOverride.length > 0) {
            nextSkin = {
                ...nextSkin,
                allowHueVariants: true,
                colorVariants: Object.freeze(variantOverride.map((entry) => Object.freeze({ ...entry })))
            };
        }
        return nextSkin;
    });
}

export function getDefaultSkinId() {
    return DEFAULT_SKIN_ID;
}

export function getSkinById(skinId) {
    const key = sanitizeSkinId(skinId);
    const catalog = getSkinCatalog();
    return catalog.find((skin) => skin.id === key)
        || catalog.find((skin) => skin.id === DEFAULT_SKIN_ID)
        || SKIN_INDEX.get(DEFAULT_SKIN_ID);
}

export function resolveSkinAssets(skinId) {
    return getSkinById(skinId).assets;
}

export function normalizeUnlockedSkins(rawUnlocked) {
    const catalog = getSkinCatalog();
    const validSkinIds = new Set(catalog.map((skin) => skin.id));
    const unlocked = new Set(DEFAULT_UNLOCKED_SKINS);
    if (Array.isArray(rawUnlocked)) {
        for (const value of rawUnlocked) {
            const id = sanitizeSkinId(value);
            if (!id || !validSkinIds.has(id)) {
                continue;
            }
            unlocked.add(id);
        }
    }

    return catalog
        .map((skin) => skin.id)
        .filter((id) => unlocked.has(id));
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

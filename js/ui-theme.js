const DEFAULT_THEME = 'design-v5';

const STATIC_FALLBACK = {
    'home.background': 'assets/ui/home/ui_app_bg.png',
    'surface.panel': 'assets/ui/home/ui_panel.png',
    'button.primary': 'assets/ui/home/ui_button.png',
    'card.feature': 'assets/ui/home/ui_item_button.png',
    'icon.home': 'assets/ui/shared/icons/icon_home.png',
    'icon.settings': 'assets/ui/shared/icons/icon_settings.png',
    'icon.leaderboard': 'assets/ui/shared/icons/icon_rank.png',
    'icon.skins': 'assets/ui/shared/icons/icon_theme.png',
    'icon.checkin': 'assets/ui/shared/icons/icon_gift.png',
    'icon.exit': 'assets/ui/shared/icons/icon_lock.png',
    'icon.coin': 'assets/ui/shared/icons/icon_coin.png',
    'icon.energy': 'assets/ui/shared/icons/icon_energy.png'
};

let activeTheme = DEFAULT_THEME;
let activeManifest = null;

function normalizeAssetPath(assetPath) {
    if (typeof assetPath !== 'string' || !assetPath) {
        return '';
    }

    if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
        return assetPath;
    }

    const normalized = assetPath.replace(/^[./\\]+/, '');
    const baseUrl = typeof document !== 'undefined' && document.baseURI
        ? document.baseURI
        : (typeof import.meta !== 'undefined' ? import.meta.url : '/');

    try {
        return new URL(normalized, baseUrl).toString();
    } catch {
        return `./${normalized}`;
    }
}

export async function initUiTheme(theme = DEFAULT_THEME) {
    activeTheme = theme || DEFAULT_THEME;
    activeManifest = null;

    try {
        const response = await fetch(`assets/ui/themes/${activeTheme}/manifest.json`, {
            cache: 'no-store'
        });

        if (response.ok) {
            const json = await response.json();
            if (json && typeof json === 'object') {
                activeManifest = json;
            }
        }
    } catch {
        activeManifest = null;
    }

    return {
        theme: activeTheme,
        hasManifest: !!activeManifest
    };
}

export function getUiAsset(slot) {
    const manifestSlots = activeManifest?.slots || null;
    const manifestFallback = activeManifest?.fallbackSlots || null;

    if (manifestSlots && typeof manifestSlots[slot] === 'string' && manifestSlots[slot]) {
        return normalizeAssetPath(manifestSlots[slot]);
    }

    if (manifestFallback && typeof manifestFallback[slot] === 'string' && manifestFallback[slot]) {
        return normalizeAssetPath(manifestFallback[slot]);
    }

    return normalizeAssetPath(STATIC_FALLBACK[slot] || '');
}

export function getActiveTheme() {
    return activeTheme;
}

export function getThemeManifest() {
    return activeManifest;
}


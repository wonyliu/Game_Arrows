import { readSupportAdsConfig } from './support-ads-config.js?v=1';

export const REWARDED_AD_PLACEMENTS = Object.freeze({
    SUPPORT_AUTHOR: 'support_author',
    FAIL_CONTINUE: 'fail_continue',
    DOUBLE_COIN: 'double_coin'
});

const DEFAULT_MOCK_DELAY_MS = 900;
const wechatAdCache = new Map();

export async function playRewardedAd(placement, options = {}) {
    const normalizedPlacement = normalizePlacement(placement);
    const config = readSupportAdsConfig();
    const adUnitId = `${config?.adUnitIds?.[normalizedPlacement] || ''}`.trim();
    if (canUseWechatRewardedAdApi() && adUnitId) {
        return playWechatRewardedAd(adUnitId, normalizedPlacement);
    }
    return playMockRewardedAd(normalizedPlacement, options.mockDelayMs);
}

function canUseWechatRewardedAdApi() {
    return typeof wx !== 'undefined'
        && typeof wx?.createRewardedVideoAd === 'function';
}

function normalizePlacement(placement) {
    const text = `${placement || ''}`.trim().toLowerCase();
    if (
        text === REWARDED_AD_PLACEMENTS.SUPPORT_AUTHOR
        || text === REWARDED_AD_PLACEMENTS.FAIL_CONTINUE
        || text === REWARDED_AD_PLACEMENTS.DOUBLE_COIN
    ) {
        return text;
    }
    return REWARDED_AD_PLACEMENTS.SUPPORT_AUTHOR;
}

function getWechatRewardedAd(adUnitId) {
    const key = `${adUnitId || ''}`.trim();
    if (!key) {
        return null;
    }
    if (wechatAdCache.has(key)) {
        return wechatAdCache.get(key);
    }
    try {
        const ad = wx.createRewardedVideoAd({ adUnitId: key });
        if (!ad) {
            return null;
        }
        wechatAdCache.set(key, ad);
        return ad;
    } catch {
        return null;
    }
}

function playWechatRewardedAd(adUnitId, placement) {
    return new Promise((resolve) => {
        const ad = getWechatRewardedAd(adUnitId);
        if (!ad) {
            resolve({
                ok: false,
                rewarded: false,
                placement,
                provider: 'wechat',
                error: 'ad instance unavailable'
            });
            return;
        }

        let settled = false;
        const finish = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                if (typeof ad.offClose === 'function') {
                    ad.offClose(onClose);
                }
                if (typeof ad.offError === 'function') {
                    ad.offError(onError);
                }
            } catch {
                // ignore listener cleanup errors
            }
            resolve(result);
        };

        const onClose = (event) => {
            const rewarded = !event || event.isEnded !== false;
            finish({
                ok: rewarded,
                rewarded,
                placement,
                provider: 'wechat',
                error: rewarded ? '' : 'ad interrupted'
            });
        };

        const onError = (error) => {
            finish({
                ok: false,
                rewarded: false,
                placement,
                provider: 'wechat',
                error: `${error?.errMsg || error?.message || 'ad failed'}`
            });
        };

        try {
            ad.onClose(onClose);
            ad.onError(onError);
            Promise.resolve(ad.show())
                .catch(() => Promise.resolve(ad.load()).then(() => ad.show()))
                .catch(onError);
        } catch (error) {
            onError(error);
        }
    });
}

function playMockRewardedAd(placement, delayMs = DEFAULT_MOCK_DELAY_MS) {
    const delay = Math.max(250, Math.min(5000, Math.floor(Number(delayMs) || DEFAULT_MOCK_DELAY_MS)));
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                ok: true,
                rewarded: true,
                placement,
                provider: 'mock',
                error: ''
            });
        }, delay);
    });
}

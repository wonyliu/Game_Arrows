import { readSupportAdsConfig } from './support-ads-config.js?v=1';

export const REWARDED_AD_PLACEMENTS = Object.freeze({
    SUPPORT_AUTHOR: 'support_author',
    FAIL_CONTINUE: 'fail_continue',
    DOUBLE_COIN: 'double_coin'
});

const DEFAULT_MOCK_DELAY_MS = 900;
const wechatAdCache = new Map();
const androidRewardedCallbackMap = new Map();
let androidRewardedSeq = 0;
const ANDROID_REWARDED_TIMEOUT_MS = 35000;

export async function playRewardedAd(placement, options = {}) {
    const normalizedPlacement = normalizePlacement(placement);
    const config = readSupportAdsConfig();
    const adUnitId = `${config?.adUnitIds?.[normalizedPlacement] || ''}`.trim();
    if (canUseAndroidRewardedAdApi()) {
        return playAndroidRewardedAd(normalizedPlacement, adUnitId);
    }
    if (canUseWechatRewardedAdApi() && adUnitId) {
        return playWechatRewardedAd(adUnitId, normalizedPlacement);
    }
    return playMockRewardedAd(normalizedPlacement, options.mockDelayMs);
}

function canUseWechatRewardedAdApi() {
    return typeof wx !== 'undefined'
        && typeof wx?.createRewardedVideoAd === 'function';
}

function canUseAndroidRewardedAdApi() {
    return typeof window !== 'undefined'
        && !!window.AndroidAdsBridge
        && typeof window.AndroidAdsBridge.playRewardedAd === 'function';
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

if (typeof window !== 'undefined' && typeof window.__androidRewardedAdResolve !== 'function') {
    window.__androidRewardedAdResolve = (requestId, payload) => {
        const key = `${requestId || ''}`.trim();
        if (!key) {
            return;
        }
        const resolver = androidRewardedCallbackMap.get(key);
        if (typeof resolver !== 'function') {
            return;
        }
        androidRewardedCallbackMap.delete(key);
        resolver(payload);
    };
}

function playAndroidRewardedAd(placement, adUnitId) {
    return new Promise((resolve) => {
        const requestId = `android_rewarded_${Date.now()}_${++androidRewardedSeq}`;
        let settled = false;
        const finish = (payload) => {
            if (settled) {
                return;
            }
            settled = true;
            const result = normalizeAndroidRewardedPayload(payload, placement);
            resolve(result);
        };

        const timeoutTimer = setTimeout(() => {
            androidRewardedCallbackMap.delete(requestId);
            finish({
                ok: false,
                rewarded: false,
                provider: 'android',
                placement,
                error: 'ad timeout'
            });
        }, ANDROID_REWARDED_TIMEOUT_MS);

        androidRewardedCallbackMap.set(requestId, (payload) => {
            clearTimeout(timeoutTimer);
            finish(payload);
        });

        try {
            window.AndroidAdsBridge.playRewardedAd(placement, `${adUnitId || ''}`.trim(), requestId);
        } catch (error) {
            clearTimeout(timeoutTimer);
            androidRewardedCallbackMap.delete(requestId);
            finish({
                ok: false,
                rewarded: false,
                provider: 'android',
                placement,
                error: `${error?.message || 'android bridge failed'}`
            });
        }
    });
}

function normalizeAndroidRewardedPayload(payload, placement) {
    const source = parseAndroidPayload(payload);
    return {
        ok: source.ok === true,
        rewarded: source.rewarded === true,
        provider: 'android',
        placement: `${source.placement || placement || ''}`.trim() || placement,
        error: `${source.error || ''}`.trim()
    };
}

function parseAndroidPayload(payload) {
    if (!payload) {
        return {};
    }
    if (typeof payload === 'string') {
        try {
            const parsed = JSON.parse(payload);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return payload && typeof payload === 'object' ? payload : {};
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

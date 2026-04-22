import { chromium } from 'playwright';

const BASE_URL = (process.env.SUPPORT_ADS_SMOKE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/+$/, '');
const DEBUG = process.env.SUPPORT_ADS_SMOKE_DEBUG === '1';
const JSON_HEADERS = Object.freeze({
    'content-type': 'application/json'
});

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function trace(message, data = null) {
    if (!DEBUG) {
        return;
    }
    if (data === null || data === undefined) {
        console.log(`[smoke] ${message}`);
        return;
    }
    console.log(`[smoke] ${message}`, data);
}

function parseCounter(text) {
    const match = `${text || ''}`.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) {
        return null;
    }
    return {
        watched: Number(match[1]),
        limit: Number(match[2])
    };
}

async function jsonFetch(pathname, options = {}) {
    const url = `${BASE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    return {
        ok: response.ok,
        status: response.status,
        payload
    };
}

async function runApiSmoke() {
    trace('runApiSmoke:start');
    const deviceId = `smoke-device-${Math.floor(Math.random() * 900000 + 100000)}`;
    const register = await jsonFetch('/api/users/register-temp', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            deviceId,
            deviceInfo: {
                ua: 'smoke-support-ads',
                platform: 'desktop',
                lang: 'zh-CN'
            },
            cookieUserId: ''
        })
    });
    assert(register.ok && register.payload?.ok === true, `register-temp failed (${register.status})`);
    const userId = `${register.payload?.user?.userId || ''}`.trim();
    assert(userId, 'register-temp returned empty userId');
    trace('runApiSmoke:registered', { userId, deviceId });

    const progressGet1 = await jsonFetch(`/api/users/${encodeURIComponent(userId)}/progress`);
    assert(progressGet1.ok && progressGet1.payload?.ok === true, `progress GET failed (${progressGet1.status})`);
    const initialSupportAds = progressGet1.payload?.progress?.supportAds || {};
    assert(Number(initialSupportAds.watchedToday) === 0, 'initial watchedToday is not 0');
    assert(Number(initialSupportAds.dailyLimitOverride) === -1, 'initial dailyLimitOverride is not -1');

    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const patchProgress = {
        ...(progressGet1.payload.progress || {}),
        supportAuthorBadgeCount: 7,
        supportAds: {
            dayKey,
            watchedToday: 3,
            totalWatched: 9,
            dailyLimitOverride: -1,
            lastPlacement: 'support_author',
            lastWatchedAt: now.toISOString()
        }
    };
    const progressPut = await jsonFetch(`/api/users/${encodeURIComponent(userId)}/progress`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(patchProgress)
    });
    assert(progressPut.ok && progressPut.payload?.ok === true, `progress PUT failed (${progressPut.status})`);
    trace('runApiSmoke:progress-updated');

    const progressGet2 = await jsonFetch(`/api/users/${encodeURIComponent(userId)}/progress`);
    assert(progressGet2.ok && progressGet2.payload?.ok === true, `progress GET(2) failed (${progressGet2.status})`);
    const persistedSupportAds = progressGet2.payload?.progress?.supportAds || {};
    assert(Number(persistedSupportAds.watchedToday) === 3, 'progress watchedToday persistence failed');
    assert(Number(persistedSupportAds.totalWatched) === 9, 'progress totalWatched persistence failed');
    assert(Number(progressGet2.payload?.progress?.supportAuthorBadgeCount) === 7, 'supportAuthorBadgeCount persistence failed');

    const adminPut = await jsonFetch(`/api/admin/db/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            progress: {
                supportAds: {
                    dailyLimitOverride: 15
                }
            }
        })
    });
    assert(adminPut.ok && adminPut.payload?.ok === true, `admin user PUT failed (${adminPut.status})`);
    trace('runApiSmoke:admin-override-updated');

    const progressGet3 = await jsonFetch(`/api/users/${encodeURIComponent(userId)}/progress`);
    assert(progressGet3.ok && progressGet3.payload?.ok === true, `progress GET(3) failed (${progressGet3.status})`);
    const overriddenSupportAds = progressGet3.payload?.progress?.supportAds || {};
    assert(Number(overriddenSupportAds.dailyLimitOverride) === 15, 'dailyLimitOverride persistence failed');

    const leaderboardBadgeGet = await jsonFetch(
        `/api/leaderboard?mode=badge&limit=20&userId=${encodeURIComponent(userId)}`
    );
    assert(leaderboardBadgeGet.ok && leaderboardBadgeGet.payload?.ok === true, `badge leaderboard GET failed (${leaderboardBadgeGet.status})`);
    const meBadgeRank = leaderboardBadgeGet.payload?.me || null;
    assert(meBadgeRank && Number(meBadgeRank.supportAuthorBadgeCount) >= 7, 'badge leaderboard missing supportAuthorBadgeCount');

    const username = `smoke_${Math.floor(Math.random() * 900000 + 100000)}`;
    const password = 'pass1234';
    const profilePut = await jsonFetch('/api/users/profile', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            userId,
            username,
            password
        })
    });
    assert(profilePut.ok && profilePut.payload?.ok === true, `profile PUT failed (${profilePut.status})`);
    assert(profilePut.payload?.user?.isTempUser === false, 'profile update did not convert temp user');
    trace('runApiSmoke:temp-converted', { userId: profilePut.payload?.user?.userId, username });

    const loginPost = await jsonFetch('/api/users/login', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            username,
            password
        })
    });
    assert(loginPost.ok && loginPost.payload?.ok === true, `login failed (${loginPost.status})`);
    trace('runApiSmoke:login-ok');

    return {
        userId,
        deviceId,
        username,
        password,
        formalSession: {
            userId: `${profilePut.payload?.user?.userId || userId}`.trim() || userId,
            username: `${profilePut.payload?.user?.username || username}`.trim() || username,
            avatarUrl: `${profilePut.payload?.user?.avatarUrl || ''}`.trim(),
            isTempUser: false,
            deviceId
        },
        initialSupportAds,
        persistedSupportAds,
        overriddenSupportAds,
        badgeRank: meBadgeRank
    };
}

async function runUiSmoke(apiReport) {
    trace('runUiSmoke:start');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const tempDeviceId = `dev-smoke-ui-${Math.floor(Math.random() * 900000 + 100000)}`;
    await page.addInitScript((deviceId) => {
        localStorage.removeItem('arrowClear_userSession_v1');
        localStorage.setItem('arrowClear_deviceId_v1', `${deviceId || ''}`.trim());
        document.cookie = 'arrow_uid=; Max-Age=0; path=/';
    }, tempDeviceId);
    const pageErrors = [];

    page.on('pageerror', (error) => {
        pageErrors.push(`${error?.message || error}`);
    });

    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    trace('runUiSmoke:index-loaded');
    await page.waitForSelector('#btnSupportAuthor', { timeout: 30000 });
    await page.waitForSelector('#btnLoginEntry', { state: 'attached', timeout: 30000 });
    await page.waitForSelector('#btnProfileAvatar', { timeout: 30000 });

    await page.waitForTimeout(800);
    const bootVisible = await page.$eval('#bootPreloadOverlay', (element) => !element.classList.contains('hidden'));
    if (bootVisible) {
        await page.evaluate(() => {
            const element = document.getElementById('bootPreloadOverlay');
            if (!element) return;
            element.classList.add('hidden');
            element.style.display = 'none';
        });
    }

    await page.waitForFunction(() => {
        const button = document.getElementById('btnLoginEntry');
        return !!button && !button.classList.contains('hidden');
    }, { timeout: 30000 });
    const loginVisibleForTemp = await page.$eval('#btnLoginEntry', (element) => !element.classList.contains('hidden'));
    const loginLinkPositionOk = await page.$eval('#menuOverlay', (overlay) => {
        const avatar = overlay.querySelector('#btnProfileAvatar');
        const login = overlay.querySelector('#btnLoginEntry');
        if (!(avatar instanceof HTMLElement) || !(login instanceof HTMLElement)) {
            return false;
        }
        const avatarRect = avatar.getBoundingClientRect();
        const loginRect = login.getBoundingClientRect();
        return loginRect.top >= avatarRect.bottom - 2;
    });
    assert(loginLinkPositionOk, 'login link is not positioned below avatar entry');

    await page.click('#btnSupportAuthor', { timeout: 15000 });
    trace('runUiSmoke:support-author-open');
    await page.waitForTimeout(200);
    const supportVisible = await page.$eval('#supportAuthorOverlay', (element) => !element.classList.contains('hidden'));
    assert(supportVisible, 'support author overlay did not open');

    const counterBefore = parseCounter(await page.$eval('#supportAuthorCount', (element) => element.textContent || ''));
    assert(counterBefore, 'invalid support author counter text before ad');
    const badgeBefore = Number(
        await page.$eval('#supportAuthorBadgeCount', (element) => element.textContent || '0')
    ) || 0;

    const watchButtonEnabled = await page.$eval('#btnSupportAuthorWatchAd', (element) => !element.disabled);
    if (watchButtonEnabled) {
        await page.click('#btnSupportAuthorWatchAd');
        await page.waitForTimeout(1700);
    }
    trace('runUiSmoke:support-author-watch-finished', { watchButtonEnabled });

    const counterAfter = parseCounter(await page.$eval('#supportAuthorCount', (element) => element.textContent || ''));
    assert(counterAfter, 'invalid support author counter text after ad');
    const badgeAfter = Number(
        await page.$eval('#supportAuthorBadgeCount', (element) => element.textContent || '0')
    ) || 0;
    if (watchButtonEnabled) {
        assert(counterAfter.watched === (counterBefore.watched + 1), 'support author counter did not increment');
        assert(badgeAfter === (badgeBefore + 1), 'support author badge count did not increment');
    }

    await page.click('#btnBackFromSupportAuthor', { timeout: 15000 });
    await page.waitForTimeout(150);
    await page.click('#btnSettings', { timeout: 15000 });
    await page.waitForTimeout(150);
    const hasGraphicsButtons = (await page.$('#btnGraphicsLow')) !== null
        || (await page.$('#btnGraphicsMid')) !== null
        || (await page.$('#btnGraphicsHigh')) !== null;
    assert(!hasGraphicsButtons, 'graphics quality buttons should be removed from settings');
    const hasGraphicsTitle = (await page.$('[data-i18n="panel.settings.graphics"]')) !== null;
    assert(!hasGraphicsTitle, 'graphics quality title should be removed from settings');
    trace('runUiSmoke:settings-checked');

    const formalContext = await browser.newContext();
    await formalContext.addCookies([
        {
            name: 'arrow_uid',
            value: `${apiReport?.formalSession?.userId || ''}`.trim(),
            url: BASE_URL
        }
    ]);
    const formalPage = await formalContext.newPage();
    await formalPage.addInitScript((session) => {
        localStorage.setItem('arrowClear_userSession_v1', JSON.stringify(session));
        localStorage.setItem('arrowClear_deviceId_v1', `${session?.deviceId || 'dev-smoke-formal'}`);
    }, apiReport?.formalSession || {});
    await formalPage.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await formalPage.waitForSelector('#btnLoginEntry', { state: 'attached', timeout: 30000 });
    await formalPage.waitForTimeout(800);
    const formalBootVisible = await formalPage.$eval('#bootPreloadOverlay', (element) => !element.classList.contains('hidden'));
    if (formalBootVisible) {
        await formalPage.evaluate(() => {
            const element = document.getElementById('bootPreloadOverlay');
            if (!element) return;
            element.classList.add('hidden');
            element.style.display = 'none';
        });
    }
    const loginHiddenForFormal = await formalPage.$eval('#btnLoginEntry', (element) => element.classList.contains('hidden'));
    assert(loginHiddenForFormal, 'formal user login link should be hidden');
    trace('runUiSmoke:formal-session-checked');

    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('body', { timeout: 30000 });
    const hasParamLimit = (await page.$('#paramSupportAdsDefaultDailyLimit')) !== null;
    const hasParamThanks = (await page.$('#paramSupportAdsThankYouMessage')) !== null;
    const hasDbOverride = (await page.$('#dbAdminSupportAdsDailyLimitOverride')) !== null;

    assert(hasParamLimit && hasParamThanks, 'admin support-ads parameter inputs are missing');
    assert(hasDbOverride, 'admin db support-ads override input is missing');
    assert(pageErrors.length === 0, `page errors detected: ${pageErrors.join(' | ')}`);
    trace('runUiSmoke:admin-checked');

    await formalContext.close();
    await context.close();
    await browser.close();
    trace('runUiSmoke:done');
    return {
        bootOverlayInitiallyVisible: bootVisible,
        tempLoginVisible: loginVisibleForTemp,
        loginLinkPositionOk,
        loginHiddenForFormal,
        graphicsSettingRemoved: !hasGraphicsButtons && !hasGraphicsTitle,
        watchButtonEnabled,
        counterBefore,
        counterAfter,
        badgeBefore,
        badgeAfter
    };
}

async function main() {
    const report = {
        baseUrl: BASE_URL,
        generatedAt: new Date().toISOString(),
        api: null,
        ui: null
    };

    report.api = await runApiSmoke();
    report.ui = await runUiSmoke(report.api);
    console.log(JSON.stringify({ ok: true, report }, null, 2));
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        baseUrl: BASE_URL,
        error: `${error?.message || error}`
    }, null, 2));
    process.exitCode = 1;
});

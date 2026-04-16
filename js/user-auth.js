const USER_SESSION_STORAGE_KEY = 'arrowClear_userSession_v1';
const DEVICE_ID_STORAGE_KEY = 'arrowClear_deviceId_v1';
const USER_ID_COOKIE_KEY = 'arrow_uid';
const AUTH_OVERLAY_ID = 'userAuthOverlay';
const API_BASE = '/api/users';
const AUTH_REQUEST_TIMEOUT_MS = 8000;

let activeSession = null;

export function getActiveUserSession() {
    return activeSession ? { ...activeSession } : null;
}

export function getActiveUserId() {
    return `${activeSession?.userId || ''}`.trim();
}

export function bootstrapUserSessionFromStorage() {
    if (activeSession?.userId) {
        return { ...activeSession };
    }

    const stored = readStoredSession();
    const cookieUserId = readCookie(USER_ID_COOKIE_KEY);
    const userId = `${stored?.userId || cookieUserId || ''}`.trim();
    if (!userId) {
        return null;
    }

    const session = {
        userId,
        username: `${stored?.username || userId}`.trim(),
        avatarUrl: `${stored?.avatarUrl || ''}`.trim(),
        isTempUser: stored?.isTempUser === true,
        deviceId: `${stored?.deviceId || getOrCreateDeviceId()}`.trim() || getOrCreateDeviceId()
    };
    activeSession = session;
    return { ...session };
}

export async function ensureUserSession() {
    if (activeSession?.userId) {
        return { ...activeSession };
    }

    const deviceId = getOrCreateDeviceId();
    const deviceInfo = collectDeviceInfo();
    const stored = readStoredSession();
    const cookieUserId = readCookie(USER_ID_COOKIE_KEY);
    const bootstrapUserId = `${stored?.userId || cookieUserId || ''}`.trim();

    if (bootstrapUserId) {
        const resumed = await postJson(`${API_BASE}/session`, {
            userId: bootstrapUserId,
            deviceId,
            deviceInfo,
            cookieUserId
        });
        if (resumed?.ok && resumed.user) {
            return applySession(resumed.user, deviceId);
        }
    }

    return promptAuthFlow(deviceId, deviceInfo, cookieUserId);
}

function readStoredSession() {
    try {
        const raw = localStorage.getItem(USER_SESSION_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch {
        // ignore
    }
    return null;
}

function persistSession(session) {
    try {
        localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(session, null, 2));
    } catch {
        // ignore
    }
}

function applySession(user, deviceId) {
    const next = {
        userId: `${user?.userId || ''}`.trim(),
        username: `${user?.username || ''}`.trim(),
        avatarUrl: `${user?.avatarUrl || ''}`.trim(),
        isTempUser: user?.isTempUser === true,
        deviceId: `${deviceId || getOrCreateDeviceId()}`.trim()
    };
    activeSession = next;
    persistSession(next);
    writeCookie(USER_ID_COOKIE_KEY, next.userId, 365);
    return { ...next };
}

async function promptAuthFlow(deviceId, deviceInfo, cookieUserId) {
    ensureAuthOverlayDom();
    const overlay = document.getElementById(AUTH_OVERLAY_ID);
    if (!overlay) {
        return null;
    }
    overlay.classList.remove('hidden');

    const usernameInput = overlay.querySelector('[data-auth-input="username"]');
    const passwordInput = overlay.querySelector('[data-auth-input="password"]');
    const statusEl = overlay.querySelector('[data-auth-role="status"]');
    const btnLogin = overlay.querySelector('[data-auth-action="login"]');
    const btnTemp = overlay.querySelector('[data-auth-action="temp"]');

    const setStatus = (text, isError = false) => {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.style.color = isError ? '#8f2a1d' : '#426b24';
    };

    const withPending = async (button, fn) => {
        if (!button) return null;
        const prev = button.textContent;
        button.disabled = true;
        button.textContent = '\u5904\u7406\u4e2d...';
        try {
            return await fn();
        } finally {
            button.disabled = false;
            button.textContent = prev;
        }
    };

    return new Promise((resolve) => {
        const done = (session) => {
            overlay.classList.add('hidden');
            resolve(session);
        };

        const onLogin = async () => {
            const username = `${usernameInput?.value || ''}`.trim();
            const password = `${passwordInput?.value || ''}`;
            if (!username || username.length < 2) {
                setStatus('\u7528\u6237\u540d\u81f3\u5c11 2 \u4e2a\u5b57\u7b26\u3002', true);
                return;
            }
            if (!password || password.length < 4) {
                setStatus('\u5bc6\u7801\u81f3\u5c11 4 \u4e2a\u5b57\u7b26\u3002', true);
                return;
            }
            setStatus('');
            const payload = await withPending(btnLogin, () => postJson(`${API_BASE}/login-or-register`, {
                username,
                password,
                deviceId,
                deviceInfo,
                cookieUserId
            }));
            if (!payload?.ok || !payload.user) {
                setStatus(`${payload?.error || '\u767b\u5f55\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002'}`, true);
                return;
            }
            done(applySession(payload.user, deviceId));
        };

        const onTemp = async () => {
            setStatus('');
            const payload = await withPending(btnTemp, () => postJson(`${API_BASE}/register-temp`, {
                deviceId,
                deviceInfo,
                cookieUserId
            }));
            if (!payload?.ok || !payload.user) {
                setStatus(`${payload?.error || '\u4e34\u65f6\u7528\u6237\u521b\u5efa\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002'}`, true);
                return;
            }
            done(applySession(payload.user, deviceId));
        };

        btnLogin?.addEventListener('click', onLogin);
        btnTemp?.addEventListener('click', onTemp);
    });
}

function ensureAuthOverlayDom() {
    if (document.getElementById(AUTH_OVERLAY_ID)) {
        return;
    }
    const root = document.querySelector('.app-container') || document.body;
    const buildVersion = `${window.__ARROW_BUILD_VERSION__ || 'build unknown'}`.trim();
    const wrapper = document.createElement('div');
    wrapper.id = AUTH_OVERLAY_ID;
    wrapper.className = 'overlay menu-panel-overlay';
    wrapper.innerHTML = `
        <div class="panel-shell user-auth-shell">
            <div class="panel-head">
                <h2 class="panel-title">\u7528\u6237\u767b\u5f55</h2>
            </div>
            <div class="panel-body user-auth-body">
                <p class="empty-state">\u8f93\u5165\u7528\u6237\u540d\u548c\u5bc6\u7801\u540e\u70b9\u51fb\u201c\u767b\u5f55\u201d\u3002\u7cfb\u7edf\u4f1a\u81ea\u52a8\u5224\u65ad\uff1a\u5df2\u6709\u8d26\u53f7\u5219\u767b\u5f55\uff0c\u4e0d\u5b58\u5728\u5219\u81ea\u52a8\u6ce8\u518c\u3002</p>
                <section class="user-auth-group">
                    <input data-auth-input="username" class="user-auth-input" type="text" maxlength="24" placeholder="\u7528\u6237\u540d">
                    <input data-auth-input="password" class="user-auth-input" type="password" maxlength="64" placeholder="\u5bc6\u7801">
                    <div class="user-auth-actions-row">
                        <button data-auth-action="login" class="btn-popup-primary user-auth-btn" type="button">\u767b\u5f55</button>
                        <button data-auth-action="temp" class="btn-popup-secondary user-auth-btn" type="button">\u4e34\u65f6\u7528\u6237</button>
                    </div>
                </section>
                <p data-auth-role="status" class="empty-state"></p>
            </div>
            <div class="user-auth-build-version">${buildVersion}</div>
        </div>
    `;
    root.appendChild(wrapper);
}

function getOrCreateDeviceId() {
    const existing = `${localStorage.getItem(DEVICE_ID_STORAGE_KEY) || ''}`.trim();
    if (existing) {
        return existing;
    }
    const random = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const next = `dev-${random}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
    return next;
}

function collectDeviceInfo() {
    const ua = typeof navigator !== 'undefined' ? `${navigator.userAgent || ''}`.trim() : '';
    const platform = typeof navigator !== 'undefined' ? `${navigator.platform || ''}`.trim() : '';
    const lang = typeof navigator !== 'undefined' ? `${navigator.language || ''}`.trim() : '';
    const vendor = typeof navigator !== 'undefined' ? `${navigator.vendor || ''}`.trim() : '';
    const screenInfo = typeof window !== 'undefined' && window.screen
        ? `${window.screen.width || 0}x${window.screen.height || 0}`
        : '';
    return [platform, vendor, lang, screenInfo, ua].filter(Boolean).join(' | ').slice(0, 600);
}

function readCookie(key) {
    const pairs = `${document.cookie || ''}`.split(';');
    for (const pair of pairs) {
        const [k, ...rest] = pair.split('=');
        if (`${k || ''}`.trim() === key) {
            return decodeURIComponent(rest.join('=') || '');
        }
    }
    return '';
}

function writeCookie(key, value, days) {
    const maxAge = Math.max(1, Math.floor(Number(days) || 1)) * 24 * 60 * 60;
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value || '')}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

async function postJson(url, payload) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS)
        : 0;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {}),
            signal: controller ? controller.signal : undefined
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: data?.error || `HTTP ${response.status}` };
        }
        return data;
    } catch (error) {
        return { ok: false, error: error?.message || 'network error' };
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

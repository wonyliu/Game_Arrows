const ADMIN_KEY_STORAGE_KEY = 'arrowClear_adminApiKey';

const el = {
    keyInput: document.getElementById('dbAdminKey'),
    queryInput: document.getElementById('dbAdminQuery'),
    pageSizeInput: document.getElementById('dbAdminPageSize'),
    btnOverview: document.getElementById('btnDbAdminLoadOverview'),
    btnSearch: document.getElementById('btnDbAdminSearchUsers'),
    btnPrev: document.getElementById('btnDbAdminPrevPage'),
    btnNext: document.getElementById('btnDbAdminNextPage'),
    btnCreateUser: document.getElementById('btnDbAdminCreateUser'),
    btnResetCreate: document.getElementById('btnDbAdminResetCreate'),
    btnInitUser: document.getElementById('btnDbAdminInitUser'),
    btnReloadUser: document.getElementById('btnDbAdminReloadUser'),
    btnSaveUser: document.getElementById('btnDbAdminSaveUser'),
    btnDeleteUser: document.getElementById('btnDbAdminDeleteUser'),
    status: document.getElementById('dbAdminStatus'),
    backend: document.getElementById('dbAdminBackend'),
    totalUsers: document.getElementById('dbAdminTotalUsers'),
    tempUsers: document.getElementById('dbAdminTempUsers'),
    offset: document.getElementById('dbAdminOffset'),
    rows: document.getElementById('dbAdminUserRows'),
    selectedUserLabel: document.getElementById('dbAdminSelectedUserLabel'),
    detailJson: document.getElementById('dbAdminUserDetailJson'),
    unlockedSkinList: document.getElementById('dbAdminUnlockedSkinList'),
    hardwareDeviceIdList: document.getElementById('dbAdminHardwareDeviceIdList'),
    devicesList: document.getElementById('dbAdminDevicesList'),
    mismatchLogList: document.getElementById('dbAdminMismatchLogList'),
    createUserId: document.getElementById('dbAdminCreateUserId'),
    createUsername: document.getElementById('dbAdminCreateUsername'),
    createAvatarUrl: document.getElementById('dbAdminCreateAvatarUrl'),
    createPlainPassword: document.getElementById('dbAdminCreatePlainPassword'),
    createIsTempUser: document.getElementById('dbAdminCreateIsTempUser'),
    subtabButtons: Array.from(document.querySelectorAll('[data-db-subtab-target]')),
    subtabPanels: Array.from(document.querySelectorAll('[data-db-subtab-panel]')),
    btnAddUnlockedSkin: document.getElementById('btnDbAdminAddUnlockedSkin'),
    btnAddHardwareDeviceId: document.getElementById('btnDbAdminAddHardwareDeviceId'),
    btnAddDevice: document.getElementById('btnDbAdminAddDevice'),
    btnAddMismatchLog: document.getElementById('btnDbAdminAddMismatchLog'),
    userId: document.getElementById('dbAdminUserId'),
    username: document.getElementById('dbAdminUsername'),
    avatarUrl: document.getElementById('dbAdminAvatarUrl'),
    createdAt: document.getElementById('dbAdminCreatedAt'),
    lastActiveAt: document.getElementById('dbAdminLastActiveAt'),
    isTempUser: document.getElementById('dbAdminIsTempUser'),
    passwordAlgorithm: document.getElementById('dbAdminPasswordAlgorithm'),
    plainPassword: document.getElementById('dbAdminPlainPassword'),
    passwordSalt: document.getElementById('dbAdminPasswordSalt'),
    passwordHash: document.getElementById('dbAdminPasswordHash'),
    primaryDeviceId: document.getElementById('dbAdminPrimaryDeviceId'),
    coins: document.getElementById('dbAdminCoins'),
    maxUnlockedLevel: document.getElementById('dbAdminMaxUnlockedLevel'),
    maxClearedLevel: document.getElementById('dbAdminMaxClearedLevel'),
    progressCurrentLevel: document.getElementById('dbAdminProgressCurrentLevel'),
    progressSelectedSkinId: document.getElementById('dbAdminProgressSelectedSkinId'),
    progressNextRewardLevelIndex: document.getElementById('dbAdminProgressNextRewardLevelIndex'),
    progressRewardGuideShown: document.getElementById('dbAdminProgressRewardGuideShown'),
    inventorySkinFragment: document.getElementById('dbAdminInventorySkinFragment'),
    inventoryHint: document.getElementById('dbAdminInventoryHint'),
    inventoryUndo: document.getElementById('dbAdminInventoryUndo'),
    inventoryShuffle: document.getElementById('dbAdminInventoryShuffle'),
    checkinClaimedCount: document.getElementById('dbAdminCheckinClaimedCount'),
    checkinLastClaimDayKey: document.getElementById('dbAdminCheckinLastClaimDayKey'),
    onlineRewardDayKey: document.getElementById('dbAdminOnlineRewardDayKey'),
    onlineRewardTierIndex: document.getElementById('dbAdminOnlineRewardTierIndex'),
    onlineRewardRemainingSeconds: document.getElementById('dbAdminOnlineRewardRemainingSeconds')
};

const state = {
    offset: 0,
    total: 0,
    selectedUserId: '',
    detail: null,
    jsonDirty: false
};

function setStatus(text, isError = false) {
    if (!el.status) return;
    el.status.textContent = text || '';
    el.status.style.color = isError ? '#9d2b22' : '#466f27';
}

function readAdminKey() {
    const inputValue = `${el.keyInput?.value || ''}`.trim();
    if (inputValue) return inputValue;
    return `${sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY) || ''}`.trim();
}

function persistAdminKeyIfPresent() {
    const key = `${el.keyInput?.value || ''}`.trim();
    if (key) sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
}

function readPageSize() {
    const n = Number(el.pageSizeInput?.value || 50);
    if (!Number.isFinite(n)) return 50;
    return Math.max(10, Math.min(200, Math.floor(n)));
}

async function fetchAdminJson(url, options = {}) {
    persistAdminKeyIfPresent();
    const key = readAdminKey();
    const headers = { ...(options.headers || {}) };
    if (key) headers['x-admin-key'] = key;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
}

function escapeHtml(text) {
    return `${text || ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatIso(value) {
    const text = `${value || ''}`.trim();
    if (!text) return '-';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleString('zh-CN', { hour12: false });
}

function toDatetimeLocalValue(value) {
    const text = `${value || ''}`.trim();
    if (!text) return '';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value, fallback = '') {
    const text = `${value || ''}`.trim();
    if (!text) return fallback;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function createEmptyDetail() {
    return {
        userId: '',
        username: '',
        avatarUrl: '',
        isTempUser: false,
        createdAt: '',
        lastActiveAt: '',
        primaryDeviceId: '',
        hardwareDeviceIds: [],
        devices: [],
        cookieDeviceMismatchLogs: [],
        coins: 0,
        maxUnlockedLevel: 1,
        maxClearedLevel: 0,
        unlockedSkinIds: ['classic-burrow'],
        progress: {
            currentLevel: 1,
            selectedSkinId: 'classic-burrow',
            nextRewardLevelIndex: 1,
            rewardGuideShown: false
        },
        liveopsPlayer: {
            inventory: { skin_fragment: 0, hint: 0, undo: 0, shuffle: 0 },
            checkin: { claimedCount: 0, lastClaimDayKey: '' },
            onlineReward: { dayKey: '', tierIndex: 0, remainingSeconds: 0 }
        },
        passwordAlgorithm: 'sha256-v1',
        passwordSalt: '',
        passwordHash: ''
    };
}

function normalizeDetail(user) {
    const base = createEmptyDetail();
    const source = user && typeof user === 'object' ? user : {};
    return {
        ...base,
        ...source,
        hardwareDeviceIds: Array.isArray(source.hardwareDeviceIds) ? source.hardwareDeviceIds.map((v) => `${v || ''}`) : [],
        devices: Array.isArray(source.devices) ? source.devices.map((row) => ({
            deviceId: `${row?.deviceId || ''}`,
            deviceInfo: `${row?.deviceInfo || ''}`,
            firstSeenAt: `${row?.firstSeenAt || ''}`,
            lastSeenAt: `${row?.lastSeenAt || ''}`
        })) : [],
        cookieDeviceMismatchLogs: Array.isArray(source.cookieDeviceMismatchLogs) ? source.cookieDeviceMismatchLogs.map((row) => ({
            at: `${row?.at || ''}`,
            cookieUserId: `${row?.cookieUserId || ''}`,
            userId: `${row?.userId || ''}`,
            deviceId: `${row?.deviceId || ''}`
        })) : [],
        unlockedSkinIds: Array.isArray(source.unlockedSkinIds) ? source.unlockedSkinIds.map((v) => `${v || ''}`) : ['classic-burrow'],
        progress: {
            ...base.progress,
            ...(source.progress || {})
        },
        liveopsPlayer: {
            ...base.liveopsPlayer,
            ...(source.liveopsPlayer || {}),
            inventory: {
                ...base.liveopsPlayer.inventory,
                ...(source.liveopsPlayer?.inventory || {})
            },
            checkin: {
                ...base.liveopsPlayer.checkin,
                ...(source.liveopsPlayer?.checkin || {})
            },
            onlineReward: {
                ...base.liveopsPlayer.onlineReward,
                ...(source.liveopsPlayer?.onlineReward || {})
            }
        }
    };
}

function renderUsers(rows) {
    if (!el.rows) return;
    el.rows.innerHTML = '';
    const source = Array.isArray(rows) ? rows : [];
    if (source.length === 0) {
        el.rows.innerHTML = '<tr><td colspan="7">暂无数据</td></tr>';
        return;
    }
    for (const row of source) {
        const tr = document.createElement('tr');
        if (`${row.userId || ''}` === state.selectedUserId) tr.classList.add('is-active');
        tr.innerHTML = `
            <td>${escapeHtml(row.userId || '')}</td>
            <td>${escapeHtml(row.username || '')}</td>
            <td>${row.isTempUser ? '临时' : '正式'}</td>
            <td>${Number(row.coins || 0)}</td>
            <td>${Number(row.maxClearedLevel || 0)}</td>
            <td>${escapeHtml(formatIso(row.lastActiveAt || ''))}</td>
            <td><button type="button" data-user-id="${escapeHtml(row.userId || '')}">查看</button></td>
        `;
        el.rows.appendChild(tr);
    }
    for (const btn of el.rows.querySelectorAll('button[data-user-id]')) {
        btn.addEventListener('click', () => {
            const userId = `${btn.getAttribute('data-user-id') || ''}`.trim();
            if (userId) void loadUserDetail(userId);
        });
    }
}

function setSelectedLabel(user) {
    if (!el.selectedUserLabel) return;
    if (!user?.userId) {
        el.selectedUserLabel.textContent = '未选择用户';
        return;
    }
    el.selectedUserLabel.textContent = `${user.username || '未命名'} · ${user.userId}`;
}

function renderStringList(container, values, placeholder) {
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(values) || values.length === 0) {
        container.innerHTML = '<div class="db-admin-empty">暂无记录</div>';
        return;
    }
    values.forEach((value, index) => {
        const item = document.createElement('div');
        item.className = 'db-admin-list-item';
        item.innerHTML = `
            <input type="text" data-index="${index}" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder)}">
            <button type="button" data-remove-index="${index}">删除</button>
        `;
        container.appendChild(item);
    });
    for (const input of container.querySelectorAll('input[data-index]')) {
        input.addEventListener('input', () => {
            const idx = Number(input.getAttribute('data-index'));
            values[idx] = input.value;
            syncDetailJson(false);
        });
    }
    for (const btn of container.querySelectorAll('button[data-remove-index]')) {
        btn.addEventListener('click', () => {
            const idx = Number(btn.getAttribute('data-remove-index'));
            values.splice(idx, 1);
            rerenderDetailLists();
            syncDetailJson(false);
        });
    }
}

function bindObjectListInputs(container, values, applyValue) {
    for (const input of container.querySelectorAll('input[data-field]')) {
        input.addEventListener('input', () => {
            const index = Number(input.getAttribute('data-index'));
            const field = `${input.getAttribute('data-field') || ''}`;
            applyValue(values[index], field, input.value);
            syncDetailJson(false);
        });
    }
    for (const btn of container.querySelectorAll('button[data-remove-index]')) {
        btn.addEventListener('click', () => {
            const index = Number(btn.getAttribute('data-remove-index'));
            values.splice(index, 1);
            rerenderDetailLists();
            syncDetailJson(false);
        });
    }
}

function renderDevicesList() {
    if (!el.devicesList) return;
    const rows = state.detail?.devices || [];
    el.devicesList.innerHTML = '';
    if (rows.length === 0) {
        el.devicesList.innerHTML = '<div class="db-admin-empty">暂无设备记录</div>';
        return;
    }
    rows.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = 'db-admin-object-item';
        item.innerHTML = `
            <div class="db-admin-object-item-grid">
                <label class="field"><span>设备 ID</span><input type="text" data-field="deviceId" data-index="${index}" value="${escapeHtml(row.deviceId || '')}"></label>
                <label class="field"><span>设备信息</span><input type="text" data-field="deviceInfo" data-index="${index}" value="${escapeHtml(row.deviceInfo || '')}"></label>
                <label class="field"><span>首次出现</span><input type="datetime-local" data-field="firstSeenAt" data-index="${index}" value="${escapeHtml(toDatetimeLocalValue(row.firstSeenAt || ''))}"></label>
                <label class="field"><span>最近出现</span><input type="datetime-local" data-field="lastSeenAt" data-index="${index}" value="${escapeHtml(toDatetimeLocalValue(row.lastSeenAt || ''))}"></label>
            </div>
            <div class="db-admin-inline-actions"><button type="button" data-remove-index="${index}">删除</button></div>
        `;
        el.devicesList.appendChild(item);
    });
    bindObjectListInputs(el.devicesList, rows, (row, field, value) => {
        row[field] = field.endsWith('At') ? fromDatetimeLocalValue(value, '') : value;
    });
}

function renderMismatchLogs() {
    if (!el.mismatchLogList) return;
    const rows = state.detail?.cookieDeviceMismatchLogs || [];
    el.mismatchLogList.innerHTML = '';
    if (rows.length === 0) {
        el.mismatchLogList.innerHTML = '<div class="db-admin-empty">暂无不匹配日志</div>';
        return;
    }
    rows.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = 'db-admin-object-item';
        item.innerHTML = `
            <div class="db-admin-object-item-grid">
                <label class="field"><span>发生时间</span><input type="datetime-local" data-field="at" data-index="${index}" value="${escapeHtml(toDatetimeLocalValue(row.at || ''))}"></label>
                <label class="field"><span>Cookie 用户 ID</span><input type="text" data-field="cookieUserId" data-index="${index}" value="${escapeHtml(row.cookieUserId || '')}"></label>
                <label class="field"><span>当前用户 ID</span><input type="text" data-field="userId" data-index="${index}" value="${escapeHtml(row.userId || '')}"></label>
                <label class="field"><span>设备 ID</span><input type="text" data-field="deviceId" data-index="${index}" value="${escapeHtml(row.deviceId || '')}"></label>
            </div>
            <div class="db-admin-inline-actions"><button type="button" data-remove-index="${index}">删除</button></div>
        `;
        el.mismatchLogList.appendChild(item);
    });
    bindObjectListInputs(el.mismatchLogList, rows, (row, field, value) => {
        row[field] = field === 'at' ? fromDatetimeLocalValue(value, '') : value;
    });
}

function rerenderDetailLists() {
    renderStringList(el.unlockedSkinList, state.detail?.unlockedSkinIds || [], '皮肤 ID');
    renderStringList(el.hardwareDeviceIdList, state.detail?.hardwareDeviceIds || [], '硬件设备 ID');
    renderDevicesList();
    renderMismatchLogs();
}

function populateDetail(user) {
    state.detail = normalizeDetail(user);
    state.selectedUserId = `${state.detail.userId || ''}`;
    if (el.userId) el.userId.value = state.detail.userId || '';
    if (el.username) el.username.value = state.detail.username || '';
    if (el.avatarUrl) el.avatarUrl.value = state.detail.avatarUrl || '';
    if (el.createdAt) el.createdAt.value = toDatetimeLocalValue(state.detail.createdAt || '');
    if (el.lastActiveAt) el.lastActiveAt.value = toDatetimeLocalValue(state.detail.lastActiveAt || '');
    if (el.isTempUser) el.isTempUser.checked = state.detail.isTempUser === true;
    if (el.passwordAlgorithm) el.passwordAlgorithm.value = state.detail.passwordAlgorithm || 'sha256-v1';
    if (el.plainPassword) el.plainPassword.value = '';
    if (el.passwordSalt) el.passwordSalt.value = state.detail.passwordSalt || '';
    if (el.passwordHash) el.passwordHash.value = state.detail.passwordHash || '';
    if (el.primaryDeviceId) el.primaryDeviceId.value = state.detail.primaryDeviceId || '';
    if (el.coins) el.coins.value = String(Number(state.detail.coins || 0));
    if (el.maxUnlockedLevel) el.maxUnlockedLevel.value = String(Number(state.detail.maxUnlockedLevel || 1));
    if (el.maxClearedLevel) el.maxClearedLevel.value = String(Number(state.detail.maxClearedLevel || 0));
    if (el.progressCurrentLevel) el.progressCurrentLevel.value = String(Number(state.detail.progress?.currentLevel || 1));
    if (el.progressSelectedSkinId) el.progressSelectedSkinId.value = state.detail.progress?.selectedSkinId || '';
    if (el.progressNextRewardLevelIndex) el.progressNextRewardLevelIndex.value = String(Number(state.detail.progress?.nextRewardLevelIndex || 1));
    if (el.progressRewardGuideShown) el.progressRewardGuideShown.checked = state.detail.progress?.rewardGuideShown === true;
    if (el.inventorySkinFragment) el.inventorySkinFragment.value = String(Number(state.detail.liveopsPlayer?.inventory?.skin_fragment || 0));
    if (el.inventoryHint) el.inventoryHint.value = String(Number(state.detail.liveopsPlayer?.inventory?.hint || 0));
    if (el.inventoryUndo) el.inventoryUndo.value = String(Number(state.detail.liveopsPlayer?.inventory?.undo || 0));
    if (el.inventoryShuffle) el.inventoryShuffle.value = String(Number(state.detail.liveopsPlayer?.inventory?.shuffle || 0));
    if (el.checkinClaimedCount) el.checkinClaimedCount.value = String(Number(state.detail.liveopsPlayer?.checkin?.claimedCount || 0));
    if (el.checkinLastClaimDayKey) el.checkinLastClaimDayKey.value = state.detail.liveopsPlayer?.checkin?.lastClaimDayKey || '';
    if (el.onlineRewardDayKey) el.onlineRewardDayKey.value = state.detail.liveopsPlayer?.onlineReward?.dayKey || '';
    if (el.onlineRewardTierIndex) el.onlineRewardTierIndex.value = String(Number(state.detail.liveopsPlayer?.onlineReward?.tierIndex || 0));
    if (el.onlineRewardRemainingSeconds) el.onlineRewardRemainingSeconds.value = String(Number(state.detail.liveopsPlayer?.onlineReward?.remainingSeconds || 0));
    rerenderDetailLists();
    syncDetailJson(true);
    setSelectedLabel(state.detail);
}

function syncDetailJson(resetDirty) {
    if (!el.detailJson) return;
    el.detailJson.value = JSON.stringify(collectDetailFromForm(), null, 2);
    if (resetDirty) state.jsonDirty = false;
}

function parseJsonEditorIntoForm() {
    const text = `${el.detailJson?.value || ''}`.trim();
    if (!text) return true;
    try {
        populateDetail(JSON.parse(text));
        return true;
    } catch (error) {
        setStatus(`高级 JSON 解析失败：${error?.message || 'invalid json'}`, true);
        return false;
    }
}

function numberValue(input, fallback = 0, min = 0) {
    const value = Number(input?.value || fallback);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.floor(value));
}

function collectDetailFromForm() {
    const base = state.detail || createEmptyDetail();
    return normalizeDetail({
        ...base,
        userId: `${el.userId?.value || base.userId || ''}`.trim(),
        username: `${el.username?.value || ''}`.trim(),
        avatarUrl: `${el.avatarUrl?.value || ''}`.trim(),
        isTempUser: el.isTempUser?.checked === true,
        createdAt: fromDatetimeLocalValue(el.createdAt?.value || '', base.createdAt || ''),
        lastActiveAt: fromDatetimeLocalValue(el.lastActiveAt?.value || '', base.lastActiveAt || ''),
        primaryDeviceId: `${el.primaryDeviceId?.value || ''}`.trim(),
        hardwareDeviceIds: (state.detail?.hardwareDeviceIds || []).map((v) => `${v || ''}`.trim()).filter(Boolean),
        devices: (state.detail?.devices || []).map((row) => ({
            deviceId: `${row?.deviceId || ''}`.trim(),
            deviceInfo: `${row?.deviceInfo || ''}`.trim(),
            firstSeenAt: `${row?.firstSeenAt || ''}`.trim(),
            lastSeenAt: `${row?.lastSeenAt || ''}`.trim()
        })),
        cookieDeviceMismatchLogs: (state.detail?.cookieDeviceMismatchLogs || []).map((row) => ({
            at: `${row?.at || ''}`.trim(),
            cookieUserId: `${row?.cookieUserId || ''}`.trim(),
            userId: `${row?.userId || ''}`.trim(),
            deviceId: `${row?.deviceId || ''}`.trim()
        })),
        coins: numberValue(el.coins, base.coins || 0, 0),
        maxUnlockedLevel: numberValue(el.maxUnlockedLevel, base.maxUnlockedLevel || 1, 1),
        maxClearedLevel: numberValue(el.maxClearedLevel, base.maxClearedLevel || 0, 0),
        unlockedSkinIds: (state.detail?.unlockedSkinIds || []).map((v) => `${v || ''}`.trim()).filter(Boolean),
        progress: {
            ...base.progress,
            currentLevel: numberValue(el.progressCurrentLevel, base.progress?.currentLevel || 1, 1),
            selectedSkinId: `${el.progressSelectedSkinId?.value || ''}`.trim(),
            nextRewardLevelIndex: numberValue(el.progressNextRewardLevelIndex, base.progress?.nextRewardLevelIndex || 1, 1),
            rewardGuideShown: el.progressRewardGuideShown?.checked === true
        },
        liveopsPlayer: {
            ...base.liveopsPlayer,
            inventory: {
                skin_fragment: numberValue(el.inventorySkinFragment, base.liveopsPlayer?.inventory?.skin_fragment || 0, 0),
                hint: numberValue(el.inventoryHint, base.liveopsPlayer?.inventory?.hint || 0, 0),
                undo: numberValue(el.inventoryUndo, base.liveopsPlayer?.inventory?.undo || 0, 0),
                shuffle: numberValue(el.inventoryShuffle, base.liveopsPlayer?.inventory?.shuffle || 0, 0)
            },
            checkin: {
                claimedCount: numberValue(el.checkinClaimedCount, base.liveopsPlayer?.checkin?.claimedCount || 0, 0),
                lastClaimDayKey: `${el.checkinLastClaimDayKey?.value || ''}`.trim()
            },
            onlineReward: {
                dayKey: `${el.onlineRewardDayKey?.value || ''}`.trim(),
                tierIndex: numberValue(el.onlineRewardTierIndex, base.liveopsPlayer?.onlineReward?.tierIndex || 0, 0),
                remainingSeconds: numberValue(el.onlineRewardRemainingSeconds, base.liveopsPlayer?.onlineReward?.remainingSeconds || 0, 0)
            }
        },
        passwordAlgorithm: `${el.passwordAlgorithm?.value || base.passwordAlgorithm || 'sha256-v1'}`.trim() || 'sha256-v1',
        passwordSalt: `${el.passwordSalt?.value || ''}`.trim(),
        passwordHash: `${el.passwordHash?.value || ''}`.trim()
    });
}

function buildSavePayload() {
    const detail = collectDetailFromForm();
    return {
        userId: detail.userId,
        username: detail.username,
        avatarUrl: detail.avatarUrl,
        isTempUser: detail.isTempUser,
        createdAt: detail.createdAt,
        lastActiveAt: detail.lastActiveAt,
        primaryDeviceId: detail.primaryDeviceId,
        hardwareDeviceIds: detail.hardwareDeviceIds,
        devices: detail.devices,
        cookieDeviceMismatchLogs: detail.cookieDeviceMismatchLogs,
        coins: detail.coins,
        maxUnlockedLevel: detail.maxUnlockedLevel,
        maxClearedLevel: detail.maxClearedLevel,
        unlockedSkinIds: detail.unlockedSkinIds,
        progress: detail.progress,
        liveopsPlayer: detail.liveopsPlayer,
        passwordAlgorithm: detail.passwordAlgorithm,
        passwordSalt: detail.passwordSalt,
        passwordHash: detail.passwordHash,
        plainPassword: `${el.plainPassword?.value || ''}`
    };
}

async function loadOverview() {
    const payload = await fetchAdminJson('/api/admin/db/overview');
    el.backend.textContent = payload.backend || '-';
    el.totalUsers.textContent = `${Number(payload.totalUsers || 0)}`;
    el.tempUsers.textContent = `${Number(payload.tempUsers || 0)}`;
}

async function searchUsers(resetOffset = false) {
    if (resetOffset) state.offset = 0;
    const pageSize = readPageSize();
    const q = `${el.queryInput?.value || ''}`.trim();
    const params = new URLSearchParams({ limit: `${pageSize}`, offset: `${state.offset}` });
    if (q) params.set('q', q);
    const payload = await fetchAdminJson(`/api/admin/db/users?${params.toString()}`);
    state.total = Number(payload.total || 0);
    renderUsers(payload.rows || []);
    el.offset.textContent = `${state.offset}`;
}

async function loadUserDetail(userId) {
    const payload = await fetchAdminJson(`/api/admin/db/users/${encodeURIComponent(userId)}`);
    populateDetail(payload.user || {});
    await searchUsers(false);
    setStatus(`已加载用户详情：${userId}`);
}

async function refreshAll(resetOffset = false) {
    try {
        setStatus('加载中...');
        await loadOverview();
        await searchUsers(resetOffset);
        setStatus('加载成功。');
    } catch (error) {
        setStatus(`加载失败：${error?.message || 'unknown error'}`, true);
    }
}

function resetCreateForm() {
    if (el.createUserId) el.createUserId.value = '';
    if (el.createUsername) el.createUsername.value = '';
    if (el.createAvatarUrl) el.createAvatarUrl.value = '';
    if (el.createPlainPassword) el.createPlainPassword.value = '';
    if (el.createIsTempUser) el.createIsTempUser.checked = false;
}

async function handleCreateUser() {
    try {
        setStatus('正在创建用户...');
        const payload = await fetchAdminJson('/api/admin/db/users', {
            method: 'POST',
            body: {
                userId: `${el.createUserId?.value || ''}`.trim(),
                username: `${el.createUsername?.value || ''}`.trim(),
                avatarUrl: `${el.createAvatarUrl?.value || ''}`.trim(),
                plainPassword: `${el.createPlainPassword?.value || ''}`,
                isTempUser: el.createIsTempUser?.checked === true
            }
        });
        resetCreateForm();
        await refreshAll(true);
        if (payload.user?.userId) await loadUserDetail(payload.user.userId);
        setStatus(`创建成功：${payload.user?.userId || ''}`);
    } catch (error) {
        setStatus(`创建失败：${error?.message || 'unknown error'}`, true);
    }
}

async function handleSaveUser() {
    if (!state.selectedUserId) {
        setStatus('请先选择用户。', true);
        return;
    }
    if (state.jsonDirty && !parseJsonEditorIntoForm()) return;
    try {
        setStatus('正在保存用户...');
        const result = await fetchAdminJson(`/api/admin/db/users/${encodeURIComponent(state.selectedUserId)}`, {
            method: 'PUT',
            body: buildSavePayload()
        });
        populateDetail(result.user || {});
        await refreshAll(false);
        setStatus(`保存成功：${state.selectedUserId}`);
    } catch (error) {
        setStatus(`保存失败：${error?.message || 'unknown error'}`, true);
    }
}

async function handleInitUser() {
    if (!state.selectedUserId) {
        setStatus('请先选择用户。', true);
        return;
    }
    if (!window.confirm(`确认将 ${state.selectedUserId} 的玩家数据初始化到刚注册时的状态吗？`)) return;
    try {
        setStatus('正在初始化玩家数据...');
        const result = await fetchAdminJson(`/api/admin/db/users/${encodeURIComponent(state.selectedUserId)}/initialize-player`, {
            method: 'POST'
        });
        populateDetail(result.user || {});
        await refreshAll(false);
        setStatus(`已初始化玩家数据：${state.selectedUserId}`);
    } catch (error) {
        setStatus(`初始化玩家数据失败：${error?.message || 'unknown error'}`, true);
    }
}

async function handleDeleteUser() {
    if (!state.selectedUserId) {
        setStatus('请先选择用户。', true);
        return;
    }
    if (!window.confirm(`确认删除用户 ${state.selectedUserId} 吗？`)) return;
    try {
        await fetchAdminJson(`/api/admin/db/users/${encodeURIComponent(state.selectedUserId)}`, { method: 'DELETE' });
        state.selectedUserId = '';
        populateDetail(createEmptyDetail());
        await refreshAll(false);
        setStatus('用户已删除。');
    } catch (error) {
        setStatus(`删除失败：${error?.message || 'unknown error'}`, true);
    }
}

function bindFormSync() {
    const inputs = [
        el.username, el.avatarUrl, el.createdAt, el.lastActiveAt, el.isTempUser,
        el.passwordAlgorithm, el.passwordSalt, el.passwordHash, el.primaryDeviceId,
        el.coins, el.maxUnlockedLevel, el.maxClearedLevel, el.progressCurrentLevel,
        el.progressSelectedSkinId, el.progressNextRewardLevelIndex, el.progressRewardGuideShown,
        el.inventorySkinFragment, el.inventoryHint, el.inventoryUndo, el.inventoryShuffle,
        el.checkinClaimedCount, el.checkinLastClaimDayKey, el.onlineRewardDayKey,
        el.onlineRewardTierIndex, el.onlineRewardRemainingSeconds
    ].filter(Boolean);
    for (const input of inputs) {
        input.addEventListener('input', () => syncDetailJson(false));
        input.addEventListener('change', () => syncDetailJson(false));
    }
    el.detailJson?.addEventListener('input', () => {
        state.jsonDirty = true;
    });
}

function bindSubtabs() {
    for (const btn of el.subtabButtons) {
        btn.addEventListener('click', () => {
            const target = `${btn.dataset.dbSubtabTarget || ''}`;
            for (const other of el.subtabButtons) {
                const active = other === btn;
                other.classList.toggle('is-active', active);
                other.setAttribute('aria-selected', active ? 'true' : 'false');
            }
            for (const panel of el.subtabPanels) {
                panel.classList.toggle('is-active', panel.dataset.dbSubtabPanel === target);
            }
        });
    }
}

function initEvents() {
    el.keyInput?.addEventListener('change', persistAdminKeyIfPresent);
    el.btnOverview?.addEventListener('click', () => void refreshAll(false));
    el.btnSearch?.addEventListener('click', () => void refreshAll(true));
    el.btnPrev?.addEventListener('click', () => {
        state.offset = Math.max(0, state.offset - readPageSize());
        void refreshAll(false);
    });
    el.btnNext?.addEventListener('click', () => {
        const pageSize = readPageSize();
        if (state.offset + pageSize < state.total) state.offset += pageSize;
        void refreshAll(false);
    });
    el.queryInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void refreshAll(true);
        }
    });
    el.btnCreateUser?.addEventListener('click', () => void handleCreateUser());
    el.btnResetCreate?.addEventListener('click', resetCreateForm);
    el.btnInitUser?.addEventListener('click', () => void handleInitUser());
    el.btnReloadUser?.addEventListener('click', () => {
        if (state.selectedUserId) void loadUserDetail(state.selectedUserId);
    });
    el.btnSaveUser?.addEventListener('click', () => void handleSaveUser());
    el.btnDeleteUser?.addEventListener('click', () => void handleDeleteUser());
    el.btnAddUnlockedSkin?.addEventListener('click', () => {
        state.detail.unlockedSkinIds.push('');
        rerenderDetailLists();
        syncDetailJson(false);
    });
    el.btnAddHardwareDeviceId?.addEventListener('click', () => {
        state.detail.hardwareDeviceIds.push('');
        rerenderDetailLists();
        syncDetailJson(false);
    });
    el.btnAddDevice?.addEventListener('click', () => {
        state.detail.devices.push({ deviceId: '', deviceInfo: '', firstSeenAt: '', lastSeenAt: '' });
        rerenderDetailLists();
        syncDetailJson(false);
    });
    el.btnAddMismatchLog?.addEventListener('click', () => {
        state.detail.cookieDeviceMismatchLogs.push({ at: '', cookieUserId: '', userId: state.selectedUserId || '', deviceId: '' });
        rerenderDetailLists();
        syncDetailJson(false);
    });
}

function hydrateSavedKey() {
    const key = `${sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY) || ''}`.trim();
    if (key && el.keyInput) el.keyInput.value = key;
}

function init() {
    if (!el.status) return;
    hydrateSavedKey();
    bindSubtabs();
    bindFormSync();
    initEvents();
    populateDetail(createEmptyDetail());
}

init();

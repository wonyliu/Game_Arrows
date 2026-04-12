const ADMIN_KEY_STORAGE_KEY = 'arrowClear_adminApiKey';

const el = {
    keyInput: document.getElementById('dbAdminKey'),
    queryInput: document.getElementById('dbAdminQuery'),
    pageSizeInput: document.getElementById('dbAdminPageSize'),
    btnOverview: document.getElementById('btnDbAdminLoadOverview'),
    btnSearch: document.getElementById('btnDbAdminSearchUsers'),
    btnPrev: document.getElementById('btnDbAdminPrevPage'),
    btnNext: document.getElementById('btnDbAdminNextPage'),
    status: document.getElementById('dbAdminStatus'),
    backend: document.getElementById('dbAdminBackend'),
    totalUsers: document.getElementById('dbAdminTotalUsers'),
    tempUsers: document.getElementById('dbAdminTempUsers'),
    offset: document.getElementById('dbAdminOffset'),
    rows: document.getElementById('dbAdminUserRows'),
    detailJson: document.getElementById('dbAdminUserDetailJson')
};

const state = {
    offset: 0,
    total: 0
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
    if (key) {
        sessionStorage.setItem(ADMIN_KEY_STORAGE_KEY, key);
    }
}

function readPageSize() {
    const n = Number(el.pageSizeInput?.value || 50);
    if (!Number.isFinite(n)) return 50;
    return Math.max(10, Math.min(200, Math.floor(n)));
}

async function fetchAdminJson(url, options = {}) {
    persistAdminKeyIfPresent();
    const key = readAdminKey();
    const headers = {
        ...(options.headers || {})
    };
    if (key) {
        headers['x-admin-key'] = key;
    }
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
}

function renderUsers(rows) {
    if (!el.rows) return;
    el.rows.innerHTML = '';
    const source = Array.isArray(rows) ? rows : [];
    if (source.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = '无数据';
        tr.appendChild(td);
        el.rows.appendChild(tr);
        return;
    }
    for (const row of source) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(row.userId || '')}</td>
            <td>${escapeHtml(row.username || '')}</td>
            <td>${row.isTempUser ? '临时' : '正式'}</td>
            <td>${Number(row.coins || 0)}</td>
            <td>${Number(row.maxClearedLevel || 0)}</td>
            <td>${escapeHtml(formatIso(row.lastActiveAt || ''))}</td>
            <td><button type="button" data-user-id="${escapeHtmlAttr(row.userId || '')}">查看</button></td>
        `;
        el.rows.appendChild(tr);
    }

    for (const btn of el.rows.querySelectorAll('button[data-user-id]')) {
        btn.addEventListener('click', () => {
            const userId = `${btn.getAttribute('data-user-id') || ''}`.trim();
            if (!userId) return;
            void loadUserDetail(userId);
        });
    }
}

function escapeHtml(text) {
    return `${text || ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(text) {
    return escapeHtml(text).replace(/`/g, '&#96;');
}

function formatIso(value) {
    const text = `${value || ''}`.trim();
    if (!text) return '-';
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleString('zh-CN', { hour12: false });
}

async function loadOverview() {
    const payload = await fetchAdminJson('/api/admin/db/overview');
    el.backend.textContent = payload.backend || '-';
    el.totalUsers.textContent = `${Number(payload.totalUsers || 0)}`;
    el.tempUsers.textContent = `${Number(payload.tempUsers || 0)}`;
}

async function searchUsers(resetOffset = false) {
    if (resetOffset) {
        state.offset = 0;
    }
    const pageSize = readPageSize();
    const q = `${el.queryInput?.value || ''}`.trim();
    const params = new URLSearchParams({
        limit: `${pageSize}`,
        offset: `${state.offset}`
    });
    if (q) {
        params.set('q', q);
    }
    const payload = await fetchAdminJson(`/api/admin/db/users?${params.toString()}`);
    state.total = Number(payload.total || 0);
    renderUsers(payload.rows || []);
    el.offset.textContent = `${state.offset}`;
}

async function loadUserDetail(userId) {
    const payload = await fetchAdminJson(`/api/admin/db/users/${encodeURIComponent(userId)}`);
    if (el.detailJson) {
        el.detailJson.value = JSON.stringify(payload.user || {}, null, 2);
    }
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

function initEvents() {
    el.keyInput?.addEventListener('change', () => {
        persistAdminKeyIfPresent();
    });
    el.btnOverview?.addEventListener('click', () => {
        void refreshAll(false);
    });
    el.btnSearch?.addEventListener('click', () => {
        void refreshAll(true);
    });
    el.btnPrev?.addEventListener('click', () => {
        const pageSize = readPageSize();
        state.offset = Math.max(0, state.offset - pageSize);
        void refreshAll(false);
    });
    el.btnNext?.addEventListener('click', () => {
        const pageSize = readPageSize();
        if (state.offset + pageSize < state.total) {
            state.offset += pageSize;
        }
        void refreshAll(false);
    });
    el.queryInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void refreshAll(true);
        }
    });
}

function hydrateSavedKey() {
    const key = `${sessionStorage.getItem(ADMIN_KEY_STORAGE_KEY) || ''}`.trim();
    if (key && el.keyInput) {
        el.keyInput.value = key;
    }
}

function init() {
    if (!el.status) return;
    hydrateSavedKey();
    initEvents();
}

init();

import {
    DEFAULT_LIVEOPS_CONFIG,
    DEFAULT_LIVEOPS_PLAYER_STATE,
    initLiveOpsStorage,
    readLiveOpsConfig,
    readLiveOpsPlayerState,
    syncLiveOpsPlayerToServer,
    writeLiveOpsConfig,
    writeLiveOpsPlayerState
} from './liveops-storage.js?v=5';
import { bootstrapUserSessionFromStorage } from './user-auth.js?v=3';

const el = {
    itemList: document.getElementById('liveopsItemList'),
    itemId: document.getElementById('liveopsItemId'),
    itemNameZh: document.getElementById('liveopsItemNameZh'),
    itemNameEn: document.getElementById('liveopsItemNameEn'),
    itemType: document.getElementById('liveopsItemType'),
    itemStatus: document.getElementById('liveopsItemStatus'),
    btnItemSave: document.getElementById('btnLiveopsItemSave'),
    btnItemDelete: document.getElementById('btnLiveopsItemDelete'),
    btnItemClear: document.getElementById('btnLiveopsItemClear'),

    eventsSubtabButtons: Array.from(document.querySelectorAll('[data-events-subtab]')),
    eventsSubpanels: Array.from(document.querySelectorAll('[data-events-subpanel]')),
    checkinCycleDays: document.getElementById('eventCheckinCycleDays'),
    checkinRewardRows: document.getElementById('checkinRewardRows'),
    btnAddCheckinRewardRow: document.getElementById('btnAddCheckinRewardRow'),
    onlineResetHour: document.getElementById('eventOnlineResetHour'),
    onlineRewardRows: document.getElementById('onlineRewardRows'),
    btnAddOnlineRewardRow: document.getElementById('btnAddOnlineRewardRow'),
    btnSaveActivities: document.getElementById('btnSaveLiveopsActivities'),
    btnResetActivities: document.getElementById('btnResetLiveopsActivities'),
    activityStatus: document.getElementById('liveopsActivityStatus'),
    btnToolResetCheckin: document.getElementById('btnToolResetCheckin'),
    btnToolResetOnlineReward: document.getElementById('btnToolResetOnlineReward'),
    btnToolResetLiveopsAll: document.getElementById('btnToolResetLiveopsAll'),
    toolStatus: document.getElementById('toolStatus')
};

const state = {
    config: null,
    selectedItemId: '',
    checkinRows: [],
    onlineRows: []
};

async function init() {
    if (!el.itemList || !el.btnSaveActivities) {
        return;
    }

    bootstrapUserSessionFromStorage();
    await initLiveOpsStorage().catch((error) => {
        console.warn('[admin-liveops] init storage failed', error);
    });
    loadConfig();
    bindEvents();
    renderAll();
}

function ensureToolUserSession() {
    return !!bootstrapUserSessionFromStorage()?.userId;
}

function bindEvents() {
    el.btnItemSave?.addEventListener('click', onSaveItem);
    el.btnItemDelete?.addEventListener('click', onDeleteItem);
    el.btnItemClear?.addEventListener('click', () => {
        state.selectedItemId = '';
        fillItemEditor(null);
        renderItemList();
    });

    for (const button of el.eventsSubtabButtons) {
        button.addEventListener('click', () => setEventsSubtab(button.dataset.eventsSubtab || 'checkin'));
    }

    el.btnAddCheckinRewardRow?.addEventListener('click', () => {
        const cycleDays = clampInt(el.checkinCycleDays?.value, 1, 31, 7);
        state.checkinRows.push({
            day: Math.min(cycleDays, Math.max(1, state.checkinRows.length + 1)),
            itemId: defaultItemId(),
            amount: 1
        });
        renderCheckinRewardRows();
    });

    el.btnAddOnlineRewardRow?.addEventListener('click', () => {
        state.onlineRows.push({
            tier: Math.max(1, state.onlineRows.length + 1),
            seconds: 120,
            itemId: defaultItemId(),
            amount: 1
        });
        renderOnlineRewardRows();
    });

    el.checkinCycleDays?.addEventListener('change', () => {
        const cycleDays = clampInt(el.checkinCycleDays?.value, 1, 31, 7);
        for (const row of state.checkinRows) {
            row.day = clampInt(row.day, 1, cycleDays, 1);
        }
        renderCheckinRewardRows();
    });

    el.btnSaveActivities?.addEventListener('click', onSaveActivities);
    el.btnResetActivities?.addEventListener('click', onResetActivities);
    el.btnToolResetCheckin?.addEventListener('click', resetCheckinState);
    el.btnToolResetOnlineReward?.addEventListener('click', resetOnlineRewardState);
    el.btnToolResetLiveopsAll?.addEventListener('click', resetAllActivityState);

    window.addEventListener('storage', (event) => {
        if (event.key !== null && event.key !== 'arrowClear_liveopsConfig_v1') {
            return;
        }
        loadConfig();
        renderAll();
        setActivityStatus('检测到活动配置变更，已刷新。');
    });
}

function loadConfig() {
    state.config = readLiveOpsConfig();
}

function renderAll() {
    renderItemList();
    fillActivitiesFromConfig();
    setEventsSubtab('checkin');
}

function setEventsSubtab(tabId) {
    const target = `${tabId || ''}`.trim() || 'checkin';
    for (const btn of el.eventsSubtabButtons) {
        btn.classList.toggle('is-active', btn.dataset.eventsSubtab === target);
    }
    for (const panel of el.eventsSubpanels) {
        panel.classList.toggle('is-active', panel.dataset.eventsSubpanel === target);
    }
}

function getItems() {
    return Array.isArray(state.config?.items) ? state.config.items : [];
}

function defaultItemId() {
    return getItems()[0]?.id || 'coin';
}

function createItemOptionsHtml(selectedId) {
    const selected = `${selectedId || ''}`;
    return getItems()
        .map((item) => {
            const id = item.id;
            const label = `${item.nameZh || id} (${id})`;
            const checked = id === selected ? ' selected' : '';
            return `<option value="${escapeHtml(id)}"${checked}>${escapeHtml(label)}</option>`;
        })
        .join('');
}

function renderItemList() {
    if (!el.itemList) return;
    el.itemList.innerHTML = '';
    for (const item of getItems()) {
        const row = document.createElement('div');
        row.className = 'liveops-item-row';
        if (item.id === state.selectedItemId) {
            row.classList.add('is-active');
        }
        const meta = document.createElement('div');
        meta.innerHTML = `<strong>${escapeHtml(item.nameZh || item.id)}</strong> <small>(${escapeHtml(item.id)})</small><br><small>${escapeHtml(item.type)}${item.builtin ? ' 路 builtin' : ''}</small>`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '缂栬緫';
        btn.addEventListener('click', () => {
            state.selectedItemId = item.id;
            fillItemEditor(item);
            renderItemList();
        });

        row.appendChild(meta);
        row.appendChild(btn);
        el.itemList.appendChild(row);
    }
}

function fillItemEditor(item) {
    if (!el.itemId || !el.itemNameZh || !el.itemNameEn || !el.itemType) return;
    if (!item) {
        el.itemId.value = '';
        el.itemNameZh.value = '';
        el.itemNameEn.value = '';
        el.itemType.value = 'item';
        return;
    }
    el.itemId.value = item.id || '';
    el.itemNameZh.value = item.nameZh || '';
    el.itemNameEn.value = item.nameEn || '';
    el.itemType.value = item.type || 'item';
}

function onSaveItem() {
    const id = sanitizeId(el.itemId?.value || '');
    const nameZh = `${el.itemNameZh?.value || ''}`.trim();
    const nameEn = `${el.itemNameEn?.value || ''}`.trim();
    const type = normalizeType(el.itemType?.value || 'item');

    if (!id) {
        setItemStatus('道具 ID 不能为空。', true);
        return;
    }
    if (!nameZh) {
        setItemStatus('中文名不能为空。', true);
        return;
    }

    const items = [...getItems()];
    const index = items.findIndex((item) => item.id === id);
    const prevBuiltin = index >= 0 ? !!items[index].builtin : false;
    const nextItem = {
        id,
        nameZh,
        nameEn: nameEn || id,
        type,
        builtin: prevBuiltin
    };

    if (index >= 0) {
        items[index] = nextItem;
    } else {
        items.push(nextItem);
    }

    state.config = writeLiveOpsConfig({
        ...state.config,
        items
    });
    state.selectedItemId = id;
    renderItemList();
    fillItemEditor(nextItem);
    renderCheckinRewardRows();
    renderOnlineRewardRows();
    setItemStatus(`宸蹭繚瀛橀亾鍏凤細${id}`);
}

function onDeleteItem() {
    const id = sanitizeId(el.itemId?.value || '');
    if (!id) {
        setItemStatus('请先选择要删除的道具。', true);
        return;
    }
    const items = [...getItems()];
    const target = items.find((item) => item.id === id);
    if (!target) {
        setItemStatus(`閬撳叿涓嶅瓨鍦細${id}`, true);
        return;
    }
    if (target.builtin) {
        setItemStatus(`内置道具不能删除：${id}`, true);
        return;
    }

    const nextItems = items.filter((item) => item.id !== id);
    state.config = writeLiveOpsConfig({
        ...state.config,
        items: nextItems
    });
    state.selectedItemId = '';
    fillItemEditor(null);

    const fallbackId = defaultItemId();
    for (const row of state.checkinRows) {
        if (row.itemId === id) row.itemId = fallbackId;
    }
    for (const row of state.onlineRows) {
        if (row.itemId === id) row.itemId = fallbackId;
    }

    renderItemList();
    renderCheckinRewardRows();
    renderOnlineRewardRows();
    setItemStatus(`宸插垹闄ら亾鍏凤細${id}`);
}

function fillActivitiesFromConfig() {
    const checkin = state.config?.activities?.checkin || DEFAULT_LIVEOPS_CONFIG.activities.checkin;
    const online = state.config?.activities?.onlineReward || DEFAULT_LIVEOPS_CONFIG.activities.onlineReward;

    if (el.checkinCycleDays) {
        el.checkinCycleDays.value = `${clampInt(checkin.cycleDays, 1, 31, 7)}`;
    }
    if (el.onlineResetHour) {
        el.onlineResetHour.value = `${clampInt(online.resetHour, 0, 23, 4)}`;
    }

    const checkinRows = [];
    const cycleDays = clampInt(checkin.cycleDays, 1, 31, 7);
    const rewardsByDay = Array.isArray(checkin.rewards) ? checkin.rewards : [];
    for (let day = 1; day <= cycleDays; day += 1) {
        const rewards = Array.isArray(rewardsByDay[day - 1]) ? rewardsByDay[day - 1] : [];
        for (const reward of rewards) {
            checkinRows.push({
                day,
                itemId: sanitizeId(reward?.itemId) || defaultItemId(),
                amount: clampInt(reward?.amount, 1, 9999999, 1)
            });
        }
    }
    if (checkinRows.length === 0) {
        checkinRows.push({ day: 1, itemId: defaultItemId(), amount: 1 });
    }
    state.checkinRows = checkinRows;

    const onlineRows = [];
    const tiers = Array.isArray(online.tiers) ? online.tiers : [];
    tiers.forEach((tier, index) => {
        const tierIndex = index + 1;
        const seconds = clampInt(tier?.seconds, 1, 86400, 120);
        const rewards = Array.isArray(tier?.rewards) ? tier.rewards : [];
        for (const reward of rewards) {
            onlineRows.push({
                tier: tierIndex,
                seconds,
                itemId: sanitizeId(reward?.itemId) || defaultItemId(),
                amount: clampInt(reward?.amount, 1, 9999999, 1)
            });
        }
    });
    if (onlineRows.length === 0) {
        onlineRows.push({ tier: 1, seconds: 120, itemId: defaultItemId(), amount: 1 });
    }
    state.onlineRows = onlineRows;

    renderCheckinRewardRows();
    renderOnlineRewardRows();
}

function renderCheckinRewardRows() {
    if (!el.checkinRewardRows) return;
    const cycleDays = clampInt(el.checkinCycleDays?.value, 1, 31, 7);
    el.checkinRewardRows.innerHTML = '';

    state.checkinRows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="number" min="1" max="${cycleDays}" step="1" value="${row.day}"></td>
            <td><select>${createItemOptionsHtml(row.itemId)}</select></td>
            <td><input type="number" min="1" max="9999999" step="1" value="${row.amount}"></td>
            <td><button type="button">鍒犻櫎</button></td>
        `;
        const [dayInput, itemSelect, amountInput, delButton] = [
            tr.children[0].querySelector('input'),
            tr.children[1].querySelector('select'),
            tr.children[2].querySelector('input'),
            tr.children[3].querySelector('button')
        ];
        dayInput?.addEventListener('change', () => {
            row.day = clampInt(dayInput.value, 1, cycleDays, row.day);
            dayInput.value = `${row.day}`;
        });
        itemSelect?.addEventListener('change', () => {
            row.itemId = sanitizeId(itemSelect.value) || defaultItemId();
        });
        amountInput?.addEventListener('change', () => {
            row.amount = clampInt(amountInput.value, 1, 9999999, row.amount);
            amountInput.value = `${row.amount}`;
        });
        delButton?.addEventListener('click', () => {
            state.checkinRows.splice(idx, 1);
            if (state.checkinRows.length === 0) {
                state.checkinRows.push({ day: 1, itemId: defaultItemId(), amount: 1 });
            }
            renderCheckinRewardRows();
        });
        el.checkinRewardRows.appendChild(tr);
    });
}

function renderOnlineRewardRows() {
    if (!el.onlineRewardRows) return;
    el.onlineRewardRows.innerHTML = '';
    state.onlineRows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="number" min="1" max="200" step="1" value="${row.tier}"></td>
            <td><input type="number" min="1" max="86400" step="1" value="${row.seconds}"></td>
            <td><select>${createItemOptionsHtml(row.itemId)}</select></td>
            <td><input type="number" min="1" max="9999999" step="1" value="${row.amount}"></td>
            <td><button type="button">鍒犻櫎</button></td>
        `;
        const [tierInput, secondsInput, itemSelect, amountInput, delButton] = [
            tr.children[0].querySelector('input'),
            tr.children[1].querySelector('input'),
            tr.children[2].querySelector('select'),
            tr.children[3].querySelector('input'),
            tr.children[4].querySelector('button')
        ];
        tierInput?.addEventListener('change', () => {
            row.tier = clampInt(tierInput.value, 1, 200, row.tier);
            tierInput.value = `${row.tier}`;
        });
        secondsInput?.addEventListener('change', () => {
            row.seconds = clampInt(secondsInput.value, 1, 86400, row.seconds);
            secondsInput.value = `${row.seconds}`;
        });
        itemSelect?.addEventListener('change', () => {
            row.itemId = sanitizeId(itemSelect.value) || defaultItemId();
        });
        amountInput?.addEventListener('change', () => {
            row.amount = clampInt(amountInput.value, 1, 9999999, row.amount);
            amountInput.value = `${row.amount}`;
        });
        delButton?.addEventListener('click', () => {
            state.onlineRows.splice(idx, 1);
            if (state.onlineRows.length === 0) {
                state.onlineRows.push({ tier: 1, seconds: 120, itemId: defaultItemId(), amount: 1 });
            }
            renderOnlineRewardRows();
        });
        el.onlineRewardRows.appendChild(tr);
    });
}

function onSaveActivities() {
    const cycleDays = clampInt(el.checkinCycleDays?.value, 1, 31, 7);
    const resetHour = clampInt(el.onlineResetHour?.value, 0, 23, 4);
    const validItemIds = new Set(getItems().map((item) => item.id));

    const checkinRewards = Array.from({ length: cycleDays }, () => []);
    for (const row of state.checkinRows) {
        const day = clampInt(row.day, 1, cycleDays, 1);
        const itemId = sanitizeId(row.itemId);
        const amount = clampInt(row.amount, 1, 9999999, 1);
        if (!itemId || !validItemIds.has(itemId)) {
            setActivityStatus(`签到奖励存在无效道具 ID：${row.itemId || '-'}`, true);
            return;
        }
        checkinRewards[day - 1].push({ itemId, amount });
    }

    const tierMap = new Map();
    for (const row of state.onlineRows) {
        const tier = clampInt(row.tier, 1, 200, 1);
        const seconds = clampInt(row.seconds, 1, 86400, 120);
        const itemId = sanitizeId(row.itemId);
        const amount = clampInt(row.amount, 1, 9999999, 1);
        if (!itemId || !validItemIds.has(itemId)) {
            setActivityStatus(`在线奖励存在无效道具 ID：${row.itemId || '-'}`, true);
            return;
        }
        if (!tierMap.has(tier)) {
            tierMap.set(tier, { seconds, rewards: [] });
        }
        const current = tierMap.get(tier);
        current.seconds = seconds;
        current.rewards.push({ itemId, amount });
    }
    const onlineTiers = Array.from(tierMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value);

    if (onlineTiers.length === 0) {
        setActivityStatus('请至少配置一个在线奖励档位。', true);
        return;
    }

    state.config = writeLiveOpsConfig({
        ...state.config,
        activities: {
            checkin: {
                enabled: true,
                cycleDays,
                rewards: checkinRewards
            },
            onlineReward: {
                enabled: true,
                resetHour,
                tiers: onlineTiers
            }
        }
    });
    fillActivitiesFromConfig();
    setActivityStatus('活动配置已保存。');
}

function onResetActivities() {
    state.config = writeLiveOpsConfig({
        ...state.config,
        activities: DEFAULT_LIVEOPS_CONFIG.activities
    });
    fillActivitiesFromConfig();
    setActivityStatus('已恢复默认活动配置。');
}

async function resetCheckinState() {
    if (!ensureToolUserSession()) {
        setToolStatus('未检测到测试玩家登录态。请先在游戏页登录同一账号，再回到后台重置。', true);
        return;
    }
    const player = readLiveOpsPlayerState();
    writeLiveOpsPlayerState({
        ...player,
        checkin: {
            claimedCount: 0,
            lastClaimDayKey: ''
        }
    }, { syncServer: true });
    const synced = await syncLiveOpsPlayerToServer();
    setToolStatus(
        synced
            ? '已重置当前测试玩家的签到状态。'
            : '签到状态已在本地重置，但服务端同步失败。请确认开发服务器和登录态。',
        !synced
    );
}

async function resetOnlineRewardState() {
    if (!ensureToolUserSession()) {
        setToolStatus('未检测到测试玩家登录态。请先在游戏页登录同一账号，再回到后台重置。', true);
        return;
    }
    const player = readLiveOpsPlayerState();
    writeLiveOpsPlayerState({
        ...player,
        onlineReward: {
            dayKey: '',
            tierIndex: 0,
            remainingSeconds: 0
        }
    }, { syncServer: true });
    const synced = await syncLiveOpsPlayerToServer();
    setToolStatus(
        synced
            ? '已重置当前测试玩家的在线奖励状态。'
            : '在线奖励状态已在本地重置，但服务端同步失败。请确认开发服务器和登录态。',
        !synced
    );
}

async function resetAllActivityState() {
    if (!ensureToolUserSession()) {
        setToolStatus('未检测到测试玩家登录态。请先在游戏页登录同一账号，再回到后台重置。', true);
        return;
    }
    writeLiveOpsPlayerState({
        ...DEFAULT_LIVEOPS_PLAYER_STATE,
        inventory: { ...DEFAULT_LIVEOPS_PLAYER_STATE.inventory }
    }, { syncServer: true });
    const synced = await syncLiveOpsPlayerToServer();
    setToolStatus(
        synced
            ? '已重置当前测试玩家的全部活动状态。'
            : '全部活动状态已在本地重置，但服务端同步失败。请确认开发服务器和登录态。',
        !synced
    );
}

function sanitizeId(value) {
    return `${value || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeType(value) {
    const text = `${value || ''}`.trim().toLowerCase();
    if (text === 'currency' || text === 'tool' || text === 'item' || text === 'skin') {
        return text;
    }
    return 'item';
}

function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function setItemStatus(text, isError = false) {
    if (!el.itemStatus) return;
    el.itemStatus.textContent = text || '';
    el.itemStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setActivityStatus(text, isError = false) {
    if (!el.activityStatus) return;
    el.activityStatus.textContent = text || '';
    el.activityStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setToolStatus(text, isError = false) {
    if (!el.toolStatus) return;
    el.toolStatus.textContent = text || '';
    el.toolStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function escapeHtml(text) {
    return `${text || ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

void init();

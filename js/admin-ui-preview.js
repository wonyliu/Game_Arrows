import { initUiLayoutStorage, readUiLayoutConfig } from './ui-layout-config.js?v=4';
import { getLocalDayKey, readLiveOpsConfig, readLiveOpsPlayerState } from './liveops-storage.js?v=3';

const el = {
    overlay: document.getElementById('checkinOverlay'),
    scene: document.querySelector('.checkin-scene'),
    backButton: document.getElementById('btnBackFromCheckin'),
    card: document.querySelector('.checkin-card-notebook'),
    ribbon: document.querySelector('.checkin-ribbon'),
    ribbonTitle: document.querySelector('.checkin-ribbon-title'),
    grid: document.getElementById('checkinWeekGrid'),
    tooltip: document.getElementById('checkinRewardTooltip'),
    status: document.getElementById('checkinStatus'),
    mascot: document.querySelector('.checkin-mascot-snake')
};

let currentScale = 1;
let previewMeta = {
    scale: 1,
    width: 980,
    height: 760
};

function getRewardIconByItemId(itemId) {
    const id = `${itemId || ''}`.trim().toLowerCase();
    if (id === 'coin') return 'assets/design-v6/checkin/icon_coin_pile.png';
    if (id === 'hint') return 'assets/design-v2/clean/icon_hint.png';
    if (id === 'undo') return 'assets/design-v2/clean/icon_undo.png';
    if (id === 'shuffle') return 'assets/design-v2/clean/icon_shuffle.png';
    if (id === 'skin_fragment') return 'assets/design-v2/clean/icon_theme.png';
    if (id === 'skin') return 'assets/design-v2/clean/icon_theme.png';
    return 'assets/design-v2/clean/icon_gift.png';
}

function getCheckinSnapshot(override = {}) {
    const config = readLiveOpsConfig().activities?.checkin || {};
    const cycleDays = Math.max(1, Math.floor(Number(config.cycleDays) || 7));
    const rewards = Array.isArray(config.rewards) ? config.rewards : [];
    const playerState = readLiveOpsPlayerState().checkin || {};
    const claimedCount = Math.max(0, Math.floor(Number(playerState.claimedCount) || 0));
    const lastClaimDayKey = `${playerState.lastClaimDayKey || ''}`.trim();
    const todayKey = getLocalDayKey(new Date());
    const liveClaimedInCycle = claimedCount % cycleDays;
    const liveNextDay = Math.min(cycleDays, liveClaimedInCycle + 1);
    const liveCanClaimToday = config.enabled !== false && lastClaimDayKey !== todayKey;

    const claimedInCycle = Number.isFinite(Number(override.claimedDays))
        ? Math.max(0, Math.min(cycleDays, Math.round(Number(override.claimedDays))))
        : liveClaimedInCycle;
    const nextDayIndex = Number.isFinite(Number(override.nextDay))
        ? Math.max(1, Math.min(cycleDays, Math.round(Number(override.nextDay))))
        : liveNextDay;
    const canClaimToday = `${override.previewMode || (liveCanClaimToday ? 'claimable' : 'claimed')}` === 'claimable';

    return {
        cycleDays,
        rewards,
        claimedInCycle,
        nextDayIndex,
        canClaimToday
    };
}

function applyLayout(layout) {
    if (!layout) {
        return;
    }
    el.backButton.style.left = `${layout.backButton.x}px`;
    el.backButton.style.top = `${layout.backButton.y}px`;
    el.backButton.style.minWidth = `${layout.backButton.width}px`;
    el.backButton.style.height = `${layout.backButton.height}px`;
    el.backButton.style.fontSize = `${layout.backButton.fontSize}px`;

    el.card.style.width = `${layout.notebook.width}px`;
    el.card.style.height = `${layout.notebook.height}px`;
    el.card.style.paddingTop = `${layout.notebook.paddingTop}px`;

    el.ribbon.style.left = `${layout.ribbon.x}px`;
    el.ribbon.style.top = `${layout.ribbon.y}px`;
    el.ribbon.style.width = `${layout.ribbon.width}px`;
    el.ribbon.style.height = `${layout.ribbon.height}px`;

    el.ribbonTitle.style.fontSize = `${layout.ribbonTitle.fontSize}px`;
    el.ribbonTitle.style.transform = `translate(${layout.ribbonTitle.x}px, ${layout.ribbonTitle.y}px)`;

    el.mascot.style.left = `${layout.mascot.x}px`;
    el.mascot.style.top = `${layout.mascot.y}px`;
    el.mascot.style.width = `${layout.mascot.width}px`;
    el.mascot.style.height = `${layout.mascot.height}px`;
}

function createDayNode(day, layout, reward, isClaimed, isClaimable) {
    const dayConfig = layout.days[day];
    const node = document.createElement('div');
    node.className = 'checkin-day';
    if (day === 7) {
        node.classList.add('day-7');
    }
    if (isClaimed) {
        node.classList.add('is-claimed');
    } else if (isClaimable) {
        node.classList.add('is-next');
    }

    node.dataset.uiEditorId = `day${day}-card`;
    node.style.left = `${dayConfig.card.x}px`;
    node.style.top = `${dayConfig.card.y}px`;
    node.style.width = `${dayConfig.card.width}px`;
    node.style.height = `${dayConfig.card.height}px`;

    const title = document.createElement('div');
    title.className = 'checkin-day-title';
    title.dataset.uiEditorId = `day${day}-title`;
    title.textContent = `绗?{day}澶ー;
    title.style.left = dayConfig.title.align === 'left'
        ? `${dayConfig.title.x}px`
        : `${dayConfig.title.x - (dayConfig.title.width / 2)}px`;
    title.style.top = `${dayConfig.title.y}px`;
    title.style.width = `${dayConfig.title.width}px`;
    title.style.fontSize = `${dayConfig.title.fontSize}px`;
    title.style.textAlign = dayConfig.title.align;
    node.appendChild(title);

    const icon = document.createElement('img');
    icon.className = 'checkin-reward-icon';
    icon.dataset.uiEditorId = `day${day}-icon`;
    icon.src = getRewardIconByItemId(reward.itemId);
    icon.alt = reward.itemId;
    icon.style.left = `${dayConfig.icon.x}px`;
    icon.style.top = `${dayConfig.icon.y}px`;
    icon.style.width = `${dayConfig.icon.width}px`;
    icon.style.height = `${dayConfig.icon.height}px`;
    node.appendChild(icon);

    const amount = document.createElement('div');
    amount.className = 'checkin-reward-amount';
    amount.dataset.uiEditorId = `day${day}-amount`;
    amount.textContent = `x${reward.amount}`;
    amount.style.left = `${dayConfig.amount.x}px`;
    amount.style.top = `${dayConfig.amount.y}px`;
    amount.style.fontSize = `${dayConfig.amount.fontSize}px`;
    node.appendChild(amount);

    if (isClaimed) {
        const badge = document.createElement('div');
        badge.className = 'checkin-claimed-badge';
        badge.dataset.uiEditorId = `day${day}-badge`;
        badge.textContent = '鉁?;
        badge.style.left = `${dayConfig.badge.x}px`;
        badge.style.top = `${dayConfig.badge.y}px`;
        badge.style.width = `${dayConfig.badge.size}px`;
        badge.style.height = `${dayConfig.badge.size}px`;
        badge.style.fontSize = `${Math.round(dayConfig.badge.size * 0.57)}px`;
        node.appendChild(badge);
    }

    return node;
}

function updateScale(layout) {
    const designW = Math.max(320, Number(layout.notebook.width) || 980);
    const designH = Math.max(320, Number(layout.notebook.height) || 760);
    currentScale = 1;
    const renderedW = Math.round(designW);
    const renderedH = Math.round(designH);
    document.documentElement.style.width = `${renderedW}px`;
    document.documentElement.style.height = `${renderedH}px`;
    document.body.style.width = `${renderedW}px`;
    document.body.style.height = `${renderedH}px`;
    if (el.overlay) {
        el.overlay.style.width = `${renderedW}px`;
        el.overlay.style.height = `${renderedH}px`;
    }
    el.scene.style.left = '0px';
    el.scene.style.top = '0px';
    el.scene.style.transform = `scale(${currentScale})`;
    el.scene.style.marginBottom = '0px';
    previewMeta = {
        scale: currentScale,
        width: renderedW,
        height: renderedH
    };
}

export function renderUiEditorPreview(override = {}) {
    const layout = readUiLayoutConfig().checkin;
    const snapshot = getCheckinSnapshot(override);
    applyLayout(layout);
    el.grid.innerHTML = '';

    for (let day = 1; day <= snapshot.cycleDays; day += 1) {
        const rewardList = Array.isArray(snapshot.rewards?.[day - 1]) ? snapshot.rewards[day - 1] : [];
        const reward = rewardList[0] || { itemId: 'coin', amount: 0 };
        const node = createDayNode(
            day,
            layout,
            reward,
            day <= snapshot.claimedInCycle,
            snapshot.canClaimToday && day === snapshot.nextDayIndex
        );
        el.grid.appendChild(node);
    }

    el.status.textContent = snapshot.canClaimToday
        ? `鐐瑰嚮绗?{snapshot.nextDayIndex}澶╁鍔卞崱鍗冲彲棰嗗彇`
        : '浠婃棩宸茬鍒帮紝鏄庢棩鍐嶆潵銆?;
    el.tooltip.classList.add('hidden');
    updateScale(layout);
}

export function getUiEditorPreviewScale() {
    return currentScale;
}

export function getUiEditorPreviewMeta() {
    return { ...previewMeta };
}

window.renderUiEditorPreview = renderUiEditorPreview;
window.getUiEditorPreviewScale = getUiEditorPreviewScale;
window.getUiEditorPreviewMeta = getUiEditorPreviewMeta;

window.addEventListener('resize', () => {
    renderUiEditorPreview();
});

void initUiLayoutStorage()
    .catch((error) => {
        console.warn('[admin-ui-preview] ui layout init failed', error);
    })
    .finally(() => {
        renderUiEditorPreview();
    });


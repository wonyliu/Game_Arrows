const el = {
    btnResetWholeGame: document.getElementById('btnToolResetWholeGame'),
    btnResetLeaderboardProgress: document.getElementById('btnToolResetLeaderboardProgress'),
    toolStatus: document.getElementById('toolStatus'),
    btnAssetAuditScan: document.getElementById('btnAssetAuditScan'),
    btnAssetAuditSelectAll: document.getElementById('btnAssetAuditSelectAll'),
    btnAssetAuditClearSelection: document.getElementById('btnAssetAuditClearSelection'),
    btnAssetAuditDeleteSelected: document.getElementById('btnAssetAuditDeleteSelected'),
    btnAssetAuditDeleteAll: document.getElementById('btnAssetAuditDeleteAll'),
    assetAuditStatus: document.getElementById('assetAuditStatus'),
    assetAuditSummary: document.getElementById('assetAuditSummary'),
    assetAuditList: document.getElementById('assetAuditList')
};

const assetState = {
    lastScanId: '',
    summary: null,
    assets: [],
    unusedAssets: [],
    selected: new Set()
};

function setToolStatus(text, isError = false) {
    if (!el.toolStatus) return;
    el.toolStatus.textContent = text || '';
    el.toolStatus.style.color = isError ? '#9d2b22' : '#466f27';
}

function setAssetStatus(text, isError = false) {
    if (!el.assetAuditStatus) return;
    el.assetAuditStatus.textContent = text || '';
    el.assetAuditStatus.style.color = isError ? '#9d2b22' : '#466f27';
}

function formatBytes(value) {
    const size = Math.max(0, Number(value) || 0);
    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (size >= 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${Math.round(size)} B`;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        cache: 'no-store',
        ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    return payload;
}

async function postJson(url, body = {}) {
    return fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

function escapeHtml(text) {
    return `${text || ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSelectedUnusedPaths() {
    const unusedSet = new Set(assetState.unusedAssets.map((item) => item.path));
    return [...assetState.selected].filter((assetPath) => unusedSet.has(assetPath));
}

function updateAssetActionState() {
    const hasUnused = assetState.unusedAssets.length > 0;
    const selectedUnused = getSelectedUnusedPaths();
    if (el.btnAssetAuditSelectAll) el.btnAssetAuditSelectAll.disabled = !hasUnused;
    if (el.btnAssetAuditClearSelection) el.btnAssetAuditClearSelection.disabled = selectedUnused.length <= 0;
    if (el.btnAssetAuditDeleteSelected) el.btnAssetAuditDeleteSelected.disabled = selectedUnused.length <= 0;
    if (el.btnAssetAuditDeleteAll) el.btnAssetAuditDeleteAll.disabled = !hasUnused;
}

function renderAssetSummary() {
    if (!el.assetAuditSummary) return;
    const summary = assetState.summary || {};
    const total = Math.max(0, Number(summary.totalImageAssets) || 0);
    const totalBytes = Math.max(0, Number(summary.totalImageBytes) || 0);
    const used = Math.max(0, Number(summary.usedImageAssets) || 0);
    const usedBytes = Math.max(0, Number(summary.usedImageBytes) || 0);
    const unused = Math.max(0, Number(summary.unusedImageAssets) || 0);
    const unusedBytes = Math.max(0, Number(summary.unusedImageBytes) || 0);
    const maxUsageCount = Math.max(0, Number(summary.maxUsageCount) || 0);
    el.assetAuditSummary.innerHTML = `
        <div>总图片资源：${total}</div>
        <div>总占用：${formatBytes(totalBytes)}</div>
        <div>已引用：${used}</div>
        <div>已引用体积：${formatBytes(usedBytes)}</div>
        <div>未引用：${unused}</div>
        <div>可回收体积：${formatBytes(unusedBytes)}</div>
        <div>最高使用次数：${maxUsageCount}</div>
    `;
}

function updateDimensionLabel(label, image) {
    if (!label) return;
    const width = Math.max(0, Number(image?.naturalWidth) || 0);
    const height = Math.max(0, Number(image?.naturalHeight) || 0);
    label.textContent = width > 0 && height > 0 ? `尺寸 ${width} x ${height}` : '尺寸 读取失败';
}

function renderAssetCard(item) {
    const card = document.createElement('div');
    card.className = 'asset-audit-card';

    const canDelete = item.used !== true;
    const checkbox = document.createElement('input');
    checkbox.className = 'asset-audit-check';
    checkbox.type = 'checkbox';
    checkbox.disabled = !canDelete;
    checkbox.checked = canDelete && assetState.selected.has(item.path);
    checkbox.title = canDelete ? '选择待删除资源' : '已引用资源不能直接删除';
    checkbox.addEventListener('change', () => {
        if (!canDelete) return;
        if (checkbox.checked) {
            assetState.selected.add(item.path);
        } else {
            assetState.selected.delete(item.path);
        }
        updateAssetActionState();
    });

    const thumb = document.createElement('img');
    thumb.className = 'asset-audit-thumb';
    thumb.src = `${item.path}?v=${encodeURIComponent(assetState.lastScanId || Date.now())}`;
    thumb.alt = item.path;
    thumb.loading = 'lazy';

    const meta = document.createElement('div');
    meta.className = 'asset-audit-meta';

    const title = document.createElement('strong');
    title.textContent = item.path;
    meta.appendChild(title);

    const info = document.createElement('span');
    info.textContent = `${formatBytes(item.sizeBytes)} · ${item.extension || ''} · 使用 ${item.usageCount || 0} 次 · 使用率 ${Number(item.usageRate || 0).toFixed(1)}%`;
    meta.appendChild(info);

    const dimension = document.createElement('span');
    dimension.textContent = '尺寸 读取中...';
    meta.appendChild(dimension);

    if (Array.isArray(item.referrers) && item.referrers.length > 0) {
        const refs = document.createElement('span');
        const previewRefs = item.referrers.slice(0, 3);
        const suffix = item.referrers.length > previewRefs.length ? ` 等 ${item.referrers.length} 处` : '';
        refs.textContent = `引用位置：${previewRefs.join('，')}${suffix}`;
        refs.title = item.referrers.join('\n');
        meta.appendChild(refs);
    }

    thumb.addEventListener('load', () => updateDimensionLabel(dimension, thumb));
    thumb.addEventListener('error', () => {
        dimension.textContent = '尺寸 读取失败';
    });

    const badges = document.createElement('div');
    badges.className = 'asset-audit-badges';
    badges.innerHTML = `
        <span class="asset-audit-badge ${canDelete ? 'is-unused' : 'is-used'}">${canDelete ? '未引用' : '已引用'}</span>
        <span class="asset-audit-badge">大小 ${formatBytes(item.sizeBytes)}</span>
        <span class="asset-audit-badge">次数 ${Math.max(0, Number(item.usageCount) || 0)}</span>
    `;
    meta.appendChild(badges);

    const actions = document.createElement('div');
    actions.className = 'asset-audit-actions-inline';
    if (canDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => {
            void deleteSelectedAssets([item.path], `确认删除未使用资源？\n${item.path}`);
        });
        actions.appendChild(deleteBtn);
    } else {
        const readonly = document.createElement('button');
        readonly.type = 'button';
        readonly.textContent = '已引用';
        readonly.disabled = true;
        actions.appendChild(readonly);
    }

    card.appendChild(checkbox);
    card.appendChild(thumb);
    card.appendChild(meta);
    card.appendChild(actions);
    return card;
}

function renderAssetList() {
    if (!el.assetAuditList) return;
    const rows = Array.isArray(assetState.assets) ? assetState.assets : [];
    if (rows.length <= 0) {
        el.assetAuditList.innerHTML = '<div class="db-admin-empty">点击“扫描资源列表”后查看全部美术资源及使用情况。</div>';
        updateAssetActionState();
        return;
    }

    el.assetAuditList.innerHTML = '';
    for (const item of rows) {
        el.assetAuditList.appendChild(renderAssetCard(item));
    }
    updateAssetActionState();
}

function applyAssetScanPayload(payload) {
    assetState.lastScanId = `${payload?.scanId || Date.now()}`;
    assetState.summary = payload?.summary || null;
    assetState.assets = Array.isArray(payload?.assets) ? payload.assets : [];
    assetState.unusedAssets = Array.isArray(payload?.unusedAssets) ? payload.unusedAssets : [];
    const validUnusedPaths = new Set(assetState.unusedAssets.map((item) => item.path));
    assetState.selected = new Set([...assetState.selected].filter((assetPath) => validUnusedPaths.has(assetPath)));
    renderAssetSummary();
    renderAssetList();
}

async function scanUnusedAssets() {
    if (!el.btnAssetAuditScan) return;
    el.btnAssetAuditScan.disabled = true;
    const prevText = el.btnAssetAuditScan.textContent;
    el.btnAssetAuditScan.textContent = '扫描中...';
    setAssetStatus('正在扫描 assets 目录中的全部图片资源...');
    try {
        const payload = await fetchJson('/api/admin/assets/scan');
        applyAssetScanPayload(payload);
        setAssetStatus(`扫描完成：共 ${assetState.assets.length} 个资源，未引用 ${assetState.unusedAssets.length} 个。`);
    } catch (error) {
        setAssetStatus(`扫描失败：${error?.message || 'unknown error'}`, true);
    } finally {
        el.btnAssetAuditScan.disabled = false;
        el.btnAssetAuditScan.textContent = prevText;
    }
}

async function deleteSelectedAssets(paths, confirmText) {
    const targets = Array.isArray(paths)
        ? paths.map((item) => `${item || ''}`.trim()).filter(Boolean)
        : [];
    if (targets.length <= 0) {
        setAssetStatus('请先选择要删除的未引用资源。', true);
        return;
    }
    if (!window.confirm(confirmText)) {
        return;
    }
    setAssetStatus(`正在删除 ${targets.length} 个未引用资源...`);
    try {
        const payload = await postJson('/api/admin/assets/delete-unused', { paths: targets });
        const deletedCount = Math.max(0, Number(payload?.deletedCount) || 0);
        setAssetStatus(`已删除 ${deletedCount} 个未引用资源。`);
        await scanUnusedAssets();
    } catch (error) {
        setAssetStatus(`删除失败：${error?.message || 'unknown error'}`, true);
    }
}

async function deleteAllUnusedAssets() {
    if (assetState.unusedAssets.length <= 0) {
        setAssetStatus('当前没有可删除的未引用资源。', true);
        return;
    }
    const confirmed = window.confirm(
        `确认一键删除全部未引用资源？\n本次将删除 ${assetState.unusedAssets.length} 个文件。`
    );
    if (!confirmed) {
        return;
    }
    setAssetStatus(`正在删除全部未引用资源（${assetState.unusedAssets.length} 个）...`);
    try {
        const payload = await postJson('/api/admin/assets/delete-unused-all', {});
        const deletedCount = Math.max(0, Number(payload?.deletedCount) || 0);
        setAssetStatus(`已一键删除 ${deletedCount} 个未引用资源。`);
        await scanUnusedAssets();
    } catch (error) {
        setAssetStatus(`一键删除失败：${error?.message || 'unknown error'}`, true);
    }
}

async function resetWholeGameState() {
    if (!el.btnResetWholeGame) return;
    const confirmed = window.confirm(
        '确认重置服务器数据？将把所有玩家的数据恢复到初始状态：金币、皮肤解锁、关卡进度、活动进度。'
    );
    if (!confirmed) {
        return;
    }
    el.btnResetWholeGame.disabled = true;
    const prevText = el.btnResetWholeGame.textContent;
    el.btnResetWholeGame.textContent = '重置中...';
    try {
        const payload = await postJson('/api/admin/reset-server-data', { reason: 'admin-tool' });
        const count = Math.max(0, Math.floor(Number(payload?.resetUsers) || 0));
        setToolStatus(`已重置服务器数据，影响用户数：${count}。请刷新游戏页重新拉取最新玩家状态。`);
    } catch (error) {
        setToolStatus(`重置失败：${error?.message || 'unknown error'}`, true);
    } finally {
        el.btnResetWholeGame.disabled = false;
        el.btnResetWholeGame.textContent = prevText;
    }
}

async function resetLeaderboardProgress() {
    if (!el.btnResetLeaderboardProgress) return;
    const confirmed = window.confirm(
        '确认重置排行榜进度？将把所有玩家的“已通关最大关卡”重置为 0。'
    );
    if (!confirmed) {
        return;
    }
    el.btnResetLeaderboardProgress.disabled = true;
    const prevText = el.btnResetLeaderboardProgress.textContent;
    el.btnResetLeaderboardProgress.textContent = '重置中...';
    try {
        const payload = await postJson('/api/admin/reset-leaderboard-progress', { reason: 'admin-tool' });
        const count = Math.max(0, Math.floor(Number(payload?.resetUsers) || 0));
        setToolStatus(`已重置排行榜进度，影响用户数：${count}。`);
    } catch (error) {
        setToolStatus(`重置失败：${error?.message || 'unknown error'}`, true);
    } finally {
        el.btnResetLeaderboardProgress.disabled = false;
        el.btnResetLeaderboardProgress.textContent = prevText;
    }
}

el.btnResetWholeGame?.addEventListener('click', () => {
    void resetWholeGameState();
});

el.btnResetLeaderboardProgress?.addEventListener('click', () => {
    void resetLeaderboardProgress();
});

el.btnAssetAuditScan?.addEventListener('click', () => {
    void scanUnusedAssets();
});

el.btnAssetAuditSelectAll?.addEventListener('click', () => {
    assetState.selected = new Set(assetState.unusedAssets.map((item) => item.path));
    renderAssetList();
});

el.btnAssetAuditClearSelection?.addEventListener('click', () => {
    assetState.selected.clear();
    renderAssetList();
});

el.btnAssetAuditDeleteSelected?.addEventListener('click', () => {
    const selectedPaths = getSelectedUnusedPaths();
    void deleteSelectedAssets(
        selectedPaths,
        `确认删除已选未引用资源？\n本次将删除 ${selectedPaths.length} 个文件。`
    );
});

el.btnAssetAuditDeleteAll?.addEventListener('click', () => {
    void deleteAllUnusedAssets();
});

updateAssetActionState();

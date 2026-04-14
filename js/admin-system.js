const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DEFAULT_SCALE_PERCENT = 80;

const el = {
    btnResetWholeGame: document.getElementById('btnToolResetWholeGame'),
    btnResetLeaderboardProgress: document.getElementById('btnToolResetLeaderboardProgress'),
    toolStatus: document.getElementById('toolStatus'),

    assetSubtabButtons: Array.from(document.querySelectorAll('[data-asset-subtab-target]')),
    assetSubtabPanels: Array.from(document.querySelectorAll('[data-asset-subtab-panel]')),
    assetFilterButtons: Array.from(document.querySelectorAll('[data-asset-filter]')),
    assetSortButtons: Array.from(document.querySelectorAll('[data-asset-sort-key]')),

    btnAssetAuditScan: document.getElementById('btnAssetAuditScan'),
    btnAssetAuditSelectAll: document.getElementById('btnAssetAuditSelectAll'),
    btnAssetAuditClearSelection: document.getElementById('btnAssetAuditClearSelection'),
    btnAssetAuditDeleteSelected: document.getElementById('btnAssetAuditDeleteSelected'),
    btnAssetAuditDeleteAll: document.getElementById('btnAssetAuditDeleteAll'),
    assetAuditStatus: document.getElementById('assetAuditStatus'),
    assetAuditSummary: document.getElementById('assetAuditSummary'),
    assetAuditUnusedList: document.getElementById('assetAuditUnusedList'),
    assetAuditTableBody: document.getElementById('assetAuditTableBody')
};

const assetState = {
    lastScanId: '',
    summary: null,
    assets: [],
    unusedAssets: [],
    selected: new Set(),
    subtab: 'unused',
    filterCategory: 'all',
    sortKey: 'usageCount',
    sortDir: 'desc',
    dimensions: new Map(),
    scalePercentByPath: new Map(),
    busyPaths: new Set()
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

function showAssetToast(text, isError = false) {
    const toast = document.createElement('div');
    toast.className = `asset-toast${isError ? ' is-error' : ''}`;
    toast.textContent = text || '';
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });
    window.setTimeout(() => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => toast.remove(), 220);
    }, 2200);
}

function formatBytes(value) {
    const size = Math.max(0, Number(value) || 0);
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${Math.round(size)} B`;
}

function escapeHtml(text) {
    return `${text || ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function getSelectedUnusedPaths() {
    const unusedSet = new Set(assetState.unusedAssets.map((item) => item.path));
    return [...assetState.selected].filter((assetPath) => unusedSet.has(assetPath));
}

function getDimensionInfo(assetPath) {
    return assetState.dimensions.get(assetPath) || {
        width: 0,
        height: 0,
        loaded: false,
        failed: false
    };
}

function getScalePercent(assetPath) {
    return assetState.scalePercentByPath.get(assetPath) || DEFAULT_SCALE_PERCENT;
}

function isRasterAsset(item) {
    return RASTER_EXTENSIONS.has(`${item?.extension || ''}`.toLowerCase());
}

function updateAssetActionState() {
    const hasUnused = assetState.unusedAssets.length > 0;
    const selectedUnused = getSelectedUnusedPaths();
    if (el.btnAssetAuditSelectAll) el.btnAssetAuditSelectAll.disabled = !hasUnused;
    if (el.btnAssetAuditClearSelection) el.btnAssetAuditClearSelection.disabled = selectedUnused.length <= 0;
    if (el.btnAssetAuditDeleteSelected) el.btnAssetAuditDeleteSelected.disabled = selectedUnused.length <= 0;
    if (el.btnAssetAuditDeleteAll) el.btnAssetAuditDeleteAll.disabled = !hasUnused;
}

function getCategoryLabel(category) {
    switch (`${category || ''}`) {
        case 'primary_runtime':
            return '主路径';
        case 'fallback_only':
            return 'Fallback';
        case 'artifact_candidate':
            return '制作产物';
        case 'unused':
            return '未使用';
        default:
            return '未分类';
    }
}

function getCategoryBadgeClass(category) {
    switch (`${category || ''}`) {
        case 'primary_runtime':
            return 'is-used';
        case 'fallback_only':
            return 'is-fallback';
        case 'artifact_candidate':
            return 'is-artifact';
        case 'unused':
            return 'is-unused';
        default:
            return '';
    }
}

function getFilteredAssetRows() {
    const filter = `${assetState.filterCategory || 'all'}`;
    if (filter === 'all') return assetState.assets;
    return assetState.assets.filter((item) => `${item?.category || ''}` === filter);
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

function sortAssetRows(rows) {
    const dir = assetState.sortDir === 'asc' ? 1 : -1;
    const key = assetState.sortKey;
    return [...rows].sort((a, b) => {
        let left;
        let right;
        if (key === 'width' || key === 'height') {
            left = getDimensionInfo(a.path)[key] || 0;
            right = getDimensionInfo(b.path)[key] || 0;
        } else {
            left = a[key];
            right = b[key];
        }

        if (typeof left === 'string' || typeof right === 'string') {
            const result = `${left || ''}`.localeCompare(`${right || ''}`);
            if (result !== 0) return result * dir;
        } else {
            const numLeft = Number(left) || 0;
            const numRight = Number(right) || 0;
            if (numLeft !== numRight) return (numLeft - numRight) * dir;
        }
        return a.path.localeCompare(b.path);
    });
}

function renderUnusedAssetList() {
    if (!el.assetAuditUnusedList) return;
    const rows = Array.isArray(assetState.unusedAssets) ? assetState.unusedAssets : [];
    if (rows.length <= 0) {
        el.assetAuditUnusedList.innerHTML = '<div class="db-admin-empty">点击“扫描资源列表”后查看未引用资源。</div>';
        updateAssetActionState();
        return;
    }

    el.assetAuditUnusedList.innerHTML = '';
    for (const item of rows) {
        const card = document.createElement('div');
        card.className = 'asset-audit-card';

        const checkbox = document.createElement('input');
        checkbox.className = 'asset-audit-check';
        checkbox.type = 'checkbox';
        checkbox.checked = assetState.selected.has(item.path);
        checkbox.addEventListener('change', () => {
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
        thumb.addEventListener('load', () => {
            assetState.dimensions.set(item.path, {
                width: thumb.naturalWidth || 0,
                height: thumb.naturalHeight || 0,
                loaded: true,
                failed: false
            });
        });
        thumb.addEventListener('error', () => {
            assetState.dimensions.set(item.path, {
                width: 0,
                height: 0,
                loaded: true,
                failed: true
            });
        });

        const dim = getDimensionInfo(item.path);
        const meta = document.createElement('div');
        meta.className = 'asset-audit-meta';
        meta.innerHTML = `
            <strong>${escapeHtml(item.path)}</strong>
            <span>${formatBytes(item.sizeBytes)} · ${escapeHtml(item.extension || '')}</span>
            <span>${dim.loaded && !dim.failed ? `尺寸 ${dim.width} x ${dim.height}` : '尺寸加载中...'}</span>
        `;

        const badges = document.createElement('div');
        badges.className = 'asset-audit-badges';
        badges.innerHTML = `
            <span class="asset-audit-badge is-unused">未引用</span>
            <span class="asset-audit-badge">使用次数 0</span>
        `;
        meta.appendChild(badges);

        const actions = document.createElement('div');
        actions.className = 'asset-audit-actions-inline';
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => {
            void deleteSelectedAssets([item.path], `确认删除未引用资源？\n${item.path}`);
        });
        actions.appendChild(deleteBtn);

        card.appendChild(checkbox);
        card.appendChild(thumb);
        card.appendChild(meta);
        card.appendChild(actions);
        el.assetAuditUnusedList.appendChild(card);
    }
    updateAssetActionState();
}

function updateSortButtonState() {
    for (const button of el.assetSortButtons) {
        const isActive = button.dataset.assetSortKey === assetState.sortKey;
        const arrow = isActive ? (assetState.sortDir === 'asc' ? '↑' : '↓') : '';
        const label = button.textContent.replace(/\s[↑↓]$/, '').trim();
        button.textContent = arrow ? `${label} ${arrow}` : label;
        button.classList.toggle('is-active', isActive);
    }
}

function createPreviewThumb(item) {
    const thumb = document.createElement('img');
    thumb.className = 'asset-table-thumb';
    thumb.src = `${item.path}?v=${encodeURIComponent(assetState.lastScanId || Date.now())}`;
    thumb.alt = item.path;
    thumb.loading = 'lazy';
    thumb.addEventListener('load', () => {
        const prev = getDimensionInfo(item.path);
        if (prev.width === thumb.naturalWidth && prev.height === thumb.naturalHeight && prev.loaded) {
            return;
        }
        assetState.dimensions.set(item.path, {
            width: thumb.naturalWidth || 0,
            height: thumb.naturalHeight || 0,
            loaded: true,
            failed: false
        });
        renderAssetTable();
    });
    thumb.addEventListener('error', () => {
        assetState.dimensions.set(item.path, {
            width: 0,
            height: 0,
            loaded: true,
            failed: true
        });
        renderAssetTable();
    });
    return thumb;
}

function renderOperationCell(item) {
    const wrap = document.createElement('div');
    wrap.className = 'asset-table-actions';
    const raster = isRasterAsset(item);
    const busy = assetState.busyPaths.has(item.path);

    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'asset-info-btn';
    infoBtn.textContent = 'i';
    infoBtn.title = '缩小比例说明';
    infoBtn.addEventListener('click', () => {
        showAssetToast(
            raster
                ? '填写缩小后的目标百分比。80 表示宽高都缩小到原图的 80%。'
                : '当前只支持 PNG、JPG、WebP 位图资源按比例缩小保存。',
            false
        );
    });

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '100';
    input.step = '1';
    input.value = `${getScalePercent(item.path)}`;
    input.className = 'asset-scale-input';
    input.disabled = !raster || busy;
    input.addEventListener('change', () => {
        const next = Math.max(1, Math.min(100, Math.round(Number(input.value) || DEFAULT_SCALE_PERCENT)));
        assetState.scalePercentByPath.set(item.path, next);
        input.value = `${next}`;
    });

    const resizeBtn = document.createElement('button');
    resizeBtn.type = 'button';
    resizeBtn.textContent = busy ? '处理中...' : '缩小保存';
    resizeBtn.disabled = !raster || busy;
    resizeBtn.addEventListener('click', () => {
        const next = Math.max(1, Math.min(100, Math.round(Number(input.value) || DEFAULT_SCALE_PERCENT)));
        assetState.scalePercentByPath.set(item.path, next);
        void resizeAssetByScale(item, next);
    });

    wrap.appendChild(infoBtn);
    wrap.appendChild(input);
    wrap.appendChild(resizeBtn);
    return wrap;
}

function renderAssetTable() {
    if (!el.assetAuditTableBody) return;
    const rows = sortAssetRows(assetState.assets);
    if (rows.length <= 0) {
        el.assetAuditTableBody.innerHTML = `
            <tr>
                <td colspan="10"><div class="db-admin-empty">点击“扫描资源列表”后查看全部资源。</div></td>
            </tr>
        `;
        updateSortButtonState();
        return;
    }

    el.assetAuditTableBody.innerHTML = '';
    for (const item of rows) {
        const tr = document.createElement('tr');
        const dim = getDimensionInfo(item.path);
        const canDelete = item.used !== true;

        const previewTd = document.createElement('td');
        previewTd.appendChild(createPreviewThumb(item));
        tr.appendChild(previewTd);

        const pathTd = document.createElement('td');
        pathTd.className = 'asset-table-path';
        pathTd.textContent = item.path;
        pathTd.title = item.path;
        tr.appendChild(pathTd);

        const usedTd = document.createElement('td');
        usedTd.innerHTML = `<span class="asset-audit-badge ${canDelete ? 'is-unused' : 'is-used'}">${canDelete ? '未引用' : '已引用'}</span>`;
        tr.appendChild(usedTd);

        const usageCountTd = document.createElement('td');
        usageCountTd.textContent = `${Math.max(0, Number(item.usageCount) || 0)}`;
        tr.appendChild(usageCountTd);

        const usageRateTd = document.createElement('td');
        usageRateTd.textContent = `${Number(item.usageRate || 0).toFixed(1)}%`;
        tr.appendChild(usageRateTd);

        const widthTd = document.createElement('td');
        widthTd.textContent = dim.loaded && !dim.failed ? `${dim.width}` : '-';
        tr.appendChild(widthTd);

        const heightTd = document.createElement('td');
        heightTd.textContent = dim.loaded && !dim.failed ? `${dim.height}` : '-';
        tr.appendChild(heightTd);

        const sizeTd = document.createElement('td');
        sizeTd.textContent = formatBytes(item.sizeBytes);
        tr.appendChild(sizeTd);

        const extTd = document.createElement('td');
        extTd.textContent = item.extension || '';
        tr.appendChild(extTd);

        const actionTd = document.createElement('td');
        actionTd.appendChild(renderOperationCell(item));
        tr.appendChild(actionTd);

        el.assetAuditTableBody.appendChild(tr);
    }
    updateSortButtonState();
}

function renderAssetViews() {
    renderAssetSummary();
    renderUnusedAssetList();
    renderAssetTable();
}

function getCategoryLabel(category) {
    switch (`${category || ''}`) {
        case 'primary_runtime':
            return 'Primary';
        case 'fallback_only':
            return 'Fallback';
        case 'artifact_candidate':
            return 'Artifact';
        case 'unused':
            return 'Unused';
        default:
            return 'Unknown';
    }
}

function getCategoryBadgeClass(category) {
    switch (`${category || ''}`) {
        case 'primary_runtime':
            return 'is-used';
        case 'fallback_only':
            return 'is-fallback';
        case 'artifact_candidate':
            return 'is-artifact';
        case 'unused':
            return 'is-unused';
        default:
            return '';
    }
}

function getFilteredAssetRows() {
    const filter = `${assetState.filterCategory || 'all'}`;
    if (filter === 'all') return assetState.assets;
    return assetState.assets.filter((item) => `${item?.category || ''}` === filter);
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
    const primaryRuntimeAssets = Math.max(0, Number(summary.primaryRuntimeAssets) || 0);
    const fallbackOnlyAssets = Math.max(0, Number(summary.fallbackOnlyAssets) || 0);
    const artifactCandidates = Math.max(0, Number(summary.artifactCandidates) || 0);
    const maxUsageCount = Math.max(0, Number(summary.maxUsageCount) || 0);
    el.assetAuditSummary.innerHTML = `
        <div>Total images: ${total}</div>
        <div>Total size: ${formatBytes(totalBytes)}</div>
        <div>Runtime assets: ${used}</div>
        <div>Runtime size: ${formatBytes(usedBytes)}</div>
        <div>Primary assets: ${primaryRuntimeAssets}</div>
        <div>Fallback assets: ${fallbackOnlyAssets}</div>
        <div>Unused assets: ${unused}</div>
        <div>Artifact candidates: ${artifactCandidates}</div>
        <div>Reclaimable size: ${formatBytes(unusedBytes)}</div>
        <div>Max usage count: ${maxUsageCount}</div>
    `;
}

function renderUnusedAssetList() {
    if (!el.assetAuditUnusedList) return;
    const rows = Array.isArray(assetState.unusedAssets)
        ? assetState.unusedAssets.filter((item) => item.category === 'unused' || item.category === 'artifact_candidate')
        : [];
    if (rows.length <= 0) {
        el.assetAuditUnusedList.innerHTML = '<div class="db-admin-empty">Scan assets to review unused files and artifact candidates.</div>';
        updateAssetActionState();
        return;
    }

    el.assetAuditUnusedList.innerHTML = '';
    for (const item of rows) {
        const card = document.createElement('div');
        card.className = 'asset-audit-card';

        const checkbox = document.createElement('input');
        checkbox.className = 'asset-audit-check';
        checkbox.type = 'checkbox';
        checkbox.checked = assetState.selected.has(item.path);
        checkbox.addEventListener('change', () => {
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
        thumb.addEventListener('load', () => {
            assetState.dimensions.set(item.path, {
                width: thumb.naturalWidth || 0,
                height: thumb.naturalHeight || 0,
                loaded: true,
                failed: false
            });
        });
        thumb.addEventListener('error', () => {
            assetState.dimensions.set(item.path, {
                width: 0,
                height: 0,
                loaded: true,
                failed: true
            });
        });

        const dim = getDimensionInfo(item.path);
        const meta = document.createElement('div');
        meta.className = 'asset-audit-meta';
        meta.innerHTML = `
            <strong>${escapeHtml(item.path)}</strong>
            <span>${formatBytes(item.sizeBytes)} | ${escapeHtml(item.extension || '')}</span>
            <span>${dim.loaded && !dim.failed ? `Size ${dim.width} x ${dim.height}` : 'Loading dimensions...'}</span>
        `;

        const badges = document.createElement('div');
        badges.className = 'asset-audit-badges';
        badges.innerHTML = `
            <span class="asset-audit-badge ${getCategoryBadgeClass(item.category)}">${escapeHtml(getCategoryLabel(item.category))}</span>
            <span class="asset-audit-badge">Usage 0</span>
        `;
        meta.appendChild(badges);

        const actions = document.createElement('div');
        actions.className = 'asset-audit-actions-inline';
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
            void deleteSelectedAssets([item.path], `Delete asset?\n${item.path}`);
        });
        actions.appendChild(deleteBtn);

        card.appendChild(checkbox);
        card.appendChild(thumb);
        card.appendChild(meta);
        card.appendChild(actions);
        el.assetAuditUnusedList.appendChild(card);
    }
    updateAssetActionState();
}

function updateAssetFilterButtonState() {
    for (const button of el.assetFilterButtons) {
        const isActive = button.dataset.assetFilter === assetState.filterCategory;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
}

function renderAssetTable() {
    if (!el.assetAuditTableBody) return;
    const rows = sortAssetRows(getFilteredAssetRows());
    if (rows.length <= 0) {
        el.assetAuditTableBody.innerHTML = `
            <tr>
                <td colspan="11"><div class="db-admin-empty">No assets match the current filter.</div></td>
            </tr>
        `;
        updateSortButtonState();
        updateAssetFilterButtonState();
        return;
    }

    el.assetAuditTableBody.innerHTML = '';
    for (const item of rows) {
        const tr = document.createElement('tr');
        const dim = getDimensionInfo(item.path);
        const canDelete = item.used !== true;

        const previewTd = document.createElement('td');
        previewTd.appendChild(createPreviewThumb(item));
        tr.appendChild(previewTd);

        const pathTd = document.createElement('td');
        pathTd.className = 'asset-table-path';
        pathTd.textContent = item.path;
        pathTd.title = item.path;
        tr.appendChild(pathTd);

        const categoryTd = document.createElement('td');
        categoryTd.innerHTML = `<span class="asset-audit-badge ${getCategoryBadgeClass(item.category)}">${escapeHtml(getCategoryLabel(item.category))}</span>`;
        tr.appendChild(categoryTd);

        const usedTd = document.createElement('td');
        usedTd.innerHTML = `<span class="asset-audit-badge ${canDelete ? 'is-unused' : 'is-used'}">${canDelete ? 'Unused' : 'Runtime'}</span>`;
        tr.appendChild(usedTd);

        const usageCountTd = document.createElement('td');
        usageCountTd.textContent = `${Math.max(0, Number(item.usageCount) || 0)}`;
        tr.appendChild(usageCountTd);

        const usageRateTd = document.createElement('td');
        usageRateTd.textContent = `${Number(item.usageRate || 0).toFixed(1)}%`;
        tr.appendChild(usageRateTd);

        const widthTd = document.createElement('td');
        widthTd.textContent = dim.loaded && !dim.failed ? `${dim.width}` : '-';
        tr.appendChild(widthTd);

        const heightTd = document.createElement('td');
        heightTd.textContent = dim.loaded && !dim.failed ? `${dim.height}` : '-';
        tr.appendChild(heightTd);

        const sizeTd = document.createElement('td');
        sizeTd.textContent = formatBytes(item.sizeBytes);
        tr.appendChild(sizeTd);

        const extTd = document.createElement('td');
        extTd.textContent = item.extension || '';
        tr.appendChild(extTd);

        const actionTd = document.createElement('td');
        actionTd.appendChild(renderOperationCell(item));
        tr.appendChild(actionTd);

        el.assetAuditTableBody.appendChild(tr);
    }
    updateSortButtonState();
    updateAssetFilterButtonState();
}

function applyAssetScanPayload(payload) {
    assetState.lastScanId = `${payload?.scanId || Date.now()}`;
    assetState.summary = payload?.summary || null;
    assetState.assets = Array.isArray(payload?.assets) ? payload.assets : [];
    assetState.unusedAssets = Array.isArray(payload?.unusedAssets) ? payload.unusedAssets : [];
    const validUnusedPaths = new Set(assetState.unusedAssets.map((item) => item.path));
    assetState.selected = new Set([...assetState.selected].filter((assetPath) => validUnusedPaths.has(assetPath)));
    renderAssetViews();
}

function setAssetSubtab(tabId) {
    assetState.subtab = `${tabId || 'unused'}`;
    for (const button of el.assetSubtabButtons) {
        const isActive = button.dataset.assetSubtabTarget === assetState.subtab;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    for (const panel of el.assetSubtabPanels) {
        panel.classList.toggle('is-active', panel.dataset.assetSubtabPanel === assetState.subtab);
    }
}

async function scanAssets() {
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
        await scanAssets();
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
        await scanAssets();
    } catch (error) {
        setAssetStatus(`一键删除失败：${error?.message || 'unknown error'}`, true);
    }
}

function getCanvasOutputMime(extension) {
    const normalized = `${extension || ''}`.toLowerCase();
    if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
    if (normalized === '.webp') return 'image/webp';
    return 'image/png';
}

function imageToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(`${reader.result || ''}`);
        reader.onerror = () => reject(new Error('读取缩放图片失败'));
        reader.readAsDataURL(blob);
    });
}

function resizeImageInBrowser(item, scalePercent) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            try {
                const width = Math.max(1, Math.round((img.naturalWidth || 1) * scalePercent / 100));
                const height = Math.max(1, Math.round((img.naturalHeight || 1) * scalePercent / 100));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { alpha: true });
                if (!ctx) throw new Error('浏览器无法创建画布上下文');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                const mime = getCanvasOutputMime(item.extension);
                const blob = await new Promise((resolveBlob) => {
                    canvas.toBlob((nextBlob) => resolveBlob(nextBlob), mime, mime === 'image/png' ? undefined : 0.92);
                });
                if (!blob) throw new Error('浏览器导出缩放图片失败');
                const dataUrl = await imageToDataUrl(blob);
                resolve({
                    dataUrl,
                    width,
                    height
                });
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('加载原图失败'));
        img.src = `${item.path}?v=${encodeURIComponent(assetState.lastScanId || Date.now())}`;
    });
}

async function resizeAssetByScale(item, scalePercent) {
    if (!isRasterAsset(item)) {
        setAssetStatus('当前资源格式不支持直接缩放覆盖。', true);
        return;
    }
    if (scalePercent <= 0 || scalePercent > 100) {
        setAssetStatus('缩小百分比必须在 1 到 100 之间。', true);
        return;
    }
    const confirmed = window.confirm(`确认将资源按 ${scalePercent}% 缩小并覆盖保存？\n${item.path}`);
    if (!confirmed) {
        return;
    }

    assetState.busyPaths.add(item.path);
    renderAssetTable();
    setAssetStatus(`正在优化资源：${item.path}`);
    try {
        const resized = await resizeImageInBrowser(item, scalePercent);
        const payload = await postJson('/api/admin/assets/update-image', {
            path: item.path,
            imageDataUrl: resized.dataUrl,
            width: resized.width,
            height: resized.height
        });
        setAssetStatus(`已优化资源：${item.path}，当前尺寸 ${payload.width} x ${payload.height}。`);
        assetState.dimensions.set(item.path, {
            width: payload.width,
            height: payload.height,
            loaded: true,
            failed: false
        });
        await scanAssets();
    } catch (error) {
        setAssetStatus(`优化失败：${error?.message || 'unknown error'}`, true);
    } finally {
        assetState.busyPaths.delete(item.path);
        renderAssetTable();
    }
}

async function resetWholeGameState() {
    if (!el.btnResetWholeGame) return;
    const confirmed = window.confirm(
        '确认重置服务器数据？将把所有玩家的数据恢复到初始状态：金币、皮肤解锁、关卡进度、活动进度。'
    );
    if (!confirmed) return;
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
    if (!confirmed) return;
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

function initAssetSubtabs() {
    for (const button of el.assetSubtabButtons) {
        button.addEventListener('click', () => {
            setAssetSubtab(button.dataset.assetSubtabTarget);
        });
    }
    setAssetSubtab(assetState.subtab);
}

function initAssetSortButtons() {
    for (const button of el.assetSortButtons) {
        button.addEventListener('click', () => {
            const nextKey = `${button.dataset.assetSortKey || ''}`.trim();
            if (!nextKey) return;
            if (assetState.sortKey === nextKey) {
                assetState.sortDir = assetState.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                assetState.sortKey = nextKey;
                assetState.sortDir = nextKey === 'path' || nextKey === 'extension' ? 'asc' : 'desc';
            }
            renderAssetTable();
        });
    }
    updateSortButtonState();
}

function initAssetFilterButtons() {
    for (const button of el.assetFilterButtons) {
        button.addEventListener('click', () => {
            const nextFilter = `${button.dataset.assetFilter || 'all'}`.trim() || 'all';
            assetState.filterCategory = nextFilter;
            renderAssetTable();
        });
    }
    updateAssetFilterButtonState();
}

el.btnResetWholeGame?.addEventListener('click', () => {
    void resetWholeGameState();
});

el.btnResetLeaderboardProgress?.addEventListener('click', () => {
    void resetLeaderboardProgress();
});

el.btnAssetAuditScan?.addEventListener('click', () => {
    void scanAssets();
});

el.btnAssetAuditSelectAll?.addEventListener('click', () => {
    assetState.selected = new Set(assetState.unusedAssets.map((item) => item.path));
    renderUnusedAssetList();
});

el.btnAssetAuditClearSelection?.addEventListener('click', () => {
    assetState.selected.clear();
    renderUnusedAssetList();
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

initAssetSubtabs();
initAssetFilterButtons();
initAssetSortButtons();
updateAssetActionState();

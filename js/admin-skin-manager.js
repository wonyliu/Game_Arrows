import {
    LOCAL_SKIN_CATALOG_STORAGE_KEY,
    LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY,
    getDefaultCoinCostBySkinId,
    getSkinById,
    getSkinCatalog,
    isLegacyColorVariantSkinId
} from './skins.js?v=25';

const NAME_ZH_OVERRIDE_KEY = 'arrowClear_skinNameZhOverrides_v1';
const NAME_EN_OVERRIDE_KEY = 'arrowClear_skinNameEnOverrides_v1';
const DESC_ZH_OVERRIDE_KEY = 'arrowClear_skinDescZhOverrides_v1';
const DESC_EN_OVERRIDE_KEY = 'arrowClear_skinDescEnOverrides_v1';
const LOCAL_SKIN_PRICE_KEY = 'arrowClear_localSkinPriceOverrides_v1';
const DEFAULT_SKIN_ID = 'classic-burrow';

const PARTS = Object.freeze([
    Object.freeze({ key: 'headDefault', label: 'Head Default', file: 'snake_head.png', assetKey: 'snakeHead' }),
    Object.freeze({ key: 'headCurious', label: 'Head Curious', file: 'snake_head_curious.png', assetKey: 'snakeHeadCurious' }),
    Object.freeze({ key: 'headSleepy', label: 'Head Sleepy', file: 'snake_head_sleepy.png', assetKey: 'snakeHeadSleepy' }),
    Object.freeze({ key: 'headSurprised', label: 'Head Surprised', file: 'snake_head_surprised.png', assetKey: 'snakeHeadSurprised' }),
    Object.freeze({ key: 'segA', label: 'Segment A', file: 'snake_seg_a.png', assetKey: 'snakeSegA' }),
    Object.freeze({ key: 'segB', label: 'Segment B', file: 'snake_seg_b.png', assetKey: 'snakeSegB' }),
    Object.freeze({ key: 'tailBase', label: 'Tail Base', file: 'snake_tail_base.png', assetKey: 'snakeTailBase' }),
    Object.freeze({ key: 'tailTip', label: 'Tail Tip', file: 'snake_tail_tip.png', assetKey: 'snakeTailTip' })
]);

const el = {
    list: document.getElementById('skinLibraryList'),
    listStatus: document.getElementById('skinLibraryStatus'),
    search: document.getElementById('skinLibrarySearch'),
    select: document.getElementById('skinPriceSelect'),
    btnRefresh: document.getElementById('btnSkinRefreshList'),
    btnOpenGenA: document.getElementById('btnShowSkinGenView'),
    btnCloseGen: document.getElementById('btnCloseSkinGenView'),

    detailView: document.getElementById('skinDetailView'),
    genView: document.getElementById('skinGenView'),
    workspaceTitle: document.getElementById('skinWorkspaceTitle'),

    skinId: document.getElementById('skinMetaSkinId'),
    nameZh: document.getElementById('skinMetaNameZh'),
    nameEn: document.getElementById('skinMetaNameEn'),
    descZh: document.getElementById('skinMetaDescZh'),
    descEn: document.getElementById('skinMetaDescEn'),
    priceCurrent: document.getElementById('skinPriceCurrent'),
    priceInput: document.getElementById('skinPriceInput'),
    btnSaveMeta: document.getElementById('btnSaveSkinMeta'),
    btnDeleteSkin: document.getElementById('btnDeleteLocalSkin'),
    metaStatus: document.getElementById('skinPriceStatus'),
    partList: document.getElementById('skinPartList'),

    btnSavePriceLegacy: document.getElementById('btnSaveSkinPrice'),
    btnResetPriceLegacy: document.getElementById('btnResetSkinPrice'),
    priceDefault: document.getElementById('skinPriceDefault')
};

const REQUIRED_KEYS = [
    'list',
    'listStatus',
    'search',
    'select',
    'btnRefresh',
    'btnOpenGenA',
    'btnCloseGen',
    'detailView',
    'genView',
    'workspaceTitle',
    'skinId',
    'nameZh',
    'nameEn',
    'descZh',
    'descEn',
    'priceCurrent',
    'priceInput',
    'btnSaveMeta',
    'btnDeleteSkin',
    'metaStatus',
    'partList',
    'btnSavePriceLegacy'
];

const hasRequired = REQUIRED_KEYS.every((key) => Boolean(el[key]));
if (!hasRequired) {
    console.warn('[admin-skin-manager] missing required elements');
}

const state = {
    skins: [],
    selectedSkinId: '',
    filterText: '',
    nameZhOverrides: readJsonStorage(NAME_ZH_OVERRIDE_KEY, {}),
    nameEnOverrides: readJsonStorage(NAME_EN_OVERRIDE_KEY, {}),
    descZhOverrides: readJsonStorage(DESC_ZH_OVERRIDE_KEY, {}),
    descEnOverrides: readJsonStorage(DESC_EN_OVERRIDE_KEY, {}),
    localSkinPriceOverrides: readJsonStorage(LOCAL_SKIN_PRICE_KEY, {})
};

function readJsonStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
        return fallback;
    }
}

function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value || {}, null, 2));
}

function writeLocalSkinCatalog(savedRows, catalogSkins = []) {
    const builtInIds = new Set((Array.isArray(catalogSkins) ? catalogSkins : []).map((skin) => sanitizeId(skin?.id)));
    const savedIds = (Array.isArray(savedRows) ? savedRows : []).map((row) => sanitizeId(row?.id)).filter(Boolean);
    const candidateBaseIdSet = new Set([...builtInIds, ...savedIds, DEFAULT_SKIN_ID]);
    const payload = [];
    for (const row of (Array.isArray(savedRows) ? savedRows : [])) {
        const id = sanitizeId(row?.id);
        if (!id || id === DEFAULT_SKIN_ID || builtInIds.has(id)) {
            continue;
        }
        if (isLegacyColorVariantSkinId(id, candidateBaseIdSet) || isLegacyColorVariantSkinId(id)) {
            continue;
        }
        const nameZh = normalizeLabel(state.nameZhOverrides[id], normalizeLabel(row?.nameZh, id));
        const nameEn = normalizeLabel(state.nameEnOverrides[id], id);
        const descriptionZh = normalizeDescription(
            state.descZhOverrides[id],
            normalizeDescription(row?.descriptionZh, 'AI 生成皮肤。')
        );
        const descriptionEn = normalizeDescription(
            state.descEnOverrides[id],
            normalizeDescription(row?.descriptionEn, 'AI generated skin.')
        );
        payload.push({
            id,
            nameZh,
            nameEn,
            descriptionZh,
            descriptionEn,
            preview: `${row?.preview || `/assets/skins/${id}/snake_head.png`}`.split('?')[0],
            coinCost: Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[id]) || 0))
        });
    }
    localStorage.setItem(LOCAL_SKIN_CATALOG_STORAGE_KEY, JSON.stringify(payload, null, 2));
}

function sanitizeId(raw) {
    return `${raw || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeLabel(raw, fallback = '') {
    const text = `${raw || ''}`.replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function normalizeDescription(raw, fallback = '') {
    const text = `${raw || ''}`.replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function buildLocalAssets(skinId) {
    const id = sanitizeId(skinId);
    if (!id) return null;
    const base = `/assets/skins/${id}`;
    return {
        snakeHead: `${base}/snake_head.png`,
        snakeHeadCurious: `${base}/snake_head_curious.png`,
        snakeHeadSleepy: `${base}/snake_head_sleepy.png`,
        snakeHeadSurprised: `${base}/snake_head_surprised.png`,
        snakeSegA: `${base}/snake_seg_a.png`,
        snakeSegB: `${base}/snake_seg_b.png`,
        snakeTailBase: `${base}/snake_tail_base.png`,
        snakeTailTip: `${base}/snake_tail_tip.png`
    };
}

function setListStatus(text, isError = false) {
    el.listStatus.textContent = text || '';
    el.listStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

function setMetaStatus(text, isError = false) {
    el.metaStatus.textContent = text || '';
    el.metaStatus.style.color = isError ? '#c21f4e' : '#3f6b22';
}

async function fetchSavedSkins() {
    try {
        const res = await fetch('/api/skin-gen/saved-skins', { method: 'GET', cache: 'no-store' });
        if (!res.ok) return [];
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload?.skins) ? payload.skins : [];
        const normalizedRows = rows
            .map((row) => ({
                id: sanitizeId(row?.id),
                nameZh: normalizeLabel(row?.nameZh),
                descriptionZh: normalizeDescription(row?.descriptionZh),
                descriptionEn: normalizeDescription(row?.descriptionEn),
                complete: !!row?.complete,
                preview: typeof row?.preview === 'string' ? row.preview : '',
                protected: !!row?.protected
            }))
            .filter((row) => !!row.id && row.complete);
        const candidateBaseIdSet = new Set(normalizedRows.map((row) => row.id));
        candidateBaseIdSet.add(DEFAULT_SKIN_ID);
        return normalizedRows.filter((row) => !isLegacyColorVariantSkinId(row.id, candidateBaseIdSet) && !isLegacyColorVariantSkinId(row.id));
    } catch {
        return [];
    }
}

function getSkinDisplayName(skin, locale = 'zh-CN') {
    if (!skin) return '';
    if (skin.name?.[locale]) return skin.name[locale];
    return skin.name?.['en-US'] || skin.id;
}

function getSkinDescriptionByLocale(skin, locale = 'zh-CN') {
    if (!skin) return '';
    if (skin.description?.[locale]) return skin.description[locale];
    return skin.description?.['en-US'] || '';
}

function buildMergedSkins(catalog, savedRows) {
    const catalogIds = (Array.isArray(catalog) ? catalog : []).map((skin) => sanitizeId(skin?.id)).filter(Boolean);
    const savedIds = (Array.isArray(savedRows) ? savedRows : []).map((row) => sanitizeId(row?.id)).filter(Boolean);
    const candidateBaseIdSet = new Set([...catalogIds, ...savedIds, DEFAULT_SKIN_ID]);
    const savedById = new Map(savedRows.map((row) => [row.id, row]));
    const byId = new Map();

    for (const skin of catalog) {
        const id = sanitizeId(skin.id);
        if (!id) continue;

        const saved = savedById.get(id);
        const shouldKeep = id === DEFAULT_SKIN_ID || Boolean(saved);
        if (!shouldKeep) continue;

        byId.set(id, {
            id,
            source: 'catalog',
            protected: id === DEFAULT_SKIN_ID,
            preview: saved?.preview || `${skin.preview || skin.assets?.snakeHead || ''}`.split('?')[0],
            assets: saved ? buildLocalAssets(id) : skin.assets,
            defaultPrice: Math.max(0, Math.floor(Number(getDefaultCoinCostBySkinId(id)) || 0)),
            currentPrice: Math.max(0, Math.floor(Number(getSkinById(id)?.coinCost) || 0)),
            defaultZh: normalizeLabel(saved?.nameZh || getSkinDisplayName(skin, 'zh-CN'), id),
            defaultEn: normalizeLabel(getSkinDisplayName(skin, 'en-US'), id),
            defaultDescZh: normalizeDescription(saved?.descriptionZh || getSkinDescriptionByLocale(skin, 'zh-CN'), 'AI 生成皮肤。'),
            defaultDescEn: normalizeDescription(saved?.descriptionEn || getSkinDescriptionByLocale(skin, 'en-US'), 'AI generated skin.')
        });
    }

    for (const row of savedRows) {
        if (byId.has(row.id)) continue;
        if (isLegacyColorVariantSkinId(row.id, candidateBaseIdSet) || isLegacyColorVariantSkinId(row.id)) continue;
        byId.set(row.id, {
            id: row.id,
            source: 'local',
            protected: row.id === DEFAULT_SKIN_ID,
            preview: row.preview || `/assets/skins/${row.id}/snake_head.png`,
            assets: buildLocalAssets(row.id),
            defaultPrice: 0,
            currentPrice: Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[row.id]) || 0)),
            defaultZh: row.nameZh || row.id,
            defaultEn: row.id,
            defaultDescZh: normalizeDescription(row.descriptionZh, 'AI 生成皮肤。'),
            defaultDescEn: normalizeDescription(row.descriptionEn, 'AI generated skin.')
        });
    }

    return Array.from(byId.values()).sort((a, b) => {
        if (a.id === DEFAULT_SKIN_ID) return -1;
        if (b.id === DEFAULT_SKIN_ID) return 1;
        return a.id.localeCompare(b.id);
    });
}

function getSkinByStateId(skinId) {
    return state.skins.find((skin) => skin.id === skinId) || null;
}

function resolveNameZh(skin) {
    return normalizeLabel(state.nameZhOverrides[skin.id], skin.defaultZh || skin.id);
}

function resolveNameEn(skin) {
    return normalizeLabel(state.nameEnOverrides[skin.id], skin.defaultEn || skin.id);
}

function resolveDescZh(skin) {
    return normalizeDescription(state.descZhOverrides[skin.id], skin.defaultDescZh || 'AI 生成皮肤。');
}

function resolveDescEn(skin) {
    return normalizeDescription(state.descEnOverrides[skin.id], skin.defaultDescEn || 'AI generated skin.');
}

function syncSelectOptions() {
    el.select.innerHTML = '';
    for (const skin of state.skins) {
        const option = document.createElement('option');
        option.value = skin.id;
        option.textContent = `${resolveNameZh(skin)} (${skin.id})`;
        el.select.appendChild(option);
    }
    if (state.selectedSkinId && state.skins.some((skin) => skin.id === state.selectedSkinId)) {
        el.select.value = state.selectedSkinId;
    }
}

function renderPartList(skin) {
    el.partList.innerHTML = '';
    for (const part of PARTS) {
        const card = document.createElement('article');
        card.className = 'skin-part-item';

        const thumb = document.createElement('div');
        thumb.className = 'skin-part-thumb';
        const img = document.createElement('img');
        img.alt = part.label;
        img.loading = 'lazy';
        img.src = skin?.assets?.[part.assetKey] || '';
        thumb.appendChild(img);

        const meta = document.createElement('div');
        meta.className = 'skin-part-meta';
        meta.innerHTML = `<strong>${part.label}</strong><span>${part.file}</span>`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'skin-part-fit-btn';
        btn.textContent = '微调';
        btn.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('admin-skin-open-fit', {
                detail: { skinId: state.selectedSkinId, partKey: part.key }
            }));
        });

        card.appendChild(thumb);
        card.appendChild(meta);
        card.appendChild(btn);
        el.partList.appendChild(card);
    }
}

function renderMeta(skin) {
    if (!skin) return;
    el.skinId.value = skin.id;
    el.nameZh.value = resolveNameZh(skin);
    el.nameEn.value = resolveNameEn(skin);
    el.descZh.value = resolveDescZh(skin);
    el.descEn.value = resolveDescEn(skin);

    const currentPrice = skin.source === 'catalog'
        ? Math.max(0, Math.floor(Number(getSkinById(skin.id)?.coinCost) || 0))
        : Math.max(0, Math.floor(Number(state.localSkinPriceOverrides[skin.id]) || 0));

    if (el.priceDefault) {
        el.priceDefault.textContent = `${skin.defaultPrice}`;
    }
    el.priceCurrent.textContent = `${currentPrice}`;
    el.priceInput.value = `${currentPrice}`;
    el.btnDeleteSkin.disabled = skin.protected;
}

function renderLibrary() {
    const keyword = state.filterText.toLowerCase();
    const rows = state.skins.filter((skin) => {
        if (!keyword) return true;
        const zh = resolveNameZh(skin).toLowerCase();
        const en = resolveNameEn(skin).toLowerCase();
        return skin.id.includes(keyword) || zh.includes(keyword) || en.includes(keyword);
    });

    el.list.innerHTML = '';
    for (const skin of rows) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'skin-library-item';
        card.classList.toggle('is-active', skin.id === state.selectedSkinId);

        const img = document.createElement('img');
        img.className = 'skin-library-thumb';
        img.alt = skin.id;
        img.loading = 'lazy';
        img.src = skin.preview || '';

        const label = document.createElement('div');
        label.className = 'skin-library-name';
        label.innerHTML = `<strong>${resolveNameZh(skin)}</strong><span>${resolveNameEn(skin)} · ${skin.id}</span>`;

        card.appendChild(img);
        card.appendChild(label);
        card.addEventListener('click', () => selectSkin(skin.id, false));
        el.list.appendChild(card);
    }
}

function selectSkin(skinId, fromSelect) {
    const id = sanitizeId(skinId);
    if (!id || !state.skins.some((skin) => skin.id === id)) return;
    state.selectedSkinId = id;
    syncSelectOptions();
    if (!fromSelect) {
        el.select.value = id;
        el.select.dispatchEvent(new Event('change'));
    }
    const skin = getSkinByStateId(id);
    renderMeta(skin);
    renderPartList(skin);
    renderLibrary();
    window.dispatchEvent(new CustomEvent('admin-skin-selected', { detail: { skinId: id } }));
}

function syncTemplateFromSelectedSkin() {
    const templateSelect = document.getElementById('skinGenTemplateSelect');
    const selected = sanitizeId(el.select.value || state.selectedSkinId);
    if (!templateSelect || !selected) return;
    const exists = Array.from(templateSelect.options).some((option) => sanitizeId(option.value) === selected);
    if (!exists) return;
    templateSelect.value = selected;
    templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

function setWorkspaceView(view) {
    const showGen = view === 'gen';
    el.detailView.classList.toggle('is-active', !showGen);
    el.genView.classList.toggle('is-active', showGen);
    el.workspaceTitle.textContent = showGen ? '新建皮肤' : '皮肤详情';
    if (showGen) {
        setTimeout(syncTemplateFromSelectedSkin, 0);
    }
}

async function saveNames(skin) {
    const nextZh = normalizeLabel(el.nameZh.value, skin.defaultZh || skin.id);
    const nextEn = normalizeLabel(el.nameEn.value, skin.defaultEn || skin.id);
    const nextDescZh = normalizeDescription(el.descZh.value, skin.defaultDescZh || 'AI 生成皮肤。');
    const nextDescEn = normalizeDescription(el.descEn.value, skin.defaultDescEn || 'AI generated skin.');
    state.nameZhOverrides[skin.id] = nextZh;
    state.nameEnOverrides[skin.id] = nextEn;
    state.descZhOverrides[skin.id] = nextDescZh;
    state.descEnOverrides[skin.id] = nextDescEn;
    writeJsonStorage(NAME_ZH_OVERRIDE_KEY, state.nameZhOverrides);
    writeJsonStorage(NAME_EN_OVERRIDE_KEY, state.nameEnOverrides);
    writeJsonStorage(DESC_ZH_OVERRIDE_KEY, state.descZhOverrides);
    writeJsonStorage(DESC_EN_OVERRIDE_KEY, state.descEnOverrides);

    await fetch('/api/skin-gen/skin-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId: skin.id, nameZh: nextZh })
    }).catch(() => null);
}

async function saveMeta() {
    const skin = getSkinByStateId(state.selectedSkinId);
    if (!skin) return;

    await saveNames(skin);

    if (skin.source === 'catalog') {
        el.btnSavePriceLegacy.click();
    } else {
        const price = Math.max(0, Math.floor(Number(el.priceInput.value) || 0));
        state.localSkinPriceOverrides[skin.id] = price;
        writeJsonStorage(LOCAL_SKIN_PRICE_KEY, state.localSkinPriceOverrides);
    }

    await refreshCatalog(false);
    selectSkin(skin.id, false);
    setMetaStatus(`已保存：${skin.id}`);
}

async function deleteSkin() {
    const skin = getSkinByStateId(state.selectedSkinId);
    if (!skin || skin.protected || skin.id === DEFAULT_SKIN_ID) {
        return setMetaStatus('默认皮肤（洞穴经典）不可删除。', true);
    }

    if (!window.confirm(`确认删除皮肤 ${skin.id} ?\n将删除 assets/skins/${skin.id}/ 下全部文件。`)) {
        return;
    }

    try {
        const res = await fetch('/api/skin-gen/delete-skin', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skinId: skin.id })
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.ok) throw new Error(payload?.error || `删除失败 (${res.status})`);

        delete state.nameZhOverrides[skin.id];
        delete state.nameEnOverrides[skin.id];
        delete state.descZhOverrides[skin.id];
        delete state.descEnOverrides[skin.id];
        delete state.localSkinPriceOverrides[skin.id];
        const colorVariantMap = readJsonStorage(LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY, {});
        if (colorVariantMap && typeof colorVariantMap === 'object' && Object.prototype.hasOwnProperty.call(colorVariantMap, skin.id)) {
            delete colorVariantMap[skin.id];
            writeJsonStorage(LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY, colorVariantMap);
        }
        writeJsonStorage(NAME_ZH_OVERRIDE_KEY, state.nameZhOverrides);
        writeJsonStorage(NAME_EN_OVERRIDE_KEY, state.nameEnOverrides);
        writeJsonStorage(DESC_ZH_OVERRIDE_KEY, state.descZhOverrides);
        writeJsonStorage(DESC_EN_OVERRIDE_KEY, state.descEnOverrides);
        writeJsonStorage(LOCAL_SKIN_PRICE_KEY, state.localSkinPriceOverrides);

        await refreshCatalog(true);
        window.dispatchEvent(new CustomEvent('admin-skin-catalog-updated'));
        setMetaStatus(`已删除皮肤：${skin.id}`);
    } catch (error) {
        setMetaStatus(error?.message || '删除失败。', true);
    }
}

async function refreshCatalog(resetSelection) {
    const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
    const savedRows = await fetchSavedSkins();
    writeLocalSkinCatalog(savedRows, catalog);
    state.skins = buildMergedSkins(catalog, savedRows);

    const fallback = state.skins.find((skin) => skin.id === DEFAULT_SKIN_ID)?.id || state.skins[0]?.id || '';
    if (resetSelection || !state.skins.some((skin) => skin.id === state.selectedSkinId)) {
        state.selectedSkinId = fallback;
    }

    syncSelectOptions();
    renderLibrary();
    selectSkin(state.selectedSkinId, true);
    setListStatus(`共 ${state.skins.length} 套皮肤。`);

    window.dispatchEvent(new CustomEvent('admin-skin-catalog-updated'));
}

function bindEvents() {
    el.search.addEventListener('input', () => {
        state.filterText = `${el.search.value || ''}`.trim();
        renderLibrary();
    });

    el.select.addEventListener('change', () => selectSkin(el.select.value, true));
    el.btnRefresh.addEventListener('click', () => { void refreshCatalog(false); });
    el.btnSaveMeta.addEventListener('click', () => { void saveMeta(); });
    el.btnDeleteSkin.addEventListener('click', () => { void deleteSkin(); });

    const openGen = () => setWorkspaceView('gen');
    el.btnOpenGenA.addEventListener('click', openGen);
    el.btnCloseGen.addEventListener('click', () => setWorkspaceView('detail'));

    window.addEventListener('admin-skin-catalog-refresh', () => {
        void refreshCatalog(false);
    });
}

async function init() {
    bindEvents();
    setWorkspaceView('detail');
    await refreshCatalog(true);
}

if (hasRequired) {
    init().catch((error) => {
        setListStatus(error?.message || '皮肤管理初始化失败。', true);
    });
}








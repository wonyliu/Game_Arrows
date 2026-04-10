import {
  LOCAL_SKIN_CATALOG_STORAGE_KEY,
  LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY,
  getSkinCatalog,
  isLegacyColorVariantSkinId
} from './skins.js?v=25';

const DRAFT_KEY = 'arrowClear_skinGenWorkflowDraft_v1';
const DEFAULT_TEMPLATE_SKIN_ID = 'classic-burrow';
const DEFAULT_SOLID_BG = '#00ff00';
const DEFAULT_AUTO_FEATHER = 1;
const SKIN_CONTEXT_API = '/api/skin-gen/skin-context';

const PARTS = [
  { outputName: 'snake_head.png', assetKey: 'snakeHead', label: 'Head Default', isHead: true },
  { outputName: 'snake_head_curious.png', assetKey: 'snakeHeadCurious', label: 'Head Curious', isHead: true },
  { outputName: 'snake_head_sleepy.png', assetKey: 'snakeHeadSleepy', label: 'Head Sleepy', isHead: true },
  { outputName: 'snake_head_surprised.png', assetKey: 'snakeHeadSurprised', label: 'Head Surprised', isHead: true },
  { outputName: 'snake_seg_a.png', assetKey: 'snakeSegA', label: 'Segment A', isHead: false },
  { outputName: 'snake_seg_b.png', assetKey: 'snakeSegB', label: 'Segment B', isHead: false },
  { outputName: 'snake_tail_base.png', assetKey: 'snakeTailBase', label: 'Tail Base', isHead: false },
  { outputName: 'snake_tail_tip.png', assetKey: 'snakeTailTip', label: 'Tail Tip', isHead: false }
];
const PART_BY_NAME = new Map(PARTS.map((p) => [p.outputName, p]));

const el = {
  templateSelect: document.getElementById('skinGenTemplateSelect'),
  btnDeleteTemplateSkin: document.getElementById('btnSkinGenDeleteTemplateSkin'),
  styleRefFile: document.getElementById('skinGenStyleRefFile'),
  stylePreviewBtn: document.getElementById('btnSkinGenStylePreview'),
  stylePreview: document.getElementById('skinGenStylePreview'),
  stylePreviewEmpty: document.getElementById('skinGenStylePreviewEmpty'),
  btnRecropStyle: document.getElementById('btnSkinGenRecropStyle'),
  btnClearStyle: document.getElementById('btnSkinGenClearStyle'),
  variantRefFiles: document.getElementById('skinGenVariantRefFiles'),
  variantRefList: document.getElementById('skinGenVariantRefList'),
  saveAllVariants: document.getElementById('skinGenSaveAllVariants'),
  btnGenerateVariants: document.getElementById('btnSkinGenGenerateVariants'),
  cropModal: document.getElementById('skinGenCropModal'),
  cropBackdrop: document.querySelector('[data-skin-crop-close="true"]'),
  cropStage: document.getElementById('skinGenCropStage'),
  cropImage: document.getElementById('skinGenCropImage'),
  cropSelection: document.getElementById('skinGenCropSelection'),
  btnCropCancel: document.getElementById('btnSkinGenCropCancel'),
  btnCropConfirm: document.getElementById('btnSkinGenCropConfirm'),
  btnCropReset: document.getElementById('btnSkinGenCropReset'),
  globalNote: document.getElementById('skinGenGlobalNote'),
  promptExtra: document.getElementById('skinGenPromptExtra'),
  masterPrompt: document.getElementById('skinGenMasterPrompt'),
  promptPreview: document.getElementById('skinGenPromptPreview'),
  solidBg: document.getElementById('skinGenSolidBg'),
  bgTolerance: document.getElementById('skinGenBgTolerance'),
  btnQueueTask: document.getElementById('btnSkinGenQueueTask'),
  btnClearDraft: document.getElementById('btnSkinGenClearDraft'),
  status: document.getElementById('skinGenStatus'),
  taskList: document.getElementById('skinGenTaskList'),
  taskMeta: document.getElementById('skinGenTaskMeta'),
  postTolerance: document.getElementById('skinGenPostTolerance'),
  btnApplyPost: document.getElementById('btnSkinGenApplyPost'),
  btnSaveFinal: document.getElementById('btnSkinGenSaveFinal'),
  existingSkinSelect: document.getElementById('skinGenExistingSkinSelect'),
  btnLoadExistingSkin: document.getElementById('btnSkinGenLoadExistingSkin'),
  variantResultList: document.getElementById('skinGenVariantResultList'),
  rawGrid: document.getElementById('skinGenRawGrid'),
  postGrid: document.getElementById('skinGenPostGrid'),
  apiLogModal: document.getElementById('skinGenApiLogModal'),
  apiLogBackdrop: document.getElementById('skinGenApiLogBackdrop'),
  apiLogTitle: document.getElementById('skinGenApiLogTitle'),
  apiLogContent: document.getElementById('skinGenApiLogContent'),
  btnApiLogClose: document.getElementById('btnSkinGenApiLogClose'),
  btnApiLogCopy: document.getElementById('btnSkinGenApiLogCopy')
};
if (!Object.values(el).every(Boolean)) {
  console.warn('[admin-skin-gen] missing required elements');
}

const state = {
  templateSkinId: DEFAULT_TEMPLATE_SKIN_ID,
  styleDataUrl: '',
  styleOriginalDataUrl: '',
  styleSourceName: '',
  localSkinNameById: {},
  localTemplateAssetsBySkinId: {},
  builtinSkinIdSet: new Set(),
  queue: [],
  selectedTaskId: '',
  running: false,
  backendReady: true,
  translateCache: new Map(),
  imageCache: new Map(),
  progressTimerMap: new Map(),
  partRegenerating: false,
  apiLogTaskId: '',
  cropDraftDataUrl: '',
  cropRect: null,
  cropDragging: false,
  cropStartX: 0,
  cropStartY: 0,
  variantRefs: []
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const cleanAssetPath = (p) => `${p || ''}`.trim().split('?')[0];
const sanitizeId = (v) => `${v || ''}`.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
const normalizeName = (v) => `${v || ''}`.replace(/\s+/g, ' ').trim().slice(0, 24);
const clampNumber = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
};
function normalizeBg(v) {
  const t = `${v || ''}`.trim();
  const c = t.startsWith('#') ? t : `#${t}`;
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : DEFAULT_SOLID_BG;
}
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}
function rgbToHsl(r, g, b) {
  const rr = clamp(r, 0, 255) / 255;
  const gg = clamp(g, 0, 255) / 255;
  const bb = clamp(b, 0, 255) / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const hh = ((Number(h) % 360) + 360) % 360;
  const ss = clamp(Number(s), 0, 1);
  const ll = clamp(Number(l), 0, 1);
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs((hh / 60) % 2 - 1));
  const m = ll - c / 2;
  let r1 = 0; let g1 = 0; let b1 = 0;
  if (hh < 60) { r1 = c; g1 = x; }
  else if (hh < 120) { r1 = x; g1 = c; }
  else if (hh < 180) { g1 = c; b1 = x; }
  else if (hh < 240) { g1 = x; b1 = c; }
  else if (hh < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255)
  ];
}
function circularHueDelta(fromHue, toHue) {
  let d = (toHue - fromHue) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}
function meanHueFromImageData(imageData) {
  const data = imageData?.data;
  if (!data || !data.length) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 24) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.12) continue;
    if (l < 0.08 || l > 0.95) continue;
    const rad = h * Math.PI / 180;
    sx += Math.cos(rad);
    sy += Math.sin(rad);
  }
  if (sx === 0 && sy === 0) return null;
  let deg = Math.atan2(sy, sx) * 180 / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}
async function imageDataFromUrl(url) {
  if (!url) return null;
  const img = await loadImageElement(url);
  const w = Math.max(1, Number(img.naturalWidth || img.width || 1));
  const h = Math.max(1, Number(img.naturalHeight || img.height || 1));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}
async function harmonizePartHueToTaskStyle(task, partName, partUrl) {
  if (!task || !partName || !partUrl) return '';
  const styleRefUrl = task.postPreview?.['snake_seg_b.png']
    || task.postPreview?.['snake_seg_a.png']
    || task.finalPreview?.['snake_seg_b.png']
    || task.finalPreview?.['snake_seg_a.png']
    || '';
  if (!styleRefUrl) return '';
  const [srcData, refData] = await Promise.all([
    imageDataFromUrl(partUrl),
    imageDataFromUrl(styleRefUrl)
  ]);
  if (!srcData || !refData) return '';
  const srcHue = meanHueFromImageData(srcData);
  const refHue = meanHueFromImageData(refData);
  if (!Number.isFinite(srcHue) || !Number.isFinite(refHue)) return '';
  const delta = circularHueDelta(srcHue, refHue);
  if (Math.abs(delta) < 10) return '';

  const data = srcData.data;
  const strength = 1.0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 24) continue;
    let [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.08) continue;
    if (l < 0.06 || l > 0.96) continue;
    h = (h + delta * strength + 360) % 360;
    const [r, g, b] = hslToRgb(h, s, l);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  const c = document.createElement('canvas');
  c.width = srcData.width;
  c.height = srcData.height;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(srcData, 0, 0);
  return c.toDataURL('image/png');
}
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function normalizeTaskConfig(rawConfig = {}) {
  const cfg = isObj(rawConfig) ? rawConfig : {};
  return {
    templateSkinId: sanitizeId(cfg.templateSkinId) || DEFAULT_TEMPLATE_SKIN_ID,
    styleDataUrl: typeof cfg.styleDataUrl === 'string' ? cfg.styleDataUrl.trim() : '',
    globalNote: typeof cfg.globalNote === 'string' ? cfg.globalNote.trim() : '',
    promptExtra: typeof cfg.promptExtra === 'string' ? cfg.promptExtra.trim() : '',
    masterPrompt: typeof cfg.masterPrompt === 'string' ? cfg.masterPrompt.trim() : '',
    solidBg: normalizeBg(cfg.solidBg),
    defaultTolerance: clampNumber(cfg.defaultTolerance, 0, 441, 42),
    defaultFeather: clampNumber(cfg.defaultFeather, 0, 8, 1)
  };
}

function buildGenerationContextFromTask(task) {
  const cfg = normalizeTaskConfig(task?.config || {});
  return {
    templateSkinId: cfg.templateSkinId,
    globalNote: cfg.globalNote,
    promptExtra: cfg.promptExtra,
    masterPrompt: cfg.masterPrompt,
    solidBg: cfg.solidBg,
    defaultTolerance: cfg.defaultTolerance,
    defaultFeather: cfg.defaultFeather,
    styleImageDataUrl: cfg.styleDataUrl || ''
  };
}

function readLocalSkinCatalog() {
  try {
    const raw = localStorage.getItem(LOCAL_SKIN_CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (isObj(parsed)) return Object.values(parsed);
    return [];
  } catch {
    return [];
  }
}

function writeLocalSkinCatalog(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  localStorage.setItem(LOCAL_SKIN_CATALOG_STORAGE_KEY, JSON.stringify(safeRows, null, 2));
}

function upsertLocalSkinCatalogEntry(skinId, skinNameZh = '') {
  const id = sanitizeId(skinId);
  if (!id || id === DEFAULT_TEMPLATE_SKIN_ID) return;
  const rows = readLocalSkinCatalog().filter((row) => sanitizeId(row?.id) !== id);
  rows.push({
    id,
    nameZh: normalizeName(skinNameZh || id),
    nameEn: id,
    descriptionZh: 'AI generated skin.',
    descriptionEn: 'AI generated skin.',
    preview: `/assets/skins/${id}/snake_head.png`,
    coinCost: 0
  });
  writeLocalSkinCatalog(rows);
}

function removeLocalSkinCatalogEntry(skinId) {
  const id = sanitizeId(skinId);
  if (!id) return;
  const nextRows = readLocalSkinCatalog().filter((row) => sanitizeId(row?.id) !== id);
  writeLocalSkinCatalog(nextRows);
}

function readLocalSkinColorVariantMap() {
  try {
    const raw = localStorage.getItem(LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isObj(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalSkinColorVariantMap(map) {
  const safe = isObj(map) ? map : {};
  localStorage.setItem(LOCAL_SKIN_COLOR_VARIANTS_STORAGE_KEY, JSON.stringify(safe, null, 2));
}

function setStatus(text, isError = false) {
  el.status.textContent = text || '';
  el.status.style.color = isError ? '#c21f4e' : '#356f2f';
}

function renderStylePreview() {
  if (!state.styleDataUrl) {
    el.stylePreview.hidden = true;
    el.stylePreview.removeAttribute('src');
    if (el.stylePreviewEmpty) el.stylePreviewEmpty.hidden = false;
    if (el.stylePreviewBtn) el.stylePreviewBtn.disabled = true;
    if (el.btnRecropStyle) el.btnRecropStyle.disabled = true;
    if (el.btnClearStyle) el.btnClearStyle.disabled = true;
    return;
  }
  el.stylePreview.src = state.styleDataUrl;
  el.stylePreview.hidden = false;
  if (el.stylePreviewEmpty) el.stylePreviewEmpty.hidden = true;
  if (el.stylePreviewBtn) el.stylePreviewBtn.disabled = false;
  if (el.btnRecropStyle) el.btnRecropStyle.disabled = false;
  if (el.btnClearStyle) el.btnClearStyle.disabled = false;
}

function renderVariantRefList() {
  if (!el.variantRefList) return;
  el.variantRefList.innerHTML = '';
  if (!Array.isArray(state.variantRefs) || state.variantRefs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'skin-gen-task-empty';
    empty.textContent = '未添加颜色参考图。';
    el.variantRefList.appendChild(empty);
    return;
  }
  for (const ref of state.variantRefs) {
    const item = document.createElement('div');
    item.className = 'skin-gen-variant-ref-item';
    const img = document.createElement('img');
    img.src = ref.dataUrl;
    img.alt = ref.name || 'variant-reference';
    img.loading = 'lazy';
    const label = document.createElement('span');
    label.textContent = `${ref.name || 'ref'}`.slice(0, 24);
    item.appendChild(img);
    item.appendChild(label);
    el.variantRefList.appendChild(item);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(`${reader.result || ''}`);
    reader.onerror = () => reject(new Error('Failed to read style reference image.'));
    reader.readAsDataURL(file);
  });
}

function closeCropModal() {
  state.cropDragging = false;
  if (el.cropModal) el.cropModal.hidden = true;
}

function setCropRect(rect) {
  if (!rect) {
    state.cropRect = null;
    if (el.cropSelection) el.cropSelection.hidden = true;
    return;
  }
  const maxW = el.cropStage.clientWidth || 0;
  const maxH = el.cropStage.clientHeight || 0;
  if (!maxW || !maxH) return;
  const x = clamp(rect.x, 0, maxW);
  const y = clamp(rect.y, 0, maxH);
  const w = clamp(rect.w, 1, maxW - x);
  const h = clamp(rect.h, 1, maxH - y);
  state.cropRect = { x, y, w, h };
  el.cropSelection.hidden = false;
  el.cropSelection.style.left = `${x}px`;
  el.cropSelection.style.top = `${y}px`;
  el.cropSelection.style.width = `${w}px`;
  el.cropSelection.style.height = `${h}px`;
}

function resetCropRect() {
  const w = el.cropStage.clientWidth || 0;
  const h = el.cropStage.clientHeight || 0;
  if (!w || !h) return;
  const pad = Math.floor(Math.min(w, h) * 0.04);
  const rw = Math.max(1, w - pad * 2);
  const rh = Math.max(1, h - pad * 2);
  setCropRect({ x: Math.max(0, pad), y: Math.max(0, pad), w: rw, h: rh });
}

function pointInCropStage(event) {
  const rect = el.cropStage.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width);
  const y = clamp(event.clientY - rect.top, 0, rect.height);
  return { x, y };
}

function openCropModal(dataUrl, sourceName = '') {
  if (!dataUrl || !el.cropModal) return;
  state.cropDraftDataUrl = dataUrl;
  state.cropRect = null;
  state.cropDragging = false;
  if (sourceName) state.styleSourceName = sourceName;
  el.cropImage.src = dataUrl;
  el.cropModal.hidden = false;
  requestAnimationFrame(() => resetCropRect());
}

function openCropFromCurrentStyle() {
  const source = state.styleOriginalDataUrl || state.styleDataUrl;
  if (!source) return setStatus('请先上传样式参考图。', true);
  openCropModal(source, state.styleSourceName || 'style-reference.png');
}

function applyCropSelection() {
  const img = el.cropImage;
  if (!img?.naturalWidth || !img?.naturalHeight) return setStatus('裁切预览尚未加载完成。', true);
  const cw = img.clientWidth || 0;
  const ch = img.clientHeight || 0;
  if (!cw || !ch) return setStatus('裁切容器尺寸无效。', true);

  const rect = state.cropRect || { x: 0, y: 0, w: cw, h: ch };
  const sxScale = img.naturalWidth / cw;
  const syScale = img.naturalHeight / ch;
  const sx = Math.floor(rect.x * sxScale);
  const sy = Math.floor(rect.y * syScale);
  const sw = Math.max(1, Math.floor(rect.w * sxScale));
  const sh = Math.max(1, Math.floor(rect.h * syScale));
  const safeSw = Math.min(sw, img.naturalWidth - sx);
  const safeSh = Math.min(sh, img.naturalHeight - sy);

  const canvas = document.createElement('canvas');
  canvas.width = safeSw;
  canvas.height = safeSh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, safeSw, safeSh, 0, 0, safeSw, safeSh);

  state.styleDataUrl = canvas.toDataURL('image/png');
  renderStylePreview();
  writeDraft();
  closeCropModal();
  setStatus(`样式参考图已裁切：${state.styleSourceName || 'style-reference.png'}`);
}

function buildLocalSkinAssets(skinId) {
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

async function fetchSavedSkinList() {
  try {
    const res = await fetch('/api/skin-gen/saved-skins', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return [];
    const payload = await res.json().catch(() => ({}));
    const rows = Array.isArray(payload?.skins) ? payload.skins : [];
    const normalizedRows = rows
      .map((r) => ({ id: sanitizeId(r?.id), nameZh: normalizeName(r?.nameZh), complete: !!r?.complete }))
      .filter((r) => r.id);
    const candidateBaseIdSet = new Set(normalizedRows.map((row) => row.id));
    candidateBaseIdSet.add(DEFAULT_TEMPLATE_SKIN_ID);
    return normalizedRows.filter((row) => !isLegacyColorVariantSkinId(row.id, candidateBaseIdSet) && !isLegacyColorVariantSkinId(row.id));
  } catch { return []; }
}

function getSkinByIdExact(skinId) {
  const key = sanitizeId(skinId);
  if (!key) return null;
  const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
  return catalog.find((skin) => sanitizeId(skin?.id) === key) || null;
}

function getTemplateAssetsBySkinId(skinId) {
  const key = sanitizeId(skinId);
  if (!key) return null;
  const localAssets = state.localTemplateAssetsBySkinId?.[key];
  if (localAssets) return localAssets;
  const exactSkin = getSkinByIdExact(key);
  if (exactSkin?.assets) return exactSkin.assets;
  return buildLocalSkinAssets(key);
}

function getTemplatePartPath(part, skinId = state.templateSkinId) {
  const assets = getTemplateAssetsBySkinId(skinId);
  return cleanAssetPath(assets?.[part.assetKey]);
}

async function fillTemplateOptions() {
  const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
  const selected = sanitizeId(el.templateSelect.value || state.templateSkinId) || DEFAULT_TEMPLATE_SKIN_ID;

  const localRows = (await fetchSavedSkinList()).filter((r) => r.complete);
  const localRowById = new Map(localRows.map((row) => [row.id, row]));
  const localNameMap = { ...state.localSkinNameById };
  const localAssets = {};
  for (const row of localRows) {
    if (row.nameZh) localNameMap[row.id] = row.nameZh;
    const inCatalog = catalog.some((skin) => sanitizeId(skin.id) === row.id);
    if (!inCatalog) {
      const assets = buildLocalSkinAssets(row.id);
      if (assets) localAssets[row.id] = assets;
    }
  }
  state.localSkinNameById = localNameMap;
  state.localTemplateAssetsBySkinId = localAssets;

  el.templateSelect.innerHTML = '';
  const renderedBuiltin = new Set();
  for (const skin of catalog) {
    const id = sanitizeId(skin.id);
    if (!id) continue;
    if (id !== DEFAULT_TEMPLATE_SKIN_ID && !localRowById.has(id)) {
      continue;
    }
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${skin.name?.['zh-CN'] || skin.id} (${id})`;
    el.templateSelect.appendChild(opt);
    renderedBuiltin.add(id);
  }
  for (const row of localRows) {
    if (renderedBuiltin.has(row.id)) continue;
    const opt = document.createElement('option');
    opt.value = row.id;
    opt.textContent = `${row.nameZh || '本地皮肤'} (${row.id})`;
    el.templateSelect.appendChild(opt);
  }
  state.builtinSkinIdSet = renderedBuiltin;

  const ids = Array.from(el.templateSelect.options).map((o) => sanitizeId(o.value)).filter(Boolean);
  const fallback = ids.includes(DEFAULT_TEMPLATE_SKIN_ID) ? DEFAULT_TEMPLATE_SKIN_ID : (ids[0] || DEFAULT_TEMPLATE_SKIN_ID);
  state.templateSkinId = ids.includes(selected) ? selected : fallback;
  el.templateSelect.value = state.templateSkinId;
}

async function fillExistingSkinOptions(preferredSkinId = '') {
  if (!el.existingSkinSelect) return;
  const catalog = Array.isArray(getSkinCatalog()) ? getSkinCatalog() : [];
  const savedRows = (await fetchSavedSkinList()).filter((row) => row.complete);
  const currentValue = sanitizeId(preferredSkinId || el.existingSkinSelect.value || '');
  el.existingSkinSelect.innerHTML = '';

  const byId = new Map();
  for (const skin of catalog) {
    const id = sanitizeId(skin?.id);
    if (!id) continue;
    byId.set(id, `${skin?.name?.['zh-CN'] || skin.id}`.trim() || id);
  }
  for (const row of savedRows) {
    const id = sanitizeId(row?.id);
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, `${row?.nameZh || id}`.trim() || id);
    }
  }

  const allPairs = Array.from(byId.entries()).sort(([aId], [bId]) => {
    if (aId === DEFAULT_TEMPLATE_SKIN_ID) return -1;
    if (bId === DEFAULT_TEMPLATE_SKIN_ID) return 1;
    return aId.localeCompare(bId);
  });

  for (const [id, label] of allPairs) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${label} (${id})`;
    el.existingSkinSelect.appendChild(opt);
  }

  const allIds = allPairs.map(([id]) => id);
  if (allIds.length === 0) return;
  const fallback = allIds.includes(DEFAULT_TEMPLATE_SKIN_ID) ? DEFAULT_TEMPLATE_SKIN_ID : allIds[0];
  const next = allIds.includes(currentValue) ? currentValue : fallback;
  el.existingSkinSelect.value = next;
}

async function fetchSkinGenerationContext(skinId) {
  const id = sanitizeId(skinId);
  if (!id) return null;
  try {
    const res = await fetch(`${SKIN_CONTEXT_API}?skinId=${encodeURIComponent(id)}`, {
      method: 'GET',
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    return isObj(payload?.context) ? payload.context : null;
  } catch {
    return null;
  }
}

async function hydrateTaskGenerationContext(task) {
  if (!task?.skinId) return null;
  const context = await fetchSkinGenerationContext(task.skinId);
  if (!isObj(context)) return null;

  const merged = normalizeTaskConfig({
    ...(task.config || {}),
    templateSkinId: context.templateSkinId,
    globalNote: context.globalNote,
    promptExtra: context.promptExtra,
    masterPrompt: context.masterPrompt,
    solidBg: context.solidBg,
    defaultTolerance: context.defaultTolerance,
    defaultFeather: Number.isFinite(Number(context.defaultFeather))
      ? clamp(Number(context.defaultFeather), 0, 8)
      : DEFAULT_AUTO_FEATHER
  });

  if (typeof context.styleImageWebPath === 'string' && context.styleImageWebPath.trim()) {
    const cacheTag = Date.now().toString(36);
    const join = context.styleImageWebPath.includes('?') ? '&' : '?';
    try {
      merged.styleDataUrl = await urlToDataUrl(`${context.styleImageWebPath}${join}v=${cacheTag}`);
    } catch {
      // ignore style image read failure; keep other context fields
    }
  } else if (context.styleImageWebPath === null) {
    merged.styleDataUrl = '';
  }

  task.config = merged;
  if (Array.isArray(context.colorVariants) && context.colorVariants.length > 0) {
    const targetSkinId = sanitizeId(task.skinId || merged.templateSkinId || '');
    if (targetSkinId) {
      writeSkinColorVariantConfigs(targetSkinId, context.colorVariants);
    }
  }
  return context;
}

function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } }
function writeDraft() {
  const draft = {
    templateSkinId: sanitizeId(el.templateSelect.value || state.templateSkinId),
    globalNote: el.globalNote.value || '',
    promptExtra: el.promptExtra.value || '',
    masterPrompt: el.masterPrompt.value || '',
    solidBg: normalizeBg(el.solidBg.value),
    bgTolerance: clamp(Number(el.bgTolerance.value), 0, 441),
    postTolerance: clamp(Number(el.postTolerance.value), 0, 441),
    saveAllVariants: !!el.saveAllVariants?.checked
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function applyDraft() {
  const d = readDraft();
  if (!isObj(d)) return;
  if (typeof d.templateSkinId === 'string') {
    const id = sanitizeId(d.templateSkinId);
    if (Array.from(el.templateSelect.options).some((o) => sanitizeId(o.value) === id)) {
      state.templateSkinId = id;
      el.templateSelect.value = id;
    }
  }
  if (typeof d.globalNote === 'string') el.globalNote.value = d.globalNote;
  if (typeof d.promptExtra === 'string') el.promptExtra.value = d.promptExtra;
  if (typeof d.masterPrompt === 'string') el.masterPrompt.value = d.masterPrompt;
  if (typeof d.solidBg === 'string') el.solidBg.value = normalizeBg(d.solidBg);
  if (Number.isFinite(Number(d.bgTolerance))) el.bgTolerance.value = `${clamp(Number(d.bgTolerance), 0, 441)}`;
  if (Number.isFinite(Number(d.postTolerance))) el.postTolerance.value = `${clamp(Number(d.postTolerance), 0, 441)}`;
  if (typeof d.saveAllVariants === 'boolean' && el.saveAllVariants) {
    el.saveAllVariants.checked = d.saveAllVariants;
  }
}

function getSelectedTask() { return state.queue.find((t) => t.id === state.selectedTaskId) || null; }
function getVisibleQueueTasks() {
  return state.queue.filter((task) => task?.mode !== 'color-variant-local');
}
function taskStatus(status) { return ({ queued: '排队中', running: '生成中', generated: '待后处理', saved: '已保存', failed: '失败' }[status] || status); }

function ensureTaskApiLogs(task) {
  if (!task || !isObj(task)) return [];
  if (!Array.isArray(task.apiLogs)) task.apiLogs = [];
  return task.apiLogs;
}

function appendTaskApiLog(task, entry = {}) {
  if (!task || !isObj(task)) return;
  const logs = ensureTaskApiLogs(task);
  logs.push({
    at: new Date().toISOString(),
    ...entry
  });
  if (logs.length > 120) {
    logs.splice(0, logs.length - 120);
  }
}

function stringifyTaskApiLogs(task) {
  const logs = ensureTaskApiLogs(task);
  if (logs.length <= 0) {
    return '该任务暂无 API 日志。';
  }
  const blocks = logs.map((log, index) => {
    const header = `#${index + 1} ${log.at || ''} ${log.method || 'POST'} ${log.endpoint || ''}${log.tag ? ` [${log.tag}]` : ''}`;
    const status = `status=${Number.isFinite(Number(log.responseStatus)) ? log.responseStatus : '-'} ok=${log.responseOk === true ? 'true' : 'false'}`;
    const requestBody = JSON.stringify(log.requestBody ?? null, null, 2);
    const responseBody = JSON.stringify(log.responseBody ?? null, null, 2);
    const errorText = log.error ? `error=${log.error}` : '';
    return [
      header,
      status,
      errorText,
      'requestBody:',
      requestBody,
      'responseBody:',
      responseBody
    ].filter(Boolean).join('\n');
  });
  return blocks.join('\n\n----------------------------------------\n\n');
}

function openTaskApiLogModal(taskId) {
  const id = `${taskId || ''}`.trim();
  const task = state.queue.find((item) => item?.id === id);
  if (!task) return;
  state.apiLogTaskId = id;
  if (el.apiLogTitle) {
    el.apiLogTitle.textContent = `任务 API 日志 - ${task.skinNameZh || task.skinId || task.id}`;
  }
  if (el.apiLogContent) {
    el.apiLogContent.value = stringifyTaskApiLogs(task);
    el.apiLogContent.scrollTop = 0;
  }
  if (el.apiLogModal) {
    el.apiLogModal.hidden = false;
  }
}

function closeTaskApiLogModal() {
  state.apiLogTaskId = '';
  if (el.apiLogModal) el.apiLogModal.hidden = true;
}

async function copyTaskApiLogToClipboard() {
  const task = state.queue.find((item) => item?.id === state.apiLogTaskId);
  if (!task) return;
  const text = stringifyTaskApiLogs(task);
  try {
    await navigator.clipboard.writeText(text);
    setStatus('任务 API 日志已复制。');
  } catch {
    setStatus('复制失败，请手动复制日志文本。', true);
  }
}

async function postJsonWithTaskLog(task, endpoint, body, tag = '') {
  let res = null;
  let payload = null;
  let errorMessage = '';
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    payload = await res.json().catch(() => null);
    return { res, payload };
  } catch (error) {
    errorMessage = error?.message || 'network error';
    throw error;
  } finally {
    appendTaskApiLog(task, {
      tag,
      endpoint,
      method: 'POST',
      requestBody: body,
      responseStatus: res?.status ?? null,
      responseOk: !!res?.ok,
      responseBody: payload,
      error: errorMessage
    });
    if (state.apiLogTaskId && task?.id === state.apiLogTaskId && !el.apiLogModal?.hidden && el.apiLogContent) {
      el.apiLogContent.value = stringifyTaskApiLogs(task);
    }
  }
}

function taskCover(task) {
  for (const p of PARTS) {
    const u = task.postPreview?.[p.outputName] || task.finalPreview?.[p.outputName] || task.rawPreview?.[p.outputName] || '';
    if (u) return u;
  }
  if (task.config?.styleDataUrl) return task.config.styleDataUrl;
  const headPart = PARTS[0];
  return getTemplatePartPath(headPart, task.config?.templateSkinId || state.templateSkinId) || '';
}

function clearTaskTimer(taskId) {
  const timer = state.progressTimerMap.get(taskId);
  if (timer) {
    clearInterval(timer);
    state.progressTimerMap.delete(taskId);
  }
}

function startTaskTimer(task) {
  clearTaskTimer(task.id);
  const timer = setInterval(() => {
    if (task.status !== 'running') return clearTaskTimer(task.id);
    const current = clamp(Number(task.progress) || 0, 0, 96);
    const next = Math.min(96, current + (Math.random() * 4 + 1.2));
    if (next > current) {
      task.progress = next;
      renderTaskList();
      if (task.id === state.selectedTaskId) renderSelectedTask();
    }
  }, 900);
  state.progressTimerMap.set(task.id, timer);
}

function renderTaskList() {
  el.taskList.innerHTML = '';
  const visibleTasks = getVisibleQueueTasks();
  if (visibleTasks.length === 0) {
    const e = document.createElement('div');
    e.className = 'skin-gen-task-empty';
    e.textContent = '暂无任务。';
    el.taskList.appendChild(e);
    renderVariantResultList();
    return;
  }

  for (const task of visibleTasks) {
    ensureTaskApiLogs(task);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'skin-gen-task-item';
    card.classList.toggle('is-active', task.id === state.selectedTaskId);
    card.classList.toggle('is-running', task.status === 'running');
    card.classList.toggle('is-failed', task.status === 'failed');

    const main = document.createElement('div');
    main.className = 'skin-gen-task-main';

    const cover = taskCover(task);
    const img = document.createElement('img');
    img.className = 'skin-gen-task-cover';
    if (cover) img.src = cover;
    img.alt = task.skinNameZh || task.skinId || task.id;
    img.loading = 'lazy';
    main.appendChild(img);

    const info = document.createElement('div');
    info.className = 'skin-gen-task-info';
    const head = document.createElement('div');
    head.className = 'skin-gen-task-head';
    const title = document.createElement('strong');
    title.textContent = task.skinNameZh || task.skinId || task.id;
    const badge = document.createElement('span');
    badge.className = 'skin-gen-task-badge';
    badge.textContent = taskStatus(task.status);
    head.appendChild(title);
    head.appendChild(badge);
    info.appendChild(head);

    const sub = document.createElement('div');
    sub.className = 'skin-gen-task-sub';
    sub.textContent = `模板:${task.config?.templateSkinId || '-'} · 进度 ${Math.round(task.progress || 0)}%`;
    info.appendChild(sub);
    main.appendChild(info);
    card.appendChild(main);

    const infoBtn = document.createElement('span');
    infoBtn.className = 'skin-gen-task-info-btn';
    infoBtn.textContent = 'i';
    infoBtn.title = '查看该任务发送给 API 的日志';
    infoBtn.setAttribute('role', 'button');
    infoBtn.setAttribute('tabindex', '0');
    infoBtn.setAttribute('aria-label', '查看任务 API 日志');
    infoBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTaskApiLogModal(task.id);
    });
    infoBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        openTaskApiLogModal(task.id);
      }
    });
    card.appendChild(infoBtn);

    const progress = document.createElement('div');
    progress.className = 'skin-gen-task-progress';
    const fill = document.createElement('div');
    fill.className = 'skin-gen-task-progress-fill';
    fill.style.width = `${clamp(Number(task.progress) || 0, 0, 100)}%`;
    progress.appendChild(fill);
    card.appendChild(progress);

    if (task.error) {
      const er = document.createElement('div');
      er.className = 'skin-gen-task-error';
      er.textContent = task.error;
      card.appendChild(er);
    }

    card.addEventListener('click', () => {
      state.selectedTaskId = task.id;
      renderTaskList();
      renderSelectedTask();
    });
    el.taskList.appendChild(card);
  }
  renderVariantResultList();
}

function renderVariantResultList() {
  if (!el.variantResultList) return;
  el.variantResultList.innerHTML = '';
  const selected = getSelectedTask();
  const baseTask = resolveSaveRootTask(selected);
  let rows = state.queue.filter((task) => task?.mode === 'color-variant-local');
  if (baseTask?.id) {
    rows = rows.filter((task) => task.parentTaskId === baseTask.id);
  }
  rows.sort((a, b) => {
    const aName = `${a.variantColorHex || ''}`.toLowerCase();
    const bName = `${b.variantColorHex || ''}`.toLowerCase();
    if (aName && bName && aName !== bName) return aName.localeCompare(bName);
    return `${a.skinNameZh || a.skinId || a.id}`.localeCompare(`${b.skinNameZh || b.skinId || b.id}`);
  });
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'skin-gen-task-empty';
    empty.textContent = '暂无颜色变体。';
    el.variantResultList.appendChild(empty);
    return;
  }
  for (const task of rows) {
    const card = document.createElement('article');
    card.className = 'skin-gen-variant-result-item';
    card.classList.toggle('is-active', task.id === state.selectedTaskId);
    let headUrl = task.postPreview?.['snake_head.png']
      || task.finalPreview?.['snake_head.png']
      || task.rawPreview?.['snake_head.png']
      || '';
    if (!headUrl && task.parentTaskId) {
      const parent = state.queue.find((item) => item?.id === task.parentTaskId);
      headUrl = parent?.postPreview?.['snake_head.png']
        || parent?.finalPreview?.['snake_head.png']
        || parent?.rawPreview?.['snake_head.png']
        || '';
    }
    const img = document.createElement('img');
    if (headUrl) img.src = headUrl;
    img.alt = task.skinNameZh || task.skinId || task.id;
    img.loading = 'lazy';
    const meta = document.createElement('div');
    meta.className = 'skin-gen-variant-result-meta';
    const title = document.createElement('strong');
    title.textContent = (task.lastRenderedColorHex || task.variantColorHex || '').toUpperCase() || '变体';
    const sub = document.createElement('span');
    sub.textContent = taskStatus(task.status);
    meta.appendChild(title);
    meta.appendChild(sub);
    card.appendChild(img);
    card.appendChild(meta);
    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.className = 'skin-gen-variant-regen-btn';
    regenBtn.textContent = '重生';
    regenBtn.disabled = state.partRegenerating || state.running || task.status === 'running';
    regenBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void regenerateColorVariantTask(task.id);
    });
    card.appendChild(regenBtn);
    card.addEventListener('click', () => {
      state.selectedTaskId = task.id;
      renderTaskList();
      renderSelectedTask();
    });
    el.variantResultList.appendChild(card);
  }
}
function renderGrid(container, map, emptyText, task = null) {
  container.innerHTML = '';
  const entries = PARTS.map((p) => ({ part: p, url: map?.[p.outputName] || '' })).filter((e) => !!e.url);
  if (entries.length === 0) {
    const e = document.createElement('div');
    e.className = 'skin-gen-task-empty';
    e.textContent = emptyText;
    container.appendChild(e);
    return;
  }
  for (const entry of entries) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'skin-gen-result-item';
    const t = document.createElement('strong');
    t.textContent = entry.part.label;
    const img = document.createElement('img');
    img.src = entry.url;
    img.alt = entry.part.outputName;
    img.loading = 'lazy';
    item.appendChild(t);
    item.appendChild(img);

    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.className = 'skin-gen-result-regen-btn';
    regenBtn.textContent = '重生';
    const lockRegen = task?.mode === 'color-variant-local';
    regenBtn.disabled = lockRegen || !task?.skinId || state.partRegenerating || state.running;
    regenBtn.hidden = lockRegen;
    regenBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void regeneratePartForSelectedTask(entry.part.outputName);
    });
    item.appendChild(regenBtn);
    container.appendChild(item);
  }
}

function renderSelectedTask() {
  const task = getSelectedTask();
  if (!task) {
    el.taskMeta.textContent = '未选择任务。';
    el.promptPreview.value = '';
    renderGrid(el.rawGrid, {}, '暂无生成原图。', null);
    renderGrid(el.postGrid, {}, '暂无后处理预览。', null);
    return;
  }
  const skinLabel = task.skinNameZh || task.skinId || '(等待生成)';
  const count = Object.keys(task.postPreview || task.finalPreview || {}).length;
  el.taskMeta.textContent = `任务 ${task.id} · ${taskStatus(task.status)} · 进度 ${Math.round(task.progress || 0)}% · 皮肤 ${skinLabel} · 可预览 ${count}/8`;
  el.promptPreview.value = task.promptPreview || '';
  const rawMap = isObj(task.rawPreview) ? task.rawPreview : {};
  const postMap = isObj(task.postPreview) && Object.keys(task.postPreview).length
    ? task.postPreview
    : (isObj(task.finalPreview) ? task.finalPreview : {});
  renderGrid(el.rawGrid, rawMap, '该任务暂无原图预览。', task);
  renderGrid(el.postGrid, postMap, '该任务暂无后处理预览。', task);
}

async function probeBackend() {
  try {
    const res = await fetch('/api/skin-gen/health', { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    const payload = await res.json().catch(() => ({}));
    state.backendReady = true;
    if (payload?.hasApiKey === false) setStatus('后端已启动，但缺少 GEMINI_API_KEY / GOOGLE_API_KEY。', true);
    return true;
  } catch {
    state.backendReady = false;
    setStatus('无法连接皮肤生成后端，请先启动 start_all_servers.bat。', true);
    return false;
  }
}

async function translateCached(text) {
  const source = `${text || ''}`.trim();
  if (!source) return '';
  if (state.translateCache.has(source)) return state.translateCache.get(source);
  try {
    const res = await fetch('/api/skin-gen/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: source })
    });
    const payload = await res.json().catch(() => ({}));
    const translated = typeof payload?.translated === 'string' && payload.translated.trim() ? payload.translated.trim() : source;
    state.translateCache.set(source, translated);
    return translated;
  } catch {
    state.translateCache.set(source, source);
    return source;
  }
}

function expression(partName) {
  if (partName === 'snake_head.png') return 'Expression: both eyes open, slight neutral frown, no tongue.';
  if (partName === 'snake_head_curious.png') return 'Expression: one eye open + one wink arc, curious smile, no tongue.';
  if (partName === 'snake_head_sleepy.png') return 'Expression: sleepy eyes / droopy eyelids, no tongue.';
  if (partName === 'snake_head_surprised.png') return 'Expression: surprised, eyes wide open, small mouth with tongue.';
  return 'Body/tail part: no face elements.';
}

const REGEN_STYLE_ANCHOR_PRIORITY = Object.freeze([
  'snake_seg_a.png',
  'snake_seg_b.png',
  'snake_head.png',
  'snake_head_curious.png',
  'snake_head_sleepy.png',
  'snake_head_surprised.png',
  'snake_tail_tip.png',
  'snake_tail_base.png'
]);

function pickStyleAnchorUrl(task, excludePartName = '') {
  if (!task || !isObj(task)) return '';
  const pools = [task.postPreview, task.finalPreview, task.rawPreview];
  for (const partName of REGEN_STYLE_ANCHOR_PRIORITY) {
    if (!partName || partName === excludePartName) continue;
    for (const pool of pools) {
      const url = pool?.[partName];
      if (typeof url === 'string' && url.trim()) {
        return url.trim();
      }
    }
  }
  return '';
}

function buildPromptMap(task, notes) {
  const out = {};
  const baseEnglishPrompt = `${notes.masterPrompt || ''}`.trim()
    || `${notes.globalNote || ''}`.trim()
    || `${notes.promptExtra || ''}`.trim()
    || 'Keep template shape exactly, only replace color and texture according to style reference.';
  for (const part of PARTS) {
    out[part.outputName] = [
      baseEnglishPrompt,
      `Part target: ${part.outputName}.`,
      `Keep geometry exactly the same as template ${task.config.templateSkinId}.`,
      `Background must be pure solid color: ${task.config.solidBg}.`
    ].join('\n');
  }
  return out;
}

function collectTemplateMap(templateSkinId) {
  const map = {};
  for (const part of PARTS) {
    const p = getTemplatePartPath(part, templateSkinId);
    if (!p) throw new Error(`模板皮肤缺少配件：${part.outputName}`);
    map[part.outputName] = p;
  }
  return map;
}

function createQueuedTask(configPatch = {}) {
  const baseConfig = normalizeTaskConfig({
    templateSkinId: sanitizeId(el.templateSelect.value || state.templateSkinId) || DEFAULT_TEMPLATE_SKIN_ID,
    styleDataUrl: state.styleDataUrl,
    globalNote: `${el.globalNote.value || ''}`.trim(),
    promptExtra: `${el.promptExtra.value || ''}`.trim(),
    masterPrompt: `${el.masterPrompt.value || ''}`.trim(),
    solidBg: normalizeBg(el.solidBg.value),
    defaultTolerance: clamp(Number(el.bgTolerance.value), 0, 441),
    defaultFeather: DEFAULT_AUTO_FEATHER
  });
  return {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'queued',
    progress: 0,
    error: '',
    skinId: '',
    skinNameZh: '',
    promptPreview: '',
    rawPreview: {},
    cutoutPreview: {},
    finalPreview: {},
    postPreview: {},
    apiLogs: [],
    config: normalizeTaskConfig({ ...baseConfig, ...configPatch })
  };
}

function buildSkinPartPreviewMap(skinId, cacheTag = Date.now().toString(36)) {
  const key = sanitizeId(skinId);
  if (!key) return { skin: null, map: {} };
  const skin = getSkinByIdExact(key) || {
    id: key,
    name: { 'zh-CN': state.localSkinNameById[key] || key, 'en-US': key }
  };
  const assets = getTemplateAssetsBySkinId(key);
  const map = {};
  if (!assets) {
    return { skin, map };
  }
  for (const part of PARTS) {
    const sourcePath = cleanAssetPath(assets?.[part.assetKey] || '');
    if (!sourcePath) continue;
    const join = sourcePath.includes('?') ? '&' : '?';
    map[part.outputName] = `${sourcePath}${join}v=${cacheTag}`;
  }
  return { skin, map };
}

async function loadExistingSkinForPostProcess() {
  const skinId = sanitizeId(el.existingSkinSelect?.value || '');
  if (!skinId) return setStatus('请先选择现有皮肤。', true);

  const { skin, map } = buildSkinPartPreviewMap(skinId);
  if (!skin || Object.keys(map).length === 0) {
    return setStatus(`无法加载该皮肤资源：${skinId}`, true);
  }

  let task = state.queue.find((item) => item?.sourceMode === 'existing-skin' && sanitizeId(item.skinId) === skinId);
  if (!task) {
    task = createQueuedTask({ templateSkinId: DEFAULT_TEMPLATE_SKIN_ID, styleDataUrl: '' });
    task.sourceMode = 'existing-skin';
    state.queue.push(task);
  }
  task.config = normalizeTaskConfig({
    ...(task.config || {}),
    templateSkinId: task.config?.templateSkinId || DEFAULT_TEMPLATE_SKIN_ID
  });

  task.status = 'saved';
  task.progress = 100;
  task.error = '';
  task.skinId = skinId;
  const selectedOption = el.existingSkinSelect?.selectedOptions?.[0];
  const optionLabel = `${selectedOption?.textContent || ''}`.replace(/\s*\([^)]+\)\s*$/, '').trim();
  task.skinNameZh = normalizeName(optionLabel || state.localSkinNameById[skinId] || skin?.name?.['zh-CN'] || skinId);
  task.promptPreview = '现有皮肤后处理模式';
  task.rawPreview = { ...map };
  task.finalPreview = { ...map };
  task.postPreview = { ...map };
  const context = await hydrateTaskGenerationContext(task);
  const hasContext = !!context;

  removeVariantTasksOfBase(task.id);
  const effectiveSkin = getSkinByIdExact(skinId);
  const contextVariants = Array.isArray(context?.colorVariants) && context.colorVariants.length > 0
    ? context.colorVariants
    : null;
  const preloadedVariants = await createVariantTasksFromSkinConfig(task, effectiveSkin, contextVariants);
  for (const variantTask of preloadedVariants) {
    state.queue.push(variantTask);
  }
  if (preloadedVariants.length > 0) {
    pumpQueue();
  }

  state.selectedTaskId = task.id;
  renderTaskList();
  renderSelectedTask();
  setStatus(`已加载现有皮肤：${task.skinNameZh} (${skinId})，可直接重新抠图并保存。${hasContext ? ' 已自动加载历史风格配置。' : ''}${preloadedVariants.length > 0 ? ` 已同步 ${preloadedVariants.length} 个颜色变体。` : ''}`);
}

function enqueueTask() {
  const task = createQueuedTask();
  state.queue.push(task);
  if (!state.selectedTaskId) state.selectedTaskId = task.id;
  renderTaskList();
  renderSelectedTask();
  setStatus(`已加入任务队列：${task.id}`);
  pumpQueue();
}

function hueDistance(a, b) {
  const da = Math.abs(a - b) % 360;
  return Math.min(da, 360 - da);
}

function isColorClose(hexA, hexB) {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const [h1, s1, l1] = rgbToHsl(r1, g1, b1);
  const [h2, s2, l2] = rgbToHsl(r2, g2, b2);
  return hueDistance(h1, h2) < 14 && Math.abs(s1 - s2) < 0.14 && Math.abs(l1 - l2) < 0.14;
}

async function extractPaletteFromReference(dataUrl, maxCount = 8) {
  const img = await loadImage(dataUrl);
  const sampleSize = 120;
  const c = document.createElement('canvas');
  c.width = sampleSize;
  c.height = sampleSize;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, sampleSize, sampleSize);
  const data = x.getImageData(0, 0, sampleSize, sampleSize).data;
  const bucketMap = new Map();

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 170) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.22) continue;
    if (l < 0.1 || l > 0.92) continue;
    const hb = Math.round(h / 10) * 10;
    const sb = Math.round(s * 10) / 10;
    const lb = Math.round(l * 10) / 10;
    const key = `${hb}|${sb}|${lb}`;
    const prev = bucketMap.get(key) || { count: 0, sumH: 0, sumS: 0, sumL: 0 };
    prev.count += 1;
    prev.sumH += h;
    prev.sumS += s;
    prev.sumL += l;
    bucketMap.set(key, prev);
  }

  const sorted = Array.from(bucketMap.values())
    .filter((row) => row.count >= 8)
    .sort((a, b) => b.count - a.count);

  const out = [];
  for (const row of sorted) {
    const h = row.sumH / row.count;
    const s = row.sumS / row.count;
    const l = row.sumL / row.count;
    const [rr, gg, bb] = hslToRgb(h, s, l);
    const hex = rgbToHex(rr, gg, bb);
    if (out.some((existing) => isColorClose(existing, hex))) continue;
    out.push(hex);
    if (out.length >= maxCount) break;
  }
  return out;
}

async function collectVariantPaletteColors(refs) {
  const palette = [];
  const safeRefs = Array.isArray(refs) ? refs : [];
  for (const ref of safeRefs) {
    const dataUrl = typeof ref?.dataUrl === 'string' ? ref.dataUrl : '';
    if (!dataUrl) continue;
    let list = [];
    try {
      list = await extractPaletteFromReference(dataUrl, 9);
    } catch {
      list = [];
    }
    for (const hex of list) {
      if (!palette.some((existing) => isColorClose(existing, hex))) {
        palette.push(hex);
      }
      if (palette.length >= 16) return palette;
    }
  }
  return palette;
}

function collectTaskPreviewMap(task) {
  const post = isObj(task?.postPreview) ? task.postPreview : {};
  if (Object.keys(post).length > 0) return { ...post };
  const finalMap = isObj(task?.finalPreview) ? task.finalPreview : {};
  if (Object.keys(finalMap).length > 0) return { ...finalMap };
  const rawMap = isObj(task?.rawPreview) ? task.rawPreview : {};
  return { ...rawMap };
}

function seededRandom(seed) {
  const x = Math.sin((Number(seed) || 1) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function jitterVariantHex(hex, regenTick = 0) {
  const input = normalizeBg(hex);
  if (!regenTick) return input;
  const [r, g, b] = hexToRgb(input);
  const [h, s, l] = rgbToHsl(r, g, b);
  const hueShift = (seededRandom(regenTick + 11) - 0.5) * 14;
  const satScale = 1 + (seededRandom(regenTick + 17) - 0.5) * 0.22;
  const lightScale = 1 + (seededRandom(regenTick + 23) - 0.5) * 0.16;
  const [rr, gg, bb] = hslToRgb(
    h + hueShift,
    clamp(s * satScale, 0.2, 1),
    clamp(l * lightScale, 0.1, 0.95)
  );
  return rgbToHex(rr, gg, bb);
}

function variantHexFromConfig(baseHex, variantConfig) {
  const safeBase = normalizeBg(baseHex || '#66ccff');
  const [r, g, b] = hexToRgb(safeBase);
  const [h, s, l] = rgbToHsl(r, g, b);
  const cfg = isObj(variantConfig) ? variantConfig : {};
  if (cfg.forceBinaryMonochrome === true) {
    return cfg.invertBinaryMonochrome === true ? '#000000' : '#ffffff';
  }
  if (cfg.forceMonochrome === true) {
    const monoL = clamp(Number(cfg.monochromeLightness) || 0.5, 0, 1);
    const gray = Math.round(monoL * 255);
    return rgbToHex(gray, gray, gray);
  }
  const hue = h + (Number(cfg.hueShift) || 0);
  const sat = clamp(s * (Number(cfg.saturation) || 1), 0.2, 1);
  const light = clamp(l * (Number(cfg.lightness) || 1), 0.1, 0.95);
  const [rr, gg, bb] = hslToRgb(hue, sat, light);
  return rgbToHex(rr, gg, bb);
}

function removeVariantTasksOfBase(baseTaskId) {
  if (!baseTaskId) return;
  state.queue = state.queue.filter((task) => !(
    task?.mode === 'color-variant-local'
    && task.parentTaskId === baseTaskId
    && task.status !== 'running'
  ));
}

function createVariantTask(baseTask, colorHex, index = 0, variantId = '') {
  const task = createQueuedTask({
    templateSkinId: sanitizeId(baseTask.skinId) || DEFAULT_TEMPLATE_SKIN_ID,
    styleDataUrl: baseTask.config?.styleDataUrl || '',
    globalNote: `${baseTask.config?.globalNote || ''}`.trim(),
    promptExtra: `Color variant lock: produce full set with single main color ${colorHex}.`,
    masterPrompt: `${baseTask.config?.masterPrompt || ''}`.trim()
  });
  task.mode = 'color-variant-local';
  task.parentTaskId = baseTask.id;
  task.variantId = `${variantId || ''}`.trim();
  task.variantColorHex = normalizeBg(colorHex || '#66ccff');
  task.basePreviewMap = collectTaskPreviewMap(baseTask);
  task.skinId = sanitizeId(baseTask.skinId) || '';
  task.skinNameZh = buildVariantDisplayName(baseTask, task.variantColorHex, index);
  task.variantRegenTick = 0;
  task.allowJitter = true;
  return task;
}

async function createVariantTasksFromSkinConfig(baseTask, skin, preferredVariants = null) {
  const variants = Array.isArray(preferredVariants) && preferredVariants.length > 0
    ? preferredVariants
    : (Array.isArray(skin?.colorVariants) ? skin.colorVariants : []);
  if (!baseTask?.id || variants.length === 0) return [];
  const baseHex = await resolveTaskHeadDominantHex(baseTask, '#66ccff');
  const next = [];
  for (let i = 0; i < variants.length; i += 1) {
    const cfg = variants[i];
    const colorHex = variantHexFromConfig(baseHex, cfg);
    const task = createVariantTask(baseTask, colorHex, i, `${cfg?.id || ''}`);
    task.variantConfig = cfg;
    task.allowJitter = cfg?.forceBinaryMonochrome === true ? false : true;
    next.push(task);
  }
  return next;
}

function recolorSourcePixel(r, g, b, a, targetHsl) {
  if (a <= 0) return [r, g, b, a];
  const [h, s, l] = rgbToHsl(r, g, b);
  const preserveGray = s < 0.1 && (l < 0.2 || l > 0.9);
  if (preserveGray) return [r, g, b, a];
  const nextH = targetHsl[0];
  const nextS = clamp(targetHsl[1] * 0.72 + s * 0.28, 0.2, 1);
  const nextL = clamp(l * 0.84 + targetHsl[2] * 0.16, 0, 1);
  const [nr, ng, nb] = hslToRgb(nextH, nextS, nextL);
  return [nr, ng, nb, a];
}

async function recolorPartToHex(sourceUrl, targetHex) {
  const img = await loadImage(sourceUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const data = x.getImageData(0, 0, w, h);
  const [tr, tg, tb] = hexToRgb(targetHex);
  const targetHsl = rgbToHsl(tr, tg, tb);
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    const a = data.data[i + 3];
    const [nr, ng, nb, na] = recolorSourcePixel(r, g, b, a, targetHsl);
    data.data[i] = nr;
    data.data[i + 1] = ng;
    data.data[i + 2] = nb;
    data.data[i + 3] = na;
  }
  x.putImageData(data, 0, 0);
  return c.toDataURL('image/png');
}

async function executeLocalColorVariantTask(task) {
  task.status = 'running';
  task.progress = 8;
  task.error = '';
  renderTaskList();
  renderSelectedTask();
  const sourceMap = isObj(task.basePreviewMap) ? task.basePreviewMap : {};
  const sourceNames = PARTS.map((p) => p.outputName).filter((name) => !!sourceMap[name]);
  if (sourceNames.length === 0) throw new Error('缺少基础皮肤预览，无法生成颜色变体。');
  const regenTick = task.allowJitter === false ? 0 : (Number(task.variantRegenTick) || 0);
  const colorHex = jitterVariantHex(task.variantColorHex || '#66ccff', regenTick);
  task.lastRenderedColorHex = colorHex;
  const out = {};
  let done = 0;
  for (const partName of sourceNames) {
    out[partName] = await recolorPartToHex(sourceMap[partName], colorHex);
    done += 1;
    task.progress = clamp(Math.round((done / sourceNames.length) * 100), 10, 96);
    renderTaskList();
    if (task.id === state.selectedTaskId) renderSelectedTask();
  }
  task.rawPreview = { ...out };
  task.finalPreview = { ...out };
  task.postPreview = { ...out };
  task.status = 'generated';
  task.progress = 100;
}

function buildVariantDisplayName(baseTask, colorHex, index) {
  const baseName = normalizeName(baseTask.skinNameZh || baseTask.skinId || '颜色变体');
  const suffix = `${colorHex || ''}`.replace('#', '').toUpperCase();
  if (suffix) return normalizeName(`${baseName} ${suffix}`) || `${baseName} ${index + 1}`;
  return `${baseName} ${index + 1}`;
}

async function enqueueVariantTasksFromSelected() {
  const selectedTask = getSelectedTask();
  const baseTask = resolveSaveRootTask(selectedTask);
  if (!baseTask || !baseTask.skinId) {
    return setStatus('请先在任务队列中选中一个已生成皮肤任务。', true);
  }
  if (!(baseTask.status === 'generated' || baseTask.status === 'saved')) {
    return setStatus('请先完成基础皮肤生成/后处理，再生成颜色变体。', true);
  }
  if (!Array.isArray(state.variantRefs) || state.variantRefs.length === 0) {
    return setStatus('请先上传一张或多张颜色变体参考图。', true);
  }

  const sourceMap = collectTaskPreviewMap(baseTask);
  if (Object.keys(sourceMap).length === 0) {
    return setStatus('当前任务没有可用预览图，无法生成颜色变体。', true);
  }

  setStatus('正在从颜色参考图提取色板...');
  const palette = await collectVariantPaletteColors(state.variantRefs);
  if (palette.length === 0) {
    return setStatus('未能从参考图提取到有效颜色，请换一张颜色更明确的参考图。', true);
  }

  removeVariantTasksOfBase(baseTask.id);
  const queued = [];
  for (let i = 0; i < palette.length; i += 1) {
    const task = createVariantTask(baseTask, palette[i], i, `ref-${i + 1}`);
    task.basePreviewMap = { ...sourceMap };
    queued.push(task);
    state.queue.push(task);
  }

  if (queued.length > 0) {
    state.selectedTaskId = baseTask.id;
    renderTaskList();
    renderSelectedTask();
    setStatus(`已开始生成 ${queued.length} 组颜色变体（仅在下方“颜色变体结果”显示）。`);
    pumpQueue();
  }
}

function getAutoPostOptions(task) {
  const taskTolerance = Number.isFinite(Number(task?.config?.defaultTolerance))
    ? clamp(Number(task.config.defaultTolerance), 0, 441)
    : clamp(Number(el.postTolerance?.value ?? 42), 0, 441);
  const taskFeather = Number.isFinite(Number(task?.config?.defaultFeather))
    ? clamp(Number(task.config.defaultFeather), 0, 8)
    : DEFAULT_AUTO_FEATHER;
  return {
    solidBg: normalizeBg(task?.config?.solidBg || el.solidBg.value),
    tolerance: taskTolerance,
    feather: taskFeather,
    enableFeather: true
  };
}

async function applyAutoPostForTask(task, onlyPart = '') {
  const names = onlyPart ? [onlyPart] : PARTS.map((p) => p.outputName);
  const options = getAutoPostOptions(task);
  for (const name of names) {
    if (!(task.rawPreview?.[name] || task.finalPreview?.[name])) continue;
    task.postPreview[name] = await processPart(task, name, options);
  }
}

async function executeTask(task) {
  task.config = normalizeTaskConfig(task.config || {});
  if (task.mode === 'color-variant-local') {
    try {
      await executeLocalColorVariantTask(task);
      setStatus(`颜色变体完成：${task.skinNameZh || task.skinId || task.id}`);
    } catch (error) {
      task.status = 'failed';
      task.error = error?.message || '颜色变体生成失败';
      task.progress = 100;
      setStatus(task.error, true);
    } finally {
      renderTaskList();
      renderSelectedTask();
    }
    return;
  }
  task.status = 'running';
  task.progress = 6;
  task.error = '';
  startTaskTimer(task);
  renderTaskList();
  renderSelectedTask();

  try {
    if (!state.backendReady) {
      const ok = await probeBackend();
      if (!ok) throw new Error('后端不可用');
    }
    const notes = {
      globalNote: await translateCached(task.config.globalNote),
      promptExtra: await translateCached(task.config.promptExtra),
      masterPrompt: await translateCached(task.config.masterPrompt)
    };
    const customPrompts = buildPromptMap(task, notes);
    task.promptPreview = customPrompts['snake_head.png'] || '';
    task.progress = Math.max(task.progress, 24);
    renderTaskList();
    renderSelectedTask();

    const body = {
      skinId: '',
      skinNameZh: '',
      templateSkinId: task.config.templateSkinId,
      styleImageDataUrl: task.config.styleDataUrl,
      templateMap: collectTemplateMap(task.config.templateSkinId),
      globalNote: notes.globalNote,
      promptExtra: notes.promptExtra,
      customPrompts,
      annotationNotes: {},
      annotationOverlays: {},
      onlyPart: '',
      batchCount: 1,
      autoIdentity: true,
      solidBackground: task.config.solidBg,
      bgTolerance: task.config.defaultTolerance,
      bgFeather: task.config.defaultFeather,
      saveToAssets: false
    };
    const { res, payload } = await postJsonWithTaskLog(task, '/api/skin-gen/generate', body, 'generate-full');
    task.progress = Math.max(task.progress, 66);
    renderTaskList();
    renderSelectedTask();
    if (!res.ok || !payload?.ok) {
      if (res.status === 404 || res.status === 501) {
        state.backendReady = false;
        throw new Error('后端未启用 skin-gen 接口。');
      }
      throw new Error(payload?.error || `生成失败 (${res.status})`);
    }

    const row = Array.isArray(payload?.batches) && payload.batches.length ? payload.batches[payload.batches.length - 1] : payload;
    task.skinId = sanitizeId(row?.skinId || payload?.skinId || '');
    task.skinNameZh = normalizeName(row?.skinNameZh || payload?.skinNameZh || '');
    task.rawPreview = isObj(row?.rawPreview) ? row.rawPreview : (isObj(payload?.rawPreview) ? payload.rawPreview : {});
    task.cutoutPreview = isObj(row?.cutoutPreview) ? row.cutoutPreview : (isObj(payload?.cutoutPreview) ? payload.cutoutPreview : {});
    task.finalPreview = isObj(row?.finalPreview)
      ? row.finalPreview
      : (isObj(row?.preview) ? row.preview : (isObj(payload?.finalPreview) ? payload.finalPreview : (isObj(payload?.preview) ? payload.preview : {})));
    task.postPreview = { ...task.finalPreview };
    await applyAutoPostForTask(task);
    task.status = 'generated';
    task.progress = 100;
    clearTaskTimer(task.id);
    setStatus(`任务完成：${task.skinNameZh || task.skinId || task.id}`);
  } catch (error) {
    clearTaskTimer(task.id);
    task.status = 'failed';
    task.error = error?.message || '生成失败';
    task.progress = 100;
    setStatus(task.error, true);
  } finally {
    clearTaskTimer(task.id);
    renderTaskList();
    renderSelectedTask();
  }
}

function pumpQueue() {
  if (state.running) return;
  const next = state.queue.find((t) => t.status === 'queued');
  if (!next) return;
  state.running = true;
  void executeTask(next).finally(() => {
    state.running = false;
    pumpQueue();
  });
}

function hexToRgb(v) {
  const t = normalizeBg(v).slice(1);
  return [parseInt(t.slice(0, 2), 16), parseInt(t.slice(2, 4), 16), parseInt(t.slice(4, 6), 16)];
}

async function loadImage(url) {
  if (state.imageCache.has(url)) return state.imageCache.get(url);
  const loader = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败：${url}`));
    img.src = url;
  });
  state.imageCache.set(url, loader);
  return loader;
}

function imageToData(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  return x.getImageData(0, 0, w, h);
}

function dataToCanvas(data) {
  const c = document.createElement('canvas');
  c.width = data.width;
  c.height = data.height;
  const x = c.getContext('2d');
  x.putImageData(data, 0, 0);
  return c;
}

function findAlphaBounds(imageData) {
  const width = Math.max(1, Number(imageData?.width) || 1);
  const height = Math.max(1, Number(imageData?.height) || 1);
  const data = imageData?.data;
  if (!data || data.length < width * height * 4) {
    return { x: 0, y: 0, width, height };
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const alpha = data[row + x * 4 + 3];
      if (alpha <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width, height };
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

async function normalizePartToTemplateSilhouette(sourceUrl, templateUrl) {
  if (!sourceUrl || !templateUrl) return sourceUrl;
  const [sourceImg, templateImg] = await Promise.all([
    loadImage(sourceUrl),
    loadImage(templateUrl)
  ]);
  const sourceData = imageToData(sourceImg);
  const templateData = imageToData(templateImg);
  const sourceBounds = findAlphaBounds(sourceData);
  const templateBounds = findAlphaBounds(templateData);

  const sourceCanvas = dataToCanvas(sourceData);
  const templateCanvas = dataToCanvas(templateData);
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = templateCanvas.width;
  outputCanvas.height = templateCanvas.height;
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputCtx) {
    return sourceUrl;
  }

  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = 'high';
  outputCtx.drawImage(
    sourceCanvas,
    sourceBounds.x,
    sourceBounds.y,
    sourceBounds.width,
    sourceBounds.height,
    templateBounds.x,
    templateBounds.y,
    templateBounds.width,
    templateBounds.height
  );
  outputCtx.globalCompositeOperation = 'destination-in';
  outputCtx.drawImage(templateCanvas, 0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.globalCompositeOperation = 'source-over';
  return outputCanvas.toDataURL('image/png');
}

function cutout(data, solidBg, tolerance, feather, enableFeather) {
  const w = data.width, h = data.height, src = data.data;
  const [r0, g0, b0] = hexToRgb(solidBg);
  const candidate = new Uint8Array(w * h);
  for (let i = 0; i < candidate.length; i += 1) {
    const o = i * 4;
    const dr = src[o] - r0, dg = src[o + 1] - g0, db = src[o + 2] - b0;
    candidate[i] = Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance ? 1 : 0;
  }
  const vis = new Uint8Array(w * h);
  const q = new Uint32Array(w * h);
  let head = 0, tail = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (!candidate[idx] || vis[idx]) return;
    vis[idx] = 1;
    q[tail++] = idx;
  };
  for (let x = 0; x < w; x += 1) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += 1) { push(0, y); push(w - 1, y); }
  while (head < tail) {
    const idx = q[head++];
    const x = idx % w, y = Math.floor(idx / w);
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  let alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = Math.min(src[i * 4 + 3], vis[i] ? 0 : 255);

  if (enableFeather && feather > 0) {
    const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
    const x1 = c1.getContext('2d', { willReadFrequently: true });
    const id = x1.createImageData(w, h);
    for (let i = 0; i < alpha.length; i += 1) {
      const o = i * 4;
      id.data[o] = 255; id.data[o + 1] = 255; id.data[o + 2] = 255; id.data[o + 3] = alpha[i];
    }
    x1.putImageData(id, 0, 0);
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const x2 = c2.getContext('2d', { willReadFrequently: true });
    x2.filter = `blur(${feather}px)`; x2.drawImage(c1, 0, 0); x2.filter = 'none';
    const d2 = x2.getImageData(0, 0, w, h).data;
    for (let i = 0; i < alpha.length; i += 1) alpha[i] = d2[i * 4 + 3];
  }

  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < alpha.length; i += 1) {
    const o = i * 4;
    out[o] = src[o]; out[o + 1] = src[o + 1]; out[o + 2] = src[o + 2]; out[o + 3] = alpha[i];
  }
  return new ImageData(out, w, h);
}
async function processPart(task, partName, options) {
  const rawUrl = task.rawPreview?.[partName] || task.finalPreview?.[partName] || '';
  if (!rawUrl) throw new Error(`缺少原图：${partName}`);
  const rawImg = await loadImage(rawUrl);
  const rawData = imageToData(rawImg);
  // Post process requirement: only remove solid-color background.
  const cutData = cutout(rawData, options.solidBg, options.tolerance, options.feather, options.enableFeather);
  return dataToCanvas(cutData).toDataURL('image/png');
}

function targetParts(task) {
  return PARTS.map((p) => p.outputName).filter((name) => !!(task.rawPreview?.[name] || task.finalPreview?.[name]));
}

async function regeneratePartForSelectedTask(partName) {
  const part = PART_BY_NAME.get(partName);
  if (!part) return setStatus(`无效配件：${partName}`, true);
  const task = getSelectedTask();
  if (!task) return setStatus('请先选择任务。', true);
  if (!task.skinId) return setStatus('该任务没有 skinId，无法单独重生配件。', true);
  if (state.running) return setStatus('当前有整套任务在执行，请稍后再重生单配件。', true);
  if (state.partRegenerating) return setStatus('已有单配件重生任务在执行。', true);

  try {
    state.partRegenerating = true;
    task.error = '';
    if (!state.backendReady) {
      const ok = await probeBackend();
      if (!ok) throw new Error('后端不可用');
    }

    task.config = normalizeTaskConfig(task.config || {});
    const currentSkinId = sanitizeId(task.skinId);
    const configuredTemplateId = sanitizeId(task.config.templateSkinId);
    // For single-part regen, geometry lock must not use the target skin itself as template source.
    // Otherwise model tends to copy stale colors from the same skin part (e.g. old green head).
    const effectiveTemplateId = (
      configuredTemplateId && configuredTemplateId !== currentSkinId
    ) ? configuredTemplateId : DEFAULT_TEMPLATE_SKIN_ID;
    task.config.templateSkinId = effectiveTemplateId;

    const notes = {
      globalNote: await translateCached(task.config.globalNote),
      promptExtra: await translateCached(task.config.promptExtra),
      masterPrompt: await translateCached(task.config.masterPrompt)
    };

    const styleDataUrl = task.config.styleDataUrl || '';
    const promptTask = styleDataUrl
      ? { ...task, config: { ...(task.config || {}), styleDataUrl } }
      : task;
    const customPrompts = buildPromptMap(promptTask, notes);
    task.promptPreview = customPrompts[partName] || task.promptPreview || '';

    setStatus(`正在重生配件：${part.label}... 模板=${task.config.templateSkinId}，参考图=${styleDataUrl ? '初次样式图' : '无'}`);
    task.progress = clamp(Math.max(Number(task.progress) || 0, 20), 20, 95);
    renderTaskList();
    renderSelectedTask();

    const body = {
      skinId: task.skinId,
      skinNameZh: task.skinNameZh || '',
      templateSkinId: task.config.templateSkinId,
      styleImageDataUrl: styleDataUrl,
      templateMap: collectTemplateMap(task.config.templateSkinId),
      globalNote: notes.globalNote,
      promptExtra: notes.promptExtra,
      customPrompts,
      annotationNotes: {},
      annotationOverlays: {},
      onlyPart: partName,
      batchCount: 1,
      autoIdentity: false,
      solidBackground: task.config.solidBg,
      bgTolerance: task.config.defaultTolerance,
      bgFeather: task.config.defaultFeather,
      disableExpressionOverlay: true,
      saveToAssets: false
    };

    const { res, payload } = await postJsonWithTaskLog(task, '/api/skin-gen/generate', body, `regen-part:${partName}`);
    if (!res.ok || !payload?.ok) {
      throw new Error(payload?.error || `重生失败 (${res.status})`);
    }

    const row = Array.isArray(payload?.batches) && payload.batches.length
      ? payload.batches[payload.batches.length - 1]
      : payload;
    const rawMap = isObj(row?.rawPreview) ? row.rawPreview : (isObj(payload?.rawPreview) ? payload.rawPreview : {});
    const finalMap = isObj(row?.finalPreview)
      ? row.finalPreview
      : (isObj(row?.preview) ? row.preview : (isObj(payload?.finalPreview) ? payload.finalPreview : (isObj(payload?.preview) ? payload.preview : {})));
    const cutMap = isObj(row?.cutoutPreview) ? row.cutoutPreview : (isObj(payload?.cutoutPreview) ? payload.cutoutPreview : {});

    if (rawMap[partName]) task.rawPreview[partName] = rawMap[partName];
    if (cutMap[partName]) task.cutoutPreview[partName] = cutMap[partName];
    if (finalMap[partName]) {
      task.finalPreview[partName] = finalMap[partName];
      task.postPreview[partName] = finalMap[partName];
    }
    await applyAutoPostForTask(task, partName);

    task.status = 'generated';
    task.progress = 100;
    renderTaskList();
    renderSelectedTask();
    setStatus(`已重生配件：${part.label}。请检查后点击“保存为正式皮肤”。`);
  } catch (error) {
    setStatus(error?.message || '单配件重生失败。', true);
  } finally {
    state.partRegenerating = false;
    renderSelectedTask();
    renderTaskList();
  }
}

async function applyPost() {
  const task = getSelectedTask();
  if (!task) return setStatus('请先选择任务。', true);
  if (!(task.status === 'generated' || task.status === 'saved')) return setStatus('当前任务尚未生成完成。', true);
  const parts = targetParts(task);
  if (parts.length === 0) return setStatus('没有可处理的配件。', true);

  const options = {
    solidBg: normalizeBg(el.solidBg.value),
    tolerance: clamp(Number(el.postTolerance.value), 0, 441),
    feather: Number.isFinite(Number(task.config?.defaultFeather))
      ? clamp(Number(task.config.defaultFeather), 0, 8)
      : DEFAULT_AUTO_FEATHER,
    enableFeather: true
  };
  setStatus(`正在后处理 ${parts.length} 个配件...`);
  try {
    for (const name of parts) task.postPreview[name] = await processPart(task, name, options);
    renderTaskList();
    renderSelectedTask();
    setStatus(`后处理完成：${parts.length} 个配件。`);
  } catch (e) {
    setStatus(e?.message || '后处理失败。', true);
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(`${reader.result || ''}`);
    reader.onerror = () => reject(new Error('blob to data url failed'));
    reader.readAsDataURL(blob);
  });
}

async function urlToDataUrl(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`无法读取图片：${url}`);
  return blobToDataUrl(await res.blob());
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败：${url}`));
    img.src = url;
  });
}

async function buildStyleReferenceDataUrlFromTask(task, excludePartName = '') {
  if (!task || !isObj(task)) return '';
  const pools = [task.postPreview, task.finalPreview, task.rawPreview];
  const pickedUrls = [];
  for (const partName of REGEN_STYLE_ANCHOR_PRIORITY) {
    if (!partName || partName === excludePartName) continue;
    let url = '';
    for (const pool of pools) {
      const candidate = typeof pool?.[partName] === 'string' ? pool[partName].trim() : '';
      if (candidate) {
        url = candidate;
        break;
      }
    }
    if (url && !pickedUrls.includes(url)) pickedUrls.push(url);
    if (pickedUrls.length >= 4) break;
  }
  if (pickedUrls.length <= 0) return '';

  const images = [];
  for (const url of pickedUrls) {
    try {
      images.push(await loadImageElement(url));
    } catch {
      // ignore broken image
    }
  }
  if (images.length <= 0) return '';

  const cols = 2;
  const rows = Math.max(1, Math.ceil(images.length / cols));
  const cell = 320;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < images.length; i += 1) {
    const img = images[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cell;
    const y = row * cell;
    const iw = Math.max(1, Number(img.naturalWidth || img.width || 1));
    const ih = Math.max(1, Number(img.naturalHeight || img.height || 1));
    const scale = Math.min(cell / iw, cell / ih) * 0.92;
    const dw = Math.max(1, Math.round(iw * scale));
    const dh = Math.max(1, Math.round(ih * scale));
    const dx = x + Math.round((cell - dw) / 2);
    const dy = y + Math.round((cell - dh) / 2);
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  return canvas.toDataURL('image/png');
}

function resolveSaveRootTask(selectedTask) {
  if (!selectedTask) return null;
  if (selectedTask.mode === 'color-variant-local' && selectedTask.parentTaskId) {
    return state.queue.find((task) => task.id === selectedTask.parentTaskId) || selectedTask;
  }
  return selectedTask;
}

function collectLinkedVariantTasks(baseTask) {
  if (!baseTask?.id) return [];
  return state.queue.filter((task) =>
    task?.mode === 'color-variant-local'
    && task.parentTaskId === baseTask.id
    && (task.status === 'generated' || task.status === 'saved')
  );
}

function signedHueDelta(targetHue, baseHue) {
  let delta = Number(targetHue) - Number(baseHue);
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

async function resolveTaskHeadDominantHex(task, fallbackHex = '#66ccff') {
  const source = task?.postPreview?.['snake_head.png']
    || task?.finalPreview?.['snake_head.png']
    || task?.rawPreview?.['snake_head.png']
    || '';
  if (!source) return normalizeBg(fallbackHex);
  try {
    const palette = await extractPaletteFromReference(source, 1);
    if (Array.isArray(palette) && palette[0]) return normalizeBg(palette[0]);
  } catch {
    // ignore image parse failures
  }
  return normalizeBg(fallbackHex);
}

async function buildSkinColorVariantConfigs(baseTask, variantTasks) {
  const baseHex = await resolveTaskHeadDominantHex(baseTask, '#66ccff');
  const [br, bg, bb] = hexToRgb(baseHex);
  const [baseHue, baseSat, baseLight] = rgbToHsl(br, bg, bb);

  const out = [{
    id: 'base',
    hueShift: 0,
    saturation: 1,
    lightness: 1,
    contrast: 1.03
  }];

  const seenHex = [baseHex];
  const safeTasks = Array.isArray(variantTasks) ? variantTasks : [];
  for (const task of safeTasks) {
    const hex = normalizeBg(task?.variantColorHex || '');
    if (!hex || seenHex.some((item) => isColorClose(item, hex))) continue;
    seenHex.push(hex);
    const [rr, gg, bb2] = hexToRgb(hex);
    const [h, s, l] = rgbToHsl(rr, gg, bb2);
    const hueShift = clamp(Math.round(signedHueDelta(h, baseHue)), -360, 360);
    const saturation = clamp((s + 0.02) / (baseSat + 0.02), 0.6, 2.2);
    const lightness = clamp((l + 0.03) / (baseLight + 0.03), 0.7, 1.3);
    out.push({
      id: `c-${hex.replace('#', '').toLowerCase()}`,
      hueShift,
      saturation,
      lightness,
      contrast: 1.06
    });
  }
  return out;
}

function writeSkinColorVariantConfigs(skinId, variants) {
  const id = sanitizeId(skinId);
  if (!id) return;
  const map = readLocalSkinColorVariantMap();
  if (Array.isArray(variants) && variants.length > 0) {
    map[id] = variants.map((row) => ({
      id: `${row?.id || ''}`.trim() || 'variant',
      hueShift: clamp(Number(row?.hueShift) || 0, -360, 360),
      saturation: clamp(Number(row?.saturation) || 1, 0.6, 2.2),
      lightness: clamp(Number(row?.lightness) || 1, 0.7, 1.3),
      contrast: clamp(Number(row?.contrast) || 1, 0.8, 1.4)
    }));
  } else {
    delete map[id];
  }
  writeLocalSkinColorVariantMap(map);
}

async function cleanupLegacyVariantSkins(baseSkinId, variantTasks) {
  const baseId = sanitizeId(baseSkinId);
  if (!baseId) return 0;
  const hexes = new Set(
    (Array.isArray(variantTasks) ? variantTasks : [])
      .map((task) => `${task?.variantColorHex || ''}`.replace('#', '').toLowerCase())
      .filter((hex) => /^[0-9a-f]{6}$/.test(hex))
  );
  if (hexes.size === 0) return 0;

  let removed = 0;
  const processed = new Set();
  for (const hex of hexes) {
    for (const candidateRaw of [hex, `${baseId}-${hex}`]) {
      const candidate = sanitizeId(candidateRaw);
      if (!candidate || candidate === baseId || processed.has(candidate)) continue;
      processed.add(candidate);
      try {
        const res = await fetch('/api/skin-gen/delete-skin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skinId: candidate })
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) continue;
        removed += 1;
      } catch {
        // ignore cleanup errors
      }
      removeLocalSkinCatalogEntry(candidate);
      writeSkinColorVariantConfigs(candidate, []);
    }
  }
  return removed;
}

async function regenerateColorVariantTask(taskId) {
  const task = state.queue.find((item) => item?.id === taskId);
  if (!task || task.mode !== 'color-variant-local') {
    return setStatus('未找到可重生的颜色变体任务。', true);
  }
  const baseTask = state.queue.find((item) => item?.id === task.parentTaskId);
  if (!baseTask) {
    return setStatus('该颜色变体缺少基础皮肤任务。', true);
  }
  if (state.running) {
    return setStatus('当前有任务正在执行，请稍后重试。', true);
  }

  const basePreview = collectTaskPreviewMap(baseTask);
  if (Object.keys(basePreview).length === 0) {
    return setStatus('基础皮肤预览不可用，无法重生颜色变体。', true);
  }
  task.basePreviewMap = basePreview;
  task.variantRegenTick = (Number(task.variantRegenTick) || 0) + 1;
  task.error = '';
  task.progress = 0;
  task.status = 'queued';
  state.selectedTaskId = task.id;
  renderTaskList();
  renderSelectedTask();
  setStatus(`已加入重生队列：${(task.variantColorHex || '').toUpperCase() || '颜色变体'}`);
  pumpQueue();
}

async function saveFinal() {
  const selectedTask = getSelectedTask();
  if (!selectedTask) return setStatus('请先选择任务。', true);
  const task = resolveSaveRootTask(selectedTask);
  if (!task?.skinId) return setStatus('任务还没有可用 skinId，无法保存。', true);
  if (!(task.status === 'generated' || task.status === 'saved')) return setStatus('任务尚未完成生成。', true);
  task.config = normalizeTaskConfig(task.config || {});
  const saveAllVariants = !!el.saveAllVariants?.checked;

  const partImages = {};
  try {
    const templateMap = collectTemplateMap(task.config.templateSkinId || DEFAULT_TEMPLATE_SKIN_ID);
    for (const part of PARTS) {
      const name = part.outputName;
      const src = task.postPreview?.[name] || task.finalPreview?.[name] || '';
      if (!src) continue;
      const sourceDataUrl = src.startsWith('data:image/') ? src : await urlToDataUrl(src);
      const templatePartPath = templateMap[name] || '';
      partImages[name] = templatePartPath
        ? await normalizePartToTemplateSilhouette(sourceDataUrl, templatePartPath)
        : sourceDataUrl;
    }
  } catch (e) { return setStatus(e?.message || '读取预览图片失败。', true); }
  if (Object.keys(partImages).length === 0) return setStatus('没有可保存的配件图。', true);

  const linkedVariants = collectLinkedVariantTasks(task);
  let colorVariants = null;
  if (saveAllVariants) {
    colorVariants = await buildSkinColorVariantConfigs(task, linkedVariants);
    if (!Array.isArray(colorVariants) || colorVariants.length <= 1) {
      colorVariants = null;
    }
  }
  const generationContext = {
    ...buildGenerationContextFromTask(task),
    ...(colorVariants ? { colorVariants } : {})
  };

  setStatus(`正在保存皮肤 ${task.skinId}...`);
  try {
    const saveBody = {
      skinId: task.skinId,
      skinNameZh: task.skinNameZh,
      partImages,
      generationContext
    };
    const { res, payload } = await postJsonWithTaskLog(task, '/api/skin-gen/save-final', saveBody, 'save-final');
    if (!res.ok || !payload?.ok) throw new Error(payload?.error || `保存失败 (${res.status})`);

    task.status = 'saved';
    task.finalPreview = isObj(payload?.preview) ? payload.preview : task.finalPreview;
    task.postPreview = { ...task.finalPreview };
    if (task.skinNameZh) state.localSkinNameById[task.skinId] = task.skinNameZh;
    upsertLocalSkinCatalogEntry(task.skinId, task.skinNameZh);
    let cleanedLegacyCount = 0;
    if (colorVariants) {
      writeSkinColorVariantConfigs(task.skinId, colorVariants);
      for (const variantTask of linkedVariants) {
        variantTask.status = 'saved';
      }
      cleanedLegacyCount = await cleanupLegacyVariantSkins(task.skinId, linkedVariants);
    }

    await fillTemplateOptions();
    await fillExistingSkinOptions(task.skinId);
    if (Array.from(el.templateSelect.options).some((o) => sanitizeId(o.value) === task.skinId)) {
      el.templateSelect.value = task.skinId;
      state.templateSkinId = task.skinId;
    }
    window.dispatchEvent(new CustomEvent('admin-skin-catalog-refresh'));
    renderTaskList();
    renderSelectedTask();
    writeDraft();
    setStatus(colorVariants
      ? `已保存到 assets/skins/${task.skinId}/，并写入 ${colorVariants.length} 组颜色变体（同皮肤内随机）${cleanedLegacyCount > 0 ? `，清理旧变体皮肤 ${cleanedLegacyCount} 套` : ''}。`
      : `已保存到 assets/skins/${task.skinId}/`);
  } catch (e) {
    setStatus(e?.message || '保存失败。', true);
  }
}

async function deleteCurrentTemplateSkin() {
  const skinId = sanitizeId(el.templateSelect.value || state.templateSkinId);
  if (!skinId) return setStatus('请选择要删除的皮肤。', true);
  if (skinId === DEFAULT_TEMPLATE_SKIN_ID) return setStatus(`默认皮肤不可删除：${skinId}`, true);
  if (!window.confirm(`确认删除皮肤 ${skinId} ?\n将删除 assets/skins/${skinId}/ 下全部文件。`)) return;

  try {
    const res = await fetch('/api/skin-gen/delete-skin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skinId })
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) throw new Error(payload?.error || `删除失败 (${res.status})`);

    delete state.localSkinNameById[skinId];
    removeLocalSkinCatalogEntry(skinId);
    writeSkinColorVariantConfigs(skinId, []);
    for (const task of state.queue) if (task.skinId === skinId && task.status === 'saved') task.status = 'generated';
    await fillTemplateOptions();
    await fillExistingSkinOptions();
    window.dispatchEvent(new CustomEvent('admin-skin-catalog-refresh'));
    renderTaskList();
    renderSelectedTask();
    writeDraft();
    setStatus(`已删除皮肤：${skinId}`);
  } catch (e) {
    setStatus(e?.message || '删除皮肤失败。', true);
  }
}

function clearDraftInputs() {
  state.styleDataUrl = '';
  state.styleOriginalDataUrl = '';
  state.styleSourceName = '';
  state.cropDraftDataUrl = '';
  state.variantRefs = [];
  renderStylePreview();
  renderVariantRefList();
  if (el.styleRefFile) el.styleRefFile.value = '';
  if (el.variantRefFiles) el.variantRefFiles.value = '';
  if (el.saveAllVariants) el.saveAllVariants.checked = false;
  el.globalNote.value = '';
  el.promptExtra.value = '';
  el.masterPrompt.value = '';
  el.promptPreview.value = '';
  el.solidBg.value = DEFAULT_SOLID_BG;
  el.bgTolerance.value = '42';
  writeDraft();
  setStatus('已清空当前输入。');
}

function bindEvents() {
  el.templateSelect.addEventListener('change', () => {
    state.templateSkinId = sanitizeId(el.templateSelect.value) || DEFAULT_TEMPLATE_SKIN_ID;
    writeDraft();
  });
  el.btnDeleteTemplateSkin.addEventListener('click', deleteCurrentTemplateSkin);

  el.styleRefFile.addEventListener('change', async () => {
    const file = el.styleRefFile.files?.[0];
    if (!file) return;
    try {
      const sourceDataUrl = await fileToDataUrl(file);
      state.styleOriginalDataUrl = sourceDataUrl;
      state.styleSourceName = file.name || 'style-reference.png';
      openCropModal(sourceDataUrl, state.styleSourceName);
      setStatus(`已加载样式参考图：${state.styleSourceName}，请确认裁切区域。`);
    } catch (e) { setStatus(e?.message || '读取样式参考图失败。', true); }
    el.styleRefFile.value = '';
  });
  el.variantRefFiles.addEventListener('change', async () => {
    const files = Array.from(el.variantRefFiles.files || []);
    if (files.length === 0) return;
    const nextRefs = [];
    for (const file of files) {
      try {
        const dataUrl = await fileToDataUrl(file);
        if (!dataUrl.startsWith('data:image/')) continue;
        nextRefs.push({
          name: file.name || 'variant-reference.png',
          dataUrl
        });
      } catch {
        // skip invalid file
      }
    }
    el.variantRefFiles.value = '';
    if (nextRefs.length === 0) return setStatus('颜色参考图读取失败。', true);
    state.variantRefs = [...state.variantRefs, ...nextRefs];
    renderVariantRefList();
    setStatus(`已添加 ${nextRefs.length} 张颜色参考图。`);
  });
  el.btnRecropStyle.addEventListener('click', openCropFromCurrentStyle);
  el.stylePreviewBtn.addEventListener('click', openCropFromCurrentStyle);
  el.btnClearStyle.addEventListener('click', () => {
    state.styleDataUrl = '';
    state.styleOriginalDataUrl = '';
    state.styleSourceName = '';
    state.cropDraftDataUrl = '';
    renderStylePreview();
    writeDraft();
    setStatus('已清除样式参考图。');
  });
  el.btnCropCancel.addEventListener('click', closeCropModal);
  el.cropBackdrop.addEventListener('click', closeCropModal);
  el.btnCropReset.addEventListener('click', resetCropRect);
  el.btnCropConfirm.addEventListener('click', applyCropSelection);
  el.cropImage.addEventListener('load', () => {
    if (!el.cropModal.hidden) resetCropRect();
  });
  el.cropStage.addEventListener('pointerdown', (event) => {
    if (el.cropModal.hidden) return;
    state.cropDragging = true;
    const p = pointInCropStage(event);
    state.cropStartX = p.x;
    state.cropStartY = p.y;
    setCropRect({ x: p.x, y: p.y, w: 1, h: 1 });
    el.cropStage.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  const onCropDragMove = (event) => {
    if (!state.cropDragging) return;
    const p = pointInCropStage(event);
    const x = Math.min(state.cropStartX, p.x);
    const y = Math.min(state.cropStartY, p.y);
    const w = Math.max(1, Math.abs(p.x - state.cropStartX));
    const h = Math.max(1, Math.abs(p.y - state.cropStartY));
    setCropRect({ x, y, w, h });
    event.preventDefault();
  };
  const onCropDragEnd = () => {
    if (!state.cropDragging) return;
    state.cropDragging = false;
    if (!state.cropRect || state.cropRect.w < 3 || state.cropRect.h < 3) resetCropRect();
  };
  el.cropStage.addEventListener('pointermove', onCropDragMove);
  el.cropStage.addEventListener('pointerup', onCropDragEnd);
  el.cropStage.addEventListener('pointercancel', onCropDragEnd);

  el.btnQueueTask.addEventListener('click', () => { enqueueTask(); writeDraft(); });
  el.btnGenerateVariants.addEventListener('click', () => { enqueueVariantTasksFromSelected(); writeDraft(); });
  el.existingSkinSelect?.addEventListener('change', () => {
    void loadExistingSkinForPostProcess();
  });
  el.btnLoadExistingSkin.addEventListener('click', loadExistingSkinForPostProcess);
  el.btnClearDraft.addEventListener('click', clearDraftInputs);
  el.btnApplyPost.addEventListener('click', () => { void applyPost(); });
  el.btnSaveFinal.addEventListener('click', () => { void saveFinal(); });

  for (const f of [el.globalNote, el.promptExtra, el.masterPrompt, el.solidBg, el.bgTolerance, el.postTolerance]) {
    f.addEventListener('input', writeDraft);
  }
  el.saveAllVariants?.addEventListener('change', writeDraft);
  el.btnApiLogClose?.addEventListener('click', closeTaskApiLogModal);
  el.apiLogBackdrop?.addEventListener('click', closeTaskApiLogModal);
  el.btnApiLogCopy?.addEventListener('click', () => { void copyTaskApiLogToClipboard(); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!el.apiLogModal?.hidden) {
      closeTaskApiLogModal();
    }
  });
  window.addEventListener('admin-skin-catalog-updated', () => {
    void fillTemplateOptions();
    void fillExistingSkinOptions();
  });
}

async function init() {
  await fillTemplateOptions();
  await fillExistingSkinOptions();
  applyDraft();
  if (el.cropSelection) el.cropSelection.hidden = true;
  if (el.cropModal) el.cropModal.hidden = true;
  if (el.apiLogModal) el.apiLogModal.hidden = true;
  renderStylePreview();
  renderVariantRefList();
  bindEvents();
  renderTaskList();
  renderSelectedTask();
  await probeBackend();
  setStatus('Ready: 任务队列默认为空。选择“现有皮肤”或提交新任务后开始处理。');
}

if (Object.values(el).every(Boolean)) {
  init().catch((e) => setStatus(e?.message || 'Initialization failed.', true));
} else {
  console.warn('[admin-skin-gen] missing required elements, skipped init.');
}










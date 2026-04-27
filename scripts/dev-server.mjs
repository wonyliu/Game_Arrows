import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { createUserCenterStore } from './user-center-store.mjs';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, '.local-data');
const MANAGED_CONFIG_DIR = path.join(ROOT_DIR, 'data', 'managed-config');
const LEGACY_AUDIO_LIBRARY_ASSET_DIR = path.join(DATA_DIR, 'audio-library-assets');
const AUDIO_DIR = path.join(ROOT_DIR, 'assets', 'audio');
const AUDIO_SFX_DIR = path.join(AUDIO_DIR, 'sfx');
const AUDIO_LIBRARY_ASSET_DIR = AUDIO_SFX_DIR;
const SKIN_GEN_DIR = path.join(DATA_DIR, 'skin-gen');
const SKIN_GEN_NAME_MAP_PATH = path.join(SKIN_GEN_DIR, 'skin-name-map.json');
const SKIN_GEN_CONTEXTS_DIR = path.join(SKIN_GEN_DIR, 'skin-contexts');
const USER_CENTER_DB_PATH = path.join(DATA_DIR, 'user-center-db-v1.json');
const USER_CENTER_BACKEND = `${process.env.USER_CENTER_BACKEND || 'postgres'}`.trim().toLowerCase();
const USER_CENTER_DATABASE_URL = `${process.env.USER_CENTER_DATABASE_URL || process.env.DATABASE_URL || ''}`.trim();
const USER_CENTER_REQUIRE_SCALABLE_DB = `${process.env.USER_CENTER_REQUIRE_SCALABLE_DB || ''}`.trim() === '1';
const ADMIN_API_KEY = `${process.env.ADMIN_API_KEY || ''}`.trim();
const ADMIN_REQUIRE_KEY = `${process.env.ADMIN_REQUIRE_KEY || ''}`.trim() === '1';
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || process.argv[2] || 4173);
const CORS_ALLOWED_ORIGINS = parseCsvList(process.env.CORS_ALLOWED_ORIGINS || 'https://wonyliu.github.io,http://127.0.0.1:4173,http://localhost:4173');
const CORS_ALLOW_TRYCLOUDFLARE = `${process.env.CORS_ALLOW_TRYCLOUDFLARE || '1'}`.trim() !== '0';
const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY || '';
const FAL_KEY = process.env.FAL_KEY || '';
const FAL_STABLE_AUDIO_MODEL = process.env.FAL_STABLE_AUDIO_MODEL || 'fal-ai/stable-audio';
const HF_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || '';
const HF_STABLE_AUDIO_MODEL = process.env.HF_STABLE_AUDIO_MODEL || 'stabilityai/stable-audio-open-1.0';
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024;
const MAX_SKIN_GEN_BODY_BYTES = 64 * 1024 * 1024;
const MAX_SFX_BODY_BYTES = 2 * 1024 * 1024;
const ALLOWED_PART_NAMES = Object.freeze([
    'snake_head.png',
    'snake_head_curious.png',
    'snake_head_sleepy.png',
    'snake_head_surprised.png',
    'snake_seg_a.png',
    'snake_seg_b.png',
    'snake_tail_base.png',
    'snake_tail_tip.png'
]);
const ALLOWED_PART_SET = new Set(ALLOWED_PART_NAMES);
const RUNTIME_SKIN_ASSET_KEYS = Object.freeze([
    'snakeHead',
    'snakeHeadCurious',
    'snakeHeadSleepy',
    'snakeHeadSurprised',
    'snakeSegA',
    'snakeSegB',
    'snakeTailBase',
    'snakeTailTip'
]);
const ATLAS_IMPORT_LAYOUT = Object.freeze({
    snakeHead: Object.freeze({ x: 98, y: 80, width: 824, height: 646 }),
    snakeHeadCurious: Object.freeze({ x: 1051, y: 80, width: 827, height: 646 }),
    snakeHeadSleepy: Object.freeze({ x: 98, y: 792, width: 824, height: 644 }),
    snakeHeadSurprised: Object.freeze({ x: 1053, y: 792, width: 827, height: 644 }),
    snakeSegA: Object.freeze({ x: 104, y: 1493, width: 848, height: 613 }),
    snakeSegB: Object.freeze({ x: 104, y: 1493, width: 848, height: 613 }),
    snakeTailBase: Object.freeze({ x: 1059, y: 1516, width: 817, height: 519 }),
    snakeTailTip: Object.freeze({ x: 1059, y: 1516, width: 817, height: 519 })
});
const ATLAS_IMPORT_SOURCE_SIZE = Object.freeze({
    width: 1984,
    height: 2174
});
const ATLAS_IMPORT_GREEN_KEY = Object.freeze({
    color: '#239638',
    tolerance: 74,
    feather: 18
});
const ALLOWED_FREESOUND_PROXY_HOSTS = Object.freeze([
    'freesound.org',
    'www.freesound.org',
    'cdn.freesound.org'
]);
const MAX_SKIN_GEN_BATCHES = 8;
const PROTECTED_SKIN_IDS = new Set([
    'classic-burrow'
]);
const AI_IDENTITY_MODEL = process.env.SKIN_IDENTITY_MODEL || 'gemini-2.5-flash';
const MIME_TO_EXTENSION = Object.freeze({
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp'
});
const IMAGE_ASSET_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.svg',
    '.gif'
]);
const ASSET_SCAN_FILE_EXTENSIONS = new Set([
    '.js',
    '.mjs',
    '.css',
    '.html',
    '.json',
    '.md'
]);
const ASSET_SCAN_SKIP_DIR_NAMES = new Set([
    '.git',
    '.codex',
    '.local-data',
    'node_modules'
]);
const FONT_SCAN_CSS_FILES = Object.freeze([
    Object.freeze({ relativePath: 'css/style.css', scope: '游戏前台' }),
    Object.freeze({ relativePath: 'css/admin.css', scope: '管理后台' })
]);
const FONT_FILE_EXTENSIONS = new Set(['.ttf', '.otf', '.woff', '.woff2']);
const FONT_GENERIC_FAMILIES = new Set(['sans-serif', 'serif', 'monospace', 'ui-monospace', 'cursive', 'fantasy', 'system-ui']);
const FONT_SYSTEM_FAMILIES = new Set([
    'Microsoft YaHei',
    'PingFang SC',
    'Segoe UI',
    'SFMono-Regular',
    'Menlo',
    'Monaco',
    'Consolas',
    'Courier New'
]);
const FONT_LICENSE_METADATA = Object.freeze({
    'ZCOOL KuaiLe': Object.freeze({
        copyright: '免费商用',
        tagClass: '',
        source: 'Google Fonts / OFL-1.1',
        sourceUrl: 'https://github.com/googlefonts/zcool-kuaile'
    }),
    Nunito: Object.freeze({
        copyright: '免费商用',
        tagClass: '',
        source: 'Google Fonts / OFL-1.1',
        sourceUrl: 'https://github.com/googlefonts/nunito'
    }),
    'Liberation Mono': Object.freeze({
        copyright: '免费商用',
        tagClass: '',
        source: 'Liberation Fonts open-source font family',
        sourceUrl: 'https://github.com/liberationfonts/liberation-fonts'
    })
});
const ASSET_IMAGE_REF_PATTERN = /\/?assets\/[^"'`\s)>\]]+?\.(?:png|jpg|jpeg|webp|svg|gif)(?:\?[^"'`\s)>\]]+)?/gi;
const ASSET_AUDIT_POLICY_VERSION = 'player-visible-runtime-v2';
const PLAYER_VISIBLE_UI_ASSET_OWNERS = Object.freeze({
    home: Object.freeze({
        homeBgSnakeUp: Object.freeze(['assets/ui/home/components/snake_pose_up.png']),
        homeBgSnakeDown: Object.freeze(['assets/ui/home/components/snake_pose_down.png'])
    })
});
const ASSET_AUDIT_SELF_CHECK_CASES = Object.freeze([
    Object.freeze({
        path: 'assets/ui/shared/icons/icon_shuffle.png',
        expectedUsed: false,
        reason: 'Old shuffle icon was replaced by the current tool icon mapping.'
    }),
    Object.freeze({
        path: 'assets/ui/shared/icons/icon_undo.png',
        expectedUsed: false,
        reason: 'Old undo icon was replaced by the current tool icon mapping.'
    }),
    Object.freeze({
        path: 'assets/ui/shared/icons/icon_hint.png',
        expectedUsed: false,
        reason: 'Old hint icon was replaced by the current tool icon mapping.'
    }),
    Object.freeze({
        path: 'assets/ui/home/components/snake_pose_down.png',
        expectedUsed: false,
        reason: 'Home layout marks homeBgSnakeDown as deleted, so its CSS fallback is not player-visible.'
    }),
    Object.freeze({
        path: 'assets/ui/settings/concepts/settings_panel_a.png',
        expectedUsed: false,
        reason: 'Settings panel concept art is not part of the runtime settings DOM.'
    }),
    Object.freeze({
        path: 'assets/ui/home/components/btn_settings.png',
        expectedUsed: true,
        reason: 'Home settings button is player-visible on the main menu.'
    }),
    Object.freeze({
        path: 'assets/ui/home/components/bg_cave_panel.png',
        expectedUsed: true,
        reason: 'Home cave background is player-visible on the main menu.'
    })
]);
const pendingJsonWriteByPath = new Map();

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8'
};

const MANAGED_STORAGE_KEYS = new Set([
    'level-catalog-v1',
    'saved-levels-v1',
    'preview-levels-v1',
    'bgm-config-v1',
    'liveops-config-v1',
    'support-ads-config-v1',
    'sfx-custom-presets-v1',
    'sfx-lab-state-v1',
    'sfx-preset-overrides-v1',
    'skin-sfx-bindings-v1',
    'game-sfx-bindings-v1',
    'skin-price-overrides-v1',
    'ui-layout-config-v1',
    'skin-part-fit-overrides-v1'
]);

if (process.argv.includes('--asset-audit-self-check')) {
    const analysis = await analyzeUnusedImageAssets();
    const selfCheck = runAssetAuditSelfCheck(analysis);
    console.log(JSON.stringify({
        ok: selfCheck.failed.length === 0,
        policyVersion: ASSET_AUDIT_POLICY_VERSION,
        failed: selfCheck.failed,
        checks: selfCheck.checks
    }, null, 2));
    process.exit(selfCheck.failed.length === 0 ? 0 : 1);
}

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(MANAGED_CONFIG_DIR, { recursive: true });
await fs.mkdir(AUDIO_DIR, { recursive: true });
await fs.mkdir(AUDIO_SFX_DIR, { recursive: true });
await fs.mkdir(LEGACY_AUDIO_LIBRARY_ASSET_DIR, { recursive: true });
await fs.mkdir(AUDIO_LIBRARY_ASSET_DIR, { recursive: true });
await fs.mkdir(SKIN_GEN_DIR, { recursive: true });
await fs.mkdir(SKIN_GEN_CONTEXTS_DIR, { recursive: true });
await migrateLegacyAudioLibraryAssetsToAudioDir();
await migrateAudioLibraryAssetUrlsToAudioDir();

const userCenterStore = await createUserCenterStore({
    backend: USER_CENTER_BACKEND,
    databaseUrl: USER_CENTER_DATABASE_URL,
    filePath: USER_CENTER_DB_PATH,
    normalizeProgressFromPayload,
    normalizeLiveopsPlayerState,
    collectUniqueSkinIds,
    buildDefaultProgress,
    buildDefaultLiveopsPlayerState,
    nowIso
});

if (USER_CENTER_BACKEND === 'json') {
    throw new Error('USER_CENTER_BACKEND=json is disabled. Use postgres with USER_CENTER_DATABASE_URL (or DATABASE_URL).');
}

const userCenterStoreMeta = userCenterStore.getBackendMeta();
if (USER_CENTER_REQUIRE_SCALABLE_DB && !userCenterStoreMeta.scalable) {
    throw new Error('USER_CENTER_REQUIRE_SCALABLE_DB=1 but user center backend is not scalable. Set USER_CENTER_BACKEND=postgres.');
}
if (ADMIN_REQUIRE_KEY && !ADMIN_API_KEY) {
    throw new Error('ADMIN_REQUIRE_KEY=1 but ADMIN_API_KEY is empty.');
}

const server = http.createServer(async (req, res) => {
    try {
        const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
        const isApiRequest = requestUrl.pathname.startsWith('/api/');
        if (isApiRequest) {
            applyApiCorsHeaders(req, res);
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
        }

        if (requestUrl.pathname.startsWith('/api/storage/')) {
            await handleStorageRequest(req, res, requestUrl.pathname);
            return;
        }
        if (requestUrl.pathname === '/api/users/register') {
            await handleUserRegisterRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/users/register-temp') {
            await handleUserTempRegisterRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/users/login') {
            await handleUserLoginRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/users/login-or-register') {
            await handleUserLoginOrRegisterRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/users/session') {
            await handleUserSessionRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/users/me') {
            await handleUserMeRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/users/profile') {
            await handleUserProfileRequest(req, res);
            return;
        }
        if (requestUrl.pathname.startsWith('/api/users/') && requestUrl.pathname.endsWith('/progress')) {
            await handleUserProgressRequest(req, res, requestUrl.pathname);
            return;
        }
        if (requestUrl.pathname.startsWith('/api/users/') && requestUrl.pathname.endsWith('/liveops-player')) {
            await handleUserLiveopsPlayerRequest(req, res, requestUrl.pathname);
            return;
        }
        if (requestUrl.pathname === '/api/leaderboard') {
            await handleLeaderboardRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/admin/reset-game-state') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminResetGameStateRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/reset-server-data') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminResetGameStateRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/reset-leaderboard-progress') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminResetLeaderboardProgressRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/assets/scan') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminAssetScanRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/assets/self-check') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminAssetSelfCheckRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/assets/delete-unused') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminDeleteUnusedAssetsRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/assets/delete-unused-all') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminDeleteAllUnusedAssetsRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/assets/update-image') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminUpdateImageAssetRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/fonts/scan') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminFontScanRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/db/overview') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminDbOverviewRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/admin/db/users') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminDbUsersRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname.startsWith('/api/admin/db/users/')) {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminDbUserDetailRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/generate') {
            await handleSkinGenerateRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/health') {
            await handleSkinGenHealthRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/saved-skins') {
            await handleSkinSavedSkinListRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/translate') {
            await handleSkinTranslateRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/save-final') {
            await handleSkinSaveFinalRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/import-atlas') {
            await handleSkinImportAtlasRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/delete-skin') {
            await handleSkinDeleteRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/skin-name') {
            await handleSkinNameRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/skin-gen/skin-context') {
            await handleSkinContextRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname.startsWith('/api/audio-library/assets/')) {
            await handleAudioLibraryAssetRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/audio-library/asset-info') {
            await handleAudioLibraryAssetInfoRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/audio-library/compress') {
            await handleAudioLibraryCompressRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/sfx/providers') {
            await handleSfxProvidersRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/sfx/freesound/search') {
            await handleSfxFreesoundSearchRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/sfx/freesound/proxy') {
            await handleSfxFreesoundProxyRequest(req, res, requestUrl);
            return;
        }
        if (requestUrl.pathname === '/api/sfx/stable-audio/generate') {
            await handleSfxStableAudioGenerateRequest(req, res);
            return;
        }
        if (requestUrl.pathname === '/api/bgm/list') {
            await handleBgmListRequest(req, res);
            return;
        }

        await serveStaticFile(req, res, requestUrl.pathname);
    } catch (error) {
        sendJson(res, 500, {
            ok: false,
            error: error?.message || 'internal server error'
        });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Dev server running at http://${HOST}:${PORT}`);
    console.log(`Persistent storage dir: ${DATA_DIR}`);
    console.log(`Audio SFX dir: ${AUDIO_SFX_DIR}`);
    console.log(`User center backend: ${userCenterStoreMeta.backend}`);
    if (ADMIN_REQUIRE_KEY || ADMIN_API_KEY) {
        console.log('Admin API auth: enabled');
    } else {
        console.warn('Admin API auth: disabled (set ADMIN_API_KEY and ADMIN_REQUIRE_KEY=1 for production)');
    }
});

async function handleSkinGenerateRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!apiKey) {
        sendJson(res, 400, {
            ok: false,
            error: 'Missing GEMINI_API_KEY/GOOGLE_API_KEY in current server environment.'
        });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_SKIN_GEN_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }

    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    let styleImage = null;
    const styleImageDataUrl = typeof body.styleImageDataUrl === 'string' ? body.styleImageDataUrl.trim() : '';
    if (styleImageDataUrl) {
        try {
            styleImage = decodeImageDataUrl(styleImageDataUrl);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: error?.message || 'invalid styleImageDataUrl' });
            return;
        }
    }

    const templateMapInput = isPlainObject(body.templateMap) ? body.templateMap : null;
    if (!templateMapInput) {
        sendJson(res, 400, { ok: false, error: 'templateMap is required' });
        return;
    }

    let templateMap;
    try {
        templateMap = await normalizeTemplateMap(templateMapInput);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid templateMap' });
        return;
    }

    const onlyPart = typeof body.onlyPart === 'string' ? body.onlyPart.trim() : '';
    if (onlyPart && !ALLOWED_PART_SET.has(onlyPart)) {
        sendJson(res, 400, { ok: false, error: `onlyPart is invalid: ${onlyPart}` });
        return;
    }

    const requestedSkinId = sanitizeSlug(body.skinId, '');
    const templateSkinId = sanitizeSlug(body.templateSkinId, 'classic-burrow');
    const requestedSkinNameZh = sanitizeSkinDisplayName(body.skinNameZh);
    const promptExtra = typeof body.promptExtra === 'string' ? body.promptExtra.slice(0, 4000) : '';
    const globalNote = typeof body.globalNote === 'string' ? body.globalNote.slice(0, 4000) : '';
    const solidBg = normalizeSolidHexColor(body.solidBackground);
    const bgTolerance = clampInt(body.bgTolerance, 0, 441, 42);
    const bgFeather = clampFloat(body.bgFeather, 0, 8, 1);
    const disableExpressionOverlay = body.disableExpressionOverlay === true;
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'gemini-2.5-flash-image';
    const batchCount = onlyPart ? 1 : clampInt(body.batchCount, 1, MAX_SKIN_GEN_BATCHES, 1);
    const autoIdentity = !onlyPart && body.autoIdentity !== false;
    const saveToAssets = body.saveToAssets !== false;
    if (onlyPart && !requestedSkinId) {
        sendJson(res, 400, { ok: false, error: 'skinId is required when onlyPart is used' });
        return;
    }

    const annotationNotesInput = isPlainObject(body.annotationNotes) ? body.annotationNotes : {};
    const annotationOverlaysInput = isPlainObject(body.annotationOverlays) ? body.annotationOverlays : {};
    const customPromptsInput = isPlainObject(body.customPrompts) ? body.customPrompts : {};
    const customPrompts = normalizeCustomPromptMap(customPromptsInput);

    const requestJobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const requestJobDir = path.join(SKIN_GEN_DIR, 'jobs', requestJobId);
    const inputDir = path.join(requestJobDir, 'input');
    await fs.mkdir(inputDir, { recursive: true });

    let styleRefPath = '';
    if (styleImage) {
        styleRefPath = path.join(inputDir, `style_ref${styleImage.ext}`);
        await fs.writeFile(styleRefPath, styleImage.buffer);
    }

    const annotationParts = {};
    for (const partName of ALLOWED_PART_NAMES) {
        const partNote = typeof annotationNotesInput[partName] === 'string'
            ? annotationNotesInput[partName].slice(0, 3000)
            : '';
        const overlayDataUrl = typeof annotationOverlaysInput[partName] === 'string'
            ? annotationOverlaysInput[partName]
            : '';
        const partEntry = {
            note: partNote
        };
        if (overlayDataUrl) {
            try {
                const overlayImage = decodeImageDataUrl(overlayDataUrl);
                const overlayPath = path.join(inputDir, `${stripFileExt(partName)}_overlay${overlayImage.ext}`);
                await fs.writeFile(overlayPath, overlayImage.buffer);
                partEntry.overlayPath = overlayPath;
            } catch {
                // Ignore malformed overlay for this part and continue.
            }
        }
        annotationParts[partName] = partEntry;
    }

    const annotationJson = {
        globalNote,
        parts: annotationParts
    };
    const annotationJsonPath = path.join(inputDir, 'annotations.json');
    await writeJsonAtomic(annotationJsonPath, annotationJson);

    const templateMapPath = path.join(inputDir, 'template_map.json');
    await writeJsonAtomic(templateMapPath, templateMap);
    const customPromptsPath = path.join(inputDir, 'custom_prompts.json');
    if (Object.keys(customPrompts).length > 0) {
        await writeJsonAtomic(customPromptsPath, customPrompts);
    }

    const existingSkinIds = new Set(await listSkinDirectoryIds());
    const reservedSkinIds = new Set(existingSkinIds);
    const currentNameMap = await readJsonFile(SKIN_GEN_NAME_MAP_PATH, {});
    const batches = [];

    for (let index = 0; index < batchCount; index += 1) {
        let skinId = requestedSkinId || 'generated-skin';
        let skinNameZh = requestedSkinNameZh;

        if (autoIdentity) {
            const suggested = await suggestSkinIdentity({
                apiKey,
                model: AI_IDENTITY_MODEL,
                templateSkinId,
                globalNote,
                promptExtra,
                batchIndex: index,
                batchCount,
                styleImage,
                reservedSkinIds
            });
            skinId = suggested.skinId;
            skinNameZh = suggested.skinNameZh;
        }

        if (!onlyPart) {
            skinId = ensureUniqueSkinId(skinId, reservedSkinIds);
        }
        reservedSkinIds.add(skinId);

        const batchJobId = batchCount === 1 ? requestJobId : `${requestJobId}-b${index + 1}`;
        const outputDir = batchCount === 1
            ? path.join(requestJobDir, 'output')
            : path.join(requestJobDir, `batch-${index + 1}`, 'output');
        await fs.mkdir(outputDir, { recursive: true });

        const targetDir = saveToAssets ? path.join(ROOT_DIR, 'assets', 'skins', skinId) : '';
        if (targetDir) {
            await fs.mkdir(targetDir, { recursive: true });
        }

        const command = process.env.PYTHON || 'python';
        const commandArgs = [
            path.join('scripts', 'generate_skin_nano_pipeline.py'),
            '--skin-id',
            skinId,
            '--template-skin-id',
            templateSkinId,
            '--template-map-json',
            templateMapPath,
            '--annotation-json',
            annotationJsonPath,
            '--out-dir',
            outputDir,
            '--model',
            model,
            '--prompt-extra',
            promptExtra,
            '--solid-bg',
            solidBg,
            '--bg-tolerance',
            String(bgTolerance),
            '--bg-feather',
            String(bgFeather)
        ];
        if (styleRefPath) {
            commandArgs.push('--style-ref', styleRefPath);
        }
        if (targetDir) {
            commandArgs.push('--target-dir', targetDir);
        }
        if (onlyPart) {
            commandArgs.push('--only', onlyPart);
        }
        if (Object.keys(customPrompts).length > 0) {
            commandArgs.push('--custom-prompts-json', customPromptsPath);
        }
        if (disableExpressionOverlay) {
            commandArgs.push('--disable-expression-overlay');
        }

        const proc = await runProcess(command, commandArgs, ROOT_DIR);
        if (proc.code !== 0) {
            sendJson(res, 500, {
                ok: false,
                error: 'skin generation failed',
                jobId: batchJobId,
                failedBatch: index + 1,
                exitCode: proc.code,
                logs: proc.logs.slice(-8000)
            });
            return;
        }

        const manifestPath = path.join(outputDir, 'manifest.json');
        const manifest = await readJsonFile(manifestPath, null);
        if (!manifest) {
            sendJson(res, 500, { ok: false, error: 'manifest missing after generation', jobId: batchJobId, failedBatch: index + 1 });
            return;
        }

        const parts = Array.isArray(manifest.parts) ? manifest.parts : [];
        const cacheTag = Date.now().toString(36);
        const preview = {};
        const rawPreview = {};
        const cutoutPreview = {};
        const finalPreview = {};
        for (const item of parts) {
            const partName = typeof item?.part === 'string' ? item.part : '';
            const pathCandidate = saveToAssets && typeof item?.target === 'string' && item.target
                ? item.target
                : (typeof item?.final === 'string' ? item.final : '');
            if (!partName || !pathCandidate) {
                continue;
            }
            const webPath = toWebPath(pathCandidate);
            if (!webPath) {
                continue;
            }
            preview[partName] = `${webPath}?v=${cacheTag}`;
            finalPreview[partName] = `${webPath}?v=${cacheTag}`;

            const rawWebPath = toWebPath(item?.raw);
            if (rawWebPath) {
                rawPreview[partName] = `${rawWebPath}?v=${cacheTag}`;
            }
            const cutoutWebPath = toWebPath(item?.cutout);
            if (cutoutWebPath) {
                cutoutPreview[partName] = `${cutoutWebPath}?v=${cacheTag}`;
            }
        }

        if (targetDir && skinNameZh) {
            currentNameMap[skinId] = skinNameZh;
        }

        batches.push({
            batchIndex: index + 1,
            jobId: batchJobId,
            skinId,
            skinNameZh: skinNameZh || '',
            templateSkinId,
            onlyPart: onlyPart || null,
            outputDir: toWebPath(outputDir),
            targetDir: targetDir ? toWebPath(targetDir) : null,
            preview,
            rawPreview,
            cutoutPreview,
            finalPreview,
            manifest,
            logs: proc.logs.slice(-4000)
        });
    }

    await writeJsonAtomic(SKIN_GEN_NAME_MAP_PATH, currentNameMap);

    const activeBatch = batches[batches.length - 1];
    sendJson(res, 200, {
        ok: true,
        jobId: requestJobId,
        batchCount,
        batches,
        skinId: activeBatch.skinId,
        skinNameZh: activeBatch.skinNameZh || null,
        templateSkinId,
        onlyPart: onlyPart || null,
        outputDir: activeBatch.outputDir,
        targetDir: activeBatch.targetDir,
        preview: activeBatch.preview,
        rawPreview: activeBatch.rawPreview,
        cutoutPreview: activeBatch.cutoutPreview,
        finalPreview: activeBatch.finalPreview,
        manifest: activeBatch.manifest,
        logs: activeBatch.logs
    });
}

async function handleSkinGenHealthRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    sendJson(res, 200, {
        ok: true,
        supportsSkinGen: true,
        hasApiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
    });
}

async function handleSkinSavedSkinListRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    const skinsRoot = path.join(ROOT_DIR, 'assets', 'skins');
    const entries = await fs.readdir(skinsRoot, { withFileTypes: true }).catch(() => []);
    const nameMap = await readJsonFile(SKIN_GEN_NAME_MAP_PATH, {});
    const rawSkinPriceOverrides = await readJsonFile(resolveStorageFilePath('skin-price-overrides-v1'), {});
    const skinPriceOverrides = normalizeSkinPriceOverridesMap(rawSkinPriceOverrides);
    const skins = [];

    for (const entry of entries) {
        if (!entry?.isDirectory?.()) {
            continue;
        }
        const skinId = sanitizeSlug(entry.name, '');
        if (!skinId) {
            continue;
        }
        const partFiles = [];
        for (const partName of ALLOWED_PART_NAMES) {
            const filePath = path.join(skinsRoot, skinId, partName);
            try {
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    partFiles.push(partName);
                }
            } catch {
                // ignored: part missing
            }
        }
        const manifestPath = path.join(skinsRoot, skinId, 'manifest.json');
        const manifest = await readJsonFile(manifestPath, null);
        const isAtlasManifest = isPlainObject(manifest) && `${manifest?.mechanism || ''}`.trim().toLowerCase() === 'atlas-sheet';
        const hasGenerationContext = await hasSkinGenerationContext(skinId);
        const preview = typeof manifest?.preview === 'string' && manifest.preview.trim()
            ? manifest.preview.trim()
            : (partFiles.includes('snake_head.png') ? `/assets/skins/${skinId}/snake_head.png` : null);
        const assets = isPlainObject(manifest?.assets) ? manifest.assets : null;
        const complete = isAtlasManifest ? Boolean(assets) : partFiles.length === ALLOWED_PART_NAMES.length;

        skins.push({
            id: skinId,
            nameZh: typeof nameMap?.[skinId] === 'string' ? sanitizeSkinDisplayName(nameMap[skinId]) : '',
            coinCost: Number(skinPriceOverrides?.[skinId] || 0),
            partCount: partFiles.length,
            complete,
            protected: PROTECTED_SKIN_IDS.has(skinId),
            hasGenerationContext,
            preview,
            assets,
            allowHueVariants: manifest?.allowHueVariants !== false
        });
    }

    skins.sort((a, b) => a.id.localeCompare(b.id));
    sendJson(res, 200, { ok: true, skins });
}

function normalizeSkinPriceOverridesMap(rawMap) {
    const source = isPlainObject(rawMap) ? rawMap : {};
    const normalized = {};
    for (const [rawSkinId, rawPrice] of Object.entries(source)) {
        const skinId = sanitizeSlug(rawSkinId || '', '');
        if (!skinId) {
            continue;
        }
        const parsed = Number(rawPrice);
        normalized[skinId] = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    }
    return normalized;
}

async function handleSkinTranslateRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    const sourceText = typeof body.text === 'string' ? body.text.trim() : '';
    if (!sourceText) {
        sendJson(res, 200, { ok: true, translated: '' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!apiKey) {
        sendJson(res, 200, {
            ok: true,
            translated: sourceText,
            fallback: true,
            reason: 'missing_api_key'
        });
        return;
    }

    const model = typeof body.model === 'string' && body.model.trim()
        ? body.model.trim()
        : 'gemini-2.5-flash';

    const prompt = [
        'Translate the following game-art instruction into natural, concise English.',
        'Keep all constraints and meaning unchanged.',
        'Output plain text only; do not add explanations.',
        '',
        sourceText.slice(0, 12_000)
    ].join('\n');

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: 'text/plain'
                    }
                })
            }
        );
        if (!response.ok) {
            throw new Error(`translate request failed (${response.status})`);
        }
        const payload = await response.json().catch(() => ({}));
        const translated = extractGeminiText(payload).trim() || sourceText;
        sendJson(res, 200, { ok: true, translated });
    } catch {
        sendJson(res, 200, {
            ok: true,
            translated: sourceText,
            fallback: true,
            reason: 'translate_failed'
        });
    }
}

async function handleSkinSaveFinalRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_SKIN_GEN_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    const skinId = sanitizeSlug(body.skinId, '');
    if (!skinId) {
        sendJson(res, 400, { ok: false, error: 'skinId is required' });
        return;
    }
    const skinNameZh = sanitizeSkinDisplayName(body.skinNameZh);
    const partImages = isPlainObject(body.partImages) ? body.partImages : {};
    const generationContextInput = isPlainObject(body.generationContext) ? body.generationContext : null;

    const skinsRoot = path.join(ROOT_DIR, 'assets', 'skins');
    const targetDir = path.join(skinsRoot, skinId);
    const rel = path.relative(skinsRoot, targetDir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        sendJson(res, 400, { ok: false, error: 'invalid target path' });
        return;
    }
    await fs.mkdir(targetDir, { recursive: true });

    let writeCount = 0;
    for (const partName of ALLOWED_PART_NAMES) {
        const input = typeof partImages[partName] === 'string' ? partImages[partName].trim() : '';
        if (!input) {
            continue;
        }
        const targetPath = path.join(targetDir, partName);
        if (input.startsWith('data:')) {
            let decoded;
            try {
                decoded = decodeImageDataUrl(input);
            } catch (error) {
                sendJson(res, 400, { ok: false, error: `${partName}: ${error?.message || 'invalid image data url'}` });
                return;
            }
            if (decoded.mime !== 'image/png') {
                sendJson(res, 400, { ok: false, error: `${partName}: only image/png is accepted for save-final` });
                return;
            }
            await fs.writeFile(targetPath, decoded.buffer);
            writeCount += 1;
            continue;
        }

        let sourcePath;
        try {
            sourcePath = resolvePathInsideRoot(input);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: `${partName}: ${error?.message || 'invalid source path'}` });
            return;
        }
        try {
            const stat = await fs.stat(sourcePath);
            if (!stat.isFile()) {
                throw new Error('source is not a file');
            }
        } catch {
            sendJson(res, 400, { ok: false, error: `${partName}: source file not found` });
            return;
        }
        await fs.copyFile(sourcePath, targetPath);
        writeCount += 1;
    }

    if (writeCount === 0) {
        sendJson(res, 400, { ok: false, error: 'partImages is empty' });
        return;
    }

    if (skinNameZh) {
        const nameMap = await readJsonFile(SKIN_GEN_NAME_MAP_PATH, {});
        nameMap[skinId] = skinNameZh;
        await writeJsonAtomic(SKIN_GEN_NAME_MAP_PATH, nameMap);
    }

    let generationContext = null;
    if (generationContextInput) {
        try {
            generationContext = await writeSkinGenerationContext(skinId, generationContextInput);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: `generationContext: ${error?.message || 'invalid context'}` });
            return;
        }
    }

    const cacheTag = Date.now().toString(36);
    const preview = {};
    for (const partName of ALLOWED_PART_NAMES) {
        const webPath = toWebPath(path.join(targetDir, partName));
        if (webPath) {
            preview[partName] = `${webPath}?v=${cacheTag}`;
        }
    }

    sendJson(res, 200, {
        ok: true,
        skinId,
        skinNameZh,
        targetDir: toWebPath(targetDir),
        writtenParts: writeCount,
        preview,
        generationContext
    });
}

function buildAtlasImportAssets(skinId, cacheTag = '') {
    const safeId = sanitizeSlug(skinId, '');
    const atlasSrc = `/assets/skins/${safeId}/skin_atlas.png${cacheTag ? `?v=${cacheTag}` : ''}`;
    return {
        snakeHead: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeHead, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } },
        snakeHeadCurious: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeHeadCurious, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } },
        snakeHeadSleepy: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeHeadSleepy, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } },
        snakeHeadSurprised: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeHeadSurprised, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } },
        snakeSegA: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeSegA, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } },
        snakeSegB: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeSegB, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } },
        snakeTailBase: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeTailBase, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } },
        snakeTailTip: { src: atlasSrc, crop: { ...ATLAS_IMPORT_LAYOUT.snakeTailTip, sourceWidth: ATLAS_IMPORT_SOURCE_SIZE.width, sourceHeight: ATLAS_IMPORT_SOURCE_SIZE.height }, chromaKey: { ...ATLAS_IMPORT_GREEN_KEY } }
    };
}

async function handleSkinImportAtlasRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_SKIN_GEN_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    const skinId = sanitizeSlug(body.skinId, '');
    if (!skinId) {
        sendJson(res, 400, { ok: false, error: 'skinId is required' });
        return;
    }
    if (PROTECTED_SKIN_IDS.has(skinId)) {
        sendJson(res, 400, { ok: false, error: `cannot overwrite protected skin: ${skinId}` });
        return;
    }
    const skinNameZh = sanitizeSkinDisplayName(body.skinNameZh || skinId);

    let atlasImage;
    let previewImage;
    try {
        atlasImage = decodeImageDataUrl(body.atlasImageDataUrl);
        previewImage = decodeImageDataUrl(body.previewImageDataUrl);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid atlas image data' });
        return;
    }
    if (atlasImage.mime !== 'image/png' || previewImage.mime !== 'image/png') {
        sendJson(res, 400, { ok: false, error: 'atlas and preview must be image/png' });
        return;
    }

    const skinsRoot = path.join(ROOT_DIR, 'assets', 'skins');
    const targetDir = path.join(skinsRoot, skinId);
    const rel = path.relative(skinsRoot, targetDir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        sendJson(res, 400, { ok: false, error: 'invalid target path' });
        return;
    }
    await fs.mkdir(targetDir, { recursive: true });

    const atlasPath = path.join(targetDir, 'skin_atlas.png');
    const previewPath = path.join(targetDir, 'skin_preview.png');
    await fs.writeFile(atlasPath, atlasImage.buffer);
    await fs.writeFile(previewPath, previewImage.buffer);

    const cacheTag = Date.now().toString(36);
    const assets = buildAtlasImportAssets(skinId, cacheTag);
    const manifest = {
        skinId,
        generatedAt: nowIso(),
        source: 'admin atlas import',
        mechanism: 'atlas-sheet',
        preview: `/assets/skins/${skinId}/skin_preview.png?v=${cacheTag}`,
        atlas: `/assets/skins/${skinId}/skin_atlas.png?v=${cacheTag}`,
        allowHueVariants: true,
        greenKey: { ...ATLAS_IMPORT_GREEN_KEY },
        assets,
        layout: ATLAS_IMPORT_LAYOUT
    };
    await writeJsonAtomic(path.join(targetDir, 'manifest.json'), manifest);

    const nameMap = await readJsonFile(SKIN_GEN_NAME_MAP_PATH, {});
    nameMap[skinId] = skinNameZh;
    await writeJsonAtomic(SKIN_GEN_NAME_MAP_PATH, nameMap);

    sendJson(res, 200, {
        ok: true,
        skinId,
        skinNameZh,
        preview: manifest.preview,
        atlas: manifest.atlas,
        cacheTag,
        assets
    });
}

async function handleSkinDeleteRequest(req, res) {
    if (req.method !== 'DELETE' && req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    const skinId = sanitizeSlug(body.skinId, '');
    if (!skinId) {
        sendJson(res, 400, { ok: false, error: 'skinId is required' });
        return;
    }
    if (PROTECTED_SKIN_IDS.has(skinId)) {
        sendJson(res, 400, { ok: false, error: `cannot delete protected skin: ${skinId}` });
        return;
    }

    const skinsRoot = path.join(ROOT_DIR, 'assets', 'skins');
    const targetDir = path.join(skinsRoot, skinId);
    const rel = path.relative(skinsRoot, targetDir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        sendJson(res, 400, { ok: false, error: 'invalid target path' });
        return;
    }

    await fs.rm(targetDir, { recursive: true, force: true });
    await removeSkinGenerationContext(skinId);

    const nameMap = await readJsonFile(SKIN_GEN_NAME_MAP_PATH, {});
    if (Object.prototype.hasOwnProperty.call(nameMap, skinId)) {
        delete nameMap[skinId];
        await writeJsonAtomic(SKIN_GEN_NAME_MAP_PATH, nameMap);
    }

    sendJson(res, 200, {
        ok: true,
        skinId,
        deletedPath: `/assets/skins/${skinId}`
    });
}

async function handleSkinNameRequest(req, res, requestUrl) {
    if (req.method === 'GET') {
        const skinId = sanitizeSlug(requestUrl.searchParams.get('skinId') || '', '');
        const nameMap = await readJsonFile(SKIN_GEN_NAME_MAP_PATH, {});
        if (skinId) {
            const nameZh = typeof nameMap?.[skinId] === 'string' ? sanitizeSkinDisplayName(nameMap[skinId]) : '';
            sendJson(res, 200, { ok: true, skinId, nameZh });
            return;
        }
        sendJson(res, 200, { ok: true, names: nameMap });
        return;
    }

    if (req.method !== 'PUT') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    const skinId = sanitizeSlug(body.skinId, '');
    if (!skinId) {
        sendJson(res, 400, { ok: false, error: 'skinId is required' });
        return;
    }
    const nameZh = sanitizeSkinDisplayName(body.nameZh);
    const nameMap = await readJsonFile(SKIN_GEN_NAME_MAP_PATH, {});
    if (nameZh) {
        nameMap[skinId] = nameZh;
    } else {
        delete nameMap[skinId];
    }
    await writeJsonAtomic(SKIN_GEN_NAME_MAP_PATH, nameMap);
    sendJson(res, 200, { ok: true, skinId, nameZh });
}

async function handleSkinContextRequest(req, res, requestUrl) {
    if (req.method === 'GET') {
        const skinId = sanitizeSlug(requestUrl.searchParams.get('skinId') || '', '');
        if (!skinId) {
            sendJson(res, 400, { ok: false, error: 'skinId is required' });
            return;
        }
        const context = await readSkinGenerationContext(skinId);
        sendJson(res, 200, { ok: true, skinId, context });
        return;
    }

    if (req.method === 'DELETE') {
        const skinIdFromQuery = sanitizeSlug(requestUrl.searchParams.get('skinId') || '', '');
        let skinId = skinIdFromQuery;
        if (!skinId) {
            let body = {};
            try {
                body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
            } catch (error) {
                sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
                return;
            }
            skinId = sanitizeSlug(body.skinId, '');
        }
        if (!skinId) {
            sendJson(res, 400, { ok: false, error: 'skinId is required' });
            return;
        }
        await removeSkinGenerationContext(skinId);
        sendJson(res, 200, { ok: true, skinId });
        return;
    }

    if (req.method !== 'PUT' && req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_SKIN_GEN_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    const skinId = sanitizeSlug(body.skinId, '');
    if (!skinId) {
        sendJson(res, 400, { ok: false, error: 'skinId is required' });
        return;
    }
    const contextInput = isPlainObject(body.context) ? body.context : body;
    try {
        const context = await writeSkinGenerationContext(skinId, contextInput);
        sendJson(res, 200, { ok: true, skinId, context });
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'failed to write context' });
    }
}

function getSkinContextDirPath(skinId) {
    return path.join(SKIN_GEN_CONTEXTS_DIR, skinId);
}

function getSkinContextJsonPath(skinId) {
    return path.join(getSkinContextDirPath(skinId), 'context.json');
}

async function removeSkinContextStyleRefFiles(contextDir) {
    const entries = await fs.readdir(contextDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        if (!entry?.isFile?.()) continue;
        if (!/^style_ref\./i.test(entry.name)) continue;
        await fs.rm(path.join(contextDir, entry.name), { force: true }).catch(() => null);
    }
}

async function hasSkinGenerationContext(skinId) {
    const safeId = sanitizeSlug(skinId, '');
    if (!safeId) return false;
    try {
        const stat = await fs.stat(getSkinContextJsonPath(safeId));
        return stat.isFile();
    } catch {
        return false;
    }
}

async function removeSkinGenerationContext(skinId) {
    const safeId = sanitizeSlug(skinId, '');
    if (!safeId) return;
    await fs.rm(getSkinContextDirPath(safeId), { recursive: true, force: true });
}

async function readSkinGenerationContext(skinId) {
    const safeId = sanitizeSlug(skinId, '');
    if (!safeId) return null;
    const contextDir = getSkinContextDirPath(safeId);
    const contextPath = getSkinContextJsonPath(safeId);
    const stored = await readJsonFile(contextPath, null);
    if (!isPlainObject(stored)) {
        return null;
    }

    const styleRefFileRaw = typeof stored.styleRefFile === 'string' ? stored.styleRefFile.trim() : '';
    const styleRefFile = styleRefFileRaw ? path.basename(styleRefFileRaw) : '';
    let styleImageWebPath = null;
    if (styleRefFile) {
        const styleAbsPath = path.join(contextDir, styleRefFile);
        try {
            const stat = await fs.stat(styleAbsPath);
            if (stat.isFile()) {
                styleImageWebPath = toWebPath(styleAbsPath);
            }
        } catch {
            styleImageWebPath = null;
        }
    }

    return {
        version: 1,
        skinId: safeId,
        templateSkinId: sanitizeSlug(stored.templateSkinId, 'classic-burrow'),
        globalNote: typeof stored.globalNote === 'string' ? stored.globalNote.slice(0, 4000) : '',
        promptExtra: typeof stored.promptExtra === 'string' ? stored.promptExtra.slice(0, 4000) : '',
        masterPrompt: typeof stored.masterPrompt === 'string' ? stored.masterPrompt.slice(0, 4000) : '',
        solidBg: normalizeSolidHexColor(stored.solidBg),
        defaultTolerance: clampInt(stored.defaultTolerance, 0, 441, 42),
        defaultFeather: clampFloat(stored.defaultFeather, 0, 8, 1),
        colorVariants: normalizeSkinColorVariantsForContext(stored.colorVariants, []),
        hasStyleReference: Boolean(styleImageWebPath),
        styleImageWebPath: styleImageWebPath || null,
        updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : ''
    };
}

async function writeSkinGenerationContext(skinId, rawContext) {
    const safeId = sanitizeSlug(skinId, '');
    if (!safeId) {
        throw new Error('skinId is invalid');
    }
    const incoming = isPlainObject(rawContext) ? rawContext : {};
    const contextDir = getSkinContextDirPath(safeId);
    const contextPath = getSkinContextJsonPath(safeId);
    const previous = await readSkinGenerationContext(safeId);

    await fs.mkdir(contextDir, { recursive: true });

    const styleImageProvided = Object.prototype.hasOwnProperty.call(incoming, 'styleImageDataUrl');
    let styleRefFile = '';
    if (styleImageProvided) {
        const styleImageDataUrl = typeof incoming.styleImageDataUrl === 'string' ? incoming.styleImageDataUrl.trim() : '';
        await removeSkinContextStyleRefFiles(contextDir);
        if (styleImageDataUrl) {
            const decoded = decodeImageDataUrl(styleImageDataUrl);
            styleRefFile = `style_ref${decoded.ext}`;
            await fs.writeFile(path.join(contextDir, styleRefFile), decoded.buffer);
        }
    } else if (previous?.styleImageWebPath) {
        const abs = resolvePathInsideRoot(previous.styleImageWebPath);
        styleRefFile = path.basename(abs);
    }

    const nextContext = {
        version: 1,
        skinId: safeId,
        templateSkinId: sanitizeSlug(incoming.templateSkinId, sanitizeSlug(previous?.templateSkinId, 'classic-burrow')),
        globalNote: typeof incoming.globalNote === 'string'
            ? incoming.globalNote.slice(0, 4000)
            : (typeof previous?.globalNote === 'string' ? previous.globalNote.slice(0, 4000) : ''),
        promptExtra: typeof incoming.promptExtra === 'string'
            ? incoming.promptExtra.slice(0, 4000)
            : (typeof previous?.promptExtra === 'string' ? previous.promptExtra.slice(0, 4000) : ''),
        masterPrompt: typeof incoming.masterPrompt === 'string'
            ? incoming.masterPrompt.slice(0, 4000)
            : (typeof previous?.masterPrompt === 'string' ? previous.masterPrompt.slice(0, 4000) : ''),
        solidBg: normalizeSolidHexColor(incoming.solidBg || previous?.solidBg),
        defaultTolerance: clampInt(
            incoming.defaultTolerance,
            0,
            441,
            clampInt(previous?.defaultTolerance, 0, 441, 42)
        ),
        defaultFeather: clampFloat(
            incoming.defaultFeather,
            0,
            8,
            clampFloat(previous?.defaultFeather, 0, 8, 1)
        ),
        colorVariants: normalizeSkinColorVariantsForContext(
            incoming.colorVariants,
            previous?.colorVariants
        ),
        styleRefFile: styleRefFile || '',
        updatedAt: new Date().toISOString()
    };

    await writeJsonAtomic(contextPath, nextContext);
    return readSkinGenerationContext(safeId);
}

async function handleStorageRequest(req, res, pathname) {
    const key = pathname.slice('/api/storage/'.length);
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        sendJson(res, 400, { ok: false, error: 'invalid storage key' });
        return;
    }

    const filePath = resolveStorageFilePath(key);

    if (req.method === 'GET') {
        const data = await readJsonFile(filePath, {});
        sendJson(res, 200, data);
        return;
    }

    if (req.method === 'PUT') {
        let body;
        try {
            body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
            return;
        }
        if (!isPlainObject(body)) {
            sendJson(res, 400, { ok: false, error: 'body must be an object' });
            return;
        }
        await writeJsonAtomic(filePath, body);
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'DELETE') {
        await writeJsonAtomic(filePath, {});
        sendJson(res, 200, { ok: true });
        return;
    }

    sendJson(res, 405, { ok: false, error: 'method not allowed' });
}

function resolveStorageFilePath(key) {
    const safeKey = `${key || ''}`.trim();
    const baseDir = MANAGED_STORAGE_KEYS.has(safeKey) ? MANAGED_CONFIG_DIR : DATA_DIR;
    return path.join(baseDir, `${safeKey}.json`);
}

function parseAudioLibraryAssetId(pathname) {
    const match = `${pathname || ''}`.match(/^\/api\/audio-library\/assets\/([^/]+)$/);
    if (!match) {
        return '';
    }
    return sanitizeSlug(decodeURIComponent(match[1] || ''), '');
}

function detectAudioAssetExtension(fileName = '', contentType = '') {
    const mime = `${contentType || ''}`.trim().toLowerCase().split(';')[0];
    if (mime === 'audio/mpeg' || mime === 'audio/mp3') return '.mp3';
    if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') return '.wav';
    if (mime === 'audio/ogg') return '.ogg';
    if (mime === 'audio/mp4' || mime === 'audio/x-m4a') return '.m4a';
    if (mime === 'audio/flac' || mime === 'audio/x-flac') return '.flac';
    const ext = path.extname(`${fileName || ''}`).toLowerCase();
    if (['.mp3', '.wav', '.ogg', '.m4a', '.flac'].includes(ext)) {
        return ext;
    }
    return '.wav';
}

function detectAudioMimeTypeByExtension(ext = '') {
    const normalized = `${ext || ''}`.trim().toLowerCase();
    if (normalized === '.mp3') return 'audio/mpeg';
    if (normalized === '.wav') return 'audio/wav';
    if (normalized === '.ogg') return 'audio/ogg';
    if (normalized === '.m4a') return 'audio/mp4';
    if (normalized === '.aac') return 'audio/aac';
    if (normalized === '.flac') return 'audio/flac';
    return 'application/octet-stream';
}

function resolveLocalAudioAssetFromUrl(rawUrl = '') {
    const cleanUrl = `${rawUrl || ''}`.trim().split('?')[0].replace(/\\/g, '/');
    if (!cleanUrl) {
        return null;
    }
    let pathname = cleanUrl;
    try {
        pathname = new URL(cleanUrl, `http://${HOST}:${PORT}`).pathname;
    } catch {
        pathname = cleanUrl;
    }
    pathname = decodeURIComponent(pathname).replace(/\\/g, '/');
    if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`;
    }
    if (!pathname.startsWith('/assets/audio/')) {
        return null;
    }
    const relativePath = pathname.slice('/assets/audio/'.length);
    const resolvedPath = path.resolve(AUDIO_DIR, relativePath);
    const audioRoot = path.resolve(AUDIO_DIR);
    if (resolvedPath !== audioRoot && !resolvedPath.startsWith(`${audioRoot}${path.sep}`)) {
        return null;
    }
    const fileName = path.basename(resolvedPath);
    return {
        filePath: resolvedPath,
        url: `/assets/audio/${relativePath.replace(/\\/g, '/')}`,
        fileName,
        ext: path.extname(fileName).toLowerCase()
    };
}

function buildAudioCompressionArgs(inputPath, outputPath, ext, qualityPercent) {
    const q = Math.max(30, Math.min(100, Math.round(Number(qualityPercent) || 80)));
    const bitrateKbps = q >= 95 ? 192 : (q >= 80 ? 128 : (q >= 65 ? 112 : (q >= 50 ? 96 : (q >= 40 ? 80 : 64))));
    const sampleRate = q >= 90 ? 48000 : (q >= 75 ? 44100 : (q >= 60 ? 32000 : (q >= 45 ? 24000 : 22050)));
    const base = ['-y', '-hide_banner', '-loglevel', 'error', '-i', inputPath, '-vn'];
    if (ext === '.mp3') {
        return [...base, '-codec:a', 'libmp3lame', '-b:a', `${bitrateKbps}k`, outputPath];
    }
    if (ext === '.ogg') {
        const vorbisQuality = Math.max(2, Math.min(8, Math.round(q / 14)));
        return [...base, '-codec:a', 'libvorbis', '-q:a', `${vorbisQuality}`, outputPath];
    }
    if (ext === '.m4a' || ext === '.aac') {
        return [...base, '-codec:a', 'aac', '-b:a', `${bitrateKbps}k`, outputPath];
    }
    if (ext === '.flac') {
        return [...base, '-codec:a', 'flac', '-compression_level', '8', outputPath];
    }
    if (ext === '.wav') {
        return [...base, '-ar', `${sampleRate}`, '-acodec', 'pcm_s16le', outputPath];
    }
    return null;
}

async function removeAudioLibraryAssetFiles(itemId) {
    const safeId = sanitizeSlug(itemId, '');
    if (!safeId) {
        return;
    }
    const dirs = [AUDIO_LIBRARY_ASSET_DIR, LEGACY_AUDIO_LIBRARY_ASSET_DIR];
    for (const dirPath of dirs) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (!entry?.isFile?.()) {
                continue;
            }
            if (entry.name === safeId || entry.name.startsWith(`${safeId}.`)) {
                await fs.rm(path.join(dirPath, entry.name), { force: true }).catch(() => {});
            }
        }
    }
}

async function handleAudioLibraryAssetRequest(req, res, requestUrl) {
    const itemId = parseAudioLibraryAssetId(requestUrl.pathname);
    if (!itemId) {
        sendJson(res, 400, { ok: false, error: 'invalid audio library asset id' });
        return;
    }
    if (req.method === 'DELETE') {
        await removeAudioLibraryAssetFiles(itemId);
        sendJson(res, 200, { ok: true, itemId });
        return;
    }
    if (req.method !== 'PUT') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let buffer;
    try {
        buffer = await readRequestBuffer(req, 32 * 1024 * 1024);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid request body' });
        return;
    }
    if (!buffer || buffer.length <= 0) {
        sendJson(res, 400, { ok: false, error: 'audio asset body is required' });
        return;
    }
    const fileName = `${requestUrl.searchParams.get('fileName') || ''}`.trim();
    const ext = detectAudioAssetExtension(fileName, req.headers['content-type']);
    await removeAudioLibraryAssetFiles(itemId);
    const filePath = path.join(AUDIO_LIBRARY_ASSET_DIR, `${itemId}${ext}`);
    await fs.writeFile(filePath, buffer);
    const url = `/assets/audio/sfx/${path.basename(filePath)}`;
    sendJson(res, 200, {
        ok: true,
        itemId,
        fileName: path.basename(filePath),
        url,
        sizeBytes: buffer.length,
        mimeType: detectAudioMimeTypeByExtension(ext)
    });
}

async function handleAudioLibraryAssetInfoRequest(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const resolved = resolveLocalAudioAssetFromUrl(requestUrl.searchParams.get('url') || '');
    if (!resolved) {
        sendJson(res, 400, { ok: false, error: 'invalid local audio asset url' });
        return;
    }
    const stat = await fs.stat(resolved.filePath).catch(() => null);
    if (!stat?.isFile?.()) {
        sendJson(res, 404, { ok: false, error: 'audio asset not found' });
        return;
    }
    sendJson(res, 200, {
        ok: true,
        url: resolved.url,
        fileName: resolved.fileName,
        sizeBytes: stat.size,
        mimeType: detectAudioMimeTypeByExtension(resolved.ext)
    });
}

async function handleAudioLibraryCompressRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_SFX_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    const resolved = resolveLocalAudioAssetFromUrl(body?.url || '');
    if (!resolved) {
        sendJson(res, 400, { ok: false, error: 'invalid local audio asset url' });
        return;
    }
    if (!['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(resolved.ext)) {
        sendJson(res, 400, { ok: false, error: `unsupported audio extension: ${resolved.ext || '(none)'}` });
        return;
    }
    const originalStat = await fs.stat(resolved.filePath).catch(() => null);
    if (!originalStat?.isFile?.()) {
        sendJson(res, 404, { ok: false, error: 'audio asset not found' });
        return;
    }
    const qualityPercent = Math.max(30, Math.min(100, Math.round(Number(body?.qualityPercent || body?.ratio || 80))));
    const tempPath = path.join(path.dirname(resolved.filePath), `.${path.basename(resolved.filePath)}.compress-${Date.now()}${resolved.ext}`);
    const args = buildAudioCompressionArgs(resolved.filePath, tempPath, resolved.ext, qualityPercent);
    if (!args) {
        sendJson(res, 400, { ok: false, error: 'unsupported audio format' });
        return;
    }
    const result = await runProcess(process.env.FFMPEG_BIN || 'ffmpeg', args, ROOT_DIR);
    if (result.code !== 0) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        sendJson(res, 500, {
            ok: false,
            error: 'ffmpeg compression failed',
            detail: `${result.logs || ''}`.slice(0, 1000)
        });
        return;
    }
    const compressedStat = await fs.stat(tempPath).catch(() => null);
    if (!compressedStat?.isFile?.() || compressedStat.size <= 0) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        sendJson(res, 500, { ok: false, error: 'compressed audio output is empty' });
        return;
    }
    if (compressedStat.size >= originalStat.size) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        sendJson(res, 200, {
            ok: true,
            url: resolved.url,
            fileName: resolved.fileName,
            mimeType: detectAudioMimeTypeByExtension(resolved.ext),
            originalSizeBytes: originalStat.size,
            sizeBytes: originalStat.size,
            qualityPercent,
            savedBytes: 0,
            notReplaced: true
        });
        return;
    }
    try {
        await replaceFileWithRetry(tempPath, resolved.filePath);
    } catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        sendJson(res, 500, {
            ok: false,
            error: 'compressed audio replace failed',
            detail: `${error?.message || error || ''}`.slice(0, 1000),
            hint: '如果正在试听这首音频，请先暂停试听或刷新后台后重试。'
        });
        return;
    }
    sendJson(res, 200, {
        ok: true,
        url: resolved.url,
        fileName: resolved.fileName,
        mimeType: detectAudioMimeTypeByExtension(resolved.ext),
        originalSizeBytes: originalStat.size,
        sizeBytes: compressedStat.size,
        qualityPercent,
        savedBytes: Math.max(0, originalStat.size - compressedStat.size)
    });
}

async function replaceFileWithRetry(tempPath, targetPath, retries = 5) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            await fs.rename(tempPath, targetPath);
            return;
        } catch (error) {
            lastError = error;
            if (!isRecoverableWindowsRenameError(error)) {
                throw error;
            }
        }
        try {
            await fs.rm(targetPath, { force: true });
            await fs.rename(tempPath, targetPath);
            return;
        } catch (error) {
            lastError = error;
            if (!isRecoverableWindowsRenameError(error)) {
                throw error;
            }
        }
        try {
            await fs.copyFile(tempPath, targetPath);
            await fs.rm(tempPath, { force: true });
            return;
        } catch (error) {
            lastError = error;
            if (!isRecoverableWindowsRenameError(error)) {
                throw error;
            }
        }
        await delay(120 + attempt * 160);
    }
    throw lastError || new Error('replace failed');
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeUserId(raw) {
    return `${raw || ''}`.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
}

function sanitizeUsername(raw) {
    return `${raw || ''}`.trim().replace(/\s+/g, ' ').slice(0, 24);
}

function sanitizeDeviceId(raw) {
    return `${raw || ''}`.trim().slice(0, 120).replace(/[^a-zA-Z0-9:_-]+/g, '');
}

function sanitizeDeviceInfo(raw) {
    return `${raw || ''}`.trim().slice(0, 1000);
}

function defaultAvatarByName(username) {
    const encoded = encodeURIComponent(`${username || 'snake'}`.slice(0, 24));
    return `https://api.dicebear.com/9.x/bottts/svg?seed=${encoded}`;
}

function hashPassword(password, salt, algorithm = 'scrypt-v1') {
    if (algorithm === 'sha256-v1') {
        return crypto.createHash('sha256').update(`${salt}|${password}`).digest('hex');
    }
    const normalizedSalt = `${salt || ''}`.trim();
    return crypto.scryptSync(`${password || ''}`, normalizedSalt, 64).toString('hex');
}

function verifyUserPassword(user, plainPassword) {
    const algorithm = `${user?.passwordAlgorithm || ''}`.trim() || 'sha256-v1';
    const salt = `${user?.passwordSalt || ''}`.trim();
    const expected = `${user?.passwordHash || ''}`.trim();
    if (!salt || !expected) return false;
    const computed = hashPassword(plainPassword, salt, algorithm);
    const computedBuffer = Buffer.from(computed, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (computedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
}

function nowIso() {
    return new Date().toISOString();
}

function buildDefaultProgress() {
    return {
        version: 1,
        updatedAt: nowIso(),
        maxUnlockedLevel: 1,
        maxClearedLevel: 0,
        currentLevel: 1,
        coins: 0,
        unlockedSkinIds: ['classic-burrow'],
        selectedSkinId: 'classic-burrow',
        nextRewardLevelIndex: 1,
        rewardGuideShown: false,
        supportAuthorBadgeCount: 0,
        supportAds: {
            dayKey: '',
            watchedToday: 0,
            totalWatched: 0,
            dailyLimitOverride: -1,
            lastPlacement: '',
            lastWatchedAt: ''
        }
    };
}

function buildDefaultLiveopsPlayerState() {
    return {
        version: 1,
        updatedAt: nowIso(),
        inventory: {
            skin_fragment: 0,
            hint: 0,
            undo: 0,
            shuffle: 0
        },
        checkin: {
            claimedCount: 0,
            lastClaimDayKey: ''
        },
        onlineReward: {
            dayKey: '',
            tierIndex: 0,
            remainingSeconds: 0
        }
    };
}

function normalizeLiveopsPlayerState(payload, fallback = null) {
    const source = isPlainObject(payload) ? payload : {};
    const base = isPlainObject(fallback) ? fallback : buildDefaultLiveopsPlayerState();
    const invSource = isPlainObject(source.inventory) ? source.inventory : {};
    const invBase = isPlainObject(base.inventory) ? base.inventory : {};
    const inventory = {
        skin_fragment: Math.max(0, Math.floor(Number(invSource.skin_fragment ?? invBase.skin_fragment) || 0)),
        hint: Math.max(0, Math.floor(Number(invSource.hint ?? invBase.hint) || 0)),
        undo: Math.max(0, Math.floor(Number(invSource.undo ?? invBase.undo) || 0)),
        shuffle: Math.max(0, Math.floor(Number(invSource.shuffle ?? invBase.shuffle) || 0))
    };
    const checkinSource = isPlainObject(source.checkin) ? source.checkin : {};
    const checkinBase = isPlainObject(base.checkin) ? base.checkin : {};
    const checkin = {
        claimedCount: Math.max(0, Math.floor(Number(checkinSource.claimedCount ?? checkinBase.claimedCount) || 0)),
        lastClaimDayKey: /^\d{4}-\d{2}-\d{2}$/.test(`${checkinSource.lastClaimDayKey ?? checkinBase.lastClaimDayKey ?? ''}`.trim())
            ? `${checkinSource.lastClaimDayKey ?? checkinBase.lastClaimDayKey}`.trim()
            : ''
    };
    const onlineSource = isPlainObject(source.onlineReward) ? source.onlineReward : {};
    const onlineBase = isPlainObject(base.onlineReward) ? base.onlineReward : {};
    const onlineReward = {
        dayKey: /^\d{4}-\d{2}-\d{2}$/.test(`${onlineSource.dayKey ?? onlineBase.dayKey ?? ''}`.trim())
            ? `${onlineSource.dayKey ?? onlineBase.dayKey}`.trim()
            : '',
        tierIndex: Math.max(0, Math.floor(Number(onlineSource.tierIndex ?? onlineBase.tierIndex) || 0)),
        remainingSeconds: Math.max(0, Math.min(86400, Number(onlineSource.remainingSeconds ?? onlineBase.remainingSeconds) || 0))
    };
    return {
        version: 1,
        updatedAt: nowIso(),
        inventory,
        checkin,
        onlineReward
    };
}

function normalizeProgressFromPayload(payload, fallback = null) {
    const source = isPlainObject(payload) ? payload : {};
    const base = isPlainObject(fallback) ? fallback : buildDefaultProgress();
    const maxUnlockedLevel = Math.max(1, Math.floor(Number(source.maxUnlockedLevel ?? base.maxUnlockedLevel) || 1));
    const maxClearedLevel = Math.max(0, Math.floor(Number(source.maxClearedLevel ?? base.maxClearedLevel) || 0));
    const currentLevel = Math.max(1, Math.floor(Number(source.currentLevel ?? base.currentLevel) || 1));
    const coins = Math.max(0, Math.floor(Number(source.coins ?? base.coins) || 0));
    const unlockedSkinIds = Array.isArray(source.unlockedSkinIds)
        ? Array.from(new Set(source.unlockedSkinIds.map((v) => `${v || ''}`.trim()).filter(Boolean)))
        : (Array.isArray(base.unlockedSkinIds) ? base.unlockedSkinIds : ['classic-burrow']);
    const selectedSkinId = `${source.selectedSkinId || base.selectedSkinId || 'classic-burrow'}`.trim() || 'classic-burrow';
    const nextRewardLevelIndex = Math.max(1, Math.floor(Number(source.nextRewardLevelIndex ?? base.nextRewardLevelIndex) || 1));
    const rewardGuideShown = source.rewardGuideShown === true || (source.rewardGuideShown !== false && base.rewardGuideShown === true);
    const supportAuthorBadgeCount = Math.max(
        0,
        Math.min(999999, Math.floor(Number(source.supportAuthorBadgeCount ?? base.supportAuthorBadgeCount) || 0))
    );
    const supportAdsSource = isPlainObject(source.supportAds) ? source.supportAds : {};
    const supportAdsBase = isPlainObject(base.supportAds) ? base.supportAds : {};
    const supportAds = {
        dayKey: /^\d{4}-\d{2}-\d{2}$/.test(`${supportAdsSource.dayKey ?? supportAdsBase.dayKey ?? ''}`.trim())
            ? `${supportAdsSource.dayKey ?? supportAdsBase.dayKey}`.trim()
            : '',
        watchedToday: Math.max(0, Math.floor(Number(supportAdsSource.watchedToday ?? supportAdsBase.watchedToday) || 0)),
        totalWatched: Math.max(0, Math.floor(Number(supportAdsSource.totalWatched ?? supportAdsBase.totalWatched) || 0)),
        dailyLimitOverride: Math.max(
            -1,
            Math.min(200, Math.floor(Number(supportAdsSource.dailyLimitOverride ?? supportAdsBase.dailyLimitOverride) || -1))
        ),
        lastPlacement: `${supportAdsSource.lastPlacement ?? supportAdsBase.lastPlacement ?? ''}`
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '')
            .slice(0, 40),
        lastWatchedAt: sanitizeIsoDateTime(
            supportAdsSource.lastWatchedAt ?? supportAdsBase.lastWatchedAt,
            ''
        )
    };
    return {
        version: 1,
        updatedAt: nowIso(),
        maxUnlockedLevel,
        maxClearedLevel,
        currentLevel,
        coins,
        unlockedSkinIds,
        selectedSkinId,
        nextRewardLevelIndex,
        rewardGuideShown,
        supportAuthorBadgeCount,
        supportAds
    };
}

function normalizeUserForResponse(user) {
    return {
        userId: `${user?.userId || ''}`.trim(),
        username: `${user?.username || ''}`.trim(),
        avatarUrl: `${user?.avatarUrl || ''}`.trim(),
        isTempUser: user?.isTempUser === true,
        createdAt: `${user?.createdAt || ''}`.trim(),
        lastActiveAt: `${user?.lastActiveAt || ''}`.trim(),
        coins: Math.max(0, Math.floor(Number(user?.coins) || 0)),
        maxUnlockedLevel: Math.max(1, Math.floor(Number(user?.maxUnlockedLevel) || 1)),
        maxClearedLevel: Math.max(0, Math.floor(Number(user?.maxClearedLevel) || 0)),
        unlockedSkinCount: Array.isArray(user?.unlockedSkinIds) ? user.unlockedSkinIds.length : 0
    };
}

function collectUniqueSkinIds(value, fallback = ['classic-burrow']) {
    const source = Array.isArray(value) ? value : fallback;
    const out = [];
    const seen = new Set();
    for (const row of source) {
        const id = `${row || ''}`.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    if (!out.includes('classic-burrow')) {
        out.unshift('classic-burrow');
    }
    return out;
}

function mergeUserDevice(user, payload = {}) {
    const deviceId = sanitizeDeviceId(payload.deviceId);
    const deviceInfo = sanitizeDeviceInfo(payload.deviceInfo);
    const cookieUserId = sanitizeUserId(payload.cookieUserId);
    if (!Array.isArray(user.devices)) {
        user.devices = [];
    }
    if (deviceId) {
        const existing = user.devices.find((entry) => entry?.deviceId === deviceId);
        const now = nowIso();
        if (existing) {
            existing.lastSeenAt = now;
            if (deviceInfo) {
                existing.deviceInfo = deviceInfo;
            }
        } else {
            user.devices.push({
                deviceId,
                deviceInfo,
                firstSeenAt: now,
                lastSeenAt: now
            });
        }
        user.hardwareDeviceIds = Array.from(new Set([...(Array.isArray(user.hardwareDeviceIds) ? user.hardwareDeviceIds : []), deviceId]));
        if (!user.primaryDeviceId) {
            user.primaryDeviceId = deviceId;
        }
    }
    if (cookieUserId && cookieUserId !== sanitizeUserId(user.userId)) {
        if (!Array.isArray(user.cookieDeviceMismatchLogs)) {
            user.cookieDeviceMismatchLogs = [];
        }
        user.cookieDeviceMismatchLogs.push({
            at: nowIso(),
            cookieUserId,
            userId: sanitizeUserId(user.userId),
            deviceId: deviceId || ''
        });
        if (user.cookieDeviceMismatchLogs.length > 80) {
            user.cookieDeviceMismatchLogs = user.cookieDeviceMismatchLogs.slice(-80);
        }
    }
}

async function handleUserRegisterRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    const username = sanitizeUsername(body?.username);
    const password = `${body?.password || ''}`;
    const confirmPassword = `${body?.confirmPassword || ''}`;
    if (!username || username.length < 2) {
        sendJson(res, 400, { ok: false, error: 'username must be at least 2 chars' });
        return;
    }
    if (!password || password.length < 4) {
        sendJson(res, 400, { ok: false, error: 'password must be at least 4 chars' });
        return;
    }
    if (confirmPassword && password !== confirmPassword) {
        sendJson(res, 400, { ok: false, error: 'password confirmation mismatch' });
        return;
    }
    const lowered = username.toLowerCase();
    const duplicated = await userCenterStore.findUserByUsernameLower(lowered);
    if (duplicated) {
        sendJson(res, 409, { ok: false, error: 'username already exists' });
        return;
    }
    const identity = await userCenterStore.allocateUserIdentity(false);
    const userId = identity.userId;
    const createdAt = nowIso();
    const salt = crypto.randomBytes(12).toString('hex');
    const progress = buildDefaultProgress();
    const liveopsPlayer = buildDefaultLiveopsPlayerState();
    const user = {
        userId,
        username,
        avatarUrl: defaultAvatarByName(username),
        isTempUser: false,
        passwordAlgorithm: 'scrypt-v1',
        passwordSalt: salt,
        passwordHash: hashPassword(password, salt, 'scrypt-v1'),
        createdAt,
        lastActiveAt: createdAt,
        primaryDeviceId: '',
        hardwareDeviceIds: [],
        devices: [],
        cookieDeviceMismatchLogs: [],
        progress,
        liveopsPlayer,
        coins: progress.coins,
        maxUnlockedLevel: progress.maxUnlockedLevel,
        maxClearedLevel: progress.maxClearedLevel,
        unlockedSkinIds: collectUniqueSkinIds(progress.unlockedSkinIds)
    };
    mergeUserDevice(user, body);
    try {
        await userCenterStore.insertUser(user);
    } catch (error) {
        if (`${error?.code || ''}` === '23505') {
            sendJson(res, 409, { ok: false, error: 'username already exists' });
            return;
        }
        throw error;
    }
    sendJson(res, 200, { ok: true, user: normalizeUserForResponse(user) });
}

async function handleUserTempRegisterRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    const identity = await userCenterStore.allocateUserIdentity(true);
    const userId = identity.userId;
    const username = `蛇蛇${String(identity.seq).padStart(4, '0')}`;
    const createdAt = nowIso();
    const progress = buildDefaultProgress();
    const liveopsPlayer = buildDefaultLiveopsPlayerState();
    const user = {
        userId,
        username,
        avatarUrl: defaultAvatarByName(username),
        isTempUser: true,
        passwordAlgorithm: '',
        passwordSalt: '',
        passwordHash: '',
        createdAt,
        lastActiveAt: createdAt,
        primaryDeviceId: '',
        hardwareDeviceIds: [],
        devices: [],
        cookieDeviceMismatchLogs: [],
        progress,
        liveopsPlayer,
        coins: progress.coins,
        maxUnlockedLevel: progress.maxUnlockedLevel,
        maxClearedLevel: progress.maxClearedLevel,
        unlockedSkinIds: collectUniqueSkinIds(progress.unlockedSkinIds)
    };
    mergeUserDevice(user, body);
    await userCenterStore.insertUser(user);
    sendJson(res, 200, { ok: true, user: normalizeUserForResponse(user) });
}

async function handleUserLoginRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    const username = sanitizeUsername(body?.username).toLowerCase();
    const password = `${body?.password || ''}`;
    const user = await userCenterStore.findUserByUsernameLower(username);
    if (!user || !user.passwordSalt || !user.passwordHash) {
        sendJson(res, 401, { ok: false, error: 'invalid username or password' });
        return;
    }
    if (!verifyUserPassword(user, password)) {
        sendJson(res, 401, { ok: false, error: 'invalid username or password' });
        return;
    }
    user.lastActiveAt = nowIso();
    mergeUserDevice(user, body);
    await userCenterStore.updateUser(user);
    sendJson(res, 200, { ok: true, user: normalizeUserForResponse(user) });
}

async function handleUserLoginOrRegisterRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }

    const username = sanitizeUsername(body?.username);
    const password = `${body?.password || ''}`;
    if (!username || username.length < 2) {
        sendJson(res, 400, { ok: false, error: 'username must be at least 2 chars' });
        return;
    }
    if (!password || password.length < 4) {
        sendJson(res, 400, { ok: false, error: 'password must be at least 4 chars' });
        return;
    }

    const lowered = username.toLowerCase();
    const existedUser = await userCenterStore.findUserByUsernameLower(lowered);
    if (existedUser) {
        if (!existedUser.passwordSalt || !existedUser.passwordHash) {
            sendJson(res, 401, { ok: false, error: 'temporary user cannot login with password' });
            return;
        }
        if (!verifyUserPassword(existedUser, password)) {
            sendJson(res, 401, { ok: false, error: 'invalid password' });
            return;
        }
        existedUser.lastActiveAt = nowIso();
        mergeUserDevice(existedUser, body);
        await userCenterStore.updateUser(existedUser);
        sendJson(res, 200, { ok: true, mode: 'login', user: normalizeUserForResponse(existedUser) });
        return;
    }

    const identity = await userCenterStore.allocateUserIdentity(false);
    const userId = identity.userId;
    const createdAt = nowIso();
    const salt = crypto.randomBytes(12).toString('hex');
    const progress = buildDefaultProgress();
    const liveopsPlayer = buildDefaultLiveopsPlayerState();
    const user = {
        userId,
        username,
        avatarUrl: defaultAvatarByName(username),
        isTempUser: false,
        passwordAlgorithm: 'scrypt-v1',
        passwordSalt: salt,
        passwordHash: hashPassword(password, salt, 'scrypt-v1'),
        createdAt,
        lastActiveAt: createdAt,
        primaryDeviceId: '',
        hardwareDeviceIds: [],
        devices: [],
        cookieDeviceMismatchLogs: [],
        progress,
        liveopsPlayer,
        coins: progress.coins,
        maxUnlockedLevel: progress.maxUnlockedLevel,
        maxClearedLevel: progress.maxClearedLevel,
        unlockedSkinIds: collectUniqueSkinIds(progress.unlockedSkinIds)
    };
    mergeUserDevice(user, body);
    try {
        await userCenterStore.insertUser(user);
    } catch (error) {
        if (`${error?.code || ''}` === '23505') {
            sendJson(res, 409, { ok: false, error: 'username already exists' });
            return;
        }
        throw error;
    }
    sendJson(res, 200, { ok: true, mode: 'register', user: normalizeUserForResponse(user) });
}

async function handleUserSessionRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    const userId = sanitizeUserId(body?.userId);
    if (!userId) {
        sendJson(res, 404, { ok: false, error: 'user not found' });
        return;
    }
    const user = await userCenterStore.findUserById(userId);
    if (!user) {
        sendJson(res, 404, { ok: false, error: 'user not found' });
        return;
    }
    user.lastActiveAt = nowIso();
    mergeUserDevice(user, body);
    await userCenterStore.updateUser(user);
    sendJson(res, 200, { ok: true, user: normalizeUserForResponse(user) });
}

async function handleUserMeRequest(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const userId = sanitizeUserId(requestUrl.searchParams.get('userId') || '');
    if (!userId) {
        sendJson(res, 400, { ok: false, error: 'userId is required' });
        return;
    }
    const user = await userCenterStore.findUserById(userId);
    if (!user) {
        sendJson(res, 404, { ok: false, error: 'user not found' });
        return;
    }
    sendJson(res, 200, {
        ok: true,
        user: {
            ...normalizeUserForResponse(user),
            registerTimestamp: `${user?.createdAt || ''}`.trim(),
            lastActiveTimestamp: `${user?.lastActiveAt || ''}`.trim(),
            hardwareDeviceIds: Array.isArray(user?.hardwareDeviceIds) ? user.hardwareDeviceIds : [],
            devices: Array.isArray(user?.devices) ? user.devices : []
        }
    });
}

async function handleUserProfileRequest(req, res) {
    if (req.method !== 'PUT') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }
    const userId = sanitizeUserId(body.userId);
    if (!userId) {
        sendJson(res, 400, { ok: false, error: 'userId is required' });
        return;
    }
    const user = await userCenterStore.findUserById(userId);
    if (!user) {
        sendJson(res, 404, { ok: false, error: 'user not found' });
        return;
    }

    const rawUsername = `${body.username ?? ''}`.trim();
    const hasUsernameUpdate = rawUsername.length > 0;
    if (hasUsernameUpdate) {
        const username = sanitizeUsername(rawUsername);
        if (!username || username.length < 2) {
            sendJson(res, 400, { ok: false, error: 'username must be at least 2 chars' });
            return;
        }
        const duplicated = await userCenterStore.findUserByUsernameLower(username.toLowerCase());
        if (duplicated && sanitizeUserId(duplicated.userId) !== userId) {
            sendJson(res, 409, { ok: false, error: 'username already exists' });
            return;
        }
        user.username = username;
    }

    const password = `${body.password || ''}`;
    if (password) {
        if (password.length < 4) {
            sendJson(res, 400, { ok: false, error: 'password must be at least 4 chars' });
            return;
        }
        const salt = crypto.randomBytes(12).toString('hex');
        user.passwordAlgorithm = 'scrypt-v1';
        user.passwordSalt = salt;
        user.passwordHash = hashPassword(password, salt, 'scrypt-v1');
        user.isTempUser = false;
    }

    const avatarUrlInput = `${body.avatarUrl ?? ''}`.trim();
    user.avatarUrl = avatarUrlInput || defaultAvatarByName(user.username || user.userId);
    user.lastActiveAt = nowIso();
    await userCenterStore.updateUser(user);
    sendJson(res, 200, { ok: true, user: normalizeUserForResponse(user) });
}

function parseUserIdFromProgressPath(pathname) {
    const match = `${pathname || ''}`.match(/^\/api\/users\/([^/]+)\/progress$/);
    if (!match) return '';
    return sanitizeUserId(decodeURIComponent(match[1] || ''));
}

function parseUserIdFromLiveopsPlayerPath(pathname) {
    const match = `${pathname || ''}`.match(/^\/api\/users\/([^/]+)\/liveops-player$/);
    if (!match) return '';
    return sanitizeUserId(decodeURIComponent(match[1] || ''));
}

async function handleUserProgressRequest(req, res, pathname) {
    const userId = parseUserIdFromProgressPath(pathname);
    if (!userId) {
        sendJson(res, 400, { ok: false, error: 'invalid user id' });
        return;
    }
    const user = await userCenterStore.findUserById(userId);
    if (!user) {
        sendJson(res, 404, { ok: false, error: 'user not found' });
        return;
    }
    if (req.method === 'GET') {
        const progress = normalizeProgressFromPayload(user.progress);
        user.progress = progress;
        user.coins = progress.coins;
        user.maxUnlockedLevel = progress.maxUnlockedLevel;
        user.maxClearedLevel = progress.maxClearedLevel;
        user.unlockedSkinIds = collectUniqueSkinIds(progress.unlockedSkinIds);
        await userCenterStore.updateUser(user);
        sendJson(res, 200, { ok: true, progress });
        return;
    }
    if (req.method === 'PUT') {
        let body;
        try {
            body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
            return;
        }
        if (!isPlainObject(body)) {
            sendJson(res, 400, { ok: false, error: 'body must be an object' });
            return;
        }
        const progress = normalizeProgressFromPayload(body, user.progress);
        user.progress = progress;
        user.lastActiveAt = nowIso();
        user.coins = progress.coins;
        user.maxUnlockedLevel = progress.maxUnlockedLevel;
        user.maxClearedLevel = progress.maxClearedLevel;
        user.unlockedSkinIds = collectUniqueSkinIds(progress.unlockedSkinIds);
        await userCenterStore.updateUser(user);
        sendJson(res, 200, { ok: true });
        return;
    }
    sendJson(res, 405, { ok: false, error: 'method not allowed' });
}

async function handleUserLiveopsPlayerRequest(req, res, pathname) {
    const userId = parseUserIdFromLiveopsPlayerPath(pathname);
    if (!userId) {
        sendJson(res, 400, { ok: false, error: 'invalid user id' });
        return;
    }
    const user = await userCenterStore.findUserById(userId);
    if (!user) {
        sendJson(res, 404, { ok: false, error: 'user not found' });
        return;
    }
    if (req.method === 'GET') {
        const player = normalizeLiveopsPlayerState(user.liveopsPlayer);
        user.liveopsPlayer = player;
        await userCenterStore.updateUser(user);
        sendJson(res, 200, { ok: true, player });
        return;
    }
    if (req.method === 'PUT') {
        let body;
        try {
            body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
            return;
        }
        if (!isPlainObject(body)) {
            sendJson(res, 400, { ok: false, error: 'body must be an object' });
            return;
        }
        user.liveopsPlayer = normalizeLiveopsPlayerState(body, user.liveopsPlayer);
        user.lastActiveAt = nowIso();
        await userCenterStore.updateUser(user);
        sendJson(res, 200, { ok: true });
        return;
    }
    sendJson(res, 405, { ok: false, error: 'method not allowed' });
}

async function handleLeaderboardRequest(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const limit = clampInt(requestUrl.searchParams.get('limit'), 1, 100, 20);
    const offset = clampInt(requestUrl.searchParams.get('offset'), 0, 500000, 0);
    const currentUserId = sanitizeUserId(requestUrl.searchParams.get('userId'));
    const mode = `${requestUrl.searchParams.get('mode') || ''}`.trim().toLowerCase() === 'badge'
        ? 'badge'
        : 'clear';
    const rawRows = await userCenterStore.listLeaderboard(limit + 1, { mode, offset });
    const hasMore = rawRows.length > limit;
    const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;
    const rows = pageRows
        .map((row, index) => ({
            rank: offset + index + 1,
            ...row,
            avatarUrl: `${row?.avatarUrl || ''}`.trim() || defaultAvatarByName(`${row?.userId || 'u'}`)
        }));
    let me = null;
    if (currentUserId && typeof userCenterStore.getLeaderboardEntryForUser === 'function') {
        const selfEntry = await userCenterStore.getLeaderboardEntryForUser(currentUserId, { mode });
        if (selfEntry) {
            me = {
                ...selfEntry,
                avatarUrl: `${selfEntry?.avatarUrl || ''}`.trim() || defaultAvatarByName(`${selfEntry?.userId || currentUserId}`)
            };
        }
    }
    sendJson(res, 200, {
        ok: true,
        limit,
        offset,
        nextOffset: offset + rows.length,
        hasMore,
        mode,
        rows,
        me
    });
}

async function handleAdminResetGameStateRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const resetUsers = await userCenterStore.resetGameStateForAllUsers();
    const defaultProgress = buildDefaultProgress();
    const defaultLiveopsPlayer = buildDefaultLiveopsPlayerState();
    await writeJsonAtomic(path.join(DATA_DIR, 'game-progress-v1.json'), defaultProgress);
    await writeJsonAtomic(path.join(DATA_DIR, 'liveops-player-v1.json'), defaultLiveopsPlayer);
    sendJson(res, 200, {
        ok: true,
        resetUsers,
        mode: 'server-data-reset'
    });
}

async function handleAdminResetLeaderboardProgressRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const resetUsers = await userCenterStore.resetLeaderboardProgressForAllUsers();
    sendJson(res, 200, { ok: true, resetUsers });
}

async function analyzeFontUsage() {
    const rowsByName = new Map();
    const sourceFiles = [];
    for (const entry of FONT_SCAN_CSS_FILES) {
        const absolutePath = path.join(ROOT_DIR, entry.relativePath);
        let content = '';
        try {
            content = await fs.readFile(absolutePath, 'utf8');
        } catch {
            continue;
        }
        sourceFiles.push(entry.relativePath);
        collectFontUsageFromCss(content, entry, rowsByName);
    }

    const fontFiles = await collectFontFiles();
    const packagedFontNames = new Set(fontFiles.map((file) => path.basename(file.path, path.extname(file.path))));
    const rows = Array.from(rowsByName.values()).map((row) => {
        const metadata = resolveFontMetadata(row.name);
        const packaged = packagedFontNames.has(row.name)
            ? '是'
            : (FONT_GENERIC_FAMILIES.has(row.name) ? '不适用' : '否，当前未随包分发');
        return {
            name: row.name,
            scope: Array.from(row.scopeSet).join(' / '),
            copyright: metadata.copyright,
            tagClass: metadata.tagClass,
            source: metadata.source,
            sourceUrl: metadata.sourceUrl,
            packaged,
            usages: Array.from(row.usageSet).sort(),
            codeRefs: Array.from(row.codeRefSet).sort()
        };
    }).sort((left, right) => left.name.localeCompare(right.name, 'en'));

    return { rows, sourceFiles, fontFiles };
}

function collectFontUsageFromCss(content, entry, rowsByName) {
    const lines = `${content || ''}`.split(/\r?\n/);
    const cssVars = new Map();
    let selector = '';

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index].trim();
        if (!line || line.startsWith('/*')) {
            continue;
        }
        const cssVarMatch = line.match(/^(--[\w-]+)\s*:\s*([^;]+);/);
        if (cssVarMatch) {
            cssVars.set(cssVarMatch[1], cssVarMatch[2].trim());
        }
        if (line.endsWith('{')) {
            selector = line.slice(0, -1).trim();
        }
        if (!line.toLowerCase().includes('font-family')) {
            continue;
        }
        const valueMatch = line.match(/font-family\s*:\s*([^;]+);?/i);
        if (!valueMatch) {
            continue;
        }
        const rawFontValue = valueMatch[1].trim();
        const resolvedFontValue = rawFontValue.replace(/var\((--[\w-]+)\)/g, (match, varName) => cssVars.get(varName) || match);
        const families = parseFontFamilyList(resolvedFontValue).filter((name) => name && name !== 'inherit');
        for (const family of families) {
            const row = ensureFontRow(rowsByName, family);
            row.scopeSet.add(entry.scope);
            row.usageSet.add(`${entry.scope}: ${selector || '(unknown selector)'}`);
            row.codeRefSet.add(`${entry.relativePath}:${index + 1} ${selector || ''}`.trim());
        }
    }
}

function parseFontFamilyList(value) {
    const result = [];
    let token = '';
    let quote = '';
    for (const char of `${value || ''}`) {
        if ((char === '"' || char === "'") && !quote) {
            quote = char;
            continue;
        }
        if (char === quote) {
            quote = '';
            continue;
        }
        if (char === ',' && !quote) {
            result.push(normalizeFontFamilyName(token));
            token = '';
            continue;
        }
        token += char;
    }
    if (token.trim()) {
        result.push(normalizeFontFamilyName(token));
    }
    return result.filter(Boolean);
}

function normalizeFontFamilyName(name) {
    return `${name || ''}`.trim().replace(/^['"]|['"]$/g, '');
}

function ensureFontRow(rowsByName, fontName) {
    if (!rowsByName.has(fontName)) {
        rowsByName.set(fontName, {
            name: fontName,
            scopeSet: new Set(),
            usageSet: new Set(),
            codeRefSet: new Set()
        });
    }
    return rowsByName.get(fontName);
}

function resolveFontMetadata(fontName) {
    if (FONT_LICENSE_METADATA[fontName]) {
        return FONT_LICENSE_METADATA[fontName];
    }
    if (FONT_GENERIC_FAMILIES.has(fontName)) {
        return {
            copyright: '通用字体族',
            tagClass: 'is-system',
            source: '浏览器通用 fallback，不是具体字体文件',
            sourceUrl: ''
        };
    }
    if (FONT_SYSTEM_FAMILIES.has(fontName)) {
        return {
            copyright: '系统授权',
            tagClass: 'is-system',
            source: '操作系统字体，随系统授权使用',
            sourceUrl: ''
        };
    }
    return {
        copyright: '需确认',
        tagClass: 'is-none',
        source: '未登记授权来源',
        sourceUrl: ''
    };
}

async function collectFontFiles() {
    const files = await walkDirectoryFiles(ROOT_DIR);
    const rows = [];
    for (const absolutePath of files) {
        const extension = path.extname(absolutePath).toLowerCase();
        if (!FONT_FILE_EXTENSIONS.has(extension)) {
            continue;
        }
        const stat = await fs.stat(absolutePath);
        rows.push({
            path: normalizeProjectRelativePath(absolutePath),
            sizeBytes: stat.size,
            extension
        });
    }
    return rows.sort((left, right) => left.path.localeCompare(right.path));
}

async function handleAdminFontScanRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    try {
        const analysis = await analyzeFontUsage();
        sendJson(res, 200, {
            ok: true,
            generatedAt: nowIso(),
            ...analysis
        });
    } catch (error) {
        sendJson(res, 500, {
            ok: false,
            error: error?.message || 'font scan failed'
        });
    }
}

async function handleAdminAssetScanRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const analysis = await analyzeUnusedImageAssets();
    sendJson(res, 200, {
        ok: true,
        scanId: `${Date.now()}`,
        policyVersion: ASSET_AUDIT_POLICY_VERSION,
        summary: analysis.summary,
        assets: analysis.assets,
        unusedAssets: analysis.unusedAssets
    });
}

async function handleAdminAssetSelfCheckRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const analysis = await analyzeUnusedImageAssets();
    const selfCheck = runAssetAuditSelfCheck(analysis);
    sendJson(res, 200, {
        ok: selfCheck.failed.length === 0,
        policyVersion: ASSET_AUDIT_POLICY_VERSION,
        summary: analysis.summary,
        checks: selfCheck.checks,
        failed: selfCheck.failed
    });
}

async function handleAdminDeleteUnusedAssetsRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const body = await readRequestJson(req);
    const requestedPaths = sanitizeStringArray(body?.paths, {
        sanitize: sanitizeAssetDeletePath,
        max: 500
    });
    if (requestedPaths.length <= 0) {
        sendJson(res, 400, { ok: false, error: 'no asset paths provided' });
        return;
    }
    const analysis = await analyzeUnusedImageAssets();
    const unusedMap = new Map(analysis.unusedAssets.map((item) => [item.path, item]));
    const deletable = requestedPaths.filter((assetPath) => unusedMap.has(assetPath));
    const rejected = requestedPaths.filter((assetPath) => !unusedMap.has(assetPath));
    if (deletable.length <= 0) {
        sendJson(res, 400, { ok: false, error: 'requested assets are not currently unused', rejected });
        return;
    }
    const deletedPaths = [];
    for (const assetPath of deletable) {
        await deleteUnusedAssetFile(assetPath);
        deletedPaths.push(assetPath);
    }
    sendJson(res, 200, {
        ok: true,
        deletedCount: deletedPaths.length,
        deletedPaths,
        rejected
    });
}

async function handleAdminDeleteAllUnusedAssetsRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const analysis = await analyzeUnusedImageAssets();
    const deletedPaths = [];
    for (const item of analysis.unusedAssets) {
        await deleteUnusedAssetFile(item.path);
        deletedPaths.push(item.path);
    }
    sendJson(res, 200, {
        ok: true,
        deletedCount: deletedPaths.length,
        deletedPaths
    });
}

async function handleAdminUpdateImageAssetRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    let body;
    try {
        body = await readRequestJson(req, MAX_SKIN_GEN_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    if (!isPlainObject(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be an object' });
        return;
    }

    const relativePath = sanitizeAssetDeletePath(body.path);
    if (!relativePath) {
        sendJson(res, 400, { ok: false, error: 'invalid asset path' });
        return;
    }
    const decoded = (() => {
        try {
            return decodeImageDataUrl(`${body.imageDataUrl || ''}`.trim());
        } catch (error) {
            return { error };
        }
    })();
    if (decoded?.error) {
        sendJson(res, 400, { ok: false, error: decoded.error?.message || 'invalid image data url' });
        return;
    }

    const extension = path.extname(relativePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
        sendJson(res, 400, { ok: false, error: 'only png/jpg/webp assets support overwrite update' });
        return;
    }
    if (decoded.ext !== extension && !((decoded.ext === '.jpg' || decoded.ext === '.jpeg') && (extension === '.jpg' || extension === '.jpeg'))) {
        sendJson(res, 400, { ok: false, error: `image mime does not match target extension ${extension}` });
        return;
    }

    const absolutePath = path.resolve(ROOT_DIR, relativePath);
    const assetsRoot = path.resolve(ROOT_DIR, 'assets');
    const normalizedAssetsRoot = `${assetsRoot}${path.sep}`;
    if (absolutePath !== assetsRoot && !absolutePath.startsWith(normalizedAssetsRoot)) {
        sendJson(res, 400, { ok: false, error: 'asset path outside assets directory' });
        return;
    }

    await fs.writeFile(absolutePath, decoded.buffer);
    const stat = await fs.stat(absolutePath);
    sendJson(res, 200, {
        ok: true,
        path: relativePath,
        sizeBytes: Math.max(0, Number(stat.size) || 0),
        width: Math.max(0, Math.floor(Number(body.width) || 0)),
        height: Math.max(0, Math.floor(Number(body.height) || 0))
    });
}

function toAdminSafeUserDetail(user) {
    if (!user) return null;
    return {
        userId: `${user.userId || ''}`.trim(),
        username: `${user.username || ''}`.trim(),
        avatarUrl: `${user.avatarUrl || ''}`.trim(),
        isTempUser: user.isTempUser === true,
        createdAt: `${user.createdAt || ''}`.trim(),
        lastActiveAt: `${user.lastActiveAt || ''}`.trim(),
        primaryDeviceId: `${user.primaryDeviceId || ''}`.trim(),
        hardwareDeviceIds: Array.isArray(user.hardwareDeviceIds) ? user.hardwareDeviceIds : [],
        devices: Array.isArray(user.devices) ? user.devices : [],
        cookieDeviceMismatchLogs: Array.isArray(user.cookieDeviceMismatchLogs) ? user.cookieDeviceMismatchLogs : [],
        coins: Math.max(0, Math.floor(Number(user.coins) || 0)),
        maxUnlockedLevel: Math.max(1, Math.floor(Number(user.maxUnlockedLevel) || 1)),
        maxClearedLevel: Math.max(0, Math.floor(Number(user.maxClearedLevel) || 0)),
        unlockedSkinIds: collectUniqueSkinIds(user.unlockedSkinIds),
        progress: normalizeProgressFromPayload(user.progress),
        liveopsPlayer: normalizeLiveopsPlayerState(user.liveopsPlayer),
        passwordAlgorithm: `${user.passwordAlgorithm || ''}`.trim() || 'sha256-v1',
        passwordSalt: `${user.passwordSalt || ''}`.trim(),
        passwordHash: `${user.passwordHash || ''}`.trim()
    };
}

function sanitizeIsoDateTime(raw, fallback = '') {
    const text = `${raw || ''}`.trim();
    if (!text) return fallback;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toISOString();
}

async function analyzeUnusedImageAssets() {
    const assetRows = await collectImageAssetRows();
    const referencesByAsset = await collectImageAssetReferences();
    const maxUsageCount = assetRows.reduce((maxCount, row) => {
        const usageCount = referencesByAsset.get(row.path)?.size || 0;
        return Math.max(maxCount, usageCount);
    }, 0);
    const assets = assetRows
        .map((row) => {
            const referrers = referencesByAsset.get(row.path);
            const usageCount = referrers?.size || 0;
            const referrerList = referrers ? [...referrers].sort() : [];
            const category = classifyAssetUsage(row.path, referrerList);
            return {
                ...row,
                used: usageCount > 0,
                usageCount,
                usageRate: maxUsageCount > 0
                    ? Number(((usageCount / maxUsageCount) * 100).toFixed(1))
                    : 0,
                referrers: referrerList,
                category,
                classificationReason: buildAssetClassificationReason(row.path, category, referrerList),
                isArtifactCandidate: category === 'artifact_candidate'
            };
        })
        .sort((a, b) => {
            if (a.used !== b.used) {
                return a.used ? 1 : -1;
            }
            if (b.usageCount !== a.usageCount) {
                return b.usageCount - a.usageCount;
            }
            if (b.sizeBytes !== a.sizeBytes) {
                return b.sizeBytes - a.sizeBytes;
            }
            return a.path.localeCompare(b.path);
        });
    const unusedAssets = assets
        .filter((row) => !row.used)
        .sort((a, b) => b.sizeBytes - a.sizeBytes || a.path.localeCompare(b.path));

    const totalImageBytes = assets.reduce((sum, row) => sum + row.sizeBytes, 0);
    const usedAssets = assets.filter((row) => row.used);
    const usedImageBytes = usedAssets.reduce((sum, row) => sum + row.sizeBytes, 0);
    const unusedImageBytes = unusedAssets.reduce((sum, row) => sum + row.sizeBytes, 0);
    const primaryRuntimeAssets = assets.filter((row) => row.category === 'primary_runtime');
    const fallbackOnlyAssets = assets.filter((row) => row.category === 'fallback_only');
    const artifactCandidates = assets.filter((row) => row.category === 'artifact_candidate');
    return {
        summary: {
            policyVersion: ASSET_AUDIT_POLICY_VERSION,
            policyStandard: 'player-visible-runtime-reference',
            totalImageAssets: assets.length,
            totalImageBytes,
            usedImageAssets: usedAssets.length,
            usedImageBytes,
            unusedImageAssets: unusedAssets.length,
            unusedImageBytes,
            maxUsageCount,
            primaryRuntimeAssets: primaryRuntimeAssets.length,
            fallbackOnlyAssets: fallbackOnlyAssets.length,
            artifactCandidates: artifactCandidates.length,
            runtimeSourceRules: [
                'index.html',
                'js runtime files excluding admin tools',
                'css runtime declarations only when actually used',
                'playable skin manifests and complete skin directories'
            ]
        },
        assets,
        unusedAssets
    };
}

function buildAssetClassificationReason(assetPath, category, referrers) {
    const refs = Array.isArray(referrers) ? referrers.filter(Boolean) : [];
    if (refs.length > 0) {
        const visibleRefs = refs.slice(0, 4).join(', ');
        return `Player-visible runtime reference found in: ${visibleRefs}${refs.length > 4 ? ', ...' : ''}`;
    }
    if (category === 'artifact_candidate') {
        return 'No player-visible runtime reference was found; path is in a concept/source-artifact location or uses a source-artifact filename.';
    }
    if (category === 'fallback_only') {
        return 'Only fallback theme code references this asset; it is not a confirmed primary runtime asset.';
    }
    return 'No player-visible runtime reference was found by the current audit policy.';
}

async function collectImageAssetRows() {
    const assetsDir = path.join(ROOT_DIR, 'assets');
    const files = await walkDirectoryFiles(assetsDir);
    const rows = [];
    for (const filePath of files) {
        const extension = path.extname(filePath).toLowerCase();
        if (!IMAGE_ASSET_EXTENSIONS.has(extension)) {
            continue;
        }
        const stat = await fs.stat(filePath);
        rows.push({
            path: normalizeProjectRelativePath(filePath),
            extension,
            sizeBytes: Math.max(0, Number(stat.size) || 0)
        });
    }
    return rows.sort((a, b) => a.path.localeCompare(b.path));
}

async function collectImageAssetReferences() {
    const projectFiles = await walkDirectoryFiles(ROOT_DIR);
    const referenceMap = new Map();
    const deletedLayoutAssetPaths = await collectDeletedUiLayoutAssetPaths();
    for (const filePath of projectFiles) {
        const relativePath = normalizeProjectRelativePath(filePath);
        if (!shouldCountPlayerAssetReferenceSource(relativePath)) {
            continue;
        }
        if (relativePath.startsWith('data/generated/')) {
            continue;
        }
        const extension = path.extname(filePath).toLowerCase();
        if (!ASSET_SCAN_FILE_EXTENSIONS.has(extension)) {
            continue;
        }
        const content = await fs.readFile(filePath, 'utf8');
        const matches = collectAssetReferenceMatches(content, extension);
        for (const match of matches) {
            const normalized = normalizeAssetReferencePath(match);
            if (!normalized) {
                continue;
            }
            if (!shouldCountImageAssetReference(normalized, relativePath, deletedLayoutAssetPaths)) {
                continue;
            }
            addAssetReference(referenceMap, normalized, relativePath);
        }
    }
    const playableSkinRefs = await collectPlayableSkinAssetReferences();
    for (const [assetPath, referrers] of playableSkinRefs) {
        for (const referrer of referrers) {
            addAssetReference(referenceMap, assetPath, referrer);
        }
    }
    return referenceMap;
}

function collectAssetReferenceMatches(content, extension) {
    const text = `${content || ''}`;
    if (`${extension || ''}`.toLowerCase() !== '.css') {
        return text.match(ASSET_IMAGE_REF_PATTERN) || [];
    }
    const customProperties = collectCssAssetCustomProperties(text);
    const out = [];
    for (const match of text.match(ASSET_IMAGE_REF_PATTERN) || []) {
        const declarationName = findCssDeclarationNameBefore(text, match);
        if (!declarationName || !declarationName.startsWith('--')) {
            out.push(match);
            continue;
        }
        if (isCssCustomPropertyUsed(text, declarationName, customProperties)) {
            out.push(match);
        }
    }
    return out;
}

function collectCssAssetCustomProperties(cssText) {
    const text = `${cssText || ''}`;
    const out = new Map();
    const declarationPattern = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]*?assets\/[^;{}]*?\.(?:png|jpg|jpeg|webp|svg|gif)[^;{}]*);/g;
    let match;
    while ((match = declarationPattern.exec(text))) {
        out.set(match[1], match.index);
    }
    return out;
}

function findCssDeclarationNameBefore(cssText, assetMatch) {
    const text = `${cssText || ''}`;
    const index = text.indexOf(assetMatch);
    if (index < 0) {
        return '';
    }
    const colonIndex = text.lastIndexOf(':', index);
    if (colonIndex < 0) {
        return '';
    }
    const boundary = Math.max(
        text.lastIndexOf(';', colonIndex),
        text.lastIndexOf('{', colonIndex),
        text.lastIndexOf('}', colonIndex)
    );
    return text.slice(boundary + 1, colonIndex).trim();
}

function isCssCustomPropertyUsed(cssText, propertyName, customProperties, visiting = new Set()) {
    const name = `${propertyName || ''}`.trim();
    if (!name || visiting.has(name)) {
        return false;
    }
    visiting.add(name);
    const text = `${cssText || ''}`;
    const directUsePattern = new RegExp(`var\\(\\s*${escapeRegExp(name)}\\b`, 'g');
    for (const match of text.matchAll(directUsePattern)) {
        if (match.index !== customProperties.get(name)) {
            return true;
        }
    }
    for (const [otherName, declarationIndex] of customProperties) {
        if (otherName === name) {
            continue;
        }
        const declarationEnd = text.indexOf(';', declarationIndex);
        const declarationText = text.slice(declarationIndex, declarationEnd >= 0 ? declarationEnd : text.length);
        if (new RegExp(`var\\(\\s*${escapeRegExp(name)}\\b`).test(declarationText)
            && isCssCustomPropertyUsed(text, otherName, customProperties, visiting)) {
            return true;
        }
    }
    return false;
}

function escapeRegExp(value) {
    return `${value || ''}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function collectDeletedUiLayoutAssetPaths() {
    const layoutPath = path.join(ROOT_DIR, 'data', 'managed-config', 'ui-layout-config-v1.json');
    const layout = await readJsonFile(layoutPath, null);
    const out = new Set();
    for (const [screenId, assetOwners] of Object.entries(PLAYER_VISIBLE_UI_ASSET_OWNERS)) {
        const deleted = Array.isArray(layout?.[screenId]?.deletedElements) ? layout[screenId].deletedElements : [];
        const deletedSet = new Set(deleted.map((item) => `${item || ''}`.trim()).filter(Boolean));
        for (const [elementId, assetPaths] of Object.entries(assetOwners)) {
            if (!deletedSet.has(elementId)) {
                continue;
            }
            for (const assetPath of assetPaths) {
                const normalized = normalizeAssetReferencePath(assetPath);
                if (normalized) {
                    out.add(normalized);
                }
            }
        }
    }
    return out;
}

function shouldCountImageAssetReference(assetPath, referrer, deletedLayoutAssetPaths) {
    const normalizedAsset = normalizeAssetReferencePath(assetPath);
    const normalizedReferrer = `${referrer || ''}`.replace(/\\/g, '/').trim();
    if (!normalizedAsset || !normalizedReferrer) {
        return false;
    }
    if (deletedLayoutAssetPaths?.has?.(normalizedAsset) && normalizedReferrer === 'css/style.css') {
        return false;
    }
    return true;
}

function shouldCountPlayerAssetReferenceSource(relativePath) {
    const normalized = `${relativePath || ''}`.replace(/\\/g, '/');
    if (!normalized) return false;
    if (normalized === 'index.html') {
        return true;
    }
    if (normalized.startsWith('js/')) {
        if (normalized.startsWith('js/admin-')) {
            return false;
        }
        if (normalized === 'js/skin-fit-tool.js') {
            return false;
        }
        return true;
    }
    if (normalized.startsWith('css/')) {
        return true;
    }
    return false;
}

function addAssetReference(referenceMap, assetPath, referrer) {
    const normalizedAssetPath = normalizeAssetReferencePath(assetPath);
    const normalizedReferrer = `${referrer || ''}`.replace(/\\/g, '/').trim();
    if (!normalizedAssetPath || !normalizedReferrer) {
        return;
    }
    if (!referenceMap.has(normalizedAssetPath)) {
        referenceMap.set(normalizedAssetPath, new Set());
    }
    referenceMap.get(normalizedAssetPath).add(normalizedReferrer);
}

async function collectPlayableSkinAssetReferences() {
    const skinsRoot = path.join(ROOT_DIR, 'assets', 'skins');
    const entries = await fs.readdir(skinsRoot, { withFileTypes: true }).catch(() => []);
    const out = new Map();
    for (const entry of entries) {
        if (!entry?.isDirectory?.()) {
            continue;
        }
        const skinId = sanitizeSlug(entry.name, '');
        if (!skinId || skinId === 'templates') {
            continue;
        }
        const skinDir = path.join(skinsRoot, skinId);
        const partFiles = [];
        for (const partName of ALLOWED_PART_NAMES) {
            const filePath = path.join(skinDir, partName);
            try {
                const stat = await fs.stat(filePath);
                if (stat.isFile()) {
                    partFiles.push(partName);
                }
            } catch {
                // ignored: part missing
            }
        }
        const manifest = await readJsonFile(path.join(skinDir, 'manifest.json'), null);
        const isAtlasManifest = isPlainObject(manifest) && `${manifest?.mechanism || ''}`.trim().toLowerCase() === 'atlas-sheet';
        const manifestAssets = isPlainObject(manifest?.assets) ? manifest.assets : null;
        const complete = isAtlasManifest ? Boolean(manifestAssets) : partFiles.length === ALLOWED_PART_NAMES.length;
        if (!complete) {
            continue;
        }
        const referrer = `runtime:skin:${skinId}`;
        const preview = typeof manifest?.preview === 'string' && manifest.preview.trim()
            ? manifest.preview.trim()
            : (partFiles.includes('snake_head.png') ? `/assets/skins/${skinId}/snake_head.png` : '');
        if (preview) {
            addAssetReference(out, preview, referrer);
        }
        const runtimeAssets = collectRuntimeSkinAssetPaths(skinId, manifestAssets, partFiles);
        for (const assetPath of runtimeAssets) {
            addAssetReference(out, assetPath, referrer);
        }
    }
    return out;
}

function collectRuntimeSkinAssetPaths(skinId, manifestAssets, partFiles) {
    const fromManifest = [];
    if (isPlainObject(manifestAssets)) {
        for (const assetKey of RUNTIME_SKIN_ASSET_KEYS) {
            const rawAsset = manifestAssets[assetKey];
            if (typeof rawAsset === 'string' && rawAsset.trim()) {
                fromManifest.push(rawAsset.trim());
                continue;
            }
            if (isPlainObject(rawAsset) && typeof rawAsset.src === 'string' && rawAsset.src.trim()) {
                fromManifest.push(rawAsset.src.trim());
            }
        }
    }
    if (fromManifest.length > 0) {
        return fromManifest;
    }
    const availablePartFiles = Array.isArray(partFiles) ? partFiles : [];
    return availablePartFiles.map((partName) => `/assets/skins/${skinId}/${partName}`);
}

function classifyAssetUsage(assetPath, referrers) {
    const rows = Array.isArray(referrers) ? referrers : [];
    if (rows.length <= 0) {
        return isArtifactCandidatePath(assetPath) ? 'artifact_candidate' : 'unused';
    }
    const allFallback = rows.every((row) => row === 'js/ui-theme.js');
    if (allFallback) {
        return 'fallback_only';
    }
    return 'primary_runtime';
}

function runAssetAuditSelfCheck(analysis) {
    const assets = Array.isArray(analysis?.assets) ? analysis.assets : [];
    const assetByPath = new Map(assets.map((asset) => [asset.path, asset]));
    const checks = ASSET_AUDIT_SELF_CHECK_CASES.map((testCase) => {
        const asset = assetByPath.get(testCase.path);
        const exists = Boolean(asset);
        const actualUsed = exists ? asset.used === true : false;
        const passed = actualUsed === testCase.expectedUsed;
        return {
            path: testCase.path,
            exists,
            expectedUsed: testCase.expectedUsed,
            actualUsed,
            passed,
            category: asset?.category || (exists ? '' : 'missing'),
            referrers: Array.isArray(asset?.referrers) ? asset.referrers : [],
            reason: testCase.reason
        };
    });
    return {
        checks,
        failed: checks.filter((check) => !check.passed)
    };
}

function isArtifactCandidatePath(assetPath) {
    const normalized = `${assetPath || ''}`.replace(/\\/g, '/').toLowerCase();
    if (!normalized) return false;
    if (normalized.includes('/concepts/')) return true;
    if (/_raw\.(png|jpg|jpeg|webp|svg|gif)$/.test(normalized)) return true;
    if (/_source\.(png|jpg|jpeg|webp|svg|gif)$/.test(normalized)) return true;
    if (/_export\.(png|jpg|jpeg|webp|svg|gif)$/.test(normalized)) return true;
    return false;
}

async function walkDirectoryFiles(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
        if (ASSET_SCAN_SKIP_DIR_NAMES.has(entry.name)) {
            continue;
        }
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            const nested = await walkDirectoryFiles(fullPath);
            out.push(...nested);
            continue;
        }
        out.push(fullPath);
    }
    return out;
}

function normalizeProjectRelativePath(filePath) {
    return path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
}

function normalizeAssetReferencePath(rawValue) {
    const normalized = `${rawValue || ''}`
        .trim()
        .replace(/^\/+/, '')
        .replace(/[?#].*$/, '')
        .replace(/\\/g, '/');
    return normalized.startsWith('assets/') ? normalized : '';
}

function sanitizeAssetDeletePath(rawValue) {
    const normalized = normalizeAssetReferencePath(rawValue);
    if (!normalized) {
        return '';
    }
    const extension = path.extname(normalized).toLowerCase();
    if (!IMAGE_ASSET_EXTENSIONS.has(extension)) {
        return '';
    }
    return normalized;
}

async function deleteUnusedAssetFile(assetPath) {
    const relativePath = sanitizeAssetDeletePath(assetPath);
    if (!relativePath) {
        throw new Error('invalid asset path');
    }
    const absolutePath = path.resolve(ROOT_DIR, relativePath);
    const assetsRoot = path.resolve(ROOT_DIR, 'assets');
    const normalizedAssetsRoot = `${assetsRoot}${path.sep}`;
    if (absolutePath !== assetsRoot && !absolutePath.startsWith(normalizedAssetsRoot)) {
        throw new Error('asset path outside assets directory');
    }
    await fs.unlink(absolutePath);
    await removeEmptyAssetDirs(path.dirname(absolutePath), assetsRoot);
}

async function removeEmptyAssetDirs(startDir, assetsRoot) {
    let currentDir = startDir;
    while (currentDir && currentDir !== assetsRoot) {
        const entries = await fs.readdir(currentDir).catch(() => []);
        if (entries.length > 0) {
            break;
        }
        await fs.rmdir(currentDir).catch(() => {});
        currentDir = path.dirname(currentDir);
    }
}

function sanitizeStringArray(value, { sanitize = (item) => `${item || ''}`.trim(), max = 200 } = {}) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const item of value) {
        const text = sanitize(item);
        if (!text) continue;
        out.push(text);
        if (out.length >= max) break;
    }
    return out;
}

function sanitizeAdminDevices(value, fallback = []) {
    const source = Array.isArray(value) ? value : fallback;
    return source
        .map((row) => {
            const item = isPlainObject(row) ? row : {};
            const deviceId = sanitizeDeviceId(item.deviceId);
            if (!deviceId) return null;
            return {
                deviceId,
                deviceInfo: sanitizeDeviceInfo(item.deviceInfo),
                firstSeenAt: sanitizeIsoDateTime(item.firstSeenAt, ''),
                lastSeenAt: sanitizeIsoDateTime(item.lastSeenAt, '')
            };
        })
        .filter(Boolean)
        .slice(0, 200);
}

function sanitizeCookieMismatchLogs(value, fallback = []) {
    const source = Array.isArray(value) ? value : fallback;
    return source
        .map((row) => {
            const item = isPlainObject(row) ? row : {};
            const userId = sanitizeUserId(item.userId);
            const cookieUserId = sanitizeUserId(item.cookieUserId);
            const at = sanitizeIsoDateTime(item.at, '');
            const deviceId = sanitizeDeviceId(item.deviceId);
            if (!userId && !cookieUserId && !at && !deviceId) return null;
            return {
                at,
                cookieUserId,
                userId,
                deviceId
            };
        })
        .filter(Boolean)
        .slice(0, 200);
}

function normalizeAdminUserPayload(body, existingUser = null) {
    const baseProgress = existingUser?.progress ?? buildDefaultProgress();
    const baseLiveopsPlayer = existingUser?.liveopsPlayer ?? buildDefaultLiveopsPlayerState();
    const userIdInput = sanitizeUserId(body?.userId || existingUser?.userId || '');
    const username = sanitizeUsername(body?.username ?? existingUser?.username ?? '');
    const isTempUser = body?.isTempUser === true || (body?.isTempUser !== false && existingUser?.isTempUser === true);
    const avatarUrl = `${body?.avatarUrl ?? existingUser?.avatarUrl ?? ''}`.trim().slice(0, 1000)
        || defaultAvatarByName(username || userIdInput || 'snake');
    const createdAt = sanitizeIsoDateTime(body?.createdAt, existingUser?.createdAt || nowIso());
    const lastActiveAt = sanitizeIsoDateTime(body?.lastActiveAt, existingUser?.lastActiveAt || createdAt || nowIso());
    const primaryDeviceId = sanitizeDeviceId(body?.primaryDeviceId ?? existingUser?.primaryDeviceId ?? '');
    const hardwareDeviceIds = sanitizeStringArray(
        body?.hardwareDeviceIds ?? existingUser?.hardwareDeviceIds ?? [],
        { sanitize: sanitizeDeviceId, max: 200 }
    );
    const devices = sanitizeAdminDevices(body?.devices, existingUser?.devices ?? []);
    const cookieDeviceMismatchLogs = sanitizeCookieMismatchLogs(
        body?.cookieDeviceMismatchLogs,
        existingUser?.cookieDeviceMismatchLogs ?? []
    );
    const progress = normalizeProgressFromPayload(body?.progress, baseProgress);
    const liveopsPlayer = normalizeLiveopsPlayerState(body?.liveopsPlayer, baseLiveopsPlayer);
    const unlockedSkinIds = collectUniqueSkinIds(body?.unlockedSkinIds ?? progress.unlockedSkinIds ?? existingUser?.unlockedSkinIds);
    const coins = Math.max(0, Math.floor(Number(body?.coins ?? progress.coins ?? existingUser?.coins) || 0));
    const maxUnlockedLevel = Math.max(1, Math.floor(Number(body?.maxUnlockedLevel ?? progress.maxUnlockedLevel ?? existingUser?.maxUnlockedLevel) || 1));
    const maxClearedLevel = Math.max(0, Math.floor(Number(body?.maxClearedLevel ?? progress.maxClearedLevel ?? existingUser?.maxClearedLevel) || 0));
    const passwordAlgorithm = `${body?.passwordAlgorithm ?? existingUser?.passwordAlgorithm ?? 'sha256-v1'}`.trim() || 'sha256-v1';
    const plainPassword = `${body?.plainPassword || ''}`;
    let passwordSalt = `${body?.passwordSalt ?? existingUser?.passwordSalt ?? ''}`.trim();
    let passwordHash = `${body?.passwordHash ?? existingUser?.passwordHash ?? ''}`.trim();
    if (plainPassword) {
        passwordSalt = crypto.randomBytes(12).toString('hex');
        passwordHash = hashPassword(plainPassword, passwordSalt, passwordAlgorithm);
    }
    const normalizedProgress = {
        ...progress,
        coins,
        maxUnlockedLevel,
        maxClearedLevel,
        unlockedSkinIds
    };
    return {
        userId: userIdInput,
        username,
        avatarUrl,
        isTempUser,
        passwordAlgorithm,
        passwordSalt,
        passwordHash,
        createdAt,
        lastActiveAt,
        primaryDeviceId,
        hardwareDeviceIds,
        devices,
        cookieDeviceMismatchLogs,
        progress: normalizedProgress,
        liveopsPlayer,
        coins,
        maxUnlockedLevel,
        maxClearedLevel,
        unlockedSkinIds
    };
}

function parseAdminDbUserId(pathname) {
    const match = `${pathname || ''}`.match(/^\/api\/admin\/db\/users\/([^/]+)$/);
    if (!match) return '';
    return sanitizeUserId(decodeURIComponent(match[1] || ''));
}

function parseAdminDbInitializePlayerUserId(pathname) {
    const match = `${pathname || ''}`.match(/^\/api\/admin\/db\/users\/([^/]+)\/initialize-player$/);
    if (!match) return '';
    return sanitizeUserId(decodeURIComponent(match[1] || ''));
}

async function handleAdminDbOverviewRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const overview = await userCenterStore.getOverview();
    sendJson(res, 200, {
        ok: true,
        backend: userCenterStoreMeta.backend,
        scalable: !!userCenterStoreMeta.scalable,
        ...overview
    });
}

async function handleAdminDbUsersRequest(req, res, requestUrl) {
    if (req.method === 'GET') {
        const limit = clampInt(requestUrl.searchParams.get('limit'), 1, 200, 50);
        const offset = clampInt(requestUrl.searchParams.get('offset'), 0, 500000, 0);
        const query = `${requestUrl.searchParams.get('q') || ''}`.trim();
        const [rows, total] = await Promise.all([
            userCenterStore.listUsers({ limit, offset, query }),
            userCenterStore.countUsers(query)
        ]);
        sendJson(res, 200, {
            ok: true,
            limit,
            offset,
            total,
            rows
        });
        return;
    }
    if (req.method === 'POST') {
        let body;
        try {
            body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
            return;
        }
        if (!isPlainObject(body)) {
            sendJson(res, 400, { ok: false, error: 'body must be an object' });
            return;
        }
        const isTempUser = body?.isTempUser === true;
        const normalized = normalizeAdminUserPayload(body, null);
        if (!normalized.username || normalized.username.length < 2) {
            sendJson(res, 400, { ok: false, error: 'username must be at least 2 chars' });
            return;
        }
        const duplicated = await userCenterStore.findUserByUsernameLower(normalized.username.toLowerCase());
        if (duplicated) {
            sendJson(res, 409, { ok: false, error: 'username already exists' });
            return;
        }
        let userId = normalized.userId;
        if (userId) {
            const existed = await userCenterStore.findUserById(userId);
            if (existed) {
                sendJson(res, 409, { ok: false, error: 'user id already exists' });
                return;
            }
        } else {
            const identity = await userCenterStore.allocateUserIdentity(isTempUser);
            userId = identity.userId;
        }
        const createdAt = normalized.createdAt || nowIso();
        const user = {
            ...normalized,
            userId,
            createdAt,
            lastActiveAt: normalized.lastActiveAt || createdAt
        };
        await userCenterStore.insertUser(user);
        sendJson(res, 200, { ok: true, user: toAdminSafeUserDetail(user) });
        return;
    }
    sendJson(res, 405, { ok: false, error: 'method not allowed' });
}

async function handleAdminDbUserDetailRequest(req, res, requestUrl) {
    const initializePlayerUserId = parseAdminDbInitializePlayerUserId(requestUrl.pathname);
    if (initializePlayerUserId) {
        if (req.method !== 'POST') {
            sendJson(res, 405, { ok: false, error: 'method not allowed' });
            return;
        }
        const user = await userCenterStore.findUserById(initializePlayerUserId);
        if (!user) {
            sendJson(res, 404, { ok: false, error: 'user not found' });
            return;
        }
        const progress = buildDefaultProgress();
        const liveopsPlayer = buildDefaultLiveopsPlayerState();
        const nextUser = {
            ...user,
            progress,
            liveopsPlayer,
            coins: progress.coins,
            maxUnlockedLevel: progress.maxUnlockedLevel,
            maxClearedLevel: progress.maxClearedLevel,
            unlockedSkinIds: collectUniqueSkinIds(progress.unlockedSkinIds)
        };
        await userCenterStore.updateUser(nextUser);
        sendJson(res, 200, { ok: true, user: toAdminSafeUserDetail(nextUser) });
        return;
    }
    const userId = parseAdminDbUserId(requestUrl.pathname);
    if (!userId) {
        sendJson(res, 400, { ok: false, error: 'invalid user id' });
        return;
    }
    const user = await userCenterStore.findUserById(userId);
    if (!user) {
        sendJson(res, 404, { ok: false, error: 'user not found' });
        return;
    }
    if (req.method === 'GET') {
        sendJson(res, 200, { ok: true, user: toAdminSafeUserDetail(user) });
        return;
    }
    if (req.method === 'PUT') {
        let body;
        try {
            body = await readRequestJson(req, MAX_JSON_BODY_BYTES);
        } catch (error) {
            sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
            return;
        }
        if (!isPlainObject(body)) {
            sendJson(res, 400, { ok: false, error: 'body must be an object' });
            return;
        }
        const normalized = normalizeAdminUserPayload(body, user);
        if (!normalized.username || normalized.username.length < 2) {
            sendJson(res, 400, { ok: false, error: 'username must be at least 2 chars' });
            return;
        }
        const duplicated = await userCenterStore.findUserByUsernameLower(normalized.username.toLowerCase());
        if (duplicated && sanitizeUserId(duplicated.userId) !== userId) {
            sendJson(res, 409, { ok: false, error: 'username already exists' });
            return;
        }
        const nextUser = {
            ...user,
            ...normalized,
            userId
        };
        await userCenterStore.updateUser(nextUser);
        sendJson(res, 200, { ok: true, user: toAdminSafeUserDetail(nextUser) });
        return;
    }
    if (req.method === 'DELETE') {
        await userCenterStore.deleteUser(userId);
        sendJson(res, 200, { ok: true, userId });
        return;
    }
    sendJson(res, 405, { ok: false, error: 'method not allowed' });
}

async function handleSfxProvidersRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    sendJson(res, 200, {
        ok: true,
        providers: {
            freesound: !!FREESOUND_API_KEY,
            stableAudioOpen: !!FAL_KEY || !!HF_API_TOKEN,
            stableAudioFal: !!FAL_KEY,
            stableAudioHf: !!HF_API_TOKEN,
            stableAudioBackend: FAL_KEY ? 'fal' : (HF_API_TOKEN ? 'hf' : '')
        },
        model: FAL_KEY ? FAL_STABLE_AUDIO_MODEL : HF_STABLE_AUDIO_MODEL
    });
}

function isAllowedFreesoundProxyHost(hostname) {
    const host = `${hostname || ''}`.trim().toLowerCase();
    if (!host) return false;
    if (ALLOWED_FREESOUND_PROXY_HOSTS.includes(host)) return true;
    return host.endsWith('.freesound.org');
}

function normalizeFreesoundLicense(rawLicense) {
    const text = `${rawLicense || ''}`.toLowerCase();
    if (text.includes('zero') || text.includes('/zero/')) return 'cc0';
    if (text.includes('/by-nc/') || text.includes('noncommercial')) return 'cc-by-nc';
    if (text.includes('/by/')) return 'cc-by';
    if (text.includes('attribution')) return 'cc-by';
    return 'unknown';
}

function isFreesoundLicenseMatched(rawLicense, filter) {
    const normalized = normalizeFreesoundLicense(rawLicense);
    const mode = `${filter || 'all'}`.trim().toLowerCase();
    if (!mode || mode === 'all') return true;
    if (mode === 'cc0') return normalized === 'cc0';
    if (mode === 'cc-by') return normalized === 'cc-by';
    if (mode === 'exclude-nc') return normalized !== 'cc-by-nc';
    return true;
}

async function handleSfxFreesoundSearchRequest(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    if (!FREESOUND_API_KEY) {
        sendJson(res, 400, {
            ok: false,
            error: 'Missing FREESOUND_API_KEY in current server environment.'
        });
        return;
    }

    const query = `${requestUrl.searchParams.get('q') || ''}`.trim();
    if (!query) {
        sendJson(res, 400, { ok: false, error: 'query is required' });
        return;
    }
    const page = clampInt(requestUrl.searchParams.get('page'), 1, 50, 1);
    const pageSize = clampInt(requestUrl.searchParams.get('page_size'), 1, 40, 12);
    const licenseFilter = `${requestUrl.searchParams.get('license') || 'all'}`.trim().toLowerCase();

    const fsUrl = new URL('https://freesound.org/apiv2/search/text/');
    fsUrl.searchParams.set('token', FREESOUND_API_KEY);
    fsUrl.searchParams.set('query', query);
    fsUrl.searchParams.set('page', `${page}`);
    fsUrl.searchParams.set('page_size', `${pageSize}`);
    fsUrl.searchParams.set('fields', 'id,name,username,duration,license,previews,url');

    let response;
    try {
        response = await fetch(fsUrl.toString(), { method: 'GET' });
    } catch (error) {
        sendJson(res, 502, { ok: false, error: error?.message || 'freesound request failed' });
        return;
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        sendJson(res, response.status, {
            ok: false,
            error: `freesound request failed (${response.status})`,
            detail: errorText.slice(0, 500)
        });
        return;
    }

    const payload = await response.json().catch(() => ({}));
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    const mapped = rows
        .map((row) => {
            const preview = row?.previews?.['preview-hq-mp3']
                || row?.previews?.['preview-lq-mp3']
                || row?.previews?.['preview-hq-ogg']
                || row?.previews?.['preview-lq-ogg']
                || '';
            return {
                id: Number(row?.id) || 0,
                name: `${row?.name || ''}`.trim() || `sound-${row?.id || 'unknown'}`,
                user: `${row?.username || ''}`.trim(),
                duration: clampFloat(row?.duration, 0, 600, 0),
                license: `${row?.license || ''}`.trim(),
                licenseTag: normalizeFreesoundLicense(row?.license),
                previewUrl: preview,
                pageUrl: `${row?.url || ''}`.trim()
            };
        })
        .filter((row) => row.id > 0 && row.previewUrl)
        .filter((row) => isFreesoundLicenseMatched(row.license, licenseFilter));

    sendJson(res, 200, {
        ok: true,
        query,
        licenseFilter,
        page,
        pageSize,
        totalCount: Number(payload?.count) || mapped.length,
        results: mapped
    });
}

async function handleSfxFreesoundProxyRequest(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const target = `${requestUrl.searchParams.get('url') || ''}`.trim();
    if (!target) {
        sendJson(res, 400, { ok: false, error: 'url is required' });
        return;
    }
    let parsed;
    try {
        parsed = new URL(target);
    } catch {
        sendJson(res, 400, { ok: false, error: 'invalid url' });
        return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        sendJson(res, 400, { ok: false, error: 'unsupported protocol' });
        return;
    }
    if (!isAllowedFreesoundProxyHost(parsed.hostname)) {
        sendJson(res, 403, { ok: false, error: 'url host is not allowed' });
        return;
    }

    let response;
    try {
        const fetchHeaders = {};
        if (typeof req.headers.range === 'string' && req.headers.range.trim()) {
            fetchHeaders.range = req.headers.range.trim();
        }
        response = await fetch(parsed.toString(), {
            method: 'GET',
            headers: fetchHeaders
        });
    } catch (error) {
        sendJson(res, 502, { ok: false, error: error?.message || 'proxy request failed' });
        return;
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        sendJson(res, response.status, {
            ok: false,
            error: `remote audio fetch failed (${response.status})`,
            detail: errorText.slice(0, 500)
        });
        return;
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const contentLength = response.headers.get('content-length') || '';
    const contentRange = response.headers.get('content-range') || '';
    const acceptRanges = response.headers.get('accept-ranges') || '';
    res.writeHead(response.status, {
        ...buildSecurityHeaders(),
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        ...(contentRange ? { 'Content-Range': contentRange } : {}),
        ...(acceptRanges ? { 'Accept-Ranges': acceptRanges } : {}),
        'Cache-Control': 'no-store'
    });

    if (!response.body || typeof response.body.getReader !== 'function') {
        const arrayBuffer = await response.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
        return;
    }

    const reader = response.body.getReader();
    const handleClientClose = () => {
        void reader.cancel().catch(() => {});
    };
    req.on('close', handleClientClose);

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.byteLength > 0) {
                res.write(Buffer.from(value));
            }
        }
        res.end();
    } catch (error) {
        if (!res.writableEnded) {
            res.destroy(error instanceof Error ? error : new Error('proxy stream failed'));
        }
    } finally {
        req.off('close', handleClientClose);
        reader.releaseLock?.();
    }
}

function decodeAudioBufferFromPayload(payload) {
    if (!payload) return null;
    if (typeof payload === 'string') {
        const normalized = payload.replace(/^data:audio\/[^;]+;base64,/, '').trim();
        if (normalized && /^[A-Za-z0-9+/=\r\n]+$/.test(normalized)) {
            return Buffer.from(normalized, 'base64');
        }
        return null;
    }
    if (Array.isArray(payload)) {
        for (const row of payload) {
            const maybe = decodeAudioBufferFromPayload(row);
            if (maybe && maybe.length > 0) return maybe;
        }
        return null;
    }
    if (isPlainObject(payload)) {
        const keys = ['audio', 'audio_base64', 'generated_audio', 'data'];
        for (const key of keys) {
            const maybe = decodeAudioBufferFromPayload(payload[key]);
            if (maybe && maybe.length > 0) return maybe;
        }
    }
    return null;
}

function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyAudioUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return false;
    const text = rawUrl.trim();
    if (!text) return false;
    try {
        const parsed = new URL(text);
        const pathname = (parsed.pathname || '').toLowerCase();
        if (pathname.endsWith('.wav') || pathname.endsWith('.mp3') || pathname.endsWith('.ogg') || pathname.endsWith('.flac')) {
            return true;
        }
        if (parsed.hostname.toLowerCase().endsWith('fal.media')) {
            return true;
        }
        if (parsed.search.toLowerCase().includes('audio')) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

function extractFalAudioUrl(payload) {
    if (!payload) return '';
    if (typeof payload === 'string') {
        return isLikelyAudioUrl(payload) ? payload : '';
    }
    if (Array.isArray(payload)) {
        for (const row of payload) {
            const found = extractFalAudioUrl(row);
            if (found) return found;
        }
        return '';
    }
    if (!isPlainObject(payload)) return '';

    const directCandidates = [
        payload?.audio_file?.url,
        payload?.audio?.url,
        payload?.file?.url,
        payload?.result?.audio_file?.url,
        payload?.result?.audio?.url,
        payload?.output?.audio_file?.url,
        payload?.output?.audio?.url
    ];
    for (const maybe of directCandidates) {
        if (isLikelyAudioUrl(maybe)) return maybe;
    }

    const queue = [payload];
    const seen = new Set();
    while (queue.length > 0) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        if (seen.has(node)) continue;
        seen.add(node);
        if (typeof node.url === 'string' && isLikelyAudioUrl(node.url)) {
            return node.url;
        }
        if (Array.isArray(node)) {
            for (const row of node) queue.push(row);
            continue;
        }
        for (const value of Object.values(node)) {
            if (value && typeof value === 'object') queue.push(value);
        }
    }
    return '';
}

async function requestFalStableAudio(prompt, durationSeconds, seed) {
    const queueEndpoint = `https://queue.fal.run/${FAL_STABLE_AUDIO_MODEL}`;
    let kickoffResponse;
    try {
        kickoffResponse = await fetch(queueEndpoint, {
            method: 'POST',
            headers: {
                Authorization: `Key ${FAL_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt,
                seconds_total: durationSeconds,
                steps: 40,
                seed
            })
        });
    } catch (error) {
        throw new Error(error?.message || 'fal queue request failed');
    }

    if (!kickoffResponse.ok) {
        const text = await kickoffResponse.text().catch(() => '');
        throw new Error(`fal queue request failed (${kickoffResponse.status}) ${text.slice(0, 400)}`.trim());
    }

    const kickoffPayload = await kickoffResponse.json().catch(() => ({}));
    const statusUrl = `${kickoffPayload?.status_url || ''}`.trim();
    const responseUrl = `${kickoffPayload?.response_url || ''}`.trim();
    if (!statusUrl || !responseUrl) {
        throw new Error('fal queue response missing status_url/response_url');
    }

    const maxPollCount = 100;
    const pollIntervalMs = 1200;
    let finalStatus = '';
    for (let poll = 0; poll < maxPollCount; poll += 1) {
        let statusResponse;
        try {
            statusResponse = await fetch(statusUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Key ${FAL_KEY}`
                }
            });
        } catch (error) {
            throw new Error(error?.message || 'fal status request failed');
        }
        if (!statusResponse.ok) {
            const text = await statusResponse.text().catch(() => '');
            throw new Error(`fal status request failed (${statusResponse.status}) ${text.slice(0, 300)}`.trim());
        }
        const statusPayload = await statusResponse.json().catch(() => ({}));
        finalStatus = `${statusPayload?.status || ''}`.trim().toUpperCase();
        if (finalStatus === 'COMPLETED') break;
        if (finalStatus === 'FAILED' || finalStatus === 'CANCELED' || finalStatus === 'CANCELLED') {
            throw new Error(`fal job ${finalStatus.toLowerCase()}`);
        }
        await waitMs(pollIntervalMs);
    }
    if (finalStatus !== 'COMPLETED') {
        throw new Error('fal job timed out');
    }

    let outputResponse;
    try {
        outputResponse = await fetch(responseUrl, {
            method: 'GET',
            headers: {
                Authorization: `Key ${FAL_KEY}`
            }
        });
    } catch (error) {
        throw new Error(error?.message || 'fal output request failed');
    }
    if (!outputResponse.ok) {
        const text = await outputResponse.text().catch(() => '');
        throw new Error(`fal output request failed (${outputResponse.status}) ${text.slice(0, 300)}`.trim());
    }
    const outputPayload = await outputResponse.json().catch(() => ({}));
    const audioUrl = extractFalAudioUrl(outputPayload);
    if (!audioUrl) {
        throw new Error('fal output missing audio url');
    }

    let audioResponse;
    try {
        audioResponse = await fetch(audioUrl, { method: 'GET' });
        if (!audioResponse.ok) {
            audioResponse = await fetch(audioUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Key ${FAL_KEY}`
                }
            });
        }
    } catch (error) {
        throw new Error(error?.message || 'fal audio download failed');
    }
    if (!audioResponse.ok) {
        const text = await audioResponse.text().catch(() => '');
        throw new Error(`fal audio download failed (${audioResponse.status}) ${text.slice(0, 300)}`.trim());
    }

    const bytes = Buffer.from(await audioResponse.arrayBuffer());
    if (!bytes || bytes.length <= 0) {
        throw new Error('fal audio download returned empty body');
    }
    const contentType = audioResponse.headers.get('content-type') || 'audio/wav';
    return {
        bytes,
        contentType: contentType.startsWith('audio/') ? contentType : 'audio/wav'
    };
}

async function handleSfxStableAudioGenerateRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    if (!FAL_KEY && !HF_API_TOKEN) {
        sendJson(res, 400, {
            ok: false,
            error: 'Missing FAL_KEY and HUGGINGFACE_API_TOKEN/HF_TOKEN in current server environment.'
        });
        return;
    }

    let body;
    try {
        body = await readRequestJson(req, MAX_SFX_BODY_BYTES);
    } catch (error) {
        sendJson(res, 400, { ok: false, error: error?.message || 'invalid json body' });
        return;
    }
    const prompt = `${body?.prompt || ''}`.trim();
    if (!prompt) {
        sendJson(res, 400, { ok: false, error: 'prompt is required' });
        return;
    }
    const durationSeconds = clampFloat(body?.durationSeconds, 1, 10, 2);
    const seed = clampInt(body?.seed, 0, 2_147_483_647, Date.now() % 2_147_483_647);

    if (FAL_KEY) {
        try {
            const falResult = await requestFalStableAudio(prompt, durationSeconds, seed);
            res.writeHead(200, {
                ...buildSecurityHeaders(),
                'Content-Type': falResult.contentType,
                'Cache-Control': 'no-store'
            });
            res.end(falResult.bytes);
            return;
        } catch (error) {
            sendJson(res, 502, {
                ok: false,
                error: 'stable-audio request failed via fal.ai',
                detail: `${error?.message || 'unknown fal error'}`.slice(0, 800)
            });
            return;
        }
    }

    const endpoint = `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(HF_STABLE_AUDIO_MODEL)}`;
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${HF_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    duration: durationSeconds,
                    seed
                }
            })
        });
    } catch (error) {
        sendJson(res, 502, { ok: false, error: error?.message || 'stable-audio request failed' });
        return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const detailText = errorText.slice(0, 800);
        if (response.status === 404) {
            sendJson(res, 404, {
                ok: false,
                error: `stable-audio model is not available on Hugging Face Inference Providers (${HF_STABLE_AUDIO_MODEL})`,
                detail: detailText || 'Model not deployed for this task/provider. Try Freesound/upload/synth, or switch to another backend.'
            });
            return;
        }
        sendJson(res, response.status, {
            ok: false,
            error: `stable-audio request failed (${response.status})`,
            detail: detailText
        });
        return;
    }

    if (contentType.startsWith('audio/')) {
        const bytes = Buffer.from(await response.arrayBuffer());
        res.writeHead(200, {
            ...buildSecurityHeaders(),
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
        });
        res.end(bytes);
        return;
    }

    const payload = await response.json().catch(() => ({}));
    const audioBuffer = decodeAudioBufferFromPayload(payload);
    if (!audioBuffer || audioBuffer.length <= 0) {
        sendJson(res, 502, {
            ok: false,
            error: 'stable-audio response did not contain audio data'
        });
        return;
    }
    res.writeHead(200, {
        ...buildSecurityHeaders(),
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store'
    });
    res.end(audioBuffer);
}

async function handleBgmListRequest(req, res) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }

    const bgmDir = path.join(ROOT_DIR, 'assets', 'audio', 'bgm');
    const entries = await fs.readdir(bgmDir, { withFileTypes: true }).catch(() => []);
    const tracks = [];
    for (const entry of entries) {
        if (!entry?.isFile?.()) {
            continue;
        }
        const ext = path.extname(entry.name || '').toLowerCase();
        if (!['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'].includes(ext)) {
            continue;
        }
        const filePath = path.join(bgmDir, entry.name);
        const stat = await fs.stat(filePath).catch(() => null);
        const baseName = path.basename(entry.name, ext);
        tracks.push({
            fileName: entry.name,
            name: baseName,
            url: `/assets/audio/bgm/${entry.name}`,
            sizeBytes: stat?.isFile?.() ? stat.size : 0,
            mimeType: MIME_TYPES[ext] || detectAudioMimeTypeByExtension(ext)
        });
    }
    tracks.sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh-Hans-CN'));
    sendJson(res, 200, { ok: true, tracks });
}

async function migrateLegacyAudioLibraryAssetsToAudioDir() {
    const legacyEntries = await fs.readdir(LEGACY_AUDIO_LIBRARY_ASSET_DIR, { withFileTypes: true }).catch(() => []);
    if (!Array.isArray(legacyEntries) || legacyEntries.length <= 0) {
        return;
    }
    let mirroredCount = 0;
    for (const entry of legacyEntries) {
        if (!entry?.isFile?.()) {
            continue;
        }
        const fromPath = path.join(LEGACY_AUDIO_LIBRARY_ASSET_DIR, entry.name);
        const toPath = path.join(AUDIO_LIBRARY_ASSET_DIR, entry.name);
        const hasTarget = await fs.access(toPath).then(() => true).catch(() => false);
        if (hasTarget) {
            continue;
        }
        try {
            await fs.copyFile(fromPath, toPath);
            mirroredCount += 1;
        } catch {
            // keep legacy file when mirror fails
        }
    }
    if (mirroredCount > 0) {
        console.log(`Mirrored ${mirroredCount} legacy audio assets to ${AUDIO_LIBRARY_ASSET_DIR}`);
    }
}

async function migrateAudioLibraryAssetUrlsToAudioDir() {
    const filePath = path.join(DATA_DIR, 'audio-library-v1.json');
    const doc = await readJsonFile(filePath, null);
    if (!doc || !Array.isArray(doc.items)) {
        return;
    }
    let changed = 0;
    for (const item of doc.items) {
        if (!item || typeof item !== 'object' || !item.sample || typeof item.sample !== 'object') {
            continue;
        }
        const rawUrl = `${item.sample.url || ''}`.trim();
        if (!rawUrl) {
            continue;
        }
        const lower = rawUrl.toLowerCase();
        const isLegacy = lower.startsWith('/.local-data/audio-library-assets/')
            || lower.startsWith('.local-data/audio-library-assets/');
        if (!isLegacy) {
            continue;
        }
        const fileName = path.basename(rawUrl.split('?')[0] || '');
        if (!fileName) {
            continue;
        }
        item.sample.url = `/assets/audio/sfx/${fileName}`;
        changed += 1;
    }
    if (changed > 0) {
        await writeJsonAtomic(filePath, doc);
        console.log(`Rewrote ${changed} legacy audio-library sample URLs to /assets/audio/sfx`);
    }
}

async function serveStaticFile(req, res, pathname) {
    let requestedPath = pathname === '/' ? '/index.html' : pathname;
    requestedPath = decodeURIComponent(requestedPath);

    const absPath = path.resolve(ROOT_DIR, `.${requestedPath}`);
    const relPath = path.relative(ROOT_DIR, absPath);
    if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
        sendText(res, 403, 'Forbidden');
        return;
    }

    let stat;
    try {
        stat = await fs.stat(absPath);
    } catch {
        sendText(res, 404, 'Not Found');
        return;
    }

    let filePath = absPath;
    if (stat.isDirectory()) {
        filePath = path.join(absPath, 'index.html');
        try {
            await fs.access(filePath);
        } catch {
            sendText(res, 404, 'Not Found');
            return;
        }
    }

    let fileStat;
    try {
        fileStat = await fs.stat(filePath);
    } catch {
        sendText(res, 404, 'Not Found');
        return;
    }
    const totalSize = Math.max(0, Number(fileStat.size) || 0);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const rangeHeader = typeof req?.headers?.range === 'string' ? req.headers.range.trim() : '';

    const writeCommonHeaders = (extra = {}) => ({
        ...buildSecurityHeaders(),
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'bytes',
        ...extra
    });

    let stream;
    if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader);
        if (!match) {
            res.writeHead(416, writeCommonHeaders({ 'Content-Range': `bytes */${totalSize}` }));
            res.end();
            return;
        }
        const startRaw = match[1];
        const endRaw = match[2];
        let start = 0;
        let end = Math.max(0, totalSize - 1);
        if (!startRaw && !endRaw) {
            res.writeHead(416, writeCommonHeaders({ 'Content-Range': `bytes */${totalSize}` }));
            res.end();
            return;
        }
        if (!startRaw) {
            const suffixLength = Number.parseInt(endRaw, 10);
            if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
                res.writeHead(416, writeCommonHeaders({ 'Content-Range': `bytes */${totalSize}` }));
                res.end();
                return;
            }
            start = Math.max(0, totalSize - suffixLength);
            end = Math.max(0, totalSize - 1);
        } else {
            start = Number.parseInt(startRaw, 10);
            end = endRaw ? Number.parseInt(endRaw, 10) : Math.max(0, totalSize - 1);
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= totalSize) {
            res.writeHead(416, writeCommonHeaders({ 'Content-Range': `bytes */${totalSize}` }));
            res.end();
            return;
        }
        end = Math.min(end, Math.max(0, totalSize - 1));
        const chunkSize = end - start + 1;
        res.writeHead(206, writeCommonHeaders({
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`
        }));
        if (req?.method === 'HEAD') {
            res.end();
            return;
        }
        stream = createReadStream(filePath, { start, end });
    } else {
        res.writeHead(200, writeCommonHeaders({ 'Content-Length': String(totalSize) }));
        if (req?.method === 'HEAD') {
            res.end();
            return;
        }
        stream = createReadStream(filePath);
    }

    stream.on('error', () => {
        if (!res.headersSent) {
            sendText(res, 500, 'Read file failed');
        } else {
            res.destroy();
        }
    });
    stream.pipe(res);
}

async function readJsonFile(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return isPlainObject(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

async function writeJsonAtomic(filePath, payload) {
    const previousWrite = pendingJsonWriteByPath.get(filePath) || Promise.resolve();
    const nextWrite = previousWrite
        .catch(() => {})
        .then(async () => {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
            const raw = `${JSON.stringify(payload, null, 2)}\n`;
            try {
                await fs.writeFile(tempPath, raw, 'utf8');
                try {
                    await fs.rename(tempPath, filePath);
                } catch (error) {
                    // On Windows, replacing an existing file via rename can intermittently fail with EPERM.
                    // Fallback to direct write to keep storage API stable.
                    if (!isRecoverableWindowsRenameError(error)) {
                        throw error;
                    }
                    await fs.writeFile(filePath, raw, 'utf8');
                }
            } finally {
                await fs.rm(tempPath, { force: true }).catch(() => {});
            }
        });
    pendingJsonWriteByPath.set(filePath, nextWrite);
    try {
        await nextWrite;
    } finally {
        if (pendingJsonWriteByPath.get(filePath) === nextWrite) {
            pendingJsonWriteByPath.delete(filePath);
        }
    }
}

function isRecoverableWindowsRenameError(error) {
    const code = `${error?.code || ''}`.trim().toUpperCase();
    return code === 'EPERM' || code === 'EEXIST' || code === 'ENOTEMPTY' || code === 'EBUSY';
}

async function readRequestJson(req, maxBytes = MAX_JSON_BODY_BYTES) {
    const buffer = await readRequestBuffer(req, maxBytes);
    const bodyText = buffer.toString('utf8').trim();
    if (!bodyText) {
        return {};
    }
    return JSON.parse(bodyText);
}

async function readRequestBuffer(req, maxBytes = MAX_JSON_BODY_BYTES) {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) {
            throw new Error('request body too large');
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function decodeImageDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
        throw new Error('image data url is required');
    }
    const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) {
        throw new Error('invalid image data url format');
    }
    const mime = match[1].toLowerCase();
    if (!MIME_TO_EXTENSION[mime]) {
        throw new Error(`unsupported image mime type: ${mime}`);
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) {
        throw new Error('empty image data');
    }
    return {
        mime,
        ext: MIME_TO_EXTENSION[mime],
        buffer
    };
}

async function normalizeTemplateMap(rawMap) {
    const output = {};
    for (const partName of ALLOWED_PART_NAMES) {
        const rawPath = typeof rawMap[partName] === 'string' ? rawMap[partName].trim() : '';
        if (!rawPath) {
            throw new Error(`templateMap missing value for ${partName}`);
        }
        const resolved = resolvePathInsideRoot(rawPath);
        try {
            const stat = await fs.stat(resolved);
            if (!stat.isFile()) {
                throw new Error('not a file');
            }
        } catch {
            throw new Error(`template part not found: ${rawPath}`);
        }
        output[partName] = resolved;
    }
    return output;
}

function resolvePathInsideRoot(rawPath) {
    const cleaned = `${rawPath || ''}`.trim().split('?')[0].replace(/\\/g, '/');
    if (!cleaned) {
        throw new Error('empty path');
    }
    const hasDrivePrefix = /^[a-zA-Z]:\//.test(cleaned);
    const isUncPath = cleaned.startsWith('//');
    const abs = (hasDrivePrefix || isUncPath)
        ? path.resolve(cleaned)
        : path.resolve(ROOT_DIR, cleaned.replace(/^\/+/, ''));
    const rel = path.relative(ROOT_DIR, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`path outside project root: ${rawPath}`);
    }
    return abs;
}

function toWebPath(absPath) {
    if (!absPath) return null;
    try {
        const resolved = path.resolve(absPath);
        const rel = path.relative(ROOT_DIR, resolved);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            return null;
        }
        return `/${rel.replace(/\\/g, '/')}`;
    } catch {
        return null;
    }
}

function sanitizeSlug(value, fallback) {
    const normalized = `${value || ''}`
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function normalizeSolidHexColor(rawValue) {
    const text = `${rawValue || ''}`.trim();
    const candidate = text.startsWith('#') ? text : `#${text}`;
    return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : '#00ff00';
}

function sanitizeSkinDisplayName(rawValue) {
    const value = `${rawValue || ''}`.replace(/\s+/g, ' ').trim();
    return value.slice(0, 24);
}

function clampInt(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clampFloat(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}

function normalizeSkinColorVariantsForContext(rawVariants, fallbackVariants = []) {
    const source = Array.isArray(rawVariants) ? rawVariants : (Array.isArray(fallbackVariants) ? fallbackVariants : []);
    const out = [];
    for (let index = 0; index < source.length; index += 1) {
        const row = source[index];
        if (!isPlainObject(row)) {
            continue;
        }
        const id = sanitizeSlug(row.id, `variant-${index + 1}`);
        out.push({
            id,
            hueShift: clampFloat(row.hueShift, -360, 360, 0),
            saturation: clampFloat(row.saturation, 0.6, 2.2, 1),
            lightness: clampFloat(row.lightness, 0.7, 1.3, 1),
            contrast: clampFloat(row.contrast, 0.8, 1.4, 1)
        });
        if (out.length >= 32) {
            break;
        }
    }
    return out;
}

function stripFileExt(fileName) {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function normalizeCustomPromptMap(rawMap) {
    const output = {};
    for (const partName of ALLOWED_PART_NAMES) {
        const value = typeof rawMap?.[partName] === 'string' ? rawMap[partName].trim() : '';
        if (!value) {
            continue;
        }
        output[partName] = value.slice(0, 20000);
    }
    return output;
}

async function listSkinDirectoryIds() {
    const skinsRoot = path.join(ROOT_DIR, 'assets', 'skins');
    const entries = await fs.readdir(skinsRoot, { withFileTypes: true }).catch(() => []);
    const ids = [];
    for (const entry of entries) {
        if (!entry?.isDirectory?.()) continue;
        const id = sanitizeSlug(entry.name, '');
        if (id) ids.push(id);
    }
    return ids;
}

function ensureUniqueSkinId(baseId, reservedSkinIds) {
    const base = sanitizeSlug(baseId, 'generated-skin');
    if (!reservedSkinIds.has(base)) {
        return base;
    }
    let seq = 2;
    while (reservedSkinIds.has(`${base}-${seq}`)) {
        seq += 1;
    }
    return `${base}-${seq}`;
}

function extractGeminiText(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        for (const part of parts) {
            if (typeof part?.text === 'string' && part.text.trim()) {
                return part.text.trim();
            }
        }
    }
    return '';
}

function parseJsonObjectFromText(text) {
    const raw = `${text || ''}`.trim();
    if (!raw) return null;
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const firstCandidate = fencedMatch ? fencedMatch[1].trim() : raw;
    try {
        const parsed = JSON.parse(firstCandidate);
        return isPlainObject(parsed) ? parsed : null;
    } catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                const parsed = JSON.parse(raw.slice(start, end + 1));
                return isPlainObject(parsed) ? parsed : null;
            } catch {
                return null;
            }
        }
        return null;
    }
}

async function suggestSkinIdentity({
    apiKey,
    model,
    templateSkinId,
    globalNote,
    promptExtra,
    batchIndex,
    batchCount,
    styleImage,
    reservedSkinIds
}) {
    const fallbackId = ensureUniqueSkinId(
        `generated-${Date.now().toString(36)}-${batchIndex + 1}`,
        reservedSkinIds
    );
    const fallbackName = sanitizeSkinDisplayName(`AI鐨偆${batchIndex + 1}`) || `AI鐨偆${batchIndex + 1}`;
    if (!apiKey || typeof fetch !== 'function') {
        return { skinId: fallbackId, skinNameZh: fallbackName };
    }

    const promptLines = [
        'Generate one snake skin identity for a 2D mobile puzzle game.',
        'Return strict JSON only with keys: skinId, skinNameZh.',
        'skinId must be lowercase letters/numbers/hyphen/underscore only, 6-24 chars.',
        'skinNameZh must be concise Chinese name, 4-12 chars, no punctuation.',
        `Template skin id: ${templateSkinId}`,
        `Batch: ${batchIndex + 1}/${batchCount}`,
        `Global note: ${globalNote || 'none'}`,
        `Extra prompt: ${promptExtra || 'none'}`
    ];

    const parts = [{ text: promptLines.join('\n') }];
    if (styleImage?.buffer && styleImage?.mime) {
        parts.push({
            inline_data: {
                mime_type: styleImage.mime,
                data: styleImage.buffer.toString('base64')
            }
        });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        temperature: 0.8,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );
        if (!response.ok) {
            throw new Error(`identity model request failed (${response.status})`);
        }
        const payload = await response.json().catch(() => ({}));
        const text = extractGeminiText(payload);
        const parsed = parseJsonObjectFromText(text);
        const skinId = sanitizeSlug(parsed?.skinId, fallbackId);
        const skinNameZh = sanitizeSkinDisplayName(parsed?.skinNameZh) || fallbackName;
        return {
            skinId: ensureUniqueSkinId(skinId, reservedSkinIds),
            skinNameZh
        };
    } catch {
        return { skinId: fallbackId, skinNameZh: fallbackName };
    }
}

function runProcess(command, args, cwd) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd,
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let logs = '';
        const append = (chunk) => {
            if (!chunk) return;
            logs += chunk.toString();
            if (logs.length > 200_000) {
                logs = logs.slice(-200_000);
            }
        };

        child.stdout.on('data', append);
        child.stderr.on('data', append);
        child.on('error', (error) => {
            append(`\n[spawn-error] ${error?.message || error}\n`);
            resolve({ code: -1, logs });
        });
        child.on('close', (code) => {
            resolve({ code: Number(code || 0), logs });
        });
    });
}

function parseCsvList(value) {
    return `${value || ''}`
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function applyApiCorsHeaders(req, res) {
    const origin = `${req?.headers?.origin || ''}`.trim();
    if (!origin || !isCorsOriginAllowed(origin)) {
        return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Key,X-Admin-Api-Key');
    res.setHeader('Access-Control-Max-Age', '86400');
}

function isCorsOriginAllowed(origin) {
    if (CORS_ALLOWED_ORIGINS.includes('*')) {
        return true;
    }
    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
        return true;
    }
    if (!CORS_ALLOW_TRYCLOUDFLARE) {
        return false;
    }
    try {
        const parsed = new URL(origin);
        return parsed.protocol === 'https:' && parsed.hostname.endsWith('.trycloudflare.com');
    } catch {
        return false;
    }
}

function sendJson(res, statusCode, payload) {
    const text = JSON.stringify(payload);
    res.writeHead(statusCode, {
        ...buildSecurityHeaders(),
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(text);
}

function sendText(res, statusCode, text) {
    res.writeHead(statusCode, {
        ...buildSecurityHeaders(),
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(text);
}

function buildSecurityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
}

function readIncomingAdminKey(req, requestUrl) {
    const headerKey = `${req?.headers?.['x-admin-key'] || ''}`.trim();
    if (headerKey) return headerKey;
    const queryKey = `${requestUrl?.searchParams?.get('adminKey') || ''}`.trim();
    if (queryKey) return queryKey;
    return '';
}

function requireAdminAuth(req, res, requestUrl) {
    const needsAuth = ADMIN_REQUIRE_KEY || !!ADMIN_API_KEY;
    if (!needsAuth) {
        return true;
    }
    const incoming = readIncomingAdminKey(req, requestUrl);
    if (!incoming || incoming !== ADMIN_API_KEY) {
        sendJson(res, 401, { ok: false, error: 'admin auth required' });
        return false;
    }
    return true;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

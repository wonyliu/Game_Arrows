import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { createUserCenterStore } from './user-center-store.mjs';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, '.local-data');
const SKIN_GEN_DIR = path.join(DATA_DIR, 'skin-gen');
const SKIN_GEN_NAME_MAP_PATH = path.join(SKIN_GEN_DIR, 'skin-name-map.json');
const SKIN_GEN_CONTEXTS_DIR = path.join(SKIN_GEN_DIR, 'skin-contexts');
const USER_CENTER_DB_PATH = path.join(DATA_DIR, 'user-center-db-v1.json');
const USER_CENTER_BACKEND = `${process.env.USER_CENTER_BACKEND || 'json'}`.trim().toLowerCase();
const USER_CENTER_DATABASE_URL = `${process.env.USER_CENTER_DATABASE_URL || process.env.DATABASE_URL || ''}`.trim();
const USER_CENTER_REQUIRE_SCALABLE_DB = `${process.env.USER_CENTER_REQUIRE_SCALABLE_DB || ''}`.trim() === '1';
const ADMIN_API_KEY = `${process.env.ADMIN_API_KEY || ''}`.trim();
const ADMIN_REQUIRE_KEY = `${process.env.ADMIN_REQUIRE_KEY || ''}`.trim() === '1';
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || process.argv[2] || 4173);
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

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(SKIN_GEN_DIR, { recursive: true });
await fs.mkdir(SKIN_GEN_CONTEXTS_DIR, { recursive: true });

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
        if (requestUrl.pathname === '/api/admin/reset-leaderboard-progress') {
            if (!requireAdminAuth(req, res, requestUrl)) return;
            await handleAdminResetLeaderboardProgressRequest(req, res);
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
        const hasGenerationContext = await hasSkinGenerationContext(skinId);

        skins.push({
            id: skinId,
            nameZh: typeof nameMap?.[skinId] === 'string' ? sanitizeSkinDisplayName(nameMap[skinId]) : '',
            partCount: partFiles.length,
            complete: partFiles.length === ALLOWED_PART_NAMES.length,
            protected: PROTECTED_SKIN_IDS.has(skinId),
            hasGenerationContext,
            preview: partFiles.includes('snake_head.png') ? `/assets/skins/${skinId}/snake_head.png` : null
        });
    }

    skins.sort((a, b) => a.id.localeCompare(b.id));
    sendJson(res, 200, { ok: true, skins });
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

    const filePath = path.join(DATA_DIR, `${key}.json`);

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
        rewardGuideShown: false
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
        rewardGuideShown
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
    const limit = clampInt(requestUrl.searchParams.get('limit'), 1, 200, 50);
    const rows = (await userCenterStore.listLeaderboard(limit))
        .map((row, index) => ({
            rank: index + 1,
            ...row,
            avatarUrl: `${row?.avatarUrl || ''}`.trim() || defaultAvatarByName(`${row?.userId || 'u'}`)
        }));
    sendJson(res, 200, { ok: true, rows });
}

async function handleAdminResetGameStateRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const resetUsers = await userCenterStore.resetGameStateForAllUsers();

    const resetPayload = {};
    await writeJsonAtomic(path.join(DATA_DIR, 'game-progress-v1.json'), resetPayload);
    await writeJsonAtomic(path.join(DATA_DIR, 'liveops-player-v1.json'), resetPayload);
    sendJson(res, 200, { ok: true, resetUsers });
}

async function handleAdminResetLeaderboardProgressRequest(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
    const resetUsers = await userCenterStore.resetLeaderboardProgressForAllUsers();
    sendJson(res, 200, { ok: true, resetUsers });
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
        passwordSaltMasked: user.passwordSalt ? '***' : '',
        passwordHashMasked: user.passwordHash ? '***' : ''
    };
}

function parseAdminDbUserId(pathname) {
    const match = `${pathname || ''}`.match(/^\/api\/admin\/db\/users\/([^/]+)$/);
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
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
    }
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
}

async function handleAdminDbUserDetailRequest(req, res, requestUrl) {
    if (req.method !== 'GET') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
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
    sendJson(res, 200, { ok: true, user: toAdminSafeUserDetail(user) });
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
        response = await fetch(parsed.toString(), { method: 'GET' });
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

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    res.writeHead(200, {
        ...buildSecurityHeaders(),
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
    });
    res.end(Buffer.from(arrayBuffer));
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
        const baseName = path.basename(entry.name, ext);
        tracks.push({
            fileName: entry.name,
            name: baseName,
            url: `/assets/audio/bgm/${entry.name}`
        });
    }
    tracks.sort((a, b) => a.fileName.localeCompare(b.fileName, 'zh-Hans-CN'));
    sendJson(res, 200, { ok: true, tracks });
}

async function serveStaticFile(_req, res, pathname) {
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

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
        ...buildSecurityHeaders(),
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
    });

    const stream = createReadStream(filePath);
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
    const tempPath = `${filePath}.tmp`;
    const raw = `${JSON.stringify(payload, null, 2)}\n`;
    await fs.writeFile(tempPath, raw, 'utf8');
    await fs.rename(tempPath, filePath);
}

async function readRequestJson(req, maxBytes = MAX_JSON_BODY_BYTES) {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) {
            throw new Error('request body too large');
        }
        chunks.push(chunk);
    }

    const bodyText = Buffer.concat(chunks).toString('utf8').trim();
    if (!bodyText) {
        return {};
    }
    return JSON.parse(bodyText);
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


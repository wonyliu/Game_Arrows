import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, 'temp', 'design-v5', 'raw');
const RAW_MANIFEST_PATH = path.join(RAW_DIR, 'raw-manifest.json');
const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const argv = process.argv.slice(2);
const args = new Set(argv);
const force = args.has('--force');
const dryRun = args.has('--dry-run');
const configArg = getArgValue(argv, '--config');
const slotsArg = getArgValue(argv, '--slots');
const promptConfigPath = path.resolve(
    ROOT,
    configArg || path.join('scripts', 'design-v5-prompts.json')
);

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey && !dryRun) {
        throw new Error('Missing GEMINI_API_KEY. Set GEMINI_API_KEY before running this script.');
    }

    const promptConfig = JSON.parse(await fs.readFile(promptConfigPath, 'utf8'));
    const referenceParts = await loadReferencePartsFromConfig(promptConfig);
    const allAssets = Array.isArray(promptConfig.assets) ? promptConfig.assets : [];
    const slotFilter = parseSlots(slotsArg);
    const assets = slotFilter
        ? allAssets.filter((asset) => slotFilter.has(asset.slot))
        : allAssets;

    if (assets.length === 0) {
        if (slotFilter) {
            throw new Error('No assets matched --slots filter in selected prompt config');
        }
        throw new Error(`No assets defined in ${path.relative(ROOT, promptConfigPath)}`);
    }

    await fs.mkdir(RAW_DIR, { recursive: true });

    let client = null;
    if (!dryRun) {
        client = await createGeminiClient(apiKey);
    }

    const generatedAt = new Date().toISOString();
    const rows = [];

    for (const asset of assets) {
        const outputFile = path.join(RAW_DIR, asset.fileName);
        const exists = await fileExists(outputFile);
        if (exists && !force) {
            console.log(`[skip] ${asset.fileName} (exists)`);
            rows.push(buildRow(asset, outputFile, generatedAt, true));
            continue;
        }

        const fullPrompt = buildPrompt(promptConfig.styleGuide, asset);

        if (dryRun) {
            console.log(`[dry-run] ${asset.fileName}`);
            rows.push(buildRow(asset, outputFile, generatedAt, false, fullPrompt));
            continue;
        }

        console.log(`[gen] ${asset.fileName}`);
        const image = await generateImage(client, DEFAULT_MODEL, fullPrompt, referenceParts);
        await fs.writeFile(outputFile, image.bytes);

        rows.push(buildRow(asset, outputFile, generatedAt, false, fullPrompt, image.mimeType));
    }

    await fs.writeFile(
        RAW_MANIFEST_PATH,
        `${JSON.stringify({
            theme: promptConfig.theme || 'design-v5',
            promptVersion: promptConfig.promptVersion || 'v1',
            config: path.relative(ROOT, promptConfigPath).replace(/\\/g, '/'),
            references: (promptConfig?.styleGuide?.referenceImages || []).map((ref) =>
                path.relative(ROOT, path.resolve(ROOT, ref)).replace(/\\/g, '/')
            ),
            selectedSlots: slotFilter ? [...slotFilter] : null,
            model: DEFAULT_MODEL,
            generatedAt,
            dryRun,
            assets: rows
        }, null, 2)}\n`,
        'utf8'
    );

    console.log('Raw generation manifest:', path.relative(ROOT, RAW_MANIFEST_PATH));
    console.log('Next step: python scripts/prepare_design_v5.py');
}

function parseSlots(raw) {
    if (!raw) return null;
    const set = new Set(
        raw
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
    );
    return set.size > 0 ? set : null;
}

function getArgValue(argvList, flagName) {
    for (let index = 0; index < argvList.length; index++) {
        const token = argvList[index];
        if (token === flagName) {
            return argvList[index + 1] || '';
        }
        if (token.startsWith(`${flagName}=`)) {
            return token.slice(flagName.length + 1);
        }
    }
    return '';
}

function buildPrompt(styleGuide, asset) {
    const style = styleGuide?.visualDirection || 'Cute mobile game UI style.';
    const constraints = [
        ...(Array.isArray(styleGuide?.constraints) ? styleGuide.constraints : []),
        ...(Array.isArray(styleGuide?.mustHave) ? styleGuide.mustHave : [])
    ];

    const forbidden = [
        ...(Array.isArray(styleGuide?.mustNot) ? styleGuide.mustNot : []),
        ...(asset.negativePrompt ? [asset.negativePrompt] : [])
    ];

    const constraintsText = constraints.length > 0
        ? constraints.join('; ')
        : 'PNG output; transparent background when needed.';

    const transparentHint = asset.transparent
        ? 'Use transparent background and clean cutout edges.'
        : 'Use fully opaque background.';

    const guidance = [
        asset.safeAreaHint ? `Safe area: ${asset.safeAreaHint}` : '',
        asset.readabilityHint ? `Readability: ${asset.readabilityHint}` : '',
        forbidden.length > 0 ? `Do NOT include: ${forbidden.join('; ')}` : ''
    ].filter(Boolean).join(' ');

    return [
        style,
        constraintsText,
        transparentHint,
        `Target size: ${asset.width}x${asset.height}.`,
        `Usage: ${asset.usage}.`,
        asset.prompt,
        guidance
    ].join(' ');
}

function buildRow(asset, outputFile, generatedAt, skipped, prompt = asset.prompt, mimeType = 'image/png') {
    return {
        slot: asset.slot,
        fileName: asset.fileName,
        usage: asset.usage,
        width: asset.width,
        height: asset.height,
        transparent: !!asset.transparent,
        cropMode: asset.cropMode,
        prompt,
        generatedAt,
        skipped,
        mimeType,
        output: path.relative(ROOT, outputFile).replace(/\\/g, '/')
    };
}

async function createGeminiClient(apiKey) {
    let lib;
    try {
        lib = await import('@google/genai');
    } catch (error) {
        throw new Error('Missing @google/genai package. Install it with: npm i @google/genai');
    }

    const GoogleGenAI = lib.GoogleGenAI || lib.default?.GoogleGenAI;
    if (!GoogleGenAI) {
        throw new Error('Unable to resolve GoogleGenAI from @google/genai');
    }

    return new GoogleGenAI({ apiKey });
}

async function generateImage(client, model, prompt, referenceParts = []) {
    if (!client?.models?.generateContent) {
        throw new Error('Gemini SDK client does not expose models.generateContent');
    }

    const response = await client.models.generateContent({
        model,
        contents: [
            {
                role: 'user',
                parts: [
                    ...referenceParts,
                    {
                        text: referenceParts.length > 0
                            ? `Learn visual language from the attached references. Do not copy exact elements. ${prompt}`
                            : prompt
                    }
                ]
            }
        ],
        config: {
            responseModalities: ['TEXT', 'IMAGE']
        }
    });

    const imagePart = findInlineImagePart(response);
    if (!imagePart?.inlineData?.data) {
        throw new Error('No inline image found in Gemini response');
    }

    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    const bytes = Buffer.from(imagePart.inlineData.data, 'base64');
    return { bytes, mimeType };
}

function findInlineImagePart(payload) {
    const queue = [payload];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;

        if (current.inlineData?.data && `${current.inlineData.mimeType || ''}`.startsWith('image/')) {
            return current;
        }

        for (const value of Object.values(current)) {
            if (Array.isArray(value)) {
                queue.push(...value);
                continue;
            }
            if (value && typeof value === 'object') {
                queue.push(value);
            }
        }
    }

    return null;
}

async function fileExists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

async function loadReferencePartsFromConfig(promptConfig) {
    const refs = Array.isArray(promptConfig?.styleGuide?.referenceImages)
        ? promptConfig.styleGuide.referenceImages
        : [];
    const parts = [];

    for (const ref of refs) {
        const abs = path.resolve(ROOT, ref);
        if (!(await fileExists(abs))) {
            throw new Error(`Reference image not found: ${path.relative(ROOT, abs)}`);
        }
        const data = await fs.readFile(abs);
        parts.push({
            inlineData: {
                mimeType: mimeFromPath(abs),
                data: data.toString('base64')
            }
        });
    }

    return parts;
}

function mimeFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    return 'application/octet-stream';
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
});

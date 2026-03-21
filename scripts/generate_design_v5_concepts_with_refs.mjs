import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const DEFAULT_OUTPUT_DIR = path.join(ROOT, 'temp', 'design-v5', 'concepts-ref');
const KB_TOKENS_PATH = path.join(ROOT, 'assets', 'design-v5', 'kb_tokens.v1.json');
const KB_PROMPTS_PATH = path.join(ROOT, 'scripts', 'design-v5-prompts-v2.json');
const REF_IMAGES = [
    path.join(ROOT, 'temp', 'ui_refs', 'ref_1.webp'),
    path.join(ROOT, 'temp', 'ui_refs', 'ref_2.webp'),
    path.join(ROOT, 'temp', 'ui_refs', 'ref_3.webp')
];

const argv = process.argv.slice(2);
const outputDirArg = getArgValue(argv, '--out-dir');
const modelArg = getArgValue(argv, '--model');
const outputDir = path.resolve(ROOT, outputDirArg || DEFAULT_OUTPUT_DIR);
const model = modelArg || DEFAULT_MODEL;

const TASKS = [
    {
        id: 'home_concept_a',
        fileName: 'home_concept_a.png',
        purpose: 'main lobby key visual direction',
        prompt: [
            'Design one complete mobile game HOME screen mockup for a cute snake-burrow puzzle game.',
            'Canvas ratio must be portrait 430x932.',
            'Use Chinese labels:',
            'title=萌蛇洞穴大逃脱, heroTitle=洞穴大厅, cta=开始冒险, section=功能入口, cards=设置/排行榜/皮肤/签到/退出.',
            'Keep exactly one dominant primary CTA button in center.',
            'Top area includes brand and resource capsules (coin/energy).',
            'Bottom includes feature cards grid with at most 5 visible entries.',
            'Maintain clear hierarchy and generous spacing.',
            'No noisy texture over text regions.',
            'Do not copy references directly; only transfer style language and structure quality.'
        ].join(' ')
    },
    {
        id: 'home_concept_b',
        fileName: 'home_concept_b.png',
        purpose: 'alternative lobby composition',
        prompt: [
            'Design one variant of the HOME screen mockup for the same snake-burrow game.',
            'Portrait 430x932, with a cleaner and more editorial composition.',
            'Keep title and one main CTA only, with feature cards in a tidy bottom panel.',
            'Use Chinese labels consistent with product language (开始冒险, 功能入口, 设置, 排行榜, 皮肤, 签到, 退出).',
            'Visual direction: playful but systemized, high readability, warm earth + fresh green palette.',
            'Do not add extra floating widgets or unrelated UI modules.',
            'No watermark, no photorealistic style, no text clutter.'
        ].join(' ')
    },
    {
        id: 'settings_concept_a',
        fileName: 'settings_concept_a.png',
        purpose: 'settings panel mockup',
        prompt: [
            'Design one SETTINGS panel mockup for the same game.',
            'Portrait 430x932, showing a centered rounded panel shell.',
            'Panel includes: title=设置, back button=返回, language row with 简体中文 and English, audio placeholder, graphics placeholder.',
            'Use calm panel center for readability, with clear section spacing and rounded blocks.',
            'Do not introduce unrelated icons or extra menu entries.',
            'Visual consistency must match the HOME screen style family.'
        ].join(' ')
    },
    {
        id: 'cutout_pack_a',
        fileName: 'cutout_pack_a.png',
        purpose: 'direct-cut component candidate sheet',
        prompt: [
            'Create one component sheet for direct cutout use.',
            'Transparent outside objects if possible.',
            'Include isolated elements only: one primary button skin, one feature card skin, one panel shell, and icons for settings/leaderboard/skins/checkin/exit/coin/energy.',
            'No text on icons, no watermark, no busy checkerboard texture.',
            'Keep enough spacing between objects for easy separation and cutting.',
            'Style must match the same snake-burrow visual family.'
        ].join(' ')
    }
];

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY. Set it in the current shell before running.');
    }

    const [tokens, prompts] = await Promise.all([
        readJson(KB_TOKENS_PATH),
        readJson(KB_PROMPTS_PATH)
    ]);

    const refs = await loadReferenceParts(REF_IMAGES);
    await fs.mkdir(outputDir, { recursive: true });

    const client = await createGeminiClient(apiKey);
    const rows = [];

    for (const task of TASKS) {
        const fullPrompt = buildPrompt(tokens, prompts, task.prompt);
        console.log(`[gen] ${task.fileName}`);
        const image = await generateImage(client, model, refs, fullPrompt);
        const outPath = path.join(outputDir, task.fileName);
        await fs.writeFile(outPath, image.bytes);
        rows.push({
            id: task.id,
            file: task.fileName,
            purpose: task.purpose,
            model,
            prompt: fullPrompt,
            mimeType: image.mimeType
        });
    }

    const manifest = {
        generatedAt: new Date().toISOString(),
        model,
        references: REF_IMAGES.map((filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/')),
        outputDir: path.relative(ROOT, outputDir).replace(/\\/g, '/'),
        tasks: rows
    };

    await fs.writeFile(
        path.join(outputDir, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
    );

    console.log(`Concept generation done: ${path.relative(ROOT, outputDir)}`);
}

function buildPrompt(tokens, prompts, taskPrompt) {
    const style = prompts?.styleGuide?.visualDirection || 'Cute snake-burrow mobile UI';
    const mustHave = Array.isArray(prompts?.styleGuide?.mustHave)
        ? prompts.styleGuide.mustHave.join('; ')
        : 'high readability; clean edges';
    const mustNot = Array.isArray(prompts?.styleGuide?.mustNot)
        ? prompts.styleGuide.mustNot.join('; ')
        : 'no watermark; no noisy text area';

    return [
        `Design system constraints: base frame ${tokens?.baseFrame?.width || 430}x${tokens?.baseFrame?.height || 932}.`,
        `Visual direction: ${style}.`,
        `Must have: ${mustHave}.`,
        `Must avoid: ${mustNot}.`,
        `Token cues: panelCream=${tokens?.color?.panelCream || '#F6E8CF'}, ctaFill=${tokens?.color?.ctaFill || '#F5C34C'}, textPrimary=${tokens?.color?.textPrimary || '#5A3A23'}.`,
        `Interaction constraints: one primary CTA per screen, min tap area >= ${tokens?.interaction?.minTapArea || 44}px, max visible badges per screen <= ${tokens?.density?.maxVisibleBadgesPerScreen || 2}.`,
        `Task: ${taskPrompt}`
    ].join(' ');
}

async function loadReferenceParts(paths) {
    const parts = [];
    for (const p of paths) {
        const bytes = await fs.readFile(p);
        parts.push({
            inlineData: {
                mimeType: mimeFromPath(p),
                data: bytes.toString('base64')
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

async function createGeminiClient(apiKey) {
    let lib;
    try {
        lib = await import('@google/genai');
    } catch {
        throw new Error('Missing @google/genai package. Install it first: npm i @google/genai');
    }

    const GoogleGenAI = lib.GoogleGenAI || lib.default?.GoogleGenAI;
    if (!GoogleGenAI) {
        throw new Error('Unable to resolve GoogleGenAI from @google/genai');
    }
    return new GoogleGenAI({ apiKey });
}

async function generateImage(client, modelName, referenceParts, textPrompt) {
    const response = await client.models.generateContent({
        model: modelName,
        contents: [
            {
                role: 'user',
                parts: [
                    ...referenceParts,
                    {
                        text: [
                            'Learn visual language from the attached reference images.',
                            'Do not copy exact elements; create original composition.',
                            textPrompt
                        ].join(' ')
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

    return {
        mimeType: imagePart.inlineData.mimeType || 'image/png',
        bytes: Buffer.from(imagePart.inlineData.data, 'base64')
    };
}

function findInlineImagePart(payload) {
    const queue = [payload];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;
        if (current.inlineData?.data && `${current.inlineData?.mimeType || ''}`.startsWith('image/')) {
            return current;
        }
        for (const value of Object.values(current)) {
            if (Array.isArray(value)) queue.push(...value);
            else if (value && typeof value === 'object') queue.push(value);
        }
    }
    return null;
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
}

function getArgValue(argvList, flagName) {
    for (let i = 0; i < argvList.length; i++) {
        const token = argvList[i];
        if (token === flagName) return argvList[i + 1] || '';
        if (token.startsWith(`${flagName}=`)) return token.slice(flagName.length + 1);
    }
    return '';
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
});

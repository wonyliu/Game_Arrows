import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = path.resolve(new URL('..', import.meta.url).pathname);
const MANAGED_DIR = path.join(ROOT_DIR, 'data', 'managed-config');
const KEYS = Object.freeze([
    'level-catalog-v1',
    'saved-levels-v1',
    'preview-levels-v1',
    'bgm-config-v1',
    'liveops-config-v1',
    'support-ads-config-v1',
    'ui-layout-config-v1',
    'skin-part-fit-overrides-v1',
    'skin-price-overrides-v1'
]);

const args = new Map(
    process.argv.slice(2).map((item) => {
        const [key, ...rest] = item.split('=');
        return [key, rest.join('=')];
    })
);

const mode = (args.get('--mode') || 'pull').trim().toLowerCase();
const apiBase = `${args.get('--api-base') || process.env.GAME_API_BASE || process.env.API_BASE || ''}`.trim().replace(/\/+$/, '');

if (!apiBase) {
    throw new Error('Missing API base. Use --api-base=https://your-server or set GAME_API_BASE.');
}

if (mode !== 'pull' && mode !== 'push') {
    throw new Error(`Unsupported mode "${mode}". Use --mode=pull or --mode=push.`);
}

await fs.mkdir(MANAGED_DIR, { recursive: true });

for (const key of KEYS) {
    if (mode === 'pull') {
        await pullKey(key);
    } else {
        await pushKey(key);
    }
}

async function pullKey(key) {
    const response = await fetch(`${apiBase}/api/storage/${key}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
        throw new Error(`Failed to pull ${key}: HTTP ${response.status}`);
    }
    const payload = await response.json();
    await writeJson(path.join(MANAGED_DIR, `${key}.json`), payload);
    console.log(`pulled ${key}`);
}

async function pushKey(key) {
    const filePath = path.join(MANAGED_DIR, `${key}.json`);
    const payload = await readJson(filePath);
    const response = await fetch(`${apiBase}/api/storage/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`Failed to push ${key}: HTTP ${response.status}`);
    }
    console.log(`pushed ${key}`);
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function writeJson(filePath, value) {
    const raw = `${JSON.stringify(value, null, 2)}\n`;
    await fs.writeFile(filePath, raw, 'utf8');
}

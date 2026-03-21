import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, '.local-data');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || process.argv[2] || 4173);

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
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8'
};

await fs.mkdir(DATA_DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
    try {
        const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);

        if (requestUrl.pathname.startsWith('/api/storage/')) {
            await handleStorageRequest(req, res, requestUrl.pathname);
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
});

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
            body = await readRequestJson(req);
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

async function readRequestJson(req) {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) {
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

function sendJson(res, statusCode, payload) {
    const text = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(text);
}

function sendText(res, statusCode, text) {
    res.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(text);
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

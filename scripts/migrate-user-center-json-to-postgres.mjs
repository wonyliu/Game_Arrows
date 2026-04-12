import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const JSON_PATH = process.env.USER_CENTER_JSON_PATH || path.join(ROOT_DIR, '.local-data', 'user-center-db-v1.json');
const DATABASE_URL = `${process.env.USER_CENTER_DATABASE_URL || process.env.DATABASE_URL || ''}`.trim();

if (!DATABASE_URL) {
    throw new Error('Missing USER_CENTER_DATABASE_URL or DATABASE_URL');
}

let pg;
try {
    pg = await import('pg');
} catch (error) {
    throw new Error(`Missing dependency "pg". Install it first. Detail: ${error?.message || 'unknown'}`);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

async function readJsonFile(filePath, fallback) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clampInt(value, min, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.floor(n));
}

function normalizeSkinList(value) {
    const out = [];
    const seen = new Set();
    const source = Array.isArray(value) ? value : [];
    for (const row of source) {
        const id = `${row || ''}`.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    if (!seen.has('classic-burrow')) {
        out.unshift('classic-burrow');
    }
    return out;
}

const schemaSql = await fs.readFile(path.join(ROOT_DIR, 'scripts', 'sql', 'user-center-postgres.sql'), 'utf8');
await pool.query(schemaSql);

const payload = await readJsonFile(JSON_PATH, { users: [] });
const users = Array.isArray(payload?.users) ? payload.users : [];

let maxUserSeq = 0;
let maxTempSeq = 0;
let imported = 0;

for (const row of users) {
    if (!isPlainObject(row)) continue;
    const userId = `${row.userId || ''}`.trim().toLowerCase();
    const username = `${row.username || ''}`.trim();
    if (!userId || !username) continue;

    const userSeqMatch = userId.match(/^u(\d+)$/);
    const tempSeqMatch = userId.match(/^tmp(\d+)$/);
    if (userSeqMatch) maxUserSeq = Math.max(maxUserSeq, clampInt(userSeqMatch[1], 1, 0));
    if (tempSeqMatch) maxTempSeq = Math.max(maxTempSeq, clampInt(tempSeqMatch[1], 1, 0));

    const progress = isPlainObject(row.progress) ? row.progress : {};
    const liveopsPlayer = isPlainObject(row.liveopsPlayer) ? row.liveopsPlayer : {};
    const unlockedSkinIds = normalizeSkinList(row.unlockedSkinIds ?? progress.unlockedSkinIds);

    await pool.query(
        `INSERT INTO user_center_users (
            user_id, username, username_lower, avatar_url, is_temp_user,
            password_algorithm, password_salt, password_hash, created_at, last_active_at,
            primary_device_id, hardware_device_ids, devices, cookie_device_mismatch_logs,
            progress, liveops_player, coins, max_unlocked_level, max_cleared_level, unlocked_skin_ids
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9::timestamptz, $10::timestamptz,
            $11, $12::jsonb, $13::jsonb, $14::jsonb,
            $15::jsonb, $16::jsonb, $17, $18, $19, $20::jsonb
        )
        ON CONFLICT (user_id) DO UPDATE SET
            username = EXCLUDED.username,
            username_lower = EXCLUDED.username_lower,
            avatar_url = EXCLUDED.avatar_url,
            is_temp_user = EXCLUDED.is_temp_user,
            password_algorithm = EXCLUDED.password_algorithm,
            password_salt = EXCLUDED.password_salt,
            password_hash = EXCLUDED.password_hash,
            created_at = EXCLUDED.created_at,
            last_active_at = EXCLUDED.last_active_at,
            primary_device_id = EXCLUDED.primary_device_id,
            hardware_device_ids = EXCLUDED.hardware_device_ids,
            devices = EXCLUDED.devices,
            cookie_device_mismatch_logs = EXCLUDED.cookie_device_mismatch_logs,
            progress = EXCLUDED.progress,
            liveops_player = EXCLUDED.liveops_player,
            coins = EXCLUDED.coins,
            max_unlocked_level = EXCLUDED.max_unlocked_level,
            max_cleared_level = EXCLUDED.max_cleared_level,
            unlocked_skin_ids = EXCLUDED.unlocked_skin_ids,
            updated_at = NOW()`,
        [
            userId,
            username,
            username.toLowerCase(),
            `${row.avatarUrl || ''}`.trim(),
            row.isTempUser === true,
            `${row.passwordAlgorithm || 'sha256-v1'}`.trim(),
            `${row.passwordSalt || ''}`.trim(),
            `${row.passwordHash || ''}`.trim(),
            `${row.createdAt || new Date().toISOString()}`,
            `${row.lastActiveAt || row.createdAt || new Date().toISOString()}`,
            `${row.primaryDeviceId || ''}`.trim(),
            JSON.stringify(Array.isArray(row.hardwareDeviceIds) ? row.hardwareDeviceIds : []),
            JSON.stringify(Array.isArray(row.devices) ? row.devices : []),
            JSON.stringify(Array.isArray(row.cookieDeviceMismatchLogs) ? row.cookieDeviceMismatchLogs : []),
            JSON.stringify(progress),
            JSON.stringify(liveopsPlayer),
            Math.max(0, Math.floor(Number(row.coins ?? progress.coins) || 0)),
            Math.max(1, Math.floor(Number(row.maxUnlockedLevel ?? progress.maxUnlockedLevel) || 1)),
            Math.max(0, Math.floor(Number(row.maxClearedLevel ?? progress.maxClearedLevel) || 0)),
            JSON.stringify(unlockedSkinIds)
        ]
    );

    imported += 1;
}

if (maxUserSeq > 0) {
    await pool.query(`SELECT setval('user_center_user_seq', $1, true)`, [maxUserSeq]);
}
if (maxTempSeq > 0) {
    await pool.query(`SELECT setval('user_center_temp_seq', $1, true)`, [maxTempSeq]);
}

console.log(`Migrated ${imported} users from ${JSON_PATH} to PostgreSQL.`);
await pool.end();

import fs from 'node:fs/promises';
import path from 'node:path';

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toIsoTimestamp(value) {
    if (!value) return '';
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }
    const text = `${value}`.trim();
    if (!text) return '';
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
        return text;
    }
    return parsed.toISOString();
}

async function readJsonFile(filePath, fallback) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(text);
        return isPlainObject(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

async function writeJsonAtomic(filePath, data) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
}

function mapDbUserRow(row) {
    if (!row) return null;
    return {
        userId: `${row.user_id || ''}`.trim(),
        username: `${row.username || ''}`.trim(),
        avatarUrl: `${row.avatar_url || ''}`.trim(),
        isTempUser: row.is_temp_user === true,
        passwordAlgorithm: `${row.password_algorithm || 'sha256-v1'}`.trim() || 'sha256-v1',
        passwordSalt: `${row.password_salt || ''}`.trim(),
        passwordHash: `${row.password_hash || ''}`.trim(),
        createdAt: toIsoTimestamp(row.created_at),
        lastActiveAt: toIsoTimestamp(row.last_active_at),
        primaryDeviceId: `${row.primary_device_id || ''}`.trim(),
        hardwareDeviceIds: Array.isArray(row.hardware_device_ids) ? row.hardware_device_ids : [],
        devices: Array.isArray(row.devices) ? row.devices : [],
        cookieDeviceMismatchLogs: Array.isArray(row.cookie_device_mismatch_logs) ? row.cookie_device_mismatch_logs : [],
        progress: isPlainObject(row.progress) ? row.progress : {},
        liveopsPlayer: isPlainObject(row.liveops_player) ? row.liveops_player : {},
        coins: Math.max(0, Math.floor(Number(row.coins) || 0)),
        maxUnlockedLevel: Math.max(1, Math.floor(Number(row.max_unlocked_level) || 1)),
        maxClearedLevel: Math.max(0, Math.floor(Number(row.max_cleared_level) || 0)),
        unlockedSkinIds: Array.isArray(row.unlocked_skin_ids) ? row.unlocked_skin_ids : []
    };
}

function toDbUserParams(user) {
    const toJsonText = (value, fallback) => {
        const source = value === undefined ? fallback : value;
        try {
            return JSON.stringify(source);
        } catch {
            return JSON.stringify(fallback);
        }
    };
    return [
        `${user.userId || ''}`.trim(),
        `${user.username || ''}`.trim(),
        `${user.username || ''}`.trim().toLowerCase(),
        `${user.avatarUrl || ''}`.trim(),
        user.isTempUser === true,
        `${user.passwordAlgorithm || 'sha256-v1'}`.trim() || 'sha256-v1',
        `${user.passwordSalt || ''}`.trim(),
        `${user.passwordHash || ''}`.trim(),
        `${user.createdAt || ''}`.trim(),
        `${user.lastActiveAt || ''}`.trim(),
        `${user.primaryDeviceId || ''}`.trim(),
        toJsonText(Array.isArray(user.hardwareDeviceIds) ? user.hardwareDeviceIds : [], []),
        toJsonText(Array.isArray(user.devices) ? user.devices : [], []),
        toJsonText(Array.isArray(user.cookieDeviceMismatchLogs) ? user.cookieDeviceMismatchLogs : [], []),
        toJsonText(isPlainObject(user.progress) ? user.progress : {}, {}),
        toJsonText(isPlainObject(user.liveopsPlayer) ? user.liveopsPlayer : {}, {}),
        Math.max(0, Math.floor(Number(user.coins) || 0)),
        Math.max(1, Math.floor(Number(user.maxUnlockedLevel) || 1)),
        Math.max(0, Math.floor(Number(user.maxClearedLevel) || 0)),
        toJsonText(Array.isArray(user.unlockedSkinIds) ? user.unlockedSkinIds : [], [])
    ];
}

function compareLeaderboardEntries(a, b) {
    if (b.maxClearedLevel !== a.maxClearedLevel) return b.maxClearedLevel - a.maxClearedLevel;
    if (b.coins !== a.coins) return b.coins - a.coins;
    return `${b.lastActiveAt}`.localeCompare(`${a.lastActiveAt}`);
}

function buildJsonLeaderboardEntries(users) {
    return users
        .map((user) => ({
            userId: `${user?.userId || ''}`.trim(),
            username: `${user?.username || ''}`.trim() || 'Unknown',
            avatarUrl: `${user?.avatarUrl || ''}`.trim(),
            maxUnlockedLevel: Math.max(1, Math.floor(Number(user?.maxUnlockedLevel) || Number(user?.progress?.maxUnlockedLevel) || 1)),
            maxClearedLevel: Math.max(0, Math.floor(Number(user?.maxClearedLevel) || Number(user?.progress?.maxClearedLevel) || 0)),
            coins: Math.max(0, Math.floor(Number(user?.coins) || Number(user?.progress?.coins) || 0)),
            lastActiveAt: `${user?.lastActiveAt || ''}`.trim()
        }))
        .sort(compareLeaderboardEntries);
}

class JsonUserCenterStore {
    constructor(options) {
        this.filePath = options.filePath;
        this.normalizeProgressFromPayload = options.normalizeProgressFromPayload;
        this.normalizeLiveopsPlayerState = options.normalizeLiveopsPlayerState;
        this.collectUniqueSkinIds = options.collectUniqueSkinIds;
        this.buildDefaultProgress = options.buildDefaultProgress;
        this.buildDefaultLiveopsPlayerState = options.buildDefaultLiveopsPlayerState;
        this.nowIso = options.nowIso;
    }

    async init() {}

    async readDb() {
        const fallback = {
            version: 2,
            nextUserSeq: 1,
            nextTempSeq: 1,
            users: []
        };
        const db = await readJsonFile(this.filePath, fallback);
        if (!isPlainObject(db)) return fallback;
        if (!Array.isArray(db.users)) db.users = [];
        db.users = db.users.map((row) => {
            const user = isPlainObject(row) ? { ...row } : {};
            user.passwordAlgorithm = `${user.passwordAlgorithm || 'sha256-v1'}`.trim() || 'sha256-v1';
            user.progress = this.normalizeProgressFromPayload(user.progress);
            user.liveopsPlayer = this.normalizeLiveopsPlayerState(user.liveopsPlayer);
            user.coins = Math.max(0, Math.floor(Number(user.coins ?? user.progress?.coins) || 0));
            user.maxUnlockedLevel = Math.max(1, Math.floor(Number(user.maxUnlockedLevel ?? user.progress?.maxUnlockedLevel) || 1));
            user.maxClearedLevel = Math.max(0, Math.floor(Number(user.maxClearedLevel ?? user.progress?.maxClearedLevel) || 0));
            user.unlockedSkinIds = this.collectUniqueSkinIds(user.unlockedSkinIds ?? user.progress?.unlockedSkinIds);
            return user;
        });
        db.nextUserSeq = Math.max(1, Math.floor(Number(db.nextUserSeq) || 1));
        db.nextTempSeq = Math.max(1, Math.floor(Number(db.nextTempSeq) || 1));
        return db;
    }

    async writeDb(db) {
        await writeJsonAtomic(this.filePath, db);
    }

    getBackendMeta() {
        return { backend: 'json', scalable: false };
    }

    async findUserById(userId) {
        const db = await this.readDb();
        return db.users.find((entry) => `${entry?.userId || ''}`.trim() === userId) || null;
    }

    async findUserByUsernameLower(usernameLower) {
        const db = await this.readDb();
        return db.users.find((entry) => `${entry?.username || ''}`.trim().toLowerCase() === usernameLower) || null;
    }

    async allocateUserIdentity(isTempUser) {
        const db = await this.readDb();
        const seq = isTempUser ? db.nextTempSeq++ : db.nextUserSeq++;
        await this.writeDb(db);
        return {
            seq,
            userId: isTempUser
                ? `tmp${String(seq).padStart(6, '0')}`
                : `u${String(seq).padStart(6, '0')}`
        };
    }

    async insertUser(user) {
        const db = await this.readDb();
        db.users.push(user);
        await this.writeDb(db);
        return user;
    }

    async updateUser(user) {
        const db = await this.readDb();
        const idx = db.users.findIndex((entry) => `${entry?.userId || ''}`.trim() === `${user?.userId || ''}`.trim());
        if (idx < 0) {
            throw new Error('user not found');
        }
        db.users[idx] = user;
        await this.writeDb(db);
        return user;
    }

    async deleteUser(userId) {
        const db = await this.readDb();
        const nextUsers = db.users.filter((entry) => `${entry?.userId || ''}`.trim() !== `${userId || ''}`.trim());
        if (nextUsers.length === db.users.length) {
            throw new Error('user not found');
        }
        db.users = nextUsers;
        await this.writeDb(db);
        return true;
    }

    async listLeaderboard(limit) {
        const db = await this.readDb();
        return buildJsonLeaderboardEntries(db.users).slice(0, limit);
    }

    async getLeaderboardEntryForUser(userId) {
        const safeUserId = `${userId || ''}`.trim();
        if (!safeUserId) {
            return null;
        }
        const db = await this.readDb();
        const ranked = buildJsonLeaderboardEntries(db.users);
        const index = ranked.findIndex((row) => row.userId === safeUserId);
        if (index < 0) {
            return null;
        }
        return {
            rank: index + 1,
            ...ranked[index]
        };
    }

    async countUsers(query = '') {
        const db = await this.readDb();
        const q = `${query || ''}`.trim().toLowerCase();
        if (!q) return db.users.length;
        return db.users.filter((user) => {
            const id = `${user?.userId || ''}`.toLowerCase();
            const name = `${user?.username || ''}`.toLowerCase();
            return id.includes(q) || name.includes(q);
        }).length;
    }

    async listUsers({ limit, offset, query = '' }) {
        const db = await this.readDb();
        const q = `${query || ''}`.trim().toLowerCase();
        const source = q
            ? db.users.filter((user) => {
                const id = `${user?.userId || ''}`.toLowerCase();
                const name = `${user?.username || ''}`.toLowerCase();
                return id.includes(q) || name.includes(q);
            })
            : db.users;
        return source
            .slice(offset, offset + limit)
            .map((user) => ({
                userId: `${user?.userId || ''}`.trim(),
                username: `${user?.username || ''}`.trim(),
                isTempUser: user?.isTempUser === true,
                coins: Math.max(0, Math.floor(Number(user?.coins) || 0)),
                maxUnlockedLevel: Math.max(1, Math.floor(Number(user?.maxUnlockedLevel) || 1)),
                maxClearedLevel: Math.max(0, Math.floor(Number(user?.maxClearedLevel) || 0)),
                lastActiveAt: `${user?.lastActiveAt || ''}`.trim(),
                createdAt: `${user?.createdAt || ''}`.trim()
            }));
    }

    async getOverview() {
        const db = await this.readDb();
        return {
            totalUsers: db.users.length,
            tempUsers: db.users.filter((u) => u?.isTempUser === true).length
        };
    }

    async resetGameStateForAllUsers() {
        const db = await this.readDb();
        const progress = this.buildDefaultProgress();
        const liveopsPlayer = this.buildDefaultLiveopsPlayerState();
        for (const user of db.users) {
            user.progress = { ...progress, updatedAt: this.nowIso() };
            user.liveopsPlayer = { ...liveopsPlayer, updatedAt: this.nowIso() };
            user.coins = 0;
            user.maxUnlockedLevel = 1;
            user.maxClearedLevel = 0;
            user.unlockedSkinIds = ['classic-burrow'];
            user.lastActiveAt = this.nowIso();
        }
        await this.writeDb(db);
        return db.users.length;
    }

    async resetLeaderboardProgressForAllUsers() {
        const db = await this.readDb();
        const touchedAt = this.nowIso();
        for (const user of db.users) {
            const progress = this.normalizeProgressFromPayload(user.progress);
            progress.maxClearedLevel = 0;
            progress.updatedAt = touchedAt;
            user.progress = progress;
            user.maxClearedLevel = 0;
            user.lastActiveAt = touchedAt;
        }
        await this.writeDb(db);
        return db.users.length;
    }
}

class PostgresUserCenterStore {
    constructor(options) {
        this.databaseUrl = options.databaseUrl;
        this.nowIso = options.nowIso;
        this.normalizeProgressFromPayload = options.normalizeProgressFromPayload;
        this.normalizeLiveopsPlayerState = options.normalizeLiveopsPlayerState;
        this.buildDefaultProgress = options.buildDefaultProgress;
        this.buildDefaultLiveopsPlayerState = options.buildDefaultLiveopsPlayerState;
        this.pgPool = null;
    }

    async init() {
        if (!this.databaseUrl) {
            throw new Error('USER_CENTER_DATABASE_URL (or DATABASE_URL) is required for postgres backend');
        }
        let pg;
        try {
            pg = await import('pg');
        } catch (error) {
            throw new Error(`postgres backend requires npm package "pg": ${error?.message || 'module load failed'}`);
        }
        const { Pool } = pg;
        this.pgPool = new Pool({
            connectionString: this.databaseUrl
        });
        await this.ensureSchema();
    }

    getBackendMeta() {
        return { backend: 'postgres', scalable: true };
    }

    async ensureSchema() {
        const sql = `
CREATE SEQUENCE IF NOT EXISTS user_center_user_seq START 1;
CREATE SEQUENCE IF NOT EXISTS user_center_temp_seq START 1;

CREATE TABLE IF NOT EXISTS user_center_users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_lower TEXT NOT NULL UNIQUE,
    avatar_url TEXT NOT NULL,
    is_temp_user BOOLEAN NOT NULL DEFAULT FALSE,
    password_algorithm TEXT NOT NULL DEFAULT 'sha256-v1',
    password_salt TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    last_active_at TIMESTAMPTZ NOT NULL,
    primary_device_id TEXT NOT NULL DEFAULT '',
    hardware_device_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    devices JSONB NOT NULL DEFAULT '[]'::jsonb,
    cookie_device_mismatch_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    progress JSONB NOT NULL,
    liveops_player JSONB NOT NULL,
    coins INTEGER NOT NULL DEFAULT 0,
    max_unlocked_level INTEGER NOT NULL DEFAULT 1,
    max_cleared_level INTEGER NOT NULL DEFAULT 0,
    unlocked_skin_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_center_users
    ADD COLUMN IF NOT EXISTS password_algorithm TEXT NOT NULL DEFAULT 'sha256-v1';

CREATE INDEX IF NOT EXISTS idx_user_center_leaderboard
ON user_center_users (max_cleared_level DESC, coins DESC, last_active_at DESC);
`;
        await this.pgPool.query(sql);
    }

    async allocateUserIdentity(isTempUser) {
        const seqName = isTempUser ? 'user_center_temp_seq' : 'user_center_user_seq';
        const prefix = isTempUser ? 'tmp' : 'u';
        const result = await this.pgPool.query(`SELECT nextval($1::regclass) AS seq`, [seqName]);
        const seq = Math.max(1, Number(result.rows?.[0]?.seq) || 1);
        return {
            seq,
            userId: `${prefix}${String(seq).padStart(6, '0')}`
        };
    }

    async findUserById(userId) {
        const result = await this.pgPool.query(
            'SELECT * FROM user_center_users WHERE user_id = $1 LIMIT 1',
            [userId]
        );
        return mapDbUserRow(result.rows[0] || null);
    }

    async findUserByUsernameLower(usernameLower) {
        const result = await this.pgPool.query(
            'SELECT * FROM user_center_users WHERE username_lower = $1 LIMIT 1',
            [usernameLower]
        );
        return mapDbUserRow(result.rows[0] || null);
    }

    async insertUser(user) {
        const params = toDbUserParams(user);
        await this.pgPool.query(
            `INSERT INTO user_center_users (
                user_id, username, username_lower, avatar_url, is_temp_user,
                password_algorithm, password_salt, password_hash, created_at, last_active_at,
                primary_device_id, hardware_device_ids, devices, cookie_device_mismatch_logs,
                progress, liveops_player, coins, max_unlocked_level, max_cleared_level, unlocked_skin_ids
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12::jsonb, $13::jsonb, $14::jsonb,
                $15::jsonb, $16::jsonb, $17, $18, $19, $20::jsonb
            )`,
            params
        );
        return user;
    }

    async updateUser(user) {
        const params = toDbUserParams(user);
        const result = await this.pgPool.query(
            `UPDATE user_center_users SET
                username = $2,
                username_lower = $3,
                avatar_url = $4,
                is_temp_user = $5,
                password_algorithm = $6,
                password_salt = $7,
                password_hash = $8,
                created_at = $9::timestamptz,
                last_active_at = $10::timestamptz,
                primary_device_id = $11,
                hardware_device_ids = $12::jsonb,
                devices = $13::jsonb,
                cookie_device_mismatch_logs = $14::jsonb,
                progress = $15::jsonb,
                liveops_player = $16::jsonb,
                coins = $17,
                max_unlocked_level = $18,
                max_cleared_level = $19,
                unlocked_skin_ids = $20::jsonb,
                updated_at = NOW()
            WHERE user_id = $1`,
            params
        );
        if ((result.rowCount || 0) < 1) {
            throw new Error('user not found');
        }
        return user;
    }

    async deleteUser(userId) {
        const result = await this.pgPool.query(
            'DELETE FROM user_center_users WHERE user_id = $1',
            [`${userId || ''}`.trim()]
        );
        if ((result.rowCount || 0) < 1) {
            throw new Error('user not found');
        }
        return true;
    }

    async listLeaderboard(limit) {
        const result = await this.pgPool.query(
            `SELECT user_id, username, avatar_url, max_unlocked_level, max_cleared_level, coins, last_active_at
             FROM user_center_users
             ORDER BY max_cleared_level DESC, coins DESC, last_active_at DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows.map((row) => ({
            userId: `${row.user_id || ''}`.trim(),
            username: `${row.username || ''}`.trim() || 'Unknown',
            avatarUrl: `${row.avatar_url || ''}`.trim(),
            maxUnlockedLevel: Math.max(1, Math.floor(Number(row.max_unlocked_level) || 1)),
            maxClearedLevel: Math.max(0, Math.floor(Number(row.max_cleared_level) || 0)),
            coins: Math.max(0, Math.floor(Number(row.coins) || 0)),
            lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : ''
        }));
    }

    async getLeaderboardEntryForUser(userId) {
        const safeUserId = `${userId || ''}`.trim();
        if (!safeUserId) {
            return null;
        }
        const result = await this.pgPool.query(
            `WITH ranked AS (
                SELECT
                    user_id,
                    username,
                    avatar_url,
                    max_unlocked_level,
                    max_cleared_level,
                    coins,
                    last_active_at,
                    ROW_NUMBER() OVER (
                        ORDER BY max_cleared_level DESC, coins DESC, last_active_at DESC
                    ) AS rank
                FROM user_center_users
            )
            SELECT *
            FROM ranked
            WHERE user_id = $1
            LIMIT 1`,
            [safeUserId]
        );
        const row = result.rows?.[0];
        if (!row) {
            return null;
        }
        return {
            rank: Math.max(1, Math.floor(Number(row.rank) || 1)),
            userId: `${row.user_id || ''}`.trim(),
            username: `${row.username || ''}`.trim() || 'Unknown',
            avatarUrl: `${row.avatar_url || ''}`.trim(),
            maxUnlockedLevel: Math.max(1, Math.floor(Number(row.max_unlocked_level) || 1)),
            maxClearedLevel: Math.max(0, Math.floor(Number(row.max_cleared_level) || 0)),
            coins: Math.max(0, Math.floor(Number(row.coins) || 0)),
            lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : ''
        };
    }

    async countUsers(query = '') {
        const q = `${query || ''}`.trim();
        if (!q) {
            const result = await this.pgPool.query('SELECT COUNT(*)::int AS count FROM user_center_users');
            return Number(result.rows?.[0]?.count) || 0;
        }
        const like = `%${q.toLowerCase()}%`;
        const result = await this.pgPool.query(
            `SELECT COUNT(*)::int AS count
             FROM user_center_users
             WHERE LOWER(user_id) LIKE $1 OR username_lower LIKE $1`,
            [like]
        );
        return Number(result.rows?.[0]?.count) || 0;
    }

    async listUsers({ limit, offset, query = '' }) {
        const q = `${query || ''}`.trim();
        if (!q) {
            const result = await this.pgPool.query(
                `SELECT user_id, username, is_temp_user, coins, max_unlocked_level, max_cleared_level, last_active_at, created_at
                 FROM user_center_users
                 ORDER BY created_at DESC
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );
            return result.rows.map((row) => ({
                userId: `${row.user_id || ''}`.trim(),
                username: `${row.username || ''}`.trim(),
                isTempUser: row.is_temp_user === true,
                coins: Math.max(0, Math.floor(Number(row.coins) || 0)),
                maxUnlockedLevel: Math.max(1, Math.floor(Number(row.max_unlocked_level) || 1)),
                maxClearedLevel: Math.max(0, Math.floor(Number(row.max_cleared_level) || 0)),
                lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : '',
                createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
            }));
        }
        const like = `%${q.toLowerCase()}%`;
        const result = await this.pgPool.query(
            `SELECT user_id, username, is_temp_user, coins, max_unlocked_level, max_cleared_level, last_active_at, created_at
             FROM user_center_users
             WHERE LOWER(user_id) LIKE $1 OR username_lower LIKE $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [like, limit, offset]
        );
        return result.rows.map((row) => ({
            userId: `${row.user_id || ''}`.trim(),
            username: `${row.username || ''}`.trim(),
            isTempUser: row.is_temp_user === true,
            coins: Math.max(0, Math.floor(Number(row.coins) || 0)),
            maxUnlockedLevel: Math.max(1, Math.floor(Number(row.max_unlocked_level) || 1)),
            maxClearedLevel: Math.max(0, Math.floor(Number(row.max_cleared_level) || 0)),
            lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : '',
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
        }));
    }

    async getOverview() {
        const result = await this.pgPool.query(
            `SELECT
                COUNT(*)::int AS total_users,
                SUM(CASE WHEN is_temp_user THEN 1 ELSE 0 END)::int AS temp_users
             FROM user_center_users`
        );
        const row = result.rows?.[0] || {};
        return {
            totalUsers: Number(row.total_users) || 0,
            tempUsers: Number(row.temp_users) || 0
        };
    }

    async resetGameStateForAllUsers() {
        const progress = this.buildDefaultProgress();
        const liveopsPlayer = this.buildDefaultLiveopsPlayerState();
        const now = this.nowIso();
        const result = await this.pgPool.query(
            `UPDATE user_center_users SET
                progress = $1::jsonb,
                liveops_player = $2::jsonb,
                coins = 0,
                max_unlocked_level = 1,
                max_cleared_level = 0,
                unlocked_skin_ids = '["classic-burrow"]'::jsonb,
                last_active_at = $3::timestamptz,
                updated_at = NOW()`,
            [
                JSON.stringify({ ...progress, updatedAt: now }),
                JSON.stringify({ ...liveopsPlayer, updatedAt: now }),
                now
            ]
        );
        return result.rowCount || 0;
    }

    async resetLeaderboardProgressForAllUsers() {
        const now = this.nowIso();
        const result = await this.pgPool.query(
            `UPDATE user_center_users SET
                max_cleared_level = 0,
                progress = jsonb_set(
                    jsonb_set(progress, '{maxClearedLevel}', '0'::jsonb, true),
                    '{updatedAt}',
                    to_jsonb($1::text),
                    true
                ),
                last_active_at = $1::timestamptz,
                updated_at = NOW()`,
            [now]
        );
        return result.rowCount || 0;
    }
}

export async function createUserCenterStore(options) {
    const backendRaw = `${options?.backend || 'postgres'}`.trim().toLowerCase();
    const backend = backendRaw === 'postgres' ? 'postgres' : 'json';
    const common = {
        normalizeProgressFromPayload: options.normalizeProgressFromPayload,
        normalizeLiveopsPlayerState: options.normalizeLiveopsPlayerState,
        collectUniqueSkinIds: options.collectUniqueSkinIds,
        buildDefaultProgress: options.buildDefaultProgress,
        buildDefaultLiveopsPlayerState: options.buildDefaultLiveopsPlayerState,
        nowIso: options.nowIso
    };

    if (backend === 'json') {
        throw new Error('json user center backend is disabled. Set backend=postgres and provide USER_CENTER_DATABASE_URL.');
    }
    const store = new PostgresUserCenterStore({
        ...common,
        databaseUrl: `${options?.databaseUrl || ''}`.trim()
    });

    await store.init();
    return store;
}

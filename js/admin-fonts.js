const FONT_ROWS = [
    {
        name: 'ZCOOL KuaiLe',
        scope: '游戏前台',
        copyright: '免费商用',
        tagClass: '',
        source: 'Google Fonts / OFL-1.1',
        sourceUrl: 'https://github.com/googlefonts/zcool-kuaile',
        packaged: '否，当前未随包分发',
        usages: [
            '主界面标题、开始按钮、功能入口文字',
            '游戏 HUD：关卡、分数、连击、奖励提示',
            '弹窗/面板标题、返回按钮、结算标题',
            '支持作者面板计数、排行榜/关卡选择标题'
        ],
        codeRefs: [
            'css/style.css:26 --font-display',
            'css/style.css:137 .wechat-title',
            'css/style.css:976 .btn-play',
            'css/style.css:1275 .panel-title',
            'css/style.css:2308 .popup-title'
        ]
    },
    {
        name: 'Nunito',
        scope: '游戏前台',
        copyright: '免费商用',
        tagClass: '',
        source: 'Google Fonts / OFL-1.1',
        sourceUrl: 'https://github.com/googlefonts/nunito',
        packaged: '否，当前未随包分发',
        usages: [
            '全局正文基础字体',
            '金币数、登录入口、版本号、语言切换',
            '按钮辅助文字、分数增加提示、部分干净 UI 标签'
        ],
        codeRefs: [
            'css/style.css:27 --font-body',
            'css/style.css:28 --font-ui-clean',
            'css/style.css:61 body',
            'css/style.css:254 .coin-chip-value',
            'css/style.css:3085 .menu-avatar-login-link'
        ]
    },
    {
        name: 'Microsoft YaHei',
        scope: '游戏前台 / 管理后台',
        copyright: '系统授权',
        tagClass: 'is-system',
        source: 'Windows 系统字体，随系统授权使用',
        sourceUrl: '',
        packaged: '否，依赖玩家/开发机系统',
        usages: [
            '中文正文和显示字体的 fallback',
            '管理后台全局中文界面字体',
            '后台代码/JSON 区域 fallback'
        ],
        codeRefs: [
            'css/style.css:26 --font-display',
            'css/style.css:27 --font-body',
            'css/admin.css:15 body',
            'css/admin.css:3110 .ui-editor-preview-frame'
        ]
    },
    {
        name: 'PingFang SC',
        scope: '游戏前台',
        copyright: '系统授权',
        tagClass: 'is-system',
        source: 'macOS / iOS 系统字体，随系统授权使用',
        sourceUrl: '',
        packaged: '否，依赖玩家系统',
        usages: [
            '中文正文和干净 UI 字体 fallback',
            '移动端或 macOS 浏览器上的中文显示 fallback'
        ],
        codeRefs: [
            'css/style.css:27 --font-body',
            'css/style.css:28 --font-ui-clean'
        ]
    },
    {
        name: 'Segoe UI',
        scope: '管理后台',
        copyright: '系统授权',
        tagClass: 'is-system',
        source: 'Windows 系统 UI 字体，随系统授权使用',
        sourceUrl: '',
        packaged: '否，依赖开发机系统',
        usages: [
            '管理后台全局界面字体',
            '后台按钮、表格、表单默认文字'
        ],
        codeRefs: [
            'css/admin.css:15 body',
            'css/admin.css:3110 .ui-editor-preview-frame'
        ]
    },
    {
        name: 'SFMono-Regular / Menlo / Monaco / Consolas',
        scope: '游戏前台 / 管理后台',
        copyright: '系统授权',
        tagClass: 'is-system',
        source: '各平台等宽系统字体栈',
        sourceUrl: '',
        packaged: '否，依赖玩家/开发机系统',
        usages: [
            '性能调试文本',
            '后台 JSON、代码、资源路径等宽显示'
        ],
        codeRefs: [
            'css/style.css:3373 .perf-debug-text',
            'css/admin.css:302 textarea/code areas',
            'css/admin.css:2407 table/path fields'
        ]
    },
    {
        name: 'Liberation Mono',
        scope: '游戏前台 / 管理后台',
        copyright: '免费商用',
        tagClass: '',
        source: '开源等宽 fallback 字体',
        sourceUrl: 'https://github.com/liberationfonts/liberation-fonts',
        packaged: '否，依赖运行环境是否存在',
        usages: [
            '性能调试文本 fallback',
            '后台 JSON、代码、资源路径 fallback'
        ],
        codeRefs: [
            'css/style.css:3373 .perf-debug-text',
            'css/admin.css:2407 ui-monospace stack'
        ]
    },
    {
        name: 'sans-serif',
        scope: '游戏前台 / 管理后台',
        copyright: '通用字体族',
        tagClass: 'is-system',
        source: '浏览器通用 fallback，不是具体字体文件',
        sourceUrl: '',
        packaged: '不适用',
        usages: [
            '所有非等宽字体栈最后兜底',
            '防止自定义字体缺失时文字不可读'
        ],
        codeRefs: [
            'css/style.css:26 --font-display',
            'css/style.css:27 --font-body',
            'css/admin.css:15 body'
        ]
    },
    {
        name: 'monospace / ui-monospace',
        scope: '游戏前台 / 管理后台',
        copyright: '通用字体族',
        tagClass: 'is-system',
        source: '浏览器通用等宽 fallback，不是具体字体文件',
        sourceUrl: '',
        packaged: '不适用',
        usages: [
            '性能调试文本兜底',
            '后台代码/JSON/路径兜底'
        ],
        codeRefs: [
            'css/style.css:3373 .perf-debug-text',
            'css/admin.css:2407 ui-monospace stack'
        ]
    }
];

const el = {
    summary: document.getElementById('fontAdminSummary'),
    tableBody: document.getElementById('fontAdminTableBody'),
    search: document.getElementById('fontAdminSearch')
};

let fontRows = FONT_ROWS;
let fontScanMeta = {
    source: 'fallback',
    sourceFiles: ['css/style.css', 'css/admin.css'],
    fontFiles: []
};

function escapeHtml(value) {
    return `${value ?? ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderList(items, className, wrapCode = false) {
    return `<ul class="${className}">${items.map((item) => {
        const content = wrapCode ? `<code>${escapeHtml(item)}</code>` : escapeHtml(item);
        return `<li>${content}</li>`;
    }).join('')}</ul>`;
}

function renderSource(row) {
    const text = escapeHtml(row.source);
    if (!row.sourceUrl) {
        return text;
    }
    return `<a href="${escapeHtml(row.sourceUrl)}" target="_blank" rel="noopener">${text}</a>`;
}

function getFilteredRows() {
    const keyword = `${el.search?.value || ''}`.trim().toLowerCase();
    if (!keyword) {
        return fontRows;
    }
    return fontRows.filter((row) => [
        row.name,
        row.scope,
        row.copyright,
        row.source,
        row.packaged,
        ...(row.usages || []),
        ...(row.codeRefs || [])
    ].join(' ').toLowerCase().includes(keyword));
}

function renderSummary(rows) {
    if (!el.summary) {
        return;
    }
    const freeCount = rows.filter((row) => row.copyright === '免费商用').length;
    const paidCount = rows.filter((row) => row.copyright === '付费商用').length;
    const systemCount = rows.filter((row) => row.copyright !== '免费商用' && row.copyright !== '付费商用').length;
    const scanLabel = fontScanMeta.source === 'server'
        ? `实时扫描：${fontScanMeta.sourceFiles.join(', ')}`
        : '静态兜底：等待开发服务器扫描接口';
    const packagedCount = Array.isArray(fontScanMeta.fontFiles) ? fontScanMeta.fontFiles.length : 0;
    el.summary.innerHTML = `
        <div>字体数量：<strong>${rows.length}</strong></div>
        <div>免费商用：<strong>${freeCount}</strong></div>
        <div>付费商用：<strong>${paidCount}</strong></div>
        <div>系统/通用字体：<strong>${systemCount}</strong></div>
        <div>字体文件：<strong>${packagedCount}</strong></div>
        <div>${escapeHtml(scanLabel)}</div>
    `;
}

function renderTable() {
    if (!el.tableBody) {
        return;
    }
    const rows = getFilteredRows();
    renderSummary(rows);
    if (rows.length <= 0) {
        el.tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="db-admin-empty">没有匹配的字体记录。</div>
                </td>
            </tr>
        `;
        return;
    }

    el.tableBody.innerHTML = rows.map((row) => `
        <tr>
            <td><span class="font-name">${escapeHtml(row.name)}</span></td>
            <td>${escapeHtml(row.scope)}</td>
            <td><span class="font-tag ${escapeHtml(row.tagClass || '')}">${escapeHtml(row.copyright)}</span></td>
            <td>${renderSource(row)}</td>
            <td>${escapeHtml(row.packaged)}</td>
            <td>${renderList(row.usages || [], 'font-usage-list')}</td>
            <td>${renderList(row.codeRefs || [], 'font-code-list', true)}</td>
        </tr>
    `).join('');
}

async function refreshFontRowsFromServer() {
    try {
        const response = await fetch('/api/admin/fonts/scan', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!payload?.ok || !Array.isArray(payload.rows)) {
            throw new Error(payload?.error || 'invalid font scan response');
        }
        fontRows = payload.rows;
        fontScanMeta = {
            source: 'server',
            sourceFiles: Array.isArray(payload.sourceFiles) ? payload.sourceFiles : [],
            fontFiles: Array.isArray(payload.fontFiles) ? payload.fontFiles : []
        };
        renderTable();
    } catch (error) {
        fontScanMeta = {
            ...fontScanMeta,
            source: 'fallback'
        };
        renderTable();
    }
}

function init() {
    if (!el.tableBody) {
        return;
    }
    el.search?.addEventListener('input', renderTable);
    renderTable();
    void refreshFontRowsFromServer();
}

init();

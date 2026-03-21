import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5397/index.html';
const outputDir = path.join(process.cwd(), 'temp', 'playwright-audit-latest');

const viewports = [
    { name: 'iphone-se', width: 320, height: 568 },
    { name: 'iphone-12', width: 390, height: 844 },
    { name: 'mobile-large', width: 430, height: 932 },
    { name: 'tablet', width: 1024, height: 768 },
    { name: 'laptop', width: 1366, height: 768 }
];

function sanitize(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function assertInsideViewport(page, selector, viewport) {
    const box = await page.locator(selector).boundingBox();
    if (!box) {
        return `${selector} is not visible`;
    }

    const epsilon = 1;
    const out =
        box.x < -epsilon ||
        box.y < -epsilon ||
        box.x + box.width > viewport.width + epsilon ||
        box.y + box.height > viewport.height + epsilon;

    if (out) {
        return `${selector} overflows viewport (${viewport.width}x${viewport.height})`;
    }
    return null;
}

async function assertGameplayZones(page, viewport, layoutIssues, tag) {
    const headerBox = await page.locator('.wechat-header').boundingBox();
    const canvasBox = await page.locator('.canvas-wrapper').boundingBox();
    const hudBottomBox = await page.locator('.hud-bottom').boundingBox();

    if (!headerBox || !canvasBox || !hudBottomBox) {
        layoutIssues.push(`${tag}: required gameplay zones are not visible`);
        return;
    }

    if (canvasBox.y < headerBox.y + headerBox.height - 1) {
        layoutIssues.push(`${tag}: canvas overlaps header`);
    }
    if (canvasBox.y + canvasBox.height > hudBottomBox.y + 1) {
        layoutIssues.push(`${tag}: canvas overlaps hud bottom controls`);
    }

    for (const selector of ['.wechat-header', '.canvas-wrapper', '.hud-bottom']) {
        const issue = await assertInsideViewport(page, selector, viewport);
        if (issue) {
            layoutIssues.push(`${tag}: ${issue}`);
        }
    }
}

async function openPanelAndBack(page, openSelector, panelVisibleSelector, backSelector, layoutIssues, viewport) {
    await page.click(openSelector);
    await page.waitForSelector(panelVisibleSelector, { timeout: 10000 });
    const issue = await assertInsideViewport(page, panelVisibleSelector.replace(':not(.hidden)', ''), viewport);
    if (issue) {
        layoutIssues.push(issue);
    }
    await page.click(backSelector);
    await page.waitForSelector('#menuOverlay:not(.hidden)', { timeout: 10000 });
}

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = [];
let hasFailures = false;

for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    const errors = [];
    const requestFailures = [];
    const layoutIssues = [];

    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            errors.push(`console: ${msg.text()}`);
        }
    });
    page.on('requestfailed', (request) => {
        requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'request failed'}`);
    });

    try {
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('#btnPlay', { state: 'visible', timeout: 10000 });

        for (const selector of ['.wechat-header', '#btnPlay']) {
            const issue = await assertInsideViewport(page, selector, viewport);
            if (issue) layoutIssues.push(issue);
        }

        await page.screenshot({
            path: path.join(outputDir, `${sanitize(viewport.name)}-home.png`),
            fullPage: true
        });

        await openPanelAndBack(
            page,
            '#btnSettings',
            '#settingsOverlay:not(.hidden)',
            '#btnBackFromSettings',
            layoutIssues,
            viewport
        );

        await page.click('#btnSettings');
        await page.waitForSelector('#settingsOverlay:not(.hidden)', { timeout: 10000 });
        await page.click('#btnLocaleEn');
        const enLabel = await page.locator('#btnPlay').textContent();
        if (!`${enLabel || ''}`.toLowerCase().includes('start')) {
            layoutIssues.push('language switch to en-US did not update #btnPlay text');
        }
        await page.click('#btnLocaleZh');
        await page.click('#btnBackFromSettings');
        await page.waitForSelector('#menuOverlay:not(.hidden)', { timeout: 10000 });

        await openPanelAndBack(
            page,
            '#btnLeaderboard',
            '#leaderboardOverlay:not(.hidden)',
            '#btnBackFromLeaderboard',
            layoutIssues,
            viewport
        );

        await openPanelAndBack(
            page,
            '#btnSkins',
            '#skinsOverlay:not(.hidden)',
            '#btnBackFromSkins',
            layoutIssues,
            viewport
        );

        await openPanelAndBack(
            page,
            '#btnCheckin',
            '#checkinOverlay:not(.hidden)',
            '#btnBackFromCheckin',
            layoutIssues,
            viewport
        );

        await openPanelAndBack(
            page,
            '#btnExit',
            '#exitOverlay:not(.hidden)',
            '#btnExitCancel',
            layoutIssues,
            viewport
        );

        await page.click('#btnLevels');
        await page.waitForSelector('#levelSelectOverlay:not(.hidden)', { timeout: 10000 });
        await page.screenshot({
            path: path.join(outputDir, `${sanitize(viewport.name)}-levels.png`),
            fullPage: true
        });
        const levelPopupIssue = await assertInsideViewport(page, '.panel-shell-levels', viewport);
        if (levelPopupIssue) layoutIssues.push(levelPopupIssue);

        await page.click('#btnBackFromSelect');
        await page.waitForSelector('#menuOverlay:not(.hidden)', { timeout: 10000 });

        await page.click('#btnPlay');
        await page.waitForSelector('#hud:not(.hidden)', { timeout: 10000 });
        await page.waitForTimeout(200);

        const gameCanvasBox = await page.locator('#gameCanvas').boundingBox();
        if (!gameCanvasBox || gameCanvasBox.width < 120 || gameCanvasBox.height < 120) {
            layoutIssues.push('game canvas area is too small');
        }

        const gameIssue = await assertInsideViewport(page, '.hud-bottom', viewport);
        if (gameIssue) layoutIssues.push(gameIssue);
        await assertGameplayZones(page, viewport, layoutIssues, 'initial');

        if (gameCanvasBox) {
            await page.mouse.click(gameCanvasBox.x + gameCanvasBox.width * 0.5, gameCanvasBox.y + gameCanvasBox.height * 0.5);
            await page.mouse.click(gameCanvasBox.x + gameCanvasBox.width * 0.25, gameCanvasBox.y + gameCanvasBox.height * 0.25);
            await page.mouse.click(gameCanvasBox.x + gameCanvasBox.width * 0.75, gameCanvasBox.y + gameCanvasBox.height * 0.7);
        }

        await page.screenshot({
            path: path.join(outputDir, `${sanitize(viewport.name)}-game.png`),
            fullPage: true
        });

        // Dynamic resize regression: viewport changes during gameplay.
        const resizeTargets = [
            { width: 1000, height: 700 },
            { width: 320, height: 568 },
            { width: 430, height: 932 }
        ];

        for (const target of resizeTargets) {
            await page.setViewportSize(target);
            await page.waitForTimeout(350);
            await assertGameplayZones(page, target, layoutIssues, `resize-${target.width}x${target.height}`);

            const gameOverVisible = await page.locator('#gameOverOverlay:not(.hidden)').isVisible();
            const levelDoneVisible = await page.locator('#levelCompleteOverlay:not(.hidden)').isVisible();
            if (!gameOverVisible && !levelDoneVisible) {
                try {
                    await page.click('#btnHint', { timeout: 3000 });
                    await page.click('#btnUndo', { timeout: 3000 });
                    await page.click('#btnShuffle', { timeout: 3000 });
                } catch (error) {
                    layoutIssues.push(`resize-${target.width}x${target.height}: hud buttons not clickable (${String(error)})`);
                }
            }

            const resizedCanvasBox = await page.locator('#gameCanvas').boundingBox();
            if (resizedCanvasBox) {
                await page.mouse.click(
                    resizedCanvasBox.x + resizedCanvasBox.width * 0.5,
                    resizedCanvasBox.y + resizedCanvasBox.height * 0.5
                );
            }

            await page.screenshot({
                path: path.join(outputDir, `${sanitize(viewport.name)}-resize-${target.width}x${target.height}.png`),
                fullPage: true
            });
        }
    } catch (error) {
        errors.push(`test runner error: ${String(error)}`);
    }

    if (errors.length || requestFailures.length || layoutIssues.length) {
        hasFailures = true;
    }

    report.push({
        viewport,
        errors,
        requestFailures,
        layoutIssues
    });

    await context.close();
}

await browser.close();

await fs.writeFile(
    path.join(outputDir, 'report.json'),
    JSON.stringify(
        {
            baseUrl,
            createdAt: new Date().toISOString(),
            report
        },
        null,
        2
    ),
    'utf8'
);

if (hasFailures) {
    process.exitCode = 1;
}

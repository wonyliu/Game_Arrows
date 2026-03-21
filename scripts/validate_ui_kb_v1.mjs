import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TOKENS_PATH = path.join(ROOT, 'assets', 'design-v5', 'kb_tokens.v1.json');
const COMPONENTS_PATH = path.join(ROOT, 'assets', 'design-v5', 'kb_components.v1.json');
const LAYOUTS_PATH = path.join(ROOT, 'assets', 'design-v5', 'kb_layouts.v1.json');
const PROMPTS_V2_PATH = path.join(ROOT, 'scripts', 'design-v5-prompts-v2.json');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'design-v5', 'manifest.json');
const UI_PATH = path.join(ROOT, 'js', 'ui.js');

const REQUIRED_SCREEN_IDS = ['HOME', 'SETTINGS', 'LEADERBOARD', 'SKINS', 'CHECKIN', 'EXIT_CONFIRM'];
const REQUIRED_COMPONENT_IDS = [
    'primary_cta_button',
    'feature_card',
    'resource_capsule',
    'badge_indicator',
    'panel_header',
    'bottom_nav_item'
];

async function main() {
    const [tokens, components, layouts, prompts, manifest, uiSource] = await Promise.all([
        readJson(TOKENS_PATH),
        readJson(COMPONENTS_PATH),
        readJson(LAYOUTS_PATH),
        readJson(PROMPTS_V2_PATH),
        readJson(MANIFEST_PATH),
        fs.readFile(UI_PATH, 'utf8')
    ]);

    const errors = [];
    const warnings = [];

    validateSchemas(tokens, components, layouts, prompts, errors);

    const componentMap = validateComponents(tokens, components, errors, warnings);
    validateLayouts(tokens, componentMap, layouts, errors, warnings);
    validateFeatureAlignment(layouts, uiSource, errors);
    validatePrompts(prompts, manifest, errors, warnings);

    if (errors.length === 0) {
        console.log('✅ UI KB V1 validation passed');
    } else {
        console.error('❌ UI KB V1 validation failed');
    }

    if (warnings.length > 0) {
        console.log('\nWarnings:');
        for (const warning of warnings) {
            console.log(`- ${warning}`);
        }
    }

    if (errors.length > 0) {
        console.error('\nErrors:');
        for (const error of errors) {
            console.error(`- ${error}`);
        }
        process.exit(1);
    }
}

function validateSchemas(tokens, components, layouts, prompts, errors) {
    if (tokens?.schema !== 'KbTokensV1') {
        errors.push('kb_tokens.v1.json schema must be "KbTokensV1"');
    }
    if (components?.schema !== 'KbComponentRecipeV1') {
        errors.push('kb_components.v1.json schema must be "KbComponentRecipeV1"');
    }
    if (layouts?.schema !== 'KbLayoutTemplateV1') {
        errors.push('kb_layouts.v1.json schema must be "KbLayoutTemplateV1"');
    }
    if (`${prompts?.promptVersion || ''}` !== 'v2') {
        errors.push('design-v5-prompts-v2.json promptVersion must be "v2"');
    }
}

function validateComponents(tokens, components, errors, warnings) {
    const list = Array.isArray(components?.components) ? components.components : [];
    if (list.length === 0) {
        errors.push('kb_components.v1.json components cannot be empty');
    }

    const map = new Map();
    for (const item of list) {
        if (!item?.id) {
            errors.push('component id is missing');
            continue;
        }
        if (map.has(item.id)) {
            errors.push(`duplicate component id: ${item.id}`);
            continue;
        }
        map.set(item.id, item);

        const refs = Array.isArray(item.tokenRefs) ? item.tokenRefs : [];
        for (const ref of refs) {
            if (!hasTokenPath(tokens, ref)) {
                errors.push(`component ${item.id} has unresolved tokenRef: ${ref}`);
            }
        }

        if (item.interactive) {
            const hitArea = item.layout?.hitArea;
            if (!hitArea) {
                warnings.push(`component ${item.id} is interactive but has no explicit hitArea`);
            } else if (hitArea.width < 44 || hitArea.height < 44) {
                errors.push(`component ${item.id} hitArea must be >= 44x44`);
            }
        }
    }

    for (const required of REQUIRED_COMPONENT_IDS) {
        if (!map.has(required)) {
            errors.push(`missing required component recipe: ${required}`);
        }
    }

    return map;
}

function validateLayouts(tokens, componentMap, layouts, errors, warnings) {
    const screens = Array.isArray(layouts?.screens) ? layouts.screens : [];
    const screenMap = new Map();
    for (const screen of screens) {
        if (!screen?.screenId) {
            errors.push('screenId is missing in kb_layouts');
            continue;
        }
        if (screenMap.has(screen.screenId)) {
            errors.push(`duplicate screenId: ${screen.screenId}`);
            continue;
        }
        screenMap.set(screen.screenId, screen);
    }

    for (const required of REQUIRED_SCREEN_IDS) {
        if (!screenMap.has(required)) {
            errors.push(`missing required screen layout: ${required}`);
        }
    }

    const maxPrimaryCta = Number(tokens?.density?.maxPrimaryCtaPerScreen || 1);
    const maxBadges = Number(tokens?.density?.maxVisibleBadgesPerScreen || 2);
    const minTap = Number(tokens?.interaction?.minTapArea || 44);

    for (const screen of screens) {
        const zones = Array.isArray(screen.zones) ? screen.zones : [];
        const zoneIds = new Set(zones.map((z) => z.id));

        for (const ref of screen.tokenRefs || []) {
            if (!hasTokenPath(tokens, ref)) {
                errors.push(`screen ${screen.screenId} has unresolved tokenRef: ${ref}`);
            }
        }

        const instances = Array.isArray(screen.components) ? screen.components : [];
        let primaryCtaCount = 0;
        let featureEntryCount = 0;

        for (const instance of instances) {
            if (!componentMap.has(instance.componentId)) {
                errors.push(`screen ${screen.screenId} references unknown componentId: ${instance.componentId}`);
                continue;
            }
            if (!zoneIds.has(instance.zoneId)) {
                errors.push(`screen ${screen.screenId} instance ${instance.instanceId} references unknown zone: ${instance.zoneId}`);
            }

            if (instance.role === 'primaryCta') {
                primaryCtaCount += 1;
            }
            if (instance.role === 'featureEntry') {
                featureEntryCount += 1;
            }

            const interactive = instance.interactive || componentMap.get(instance.componentId)?.interactive;
            if (interactive) {
                const hit = instance.tapArea || componentMap.get(instance.componentId)?.layout?.hitArea;
                if (!hit) {
                    warnings.push(`screen ${screen.screenId} interactive instance ${instance.instanceId} has no tapArea`);
                } else if (hit.width < minTap || hit.height < minTap) {
                    errors.push(`screen ${screen.screenId} instance ${instance.instanceId} tapArea must be >= ${minTap}x${minTap}`);
                }
            }
        }

        if (primaryCtaCount > maxPrimaryCta) {
            errors.push(`screen ${screen.screenId} has ${primaryCtaCount} primary CTA(s), max allowed is ${maxPrimaryCta}`);
        }
        if (screen.screenId === 'HOME' && primaryCtaCount !== 1) {
            errors.push('HOME must have exactly 1 primary CTA');
        }
        if (featureEntryCount > Number(tokens?.density?.maxFeatureEntriesSameLayer || 6)) {
            errors.push(`screen ${screen.screenId} has too many feature entries: ${featureEntryCount}`);
        }

        const visibleBadges = screen?.badgePolicy?.defaultVisibleBadges || [];
        if (visibleBadges.length > maxBadges) {
            errors.push(`screen ${screen.screenId} has ${visibleBadges.length} default visible badges, max is ${maxBadges}`);
        }
    }
}

function validateFeatureAlignment(layouts, uiSource, errors) {
    const featureBlock = uiSource.match(/const FEATURE_CONFIG = Object\.freeze\(\[([\s\S]*?)\]\);/);
    if (!featureBlock) {
        errors.push('cannot parse FEATURE_CONFIG from js/ui.js');
        return;
    }

    const uiFeatureIds = [
        ...featureBlock[1].matchAll(/id:\s*'([^']+)'/g)
    ].map((match) => match[1]).sort();

    const home = (layouts?.screens || []).find((screen) => screen.screenId === 'HOME');
    if (!home) return;

    const layoutFeatureIds = (home.components || [])
        .filter((item) => item.role === 'featureEntry')
        .map((item) => item.featureId)
        .sort();

    if (uiFeatureIds.join(',') !== layoutFeatureIds.join(',')) {
        errors.push(
            `HOME feature IDs mismatch between kb_layouts and FEATURE_CONFIG (kb=${layoutFeatureIds.join('|')} ui=${uiFeatureIds.join('|')})`
        );
    }
}

function validatePrompts(prompts, manifest, errors, warnings) {
    const assets = Array.isArray(prompts?.assets) ? prompts.assets : [];
    if (assets.length === 0) {
        errors.push('design-v5-prompts-v2.json assets cannot be empty');
        return;
    }

    const slots = {
        ...(manifest?.slots || {}),
        ...(manifest?.fallbackSlots || {})
    };

    for (const asset of assets) {
        if (!asset.slot) {
            errors.push('prompt asset missing slot');
            continue;
        }

        if (!slots[asset.slot]) {
            warnings.push(`prompt slot ${asset.slot} is not present in current manifest/fallback slots`);
        }

        if (!asset.prompt || !asset.negativePrompt) {
            errors.push(`prompt asset ${asset.slot} must define prompt and negativePrompt`);
        }

        if (!asset.readabilityHint || !asset.safeAreaHint) {
            warnings.push(`prompt asset ${asset.slot} should include readabilityHint and safeAreaHint`);
        }
    }

    const samples = Array.isArray(prompts.sampleSlotsForQA) ? prompts.sampleSlotsForQA : [];
    if (samples.length < 3 || samples.length > 5) {
        errors.push('sampleSlotsForQA must contain 3-5 slots');
    }
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    const normalized = raw.replace(/^\uFEFF/, '');
    return JSON.parse(normalized);
}

function hasTokenPath(tokens, refPath) {
    if (!refPath || typeof refPath !== 'string') {
        return false;
    }

    const parts = refPath.split('.');
    let cur = tokens;
    for (const part of parts) {
        if (!cur || typeof cur !== 'object' || !(part in cur)) {
            return false;
        }
        cur = cur[part];
    }
    return true;
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
});

import { buildPlayableLevel, buildClassicReverseLevel } from '../js/level-builder.js';
import { countCoveredCells, isVerticalDirection } from '../js/level-builder.js';

const config = {
    gridCols: 19,
    gridRows: 30,
    minLen: 2,
    maxLen: 12,
    colors: ['#1a1c3c'],
};

console.log(`Starting Small Grid Verification for ${config.gridCols}x${config.gridRows}...`);

const lines = buildClassicReverseLevel(config);
if (lines) {
    console.log(`SUCCESS: Generated ${lines.length} lines.`);
    const v = lines.filter(l => l.getHeadDirection() === 'up' || l.getHeadDirection() === 'down').length;
    const h = lines.length - v;
    console.log(`Vertical: ${v}, Horizontal: ${h} (Ratio: ${(v/lines.length*100).toFixed(1)}% V)`);
    console.log(`Coverage: ${(countCoveredCells(lines) / (config.gridCols * config.gridRows) * 100).toFixed(1)}%`);
} else {
    console.log('FAILED: Could not generate level.');
}

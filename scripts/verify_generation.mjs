import { buildPlayableLevel } from '../js/level-builder.js';
import { summarizeDirections, countCoveredCells } from '../js/level-builder.js';

const config = {
    gridCols: 19,
    gridRows: 30,
    minLen: 1,
    maxLen: 12,
    colors: ['#1a1c3c'],
    level: 3
};

console.log(`Starting Final Quality Verification for ${config.gridCols}x${config.gridRows} grid...`);

const BATCH_SIZE = 5;
let totalCoverage = 0;
const totalDirections = { up: 0, down: 0, left: 0, right: 0 };
const lengthStats = {};

for (let i = 0; i < BATCH_SIZE; i++) {
    const lines = buildPlayableLevel(config);
    const covered = countCoveredCells(lines);
    const coverage = covered / (config.gridCols * config.gridRows);
    const directions = summarizeDirections(lines);

    totalCoverage += coverage;
    for (const d in directions) {
        totalDirections[d] += directions[d];
    }
    for (const line of lines) {
        const len = line.cells.length;
        lengthStats[len] = (lengthStats[len] || 0) + 1;
    }

    console.log(`Run ${i + 1}: Coverage=${(coverage * 100).toFixed(1)}%, Lines=${lines.length}`);
}

const avgCoverage = totalCoverage / BATCH_SIZE;
const totalDirCount = Object.values(totalDirections).reduce((a, b) => a + b, 0);

console.log('\n--- Final Stats ---');
console.log(`Average Coverage: ${(avgCoverage * 100).toFixed(2)}%`);
console.log('Direction Distribution:');
for (const d in totalDirections) {
    const pct = (totalDirections[d] / totalDirCount * 100).toFixed(1);
    console.log(`  ${d}: ${totalDirections[d]} (${pct}%)`);
}

console.log('\nLength Distribution:');
const sortedLens = Object.keys(lengthStats).map(Number).sort((a, b) => a - b);
for (const len of sortedLens) {
    const count = lengthStats[len];
    console.log(`  Len ${len}: ${count}`);
}

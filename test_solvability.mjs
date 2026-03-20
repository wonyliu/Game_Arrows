
import { Grid } from './js/grid.js';
import { Line } from './js/line.js';
import { canMove } from './js/collision.js';
import { buildClassicReverseLevel } from './js/level-builder.js';

async function testGeneration() {
    console.log("Starting solvability self-test...");
    const config = {
        gridCols: 19,
        gridRows: 30,
        minLen: 2,
        maxLen: 12,
        fillRatio: 1.0,
        colors: ['#1a1c3c']
    };

    for (let i = 0; i < 3; i++) {
        console.log(`\n--- Test Run ${i + 1} ---`);
        const lines = buildClassicReverseLevel(config);
        
        if (!lines) {
            console.log("Failed: Generator returned null (solvability check failed 15 times).");
            continue;
        }
        console.log(`Success: Generated ${lines.length} lines.`);
    }
}

testGeneration().catch(console.error);

import { spawn } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const skipGenerate = args.includes('--prepare-only');
const skipPrepare = args.includes('--generate-only');

async function main() {
    const forwarded = args.filter((arg) => arg !== '--prepare-only' && arg !== '--generate-only');

    if (!skipGenerate) {
        await run('node', ['scripts/generate_design_v5_gemini.mjs', ...forwarded]);
    }

    if (!skipPrepare) {
        await run('python', ['scripts/prepare_design_v5.py', ...forwarded]);
    }

    console.log('Design-v5 pipeline completed.');
}

function run(command, commandArgs) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, commandArgs, {
            stdio: 'inherit',
            shell: process.platform === 'win32'
        });

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} exited with code ${code}`));
            }
        });
    });
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
});

import { copyFile } from 'node:fs/promises';

const source = 'SKYHAWK_ARENA_SHARE.html';
const destination = 'dist/SKYHAWK_ARENA_SHARE.html';
await copyFile(source, destination);
console.log(`Copied ${source} to ${destination}`);

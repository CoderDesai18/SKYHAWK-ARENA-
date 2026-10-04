import { build } from 'vite';
import { copyFile, rm } from 'node:fs/promises';

const outputDirectory = 'dist-share';
const deliverable = 'SKYHAWK_ARENA_SHARE.html';

try {
  await build({ configFile: 'vite.singlefile.config.ts' });
  await copyFile(`${outputDirectory}/share.html`, deliverable);
  console.log(`Created ${deliverable}`);
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}

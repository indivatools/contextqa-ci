// Bundles the CLI into one dependency-free file for the container image.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(`${root}packages/cli/package.json`, 'utf8'));

await build({
  entryPoints: [`${root}packages/cli/src/bin.ts`],
  outfile: `${root}build/contextqa.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  define: { __CLI_VERSION__: JSON.stringify(version) },
  alias: { '@contextqa/ci-core': `${root}packages/core/src/index.ts` },
  logLevel: 'warning',
});

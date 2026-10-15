// Bundles the GitHub Action into one committed file, as the Actions runtime
// loads it straight from the repository with no install step.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

await build({
  entryPoints: [`${root}packages/github-action/src/index.ts`],
  outfile: `${root}dist/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  // Bundled CommonJS dependencies still call require() for Node built-ins.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  alias: { '@contextqa/ci-core': `${root}packages/core/src/index.ts` },
  legalComments: 'linked',
  logLevel: 'warning',
});

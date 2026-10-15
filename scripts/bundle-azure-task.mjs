// Bundles the Azure Pipelines task next to its task.json, ready for
// `tfx extension create`. The output is a build artifact and is not committed.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

await build({
  entryPoints: [`${root}packages/azure-devops-task/src/index.ts`],
  // CommonJS, because the agent runs the target with plain `node` and the task
  // folder ships without a package.json to mark it as ESM.
  outfile: `${root}providers/azure-devops/ContextQARunTestPlan/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  alias: { '@contextqa/ci-core': `${root}packages/core/src/index.ts` },
  logLevel: 'warning',
});

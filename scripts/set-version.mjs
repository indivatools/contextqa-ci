// Stamps one release version on every package and provider manifest.
// Usage: node scripts/set-version.mjs 1.2.3
// Runs in the release workflow after `npm ci`, so the lockfile is not touched.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const root = fileURLToPath(new URL('..', import.meta.url));

const version = process.argv[2] ?? '';
const match = SEMVER.exec(version);
if (!match) {
  console.error(`usage: set-version.mjs <major.minor.patch>, got "${version}"`);
  process.exit(2);
}
const [, major, minor, patch] = match.map(Number);

function update(path, change) {
  const file = `${root}${path}`;
  const json = JSON.parse(readFileSync(file, 'utf8'));
  change(json);
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`${path} -> ${version}`);
}

for (const pkg of ['core', 'cli', 'github-action', 'azure-devops-task']) {
  update(`packages/${pkg}/package.json`, (json) => {
    json.version = version;
    if (json.dependencies?.['@contextqa/ci-core']) json.dependencies['@contextqa/ci-core'] = version;
  });
}
update('providers/azure-devops/vss-extension.json', (json) => {
  json.version = version;
});
update('providers/azure-devops/ContextQARunTestPlan/task.json', (json) => {
  json.version = { Major: major, Minor: minor, Patch: patch };
});

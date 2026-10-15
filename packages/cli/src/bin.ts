#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { main } from './main.js';

/** Set by the single-file bundle (scripts/bundle-cli.mjs), which has no package.json beside it. */
declare const __CLI_VERSION__: string | undefined;

function version(): string {
  if (typeof __CLI_VERSION__ === 'string') return __CLI_VERSION__;
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  return pkg.version;
}

process.exitCode = await main(process.argv.slice(2), process.env, version());

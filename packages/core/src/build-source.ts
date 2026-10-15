import type { BuildSource } from './types.js';

const URL_PATTERN = /^https?:\/\//i;

/** A URL is handed to the server as-is; anything else is a local file to upload. */
export function toBuildSource(value: string | undefined): BuildSource | undefined {
  if (!value) return undefined;
  return URL_PATTERN.test(value) ? { kind: 'url', url: value } : { kind: 'file', path: value };
}

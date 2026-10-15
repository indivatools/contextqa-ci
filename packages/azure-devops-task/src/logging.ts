/**
 * Azure Pipelines logging commands (`##vso[...]`). The agent parses these from
 * stdout, so the task needs no SDK. Property and message values are escaped
 * as the agent expects, so a test name cannot inject a second command.
 * https://learn.microsoft.com/azure/devops/pipelines/scripts/logging-commands
 */
export function command(name: string, properties: Record<string, string>, message = ''): string {
  const props = Object.entries(properties)
    .map(([key, value]) => `${key}=${escapeProperty(value)};`)
    .join('');
  return `##vso[${name}${props ? ` ${props}` : ''}]${escapeMessage(message)}`;
}

/** Azure derives an input's environment variable as INPUT_ + upper-cased name, with spaces and dots as `_`. */
export function inputVariable(name: string): string {
  return `INPUT_${name.replace(/[ .]/g, '_').toUpperCase()}`;
}

function escapeMessage(value: string): string {
  return value.replace(/%/g, '%AZP25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeProperty(value: string): string {
  return escapeMessage(value).replace(/;/g, '%3B').replace(/]/g, '%5D');
}

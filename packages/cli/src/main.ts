import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  ContextQAError,
  ExitCode,
  RunTimeoutError,
  exitCodeFor,
  runTestPlan,
  toJUnitXml,
  type ExitCodeValue,
  type Reporter,
  type RunDeps,
  type RunSummary,
} from '@contextqa/ci-core';
import { HELP, parseCommand, type CliConfig } from './args.js';

export interface Io {
  out(line: string): void;
  err(line: string): void;
}

export const consoleIo: Io = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

export async function main(
  argv: string[],
  env: Record<string, string | undefined>,
  version: string,
  io: Io = consoleIo,
  deps: RunDeps = {},
): Promise<ExitCodeValue> {
  try {
    const command = parseCommand(argv, env);
    if (command.kind === 'help') {
      io.out(HELP);
      return ExitCode.PASSED;
    }
    if (command.kind === 'version') {
      io.out(version);
      return ExitCode.PASSED;
    }
    return await runPlan(command.config, io, deps);
  } catch (error) {
    return reportError(error, io);
  }
}

async function runPlan(config: CliConfig, io: Io, deps: RunDeps): Promise<ExitCodeValue> {
  const reporter: Reporter = { info: io.out, warn: (message) => io.err(`WARNING: ${message}`) };
  const summary = await runTestPlan(config.run, reporter, deps);

  if (config.jsonPath) await writeOutput(config.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  if (!config.run.wait) return ExitCode.PASSED;

  if (config.junitPath) await writeOutput(config.junitPath, toJUnitXml(summary, config.run.planId));
  io.out(finalLine(summary));
  if (summary.reportUrl) io.out(`Report: ${summary.reportUrl}`);

  const code = exitCodeFor(summary, config.failOn);
  if (code !== ExitCode.PASSED) io.err(`ERROR: test plan result was ${summary.results?.result ?? 'unknown'}`);
  return code;
}

function finalLine(summary: RunSummary): string {
  const r = summary.results;
  if (!r) return `Run ${summary.runId} triggered`;
  return `Run ${summary.runId} finished: ${r.result} (${r.passedCount} passed, ${r.failedCount} failed of ${r.totalCount})`;
}

async function writeOutput(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

function reportError(error: unknown, io: Io): ExitCodeValue {
  if (error instanceof RunTimeoutError && error.reportUrl) {
    io.err(`ERROR: ${error.message}. It is still running: ${error.reportUrl}`);
    return error.exitCode;
  }
  if (error instanceof ContextQAError) {
    io.err(`ERROR: ${error.message}`);
    return error.exitCode;
  }
  // parseArgs throws TypeErrors with ERR_PARSE_ARGS_* codes for bad flags.
  if (error instanceof TypeError && String((error as { code?: unknown }).code).startsWith('ERR_PARSE_ARGS')) {
    io.err(`ERROR: ${error.message}`);
    return ExitCode.CONFIG_ERROR;
  }
  io.err(`ERROR: unexpected failure: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  return ExitCode.INFRA_ERROR;
}

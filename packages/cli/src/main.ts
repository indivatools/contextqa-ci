import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  ContextQAError,
  ExitCode,
  RunTimeoutError,
  exitCodeFor,
  logLine,
  renderLog,
  runTestPlan,
  toJUnitXml,
  type ExitCodeValue,
  type Reporter,
  type RunDeps,
} from '@contextqa-inc/ci-core';
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
  // Progress and warnings carry server text (run links, statuses, error bodies) into the log too.
  const reporter: Reporter = { info: (message) => io.out(logLine(message)), warn: (message) => io.err(logLine(`WARNING: ${message}`)) };
  const summary = await runTestPlan(config.run, reporter, deps);

  if (config.jsonPath) await writeOutput(config.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  if (!config.run.wait) return ExitCode.PASSED;

  if (config.junitPath) await writeOutput(config.junitPath, toJUnitXml(summary, config.run.planId));
  for (const line of renderLog(summary, config.view)) io.out(line);

  const code = exitCodeFor(summary, config.failOn);
  if (code !== ExitCode.PASSED) io.err(logLine(`ERROR: test plan result was ${summary.results?.result ?? 'unknown'}`));
  return code;
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

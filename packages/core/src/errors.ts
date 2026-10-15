/**
 * Process exit codes shared by every wrapper, so a pipeline can tell "the tests
 * failed" apart from "we never got a verdict".
 */
export const ExitCode = {
  PASSED: 0,
  TESTS_FAILED: 1,
  CONFIG_ERROR: 2,
  INFRA_ERROR: 3,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export abstract class ContextQAError extends Error {
  abstract readonly exitCode: ExitCodeValue;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Bad input, a missing file, or a credential the server refused. Retrying will not help. */
export class ConfigError extends ContextQAError {
  readonly exitCode = ExitCode.CONFIG_ERROR;
}

/** The server or network failed, or the run did not finish in time. */
export class InfraError extends ContextQAError {
  readonly exitCode = ExitCode.INFRA_ERROR;
}

/** An HTTP response the client does not treat as success. */
export class HttpError extends InfraError {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    readonly body: string,
  ) {
    super(`${endpoint} returned HTTP ${status}${body ? `: ${body}` : ''}`);
  }
}

export class AuthError extends ConfigError {}

export class RunTimeoutError extends InfraError {
  constructor(
    readonly runId: number,
    readonly timeoutSeconds: number,
    readonly reportUrl: string | undefined,
  ) {
    super(`run ${runId} did not finish within ${timeoutSeconds}s`);
  }
}

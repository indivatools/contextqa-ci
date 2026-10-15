import { ExitCode, type ExitCodeValue } from './errors.js';
import type { RunSummary } from './types.js';

/** `failure`: a non-passing run fails the job. `never`: report only. */
export type FailOn = 'failure' | 'never';

export const FAIL_ON_VALUES: readonly FailOn[] = ['failure', 'never'];

/**
 * Gate on the run's verdict, not its failure count: an aborted or stopped run
 * reports zero failures but is not a pass.
 */
export function exitCodeFor(summary: RunSummary, failOn: FailOn): ExitCodeValue {
  if (summary.passed || failOn === 'never') return ExitCode.PASSED;
  return ExitCode.TESTS_FAILED;
}

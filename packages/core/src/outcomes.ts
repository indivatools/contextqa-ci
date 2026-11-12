import type { RunResults, RunSummary, TestCaseOutcome } from './types.js';

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const NOT_PASSING = new Set(['FAILURE', 'ABORTED']);

export const PASSED_RESULT = 'SUCCESS';
/**
 * Characters server text must not carry into a log or a summary: C0 and C1 controls other than tab and
 * line breaks (which callers fold into spaces), since they can drive a terminal (U+0085 is also
 * whitespace to the GitHub runner), and the bidi controls that can make a line read as something else.
 */
export const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
/** The suite a test case is reported under when the server sends none. */
export const DEFAULT_SUITE = 'ContextQA';

/** One thing known about a failure. The test case's own message comes first and has no label. */
export interface FailureFact {
  label?: string;
  text: string;
}

/** A failed or aborted test case: one that deserves an annotation and a place in every report. */
export function isFailing(t: TestCaseOutcome): boolean {
  return NOT_PASSING.has(t.result);
}

/** Test cases that deserve an inline error annotation. */
export function failingTests(summary: RunSummary): TestCaseOutcome[] {
  return (summary.testCases ?? []).filter(isFailing);
}

/** What went wrong with a failing test: its short message, else its failed step's error, else its result. */
export function failureText(t: TestCaseOutcome): string {
  return t.message || t.failedStep?.message || t.result;
}

/** The error and the step it happened on, in one line. */
export function shortFailure(t: TestCaseOutcome): string {
  const step = t.failedStep;
  return [t.message || step?.message || '', step?.step ? `(failed step: ${step.step})` : ''].filter(Boolean).join(' ');
}

/** The test case's message, then what is known of the step that failed. */
export function failureFacts(t: TestCaseOutcome): FailureFact[] {
  const step = t.failedStep;
  const facts: (FailureFact | undefined)[] = [
    t.message ? { text: t.message } : undefined,
    step?.step ? { label: `Failed step${step.stepIndex ? ` ${step.stepIndex}` : ''}`, text: step.step } : undefined,
    step?.message && step.message !== t.message ? { label: 'Error', text: step.message } : undefined,
    step?.expected && step.expected !== step.step ? { label: 'Expected', text: step.expected } : undefined,
    step?.type ? { label: 'Type', text: step.type } : undefined,
    step?.exception ? { label: 'Exception', text: step.exception } : undefined,
  ];
  return facts.filter((fact): fact is FailureFact => fact !== undefined);
}

/** Test cases grouped by suite, each suite in the order it first appears. */
export function bySuite(testCases: TestCaseOutcome[]): Map<string, TestCaseOutcome[]> {
  const suites = new Map<string, TestCaseOutcome[]>();
  for (const testCase of testCases) {
    const suite = testCase.suite || DEFAULT_SUITE;
    const cases = suites.get(suite);
    if (cases) cases.push(testCase);
    else suites.set(suite, [testCase]);
  }
  return suites;
}

/** Where a test case ran, as `Web - Chrome` or `Android - Pixel 9`; '' when the server did not say. */
export function deviceLabel(t: TestCaseOutcome): string {
  return [t.platform, t.device].filter(Boolean).join(' - ');
}

/** Test cases grouped by the device they ran on, each device in the order it first appears. */
export function byDevice(testCases: TestCaseOutcome[]): Map<string, TestCaseOutcome[]> {
  const devices = new Map<string, TestCaseOutcome[]>();
  for (const testCase of testCases) {
    const device = deviceLabel(testCase);
    if (!device) continue;
    const cases = devices.get(device);
    if (cases) cases.push(testCase);
    else devices.set(device, [testCase]);
  }
  return devices;
}

/** How many of these test cases passed, as "1 of 2 passed". */
export function passedOf(testCases: TestCaseOutcome[]): string {
  return `${testCases.filter((t) => t.result === PASSED_RESULT).length} of ${testCases.length} passed`;
}

/** At most `max` characters, the last of them an ellipsis when the text was cut. */
export function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

/** The run's start-to-end time, else (from servers that send no times) its tests' time added up. */
export function runTime(r: RunResults): number {
  return r.wallClockMs ?? r.duration ?? 0;
}

/** Whole seconds, rounded down like ContextQA's "Total Plan Duration". */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / MS_PER_SECOND);
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  return minutes > 0 ? `${minutes}m ${total % SECONDS_PER_MINUTE}s` : `${total}s`;
}

import type { RunSummary, TestCaseOutcome } from './types.js';

const MS_PER_SECOND = 1_000;
const DEFAULT_SUITE = 'ContextQA';
const FAILED_RESULTS = new Set(['FAILURE']);
const ERRORED_RESULTS = new Set(['ABORTED']);
const PASSED_RESULT = 'SUCCESS';

/**
 * JUnit XML that GitLab, CircleCI, Azure DevOps, Bitbucket and Jenkins all
 * render natively. Without per-test detail (CI token), the whole run becomes a
 * single test case so the CI test tab still shows the verdict.
 */
export function toJUnitXml(summary: RunSummary, planId: string): string {
  const cases = summary.testCases ?? [syntheticCase(summary, planId)];
  const suites = groupBySuite(cases);

  const totals = tally(cases);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="ContextQA test plan ${xmlAttr(planId)}" tests="${cases.length}" failures="${totals.failures}" errors="${totals.errors}" skipped="${totals.skipped}" time="${seconds(totals.durationMs)}">`,
  ];
  for (const [suite, suiteCases] of suites) {
    const t = tally(suiteCases);
    lines.push(
      `  <testsuite name="${xmlAttr(suite)}" tests="${suiteCases.length}" failures="${t.failures}" errors="${t.errors}" skipped="${t.skipped}" time="${seconds(t.durationMs)}">`,
    );
    for (const testCase of suiteCases) lines.push(...renderCase(suite, testCase));
    lines.push('  </testsuite>');
  }
  lines.push('</testsuites>', '');
  return lines.join('\n');
}

function renderCase(suite: string, testCase: TestCaseOutcome): string[] {
  const open = `    <testcase name="${xmlAttr(testCase.name)}" classname="${xmlAttr(suite)}" time="${seconds(testCase.durationMs)}"`;
  if (testCase.result === PASSED_RESULT) return [`${open}/>`];

  const message = testCase.message || testCase.result || 'no result';
  const detail = [testCase.message, testCase.traceViewerUrl ? `Trace: ${testCase.traceViewerUrl}` : '']
    .filter(Boolean)
    .join('\n');
  const tag = FAILED_RESULTS.has(testCase.result) ? 'failure' : ERRORED_RESULTS.has(testCase.result) ? 'error' : 'skipped';
  return [
    `${open}>`,
    `      <${tag} message="${xmlAttr(message)}" type="${xmlAttr(testCase.result)}">${xmlText(detail)}</${tag}>`,
    '    </testcase>',
  ];
}

function syntheticCase(summary: RunSummary, planId: string): TestCaseOutcome {
  const results = summary.results;
  const verdict = results?.result ?? 'NOT_EXECUTED';
  const message = results
    ? `${verdict}: ${results.passedCount} passed, ${results.failedCount} failed of ${results.totalCount}`
    : verdict;
  return {
    id: summary.runId,
    name: `Test plan ${planId} (run ${summary.runId})`,
    suite: DEFAULT_SUITE,
    // Without detail, any non-pass must surface as a failure, or the test tab hides it.
    result: summary.passed ? PASSED_RESULT : 'FAILURE',
    durationMs: results?.duration ?? 0,
    message,
    traceViewerUrl: summary.reportUrl,
  };
}

function groupBySuite(cases: TestCaseOutcome[]): Map<string, TestCaseOutcome[]> {
  const suites = new Map<string, TestCaseOutcome[]>();
  for (const testCase of cases) {
    const suite = testCase.suite || DEFAULT_SUITE;
    suites.set(suite, [...(suites.get(suite) ?? []), testCase]);
  }
  return suites;
}

function tally(cases: TestCaseOutcome[]): { failures: number; errors: number; skipped: number; durationMs: number } {
  let failures = 0;
  let errors = 0;
  let skipped = 0;
  let durationMs = 0;
  for (const testCase of cases) {
    durationMs += testCase.durationMs;
    if (testCase.result === PASSED_RESULT) continue;
    if (FAILED_RESULTS.has(testCase.result)) failures++;
    else if (ERRORED_RESULTS.has(testCase.result)) errors++;
    else skipped++;
  }
  return { failures, errors, skipped, durationMs };
}

function seconds(ms: number): string {
  return (ms / MS_PER_SECOND).toFixed(3);
}

// XML 1.0 forbids most control characters even when escaped.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function xmlText(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function xmlAttr(value: string): string {
  return xmlText(value).replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
}

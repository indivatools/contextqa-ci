import { describe, expect, it } from 'vitest';
import { exitCodeFor } from '../src/gate.js';
import { toJUnitXml } from '../src/junit.js';
import type { RunResults, RunSummary, TestCaseOutcome } from '../src/types.js';

const baseResults: RunResults = {
  status: 'STATUS_COMPLETED',
  result: 'FAILURE',
  duration: 5000,
  totalCount: 4,
  passedCount: 1,
  failedCount: 1,
  abortedCount: 1,
  stoppedCount: 0,
  notExecutedCount: 1,
  reportFileUrl: 'https://app.example.com/td/runs/9',
};

function outcome(id: number, result: string, extra: Partial<TestCaseOutcome> = {}): TestCaseOutcome {
  return { id, name: `Case ${id}`, suite: 'Checkout', result, durationMs: 1250, message: '', ...extra };
}

describe('toJUnitXml', () => {
  it('maps each verdict to the matching JUnit element and groups by suite', () => {
    const summary: RunSummary = {
      runId: 9,
      results: baseResults,
      passed: false,
      testCases: [
        outcome(1, 'SUCCESS'),
        outcome(2, 'FAILURE', { message: 'Expected <b> & "quote"', traceViewerUrl: 'https://trace/2' }),
        outcome(3, 'ABORTED', { suite: 'Login' }),
        outcome(4, 'NOT_EXECUTED', { suite: 'Login' }),
      ],
    };

    const xml = toJUnitXml(summary, '827');

    expect(xml).toContain('<testsuites name="ContextQA test plan 827" tests="4" failures="1" errors="1" skipped="1" time="5.000">');
    expect(xml).toContain('<testsuite name="Checkout" tests="2" failures="1" errors="0" skipped="0" time="2.500">');
    expect(xml).toContain('<testcase name="Case 1" classname="Checkout" time="1.250"/>');
    expect(xml).toContain(
      '<failure message="Expected &lt;b&gt; &amp; &quot;quote&quot;" type="FAILURE">Expected &lt;b&gt; &amp; "quote"\nTrace: https://trace/2</failure>',
    );
    expect(xml).toContain('<error message="ABORTED" type="ABORTED"></error>');
    expect(xml).toContain('<skipped message="NOT_EXECUTED" type="NOT_EXECUTED"></skipped>');
  });

  it('strips characters XML cannot carry', () => {
    const xml = toJUnitXml(
      { runId: 1, results: baseResults, passed: false, testCases: [outcome(1, 'FAILURE', { message: 'bad\u0001byte' })] },
      '1',
    );
    expect(xml).toContain('message="badbyte"');
  });

  it('collapses a run without per-test detail into one failing case', () => {
    const xml = toJUnitXml({ runId: 9, results: { ...baseResults, result: 'STOPPED' }, passed: false, reportUrl: 'https://r/9' }, '827');

    expect(xml).toContain('tests="1" failures="1"');
    expect(xml).toContain('<testcase name="Test plan 827 (run 9)" classname="ContextQA" time="5.000">');
    expect(xml).toContain('STOPPED: 1 passed, 1 failed of 4');
  });

  it('collapses a passing run without detail into one passing case', () => {
    const xml = toJUnitXml({ runId: 9, results: { ...baseResults, result: 'SUCCESS' }, passed: true }, '827');

    expect(xml).toContain('failures="0" errors="0" skipped="0"');
    expect(xml).toContain('<testcase name="Test plan 827 (run 9)" classname="ContextQA" time="5.000"/>');
  });
});

describe('exitCodeFor', () => {
  it('fails a non-passing run unless told never to', () => {
    const failed: RunSummary = { runId: 1, passed: false };
    expect(exitCodeFor(failed, 'failure')).toBe(1);
    expect(exitCodeFor(failed, 'never')).toBe(0);
    expect(exitCodeFor({ runId: 1, passed: true }, 'failure')).toBe(0);
  });
});

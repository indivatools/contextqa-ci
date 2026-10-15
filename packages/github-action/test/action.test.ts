import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeServer, fakeTime, json, results, text } from '../../core/test/fake-server.js';
import { runAction, type ActionIo } from '../src/main.js';
import { renderSummary } from '../src/summary.js';

const TOKEN = 'token_acme.secret';

function fakeIo(inputs: Record<string, string>) {
  const outputs: Record<string, string | number> = {};
  const errors: { message: string; title?: string }[] = [];
  const failed: string[] = [];
  const secrets: string[] = [];
  const summaries: string[] = [];
  const io: ActionIo = {
    getInput: (name) => inputs[name] ?? '',
    setOutput: (name, value) => {
      outputs[name] = value;
    },
    setSecret: (value) => secrets.push(value),
    info: () => undefined,
    warning: () => undefined,
    error: (message, properties) => errors.push({ message, title: properties?.title }),
    setFailed: (message) => failed.push(message),
    writeSummary: async (markdown) => {
      summaries.push(markdown);
    },
  };
  return { io, outputs, errors, failed, secrets, summaries };
}

function failingServer(): FakeServer {
  return new FakeServer()
    .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
    .on('GET', '/test_plan_results/77/results', () => json(results({ result: 'FAILURE', passedCount: 1, failedCount: 1 })))
    .on('GET', '/test_case_results', () =>
      json({
        content: [
          { id: 1, result: 'SUCCESS', testCaseDetails: { name: 'Guest checkout' }, testSuite: { name: 'Checkout' } },
          {
            id: 2,
            result: 'FAILURE',
            shortMessage: 'Element not found: #submit',
            traceViewerUrl: 'https://trace/2',
            testCaseDetails: { name: 'Pay | saved card' },
            testSuite: { name: 'Checkout' },
          },
        ],
        last: true,
      }),
    );
}

describe('runAction', () => {
  it('passes, sets outputs and masks the token', async () => {
    const server = new FakeServer()
      .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
      .on('GET', '/test_plan_results/77/results', () => json(results()))
      .on('GET', '/test_case_results', () => json({ content: [], last: true }));
    const f = fakeIo({ 'plan-id': '827', token: TOKEN });

    await runAction(f.io, { fetch: server.fetch, ...fakeTime() });

    expect(f.failed).toEqual([]);
    expect(f.secrets).toEqual([TOKEN]);
    expect(f.outputs).toMatchObject({ 'run-id': 77, result: 'SUCCESS', passed: 'true', 'total-count': 2, 'failed-count': 0 });
    expect(f.summaries[0]).toContain('✅ **SUCCESS** · run 77');
    expect(server.requests[0]!.url.origin).toBe('https://server.contextqa.com');
  });

  it('fails the step, annotates failing tests and writes JUnit', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cqa-action-'));
    const f = fakeIo({ 'plan-id': '827', token: TOKEN, 'junit-path': join(dir, 'reports/junit.xml') });

    await runAction(f.io, { fetch: failingServer().fetch, ...fakeTime() });

    expect(f.failed).toEqual(['Test plan 827 result was FAILURE']);
    expect(f.errors).toEqual([{ message: 'Element not found: #submit', title: 'ContextQA: Checkout › Pay | saved card' }]);
    expect(await readFile(join(dir, 'reports/junit.xml'), 'utf8')).toContain('failures="1"');
  });

  it('only reports when fail-on is never', async () => {
    const f = fakeIo({ 'plan-id': '827', token: TOKEN, 'fail-on': 'never' });

    await runAction(f.io, { fetch: failingServer().fetch, ...fakeTime() });

    expect(f.failed).toEqual([]);
    expect(f.outputs['passed']).toBe('false');
  });

  it('returns after triggering when wait is false', async () => {
    const server = new FakeServer().on('GET', '/test_plans/827/execution', () => json({ id: 77, url: 'https://r/77' }));
    const f = fakeIo({ 'plan-id': '827', token: TOKEN, wait: 'false' });

    await runAction(f.io, { fetch: server.fetch, ...fakeTime() });

    expect(f.failed).toEqual([]);
    expect(f.outputs).toEqual({ 'run-id': 77, 'report-url': 'https://r/77' });
    expect(f.summaries[0]).toContain('started without waiting');
  });

  it.each([
    [{ 'plan-id': '827' }, 'ContextQA token is missing'],
    [{ 'plan-id': 'abc', token: TOKEN }, 'plan id must be a number'],
    [{ 'plan-id': '827', token: TOKEN, 'fail-on': 'often' }, 'fail-on must be one of'],
    [{ 'plan-id': '827', token: TOKEN, timeout: '0' }, 'timeout must be a positive'],
  ])('fails cleanly on bad input %j', async (inputs, message) => {
    const f = fakeIo(inputs);
    await runAction(f.io, { fetch: new FakeServer().fetch, ...fakeTime() });
    expect(f.failed[0]).toContain(message);
  });

  it('reports a refused token as a failure, not a crash', async () => {
    const server = new FakeServer().on('GET', '/test_plans/827/execution', () => text('API Token is invalid or expired', 401));
    const f = fakeIo({ 'plan-id': '827', token: TOKEN });

    await runAction(f.io, { fetch: server.fetch, ...fakeTime() });

    expect(f.failed[0]).toContain('refused the token (HTTP 401)');
  });
});

describe('renderSummary', () => {
  it('escapes table cells and links failing tests to their trace', () => {
    const md = renderSummary(
      {
        runId: 7,
        passed: false,
        reportUrl: 'https://r/7',
        results: {
          status: 'STATUS_COMPLETED',
          result: 'FAILURE',
          duration: 408_000,
          totalCount: 2,
          passedCount: 1,
          failedCount: 1,
          abortedCount: 0,
          stoppedCount: 0,
          notExecutedCount: 0,
        },
        testCases: [
          { id: 1, name: 'a|b', suite: 'S', result: 'FAILURE', durationMs: 1, message: 'line1\nline2', traceViewerUrl: 'https://t/1' },
        ],
      },
      '827',
    );
    expect(md).toContain('| 2 | 1 | 1 | 0 | 0 | 0 | 6m 48s |');
    expect(md).toContain('| [a\\|b](https://t/1) | S | FAILURE | line1 line2 |');
    expect(md).toContain('[Open the full report in ContextQA](https://r/7)');
  });

  it('explains missing per-test detail on a failed run', () => {
    const md = renderSummary(
      {
        runId: 7,
        passed: false,
        results: {
          status: 'STATUS_COMPLETED',
          result: 'FAILURE',
          totalCount: 1,
          passedCount: 0,
          failedCount: 1,
          abortedCount: 0,
          stoppedCount: 0,
          notExecutedCount: 0,
        },
      },
      '827',
    );
    expect(md).toContain('TEST_CASE_RESULTS_READ');
  });
});

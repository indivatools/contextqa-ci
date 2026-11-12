import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeServer, fakeTime, json, results, text } from '../../core/test/fake-server.js';
import { toBuildSource } from '@contextqa-inc/ci-core';
import { DEFAULT_API_URL, parseCommand } from '../src/args.js';
import { main, type Io } from '../src/main.js';

const TOKEN_ENV = { CONTEXTQA_TOKEN: 'token_acme.secret' };

function captureIo(): Io & { out_: string[]; err_: string[] } {
  const out_: string[] = [];
  const err_: string[] = [];
  return { out: (l) => out_.push(l), err: (l) => err_.push(l), out_, err_ };
}

describe('parseCommand', () => {
  it('reads flags, falling back to CONTEXTQA_* variables', () => {
    const command = parseCommand(['run-plan', '--android-build', 'build/app.apk', '--timeout', '600'], {
      ...TOKEN_ENV,
      CONTEXTQA_PLAN_ID: '827',
      CONTEXTQA_ENVIRONMENT: 'Staging',
      CONTEXTQA_IOS_BUILD: 'https://cdn.example.com/a.ipa',
    });

    expect(command.kind).toBe('run-plan');
    if (command.kind !== 'run-plan') return;
    expect(command.config.run).toMatchObject({
      apiUrl: DEFAULT_API_URL,
      token: 'token_acme.secret',
      planId: '827',
      environment: 'Staging',
      androidBuild: { kind: 'file', path: 'build/app.apk' },
      iosBuild: { kind: 'url', url: 'https://cdn.example.com/a.ipa' },
      wait: true,
      timeoutSeconds: 600,
      pollIntervalSeconds: 15,
    });
    expect(command.config.failOn).toBe('failure');
  });

  it('lets a flag win over its environment variable', () => {
    const command = parseCommand(['run-plan', '--plan-id', '1'], { CONTEXTQA_PLAN_ID: '2' });
    expect(command.kind === 'run-plan' && command.config.run.planId).toBe('1');
  });

  it.each([
    [['run-plan', '--no-wait', '--plan-id', '1'], {}],
    [['run-plan', '--plan-id', '1'], { CONTEXTQA_WAIT: 'false' }],
  ])('supports not waiting via %j %j', (argv, env) => {
    const command = parseCommand(argv, env);
    expect(command.kind === 'run-plan' && command.config.run.wait).toBe(false);
  });

  it('reads the view from --view or CONTEXTQA_VIEW, standard when neither is set', () => {
    const view = (argv: string[], env: Record<string, string> = {}): string | undefined => {
      const command = parseCommand(['run-plan', '--plan-id', '1', ...argv], env);
      return command.kind === 'run-plan' ? command.config.view : undefined;
    };

    expect(view([])).toBe('standard');
    expect(view(['--view', 'full'])).toBe('full');
    expect(view([], { CONTEXTQA_VIEW: 'compact' })).toBe('compact');
    expect(view(['--view', 'detailed'], { CONTEXTQA_VIEW: 'compact' })).toBe('detailed');
  });

  it('never reads the token from a flag', () => {
    expect(() => parseCommand(['run-plan', '--plan-id', '1', '--token', 'x'], {})).toThrow();
  });

  it.each([
    [['run-plan'], 'plan-id'],
    [['run-plan', '--plan-id', '1', '--fail-on', 'sometimes'], '--fail-on'],
    [['run-plan', '--plan-id', '1', '--timeout', '-5'], '--timeout'],
    [['run-plan', '--plan-id', '1', '--view', 'tiny'], '--view must be one of compact, standard, detailed, full'],
    [['deploy'], 'unknown command'],
  ])('rejects %j', (argv, message) => {
    expect(() => parseCommand(argv, {})).toThrow(message);
  });

  it('treats only http(s) values as hosted builds', () => {
    expect(toBuildSource('HTTPS://x/a.apk')).toEqual({ kind: 'url', url: 'HTTPS://x/a.apk' });
    expect(toBuildSource('./a.apk')).toEqual({ kind: 'file', path: './a.apk' });
    expect(toBuildSource(undefined)).toBeUndefined();
  });
});

describe('main', () => {
  it('exits 0 and writes JUnit and JSON for a passing run', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cqa-cli-'));
    const server = new FakeServer()
      .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
      .on('GET', '/test_plan_results/77/results', () => json(results()))
      .on('GET', '/test_case_results', () =>
        json({ content: [{ id: 1, result: 'SUCCESS', testCaseDetails: { name: 'Login works' }, testSuite: { name: 'Auth' } }], last: true }),
      );
    const io = captureIo();

    const code = await main(
      ['run-plan', '--plan-id', '827', '--junit', join(dir, 'out/junit.xml'), '--json', join(dir, 'summary.json')],
      TOKEN_ENV,
      '0.1.0',
      io,
      { fetch: server.fetch, ...fakeTime() },
    );

    expect(code).toBe(0);
    expect(io.out_).toContain('Run 77 finished: SUCCESS (2 passed, 0 failed of 2)');
    expect(io.out_).toContain('Report: https://app.example.com/td/runs/77');
    expect(await readFile(join(dir, 'out/junit.xml'), 'utf8')).toContain('<testcase name="Login works" classname="Auth"');
    expect(JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8'))).toMatchObject({ runId: 77, passed: true });
  });

  it('exits 1 for a failed run, or 0 with --fail-on never', async () => {
    const server = () =>
      new FakeServer()
        .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
        .on('GET', '/test_plan_results/77/results', () => json(results({ result: 'FAILURE', failedCount: 1 })))
        .on('GET', '/test_case_results', () => json({ content: [], last: true }));

    const io = captureIo();
    expect(await main(['run-plan', '--plan-id', '827'], TOKEN_ENV, '0', io, { fetch: server().fetch, ...fakeTime() })).toBe(1);
    expect(io.err_).toContain('ERROR: test plan result was FAILURE');

    expect(
      await main(['run-plan', '--plan-id', '827', '--fail-on', 'never'], TOKEN_ENV, '0', captureIo(), {
        fetch: server().fetch,
        ...fakeTime(),
      }),
    ).toBe(0);
  });

  describe('end of the log', () => {
    const failedRun = () =>
      new FakeServer()
        .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
        .on('GET', '/test_plan_results/77/results', () => json(results({ result: 'FAILURE', passedCount: 1, failedCount: 1 })))
        .on('GET', '/test_case_results', () =>
          json({
            content: [
              { id: 1, result: 'SUCCESS', testCaseDetails: { name: 'Login works' }, testSuite: { name: 'Auth' } },
              { id: 2, result: 'FAILURE', shortMessage: 'Element not found: #submit', testCaseDetails: { name: 'Pay' }, testSuite: { name: 'Checkout' } },
            ],
            last: true,
          }),
        );

    it('lists each failing test case with its error and its result in ContextQA', async () => {
      const io = captureIo();

      await main(['run-plan', '--plan-id', '827'], TOKEN_ENV, '0', io, { fetch: failedRun().fetch, ...fakeTime() });

      expect(io.out_.slice(-6)).toEqual([
        'Run 77 finished: FAILURE (1 passed, 1 failed of 2)',
        'Failing test cases:',
        '  FAILURE Checkout › Pay',
        '    Element not found: #submit',
        '    Result: https://app.example.com/td/test_case_results/2',
        'Report: https://app.example.com/td/runs/77',
      ]);
    });

    it('keeps to the verdict and the report link in the compact view', async () => {
      const io = captureIo();

      await main(['run-plan', '--plan-id', '827', '--view', 'compact'], TOKEN_ENV, '0', io, { fetch: failedRun().fetch, ...fakeTime() });

      expect(io.out_.slice(-2)).toEqual(['Run 77 finished: FAILURE (1 passed, 1 failed of 2)', 'Report: https://app.example.com/td/runs/77']);
      expect(io.out_).not.toContain('Failing test cases:');
    });

    it('lists every test case in the full view', async () => {
      const io = captureIo();

      await main(['run-plan', '--plan-id', '827'], { ...TOKEN_ENV, CONTEXTQA_VIEW: 'full' }, '0', io, { fetch: failedRun().fetch, ...fakeTime() });

      expect(io.out_).toContain('    SUCCESS Login works (0s) https://app.example.com/td/test_case_results/1');
    });
  });

  it('keeps server text in its progress and error lines from starting a CI command', async () => {
    const server = new FakeServer()
      .on('GET', '/test_plans/827/execution', () => json({ id: 77, url: 'https://app.example.com/td/runs/77\n::add-mask::u' }))
      .on('GET', '/test_plan_results/77/results', () => json(results({ result: 'FAILURE\r::stop-commands::s', failedCount: 1 })))
      .on('GET', '/test_case_results', () => json({ content: [], last: true }));
    const io = captureIo();

    await main(['run-plan', '--plan-id', '827'], TOKEN_ENV, '0', io, { fetch: server.fetch, ...fakeTime() });

    expect(io.err_.at(-1)).toContain('ERROR: test plan result was FAILURE');
    for (const line of [...io.out_, ...io.err_]) expect(line).not.toMatch(/[\r\n]/);
  });

  it('exits 2 for a missing token and for a refused one', async () => {
    const io = captureIo();
    expect(await main(['run-plan', '--plan-id', '827'], {}, '0', io)).toBe(2);
    expect(io.err_[0]).toContain('ContextQA token is missing');

    const server = new FakeServer().on('GET', '/test_plans/827/execution', () => text('Token is not found', 401));
    expect(await main(['run-plan', '--plan-id', '827'], TOKEN_ENV, '0', captureIo(), { fetch: server.fetch, ...fakeTime() })).toBe(2);
  });

  it('exits 2 for an unknown flag', async () => {
    const io = captureIo();
    expect(await main(['run-plan', '--plan', '827'], TOKEN_ENV, '0', io)).toBe(2);
    expect(io.err_[0]).toMatch(/^ERROR: Unknown option/);
  });

  it('exits 3 on timeout and points at the still-running run', async () => {
    const server = new FakeServer()
      .on('GET', '/test_plans/827/execution', () => json({ id: 77, url: 'https://app.example.com/td/runs/77' }))
      .on('GET', '/test_plan_results/77/results', () => json(results({ status: 'STATUS_IN_PROGRESS' })));
    const io = captureIo();

    const code = await main(['run-plan', '--plan-id', '827', '--timeout', '30'], TOKEN_ENV, '0', io, {
      fetch: server.fetch,
      ...fakeTime(),
    });

    expect(code).toBe(3);
    expect(io.err_[0]).toBe('ERROR: run 77 did not finish within 30s. It is still running: https://app.example.com/td/runs/77');
  });

  it('prints help and version', async () => {
    const io = captureIo();
    expect(await main([], {}, '1.2.3', io)).toBe(0);
    expect(io.out_[0]).toContain('Usage: contextqa run-plan');
    expect(await main(['--version'], {}, '1.2.3', io)).toBe(0);
    expect(io.out_[1]).toBe('1.2.3');
  });
});

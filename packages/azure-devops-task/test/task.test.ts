import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeServer, fakeTime, json, results } from '../../core/test/fake-server.js';
import { command, inputVariable } from '../src/logging.js';
import { runTask, type TaskIo } from '../src/main.js';

const TOKEN = 'token_acme.secret';

function fakeIo(inputs: Record<string, string>, env: Record<string, string> = {}) {
  const outputs: Record<string, string> = {};
  const record = {
    errors: [] as string[],
    failed: [] as string[],
    secrets: [] as string[],
    junit: [] as string[],
    summaries: [] as string[],
    logged: [] as string[],
  };
  const io: TaskIo = {
    getInput: (name) => inputs[name] ?? '',
    getEnv: (name) => env[name],
    info: (m) => record.logged.push(m),
    warning: () => undefined,
    error: (m) => record.errors.push(m),
    setSecret: (v) => record.secrets.push(v),
    setOutput: (n, v) => {
      outputs[n] = v;
    },
    publishJUnit: (path) => record.junit.push(path),
    uploadSummary: (path) => record.summaries.push(path),
    fail: (m) => record.failed.push(m),
  };
  return { io, outputs, ...record };
}

function server(result = 'SUCCESS'): FakeServer {
  return new FakeServer()
    .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
    .on('GET', '/test_plan_results/77/results', () => json(results({ result, failedCount: result === 'SUCCESS' ? 0 : 1 })))
    .on('GET', '/test_case_results', () =>
      json({
        content:
          result === 'SUCCESS'
            ? []
            : [{ id: 2, result: 'FAILURE', shortMessage: 'Element not found', testCaseDetails: { name: 'Pay' }, testSuite: { name: 'Checkout' } }],
        last: true,
      }),
    );
}

describe('runTask', () => {
  it('publishes JUnit and a summary, sets outputs, masks the token', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const f = fakeIo({ planId: '827', token: TOKEN }, { AGENT_TEMPDIRECTORY: temp, SYSTEM_DEFAULTWORKINGDIRECTORY: temp });

    await runTask(f.io, { fetch: server().fetch, ...fakeTime() });

    expect(f.failed).toEqual([]);
    expect(f.secrets).toEqual([TOKEN]);
    expect(f.outputs).toMatchObject({ runId: '77', result: 'SUCCESS', passed: 'true' });
    expect(f.junit).toEqual([join(temp, 'contextqa', 'contextqa-junit.xml')]);
    expect(await readFile(f.junit[0]!, 'utf8')).toContain('<testsuites');
    expect(await readFile(f.summaries[0]!, 'utf8')).toContain('✅ **SUCCESS**');
  });

  it('fails and raises an issue per failing test', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const f = fakeIo({ planId: '827', token: TOKEN }, { AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: server('FAILURE').fetch, ...fakeTime() });

    expect(f.failed).toEqual(['Test plan 827 result was FAILURE']);
    expect(f.errors).toEqual(['ContextQA: Checkout › Pay: Element not found']);
    expect(f.junit).toHaveLength(1);
  });

  it("raises the failed step's error when a failing test has no short message (CON-6433)", async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const s = new FakeServer()
      .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
      .on('GET', '/test_plan_results/77/results', () => json(results({ result: 'FAILURE', failedCount: 1 })))
      .on('GET', '/test_case_results', () =>
        json({
          content: [
            {
              id: 3,
              result: 'FAILURE',
              testCase: { name: 'Pay' },
              testSuite: { name: 'Checkout' },
              executedResult: { failed_test_steps: [{ humanReadableText: 'Click on Pay', reason: 'The Pay button is not on the screen' }] },
            },
          ],
          last: true,
        }),
      );
    const f = fakeIo({ planId: '827', token: TOKEN }, { AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: s.fetch, ...fakeTime() });

    expect(f.errors).toEqual(['ContextQA: Checkout › Pay: The Pay button is not on the screen']);
  });

  it('names the device in the issue of a failing test case', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const s = new FakeServer()
      .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
      .on('GET', '/test_plan_results/77/results', () => json(results({ result: 'FAILURE', failedCount: 1 })))
      .on('GET', '/test_case_results', () =>
        json({
          content: [
            { id: 2, result: 'FAILURE', shortMessage: 'Element not found', platform: 'desktop', browser: 'webkit', testCase: { name: 'Pay' }, testSuite: { name: 'Checkout' } },
          ],
          last: true,
        }),
      );
    const f = fakeIo({ planId: '827', token: TOKEN }, { AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: s.fetch, ...fakeTime() });

    expect(f.errors).toEqual(['ContextQA: Checkout › Pay (Web - Safari): Element not found']);
  });

  it('keeps server text in its progress lines from starting a logging command', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const s = new FakeServer()
      .on('GET', '/test_plans/827/execution', () => json({ id: 77, url: 'https://app.example.com/td/runs/77 ##vso[task.prependpath]/tmp' }))
      .on('GET', '/test_plan_results/77/results', () => json(results()))
      .on('GET', '/test_case_results', () => json({ content: [], last: true }));
    const f = fakeIo({ planId: '827', token: TOKEN }, { AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: s.fetch, ...fakeTime() });

    expect(f.logged.some((line) => line.startsWith('Started run 77'))).toBe(true);
    for (const line of f.logged) expect(line).not.toContain('##vso[');
  });

  it('takes the token from the environment when the input is empty', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const s = server();
    const f = fakeIo({ planId: '827' }, { CONTEXTQA_TOKEN: TOKEN, AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: s.fetch, ...fakeTime() });

    expect(f.failed).toEqual([]);
    expect(s.requests[0]!.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('resolves a relative build path against the sources directory', async () => {
    const sources = await mkdtemp(join(tmpdir(), 'cqa-azure-src-'));
    await writeFile(join(sources, 'app.apk'), 'APK');
    const s = new FakeServer()
      .on('GET', '/test_plans/build_upload_url', () => json({ key: 'k/app.apk', putUrl: 'https://uploads.example.com/x' }))
      .on('PUT', 'upload', () => new Response(null, { status: 200 }))
      .on('GET', '/test_plans/827/execution', () => json({ id: 77 }))
      .on('GET', '/test_plan_results/77/results', () => json(results()))
      .on('GET', '/test_case_results', () => json({ content: [], last: true }));
    const f = fakeIo({ planId: '827', token: TOKEN, androidBuild: 'app.apk' }, { SYSTEM_DEFAULTWORKINGDIRECTORY: sources, AGENT_TEMPDIRECTORY: sources });

    await runTask(f.io, { fetch: s.fetch, ...fakeTime() });

    expect(f.failed).toEqual([]);
    expect(s.calls('/test_plans/827/execution')[0]!.url.searchParams.get('apk_build_url')).toBe('k/app.apk');
  });

  it('leaves the Tests tab alone when publishing is off', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const f = fakeIo({ planId: '827', token: TOKEN, publishTestResults: 'false' }, { AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: server().fetch, ...fakeTime() });

    expect(f.junit).toEqual([]);
  });

  it('writes the summary in the chosen view and ends the log with the failing test cases', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const f = fakeIo({ planId: '827', token: TOKEN, view: 'compact' }, { AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: server('FAILURE').fetch, ...fakeTime() });

    const summary = await readFile(f.summaries[0]!, 'utf8');
    expect(summary).toContain('**Failing:** [Pay](https://app.example.com/td/test_case_results/2)');
    expect(summary).not.toContain('| Total |');
    expect(f.logged.slice(-2)).toEqual(['Run 77 finished: FAILURE (2 passed, 1 failed of 2)', 'Report: https://app.example.com/td/runs/77']);
  });

  it('lists the failing test cases at the end of the log in the standard view', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'cqa-azure-'));
    const f = fakeIo({ planId: '827', token: TOKEN }, { AGENT_TEMPDIRECTORY: temp });

    await runTask(f.io, { fetch: server('FAILURE').fetch, ...fakeTime() });

    expect(f.logged).toContain('  FAILURE Checkout › Pay');
    expect(f.logged).toContain('    Result: https://app.example.com/td/test_case_results/2');
  });

  it.each([
    [{ failOn: 'sometimes' }, 'failOn must be one of'],
    [{ view: 'tiny' }, 'view must be one of compact, standard, detailed, full'],
  ])('fails cleanly on bad input %j', async (inputs, message) => {
    const f = fakeIo({ planId: '827', token: TOKEN, ...inputs });
    await runTask(f.io, { fetch: new FakeServer().fetch, ...fakeTime() });
    expect(f.failed[0]).toContain(message);
  });
});

describe('logging commands', () => {
  it('escapes values so a test name cannot start a second command', () => {
    expect(command('task.logissue', { type: 'error' }, 'bad\n##vso[task.complete result=Succeeded;]')).toBe(
      '##vso[task.logissue type=error;]bad%0A##vso[task.complete result=Succeeded;]',
    );
    expect(command('results.publish', { runTitle: 'a;b]c' })).toBe('##vso[results.publish runTitle=a%3Bb%5Dc;]');
    expect(command('task.setsecret', {}, '100%')).toBe('##vso[task.setsecret]100%AZP25');
  });

  it('maps input names to the agent environment variables', () => {
    expect(inputVariable('planId')).toBe('INPUT_PLANID');
    expect(inputVariable('publishTestResults')).toBe('INPUT_PUBLISHTESTRESULTS');
  });
});

import { describe, expect, it } from 'vitest';
import { renderLog } from '../src/log.js';
import { renderSummary } from '../src/summary.js';
import type { RunSummary, TestCaseOutcome } from '../src/types.js';
import { VIEW_VALUES, type View } from '../src/view.js';

const PORTAL = 'https://acme.contextqa.com';

function testCase(
  id: number,
  name: string,
  suite: string,
  result: string,
  durationMs: number,
  extra: Partial<TestCaseOutcome> = {},
): TestCaseOutcome {
  return { id, name, suite, result, durationMs, message: '', resultUrl: `${PORTAL}/td/test_case_results/${id}`, ...extra };
}

/** Run 4512: 2 of 5 passed, 2 failed, 1 aborted, across three suites; 22m 14s start to end. */
function failedRun(): RunSummary {
  return {
    runId: 4512,
    passed: false,
    reportUrl: `${PORTAL}/td/runs/4512`,
    results: {
      status: 'STATUS_COMPLETED',
      result: 'FAILURE',
      duration: 3_543_000,
      wallClockMs: 1_334_000,
      totalCount: 5,
      passedCount: 2,
      failedCount: 2,
      abortedCount: 1,
      stoppedCount: 0,
      notExecutedCount: 0,
    },
    testCases: [
      testCase(1, 'Login with password', 'Auth', 'SUCCESS', 48_000),
      testCase(2, 'Login with SSO', 'Auth', 'FAILURE', 31_000, { message: 'Page load timed out after 30s' }),
      testCase(3, 'Checkout with saved card', 'Payments', 'FAILURE', 102_000, {
        traceViewerUrl: 'https://trace.example.com/3',
        failedStep: {
          stepIndex: 7,
          step: "Click 'Pay now'",
          message: "Element not found: button 'Pay now'",
          expected: 'Order confirmation page is shown',
          type: 'ELEMENT_NOT_FOUND',
          hasScreenshot: false,
        },
      }),
      testCase(4, 'Apply discount code', 'Payments', 'SUCCESS', 58_000),
      testCase(5, 'Export orders to CSV', 'Reports', 'ABORTED', 5_000, { message: 'Device session ended' }),
    ],
  };
}

function passedRun(): RunSummary {
  const run = failedRun();
  return {
    ...run,
    runId: 4513,
    passed: true,
    reportUrl: `${PORTAL}/td/runs/4513`,
    results: { ...run.results!, result: 'SUCCESS', passedCount: 5, failedCount: 0, abortedCount: 0 },
    testCases: run.testCases!.map((t) => ({ ...t, result: 'SUCCESS', message: '', failedStep: undefined })),
  };
}

/** The same run, on Chrome (test cases 1, 2, 4) and a Pixel 9 (3, 5). */
function crossDeviceRun(): RunSummary {
  const run = failedRun();
  const where: Record<number, [string, string]> = {
    1: ['Web', 'Chrome'],
    2: ['Web', 'Chrome'],
    3: ['Android', 'Pixel 9'],
    4: ['Web', 'Chrome'],
    5: ['Android', 'Pixel 9'],
  };
  return { ...run, testCases: run.testCases!.map((t) => ({ ...t, platform: where[t.id]![0], device: where[t.id]![1] })) };
}

function withoutTestCases(run: RunSummary): RunSummary {
  return { ...run, testCases: undefined };
}

function failing(count: number): TestCaseOutcome[] {
  return Array.from({ length: count }, (_, i) => testCase(i + 1, `Case ${i + 1}`, 'Checkout', 'FAILURE', 1_000));
}

/** 600 + 600 + 5 passing test cases in suites Alpha, Beta and Gamma; ids run 1 to 1205. */
function threeSuites(): TestCaseOutcome[] {
  return [
    ...Array.from({ length: 600 }, (_, i) => testCase(i + 1, `A${i + 1}`, 'Alpha', 'SUCCESS', 1_000)),
    ...Array.from({ length: 600 }, (_, i) => testCase(i + 601, `B${i + 1}`, 'Beta', 'SUCCESS', 1_000)),
    ...Array.from({ length: 5 }, (_, i) => testCase(i + 1201, `C${i + 1}`, 'Gamma', 'SUCCESS', 1_000)),
  ];
}

/** .NET's `TrimStart`, which GitHub's runner applies before looking for `::`; it also trims U+0085. */
function dotnetTrimStart(line: string): string {
  return line.replace(/^[\s\u0085]+/, '');
}

describe('renderSummary views', () => {
  it('links each failing test case to its result in ContextQA, keeping its trace beside it', () => {
    const md = renderSummary(failedRun(), '827');

    expect(md).toContain('| [Login with SSO](https://acme.contextqa.com/td/test_case_results/2) | Auth | FAILURE | Page load timed out after 30s |');
    expect(md).toContain(
      "| [Checkout with saved card](https://acme.contextqa.com/td/test_case_results/3) | Payments | FAILURE | Element not found: button 'Pay now' (failed step: Click 'Pay now') · [Trace](https://trace.example.com/3) |",
    );
    expect(md).toContain('| 5 | 2 | 2 | 1 | 0 | 0 | 22m 14s | 59m 3s |');
    expect(md).not.toContain('Login with password');
  });

  it('fits a compact summary on two lines: the verdict with its counts, then the failing test cases', () => {
    expect(renderSummary(failedRun(), '827', 'compact')).toBe(
      [
        '### ContextQA · test plan 827',
        '',
        '❌ **FAILURE** · run 4512 · 2 of 5 passed · 2 failed · 1 aborted · 22m 14s · [Open in ContextQA](https://acme.contextqa.com/td/runs/4512)',
        '',
        '**Failing:** [Login with SSO](https://acme.contextqa.com/td/test_case_results/2) · [Checkout with saved card](https://acme.contextqa.com/td/test_case_results/3) · [Export orders to CSV](https://acme.contextqa.com/td/test_case_results/5)',
        '',
      ].join('\n'),
    );
  });

  it('gives a passing run a single line in a compact summary', () => {
    expect(renderSummary(passedRun(), '827', 'compact')).toBe(
      '### ContextQA · test plan 827\n\n✅ **SUCCESS** · run 4513 · 5 of 5 passed · 22m 14s · [Open in ContextQA](https://acme.contextqa.com/td/runs/4513)\n',
    );
  });

  it('names at most ten failing test cases in a compact summary', () => {
    const md = renderSummary({ ...failedRun(), testCases: failing(12) }, '827', 'compact');

    expect(md).toContain('[Case 10](https://acme.contextqa.com/td/test_case_results/10) · …and 2 more');
    expect(md).not.toContain('Case 11');
  });

  it('breaks a detailed summary down by suite, below the run counts', () => {
    const md = renderSummary(failedRun(), '827', 'detailed');

    expect(md).toContain('| 5 | 2 | 2 | 1 | 0 | 0 | 22m 14s | 59m 3s |');
    expect(md).toContain(
      [
        '#### Suites',
        '',
        '| Suite | Tests | Passed | Failed | Aborted | Test execution time |',
        '|---|---:|---:|---:|---:|---:|',
        '| Auth | 2 | 1 | 1 | 0 | 1m 19s |',
        '| Payments | 2 | 1 | 1 | 0 | 2m 40s |',
        '| Reports | 1 | 0 | 0 | 1 | 5s |',
      ].join('\n'),
    );
  });

  it('spells out each failure in a detailed summary', () => {
    const md = renderSummary(failedRun(), '827', 'detailed');

    expect(md).toContain(
      [
        '**❌ [Login with SSO](https://acme.contextqa.com/td/test_case_results/2)** · Auth · FAILURE · 31s',
        '',
        '- Page load timed out after 30s',
        '',
        '**❌ [Checkout with saved card](https://acme.contextqa.com/td/test_case_results/3)** · Payments · FAILURE · 1m 42s',
        '',
        "- **Failed step 7:** Click 'Pay now'",
        "- **Error:** Element not found: button 'Pay now'",
        '- **Expected:** Order confirmation page is shown',
        '- **Type:** ELEMENT_NOT_FOUND',
        '- [Trace](https://trace.example.com/3)',
        '',
        '**❌ [Export orders to CSV](https://acme.contextqa.com/td/test_case_results/5)** · Reports · ABORTED · 5s',
        '',
        '- Device session ended',
      ].join('\n'),
    );
    expect(md).not.toContain('| Test case | Suite | Result | Message |');
  });

  it('folds the other test cases away in a detailed summary', () => {
    const md = renderSummary(failedRun(), '827', 'detailed');

    expect(md).toContain(
      [
        '<details><summary>Other test cases (2)</summary>',
        '',
        '| Test case | Suite | Result | Time |',
        '|---|---|---|---:|',
        '| [Login with password](https://acme.contextqa.com/td/test_case_results/1) | Auth | SUCCESS | 48s |',
        '| [Apply discount code](https://acme.contextqa.com/td/test_case_results/4) | Payments | SUCCESS | 58s |',
        '',
        '</details>',
      ].join('\n'),
    );
  });

  it('lists every test case under its suite in a full summary, after the failures', () => {
    const md = renderSummary(failedRun(), '827', 'full');

    expect(md).toContain(
      [
        '#### All test cases',
        '',
        '##### Auth · 1 of 2 passed',
        '',
        '| Test case | Result | Time | Message |',
        '|---|---|---:|---|',
        '| [Login with password](https://acme.contextqa.com/td/test_case_results/1) | SUCCESS | 48s |  |',
        '| [Login with SSO](https://acme.contextqa.com/td/test_case_results/2) | FAILURE | 31s | Page load timed out after 30s |',
        '',
        '##### Payments · 1 of 2 passed',
      ].join('\n'),
    );
    expect(md).toContain('##### Reports · 0 of 1 passed');
    expect(md.indexOf('#### All test cases')).toBeGreaterThan(md.indexOf('- **Type:** ELEMENT_NOT_FOUND'));
    expect(md).toContain('| Payments | 2 | 1 | 1 | 0 | 2m 40s |');
    expect(md).not.toContain('<details>');
  });

  it('stops listing test cases after a thousand, pointing at the report for the rest', () => {
    const many = Array.from({ length: 1_002 }, (_, i) => testCase(i + 1, `Case ${i + 1}`, 'Checkout', 'SUCCESS', 1_000));
    const md = renderSummary({ ...passedRun(), testCases: many }, '827', 'full');

    expect(md).toContain('| [Case 1000](https://acme.contextqa.com/td/test_case_results/1000) | SUCCESS | 1s |  |');
    expect(md).not.toContain('Case 1001');
    expect(md).toContain('…and 2 more in the report.');
  });

  it('spells out at most fifty failures in a detailed summary', () => {
    const md = renderSummary({ ...failedRun(), testCases: failing(52) }, '827', 'detailed');

    expect(md).toContain('[Case 50](https://acme.contextqa.com/td/test_case_results/50)');
    expect(md).not.toContain('Case 51');
    expect(md).toContain('…and 2 more in the report.');
  });

  it('falls back to the trace link for a test case with no result link', () => {
    const run = failedRun();
    const md = renderSummary({ ...run, testCases: [{ ...run.testCases![2]!, resultUrl: undefined }] }, '827', 'detailed');

    expect(md).toContain('**❌ [Checkout with saved card](https://trace.example.com/3)** · Payments · FAILURE · 1m 42s');
  });

  it('keeps markup in test names and messages from turning into HTML', () => {
    const run = { ...failedRun(), testCases: [testCase(2, 'Login <admin> [SSO]', 'Auth', 'FAILURE', 1_000, { message: 'Expected </details> & more' })] };

    const md = renderSummary(run, '827', 'detailed');

    expect(md).toContain('**❌ [Login &lt;admin&gt; \\[SSO\\]](https://acme.contextqa.com/td/test_case_results/2)**');
    expect(md).toContain('- Expected &lt;/details&gt; &amp; more');
  });

  it('escapes the Markdown a test name or message could use to restructure the summary', () => {
    const run = { ...failedRun(), testCases: [testCase(2, 'Pay `beta` *now* ~~x~~', 'Auth', 'FAILURE', 1_000, { message: '# ✅ All tests passed' })] };

    const md = renderSummary(run, '827', 'detailed');

    expect(md).toContain('**❌ [Pay \\`beta\\` \\*now\\* \\~\\~x\\~\\~](https://acme.contextqa.com/td/test_case_results/2)**');
    expect(md).toContain('\n- \\# ✅ All tests passed\n');
  });

  it.each([
    ['1. Step one', '- 1\\. Step one'],
    ['---', '- \\---'],
    ['+ more', '- \\+ more'],
    ['    indented', '- indented'],
  ])('keeps a message starting %j from opening a block of its own', (message, line) => {
    const run = { ...failedRun(), testCases: [testCase(2, 'Login', 'Auth', 'FAILURE', 1_000, { message })] };

    expect(renderSummary(run, '827', 'detailed')).toContain(`\n${line}\n`);
  });

  it('encodes a link target so it cannot close the link and open another', () => {
    const trace = 'https://trace.example.com/2) · [Re-authenticate](https://evil.example/login';
    const run = { ...failedRun(), testCases: [testCase(2, 'Login', 'Auth', 'FAILURE', 1_000, { message: 'boom', traceViewerUrl: trace })] };

    const md = renderSummary(run, '827', 'detailed');

    expect(md).not.toContain('[Re-authenticate](https://evil.example/login');
    expect(md).toContain('- [Trace](https://trace.example.com/2%29%20%C2%B7%20%5BRe-authenticate%5D%28https://evil.example/login)');
  });

  it('links only to http and https URLs', () => {
    const run = {
      ...failedRun(),
      reportUrl: 'javascript:alert(1)',
      testCases: [testCase(2, 'Login', 'Auth', 'FAILURE', 1_000, { resultUrl: undefined, traceViewerUrl: 'javascript:alert(2)' })],
    };

    const md = renderSummary(run, '827');

    expect(md).toContain('| Login | Auth | FAILURE |');
    expect(md).not.toContain('javascript:');
  });

  it('clips a very long error, keeping the start of it', () => {
    const run = { ...failedRun(), testCases: [testCase(2, 'Login', 'Auth', 'FAILURE', 1_000, { message: 'x'.repeat(5_000) })] };

    expect(renderSummary(run, '827', 'detailed')).toContain(`\n- ${'x'.repeat(999)}…\n`);
    expect(renderSummary(run, '827', 'full')).toContain(`| FAILURE | 1s | ${'x'.repeat(299)}… |`);
  });

  it("stays under GitHub's 1 MiB job summary limit, however long the errors are", () => {
    const many = Array.from({ length: 1_000 }, (_, i) =>
      testCase(i + 1, `Case ${i + 1}`, `Suite ${i % 40}`, 'FAILURE', 1_000, { message: '&'.repeat(800) }),
    );

    const md = renderSummary({ ...failedRun(), testCases: many }, '827', 'full');

    expect(Buffer.byteLength(md)).toBeLessThan(1024 * 1024);
    expect(md).toContain('#### All test cases');
    expect(md.trimEnd().endsWith('_The summary stops here to stay within the size limit for job summaries; the report has every test case._')).toBe(true);
  });

  it('shares the thousand-row limit across suites in a full summary', () => {
    const md = renderSummary({ ...passedRun(), testCases: threeSuites() }, '827', 'full');

    expect(md).toContain('| [B400](https://acme.contextqa.com/td/test_case_results/1000) | SUCCESS | 1s |  |');
    expect(md).not.toContain('[B401]');
    expect(md).not.toContain('##### Gamma');
    expect(md).toContain('…and 205 more in the report.');
  });

  it('folds at most a thousand other test cases in a detailed summary', () => {
    const many = [
      ...Array.from({ length: 1_002 }, (_, i) => testCase(i + 1, `Case ${i + 1}`, 'Checkout', 'SUCCESS', 1_000)),
      testCase(2_000, 'Broken', 'Checkout', 'FAILURE', 1_000),
    ];

    const md = renderSummary({ ...failedRun(), testCases: many }, '827', 'detailed');

    expect(md).toContain('<details><summary>Other test cases (1002)</summary>');
    expect(md).not.toContain('[Case 1001]');
    expect(md).toContain('…and 2 more in the report.\n\n</details>');
  });

  it('falls back to the standard view for a view it does not know', () => {
    const md = renderSummary(failedRun(), '827', 'everything' as View);

    expect(md).toContain('| [Login with SSO](https://acme.contextqa.com/td/test_case_results/2) | Auth | FAILURE | Page load timed out after 30s |');
    expect(md).not.toContain('#### Suites');
  });

  describe('device details', () => {
    it('names the devices with how each did, and the device of each failing test case, in the standard view', () => {
      const md = renderSummary(crossDeviceRun(), '827');

      expect(md).toContain(
        '| 5 | 2 | 2 | 1 | 0 | 0 | 22m 14s | 59m 3s |\n\n**Devices:** Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed\n\n[Open the full report',
      );
      expect(md).toContain('| Test case | Suite | Device | Result | Message |\n|---|---|---|---|---|');
      expect(md).toContain('| [Login with SSO](https://acme.contextqa.com/td/test_case_results/2) | Auth | Web - Chrome | FAILURE | Page load timed out after 30s |');
    });

    it('adds the devices to the verdict line of a compact summary', () => {
      expect(renderSummary(crossDeviceRun(), '827', 'compact')).toContain(
        '❌ **FAILURE** · run 4512 · 2 of 5 passed · 2 failed · 1 aborted · 22m 14s · Web - Chrome, Android - Pixel 9 · [Open in ContextQA](https://acme.contextqa.com/td/runs/4512)',
      );
    });

    it('puts the device beside each failure and each other test case in a detailed summary', () => {
      const md = renderSummary(crossDeviceRun(), '827', 'detailed');

      expect(md).toContain('**❌ [Checkout with saved card](https://acme.contextqa.com/td/test_case_results/3)** · Payments · Android - Pixel 9 · FAILURE · 1m 42s');
      expect(md).toContain(
        '| Test case | Suite | Device | Result | Time |\n|---|---|---|---|---:|\n| [Login with password](https://acme.contextqa.com/td/test_case_results/1) | Auth | Web - Chrome | SUCCESS | 48s |',
      );
    });

    it('gives every test case its device in a full summary', () => {
      expect(renderSummary(crossDeviceRun(), '827', 'full')).toContain(
        '| Test case | Device | Result | Time | Message |\n|---|---|---|---:|---|\n| [Login with password](https://acme.contextqa.com/td/test_case_results/1) | Web - Chrome | SUCCESS | 48s |  |',
      );
    });

    it('leaves the tables as they were when no test case says where it ran', () => {
      const md = renderSummary(failedRun(), '827', 'full');

      expect(md).not.toContain('| Device |');
      expect(md).not.toContain('**Devices:**');
      expect(md).toContain('| Test case | Result | Time | Message |');
    });
  });

  describe('hardening', () => {
    const one = (extra: Partial<TestCaseOutcome>, name = 'Login'): RunSummary => ({
      ...failedRun(),
      testCases: [testCase(2, name, 'Auth', 'FAILURE', 1_000, { message: 'boom', ...extra })],
    });

    it('clips a very long error in the standard table too', () => {
      expect(renderSummary(one({ message: 'x'.repeat(5_000) }), '827')).toContain(`| FAILURE | ${'x'.repeat(999)}… |`);
    });

    it('keeps an entity in a link target from changing where the link goes', () => {
      const md = renderSummary(one({ traceViewerUrl: 'https://good.example&commat;evil.example/' }), '827', 'detailed');

      expect(md).toContain('- [Trace](https://good.example&amp;commat;evil.example/)');
    });

    it('percent-encodes a pipe in a link target, keeping the table row whole', () => {
      expect(renderSummary(one({ traceViewerUrl: 'https://trace.example.com/a|b' }), '827')).toContain('[Trace](https://trace.example.com/a%7Cb)');
    });

    it('keeps an IPv6 host linkable', () => {
      expect(renderSummary(one({ traceViewerUrl: 'http://[::1]:8080/t/2' }), '827')).toContain('[Trace](http://[::1]:8080/t/2)');
    });

    it.each([
      ['___', '- \\___'],
      ['_ _ _', '- \\_ _ _'],
    ])('keeps a message of %j from drawing a rule', (message, line) => {
      expect(renderSummary(one({ message }), '827', 'detailed')).toContain(`\n${line}\n`);
    });

    it('strips control and bidi characters from the summary', () => {
      const md = renderSummary(one({ message: 'a\u0085b\u001b[31mc' }, 'Pay ‮evil'), '827', 'detailed');

      expect(md).toContain('[Pay evil]');
      expect(md).toContain('- ab\\[31mc');
    });

    it('escapes device text, in its column and on the compact line', () => {
      const run = one({ platform: 'Android', device: 'Pixel | <9>' });

      expect(renderSummary(run, '827')).toContain('| Auth | Android - Pixel \\| &lt;9&gt; | FAILURE |');
      expect(renderSummary(run, '827', 'compact')).toContain('· Android - Pixel \\| &lt;9&gt; ·');
    });

    it('leaves an empty Device cell for a test case with no device, keeping the columns aligned', () => {
      const run = crossDeviceRun();
      run.testCases![3] = { ...run.testCases![3]!, platform: undefined, device: undefined };

      expect(renderSummary(run, '827', 'detailed')).toContain('| [Apply discount code](https://acme.contextqa.com/td/test_case_results/4) | Payments |  | SUCCESS | 58s |');
    });

    it('names at most three devices on the compact line', () => {
      const run = {
        ...failedRun(),
        testCases: ['A', 'B', 'C', 'D', 'E'].map((device, i) => testCase(i + 1, `Case ${i + 1}`, 'Auth', 'SUCCESS', 1_000, { platform: 'Web', device })),
      };

      expect(renderSummary(run, '827', 'compact')).toContain('· Web - A, Web - B, Web - C, +2 more ·');
    });

    it('closes the fold it cuts through when the summary hits the size limit', () => {
      const others = Array.from({ length: 1_000 }, (_, i) => testCase(i + 10, `${'n'.repeat(2_000)} ${i}`, 'Auth', 'SUCCESS', 1_000));
      const md = renderSummary({ ...failedRun(), testCases: [testCase(1, 'Broken', 'Auth', 'FAILURE', 1_000), ...others] }, '827', 'detailed');

      expect(md.match(/<details>/g)).toHaveLength(1);
      expect(md.match(/<\/details>/g)).toHaveLength(1);
      expect(md).toContain('\n\n</details>\n\n_The summary stops here');
    });
  });

  it.each(VIEW_VALUES)('explains missing per-test detail on a failed run in the %s view', (view) => {
    const md = renderSummary(withoutTestCases(failedRun()), '827', view);

    expect(md).toContain('TEST_CASE_RESULTS_READ');
    expect(md).not.toContain('#### Suites');
  });
});

describe('renderLog', () => {
  it('prints the verdict and the report link in the compact view', () => {
    expect(renderLog(failedRun(), 'compact')).toEqual([
      'Run 4512 finished: FAILURE (2 passed, 2 failed of 5)',
      'Report: https://acme.contextqa.com/td/runs/4512',
    ]);
  });

  it('adds each failing test case with its error and its link in the standard view', () => {
    expect(renderLog(failedRun())).toEqual([
      'Run 4512 finished: FAILURE (2 passed, 2 failed of 5)',
      'Failing test cases:',
      '  FAILURE Auth › Login with SSO',
      '    Page load timed out after 30s',
      '    Result: https://acme.contextqa.com/td/test_case_results/2',
      '  FAILURE Payments › Checkout with saved card',
      "    Element not found: button 'Pay now' (failed step: Click 'Pay now')",
      '    Result: https://acme.contextqa.com/td/test_case_results/3',
      '  ABORTED Reports › Export orders to CSV',
      '    Device session ended',
      '    Result: https://acme.contextqa.com/td/test_case_results/5',
      'Report: https://acme.contextqa.com/td/runs/4512',
    ]);
  });

  it('adds the run time, the suites and every detail of each failure in the detailed view', () => {
    expect(renderLog(failedRun(), 'detailed')).toEqual([
      'Run 4512 finished: FAILURE (2 passed, 2 failed of 5)',
      'Duration: 22m 14s · Test execution time: 59m 3s',
      'Suites:',
      '  Auth: 1 of 2 passed',
      '  Payments: 1 of 2 passed',
      '  Reports: 0 of 1 passed',
      'Failing test cases:',
      '  FAILURE Auth › Login with SSO (31s)',
      '    Page load timed out after 30s',
      '    Result: https://acme.contextqa.com/td/test_case_results/2',
      '  FAILURE Payments › Checkout with saved card (1m 42s)',
      "    Failed step 7: Click 'Pay now'",
      "    Error: Element not found: button 'Pay now'",
      '    Expected: Order confirmation page is shown',
      '    Type: ELEMENT_NOT_FOUND',
      '    Result: https://acme.contextqa.com/td/test_case_results/3',
      '    Trace: https://trace.example.com/3',
      '  ABORTED Reports › Export orders to CSV (5s)',
      '    Device session ended',
      '    Result: https://acme.contextqa.com/td/test_case_results/5',
      'Report: https://acme.contextqa.com/td/runs/4512',
    ]);
  });

  it('lists every test case under its suite in the full view, before the failures', () => {
    const lines = renderLog(failedRun(), 'full');

    expect(lines.slice(0, 11)).toEqual([
      'Run 4512 finished: FAILURE (2 passed, 2 failed of 5)',
      'Duration: 22m 14s · Test execution time: 59m 3s',
      'All test cases:',
      '  Auth: 1 of 2 passed',
      '    SUCCESS Login with password (48s) https://acme.contextqa.com/td/test_case_results/1',
      '    FAILURE Login with SSO (31s) https://acme.contextqa.com/td/test_case_results/2',
      '  Payments: 1 of 2 passed',
      '    FAILURE Checkout with saved card (1m 42s) https://acme.contextqa.com/td/test_case_results/3',
      '    SUCCESS Apply discount code (58s) https://acme.contextqa.com/td/test_case_results/4',
      '  Reports: 0 of 1 passed',
      '    ABORTED Export orders to CSV (5s) https://acme.contextqa.com/td/test_case_results/5',
    ]);
    expect(lines.slice(11, 13)).toEqual(['Failing test cases:', '  FAILURE Auth › Login with SSO (31s)']);
    expect(lines).toContain('    Type: ELEMENT_NOT_FOUND');
    expect(lines).not.toContain('Suites:');
  });

  it('lists at most fifty failing test cases', () => {
    const lines = renderLog({ ...failedRun(), testCases: failing(52) });

    expect(lines).toContain('  FAILURE Checkout › Case 50');
    expect(lines).not.toContain('  FAILURE Checkout › Case 51');
    expect(lines).toContain('  …and 2 more in the report.');
  });

  it('prints a passing run the same way in the standard view as in the compact one', () => {
    expect(renderLog(passedRun())).toEqual([
      'Run 4513 finished: SUCCESS (5 passed, 0 failed of 5)',
      'Report: https://acme.contextqa.com/td/runs/4513',
    ]);
  });

  it('keeps every message on its own line', () => {
    const run = { ...failedRun(), testCases: [testCase(2, 'Login', 'Auth', 'FAILURE', 1_000, { message: 'first\nsecond' })] };

    expect(renderLog(run)).toContain('    first second');
  });

  it('keeps server text from reading as a CI command, without changing what it says', () => {
    const run = {
      ...failedRun(),
      testCases: [
        testCase(2, 'Pay ##vso[task.prependpath]/tmp', '::add-mask::Auth', 'FAILURE', 1_000, { message: '::set-output name=x::y\r##[error]boom' }),
      ],
    };

    const lines = renderLog(run, 'detailed');

    for (const line of lines) {
      expect(line.trimStart().startsWith('::')).toBe(false);
      expect(line).not.toMatch(/##(vso)?\[/i);
      expect(line).not.toContain('\r');
    }
    const visible = lines.map((line) => line.replace(/​/g, ''));
    expect(visible).toContain('  ::add-mask::Auth: 0 of 1 passed');
    expect(visible).toContain('    ::set-output name=x::y ##[error]boom');
  });

  describe('device details', () => {
    it('names the devices and the device of each failing test case in the standard view', () => {
      expect(renderLog(crossDeviceRun())).toEqual([
        'Run 4512 finished: FAILURE (2 passed, 2 failed of 5)',
        'Devices: Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed',
        'Failing test cases:',
        '  FAILURE Auth › Login with SSO (Web - Chrome)',
        '    Page load timed out after 30s',
        '    Result: https://acme.contextqa.com/td/test_case_results/2',
        '  FAILURE Payments › Checkout with saved card (Android - Pixel 9)',
        "    Element not found: button 'Pay now' (failed step: Click 'Pay now')",
        '    Result: https://acme.contextqa.com/td/test_case_results/3',
        '  ABORTED Reports › Export orders to CSV (Android - Pixel 9)',
        '    Device session ended',
        '    Result: https://acme.contextqa.com/td/test_case_results/5',
        'Report: https://acme.contextqa.com/td/runs/4512',
      ]);
    });

    it('puts the device before the time in the detailed and full views', () => {
      const detailed = renderLog(crossDeviceRun(), 'detailed');
      const full = renderLog(crossDeviceRun(), 'full');

      expect(detailed.slice(1, 3)).toEqual([
        'Duration: 22m 14s · Test execution time: 59m 3s',
        'Devices: Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed',
      ]);
      expect(detailed).toContain('  FAILURE Payments › Checkout with saved card (Android - Pixel 9, 1m 42s)');
      expect(full).toContain('    SUCCESS Login with password (Web - Chrome, 48s) https://acme.contextqa.com/td/test_case_results/1');
    });

    it('keeps the compact view to the verdict and the report link', () => {
      expect(renderLog(crossDeviceRun(), 'compact')).toHaveLength(2);
    });
  });

  it('keeps every field from starting a CI command, whatever whitespace or line break it hides', () => {
    const run: RunSummary = {
      ...failedRun(),
      reportUrl: 'https://acme.contextqa.com/td/runs/4512\n::add-mask::r',
      results: { ...failedRun().results!, result: 'FAILURE\r::stop-commands::s' },
      testCases: [
        testCase(2, 'Login', '\u0085::add-mask::suite', 'FAILURE', 1_000, {
          message: '\u0085::add-mask::hunter2',
          traceViewerUrl: 'https://t/1\n::add-mask::x',
        }),
        testCase(3, 'Pay', 'Auth', 'SUCCESS\n::set-output name=a::b', 1_000),
      ],
    };

    for (const view of VIEW_VALUES) {
      for (const line of renderLog(run, view)) {
        expect(line).not.toMatch(/[\r\n\u0085]/);
        expect(dotnetTrimStart(line).startsWith('::')).toBe(false);
      }
    }
  });

  it('strips escape and bidi characters from every line', () => {
    const run = { ...failedRun(), testCases: [testCase(2, 'Pay ‮evil', 'Auth', 'FAILURE', 1_000, { message: '\u001b[31mred⁦' })] };

    const lines = renderLog(run);

    expect(lines).toContain('  FAILURE Auth › Pay evil');
    expect(lines).toContain('    [31mred');
  });

  it('clips a very long error in the detailed view', () => {
    const run = { ...failedRun(), testCases: [testCase(2, 'Login', 'Auth', 'FAILURE', 1_000, { message: 'x'.repeat(5_000) })] };

    expect(renderLog(run, 'detailed')).toContain(`    ${'x'.repeat(999)}…`);
  });

  it('lists at most a thousand test cases in the full view, shared across suites', () => {
    const lines = renderLog({ ...passedRun(), testCases: threeSuites() }, 'full');

    expect(lines).toContain('    SUCCESS B400 (1s) https://acme.contextqa.com/td/test_case_results/1000');
    expect(lines.some((line) => line.includes('B401'))).toBe(false);
    expect(lines).not.toContain('  Gamma: 5 of 5 passed');
    expect(lines).toContain('  …and 205 more in the report.');
  });

  it('falls back to the standard view for a view it does not know', () => {
    const lines = renderLog(failedRun(), 'everything' as View);

    expect(lines).toContain('Failing test cases:');
    expect(lines).not.toContain('Suites:');
  });

  it('says when it did not wait for the result', () => {
    expect(renderLog({ runId: 77, reportUrl: `${PORTAL}/td/runs/77`, passed: true })).toEqual([
      'Run 77 started without waiting for the result',
      'Report: https://acme.contextqa.com/td/runs/77',
    ]);
  });
});

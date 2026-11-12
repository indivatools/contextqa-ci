import {
  PASSED_RESULT,
  UNSAFE_CHARS,
  byDevice,
  bySuite,
  clip,
  deviceLabel,
  failureFacts,
  formatDuration,
  isFailing,
  passedOf,
  runTime,
  shortFailure,
} from './outcomes.js';
import type { RunResults, RunSummary, TestCaseOutcome } from './types.js';
import { DEFAULT_VIEW, viewOrDefault, type View } from './view.js';

/** Keeps the job summary readable and well under GitHub's 1 MiB limit. */
const MAX_LISTED_TESTS = 50;
/** Failing test cases, and devices, a compact summary names; the report has the rest. */
const MAX_NAMED_TESTS = 10;
const MAX_NAMED_DEVICES = 3;
/** Rows of the suite and test case tables in a detailed or full summary, for the same limit. */
const MAX_TABLE_ROWS = 1_000;
/** An error longer than these (a stack trace, a page dump) is cut; JUnit keeps all of it. */
const MAX_FACT_CHARS = 1_000;
const MAX_CELL_CHARS = 300;
/** GitHub drops a step's job summary entirely above 1 MiB, so a summary stops, at a line, short of it. */
const MAX_SUMMARY_BYTES = 1_000_000;
const CUT_NOTE = '_The summary stops here to stay within the size limit for job summaries; the report has every test case._';
const MISSING_DETAIL = '_Per-test results need an API token with the `TEST_CASE_RESULTS_READ` permission._';

/**
 * Markdown run summary, rendered by GitHub's job summary and Azure DevOps' Extensions tab. Each view adds
 * to the one before it (see `View`); test case names link to their result in ContextQA when known.
 */
export function renderSummary(summary: RunSummary, planId: string, view: View = DEFAULT_VIEW): string {
  const shown = viewOrDefault(view);
  const lines = [`### ContextQA · test plan ${planId}`, ''];
  const r = summary.results;
  const reportUrl = href(summary.reportUrl);

  if (!r) {
    lines.push(`Run ${summary.runId} started without waiting for the result.`);
    if (reportUrl) lines.push('', `[Open the run in ContextQA](${reportUrl})`);
    return fit(lines);
  }

  const testCases = summary.testCases;
  const devices = byDevice(testCases ?? []);
  if (shown === 'compact') {
    lines.push(verdictLine(summary, r, reportUrl, [...devices.keys()]));
  } else {
    lines.push(
      `${summary.passed ? '✅' : '❌'} **${md(r.result)}** · run ${summary.runId}`,
      '',
      '| Total | Passed | Failed | Aborted | Stopped | Not run | Duration | Test execution time |',
      '|---:|---:|---:|---:|---:|---:|---:|---:|',
      `| ${r.totalCount} | ${r.passedCount} | ${r.failedCount} | ${r.abortedCount} | ${r.stoppedCount} | ${r.notExecutedCount} | ${formatDuration(runTime(r))} | ${executionTime(r.duration)} |`,
    );
    if (devices.size > 0) {
      lines.push('', `**Devices:** ${[...devices].map(([device, cases]) => `${md(device)}: ${passedOf(cases)}`).join(' · ')}`);
    }
    if (reportUrl) lines.push('', `[Open the full report in ContextQA](${reportUrl})`);
  }

  if (!testCases) {
    if (!summary.passed) lines.push('', MISSING_DETAIL);
    return fit(lines);
  }
  const failing = testCases.filter(isFailing);
  if (shown === 'compact') {
    if (failing.length > 0) lines.push('', `**Failing:** ${namedTests(failing)}`);
    return fit(lines);
  }

  const withDevice = devices.size > 0;
  if (shown !== 'standard' && testCases.length > 0) lines.push('', ...suiteTable(testCases));
  if (failing.length > 0) {
    lines.push('', '#### Failing test cases', '', ...(shown === 'standard' ? failureTable(failing, withDevice) : failureBlocks(failing)));
  }
  if (shown === 'detailed') lines.push(...otherTests(testCases.filter((t) => !isFailing(t)), withDevice));
  if (shown === 'full' && testCases.length > 0) lines.push('', ...allTests(testCases, withDevice));
  return fit(lines);
}

/** The whole run in one line: verdict, counts that are not zero, run time, devices and the report link. */
function verdictLine(summary: RunSummary, r: RunResults, reportUrl: string | undefined, devices: string[]): string {
  const others: [number, string][] = [
    [r.failedCount, 'failed'],
    [r.abortedCount, 'aborted'],
    [r.stoppedCount, 'stopped'],
    [r.notExecutedCount, 'not run'],
  ];
  const parts = [
    `${summary.passed ? '✅' : '❌'} **${md(r.result)}**`,
    `run ${summary.runId}`,
    `${r.passedCount} of ${r.totalCount} passed`,
    ...others.filter(([count]) => count > 0).map(([count, what]) => `${count} ${what}`),
    formatDuration(runTime(r)),
  ];
  if (devices.length > 0) {
    const named = devices.slice(0, MAX_NAMED_DEVICES).map(md);
    if (devices.length > MAX_NAMED_DEVICES) named.push(`+${devices.length - MAX_NAMED_DEVICES} more`);
    parts.push(named.join(', '));
  }
  if (reportUrl) parts.push(`[Open in ContextQA](${reportUrl})`);
  return parts.join(' · ');
}

function namedTests(failing: TestCaseOutcome[]): string {
  const names = failing.slice(0, MAX_NAMED_TESTS).map(linkedName);
  if (failing.length > MAX_NAMED_TESTS) names.push(`…and ${failing.length - MAX_NAMED_TESTS} more`);
  return names.join(' · ');
}

function failureTable(failing: TestCaseOutcome[], withDevice: boolean): string[] {
  const lines = withDevice
    ? ['| Test case | Suite | Device | Result | Message |', '|---|---|---|---|---|']
    : ['| Test case | Suite | Result | Message |', '|---|---|---|---|'];
  for (const t of failing.slice(0, MAX_LISTED_TESTS)) {
    const message = [md(clip(shortFailure(t), MAX_FACT_CHARS)), traceLink(t)].filter(Boolean).join(' · ');
    lines.push(`| ${linkedName(t)} | ${md(t.suite)} | ${deviceCell(t, withDevice)}${md(t.result)} | ${message} |`);
  }
  return [...lines, ...more(failing.length, MAX_LISTED_TESTS)];
}

function suiteTable(testCases: TestCaseOutcome[]): string[] {
  const lines = [
    '#### Suites',
    '',
    '| Suite | Tests | Passed | Failed | Aborted | Test execution time |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  const suites = [...bySuite(testCases)];
  for (const [suite, cases] of suites.slice(0, MAX_TABLE_ROWS)) {
    const count = (result: string): number => cases.filter((t) => t.result === result).length;
    const time = cases.reduce((sum, t) => sum + t.durationMs, 0);
    lines.push(`| ${md(suite)} | ${cases.length} | ${count(PASSED_RESULT)} | ${count('FAILURE')} | ${count('ABORTED')} | ${formatDuration(time)} |`);
  }
  return [...lines, ...more(suites.length, MAX_TABLE_ROWS)];
}

/** Each failure under its own heading, with everything known about the step that failed. */
function failureBlocks(failing: TestCaseOutcome[]): string[] {
  const lines: string[] = [];
  for (const t of failing.slice(0, MAX_LISTED_TESTS)) {
    if (lines.length > 0) lines.push('');
    const where = [md(t.suite), md(deviceLabel(t))].filter(Boolean).join(' · ');
    lines.push(`**❌ ${linkedName(t)}** · ${where} · ${md(t.result)} · ${formatDuration(t.durationMs)}`);
    const items = failureFacts(t).map(({ label, text }) =>
      label ? `- **${label}:** ${md(clip(text, MAX_FACT_CHARS))}` : `- ${blockMd(clip(text, MAX_FACT_CHARS))}`,
    );
    const trace = traceLink(t);
    if (trace) items.push(`- ${trace}`);
    if (items.length > 0) lines.push('', ...items);
  }
  return [...lines, ...more(failing.length, MAX_LISTED_TESTS)];
}

/** The test cases that did not fail, folded away so the failures stay in view. */
function otherTests(others: TestCaseOutcome[], withDevice: boolean): string[] {
  if (others.length === 0) return [];
  const rows = others
    .slice(0, MAX_TABLE_ROWS)
    .map((t) => `| ${linkedName(t)} | ${md(t.suite)} | ${deviceCell(t, withDevice)}${md(t.result)} | ${formatDuration(t.durationMs)} |`);
  return [
    '',
    `<details><summary>Other test cases (${others.length})</summary>`,
    '',
    ...(withDevice ? ['| Test case | Suite | Device | Result | Time |', '|---|---|---|---|---:|'] : ['| Test case | Suite | Result | Time |', '|---|---|---|---:|']),
    ...rows,
    ...more(others.length, MAX_TABLE_ROWS),
    '',
    '</details>',
  ];
}

function allTests(testCases: TestCaseOutcome[], withDevice: boolean): string[] {
  const lines = ['#### All test cases'];
  const header = withDevice
    ? ['| Test case | Device | Result | Time | Message |', '|---|---|---|---:|---|']
    : ['| Test case | Result | Time | Message |', '|---|---|---:|---|'];
  let room = MAX_TABLE_ROWS;
  for (const [suite, cases] of bySuite(testCases)) {
    if (room === 0) break;
    lines.push('', `##### ${md(suite)} · ${passedOf(cases)}`, '', ...header);
    for (const t of cases.slice(0, room)) {
      const message = t.result === PASSED_RESULT ? '' : md(clip(shortFailure(t), MAX_CELL_CHARS));
      lines.push(`| ${linkedName(t)} | ${deviceCell(t, withDevice)}${md(t.result)} | ${formatDuration(t.durationMs)} | ${message} |`);
    }
    room -= Math.min(room, cases.length);
  }
  return [...lines, ...more(testCases.length, MAX_TABLE_ROWS)];
}

/** The test case's name, linked to its result in ContextQA, else to its trace. */
function linkedName(t: TestCaseOutcome): string {
  const url = href(t.resultUrl) ?? href(t.traceViewerUrl);
  return url ? `[${md(t.name)}](${url})` : md(t.name);
}

/** The device column's cell and its separator, when the table has the column. */
function deviceCell(t: TestCaseOutcome, withDevice: boolean): string {
  return withDevice ? `${md(deviceLabel(t))} | ` : '';
}

/** The trace, when the name links to the result and not to it. */
function traceLink(t: TestCaseOutcome): string {
  const trace = href(t.traceViewerUrl);
  return trace && href(t.resultUrl) ? `[Trace](${trace})` : '';
}

function more(total: number, listed: number): string[] {
  return total > listed ? ['', `…and ${total - listed} more in the report.`] : [];
}

/**
 * The lines as the summary, cut at a line before GitHub's size limit when they would pass it; a fold left
 * open by the cut is closed so the note shows.
 */
function fit(lines: string[]): string {
  const text = lines.join('\n') + '\n';
  if (Buffer.byteLength(text) <= MAX_SUMMARY_BYTES) return text;
  const kept: string[] = [];
  let bytes = Buffer.byteLength(CUT_NOTE) + Buffer.byteLength('\n\n</details>\n\n');
  for (const line of lines) {
    bytes += Buffer.byteLength(line) + 1;
    if (bytes > MAX_SUMMARY_BYTES) break;
    kept.push(line);
  }
  if (kept.findLastIndex((line) => line.startsWith('<details>')) > kept.lastIndexOf('</details>')) kept.push('', '</details>');
  return [...kept, '', CUT_NOTE].join('\n') + '\n';
}

/**
 * A server URL as a Markdown link target: http(s) only, without credentials, with every character after
 * the host that could end the link (or the table cell around it) percent-encoded, and `&` written as
 * `&amp;`, since Markdown decodes entities in a link target (`&commat;` would otherwise move the host).
 * Anything else is not linked.
 */
function href(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  const rest = `${parsed.pathname}${parsed.search}${parsed.hash}`.replace(
    /[()[\]|<>"'`\\ ]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${parsed.origin}${rest}`.replace(/&/g, '&amp;');
}

/**
 * Server text as one line of inline Markdown that cannot open HTML, a link, a code span or a table cell.
 * `_` stays as it is: it is common in names (`ELEMENT_NOT_FOUND`) and emphasis cannot break a link.
 */
function md(text: string): string {
  return text
    .replace(UNSAFE_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*~[\]|]/g, (c) => `\\${c}`)
    .replace(/\r\n?|\n/g, ' ');
}

/** `md` for text that begins a block, such as a list item: it cannot open a heading, list or rule either. */
function blockMd(text: string): string {
  return md(text.trimStart())
    .replace(/^([#+=_-])/, '\\$1')
    .replace(/^(\d+)([.)])/, '$1\\$2');
}

/**
 * Sum of the test cases' own durations — ContextQA's "Actual TC Execution Time". Beside the run's
 * wall-clock it shows how much of the run was test time: less when tests waited for a device, more
 * when they ran in parallel.
 */
function executionTime(ms: number | null | undefined): string {
  return typeof ms === 'number' ? formatDuration(ms) : '—';
}

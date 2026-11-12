import {
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

/** As in the job summary: failing test cases listed, then test cases in all; the report has the rest. */
const MAX_LISTED_TESTS = 50;
const MAX_ALL_TESTS = 1_000;
/** An error longer than this (a stack trace, a page dump) is cut; JUnit keeps all of it. */
const MAX_FACT_CHARS = 1_000;

/**
 * The run's result as plain lines for the CI log, in the given view (see `View`). The compact view is the
 * two lines the CLI has always ended with; every other view adds to it.
 */
export function renderLog(summary: RunSummary, view: View = DEFAULT_VIEW): string[] {
  const shown = viewOrDefault(view);
  const r = summary.results;
  const lines: string[] = [];
  if (r) {
    lines.push(`Run ${summary.runId} finished: ${r.result} (${r.passedCount} passed, ${r.failedCount} failed of ${r.totalCount})`);
    const testCases = summary.testCases ?? [];
    if (shown === 'detailed' || shown === 'full') lines.push(runTimes(r));
    if (shown !== 'compact') lines.push(...devices(testCases));
    if (shown === 'detailed') lines.push(...suites(testCases));
    if (shown === 'full') lines.push(...allTests(testCases));
    if (shown !== 'compact') lines.push(...failures(testCases.filter(isFailing), shown !== 'standard'));
  } else {
    lines.push(`Run ${summary.runId} started without waiting for the result`);
  }
  if (summary.reportUrl) lines.push(`Report: ${summary.reportUrl}`);
  return lines.map(logLine);
}

function runTimes(r: RunResults): string {
  const testTime = typeof r.duration === 'number' ? ` · Test execution time: ${formatDuration(r.duration)}` : '';
  return `Duration: ${formatDuration(runTime(r))}${testTime}`;
}

/** One line: each device the run used and how its test cases did. */
function devices(testCases: TestCaseOutcome[]): string[] {
  const used = [...byDevice(testCases)];
  return used.length > 0 ? [`Devices: ${used.map(([device, cases]) => `${device}: ${passedOf(cases)}`).join(' · ')}`] : [];
}

function suites(testCases: TestCaseOutcome[]): string[] {
  if (testCases.length === 0) return [];
  return ['Suites:', ...[...bySuite(testCases)].map(([suite, cases]) => `  ${suite}: ${passedOf(cases)}`)];
}

function allTests(testCases: TestCaseOutcome[]): string[] {
  if (testCases.length === 0) return [];
  const lines = ['All test cases:'];
  let room = MAX_ALL_TESTS;
  for (const [suite, cases] of bySuite(testCases)) {
    if (room === 0) break;
    lines.push(`  ${suite}: ${passedOf(cases)}`);
    for (const t of cases.slice(0, room)) {
      const link = t.resultUrl ?? t.traceViewerUrl;
      lines.push(`    ${t.result} ${t.name} ${aside(t, true)}${link ? ` ${link}` : ''}`);
    }
    room -= Math.min(room, cases.length);
  }
  return [...lines, ...more(testCases.length, MAX_ALL_TESTS)];
}

/** Each failing test case with its error and its link; `detailed` adds the failed step's every detail. */
function failures(failing: TestCaseOutcome[], detailed: boolean): string[] {
  if (failing.length === 0) return [];
  const lines = ['Failing test cases:'];
  for (const t of failing.slice(0, MAX_LISTED_TESTS)) {
    const where = aside(t, detailed);
    lines.push(`  ${t.result} ${t.suite} › ${t.name}${where ? ` ${where}` : ''}`);
    if (detailed) {
      for (const { label, text } of failureFacts(t)) lines.push(`    ${label ? `${label}: ` : ''}${clip(text, MAX_FACT_CHARS)}`);
      if (t.resultUrl) lines.push(`    Result: ${t.resultUrl}`);
      if (t.traceViewerUrl) lines.push(`    Trace: ${t.traceViewerUrl}`);
    } else {
      const failure = shortFailure(t);
      if (failure) lines.push(`    ${clip(failure, MAX_FACT_CHARS)}`);
      if (t.resultUrl) lines.push(`    Result: ${t.resultUrl}`);
      else if (t.traceViewerUrl) lines.push(`    Trace: ${t.traceViewerUrl}`);
    }
  }
  return [...lines, ...more(failing.length, MAX_LISTED_TESTS)];
}

/** The device and, when asked for, the time of a test case, as "(Android - Pixel 9, 1m 42s)"; '' if neither. */
function aside(t: TestCaseOutcome, withTime: boolean): string {
  const parts = [deviceLabel(t), withTime ? formatDuration(t.durationMs) : ''].filter(Boolean);
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

function more(total: number, listed: number): string[] {
  return total > listed ? [`  …and ${total - listed} more in the report.`] : [];
}

/**
 * A line for a CI log that server text cannot turn into a command. Line breaks become spaces (a runner
 * splits on a lone CR too) and unsafe characters go (see `UNSAFE_CHARS`). CI runners act on some lines:
 * GitHub on `::command::` starting a line (after leading whitespace) and `##[command]` anywhere, Azure on
 * `##vso[command]` anywhere. Test names and errors come from the server and from the app under test, so
 * a zero-width space breaks those markers up: the line reads the same and does nothing. Every line the
 * wrappers print goes through here.
 */
export function logLine(line: string): string {
  return line
    .replace(/\r\n?|\n/g, ' ')
    .replace(UNSAFE_CHARS, '')
    .replace(/^(\s*:)(?=:)/, '$1​')
    .replace(/#(?=#(?:vso)?\[)/gi, '#​');
}

# Changelog

Changes to the ContextQA CI integrations: the GitHub Action, the `contextqa` CLI and container image, and
the GitLab, CircleCI, Azure DevOps, Bitbucket and Jenkins wrappers. `@v1`, `:1` and `@1` always point to
the latest 1.x release, so these updates reach existing pipelines without any change on your side.

## 1.2.0 — Unreleased

Choose how much of each run your CI shows, see where each test case ran, and go from any test case
straight to its result in ContextQA.

### Added

- **Views.** A new `view` option sets how much the job summary and the end of the log show: `compact`
  (the verdict, and in the job summary the names of the failing test cases), `standard` (the default:
  each failing test case with its error), `detailed` (also a breakdown by suite, and each failure in full)
  or `full` (also every test case). Set `view` in the GitHub Action, the GitLab component, the CircleCI
  orb, the Jenkins step and the Azure DevOps task, `CONTEXTQA_VIEW` in the Bitbucket pipe, or `--view` /
  `CONTEXTQA_VIEW` for the CLI and the container image. See
  [Summary and log views](docs/report-views.md) for a sample of each view and a snippet for every CI.
- **A link to each test case's result.** Test cases now link to their result in ContextQA: the name in the
  job summary, a `Result:` line under each failing test case in the log and in the JUnit report's failure
  text (so it shows in the GitLab, Jenkins, Azure DevOps, CircleCI and Bitbucket test tabs), and
  `resultUrl` in `--json` output. There is nothing to configure, and the token needs no new permission.
- **Device details.** When ContextQA reports where a test case ran, your CI shows it too, worded as on the
  ContextQA run page: the platform and the browser, or on mobile the device, such as `Web - Chrome` or
  `Android - Pixel 9`. The job summary and the log show each device's passed count and the device of each
  test case they list; in `compact`, the job summary names up to three devices and the log none. The
  device is also in the JUnit report's failure text (so your CI's test tab shows it), in `--json` output,
  and in GitHub and Azure DevOps annotations. There is nothing to configure, and the token needs no new
  permission. Browser and OS versions are not shown.

### Improved

- **The log shows what failed.** In the default `standard` view, the log now ends with each failing test
  case (up to 50), its error and a link to its result, then the report link. Until now the GitLab,
  Jenkins, CircleCI and Bitbucket logs ended with just the counts and the report link. The Azure DevOps
  log and the GitHub Action's step log get the same lines.
- **Long errors and large runs stay readable.** In the job summary and the log, an error longer than 1,000
  characters, such as a stack trace, is cut with `…` (at 300 in the `full` view's test case tables); the
  JUnit report keeps it whole. A job summary that would pass GitHub's 1 MiB limit now stops at a line,
  with a note that the report has every test case, instead of GitHub dropping it.

### Security

- Text from ContextQA, such as test names and errors, can no longer be read as CI commands in the log or
  add HTML to the job summary.

### Compatibility

- No change to how existing inputs behave, to outputs or exit codes, and a run's pass or fail verdict is
  decided exactly as before. `view` changes only the job summary and the log, never the JUnit report,
  `--json` output, outputs, annotations or exit code.
- `standard` keeps the job summary you have today, except that each test case's name now links to its
  result (its trace link moves beside the error), an error longer than 1,000 characters is cut, and, when
  ContextQA reports devices, a *Devices* line follows the counts and the failing test cases table has a
  *Device* column.
- `--json` output gains `resultUrl` on each test case, and each failure in the JUnit report gains a
  `Result:` line, before `Trace:` and `Report:`.
- Device details appear only when ContextQA reports them: `--json` output then gains `platform` and
  `device` on each test case, each failure in the JUnit report gains a `Device:` line before `Result:`,
  and GitHub and Azure DevOps annotations add the device after the test name, as in
  `ContextQA: Checkout › Pay (Android - Pixel 9)`.
- In the CLI, and so in GitLab, Jenkins, CircleCI and Bitbucket, `compact` ends the log exactly as earlier
  releases did.

## 1.1.1 — 2026-11-11

### Added

- **The CLI is on npm** as [`contextqa`](https://www.npmjs.com/package/contextqa). Run it anywhere Node 20.6+
  is available, with no install step: `npx contextqa@1 run-plan --plan-id <id>`.
- The Jenkins step now works on agents that have Node: it starts the CLI from npm. Before this, those
  agents needed `runner: 'docker'`.

Nothing changes for the GitHub Action, the container image or the Bitbucket pipe.

## 1.1.0 — 2026-11-11

Clearer CI reports: the right run time, the test names you see in ContextQA, and what failed, without
opening ContextQA.

### Improved

- **Run time matches ContextQA.** The job summary's *Duration* and the JUnit report's run time now show how
  long the run actually took, from start to finish. Test cases run in parallel, so this used to be reported
  as the sum of every test's time — a 22-minute run could show as 59 minutes. A new *Test execution time*
  column keeps that sum, as ContextQA's *Actual TC Execution Time* does.
- **Test names match ContextQA.** Each test is reported under its current name, as in the ContextQA run
  report, instead of the name saved when the run started.
- **Failures say what went wrong.** For a failed test, the JUnit report shows the step that failed, its
  error, the expected result and the failure type, with a link to the full ContextQA report. The job summary
  shows the failed step and its error, and GitHub and Azure DevOps annotations show the error instead of
  only `FAILURE`. A run with more than 50 failed tests gets these details for the first 50; the ContextQA
  report has the rest.

### Added

- **Failed-step screenshots.** When you write a JUnit report (`junit-path` in the GitHub Action, `--junit`
  in the CLI), the failed step's screenshot is saved to a `contextqa-screenshots` folder beside it and
  attached to the test in Jenkins and GitLab. Upload that folder with the report to keep them. See
  *Keeping the JUnit report and its screenshots* in the [README](README.md).

### Permissions

- Run time, names and failure details work with the permissions you already have
  (`TEST_CASE_RESULTS_READ`).
- **Optional:** add `TEST_STEP_RESULTS_READ` to the token for every screenshot, and for failure details of
  runs from older ContextQA versions. Without it, the report is otherwise complete and only notes what it
  skipped.
- Mobile build uploads only need `TEST_PLAN_EXECUTE`; the docs no longer ask for a separate upload
  permission.

### Compatibility

- No change to inputs, outputs or exit codes, and a run's pass or fail verdict is decided exactly as
  before. Everything new is best effort: if ContextQA can't provide a detail, the report says so and the
  job continues.
- Screenshot links are short-lived and never written to logs, the job summary or `--json` output.

## 1.0.0 — 2026-10-16

First release: run a ContextQA test plan from CI and fail the job when it fails.

- GitHub Action, `contextqa` CLI and container image (`ghcr.io/indivatools/contextqa-cli`), GitLab
  component, CircleCI orb, Azure DevOps task, Bitbucket pipe and Jenkins shared library.
- Waits for the run and prints a summary with a link to the ContextQA report.
- Writes results as JUnit XML for your CI's test tab.
- Uploads a mobile build before the run.

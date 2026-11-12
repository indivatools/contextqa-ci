# Summary and log views

When a run finishes, the ContextQA step shows its result in the job summary (on GitHub Actions and Azure
Pipelines) and at the end of the log (on every CI). The `view` option sets how much they show, from a
one-line verdict (`compact`) to every test case (`full`). Your CI's test tab, the exit code and the
verdict are the same in every view.

Views, test case links and device details come with release 1.2.0. `@v1`, `@1` and `:1` pick them up on
their own; if you pin an exact version, use 1.2.0 or later.

## Choose a view

| View | Choose it when |
|---|---|
| `compact` | You only need the verdict and a link, or several plans report to one run page. The job summary is one line with the verdict and the counts, then the names of the failing test cases; the log ends with two lines. |
| `standard` (default) | Most pipelines. You see each failing test case with its error, its device and a link to its result. |
| `detailed` | You look into failures from CI. Each failure is spelled out (failed step, error, expected result, failure type, exception, trace), with a breakdown by suite. |
| `full` | You want the whole run in CI, passing test cases too: every test case under its suite, with its result, time and link. |

Each view shows what the one before it shows, and more.

## Where you see it

| CI | Job summary | End of the log | Test results (the same in every view) |
|---|---|---|---|
| GitHub Actions | the run's summary page | the step log | annotations on the run page, and the JUnit file if you set `junit-path` |
| Azure Pipelines | the run's **Extensions** tab | the task log | the **Tests** tab, and an error for each failing test case |
| GitLab CI/CD | none | the job log | the merge request's test summary and the pipeline's **Tests** tab |
| Jenkins | none | the console output | the build's **Test Result** page |
| CircleCI | none | the step output | the job's **Tests** tab |
| Bitbucket Pipelines | none | the step log | the step's **Tests** tab |
| CLI, container image | none | standard output | the files you ask for with `--junit` and `--json` |

`view` changes the first two columns only. Where there is no job summary, it sets the end of the log.

## Set the view

The values are `compact`, `standard`, `detailed` and `full`, in lower case. Leave the option out to get
`standard`.

### GitHub Actions

```yaml
steps:
  - uses: indivatools/contextqa-ci@v1
    with:
      plan-id: 827
      token: ${{ secrets.CONTEXTQA_TOKEN }}
      view: detailed
```

### GitLab CI/CD

```yaml
include:
  - component: gitlab.com/contextqa/contextqa-ci/run-test-plan@1
    inputs:
      plan-id: "827"
      view: detailed
```

### Jenkins

```groovy
contextqaRunPlan planId: '827', credentialsId: 'contextqa-token', view: 'detailed'
```

### Azure Pipelines

```yaml
steps:
  - task: ContextQARunTestPlan@1
    inputs:
      planId: '827'
      token: $(CONTEXTQA_TOKEN)
      view: 'detailed'
```

In the classic editor, pick it under **Summary and log view**.

### CircleCI

```yaml
workflows:
  test:
    jobs:
      - contextqa/run:
          plan-id: '827'
          context: contextqa
          view: detailed
```

The `contextqa/run-plan` command, for use inside your own jobs, takes the same `view` parameter.

### Bitbucket Pipelines

```yaml
script:
  - pipe: docker://ghcr.io/indivatools/contextqa-cli:1
    variables:
      CONTEXTQA_TOKEN: $CONTEXTQA_TOKEN
      CONTEXTQA_PLAN_ID: '827'
      CONTEXTQA_VIEW: detailed
```

### CLI and container image

```sh
CONTEXTQA_TOKEN=… npx contextqa@1 run-plan --plan-id 827 --view detailed

docker run --rm -e CONTEXTQA_TOKEN \
  ghcr.io/indivatools/contextqa-cli:1 run-plan --plan-id 827 --view detailed
```

`CONTEXTQA_VIEW=detailed` does the same as `--view detailed`; when both are set, the flag wins.

## What each view shows

The samples below come from one example run of test plan 827: five test cases in three suites, on Chrome
and on a Pixel 9, of which two failed and one was aborted. The job summary is shown as the Markdown that
GitHub and Azure DevOps render as formatted text and tables. The log samples are the lines printed when
the run finishes, after the progress lines. `…` marks where a sample is cut short.

### `compact`

The job summary is the verdict on one line, with how many test cases passed, the other counts that are
not zero, the run time, up to three devices and a link to the run. The names of up to 10 failing test
cases follow, each linked to its result. A run that passed is just the one line.

```markdown
### ContextQA · test plan 827

❌ **FAILURE** · run 4512 · 2 of 5 passed · 2 failed · 1 aborted · 22m 14s · Web - Chrome, Android - Pixel 9 · [Open in ContextQA](https://your-company.contextqa.com/td/runs/4512)

**Failing:** [Login with SSO](https://your-company.contextqa.com/run-result-view?testCaseId=102&runResultId=2) · [Checkout with saved card](https://your-company.contextqa.com/run-result-view?testCaseId=103&runResultId=3) · [Export orders to CSV](https://your-company.contextqa.com/run-result-view?testCaseId=105&runResultId=5)
```

The log ends with the verdict and the report link, as it did before 1.2.0:

```text
Run 4512 finished: FAILURE (2 passed, 2 failed of 5)
Report: https://your-company.contextqa.com/td/runs/4512
```

### `standard`

The default. The job summary has the counts, the run's **Duration** (start to end) and **Test execution
time** (the tests' own time added up), how each device did, a link to the report, and a table of the
failing test cases (up to 50): each with its suite, device, result and error, the step that failed, and a
link to its trace when there is one.

```markdown
### ContextQA · test plan 827

❌ **FAILURE** · run 4512

| Total | Passed | Failed | Aborted | Stopped | Not run | Duration | Test execution time |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 | 2 | 2 | 1 | 0 | 0 | 22m 14s | 59m 3s |

**Devices:** Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed

[Open the full report in ContextQA](https://your-company.contextqa.com/td/runs/4512)

#### Failing test cases

| Test case | Suite | Device | Result | Message |
|---|---|---|---|---|
| [Login with SSO](https://your-company.contextqa.com/run-result-view?testCaseId=102&runResultId=2) | Auth | Web - Chrome | FAILURE | Page load timed out after 30s |
| [Checkout with saved card](https://your-company.contextqa.com/run-result-view?testCaseId=103&runResultId=3) | Payments | Android - Pixel 9 | FAILURE | Element not found: button 'Pay now' (failed step: Click 'Pay now') · [Trace](…) |
| [Export orders to CSV](https://your-company.contextqa.com/run-result-view?testCaseId=105&runResultId=5) | Reports | Android - Pixel 9 | ABORTED | Device session ended |
```

The log adds how each device did, and each failing test case (up to 50) with its device, its error and a
link to its result. For a run that passed, that is the verdict, the devices and the report link.

```text
Run 4512 finished: FAILURE (2 passed, 2 failed of 5)
Devices: Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed
Failing test cases:
  FAILURE Auth › Login with SSO (Web - Chrome)
    Page load timed out after 30s
    Result: https://your-company.contextqa.com/run-result-view?testCaseId=102&runResultId=2
  FAILURE Payments › Checkout with saved card (Android - Pixel 9)
    Element not found: button 'Pay now' (failed step: Click 'Pay now')
    Result: https://your-company.contextqa.com/run-result-view?testCaseId=103&runResultId=3
  ABORTED Reports › Export orders to CSV (Android - Pixel 9)
    Device session ended
    Result: https://your-company.contextqa.com/run-result-view?testCaseId=105&runResultId=5
Report: https://your-company.contextqa.com/td/runs/4512
```

### `detailed`

The job summary adds a table of suites, spells out each failure below its name (failed step, error,
expected result, failure type, exception and trace, as far as ContextQA recorded them), and folds the test
cases that did not fail into a list you can expand. The top, down to the report link, is as in
`standard`.

```markdown
…

#### Suites

| Suite | Tests | Passed | Failed | Aborted | Test execution time |
|---|---:|---:|---:|---:|---:|
| Auth | 2 | 1 | 1 | 0 | 1m 19s |
| Payments | 2 | 1 | 1 | 0 | 2m 40s |
| Reports | 1 | 0 | 0 | 1 | 5s |

#### Failing test cases

**❌ [Login with SSO](https://your-company.contextqa.com/run-result-view?testCaseId=102&runResultId=2)** · Auth · Web - Chrome · FAILURE · 31s

- Page load timed out after 30s

**❌ [Checkout with saved card](https://your-company.contextqa.com/run-result-view?testCaseId=103&runResultId=3)** · Payments · Android - Pixel 9 · FAILURE · 1m 42s

- **Failed step 7:** Click 'Pay now'
- **Error:** Element not found: button 'Pay now'
- **Expected:** Order confirmation page is shown
- **Type:** ELEMENT_NOT_FOUND
- [Trace](…)

…

<details><summary>Other test cases (2)</summary>

| Test case | Suite | Device | Result | Time |
|---|---|---|---|---:|
| [Login with password](https://your-company.contextqa.com/run-result-view?testCaseId=101&runResultId=1) | Auth | Web - Chrome | SUCCESS | 48s |
| [Apply discount code](https://your-company.contextqa.com/run-result-view?testCaseId=104&runResultId=4) | Payments | Web - Chrome | SUCCESS | 58s |

</details>
```

The log adds the run times, each suite's passed count, each failing test case's time, and every detail of
its failure:

```text
Run 4512 finished: FAILURE (2 passed, 2 failed of 5)
Duration: 22m 14s · Test execution time: 59m 3s
Devices: Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed
Suites:
  Auth: 1 of 2 passed
  Payments: 1 of 2 passed
  Reports: 0 of 1 passed
Failing test cases:
  FAILURE Auth › Login with SSO (Web - Chrome, 31s)
    Page load timed out after 30s
    Result: https://your-company.contextqa.com/run-result-view?testCaseId=102&runResultId=2
  FAILURE Payments › Checkout with saved card (Android - Pixel 9, 1m 42s)
    Failed step 7: Click 'Pay now'
    Error: Element not found: button 'Pay now'
    Expected: Order confirmation page is shown
    Type: ELEMENT_NOT_FOUND
    Result: https://your-company.contextqa.com/run-result-view?testCaseId=103&runResultId=3
    Trace: …
  ABORTED Reports › Export orders to CSV (Android - Pixel 9, 5s)
    Device session ended
    Result: https://your-company.contextqa.com/run-result-view?testCaseId=105&runResultId=5
Report: https://your-company.contextqa.com/td/runs/4512
```

### `full`

As `detailed`, but instead of folding the other test cases away, the job summary ends with every test case
(up to 1,000) under its suite, with its device, result, time and error:

```markdown
…

#### All test cases

##### Auth · 1 of 2 passed

| Test case | Device | Result | Time | Message |
|---|---|---|---:|---|
| [Login with password](https://your-company.contextqa.com/run-result-view?testCaseId=101&runResultId=1) | Web - Chrome | SUCCESS | 48s |  |
| [Login with SSO](https://your-company.contextqa.com/run-result-view?testCaseId=102&runResultId=2) | Web - Chrome | FAILURE | 31s | Page load timed out after 30s |

##### Payments · 1 of 2 passed

…
```

In place of the `Suites:` list, the log lists every test case (up to 1,000) under its suite, with its
result, device, time and link. The failing test cases follow, as in `detailed`:

```text
Run 4512 finished: FAILURE (2 passed, 2 failed of 5)
Duration: 22m 14s · Test execution time: 59m 3s
Devices: Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed
All test cases:
  Auth: 1 of 2 passed
    SUCCESS Login with password (Web - Chrome, 48s) https://your-company.contextqa.com/run-result-view?testCaseId=101&runResultId=1
    FAILURE Login with SSO (Web - Chrome, 31s) https://your-company.contextqa.com/run-result-view?testCaseId=102&runResultId=2
  Payments: 1 of 2 passed
    FAILURE Checkout with saved card (Android - Pixel 9, 1m 42s) https://your-company.contextqa.com/run-result-view?testCaseId=103&runResultId=3
    SUCCESS Apply discount code (Web - Chrome, 58s) https://your-company.contextqa.com/run-result-view?testCaseId=104&runResultId=4
  Reports: 0 of 1 passed
    ABORTED Export orders to CSV (Android - Pixel 9, 5s) https://your-company.contextqa.com/run-result-view?testCaseId=105&runResultId=5
Failing test cases:
  …
Report: https://your-company.contextqa.com/td/runs/4512
```

## Test case links

Each test case links to its result in ContextQA: that test case, in that run.

| Where | What you get |
|---|---|
| Job summary | The test case's name is the link, in every view. |
| Log | A `Result:` line under each failing test case (`standard`, `detailed`, `full`). In `full`, every test case's line ends with its link. |
| JUnit report | A `Result:` line in each failure's text, so the link is in your CI's test tab too. |
| `--json` output | `resultUrl` on each test case. |

- The link opens ContextQA in your browser, so you need to be signed in to ContextQA, as for the report
  link.
- There is nothing to set up. The link opens the result page that ContextQA itself opens when you click
  the test case in the run report, on the ContextQA that the run's own link points to, so the token needs
  no new permission.
- If ContextQA links the run in another form, test cases are not linked to their result. The job summary
  then links a test case's name to its trace, if it has one, and the log shows a `Trace:` line instead.
- A trace keeps its own link: **Trace** beside the error in the `standard` job summary, the last line of
  each failure in `detailed` and `full`, and a `Trace:` line in the `detailed` and `full` logs.

## Device details

When ContextQA reports where a test case ran, the summary and the log say so, worded as on the ContextQA
run page: the platform and the browser, or on mobile the device, such as `Web - Chrome`, `Web - Safari`,
`Android - Pixel 9` or `iOS - iPhone 15`.

| Where | What you get |
|---|---|
| `compact` job summary | Up to three devices on the verdict line, then `+2 more` and so on. |
| `standard`, `detailed` and `full` job summaries | A **Devices** line with how each device did (`Web - Chrome: 2 of 3 passed · Android - Pixel 9: 0 of 2 passed`) and a **Device** column in each test case table. `detailed` and `full` also put the device beside each failure. |
| Log | A `Devices:` line and the device of each test case listed, in every view but `compact`. |
| JUnit report | A `Device:` line in each failure's text. |
| `--json` output | `platform` and `device` on each test case. |
| GitHub annotations, Azure DevOps errors | The device after the test name: `ContextQA: Payments › Checkout with saved card (Android - Pixel 9)`. |

- Only the platform and the browser or device name are shown: no browser or OS versions, and no device
  or app IDs.
- Devices come with the per-test results (`TEST_CASE_RESULTS_READ`), so there is nothing to set up and
  the token needs no new permission.
- When no test case in the run says where it ran, there is no **Devices** line and no **Device** column.

## Limits

The summary and the log stop listing after a while, so that they stay readable and the job summary stays
within GitHub's size limit. Your CI's test tab (the JUnit report) still has every test case ContextQA
reported, with each error whole, and the ContextQA report has everything.

| What | Up to | Then |
|---|---|---|
| Failing test cases named in a `compact` job summary | 10 | `…and 2 more` |
| Devices named in a `compact` job summary | 3 | `+2 more` |
| Failing test cases listed in the job summary and the log | 50 | `…and 2 more in the report.` |
| Rows in the suites table (`detailed`, `full`) and in the list of other test cases (`detailed`), and test cases listed by `full`, across all suites | 1,000 | `…and 2 more in the report.` |
| An error, in the job summary and the log | 1,000 characters, or 300 in the `full` job summary's test case tables | cut with `…` |
| The whole job summary | just under GitHub's 1 MiB | stops at a line, with the note *The summary stops here to stay within the size limit for job summaries; the report has every test case.* |

The job summary and the log also put each error on one line; the JUnit report keeps its line breaks.

## Names and errors are shown as text

Test names, errors and links come from ContextQA and from the app under test, so they are shown as text.
In the job summary they cannot add HTML, and only `http` and `https` links are linked. In the log they
cannot be read as CI commands (GitHub's `::…::`, Azure DevOps' `##vso[…]`): an invisible character breaks
the command up, and the line reads the same.

## What stays the same in every view

`view` changes only the job summary and the end of the log. In every view, you get the same:

- verdict and exit code: the build passes only when the run's result is **SUCCESS**, and `fail-on: never`
  only reports,
- test tab: the JUnit report, with every test case and each failure in full, with its device and links,
- `--json` output,
- outputs: `run-id`, `report-url`, `result`, `passed`, `total-count`, `passed-count` and `failed-count` in
  the GitHub Action, and `runId`, `reportUrl` and so on in the Azure DevOps task,
- GitHub annotations and Azure DevOps errors, one for each failing test case (the first 10),
- progress lines while the run is going.

With `wait: false` (`--no-wait`, `CONTEXTQA_WAIT=false`) there is no result to show yet, so the view makes
no difference.

## FAQ

**Which view should I use with several plans in one workflow?**
`compact`. Each plan then adds its heading and a line or two to the run page, with a link to its report,
instead of a table each. Your CI's test tab still lists every test case of every plan.

**Why is there no Device column?**
ContextQA did not say where the run's test cases ran. That happens when the token is a legacy CI token or
lacks `TEST_CASE_RESULTS_READ` (the run then reports counts only), or when ContextQA recorded no device
for the run. There is nothing to switch on.

**Why do I see only the counts, whatever the view?**
Per-test results need an API token (`token_…`) with the `TEST_CASE_RESULTS_READ` permission. With a
legacy CI token, or without that permission, every view shows the counts and the report link; the log
says why, and the job summary of a failed run notes it.

**What happens if I set a value that is not a view?**
It is a configuration error, so no run starts. The GitHub Action, the Azure DevOps task, the Jenkins step,
the Bitbucket pipe and the CLI stop with `view must be one of compact, standard, detailed, full` (the CLI
exits with `2`, which fails the step). GitLab and CircleCI reject the pipeline configuration before the job
starts.

**Do views change what my test tab shows?**
No. The test tab comes from the JUnit report, which is the same in every view: every test case, and each
failure with its full error, its device, and links to its result and its trace.

**Can the job summary and the log use different views?**
No. One `view` sets both.

**Why does a test case link ask me to sign in?**
It opens ContextQA, like the report link. Once you are signed in, it opens the test case's result.

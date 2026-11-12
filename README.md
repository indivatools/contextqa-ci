# ContextQA for CI/CD

Run your [ContextQA](https://contextqa.com) test plans from any CI/CD pipeline. Every push or pull request
triggers the plan, waits for the result, publishes it to your CI's test report, and fails the build unless
the run passed.

| Your CI | Integration | Guide |
|---|---|---|
| GitHub Actions | `uses: indivatools/contextqa-ci@v1` | [below](#github-actions) |
| GitLab CI/CD | CI/CD Catalog component | [providers/gitlab](providers/gitlab) |
| Jenkins | shared library step `contextqaRunPlan` | [providers/jenkins](providers/jenkins) |
| Azure Pipelines | `ContextQARunTestPlan@1` task | [providers/azure-devops](providers/azure-devops) |
| CircleCI | `contextqa/run-test-plan` orb | [providers/circleci](providers/circleci) |
| Bitbucket Pipelines | pipe | [providers/bitbucket](providers/bitbucket) |
| Anything else | `contextqa` CLI or container image | [below](#any-other-ci) |

All of them run the same engine, so behaviour, options and exit codes are identical everywhere.

## Before you start

You need two things from ContextQA:

1. **The test plan ID.** Open the plan in ContextQA; the ID is the number in the URL
   (`…/plans/827/…` → `827`). The plan's **CI/CD** tab also generates a ready-made snippet for your provider.
2. **An API token.** Create one under **Settings › API tokens** (or from the plan's **CI/CD** tab) with these
   permissions:

   | Permission | Needed for |
   |---|---|
   | `TEST_PLAN_EXECUTE` | starting the run, and uploading a mobile build (required) |
   | `TEST_PLAN_RESULTS_READ` | waiting for the result (required) |
   | `TEST_CASE_RESULTS_READ` | per-test results in your CI's test report, the job summary and the log (recommended) |
   | `TEST_STEP_RESULTS_READ` | failed-step screenshots, and failure details for runs from older ContextQA versions (optional) |

   Store it as a secret in your CI, named `CONTEXTQA_TOKEN`. Never commit it to the repository.

## GitHub Actions

```yaml
name: ContextQA

on:
  pull_request:
  push:
    branches: [main]

jobs:
  contextqa:
    runs-on: ubuntu-latest
    steps:
      - uses: indivatools/contextqa-ci@v1
        with:
          plan-id: 827
          token: ${{ secrets.CONTEXTQA_TOKEN }}
```

Add `CONTEXTQA_TOKEN` under **Settings › Secrets and variables › Actions**. On every run you get:

- the job failing unless the test plan passed,
- a summary on the run page with counts, the run's **Duration** (start to end, as ContextQA's *Total Plan
  Duration*) and its **Test execution time** (the tests' own time added up, as ContextQA's *Actual TC
  Execution Time*), the devices the run used when ContextQA reports them, a link to the full ContextQA
  report, and each failing test case with its error and failed step, linked to its result in ContextQA
  and to its trace,
- the failing test cases, with their errors and links, at the end of the step log,
- an annotation for each failing test case (the first 10), naming its device when known,
- outputs for later steps: `run-id`, `report-url`, `result`, `passed`, `total-count`, `passed-count`,
  `failed-count`.

The `view` input sets how much the summary and the log show; see
[Summary and log views](#summary-and-log-views).

<details>
<summary>All inputs</summary>

| Input | Default | Description |
|---|---|---|
| `plan-id` | required | Test plan to run. |
| `token` | required | API token, from a secret. |
| `environment` | the plan's own | Run against this ContextQA environment instead. |
| `android-build` | | Android build to test: a path in the workspace (uploaded) or an `https://` URL. |
| `ios-build` | | iOS build to test: a path in the workspace (uploaded) or an `https://` URL. |
| `timeout` | `3600` | Seconds to wait for the run before failing. |
| `poll-interval` | `15` | Seconds between status checks. |
| `wait` | `true` | `false` starts the run and moves on without waiting. |
| `fail-on` | `failure` | `never` reports the result without failing the job. |
| `view` | `standard` | How much the job summary and the log show: `compact`, `standard`, `detailed` or `full`. See [Summary and log views](#summary-and-log-views). |
| `junit-path` | | Also write JUnit XML to this path, with failed-step screenshots in a `contextqa-screenshots` folder beside it. |
| `api-url` | `https://server.contextqa.com` | Change only for a dedicated or on-premises ContextQA. |

</details>

<details>
<summary>Keeping the JUnit report and its screenshots</summary>

```yaml
      - uses: indivatools/contextqa-ci@v1
        with:
          plan-id: 827
          token: ${{ secrets.CONTEXTQA_TOKEN }}
          junit-path: reports/contextqa.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: contextqa-report
          path: reports/
```

The report lists each test case under its current name in ContextQA, with its own duration; the run's and
the suite's `time` is the run's wall-clock. A failing test carries the step that failed, its error, the
expected result and the failure type, the device it ran on, and links to its result in ContextQA, to its
trace and to the full ContextQA report. The failed step's screenshot
is saved to `reports/contextqa-screenshots/` and referenced from the report as `[[ATTACHMENT|…]]` (shown by
Jenkins and GitLab); some screenshots need `TEST_STEP_RESULTS_READ`. Upload the folder that holds both, as
above, to keep them.

</details>

<details>
<summary>Testing a mobile build produced earlier in the workflow</summary>

```yaml
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew assembleRelease
      - uses: indivatools/contextqa-ci@v1
        with:
          plan-id: 827
          token: ${{ secrets.CONTEXTQA_TOKEN }}
          android-build: app/build/outputs/apk/release/app-release.apk
```

The build is uploaded straight to your ContextQA workspace; no cloud storage credentials are needed in the
pipeline.

</details>

## Any other CI

Anything that can run Node.js 20.6+ or a container works:

```sh
# Node.js
CONTEXTQA_TOKEN=… npx contextqa@1 run-plan --plan-id 827 --junit reports/contextqa.xml

# Container
docker run --rm -e CONTEXTQA_TOKEN -v "$PWD:/work" -w /work \
  ghcr.io/indivatools/contextqa-cli:1 run-plan --plan-id 827 --junit reports/contextqa.xml
```

Every option is available as a flag or a `CONTEXTQA_*` environment variable (`contextqa --help` lists them),
such as `--view` / `CONTEXTQA_VIEW` for how much the end of the log shows
([Summary and log views](#summary-and-log-views)). The token is read from `CONTEXTQA_TOKEN` only, never
from a flag, so it does not appear in process listings or logs.

## Summary and log views

`view` sets how much the job summary and the end of the log show. The job summary is on the GitHub run page
and the Azure DevOps **Extensions** tab; GitLab, Jenkins, CircleCI and Bitbucket have none, so there `view`
sets the log only. The JUnit report, `--json` output, outputs, annotations, exit code and verdict are the
same in every view.

| View | Job summary | End of the log |
|---|---|---|
| `compact` | One line with the verdict, counts, run time, devices and report link, then the names of up to 10 failing test cases | `Run 4512 finished: FAILURE (2 passed, 2 failed of 5)` and the report link |
| `standard` (default) | Counts, **Duration** and **Test execution time**, how each device did, the report link, and each failing test case (up to 50) with its error and failed step | Adds how each device did, and each failing test case (up to 50) with its error and a link to its result |
| `detailed` | Adds a table of suites, spells out each failure (failed step, error, expected result, failure type, exception, trace) and folds the other test cases into a collapsible list | Adds the run times, each suite's passed count, and each failure's step details with links to its result and trace |
| `full` | Like `detailed`, but lists every test case by suite, with its result and time (up to 1,000) | Like `detailed`, but lists every test case by suite, with its result, time and link (up to 1,000) |

Set `view: detailed` in the GitHub Action, the GitLab component, the CircleCI orb and the Azure DevOps task,
`view: 'detailed'` in the Jenkins step, `CONTEXTQA_VIEW: detailed` in the Bitbucket pipe, or
`--view detailed` (or `CONTEXTQA_VIEW=detailed`) for the CLI and the container image. Any other value is a
configuration error, so the run does not start.

Test cases link to their result in ContextQA and, when ContextQA reports it, say where they ran
(`Web - Chrome`, `Android - Pixel 9`); neither needs any setup or a new token permission. An error longer
than 1,000 characters is cut with `…` (the JUnit report keeps it whole), and a job summary that would pass
GitHub's 1 MiB limit stops early with a note, instead of GitHub dropping it.

The [guide to summary and log views](docs/report-views.md) shows each view on an example run, with a
snippet for every CI, where the links and device details appear, and the limits.

## Results and exit codes

The build passes only when the test plan's result is **SUCCESS**. A run that is aborted or stopped is not a
pass, even if no test case failed.

| Exit code | Meaning | What to do |
|---|---|---|
| `0` | The run passed. | |
| `1` | The run finished but did not pass. | Open the report link printed in the log. |
| `2` | Configuration or token problem. | Check the plan ID, the token and its permissions. Retrying will not help. |
| `3` | ContextQA could not be reached, or the run did not finish within the timeout. | The log links the run, which keeps going in ContextQA. Retry, or raise the timeout. |

Results are also written as JUnit XML, so GitLab, Jenkins, Azure Pipelines, CircleCI and Bitbucket show each
test case in their own test report.

## Troubleshooting

| Message | Cause |
|---|---|
| `ContextQA token is missing` | The `CONTEXTQA_TOKEN` secret is not set, or not passed to the step. |
| `refused the token (HTTP 401)` | The token is wrong, expired or revoked. Create a new one. |
| `refused the token (HTTP 403)` | The token lacks a permission listed in [Before you start](#before-you-start), or the runner's IP is outside the token's allowlist. |
| `not found (HTTP 404)` | The `api-url` is wrong, or the plan ID does not exist in the token's workspace. |
| `Per-test results skipped` | The token lacks `TEST_CASE_RESULTS_READ`. The verdict is unaffected; only per-test detail is missing. |
| `Per-test results need a ContextQA API token` | The token is a legacy CI token, which reports counts only. Create an API token for per-test detail. |
| `Per-test results unavailable` | ContextQA did not return the per-test results. The verdict is unaffected; only per-test detail is missing. |
| `Step results skipped` / `Failed-step screenshots skipped` | The token lacks `TEST_STEP_RESULTS_READ`. Failure details still come from the run's results; only some screenshots, and details of runs from older ContextQA versions, are missing. |
| `Step results unavailable` | ContextQA did not answer the step-results request. The verdict and the rest of the report are unaffected; after three failed requests the report stops asking. |
| `Screenshot for test case result … not saved` | The screenshot could not be fetched in time, or was larger than 10 MB. The failed step is still reported; the screenshot is in the ContextQA report. |
| `did not finish within 3600s` | The plan takes longer than the timeout. Raise `timeout`, and your CI's own job timeout above it. |
| `view must be one of compact, standard, detailed, full` | `view` (`--view`, `CONTEXTQA_VIEW`) has another value. Use one of these four, in lower case. |

## Security

- The token is masked in logs on every supported CI and is only ever sent to your ContextQA API.
- Mobile builds are uploaded through a short-lived signed URL scoped to your workspace; the URL is never logged.
- Test names, errors and links from ContextQA are shown as text: they cannot be read as CI commands in the
  log or add HTML to the job summary.
- The GitHub Action and the container image are built from this repository and published by its release
  workflow. Pin a full version (`@v1.2.3`, `:1.2.3`) if your policy requires immutable references.

## Versioning

`@v1`, `:1` and `@1` always point to the latest 1.x release. Changes that would break an existing pipeline
(removed inputs, changed exit codes) only ship in a new major version. What changed in each release is in
[CHANGELOG.md](CHANGELOG.md) and on the [releases page](https://github.com/indivatools/contextqa-ci/releases).

## Support

Documentation lives at [learning.contextqa.com](https://learning.contextqa.com). For help, contact your
ContextQA team or open an issue in this repository.

Contributing and release process: [CONTRIBUTING.md](CONTRIBUTING.md).

# ContextQA for Azure Pipelines

A pipeline task that runs a ContextQA test plan, publishes the results to the run's **Tests** tab, adds a
summary to the **Extensions** tab, and fails unless the run passed.

```yaml
steps:
  - task: ContextQARunTestPlan@1
    inputs:
      planId: '827'
      token: $(CONTEXTQA_TOKEN)
      androidBuild: $(Build.ArtifactStagingDirectory)/app-release.apk   # optional
      view: 'detailed'   # optional: compact, standard (default), detailed or full
```

## Setup

1. Install the **ContextQA Test Plan** extension from the Visual Studio Marketplace into your organization.
2. Add `CONTEXTQA_TOKEN` as a **secret** pipeline variable (or in a variable group). Use an API token with
   `TEST_PLAN_EXECUTE` (which also covers build uploads) and `TEST_PLAN_RESULTS_READ`, plus `TEST_CASE_RESULTS_READ` for per-test results and failure details (optionally `TEST_STEP_RESULTS_READ` for older runs' failure details). Azure does not expose secret variables to tasks on its
   own; the `token` input (or an `env:` mapping) is what passes it in.

## Inputs

| Input | Default | |
|---|---|---|
| `planId` | | required |
| `token` | `$(CONTEXTQA_TOKEN)` | |
| `androidBuild` / `iosBuild` | | path to upload, or an https URL; paths are relative to the sources directory |
| `environment` | the plan's own | |
| `failOn` | `failure` | `never` reports without failing |
| `view` | `standard` | how much the **Extensions** tab summary and the end of the log show: `compact`, `standard`, `detailed` or `full` ([samples](https://github.com/indivatools/contextqa-ci/blob/main/docs/report-views.md)); the **Tests** tab is the same in every view |
| `apiUrl` | `https://server.contextqa.com` | |
| `timeout` | `3600` | seconds |
| `wait` | `true` | |
| `publishTestResults` | `true` | |
| `junitPath` | agent temp directory | |

By default the **Extensions** tab summary and the end of the log name each failing test case with its
error and device, linked to its result in ContextQA; `view` shows less or more. Each failing test case
(the first 10) is also an error on the run.

Output variables: `runId`, `reportUrl`, `result`, `passed`, `totalCount`, `passedCount`, `failedCount`.
Give the step a `name:` to read them in later steps, e.g. `$(contextqa.result)`.

# ContextQA for CircleCI

An orb that runs a ContextQA test plan and fails the job unless it passes. Results are stored as JUnit, so
failing test cases show on the job's **Tests** tab.

```yaml
version: 2.1
orbs:
  contextqa: contextqa/run-test-plan@1
workflows:
  test:
    jobs:
      - contextqa/run:
          plan-id: '827'
          context: contextqa             # holds CONTEXTQA_TOKEN
          view: detailed                 # optional: compact, standard (default), detailed or full
```

1. Put `CONTEXTQA_TOKEN` in a [context](https://circleci.com/docs/contexts/) (or a project environment
   variable). Use an API token with `TEST_PLAN_EXECUTE` (which also covers build uploads) and `TEST_PLAN_RESULTS_READ`, plus `TEST_CASE_RESULTS_READ` for per-test results and failure details (optionally `TEST_STEP_RESULTS_READ` for older runs' failure details).
2. Allow third-party orbs in **Organization Settings › Security** if your organization restricts them.

To test a build from an earlier job, persist it to the workspace and pass `workspace-root` and
`android-build` / `ios-build`; see the `upload-a-build` example in [`orb.yml`](orb.yml).

The `contextqa/run-plan` command works inside your own jobs too, on any executor with Node.

`view` sets how much the end of the job's log shows: the verdict and the report link (`compact`), each
failing test case with its error, device and a link to its result in ContextQA (`standard`, the default),
each failure in full with a breakdown by suite (`detailed`), or every test case (`full`). The **Tests**
tab is the same in every view. [Summary and log views](../../docs/report-views.md) has a sample of each.

## How it runs

The `run` job uses `cimg/node` and starts the CLI with `npx contextqa@1`. The test step records the
CLI's exit code instead of failing, so `store_test_results` always runs; a final step then fails the job
with that code.

# ContextQA for Bitbucket Pipelines

Bitbucket runs any public image as a pipe, so the ContextQA CLI image is the pipe. Options are passed as
pipe variables, which the CLI reads as `CONTEXTQA_*` environment variables.

```yaml
pipelines:
  branches:
    main:
      - step:
          name: ContextQA
          script:
            - pipe: docker://ghcr.io/indivatools/contextqa-cli:1
              variables:
                CONTEXTQA_TOKEN: $CONTEXTQA_TOKEN
                CONTEXTQA_PLAN_ID: '827'
                CONTEXTQA_ANDROID_BUILD: build/app-release.apk   # optional
                CONTEXTQA_JUNIT_PATH: test-results/contextqa.xml
                CONTEXTQA_VIEW: detailed   # optional: compact, standard (default), detailed or full
```

1. Add `CONTEXTQA_TOKEN` as a **secured** repository or deployment variable. Use an API token with
   `TEST_PLAN_EXECUTE` (which also covers build uploads) and `TEST_PLAN_RESULTS_READ`, plus `TEST_CASE_RESULTS_READ` for per-test results and failure details (optionally `TEST_STEP_RESULTS_READ` for older runs' failure details).
2. Keep `CONTEXTQA_JUNIT_PATH` under `test-results/`. Bitbucket reads JUnit from there automatically and
   shows failures on the step's **Tests** tab.

The step fails unless the run passes. Set `CONTEXTQA_FAIL_ON: never` to only report.

| Variable | Required | Default |
|---|---|---|
| `CONTEXTQA_TOKEN` | yes | |
| `CONTEXTQA_PLAN_ID` | yes | |
| `CONTEXTQA_API_URL` | | `https://server.contextqa.com` |
| `CONTEXTQA_ENVIRONMENT` | | the plan's own |
| `CONTEXTQA_ANDROID_BUILD` / `CONTEXTQA_IOS_BUILD` | | path to upload, or an https URL |
| `CONTEXTQA_TIMEOUT` | | `3600` seconds |
| `CONTEXTQA_JUNIT_PATH` | | none |
| `CONTEXTQA_FAIL_ON` | | `failure` |
| `CONTEXTQA_VIEW` | | `standard` (or `compact`, `detailed`, `full`) |

Bitbucket's step limit is 120 minutes by default; raise `max-time` on the step if `CONTEXTQA_TIMEOUT` is
longer.

`CONTEXTQA_VIEW` sets how much the end of the step log shows: the verdict and the report link
(`compact`), each failing test case with its error, device and a link to its result in ContextQA
(`standard`, the default), each failure in full with a breakdown by suite (`detailed`), or every test case
(`full`). The **Tests** tab is the same in every view.
[Summary and log views](../../docs/report-views.md) has a sample of each.

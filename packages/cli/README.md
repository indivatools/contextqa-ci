# contextqa

Run a [ContextQA](https://contextqa.com) test plan from any CI pipeline. The `contextqa` command starts
the plan, waits for the result, writes it as JUnit XML for your CI's test report, and fails the build
unless the run passed.

```sh
CONTEXTQA_TOKEN=… npx contextqa@1 run-plan --plan-id 827 --junit reports/contextqa.xml
```

Needs Node.js 20.6 or later. No install step: `npx contextqa@1` always runs the latest 1.x release.
Prefer a container? Use `ghcr.io/indivatools/contextqa-cli:1` with the same options.

Using GitHub Actions, GitLab, Jenkins, Azure Pipelines, CircleCI or Bitbucket? There is a ready-made
integration for each, built on this command:
[ContextQA for CI/CD](https://github.com/indivatools/contextqa-ci#readme).

## Before you start

1. **The test plan ID.** Open the plan in ContextQA; the ID is the number in the URL (`…/plans/827/…` →
   `827`). The plan's **CI/CD** tab also generates a ready-made snippet.
2. **An API token**, from **Settings › API tokens**, with these permissions:

   | Permission | Needed for |
   |---|---|
   | `TEST_PLAN_EXECUTE` | starting the run, and uploading a mobile build (required) |
   | `TEST_PLAN_RESULTS_READ` | waiting for the result (required) |
   | `TEST_CASE_RESULTS_READ` | per-test results, device details and result links (recommended) |
   | `TEST_STEP_RESULTS_READ` | failed-step screenshots (optional) |

   Store it as a secret in your CI and pass it as the `CONTEXTQA_TOKEN` environment variable. The token is
   read from the environment only, never from a flag, so it does not appear in process listings or logs.

## Examples

```sh
# Run a plan and write a JUnit report for your CI's test tab
npx contextqa@1 run-plan --plan-id 827 --junit reports/contextqa.xml

# Test a mobile build produced earlier in the pipeline (the file is uploaded to your workspace)
npx contextqa@1 run-plan --plan-id 827 --android-build app/build/outputs/apk/release/app-release.apk

# Run against another ContextQA environment, and spell out each failure at the end of the log
npx contextqa@1 run-plan --plan-id 827 --environment Staging --view detailed

# Report the result without failing the build
npx contextqa@1 run-plan --plan-id 827 --fail-on never
```

## Options

Every option can also be set with the environment variable shown.

| Option | Environment variable | Default | Description |
|---|---|---|---|
| `--plan-id <id>` | `CONTEXTQA_PLAN_ID` | required | Test plan to run. |
| `--environment <name>` | `CONTEXTQA_ENVIRONMENT` | the plan's own | Run against this ContextQA environment instead. |
| `--android-build <path\|url>` | `CONTEXTQA_ANDROID_BUILD` | | Android build to test: a local file is uploaded, an `https://` URL is passed through. |
| `--ios-build <path\|url>` | `CONTEXTQA_IOS_BUILD` | | The same, for iOS. |
| `--junit <path>` | `CONTEXTQA_JUNIT_PATH` | | Write JUnit XML here, with failed-step screenshots in a `contextqa-screenshots` folder beside it. |
| `--json <path>` | `CONTEXTQA_JSON_PATH` | | Write a JSON summary here. |
| `--view <view>` | `CONTEXTQA_VIEW` | `standard` | How much the end of the log shows: `compact`, `standard`, `detailed` or `full`. See [Summary and log views](https://github.com/indivatools/contextqa-ci/blob/main/docs/report-views.md). |
| `--timeout <seconds>` | `CONTEXTQA_TIMEOUT` | `3600` | How long to wait for the run. |
| `--poll-interval <seconds>` | `CONTEXTQA_POLL_INTERVAL` | `15` | Seconds between status checks. |
| `--fail-on <failure\|never>` | `CONTEXTQA_FAIL_ON` | `failure` | `never` reports the result without failing. |
| `--no-wait` | `CONTEXTQA_WAIT=false` | | Start the run and exit without waiting. |
| `--api-url <url>` | `CONTEXTQA_API_URL` | `https://server.contextqa.com` | Change only for a dedicated or on-premises ContextQA. |

`contextqa --help` prints the same list.

## Exit codes

The build passes only when the test plan's result is **SUCCESS**. A run that is aborted or stopped is not
a pass, even if no test case failed.

| Exit code | Meaning | What to do |
|---|---|---|
| `0` | The run passed. | |
| `1` | The run finished but did not pass. | Open the report link printed in the log. |
| `2` | Configuration or token problem. | Check the plan ID, the token and its permissions. Retrying will not help. |
| `3` | ContextQA could not be reached, or the run did not finish within the timeout. | The log links the run, which keeps going in ContextQA. Retry, or raise the timeout. |

## More

- [Troubleshooting](https://github.com/indivatools/contextqa-ci#troubleshooting) for each message the
  command can print.
- [What changed in each release](https://github.com/indivatools/contextqa-ci/blob/main/CHANGELOG.md).
  `contextqa@1` always points to the latest 1.x release; pin a full version (`contextqa@1.2.0`) if your
  policy requires immutable references.
- Documentation: [learning.contextqa.com](https://learning.contextqa.com). For help, contact your ContextQA
  team or [open an issue](https://github.com/indivatools/contextqa-ci/issues).

## License

MIT

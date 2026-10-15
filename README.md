# contextqa-ci

Run a [ContextQA](https://contextqa.com) test plan from your CI pipeline and fail the build unless it passes.

> Status: pre-release. Every wrapper is in place: the CLI, the GitHub Action, the container image, the
> [GitLab component](providers/gitlab), the [Bitbucket pipe](providers/bitbucket), the
> [CircleCI orb](providers/circleci), the [Jenkins library](providers/jenkins) and the
> [Azure DevOps task](providers/azure-devops). None is published yet.

## GitHub Actions

```yaml
- uses: indivatools/contextqa-ci@v1
  with:
    plan-id: 827
    token: ${{ secrets.CONTEXTQA_TOKEN }}
    android-build: app/build/outputs/apk/release/app-release.apk   # optional
```

The job fails unless the run passes. It writes a summary table to the run page, annotates each failing
test case, and exposes `run-id`, `report-url`, `result`, `passed`, `total-count`, `passed-count` and
`failed-count` as outputs. All inputs are documented in [`action.yml`](action.yml).

## CLI

```sh
export CONTEXTQA_TOKEN=token_…        # Settings → API tokens, or the plan's CI/CD tab
npx @contextqa/cli run-plan --plan-id 827 --junit reports/contextqa.xml
```

It uploads any local mobile build, triggers the plan, waits for the verdict, writes JUnit, and exits:

| Exit | Meaning |
|---|---|
| 0 | the run passed |
| 1 | the run finished but did not pass (failed, aborted or stopped) |
| 2 | configuration or credential problem — retrying will not help |
| 3 | server/network failure, or the run did not finish within `--timeout` |

Every option also reads a `CONTEXTQA_*` environment variable; run `contextqa --help` for the list.
The token is read from `CONTEXTQA_TOKEN` only, never from a flag, so it stays out of process listings.

### Tokens

- **API token** (`token_…`, recommended): scoped, expiring, revocable. Give it `TEST_PLAN_EXECUTE`,
  `TEST_PLAN_RESULTS_READ`, plus `TEST_PLAN_BUILD_UPLOAD` to upload builds and `TEST_CASE_RESULTS_READ`
  for per-test JUnit results.
- **CI token** (legacy): still accepted. Reports run counts only, so JUnit has a single case for the run.

### Mobile builds

`--android-build` / `--ios-build` take either a local path (uploaded through a presigned URL — no cloud
credentials needed in CI) or an `https://` URL the server can fetch.

## Development

```sh
npm install
npm run check      # build + typecheck + tests
```

`packages/core` holds the API client and run logic, `packages/cli` is the `contextqa` command, and
`packages/github-action` is bundled into `dist/index.js` by `npm run bundle`. Commit `dist/` with any
source change; CI fails when it is stale.
API contract: `docs/api/test-plan-ci-execution.md` in ts-portal-server.

# contextqa-ci

Run a [ContextQA](https://contextqa.com) test plan from your CI pipeline and fail the build unless it passes.

> Status: pre-release. The CLI below works today; the GitHub Action, GitLab component, CircleCI orb,
> Azure DevOps task, Bitbucket pipe and Jenkins library are thin wrappers over it and land next.

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

`packages/core` holds the API client and run logic; `packages/cli` is the `contextqa` command.
API contract: `docs/api/test-plan-ci-execution.md` in ts-portal-server.

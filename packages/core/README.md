# @contextqa-inc/ci-core

The engine behind the [`contextqa`](https://www.npmjs.com/package/contextqa) command and the ContextQA CI
integrations: it starts a [ContextQA](https://contextqa.com) test plan, waits for the result, and turns it
into a JUnit report, a job summary and log lines.

**To run ContextQA tests from CI, you don't need this package.** Use the `contextqa` command
(`npx contextqa@1 run-plan --plan-id <id>`) or the integration for your CI, described in
[ContextQA for CI/CD](https://github.com/indivatools/contextqa-ci#readme). They all run this engine, so
behaviour, options and exit codes are the same everywhere.

This package is published so that those integrations can depend on it. Its programming interface follows
the needs of those integrations and may change between minor releases; build on the `contextqa` command
instead, whose options and exit codes are stable within a major version.

What changed in each release is in the
[changelog](https://github.com/indivatools/contextqa-ci/blob/main/CHANGELOG.md).

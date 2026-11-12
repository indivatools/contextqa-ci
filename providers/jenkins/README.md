# ContextQA for Jenkins

A [shared library](https://www.jenkins.io/doc/book/pipeline/shared-libraries/) step, `contextqaRunPlan`, that
runs a ContextQA test plan, publishes its JUnit results, and fails the build unless the run passed.

```groovy
@Library('contextqa@v1') _

pipeline {
  agent any
  stages {
    stage('ContextQA') {
      steps {
        contextqaRunPlan planId: '827',
                         credentialsId: 'contextqa-token',
                         androidBuild: 'app/build/outputs/apk/release/app-release.apk',  // optional
                         view: 'detailed'  // optional: compact, standard (default), detailed or full
      }
    }
  }
}
```

## Setup

1. **Add the library once:** *Manage Jenkins › System › Global Trusted Pipeline Libraries*, name
   `contextqa`, default version `v1`, retrieval *Modern SCM › Git*, repository
   `https://github.com/indivatools/contextqa-ci.git`, **Library Path** `providers/jenkins/`.
2. **Add the token** as a *Secret text* credential (ID `contextqa-token` above). Use an API token with
   `TEST_PLAN_EXECUTE` (which also covers build uploads) and `TEST_PLAN_RESULTS_READ`, plus `TEST_CASE_RESULTS_READ` for per-test results and failure details (optionally `TEST_STEP_RESULTS_READ` for older runs' failure details).
3. **The agent needs Node or Docker.** The step runs `npx contextqa@1`, or the
   `ghcr.io/indivatools/contextqa-cli:1` image when there is no Node. Force one with `runner: 'npx'` or
   `runner: 'docker'`.

All options are listed in [`vars/contextqaRunPlan.txt`](vars/contextqaRunPlan.txt).

## Results

| CLI exit | Build |
|---|---|
| 0 | passes |
| 1 | fails: the plan did not pass (JUnit still published) |
| 2 | fails: configuration or token problem |
| 3 | fails: server, network or timeout |

`failOn: 'never'` reports without failing. With the Docker runner and an agent that is itself a container,
the workspace path must exist on the Docker host, since the step mounts `$PWD` at the same path.

`view` sets how much the end of the console output shows: the verdict and the report link (`'compact'`),
each failing test case with its error, device and a link to its result in ContextQA (`'standard'`, the
default), each failure in full with a breakdown by suite (`'detailed'`), or every test case (`'full'`).
The published test results are the same in every view.
[Summary and log views](../../docs/report-views.md) has a sample of each.

## Without the library

```groovy
withCredentials([string(credentialsId: 'contextqa-token', variable: 'CONTEXTQA_TOKEN')]) {
  sh 'npx --yes contextqa@1 run-plan --plan-id 827 --junit contextqa-junit.xml'
}
junit 'contextqa-junit.xml'
```

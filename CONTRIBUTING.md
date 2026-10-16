# Contributing

## Layout

| Path | What it is |
|---|---|
| `packages/core` | API client and run logic: upload, trigger, poll, gate, JUnit, summary |
| `packages/cli` | The `contextqa` command (`@contextqa/cli`) |
| `packages/github-action` | GitHub Action glue, bundled to `dist/index.js` |
| `packages/azure-devops-task` | Azure Pipelines task, bundled into `providers/azure-devops` at release |
| `docker/` | The `ghcr.io/indivatools/contextqa-cli` image |
| `providers/*` | GitLab component, CircleCI orb, Jenkins library, Bitbucket and Azure docs |
| `scripts/` | Bundlers, the version stamper and provider checks |

Every wrapper is a thin layer over `packages/core`; behaviour changes belong there.

## Working on it

```sh
npm install
npm run check      # build + typecheck + tests
npm run bundle     # rebuild dist/index.js — commit it with any source change
```

CI fails when `dist/` is stale, and also validates the container image, the GitLab component, the CircleCI
orb, the Jenkins step and the Azure extension package.

The server contract these integrations call is `docs/api/test-plan-ci-execution.md` in ts-portal-server.

## Releasing

See [docs/RELEASING.md](docs/RELEASING.md).

# Image behind the GitLab component, Bitbucket pipe, CircleCI orb and Jenkins
# library. Build from the repo root: docker build -f docker/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/github-action/package.json packages/github-action/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY scripts ./scripts
COPY packages ./packages
RUN node scripts/bundle-cli.mjs

FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/indivatools/contextqa-ci" \
      org.opencontainers.image.description="Run a ContextQA test plan from CI and gate on the result" \
      org.opencontainers.image.licenses="NOASSERTION"
COPY --from=build /src/build/contextqa.mjs /opt/contextqa/contextqa.mjs
RUN printf '#!/bin/sh\nexec node /opt/contextqa/contextqa.mjs "$@"\n' > /usr/local/bin/contextqa \
 && chmod 755 /usr/local/bin/contextqa
# Runs as root on purpose: GitLab, Bitbucket and GitHub container jobs mount
# the workspace as root, and the JUnit file must be writable there. The image
# holds no secrets; the token arrives per run as an environment variable.
# nosemgrep: dockerfile.security.missing-user-entrypoint.missing-user-entrypoint
ENTRYPOINT ["contextqa"]
# With no arguments the container reads every option from CONTEXTQA_* variables,
# which is how a Bitbucket pipe passes them.
# nosemgrep: dockerfile.security.missing-user.missing-user
CMD ["run-plan"]

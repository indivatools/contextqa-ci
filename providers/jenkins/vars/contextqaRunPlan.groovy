/**
 * Runs a ContextQA test plan, publishes its JUnit results, and fails the build
 * unless the run passed.
 *
 *   contextqaRunPlan planId: '827', credentialsId: 'contextqa-token'
 *
 * The token comes from `credentialsId` (a Secret text credential) or from a
 * CONTEXTQA_TOKEN variable already in the environment. It is never put on a
 * command line. See contextqaRunPlan.txt for every option.
 */
def call(Map args = [:]) {
    String planId = args.planId?.toString()?.trim()
    if (!planId) {
        error 'contextqaRunPlan: planId is required'
    }
    String junitPath = (args.junitPath ?: 'contextqa-junit.xml').toString()

    List<String> vars = [
        "CONTEXTQA_PLAN_ID=${planId}",
        "CONTEXTQA_API_URL=${args.apiUrl ?: 'https://server.contextqa.com'}",
        "CONTEXTQA_ENVIRONMENT=${args.environment ?: ''}",
        "CONTEXTQA_ANDROID_BUILD=${args.androidBuild ?: ''}",
        "CONTEXTQA_IOS_BUILD=${args.iosBuild ?: ''}",
        "CONTEXTQA_TIMEOUT=${args.timeout ?: 3600}",
        "CONTEXTQA_FAIL_ON=${args.failOn ?: 'failure'}",
        "CONTEXTQA_JUNIT_PATH=${junitPath}",
        "CONTEXTQA_CLI_VERSION=${args.cliVersion ?: '1'}",
        "CONTEXTQA_RUNNER=${args.runner ?: 'auto'}",
    ]

    int code = 0
    withEnv(vars) {
        if (args.credentialsId) {
            withCredentials([string(credentialsId: args.credentialsId.toString(), variable: 'CONTEXTQA_TOKEN')]) {
                code = runCli(planId)
            }
        } else {
            code = runCli(planId)
        }
    }

    if (args.publishJunit != false && fileExists(junitPath)) {
        junit testResults: junitPath, allowEmptyResults: true
    }
    switch (code) {
        case 0:
            return
        case 1:
            error "ContextQA test plan ${planId} did not pass"
            break
        case 2:
            error "ContextQA test plan ${planId}: configuration or token problem (exit 2), see the log above"
            break
        default:
            error "ContextQA test plan ${planId}: server, network or timeout failure (exit ${code}), see the log above"
    }
}

/** Runs the CLI through npx or the container image, whichever the agent has. */
private int runCli(String planId) {
    // Single-quoted on purpose: every value reaches the shell as an environment
    // variable, so Groovy never interpolates the token or user input into it.
    return sh(returnStatus: true, label: "ContextQA test plan ${planId}", script: '''
        set -u
        run_npx() {
            npx --yes "@contextqa/cli@${CONTEXTQA_CLI_VERSION}" run-plan
        }
        run_docker() {
            # Runs as the agent's user so the JUnit file stays removable by workspace cleanup.
            docker run --rm --user "$(id -u):$(id -g)" \
                -e CONTEXTQA_TOKEN -e CONTEXTQA_PLAN_ID -e CONTEXTQA_API_URL -e CONTEXTQA_ENVIRONMENT \
                -e CONTEXTQA_ANDROID_BUILD -e CONTEXTQA_IOS_BUILD -e CONTEXTQA_TIMEOUT \
                -e CONTEXTQA_FAIL_ON -e CONTEXTQA_JUNIT_PATH \
                -v "$PWD:$PWD" -w "$PWD" \
                "ghcr.io/indivatools/contextqa-cli:${CONTEXTQA_CLI_VERSION}" run-plan
        }
        case "$CONTEXTQA_RUNNER" in
            npx) run_npx ;;
            docker) run_docker ;;
            *)
                if command -v npx >/dev/null 2>&1; then
                    run_npx
                elif command -v docker >/dev/null 2>&1; then
                    run_docker
                else
                    echo "ERROR: contextqaRunPlan needs Node (npx) or Docker on this agent" >&2
                    exit 2
                fi
                ;;
        esac
    ''')
}

// Exercises vars/contextqaRunPlan.groovy outside Jenkins: pipeline steps are
// stubbed, but the step's shell script runs for real, against a fake `npx`
// that records its arguments and environment and exits with a chosen code.
// Run: groovy providers/jenkins/test/run-plan-test.groovy  (from the repo root)

def libFile = new File('providers/jenkins/vars/contextqaRunPlan.groovy')
def work = File.createTempDir()
def bin = new File(work, 'bin'); bin.mkdirs()
def fakeNpx = new File(bin, 'npx')
fakeNpx.text = '''#!/bin/sh
{ echo "args=$*"; env | grep -E '^CONTEXTQA_' | sort; } > "$FAKE_LOG"
[ -n "${FAKE_JUNIT:-}" ] && echo '<testsuites/>' > "$CONTEXTQA_JUNIT_PATH"
exit "${FAKE_EXIT:-0}"
'''
fakeNpx.setExecutable(true)

class StepFailed extends RuntimeException { StepFailed(String m) { super(m) } }

Map run(File libFile, File work, File bin, Map args, Map fake) {
    def script = new GroovyShell().parse(libFile)
    def env = [PATH: "${bin}:/usr/bin:/bin".toString(), HOME: work.path, FAKE_LOG: new File(work, 'npx.log').path] + fake
    def calls = [junit: [], credentials: []]
    script.metaClass.withEnv = { List<String> vars, Closure body ->
        def saved = new HashMap(env)
        vars.each { def (k, v) = it.split('=', 2) as List; env[k] = v ?: '' }
        try { body() } finally { env.clear(); env.putAll(saved) }
    }
    script.metaClass.string = { Map m -> m }
    script.metaClass.withCredentials = { List bindings, Closure body ->
        calls.credentials << bindings[0].credentialsId
        env[bindings[0].variable] = 'token_from.credentials'
        body()
    }
    script.metaClass.sh = { Map m ->
        def pb = new ProcessBuilder('sh', '-c', m.script).directory(work).redirectErrorStream(true)
        pb.environment().clear(); pb.environment().putAll(env.collectEntries { k, v -> [k, v.toString()] })
        def p = pb.start(); p.inputStream.text; p.waitFor()
    }
    script.metaClass.fileExists = { String path -> new File(work, path).exists() }
    script.metaClass.junit = { Map m -> calls.junit << m.testResults }
    script.metaClass.error = { String msg -> throw new StepFailed(msg) }
    def failure = null
    try { script.call(args) } catch (StepFailed e) { failure = e.message }
    def log = new File(work, 'npx.log')
    def recorded = log.exists() ? log.text : ''
    log.delete(); new File(work, 'contextqa-junit.xml').delete()
    return [failure: failure, log: recorded, calls: calls]
}

int failures = 0
void check(String name, boolean ok, Object detail = '') {
    println "${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + detail}"
    if (!ok) failures++
}

def r = run(libFile, work, bin, [planId: '827', androidBuild: 'app/app.apk', credentialsId: 'contextqa-token'], [FAKE_EXIT: '0', FAKE_JUNIT: '1'])
check('passes on exit 0', r.failure == null, r.failure)
check('runs the CLI through npx at major 1', r.log.contains('args=--yes @contextqa/cli@1 run-plan'), r.log)
check('passes options as environment', r.log.contains('CONTEXTQA_PLAN_ID=827') && r.log.contains('CONTEXTQA_ANDROID_BUILD=app/app.apk'), r.log)
check('binds the token credential', r.calls.credentials == ['contextqa-token'], r.calls)
check('publishes JUnit when the file exists', r.calls.junit == ['contextqa-junit.xml'], r.calls)

r = run(libFile, work, bin, [planId: 827], [FAKE_EXIT: '1', FAKE_JUNIT: '1'])
check('fails the build when the plan fails', r.failure == 'ContextQA test plan 827 did not pass', r.failure)
check('still publishes JUnit when the plan fails', r.calls.junit == ['contextqa-junit.xml'], r.calls)

r = run(libFile, work, bin, [planId: '827'], [FAKE_EXIT: '2'])
check('reports a config error on exit 2', r.failure?.contains('configuration or token problem (exit 2)'), r.failure)
check('skips JUnit when no file was written', r.calls.junit == [], r.calls)

r = run(libFile, work, bin, [planId: '827'], [FAKE_EXIT: '3'])
check('reports an infra failure on exit 3', r.failure?.contains('server, network or timeout failure (exit 3)'), r.failure)

r = run(libFile, work, bin, [planId: '827', cliVersion: '1.2.0', timeout: 600], [FAKE_EXIT: '0'])
check('honours cliVersion and timeout', r.log.contains('@contextqa/cli@1.2.0') && r.log.contains('CONTEXTQA_TIMEOUT=600'), r.log)

r = run(libFile, work, bin, [:], [:])
check('requires planId', r.failure == 'contextqaRunPlan: planId is required', r.failure)

def noTools = File.createTempDir()
r = run(libFile, work, noTools, [planId: '827'], [:])
check('explains when the agent has neither npx nor docker', r.failure?.contains('exit 2'), r.failure)

println failures == 0 ? 'all passed' : "${failures} failed"
System.exit(failures == 0 ? 0 : 1)

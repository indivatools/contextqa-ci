"""Renders the GitLab component with its default inputs and checks the job it
produces. GitLab has no offline linter for components, and an unquoted empty
input renders as a null variable, which GitLab rejects at pipeline creation."""
import re
import sys

import yaml

TEMPLATE = 'providers/gitlab/templates/run-test-plan.yml'
INPUT_REF = re.compile(r'\$\[\[ inputs\.([\w-]+) \]\]')

raw = open(TEMPLATE, encoding='utf-8').read()
spec_doc, job_doc = raw.split('\n---\n', 1)
spec = yaml.safe_load(spec_doc)['spec']['inputs']

used = set(INPUT_REF.findall(job_doc))
if used - set(spec):
    sys.exit(f'undeclared inputs used: {sorted(used - set(spec))}')
if set(spec) - used:
    sys.exit(f'declared inputs never used: {sorted(set(spec) - used)}')

inputs = {name: str(field.get('default', '')) for name, field in spec.items()}
inputs['plan-id'] = '827'
jobs = yaml.safe_load(INPUT_REF.sub(lambda m: inputs[m.group(1)], job_doc))
job = jobs[inputs['job-name']]

bad = {k: v for k, v in job['variables'].items() if not isinstance(v, str)}
if bad:
    sys.exit(f'non-string variables (quote the interpolation): {bad}')
if job['image']['entrypoint'] != ['']:
    sys.exit('image entrypoint must be cleared so GitLab can run the script')
if job['artifacts']['reports']['junit'] != job['variables']['CONTEXTQA_JUNIT_PATH']:
    sys.exit('JUnit report path does not match CONTEXTQA_JUNIT_PATH')
print(f'{TEMPLATE}: ok ({len(spec)} inputs)')

import { command, inputVariable } from './logging.js';
import { runTask } from './main.js';

const write = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

// No top-level await: the bundle is CommonJS, the format every agent Node handler loads.
// runTask reports its own failures, so nothing is left to catch here.
void runTask({
  getInput: (name) => process.env[inputVariable(name)] ?? '',
  getEnv: (name) => process.env[name],
  info: write,
  warning: (message) => write(command('task.logissue', { type: 'warning' }, message)),
  error: (message) => write(command('task.logissue', { type: 'error' }, message)),
  setSecret: (value) => write(command('task.setsecret', {}, value)),
  setOutput: (name, value) => write(command('task.setvariable', { variable: name, isOutput: 'true' }, value)),
  publishJUnit: (path, title) =>
    write(command('results.publish', { type: 'JUnit', resultFiles: path, runTitle: title, mergeResults: 'false' })),
  uploadSummary: (path) => write(command('task.uploadsummary', {}, path)),
  fail: (message) => {
    write(command('task.logissue', { type: 'error' }, message));
    write(command('task.complete', { result: 'Failed' }, message));
    process.exitCode = 1;
  },
});

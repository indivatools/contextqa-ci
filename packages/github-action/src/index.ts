import * as core from '@actions/core';
import { runAction } from './main.js';

await runAction({
  getInput: (name) => core.getInput(name),
  setOutput: (name, value) => core.setOutput(name, value),
  setSecret: (value) => core.setSecret(value),
  info: (message) => core.info(message),
  warning: (message) => core.warning(message),
  error: (message, properties) => core.error(message, properties),
  setFailed: (message) => core.setFailed(message),
  writeSummary: async (markdown) => {
    await core.summary.addRaw(markdown).write();
  },
});

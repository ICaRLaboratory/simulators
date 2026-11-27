import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('the standalone PID page ships the authored comparison without runtime typesetting', () => {
  const generator = new URL('../scripts/build-pid-lti-comparison.mjs',import.meta.url);
  execFileSync(process.execPath,[fileURLToPath(generator),'--check']);
});

import { expect } from 'chai';
import { spawnSync } from 'child_process';
import { generateKeyPairSync } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * What a failing command actually prints.
 *
 * Everything else in the offline suite drives commands through `runCommand`, which hands back the
 * thrown error and never calls `Errors.handle`, so nothing had ever asserted on what reaches a
 * terminal. That gap hid a real regression for the whole oclif 5 migration: `ux.action.start()`
 * swaps `process.stdout.write` and `process.stderr.write` for buffering stubs that only `stop()`
 * puts back, `@oclif/core` 2 flushed that buffer from a `process.once('exit')` hook that core 5
 * removed, and `src/lib/base-class.ts` overrides oclif's own `catch`, which stops the action for
 * exactly this reason. The result was a cli that exited 1 and printed nothing at all unless
 * `--rawOutput` was passed, `-r` being the one mode that never starts a spinner.
 *
 * So these cases run the binary as a child process and read its real stdout, stderr and exit code.
 * Nothing else in the suite can see this class of defect: the exit code and the thrown object are
 * both correct while the output is gone.
 *
 * No credentials and no network. `authorize` only constructs a JWT client - the token is fetched
 * lazily on the first API call - and every case below fails before any request is made. The key is
 * generated here and never leaves this process and its children.
 */

const ROOT = join(__dirname, '..', '..');

// bin/dev.js registers ts-node and loads the commands from src/, so it runs on a pull request
// before the build step. bin/run.js needs lib/ and is covered too whenever a build is present.
// Both were measured swallowing the message identically before the fix, so dev.js on its own is a
// sufficient gate; the CI workflow additionally drives bin/run.js after its build step.
const DEV_BIN = join(ROOT, 'bin', 'dev.js');
const RUN_BIN = join(ROOT, 'bin', 'run.js');

const PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
}).privateKey;

const binaries = (): { name: string; path: string }[] => {
  const found = [{ name: 'bin/dev.js', path: DEV_BIN }];
  if (existsSync(join(ROOT, 'lib', 'commands'))) found.push({ name: 'bin/run.js', path: RUN_BIN });
  return found;
};

const run = (bin: string, argv: string[]): { stdout: string; stderr: string; status: number | null } => {
  const { stdout, stderr, status, error } = spawnSync(process.execPath, [bin, ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      // the master workflow exports live credentials, which must not decide what this parses, and
      // a real client_email would mean a real token request the moment a case stopped failing early
      GSHEET_CLIENT_EMAIL: 'offline@example.iam.gserviceaccount.com',
      GSHEET_PRIVATE_KEY: PRIVATE_KEY,
      GSHEET_CREDENTIALS_FILE: '',
      SPREADSHEET_ID: '',
      WORKSHEET_TITLE: '',
      // assert on text, not on terminal width or colour
      FORCE_COLOR: '0',
      OCLIF_COLUMNS: '120',
    },
  });
  if (error) throw error;
  return { stdout, stderr, status };
};

const SPREADSHEET = '--spreadsheetId=offline-spreadsheet-id';
const WORKSHEET = '--worksheetTitle=offline-worksheet';

// both of these fail after `this.start(...)`, i.e. with the buffering stubs installed
const SPINNER_CASES: [string, string[], string][] = [
  ['a data argument that is not JSON', ['data:update', 'not-json', SPREADSHEET, WORKSHEET], '"data" input has to be valid JSON'],
  ['a data argument that is not nested', ['data:update', '[1,2]', SPREADSHEET, WORKSHEET], 'Check "data" property'],
];

describe('cli output on failure', () => {
  for (const { name, path } of binaries()) {
    describe(name, () => {
      for (const [what, argv, message] of SPINNER_CASES) {
        it(`prints the error for ${what}`, () => {
          const { stdout, stderr, status } = run(path, argv);

          expect(stderr, `${name} printed nothing about "${message}"`).to.contain(message);
          expect(stdout).to.not.contain(message);
          expect(status).to.equal(1);
        });

        it(`prints the error for ${what} with --rawOutput`, () => {
          const { stderr, status } = run(path, [...argv, '--rawOutput']);

          expect(stderr, `${name} --rawOutput printed nothing about "${message}"`).to.contain(message);
          expect(status).to.equal(1);
        });
      }

      it('prints a parse failure, and stops no spinner that was never started', () => {
        const { stderr, status } = run(path, ['data:get', WORKSHEET]);

        expect(stderr).to.contain('Missing required flag');
        // `catch` now stops the action unconditionally; on this path none was ever started, and
        // `ux.action.stop()` returns before printing anything when there is no running task, so no
        // stray "done" appears
        expect(stderr).to.not.contain('done');
        expect(status).to.equal(1);
      });
    });
  }
});

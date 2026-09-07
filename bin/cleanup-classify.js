#!/usr/bin/env node
'use strict';

/**
 * Decides, for one worksheet title, whether the cleanup cron may delete it.
 *
 * The test spreadsheet is shared with the gsheet.action repository, so a title we do not
 * recognise may belong to a run that is happening right now, or to a human. The rule is
 * therefore allow-list only: a title is deleted when it matches a naming pattern one of the two
 * repositories is known to generate AND carries an epoch we can read AND that epoch is more than
 * an hour old. Everything else is preserved, including titles we fail to parse.
 *
 * Kept dependency-free and outside src/ so the shell script can pipe titles through it with a
 * bare `node`, and so mocha can unit test the decision without any Google credentials.
 */

const MAX_AGE_MS = 60 * 60 * 1000;

// Never touched, whatever else the rules say. The cron's own marker worksheet.
const PROTECTED_TITLES = ['[automated_testing]'];

/**
 * `test/commands/helper.ts` builds every worksheet title as
 * `<prefix><Date.now()>_<base36 random>`, occasionally with a `_ro`/`_up` variant suffix. The
 * prefixes are the fixed set the suites use; the epoch and the random tail are what make the
 * title ours rather than a human's.
 */
const CLI_TITLE = /^(?:data_append_|data_update_|data_get_|worksheet_[a-z]+_|lib_|grid_|sentinel_)(\d+)_[A-Za-z0-9]*(?:_[a-z]+)?$/;

/** The action repository names its e2e worksheets `gsheet.action_e2e_$(date +%s)_<sha>`. */
const ACTION_TITLE = /^gsheet\.action_e2e_(\d+)_[A-Za-z0-9]+$/;

const OWNERS = [
  { owner: 'google-sheet-cli', pattern: CLI_TITLE },
  { owner: 'gsheet.action', pattern: ACTION_TITLE },
];

/**
 * The two repositories stamp different units, so the digit count is the only thing that says
 * which one we are looking at: 13 digits has been milliseconds since 2001 and stays so until
 * 2286, 10 digits is the same window in seconds. Any other length is a number we cannot place,
 * and guessing at it is exactly the mistake that loses data.
 */
const readEpoch = (digits) => {
  if (digits.length === 13) return { ms: Number(digits), unit: 'ms' };
  if (digits.length === 10) return { ms: Number(digits) * 1000, unit: 's' };
  return null;
};

const formatAge = (ms) => {
  if (ms < 0) return `-${formatAge(-ms)}`;
  const minutes = Math.floor(ms / 60000);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`;
};

/**
 * @param {string} title worksheet title as Google reports it
 * @param {number} now epoch milliseconds to measure age against
 * @returns {{title: string, decision: 'DELETE'|'PRESERVE', reason: string}}
 */
const classify = (title, now) => {
  const preserve = (reason) => ({ title, decision: 'PRESERVE', reason });

  if (typeof title !== 'string' || title === '') return preserve('unreadable-title');
  if (PROTECTED_TITLES.includes(title)) return preserve('protected');

  const match = OWNERS.map(({ owner, pattern }) => ({ owner, found: pattern.exec(title) })).find(({ found }) => found);
  if (!match) return preserve('unowned');

  const epoch = readEpoch(match.found[1]);
  if (!epoch) return preserve(`malformed-epoch owner=${match.owner} digits=${match.found[1].length}`);

  const age = now - epoch.ms;
  const detail = `owner=${match.owner} unit=${epoch.unit} age=${formatAge(age)}`;
  if (age < MAX_AGE_MS) return preserve(`too-young ${detail}`);

  return { title, decision: 'DELETE', reason: `expired ${detail}` };
};

module.exports = { classify, MAX_AGE_MS, PROTECTED_TITLES };

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    const now = Date.now();
    for (const title of input.split('\n')) {
      if (title === '') continue;
      const { decision, reason } = classify(title, now);
      process.stdout.write(`${decision}\t${reason}\t${title}\n`);
    }
  });
}

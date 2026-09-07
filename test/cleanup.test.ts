import { expect } from '@oclif/test';

/**
 * bin/clear-testsheet.sh used to delete every worksheet but one, on a spreadsheet the
 * gsheet.action repository writes to as well. These cases pin the allow-list that replaced it:
 * anything the classifier cannot positively identify as an expired worksheet of ours survives.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { classify, MAX_AGE_MS } = require('../bin/cleanup-classify');

const NOW = new Date('2026-09-07T12:00:00.000Z').getTime();

/** What test/commands/helper.ts stamps: Date.now(), 13 digits. */
const msAgo = (minutes: number): string => String(NOW - minutes * 60000);
/** What the action stamps: date +%s, 10 digits. */
const secAgo = (minutes: number): string => String(Math.floor((NOW - minutes * 60000) / 1000));

const decide = (title: string) => classify(title, NOW);

const expectPreserved = (title: string, reason: string) => {
  const result = decide(title);
  expect(result.decision, `${title} -> ${result.reason}`).to.equal('PRESERVE');
  expect(result.reason).to.match(new RegExp(`^${reason}`));
};

const expectDeleted = (title: string) => {
  const result = decide(title);
  expect(result.decision, `${title} -> ${result.reason}`).to.equal('DELETE');
};

const CLI_PREFIXES = [
  'data_append_',
  'data_update_',
  'data_get_',
  'worksheet_get_',
  'worksheet_add_',
  'worksheet_remove_',
  'worksheet_rename_',
  'lib_',
  'grid_',
  'sentinel_',
];

describe('cleanup classifier', () => {
  it('measures age against one hour', () => {
    expect(MAX_AGE_MS).to.equal(60 * 60 * 1000);
  });

  describe('protected titles', () => {
    it('never deletes the marker worksheet', () => {
      expectPreserved('[automated_testing]', 'protected');
    });

    it('never deletes it when someone retyped its spacing or case', () => {
      expectPreserved('  [automated_testing]  ', 'protected');
      expectPreserved('[Automated_Testing]', 'protected');
    });
  });

  describe('titles nobody here created', () => {
    it('preserves a worksheet a human named', () => {
      expectPreserved('Q3 revenue forecast', 'unowned');
    });

    it('preserves the default worksheet', () => {
      expectPreserved('Sheet1', 'unowned');
    });

    it('preserves an owned prefix with no epoch at all', () => {
      expectPreserved('data_append_notes', 'unowned');
    });

    it('preserves an epoch with no owned prefix', () => {
      expectPreserved(`${msAgo(600)}_abc123def`, 'unowned');
    });

    it('preserves a name that only starts like the action e2e sheets', () => {
      expectPreserved('gsheet.action_e2e_notes', 'unowned');
    });

    it('preserves an owned prefix with no random tail', () => {
      expectPreserved(`data_get_${msAgo(600)}`, 'unowned');
    });

    it('preserves an owned prefix that a leading space detaches from the pattern', () => {
      expectPreserved(` data_get_${msAgo(600)}_abc123def`, 'unowned');
    });

    it('preserves an empty title', () => {
      expectPreserved('', 'unreadable-title');
    });
  });

  describe('epochs we cannot place', () => {
    it('preserves a three digit number', () => {
      expectPreserved('data_get_123_abc123def', 'malformed-epoch');
    });

    it('preserves twelve digits, one short of milliseconds', () => {
      expectPreserved('worksheet_add_175724640000_abc123def', 'malformed-epoch');
    });

    it('preserves fourteen digits, one past milliseconds', () => {
      expectPreserved('lib_17572464000000_abc123def', 'malformed-epoch');
    });

    it('preserves eleven digits, one past seconds', () => {
      expectPreserved('gsheet.action_e2e_17572464000_deadbee', 'malformed-epoch');
    });

    it('preserves a year a human typed', () => {
      expectPreserved('lib_2024_budget', 'malformed-epoch');
    });

    // The unit belongs to the owner. Neither generator can produce the two combinations below,
    // and a ten digit id behind a CLI prefix is exactly what a person or another tool would write.
    it('preserves seconds behind a CLI prefix, which the CLI never stamps', () => {
      expectPreserved(`lib_${secAgo(360)}_abc123def`, 'malformed-epoch');
      expectPreserved('data_get_1000000000_abc123def', 'malformed-epoch');
    });

    it('preserves milliseconds behind the action prefix, which the action never stamps', () => {
      expectPreserved(`gsheet.action_e2e_${msAgo(360)}_deadbee`, 'malformed-epoch');
    });
  });

  describe('worksheets a run may still be using', () => {
    it('preserves a milliseconds worksheet from half an hour ago', () => {
      expectPreserved(`data_append_${msAgo(30)}_abc123def`, 'too-young');
    });

    it('preserves a seconds worksheet from half an hour ago', () => {
      expectPreserved(`gsheet.action_e2e_${secAgo(30)}_deadbee`, 'too-young');
    });

    it('preserves a worksheet created a minute ago', () => {
      expectPreserved(`data_get_${msAgo(1)}_abc123def`, 'too-young');
    });

    it('preserves a worksheet one minute short of the hour', () => {
      expectPreserved(`data_get_${msAgo(59)}_abc123def`, 'too-young');
    });

    it('preserves a worksheet whose epoch is in the future', () => {
      expectPreserved(`data_get_${msAgo(-120)}_abc123def`, 'too-young');
    });

    it('preserves an action worksheet whose epoch is in the future', () => {
      expectPreserved(`gsheet.action_e2e_${secAgo(-120)}_deadbee`, 'too-young');
    });
  });

  describe('worksheets our runs left behind', () => {
    CLI_PREFIXES.forEach((prefix) => {
      it(`deletes a six hour old ${prefix} worksheet`, () => {
        expectDeleted(`${prefix}${msAgo(360)}_abc123def`);
      });
    });

    it('deletes the grid growth variant suffixes', () => {
      expectDeleted(`grid_${msAgo(360)}_abc123def_ro`);
      expectDeleted(`grid_${msAgo(360)}_abc123def_up`);
    });

    it('deletes a worksheet whose random tail came out empty', () => {
      expectDeleted(`lib_${msAgo(360)}_`);
    });

    it('deletes a six hour old action e2e worksheet', () => {
      expectDeleted(`gsheet.action_e2e_${secAgo(360)}_deadbee`);
    });

    it('deletes a worksheet one minute past the hour', () => {
      expectDeleted(`data_get_${msAgo(61)}_abc123def`);
    });

    it('deletes at exactly one hour', () => {
      expectDeleted(`data_get_${msAgo(60)}_abc123def`);
    });
  });

  describe('a realistic mixed spreadsheet', () => {
    it('only ever picks its own expired worksheets', () => {
      const titles = [
        '[automated_testing]',
        'Sheet1',
        'Q3 revenue forecast',
        'Onboarding checklist (do not delete)',
        'lib_2024_budget',
        `lib_${secAgo(360)}_abc123def`,
        `data_append_${msAgo(360)}_abc123def`,
        `gsheet.action_e2e_${secAgo(5)}_deadbee`,
        `gsheet.action_e2e_${secAgo(900)}_cafe123`,
        `worksheet_rename_${msAgo(12)}_zzz999aaa`,
      ];

      const deleted = titles.map(decide).filter((result: { decision: string }) => result.decision === 'DELETE');

      expect(deleted.map((result: { title: string }) => result.title)).to.eql([
        `data_append_${msAgo(360)}_abc123def`,
        `gsheet.action_e2e_${secAgo(900)}_cafe123`,
      ]);
    });
  });
});

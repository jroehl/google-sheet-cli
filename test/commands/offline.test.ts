import { Config } from '@oclif/core';
import { runCommand } from '@oclif/test';
import { expect } from 'chai';
import { generateKeyPairSync } from 'crypto';
import { join } from 'path';
import * as factory from '../../src/lib/factory';
import GoogleSheet, { GoogleSheetCli } from '../../src/lib/google-sheet';

/**
 * The command layer without a Google service account.
 *
 * Everything else that proves the oclif 5 migration - the flag and argument surface, the
 * vendored `ux.table`, the error path - used to be provable only by the live suite, which needs
 * credentials and therefore first runs on CI after merge. That is the wrong side of the merge
 * for the riskiest part of a major version, so these cases run on every pull request instead.
 *
 * The Sheets client is replaced through `src/lib/factory`, by import. There is deliberately no
 * environment switch for it: a production run has no way to reach the stub, and a test that
 * forgets to install it fails on a real authentication attempt rather than passing quietly.
 */

const ROOT = join(__dirname, '..', '..');

const SPREADSHEET_ID = 'offline-spreadsheet-id';
const WORKSHEET_TITLE = 'offline-worksheet';
const CLIENT_EMAIL = 'offline@example.iam.gserviceaccount.com';

// `normalizeCredentials` parses the key with `createPrivateKey` before anything else runs, so a
// placeholder string would fail before the command is reached. This is a throwaway key that
// exists only inside the test process.
const PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
  publicKeyEncoding: { format: 'pem', type: 'spki' },
}).privateKey;

const SHEET_DATA: GoogleSheetCli.SheetData = {
  rawData: [
    ['A1', 'B1', 'C1'],
    ['A2', '', 'C2'],
  ],
  formatted: [
    { '(A)': 'A1', '(B)': 'B1', '(C)': 'C1' },
    { '(A)': 'A2', '(B)': '', '(C)': 'C2' },
  ],
  header: ['(A)', '(B)', '(C)'],
  range: `${WORKSHEET_TITLE}!A1:Z1000`,
};

interface StubCall {
  method: string;
  args: unknown[];
}

/**
 * Records what the command layer asked the Sheets client to do. Only the methods the cases below
 * drive are implemented; a command reaching for anything else fails loudly instead of silently
 * doing nothing.
 */
class StubGoogleSheet {
  public readonly calls: StubCall[] = [];
  public updateError?: Error;

  async authorize(credentials: GoogleSheetCli.Credentials): Promise<void> {
    this.calls.push({ method: 'authorize', args: [credentials] });
  }

  async getData(options: GoogleSheetCli.QueryOptions, spreadsheetId?: string): Promise<GoogleSheetCli.SheetData> {
    this.calls.push({ method: 'getData', args: [options, spreadsheetId] });
    return SHEET_DATA;
  }

  async updateData(data: GoogleSheetCli.RawData, options: GoogleSheetCli.QueryOptions, spreadsheetId?: string): Promise<void> {
    this.calls.push({
      method: 'updateData',
      args: [data, options, spreadsheetId],
    });
    if (this.updateError) throw this.updateError;
  }
}

// The namespace object is typed read-only; the module itself is a plain CommonJS export that a
// test is meant to replace, which is the whole reason `factory` exists.
const mutableFactory = factory as { createGoogleSheet: () => GoogleSheet };
const realCreateGoogleSheet = factory.createGoogleSheet;

/** Collapse the help renderer's wrapping and padding so an expectation can name one flag. */
const flat = (output: string): string => output.replace(/\s+/g, ' ').trim();

const AUTHENTICATION_FLAGS = [
  '-h, --help Show CLI help.',
  '-r, --rawOutput Get the raw output as a JSON string',
  '-c, --clientEmail=<value> [env: GSHEET_CLIENT_EMAIL]',
  '-p, --privateKey=<value> [env: GSHEET_PRIVATE_KEY]',
  '-f, --credentialsFile=<value> [env: GSHEET_CREDENTIALS_FILE]',
];

const SPREADSHEET_ID_FLAG = '-s, --spreadsheetId=<value> (required) [env: SPREADSHEET_ID] ID of the spreadsheet to use';
const WORKSHEET_TITLE_FLAG = '-t, --worksheetTitle=<value> (required) [env: WORKSHEET_TITLE] Title of the worksheet to use';
const VALUE_INPUT_OPTION_FLAG = '-v, --valueInputOption=<option> [default: RAW, env: VALUE_INPUT_OPTION]';
const DATA_ARG = 'DATA The data to be used as a JSON string - nested array [["1", "2", "3"]]';

/**
 * Every command, and what its `--help` has to keep saying. `usage` pins which flags oclif treats
 * as required and in what order; the `expected` strings pin each flag's long name, short char,
 * default and env binding. Renaming or dropping any of them turns this file red.
 */
const COMMANDS: { id: string; usage: string; expected: string[] }[] = [
  {
    id: 'data:append',
    usage: '$ google-sheet data:append DATA -t <value> -s <value> [-h] [-r]',
    expected: [DATA_ARG, SPREADSHEET_ID_FLAG, WORKSHEET_TITLE_FLAG, VALUE_INPUT_OPTION_FLAG, '<options: RAW|USER_ENTERED>', '--minCol=<value> [default: 1]'],
  },
  {
    id: 'data:get',
    usage: '$ google-sheet data:get -s <value> -t <value> [-h] [-r]',
    expected: [
      SPREADSHEET_ID_FLAG,
      WORKSHEET_TITLE_FLAG,
      '-w, --hasHeaderRow If the first row should be treated as header row',
      '--range=<value> The range to use to query the cells',
      '--minRow=<value> [default: 1]',
      '--minCol=<value> [default: 1]',
      '--maxRow=<value> The optional ending row of the operation',
      '--maxCol=<value> The optional ending col of the operation',
      // the flags the vendored ux.table contributes; core 5 has no ux.table, so these only exist
      // because src/lib/table.ts still declares them
      '-x, --extended show extra columns',
      '--columns=<value> only show provided columns (comma-separated)',
      '--sort=<value>',
      '--filter=<value>',
      '--csv output is csv format',
      '--output=<option>',
      '--no-truncate do not truncate output to fit screen',
      '--no-header hide table header from output',
    ],
  },
  {
    id: 'data:update',
    usage: '$ google-sheet data:update DATA -t <value> -s <value> [-h] [-r]',
    expected: [
      DATA_ARG,
      SPREADSHEET_ID_FLAG,
      WORKSHEET_TITLE_FLAG,
      VALUE_INPUT_OPTION_FLAG,
      '<options: RAW|USER_ENTERED>',
      '--minRow=<value> [default: 1]',
      '--minCol=<value> [default: 1]',
    ],
  },
  {
    id: 'spreadsheet:add',
    usage: '$ google-sheet spreadsheet:add --spreadsheetTitle <value> [-h] [-r]',
    expected: ['--spreadsheetTitle=<value> (required) Title of the spreadsheet'],
  },
  {
    id: 'spreadsheet:get',
    usage: '$ google-sheet spreadsheet:get -s <value> [-h] [-r]',
    expected: [SPREADSHEET_ID_FLAG],
  },
  {
    id: 'worksheet:add',
    usage: '$ google-sheet worksheet:add -t <value> -s <value> [-h] [-r]',
    expected: [SPREADSHEET_ID_FLAG, WORKSHEET_TITLE_FLAG],
  },
  {
    id: 'worksheet:get',
    usage: '$ google-sheet worksheet:get -t <value> -s <value> [-h] [-r]',
    expected: [SPREADSHEET_ID_FLAG, WORKSHEET_TITLE_FLAG],
  },
  {
    id: 'worksheet:remove',
    usage: '$ google-sheet worksheet:remove -t <value> -s <value> [-h] [-r]',
    expected: [SPREADSHEET_ID_FLAG, WORKSHEET_TITLE_FLAG],
  },
  {
    id: 'worksheet:rename',
    usage: '$ google-sheet worksheet:rename -t <value> --newWorksheetTitle <value> -s <value> [-h] [-r]',
    expected: [SPREADSHEET_ID_FLAG, WORKSHEET_TITLE_FLAG, '--newWorksheetTitle=<value> (required) New title of the worksheet to use'],
  },
];

/** The env every flag with an `env:` binding reads, so the suite is the same run to run. */
const MANAGED_ENV = ['GSHEET_CLIENT_EMAIL', 'GSHEET_PRIVATE_KEY', 'GSHEET_CREDENTIALS_FILE', 'SPREADSHEET_ID', 'WORKSHEET_TITLE', 'VALUE_INPUT_OPTION'];

describe('offline commands', () => {
  let stub: StubGoogleSheet;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // The master workflow runs the whole suite with live credentials exported. Those would change
    // what these cases parse, so the environment is emptied first and the private key put back
    // as the one value that cannot travel on the command line (the PEM header has spaces in it).
    savedEnv = Object.fromEntries(MANAGED_ENV.map((name) => [name, process.env[name]]));
    for (const name of MANAGED_ENV) delete process.env[name];
    process.env.GSHEET_PRIVATE_KEY = PRIVATE_KEY;

    stub = new StubGoogleSheet();
    mutableFactory.createGoogleSheet = () => stub as unknown as GoogleSheet;
  });

  afterEach(() => {
    mutableFactory.createGoogleSheet = realCreateGoogleSheet;
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('covers every command the CLI ships', async () => {
    const previous = process.env.NODE_ENV;
    // outside a production run @oclif/core resolves the configured ./lib/commands back to src/,
    // which is what runCommand relies on too
    process.env.NODE_ENV = 'test';
    try {
      const config = await Config.load(ROOT);
      // `help` comes from @oclif/plugin-help and is not ours to pin
      const ours = config.commands.filter(({ pluginName }) => pluginName === config.pjson.name).map(({ id }) => id);
      expect(ours.sort()).to.eql(COMMANDS.map(({ id }) => id).sort());
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  describe('--help', () => {
    for (const { id, usage, expected } of COMMANDS) {
      it(`runs "${id} --help" and keeps its flag surface`, async () => {
        const { error, stdout } = await runCommand([id, '--help']);
        if (error) throw error;

        const help = flat(stdout);
        expect(help).to.contain(usage);
        for (const line of [...AUTHENTICATION_FLAGS, ...expected]) {
          expect(help, `${id} --help is missing "${line}"`).to.contain(line);
        }

        // help has to work for someone who has not set up a service account yet
        expect(stub.calls).to.eql([]);
      });
    }
  });

  describe('data:get', () => {
    it('renders the table and authorizes through the factory', async () => {
      const { error, stdout } = await runCommand([
        'data:get',
        `--spreadsheetId=${SPREADSHEET_ID}`,
        `--worksheetTitle=${WORKSHEET_TITLE}`,
        `--clientEmail=${CLIENT_EMAIL}`,
      ]);
      if (error) throw error;

      // the header capitalisation is @oclif/core 2's, carried in src/lib/table.ts
      expect(flat(stdout)).to.contain('(a) (b) (c)');
      expect(stdout).to.contain('A1');
      expect(stdout).to.contain('C2');

      expect(stub.calls.map(({ method }) => method)).to.eql(['authorize', 'getData']);
      expect(stub.calls[0].args[0]).to.eql({
        client_email: CLIENT_EMAIL,
        private_key: `${PRIVATE_KEY.trim()}\n`,
      });
      expect(stub.calls[1].args).to.eql([
        {
          minRow: 1,
          maxRow: undefined,
          minCol: 1,
          maxCol: undefined,
          range: undefined,
          hasHeaderRow: false,
          worksheetTitle: WORKSHEET_TITLE,
        },
        SPREADSHEET_ID,
      ]);
    });

    it('coerces its flags and prints JSON for --rawOutput', async () => {
      const { error, result, stdout } = await runCommand([
        'data:get',
        `--spreadsheetId=${SPREADSHEET_ID}`,
        `--worksheetTitle=${WORKSHEET_TITLE}`,
        `--clientEmail=${CLIENT_EMAIL}`,
        '--rawOutput',
        '--hasHeaderRow',
        '--minRow=2',
        '--minCol=3',
        '--maxRow=4',
        '--maxCol=5',
        '--range=A1:B2',
      ]);
      if (error) throw error;

      // Flags.integer has to hand the command numbers, not the strings it read off argv
      expect(stub.calls[1].args[0]).to.eql({
        minRow: 2,
        maxRow: 4,
        minCol: 3,
        maxCol: 5,
        range: 'A1:B2',
        hasHeaderRow: true,
        worksheetTitle: WORKSHEET_TITLE,
      });

      expect(result).to.eql({ operation: 'data:get', ...SHEET_DATA });
      expect(JSON.parse(stdout)).to.eql({
        operation: 'data:get',
        ...SHEET_DATA,
      });
    });
  });

  describe('data:update', () => {
    it('surfaces an error from the Sheets client and exits 1', async () => {
      stub.updateError = new Error('Unable to parse range: nope!A1');

      const { error, stdout } = await runCommand([
        'data:update',
        '[["1","2"]]',
        `--spreadsheetId=${SPREADSHEET_ID}`,
        `--worksheetTitle=${WORKSHEET_TITLE}`,
        `--clientEmail=${CLIENT_EMAIL}`,
      ]);

      expect(error, 'data:update should have failed').to.not.be.undefined;
      expect(error!.message).to.contain('Unable to parse range: nope!A1');
      expect((error as { oclif?: { exit?: number } }).oclif?.exit).to.equal(1);
      expect(stdout).to.not.contain('Data successfully updated');

      expect(stub.calls.map(({ method }) => method)).to.eql(['authorize', 'updateData']);
      expect(stub.calls[1].args).to.eql([
        [['1', '2']],
        {
          worksheetTitle: WORKSHEET_TITLE,
          minCol: 1,
          minRow: 1,
          valueInputOption: 'RAW',
        },
        SPREADSHEET_ID,
      ]);
    });

    it('rejects a data argument that is not JSON', async () => {
      const { error } = await runCommand([
        'data:update',
        'not-json',
        `--spreadsheetId=${SPREADSHEET_ID}`,
        `--worksheetTitle=${WORKSHEET_TITLE}`,
        `--clientEmail=${CLIENT_EMAIL}`,
      ]);

      expect(error, 'data:update should have failed').to.not.be.undefined;
      expect(error!.message).to.contain('"data" input has to be valid JSON');
      expect(stub.calls.map(({ method }) => method)).to.eql(['authorize']);
    });
  });

  it('is the factory that the stub replaces', () => {
    expect(factory.createGoogleSheet()).to.equal(stub as unknown as GoogleSheet);
    mutableFactory.createGoogleSheet = realCreateGoogleSheet;
    expect(factory.createGoogleSheet()).to.be.instanceOf(GoogleSheet);
  });
});

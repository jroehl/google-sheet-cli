import { expect } from '@oclif/test';
import GoogleSheet, { GoogleSheetCli } from '../src/lib/google-sheet';
import { FakeSheets } from './fake-sheets';

/**
 * Behavioral contract for every public method of `GoogleSheet`, driven through the
 * in-memory fake of the Sheets REST API. These expectations were written against the
 * code as it stood before the #611 grid-growth work and must keep passing afterwards.
 */

const SPREADSHEET_ID = 'fake-spreadsheet-id';
const SPREADSHEET_TITLE = 'Regression spreadsheet';
const TITLE = 'Sheet1';

const BLOCK = [
  ['A1', 'A2', 'A3', 'A4', 'A5'],
  ['B1', '', 'B3', 'B4', 'B5', 'B6'],
];

const APPEND = [
  ['C1', 'C2', 'C3'],
  ['D1', 'D2', 'D3', 'D4', 'D5'],
];

// the blank cell fixture the command tests use (test/commands/helper.ts)
const RAW_DATA = [
  ['A1', 'B1', 'C1'],
  ['', 'B2', 'C2'],
  ['A3', '', 'C3'],
  ['A4', 'B4', ''],
  ['A5', '', 'C5'],
  ['', 'B6', 'C6'],
  ['A7', 'B7', 'C7'],
];

/**
 * Run a call that is expected to reject and hand back whatever it threw
 *
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
const rejection = async (fn: () => Promise<any>): Promise<any> => {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to reject, but it resolved');
};

/**
 * Run a call and hand back everything the library wrote to stderr while it ran
 *
 * @param {() => Promise<any>} fn
 * @returns {Promise<string>}
 */
const stderrOf = async (fn: () => Promise<any>): Promise<string> => {
  const original = process.stderr.write;
  let captured = '';
  (process.stderr as any).write = (chunk: any): boolean => {
    captured += String(chunk);
    return true;
  };
  try {
    await fn();
  } finally {
    (process.stderr as any).write = original;
  }
  return captured;
};

describe('google-sheet regression', () => {
  const fake = new FakeSheets();
  let gsheet: GoogleSheet;

  before(() => fake.install());
  after(() => fake.uninstall());

  beforeEach(async () => {
    fake.reset();
    fake.addSpreadsheet(SPREADSHEET_ID, SPREADSHEET_TITLE, [{ title: TITLE }]);
    gsheet = new GoogleSheet(SPREADSHEET_ID);
    await gsheet.authorize(fake.credentials);
  });

  describe('getSpreadsheet', () => {
    it('returns the spreadsheet the instance was constructed with', async () => {
      const spreadsheet = await gsheet.getSpreadsheet();
      expect(spreadsheet.spreadsheetId).to.equal(SPREADSHEET_ID);
      expect(spreadsheet.properties?.title).to.equal(SPREADSHEET_TITLE);
      expect(spreadsheet.sheets?.map((sheet) => sheet.properties?.title)).to.eql([TITLE]);
    });

    it('accepts an explicit spreadsheetId', async () => {
      fake.addSpreadsheet('other-id', 'Other spreadsheet', [{ title: 'Tab' }]);
      const spreadsheet = await gsheet.getSpreadsheet('other-id');
      expect(spreadsheet.properties?.title).to.equal('Other spreadsheet');
    });

    it('surfaces the API error for an unknown spreadsheet', async () => {
      const error = await rejection(() => gsheet.getSpreadsheet('nope'));
      expect(error.message).to.equal('Requested entity was not found.');
    });
  });

  describe('addSpreadsheet', () => {
    it('creates a spreadsheet and remembers its id', async () => {
      const fresh = new GoogleSheet();
      await fresh.authorize(fake.credentials);
      const created = await fresh.addSpreadsheet('Brand new');
      expect(created.properties?.title).to.equal('Brand new');
      expect(created.spreadsheetId).to.be.a('string');

      const again = await fresh.getSpreadsheet();
      expect(again.spreadsheetId).to.equal(created.spreadsheetId);
    });
  });

  describe('addWorksheet', () => {
    it('returns the created sheet and remembers its title', async () => {
      const sheet = await gsheet.addWorksheet('Second');
      expect(sheet?.properties?.title).to.equal('Second');
      expect(sheet?.properties?.sheetType).to.equal('GRID');
      expect(sheet?.properties?.gridProperties).to.eql({ rowCount: 1000, columnCount: 26 });
      expect(sheet?.properties).to.haveOwnProperty('sheetId');
      expect(sheet?.properties).to.haveOwnProperty('index');

      // the remembered title is what a follow-up call without worksheetTitle uses
      await gsheet.updateData([['x']], { minCol: 1, minRow: 1 });
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('x');
    });

    it('surfaces the API error for a duplicate title', async () => {
      const error = await rejection(() => gsheet.addWorksheet(TITLE));
      expect(error.message).to.contain(`A sheet with the name "${TITLE}" already exists`);
    });
  });

  describe('getWorksheet', () => {
    it('returns the sheet and remembers its title', async () => {
      const sheet = await gsheet.getWorksheet(TITLE);
      expect(sheet.properties?.title).to.equal(TITLE);
      expect(sheet.properties?.sheetType).to.equal('GRID');
      expect(sheet.properties?.gridProperties).to.eql({ rowCount: 1000, columnCount: 26 });

      await gsheet.updateData([['y']], { minCol: 1, minRow: 1 });
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('y');
    });

    it('throws a string when the worksheet is missing', async () => {
      const error = await rejection(() => gsheet.getWorksheet('Nope'));
      expect(error).to.equal(`Sheet "Nope" not found in "${SPREADSHEET_TITLE}"`);
    });
  });

  describe('renameWorksheet', () => {
    it('renames the worksheet and remembers the new title', async () => {
      const result = await gsheet.renameWorksheet(TITLE, 'Renamed');
      expect(result).to.equal(undefined);
      expect(fake.worksheet(SPREADSHEET_ID, 'Renamed').title).to.equal('Renamed');

      await gsheet.updateData([['z']], { minCol: 1, minRow: 1 });
      expect(fake.cell(SPREADSHEET_ID, 'Renamed', 'A1')).to.equal('z');
    });

    it('throws a string when the worksheet is missing', async () => {
      const error = await rejection(() => gsheet.renameWorksheet('Nope', 'Renamed'));
      expect(error).to.equal(`Sheet "Nope" not found in "${SPREADSHEET_TITLE}"`);
    });
  });

  describe('removeWorksheet', () => {
    it('removes the worksheet and forgets the title', async () => {
      await gsheet.addWorksheet('Second');
      const result = await gsheet.removeWorksheet('Second');
      expect(result).to.equal(undefined);
      expect(fake.spreadsheets.get(SPREADSHEET_ID)?.sheets.map((sheet) => sheet.title)).to.eql([TITLE]);

      const error = await rejection(() => gsheet.getData({ minCol: 1, minRow: 1 }));
      expect(error).to.equal('Option property "worksheetTitle" is required');
    });

    it('throws a string when the worksheet is missing', async () => {
      const error = await rejection(() => gsheet.removeWorksheet('Nope'));
      expect(error).to.equal(`Sheet "Nope" not found in "${SPREADSHEET_TITLE}"`);
    });
  });

  describe('getData', () => {
    it('reads a block, padding short rows to the longest one', async () => {
      await gsheet.updateData(BLOCK, { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      const data = await gsheet.getData({ worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      expect(data).to.eql({
        formatted: [
          { '(A)': 'A1', '(B)': 'A2', '(C)': 'A3', '(D)': 'A4', '(E)': 'A5', '(F)': '' },
          { '(A)': 'B1', '(B)': '', '(C)': 'B3', '(D)': 'B4', '(E)': 'B5', '(F)': 'B6' },
        ],
        header: ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'],
        range: `'${TITLE}'!A1:Z1000`,
        rawData: [
          ['A1', 'A2', 'A3', 'A4', 'A5', ''],
          ['B1', '', 'B3', 'B4', 'B5', 'B6'],
        ],
      });
    });

    it('keeps the blank cells of the RAW_DATA fixture', async () => {
      await gsheet.updateData(RAW_DATA, { worksheetTitle: TITLE });
      const data = await gsheet.getData({ worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      expect(data.header).to.eql(['(A)', '(B)', '(C)']);
      expect(data.rawData).to.eql([
        ['A1', 'B1', 'C1'],
        ['', 'B2', 'C2'],
        ['A3', '', 'C3'],
        ['A4', 'B4', ''],
        ['A5', '', 'C5'],
        ['', 'B6', 'C6'],
        ['A7', 'B7', 'C7'],
      ]);
    });

    it('uses the first row as the header when hasHeaderRow is set', async () => {
      await gsheet.updateData(
        [
          ['h1', 'h2', 'h3'],
          ['a', 'b', 'c'],
          ['d', 'e', 'f'],
        ],
        { worksheetTitle: TITLE, minCol: 1, minRow: 1 }
      );
      const data = await gsheet.getData({ worksheetTitle: TITLE, minCol: 1, minRow: 1, hasHeaderRow: true });
      expect(data.header).to.eql(['h1', 'h2', 'h3']);
      expect(data.rawData).to.eql([
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
      ]);
      expect(data.formatted).to.eql([
        { h1: 'a', h2: 'b', h3: 'c' },
        { h1: 'd', h2: 'e', h3: 'f' },
      ]);
    });

    it('fetches the header row separately when minRow is past it', async () => {
      await gsheet.updateData(
        [
          ['h1', 'h2', 'h3'],
          ['a', 'b', 'c'],
          ['d', 'e', 'f'],
        ],
        { worksheetTitle: TITLE, minCol: 1, minRow: 1 }
      );
      const data = await gsheet.getData({ worksheetTitle: TITLE, minCol: 1, minRow: 2, hasHeaderRow: true });
      expect(data.header).to.eql(['h1', 'h2', 'h3']);
      expect(data.range).to.equal(`'${TITLE}'!A2:Z1000`);
      expect(data.rawData).to.eql([
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
      ]);
    });

    it('honors minCol and maxRow bounds and names the headers from minCol', async () => {
      await gsheet.updateData([...BLOCK, ['C1', 'C2']], { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      const data = await gsheet.getData({ worksheetTitle: TITLE, minCol: 2, minRow: 1, maxRow: 2 });
      expect(data.range).to.equal(`'${TITLE}'!B1:Z2`);
      expect(data.header).to.eql(['(B)', '(C)', '(D)', '(E)', '(F)']);
      expect(data.rawData).to.eql([
        ['A2', 'A3', 'A4', 'A5', ''],
        ['', 'B3', 'B4', 'B5', 'B6'],
      ]);
    });

    // The four ways a range and a worksheetTitle can meet. 2.2.0's regex only ever recognised a
    // quoted title inside a range, and getData overwrote worksheetTitle with whatever it got
    // back, so a quoted title wins and an unquoted one is ignored. The choice is remembered on
    // the instance and steers every later command, so all four are pinned.

    it('2.2.x: a quoted range worksheet overwrites an explicit worksheetTitle', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      const options: GoogleSheetCli.QueryOptions = { worksheetTitle: TITLE, range: `'Second'!A1:B2` };
      await gsheet.getData(options);
      expect(options.worksheetTitle).to.equal('Second');

      // and the instance now remembers Second, which is what the next command will use
      await gsheet.updateData([['moved']], { minCol: 1, minRow: 1 });
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('moved');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('');
    });

    it('2.2.x: a quoted range worksheet is used when no worksheetTitle is given', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      const options: GoogleSheetCli.QueryOptions = { range: `'Second'!A1:B2` };
      await gsheet.getData(options);
      expect(options.worksheetTitle).to.equal('Second');
    });

    it('2.2.x: an unquoted range worksheet does not overwrite an explicit worksheetTitle', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      const options: GoogleSheetCli.QueryOptions = { worksheetTitle: TITLE, range: `Second!A1:B2` };
      await gsheet.getData(options);
      expect(options.worksheetTitle).to.equal(TITLE);

      await gsheet.updateData([['stays']], { minCol: 1, minRow: 1 });
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('stays');
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('');
    });

    it('2.2.x: an unquoted range worksheet is ignored, leaving the remembered one', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      const options: GoogleSheetCli.QueryOptions = { range: `Second!A1:B2` };
      await gsheet.getData(options);
      expect(options.worksheetTitle).to.equal(TITLE);

      // with nothing remembered either, the unquoted title is still no help
      const fresh = new GoogleSheet(SPREADSHEET_ID);
      await fresh.authorize(fake.credentials);
      const error = await rejection(() => fresh.getData({ range: `Second!A1:B2` }));
      expect(error).to.equal('Option property "worksheetTitle" is required');
    });

    it('reads a quoted range', async () => {
      await gsheet.updateData(RAW_DATA, { worksheetTitle: TITLE });
      const data = await gsheet.getData({ range: `'${TITLE}'!A2:B3` });
      expect(data.range).to.equal(`'${TITLE}'!A2:B3`);
      expect(data.header).to.eql(['(A)', '(B)']);
      expect(data.rawData).to.eql([
        ['', 'B2'],
        ['A3', ''],
      ]);
    });

    it('reads the unquoted range the action passes through', async () => {
      await gsheet.updateData(
        [
          ['A1', 'A2', 'A3'],
          ['B1', 'B2', 'B3'],
        ],
        { worksheetTitle: TITLE }
      );
      await gsheet.appendData([['C2', 'C3', 'C4']], { worksheetTitle: TITLE, minCol: 2 });
      const data = await gsheet.getData({ worksheetTitle: TITLE, range: `${TITLE}!A2:B3` });
      expect(data.rawData).to.eql([
        ['B1', 'B2'],
        ['', 'C2'],
      ]);
    });

    it('throws a string when no worksheetTitle can be resolved', async () => {
      const error = await rejection(() => gsheet.getData({ minCol: 1, minRow: 1 }));
      expect(error).to.equal('Option property "worksheetTitle" is required');
    });

    it('throws when minCol is omitted, because the header naming starts at column 0', async () => {
      // a long standing quirk of getData; the CLI always defaults minCol to 1
      await gsheet.updateData(BLOCK, { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      const error = await rejection(() => gsheet.getData({ worksheetTitle: TITLE, minRow: 1 }));
      expect(error).to.equal('col has to be greater than 1');
    });
  });

  describe('updateData', () => {
    it('writes at minCol and minRow', async () => {
      const result = await gsheet.updateData(
        [
          ['a', 'b'],
          ['c', 'd'],
        ],
        { worksheetTitle: TITLE, minCol: 2, minRow: 3 }
      );
      expect(result).to.equal(undefined);
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'B3')).to.equal('a');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'C3')).to.equal('b');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'B4')).to.equal('c');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'C4')).to.equal('d');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('');
    });

    it('writes from A1 when only the worksheetTitle is given', async () => {
      await gsheet.updateData([['a', 'b']], { worksheetTitle: TITLE });
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('a');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'B1')).to.equal('b');
    });

    it('succeeds and changes nothing when there are no rows', async () => {
      // a job that writes "whatever arrived today" and finds nothing has always succeeded
      await gsheet.updateData([['keep']], { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      const result = await gsheet.updateData([], { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      expect(result).to.equal(undefined);
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('keep');
    });

    // The same four combinations as getData. Resolution follows getData - a quoted title in the
    // range wins, an unquoted one does not - but a range that contradicts an explicit title
    // wins whichever way it spelled the title, and only says so on stderr (2.2.x wrote there
    // silently; the refusal is held for 3.0.0).

    it('2.2.x: a quoted range worksheet is written to, even after another one was touched', async () => {
      // the action runs every command through one shared instance, so the title left over from
      // an earlier command must not contradict a range given here
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      await gsheet.updateData([['landed']], { range: `'Second'!A1` });
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('landed');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('');
    });

    it('2.2.x: a quoted range worksheet matching the explicit title is written to', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.updateData([['agreed']], { worksheetTitle: 'Second', range: `'Second'!A1` });
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('agreed');
    });

    it('2.2.x: an unquoted range worksheet that contradicts the explicit title is written to, with a warning', async () => {
      // 2.2.x wrote to Second here while validating Sheet1. The silence was the bug; the write
      // was not, and a fix release may not turn a working call into a failure. So the write
      // stays and the contradiction is now said out loud. Refusing it is held for 3.0.0.
      await gsheet.addWorksheet('Second');
      const said = await stderrOf(() => gsheet.updateData([['x']], { worksheetTitle: TITLE, range: `Second!A1` }));
      expect(said).to.contain(`range "Second!A1" targets worksheet "Second" but worksheetTitle is "${TITLE}"; writing to "Second", as 2.2.x did`);
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('x');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('');
    });

    it('2.2.x: an unquoted range worksheet resolves to the remembered sheet but writes where the range says', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      await gsheet.updateData([['landed']], { range: `Second!A1` });
      // the write follows getRange, which returns the range untouched
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('landed');
      // and Sheet1, the sheet the call resolved to, is neither written to nor grown
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('');
      expect(fake.worksheet(SPREADSHEET_ID, TITLE).rowCount).to.equal(1000);

      const fresh = new GoogleSheet(SPREADSHEET_ID);
      await fresh.authorize(fake.credentials);
      const error = await rejection(() => fresh.updateData([['x']], { range: `Second!A1` }));
      expect(error).to.equal('Specify worksheetTitle');
    });

    it('honors valueInputOption', async () => {
      await gsheet.updateData([['=1+1']], { worksheetTitle: TITLE, minCol: 1, minRow: 1, valueInputOption: GoogleSheetCli.ValueInputOption.USER_ENTERED });
      const update = fake.requests.filter((request) => request.method === 'PUT').pop();
      expect(update?.url).to.contain('valueInputOption=USER_ENTERED');
    });

    it('leaves null cells alone', async () => {
      await gsheet.updateData([['keep', 'me']], { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      await gsheet.updateData([[null, 'changed']], { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('keep');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'B1')).to.equal('changed');
    });

    it('throws a string when no worksheetTitle can be resolved', async () => {
      const error = await rejection(() => gsheet.updateData([['a']], { minCol: 1, minRow: 1 }));
      expect(error).to.equal('Specify worksheetTitle');
    });

    it('throws a string when the data is not a nested array', async () => {
      const error = await rejection(() => gsheet.updateData(<any>['a'], { worksheetTitle: TITLE, minCol: 1, minRow: 1 }));
      expect(error).to.equal('Check "data" property - has to be supplied as nested array ([["1", "2"], ["3", "4"]])');
    });
  });

  describe('appendData', () => {
    it('appends after the last data row', async () => {
      await gsheet.updateData(BLOCK, { worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      const result = await gsheet.appendData(APPEND, { worksheetTitle: TITLE, minCol: 1 });
      expect(result).to.equal(undefined);

      const data = await gsheet.getData({ worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      expect(data).to.eql({
        formatted: [
          { '(A)': 'A1', '(B)': 'A2', '(C)': 'A3', '(D)': 'A4', '(E)': 'A5', '(F)': '' },
          { '(A)': 'B1', '(B)': '', '(C)': 'B3', '(D)': 'B4', '(E)': 'B5', '(F)': 'B6' },
          { '(A)': 'C1', '(B)': 'C2', '(C)': 'C3', '(D)': '', '(E)': '', '(F)': '' },
          { '(A)': 'D1', '(B)': 'D2', '(C)': 'D3', '(D)': 'D4', '(E)': 'D5', '(F)': '' },
        ],
        header: ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'],
        range: `'${TITLE}'!A1:Z1000`,
        rawData: [
          ['A1', 'A2', 'A3', 'A4', 'A5', ''],
          ['B1', '', 'B3', 'B4', 'B5', 'B6'],
          ['C1', 'C2', 'C3', '', '', ''],
          ['D1', 'D2', 'D3', 'D4', 'D5', ''],
        ],
      });
    });

    it('counts the last row from minCol and reports minRow back on the options object', async () => {
      // this is the action e2e case: two rows of three columns, appended at minCol 2
      await gsheet.updateData(
        [
          ['A1', 'A2', 'A3'],
          ['B1', 'B2', 'B3'],
        ],
        { worksheetTitle: TITLE }
      );
      const options: GoogleSheetCli.QueryOptions = { worksheetTitle: TITLE, minCol: 2 };
      await gsheet.appendData([['C2', 'C3', 'C4']], options);
      expect(options.minRow).to.equal(3);

      const data = await gsheet.getData({ worksheetTitle: TITLE, minCol: 1, minRow: 1 });
      expect(data.header).to.eql(['(A)', '(B)', '(C)', '(D)']);
      expect(data.rawData).to.eql([
        ['A1', 'A2', 'A3', ''],
        ['B1', 'B2', 'B3', ''],
        ['', 'C2', 'C3', 'C4'],
      ]);
    });

    it('appends after the blank cell rows of the RAW_DATA fixture', async () => {
      await gsheet.updateData(RAW_DATA, { worksheetTitle: TITLE });
      const options: GoogleSheetCli.QueryOptions = { worksheetTitle: TITLE, minCol: 1 };
      await gsheet.appendData([['A8', 'B8', 'C8']], options);
      expect(options.minRow).to.equal(8);
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A8')).to.equal('A8');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'C8')).to.equal('C8');
    });

    it('writes to the first row of an empty worksheet', async () => {
      const options: GoogleSheetCli.QueryOptions = { worksheetTitle: TITLE, minCol: 1 };
      await gsheet.appendData([['first']], options);
      expect(options.minRow).to.equal(1);
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('first');
    });

    // appendData is getData followed by updateData over one options object. Both halves were
    // pinned separately and both stayed green while the composition was broken, because getData
    // filled worksheetTitle in on the caller's own object and updateData then read it back as a
    // title the caller had passed. These pin the composition rather than the halves; the stderr
    // check is what keeps them biting now that the contradiction warns instead of throwing.

    it('2.2.x: appends through an unquoted range naming another worksheet, after one was touched', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      const options: GoogleSheetCli.QueryOptions = { range: `Second!A1` };
      const said = await stderrOf(() => gsheet.appendData([['landed']], options));
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('landed');
      // the caller named no worksheet, so there is nothing for the range to contradict
      expect(said).to.equal('');
    });

    it('2.2.x: appends through a quoted range naming another worksheet, after one was touched', async () => {
      await gsheet.addWorksheet('Second');
      await gsheet.getWorksheet(TITLE);
      const options: GoogleSheetCli.QueryOptions = { range: `'Second'!A1` };
      const said = await stderrOf(() => gsheet.appendData([['landed']], options));
      expect(fake.cell(SPREADSHEET_ID, 'Second', 'A1')).to.equal('landed');
      expect(fake.cell(SPREADSHEET_ID, TITLE, 'A1')).to.equal('');
      expect(said).to.equal('');
    });
  });
});

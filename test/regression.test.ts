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
  });
});

import { expect } from '@oclif/test';
import GoogleSheet from '../src/lib/google-sheet';
import { FakeSheets } from './fake-sheets';

/**
 * #611: appending to a worksheet whose grid is full used to fail with
 * "Range (xxx!A1017) exceeds grid limits. Max rows: 1016", because the target row was
 * derived from getData and then written with values.update, which never grows the sheet.
 */

const SPREADSHEET_ID = 'fake-spreadsheet-id';
const SPREADSHEET_TITLE = 'Grid growth spreadsheet';
const FULL = 'Full';

const FILLED = [
  ['A1', 'B1'],
  ['A2', 'B2'],
  ['A3', 'B3'],
];

const FOUR_BY_THREE = [
  ['C1', 'D1', 'E1'],
  ['C2', 'D2', 'E2'],
  ['C3', 'D3', 'E3'],
  ['C4', 'D4', 'E4'],
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

describe('grid growth (#611)', () => {
  const fake = new FakeSheets();
  let gsheet: GoogleSheet;

  before(() => fake.install());
  after(() => fake.uninstall());

  beforeEach(async () => {
    fake.reset();
    // a worksheet whose grid is exactly as big as its data, the shape that used to fail
    fake.addSpreadsheet(SPREADSHEET_ID, SPREADSHEET_TITLE, [{ title: FULL, rowCount: 3, columnCount: 2 }]);
    gsheet = new GoogleSheet(SPREADSHEET_ID);
    await gsheet.authorize(fake.credentials);
    await gsheet.updateData(FILLED, { worksheetTitle: FULL, minCol: 1, minRow: 1 });
  });

  it('appends past the end of a full grid', async () => {
    await gsheet.appendData(FOUR_BY_THREE, { worksheetTitle: FULL, minCol: 1 });

    const sheet = fake.worksheet(SPREADSHEET_ID, FULL);
    expect(sheet.rowCount).to.be.at.least(7);
    expect(sheet.columnCount).to.be.at.least(3);

    const data = await gsheet.getData({ worksheetTitle: FULL, minCol: 1, minRow: 1 });
    expect(data.rawData).to.eql([
      ['A1', 'B1', ''],
      ['A2', 'B2', ''],
      ['A3', 'B3', ''],
      ['C1', 'D1', 'E1'],
      ['C2', 'D2', 'E2'],
      ['C3', 'D3', 'E3'],
      ['C4', 'D4', 'E4'],
    ]);
  });

  it('updates through a range that reaches past the grid', async () => {
    await gsheet.updateData(
      [
        ['X5', 'Y5', 'Z5'],
        ['X6', 'Y6', 'Z6'],
      ],
      { worksheetTitle: FULL, range: `'${FULL}'!A5:C6` }
    );

    const sheet = fake.worksheet(SPREADSHEET_ID, FULL);
    expect(sheet.rowCount).to.be.at.least(6);
    expect(sheet.columnCount).to.be.at.least(3);

    const data = await gsheet.getData({ worksheetTitle: FULL, minCol: 1, minRow: 1 });
    expect(data.rawData).to.eql([
      ['A1', 'B1', ''],
      ['A2', 'B2', ''],
      ['A3', 'B3', ''],
      ['', '', ''],
      ['X5', 'Y5', 'Z5'],
      ['X6', 'Y6', 'Z6'],
    ]);
  });

  it('appends through a range that reaches past the grid', async () => {
    // placement still follows getRange, where an explicit range wins over minRow/minCol;
    // this task only makes the grid big enough for that write to land
    await gsheet.appendData(FOUR_BY_THREE, { worksheetTitle: FULL, range: `'${FULL}'!A1:C8` });

    const sheet = fake.worksheet(SPREADSHEET_ID, FULL);
    expect(sheet.rowCount).to.be.at.least(8);
    expect(sheet.columnCount).to.be.at.least(3);
    expect(fake.cell(SPREADSHEET_ID, FULL, 'A1')).to.equal('C1');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'E4')).to.equal('');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'C4')).to.equal('E4');
  });

  it('grows the grid without moving unrelated data', async () => {
    fake.reset();
    fake.addSpreadsheet(SPREADSHEET_ID, SPREADSHEET_TITLE, [{ title: FULL, rowCount: 12, columnCount: 8 }]);
    fake.setCells(SPREADSHEET_ID, FULL, 'E10', [['sentinel']]);
    await gsheet.updateData(FILLED, { worksheetTitle: FULL, minCol: 1, minRow: 1 });

    // the sentinel is the last row that holds data, so the append starts under it at row 11
    await gsheet.appendData(FOUR_BY_THREE, { worksheetTitle: FULL, minCol: 1 });
    expect(fake.worksheet(SPREADSHEET_ID, FULL).rowCount).to.be.at.least(14);
    expect(fake.cell(SPREADSHEET_ID, FULL, 'A11')).to.equal('C1');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'C14')).to.equal('E4');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'E10')).to.equal('sentinel');

    await gsheet.updateData([['X20', 'Y20', 'Z20']], { worksheetTitle: FULL, range: `'${FULL}'!A20:C20` });
    const sheet = fake.worksheet(SPREADSHEET_ID, FULL);
    expect(sheet.rowCount).to.be.at.least(20);
    expect(fake.cell(SPREADSHEET_ID, FULL, 'A20')).to.equal('X20');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'E10')).to.equal('sentinel');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'A1')).to.equal('A1');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'A11')).to.equal('C1');
  });

  it('grows the grid in a single batchUpdate', async () => {
    fake.requests.length = 0;
    await gsheet.appendData(FOUR_BY_THREE, { worksheetTitle: FULL, minCol: 1 });
    const batches = fake.requests.filter((request) => request.url.includes(':batchUpdate'));
    expect(batches.length).to.equal(1);
    expect(batches[0].body.requests.map((request: any) => request.appendDimension.dimension)).to.eql(['ROWS', 'COLUMNS']);
  });

  it('does not touch the grid when the data already fits', async () => {
    fake.requests.length = 0;
    await gsheet.updateData([['a', 'b']], { worksheetTitle: FULL, minCol: 1, minRow: 1 });
    expect(fake.requests.filter((request) => request.url.includes(':batchUpdate'))).to.eql([]);
  });

  it('rejects data that does not fit a bounded range', async () => {
    const error = await rejection(() =>
      gsheet.updateData(
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        { worksheetTitle: FULL, range: `'${FULL}'!A1:B2` }
      )
    );
    expect(error.message).to.equal(`data (3x3) does not fit range '${FULL}'!A1:B2`);
  });

  it('rejects a range whose worksheet contradicts worksheetTitle', async () => {
    const error = await rejection(() => gsheet.updateData([['a']], { worksheetTitle: FULL, range: `'Other'!A1` }));
    expect(error.message).to.equal(`range "'Other'!A1" targets worksheet "Other" but worksheetTitle is "${FULL}"`);
  });

  it('rejects empty data', async () => {
    const error = await rejection(() => gsheet.updateData([], { worksheetTitle: FULL, minCol: 1, minRow: 1 }));
    expect(error).to.equal('Check "data" property - has to be supplied as nested array ([["1", "2"], ["3", "4"]])');
  });

  it('keeps ragged rows ragged and sizes the grid from the longest one', async () => {
    await gsheet.updateData([['a'], ['b', 'c', 'd', 'e'], ['f', 'g']], { worksheetTitle: FULL, minCol: 1, minRow: 4 });
    const sheet = fake.worksheet(SPREADSHEET_ID, FULL);
    expect(sheet.rowCount).to.be.at.least(6);
    expect(sheet.columnCount).to.be.at.least(4);
    expect(fake.cell(SPREADSHEET_ID, FULL, 'A4')).to.equal('a');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'B4')).to.equal('');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'D5')).to.equal('e');
    expect(fake.cell(SPREADSHEET_ID, FULL, 'C6')).to.equal('');
  });
});

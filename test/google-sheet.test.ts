import { expect } from '@oclif/test';
import { google, sheets_v4 } from 'googleapis';
import { normalizeCredentials } from '../src/lib/credentials';
import GoogleSheet from '../src/lib/google-sheet';
import { getID } from './commands/helper';

const data = {
  new: [
    ['A1', 'A2', 'A3', 'A4', 'A5'],
    ['B1', '', 'B3', 'B4', 'B5', 'B6'],
  ],
  append: [
    ['C1', 'C2', 'C3'],
    ['D1', 'D2', 'D3', 'D4', 'D5'],
  ],
};

describe('google-sheet', () => {
  let gsheet: GoogleSheet;
  const worksheetTitle = getID();
  const { TEST_SPREADSHEET_ID = '', GSHEET_CLIENT_EMAIL = '', GSHEET_PRIVATE_KEY = '' } = process.env;

  before(async () => {
    // Create a new GoogleSheet instance and authorize
    gsheet = new GoogleSheet(TEST_SPREADSHEET_ID);
    expect(gsheet).to.instanceOf(GoogleSheet);
    await gsheet.authorize({
      client_email: GSHEET_CLIENT_EMAIL,
      private_key: GSHEET_PRIVATE_KEY,
    });
  });

  it('[1] creates a worksheet', async () => {
    const sheet = await gsheet.addWorksheet(worksheetTitle);
    if (!sheet?.properties) throw sheet;
    expect(sheet.properties).to.haveOwnProperty('sheetId');
    expect(sheet.properties).to.haveOwnProperty('index');
    expect(sheet.properties).to.haveOwnProperty('gridProperties');
    expect(sheet.properties.title).to.equal(worksheetTitle);
    expect(sheet.properties.sheetType).to.equal('GRID');
  });

  it('[2] gets a worksheet', async () => {
    const sheet: sheets_v4.Schema$Sheet = await gsheet.getWorksheet(worksheetTitle);
    if (!sheet.properties) throw sheet;
    expect(sheet.properties).to.haveOwnProperty('sheetId');
    expect(sheet.properties).to.haveOwnProperty('index');
    expect(sheet.properties).to.haveOwnProperty('gridProperties');
    expect(sheet.properties.title).to.equal(worksheetTitle);
    expect(sheet.properties.sheetType).to.equal('GRID');
  });

  it('[3] updates data', async () => {
    const update = await gsheet.updateData(data.new, { worksheetTitle, minCol: 1, minRow: 1 });
    await expect(update).to.equal(undefined);
    const get = await gsheet.getData({ minCol: 1, minRow: 1 });
    await expect(get).to.eql({
      formatted: [
        { '(A)': 'A1', '(B)': 'A2', '(C)': 'A3', '(D)': 'A4', '(E)': 'A5', '(F)': '' },
        { '(A)': 'B1', '(B)': '', '(C)': 'B3', '(D)': 'B4', '(E)': 'B5', '(F)': 'B6' },
      ],
      header: ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'],
      range: `'${worksheetTitle}'!A1:Z1000`,
      rawData: [
        ['A1', 'A2', 'A3', 'A4', 'A5', ''],
        ['B1', '', 'B3', 'B4', 'B5', 'B6'],
      ],
    });
  });

  it('[4] appends data', async () => {
    const append = await gsheet.appendData(data.append, { worksheetTitle, minCol: 1 });
    await expect(append).to.equal(undefined);
    const get = await gsheet.getData({ minCol: 1, minRow: 1 });
    await expect(get).to.eql({
      formatted: [
        { '(A)': 'A1', '(B)': 'A2', '(C)': 'A3', '(D)': 'A4', '(E)': 'A5', '(F)': '' },
        { '(A)': 'B1', '(B)': '', '(C)': 'B3', '(D)': 'B4', '(E)': 'B5', '(F)': 'B6' },
        { '(A)': 'C1', '(B)': 'C2', '(C)': 'C3', '(D)': '', '(E)': '', '(F)': '' },
        { '(A)': 'D1', '(B)': 'D2', '(C)': 'D3', '(D)': 'D4', '(E)': 'D5', '(F)': '' },
      ],
      header: ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'],
      range: `'${worksheetTitle}'!A1:Z1000`,
      rawData: [
        ['A1', 'A2', 'A3', 'A4', 'A5', ''],
        ['B1', '', 'B3', 'B4', 'B5', 'B6'],
        ['C1', 'C2', 'C3', '', '', ''],
        ['D1', 'D2', 'D3', 'D4', 'D5', ''],
      ],
    });
  });

  it('[5] removes worksheet', async () => {
    const res = await gsheet.removeWorksheet(worksheetTitle);
    await expect(res).to.equal(undefined);
  });
});

/**
 * The live half of the #611 work. Every case here has an offline twin in
 * test/grid-growth.test.ts driven through test/fake-sheets.ts; this suite is what confirms the
 * fake is not wrong in the same direction as the code. If one of these disagrees with its twin,
 * believe this one and fix the fake.
 */
describe('google-sheet grid growth (#611)', () => {
  let gsheet: GoogleSheet;
  let sheets: sheets_v4.Sheets;
  const constrained = getID('grid_');
  const sentinel = getID('sentinel_');
  const { TEST_SPREADSHEET_ID = '', GSHEET_CLIENT_EMAIL = '', GSHEET_PRIVATE_KEY = '' } = process.env;

  const filled = [
    ['A1', 'B1'],
    ['A2', 'B2'],
    ['A3', 'B3'],
  ];
  const fourByThree = [
    ['C1', 'D1', 'E1'],
    ['C2', 'D2', 'E2'],
    ['C3', 'D3', 'E3'],
    ['C4', 'D4', 'E4'],
  ];

  /**
   * Add a worksheet with a grid smaller than the default, which the public API cannot do
   */
  const addWorksheetWithGrid = async (title: string, rowCount: number, columnCount: number): Promise<void> => {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: TEST_SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title, gridProperties: { rowCount, columnCount } } } }] },
    });
  };

  const gridOf = async (title: string): Promise<{ rowCount: number; columnCount: number }> => {
    const sheet = await gsheet.getWorksheet(title, TEST_SPREADSHEET_ID);
    const { rowCount = 0, columnCount = 0 } = sheet.properties?.gridProperties || {};
    return { rowCount: rowCount ?? 0, columnCount: columnCount ?? 0 };
  };

  const rejection = async (fn: () => Promise<any>): Promise<any> => {
    try {
      await fn();
    } catch (error) {
      return error;
    }
    throw new Error('expected the call to reject, but it resolved');
  };

  before(async () => {
    gsheet = new GoogleSheet(TEST_SPREADSHEET_ID);
    await gsheet.authorize({ client_email: GSHEET_CLIENT_EMAIL, private_key: GSHEET_PRIVATE_KEY });

    const { client_email, private_key } = normalizeCredentials({ client_email: GSHEET_CLIENT_EMAIL, private_key: GSHEET_PRIVATE_KEY });
    const auth = await google.auth.getClient({ credentials: { client_email, private_key }, scopes: ['https://spreadsheets.google.com/feeds/'] });
    sheets = google.sheets({ version: 'v4', auth });

    await addWorksheetWithGrid(constrained, 3, 2);
    await addWorksheetWithGrid(sentinel, 12, 8);
  });

  after(async () => {
    for (const title of [constrained, sentinel]) {
      try {
        await gsheet.removeWorksheet(title, TEST_SPREADSHEET_ID);
      } catch (error) {
        // fail soft, the shared spreadsheet is cleaned up separately
      }
    }
  });

  it('[1] fills the constrained grid exactly', async () => {
    await gsheet.updateData(filled, { worksheetTitle: constrained, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);
    expect(await gridOf(constrained)).to.eql({ rowCount: 3, columnCount: 2 });
  });

  it('[2] appends four rows of three columns past the end of the grid', async () => {
    await gsheet.appendData(fourByThree, { worksheetTitle: constrained, minCol: 1 }, TEST_SPREADSHEET_ID);

    const grid = await gridOf(constrained);
    expect(grid.rowCount).to.be.at.least(7);
    expect(grid.columnCount).to.be.at.least(3);

    const { rawData } = await gsheet.getData({ worksheetTitle: constrained, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);
    expect(rawData).to.eql([
      ['A1', 'B1', ''],
      ['A2', 'B2', ''],
      ['A3', 'B3', ''],
      ['C1', 'D1', 'E1'],
      ['C2', 'D2', 'E2'],
      ['C3', 'D3', 'E3'],
      ['C4', 'D4', 'E4'],
    ]);
  });

  it('[3] appends through a range that is inside the grid', async () => {
    await gsheet.appendData([['F1', 'F2', 'F3']], { worksheetTitle: constrained, range: `'${constrained}'!A1:C7` }, TEST_SPREADSHEET_ID);

    const { rawData } = await gsheet.getData({ worksheetTitle: constrained, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);
    // an explicit range wins over the computed minRow, so the write lands at the range start
    expect(rawData[0]).to.eql(['F1', 'F2', 'F3']);
  });

  it('[4] refuses to append through a range that reaches past the grid', async () => {
    // KNOWN LIMITATION (see test-docs/revive-v3.md): appendData reads before it writes, and the
    // read carries the caller's range unchanged. If this case ever passes on CI, the fake's
    // strict-read model is wrong and test/fake-sheets.ts has to be relaxed to match.
    await addWorksheetWithGrid(`${constrained}_ro`, 3, 2);
    try {
      await gsheet.updateData(filled, { worksheetTitle: `${constrained}_ro`, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);
      const error = await rejection(() => gsheet.appendData(fourByThree, { worksheetTitle: `${constrained}_ro`, range: `'${constrained}_ro'!A1:C8` }, TEST_SPREADSHEET_ID));
      expect(error.message).to.contain('exceeds grid limits');
      expect(await gridOf(`${constrained}_ro`)).to.eql({ rowCount: 3, columnCount: 2 });
    } finally {
      await gsheet.removeWorksheet(`${constrained}_ro`, TEST_SPREADSHEET_ID).catch(() => undefined);
    }
  });

  it('[5] updates through a range that reaches past the grid', async () => {
    await addWorksheetWithGrid(`${constrained}_up`, 3, 2);
    try {
      await gsheet.updateData(filled, { worksheetTitle: `${constrained}_up`, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);
      await gsheet.updateData(
        [
          ['X5', 'Y5', 'Z5'],
          ['X6', 'Y6', 'Z6'],
        ],
        { worksheetTitle: `${constrained}_up`, range: `'${constrained}_up'!A5:C6` },
        TEST_SPREADSHEET_ID
      );

      const grid = await gridOf(`${constrained}_up`);
      expect(grid.rowCount).to.be.at.least(6);
      expect(grid.columnCount).to.be.at.least(3);

      const { rawData } = await gsheet.getData({ worksheetTitle: `${constrained}_up`, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);
      expect(rawData).to.eql([
        ['A1', 'B1', ''],
        ['A2', 'B2', ''],
        ['A3', 'B3', ''],
        ['', '', ''],
        ['X5', 'Y5', 'Z5'],
        ['X6', 'Y6', 'Z6'],
      ]);
    } finally {
      await gsheet.removeWorksheet(`${constrained}_up`, TEST_SPREADSHEET_ID).catch(() => undefined);
    }
  });

  it('[6] grows the grid without moving the sentinel at E10', async () => {
    await gsheet.updateData([['sentinel']], { worksheetTitle: sentinel, minCol: 5, minRow: 10 }, TEST_SPREADSHEET_ID);
    await gsheet.updateData(filled, { worksheetTitle: sentinel, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);

    // the sentinel is the last row holding data, so the append starts under it at row 11
    await gsheet.appendData(fourByThree, { worksheetTitle: sentinel, minCol: 1 }, TEST_SPREADSHEET_ID);
    expect((await gridOf(sentinel)).rowCount).to.be.at.least(14);

    await gsheet.updateData([['X20', 'Y20', 'Z20']], { worksheetTitle: sentinel, range: `'${sentinel}'!A20:C20` }, TEST_SPREADSHEET_ID);
    expect((await gridOf(sentinel)).rowCount).to.be.at.least(20);

    const { rawData } = await gsheet.getData({ worksheetTitle: sentinel, minCol: 1, minRow: 1 }, TEST_SPREADSHEET_ID);
    expect(rawData[0].slice(0, 2)).to.eql(['A1', 'B1']);
    expect(rawData[9][4]).to.equal('sentinel');
    expect(rawData[10].slice(0, 3)).to.eql(['C1', 'D1', 'E1']);
    expect(rawData[19].slice(0, 3)).to.eql(['X20', 'Y20', 'Z20']);
  });
});

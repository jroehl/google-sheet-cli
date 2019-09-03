import GoogleSheet from '../src/lib/google-sheet';
import { sheets_v4 } from 'googleapis';

const data = {
  new: [['A1', 'A2', 'A3', 'A4', 'A5'], ['B1', '', 'B3', 'B4', 'B5', 'B6']],
  append: [['C1', 'C2', 'C3'], ['D1', 'D2', 'D3', 'D4', 'D5']],
};

describe('google-sheet', () => {
  let gsheet: GoogleSheet;
  const worksheetTitle = `test-google-sheets-${Date.now()}`;
  const { TEST_SPREADSHEET_ID = '', GSHEET_CLIENT_EMAIL = '', GSHEET_PRIVATE_KEY = '' } = process.env;

  beforeAll(async () => {
    // Create a new GoogleSheet instance and authorize
    gsheet = new GoogleSheet(TEST_SPREADSHEET_ID);
    expect(gsheet).toBeInstanceOf(GoogleSheet);
    await gsheet.authorize({
      client_email: GSHEET_CLIENT_EMAIL,
      private_key: GSHEET_PRIVATE_KEY,
    });
  });

  it('[1] creates a worksheet', async () => {
    const sheet: sheets_v4.Schema$Sheet = await gsheet.addWorksheet(worksheetTitle);
    if (!sheet.properties) throw sheet;
    expect(sheet.properties).toHaveProperty('sheetId');
    expect(sheet.properties).toHaveProperty('index');
    expect(sheet.properties).toHaveProperty('gridProperties');
    expect(sheet.properties.title).toBe(worksheetTitle);
    expect(sheet.properties.sheetType).toBe('GRID');
  });

  it('[2] gets a worksheet', async () => {
    const sheet: sheets_v4.Schema$Sheet = await gsheet.getWorksheet(worksheetTitle);
    if (!sheet.properties) throw sheet;
    expect(sheet.properties).toHaveProperty('sheetId');
    expect(sheet.properties).toHaveProperty('index');
    expect(sheet.properties).toHaveProperty('gridProperties');
    expect(sheet.properties.title).toBe(worksheetTitle);
    expect(sheet.properties.sheetType).toBe('GRID');
  });

  it('[3] updates data', async () => {
    await expect(gsheet.updateData(data.new, { worksheetTitle, minCol: 1, minRow: 1 })).resolves.toBeUndefined();
    await expect(gsheet.getData({ minCol: 1, minRow: 1 })).resolves.toEqual({
      formatted: [
        { '(A)': 'A1', '(B)': 'A2', '(C)': 'A3', '(D)': 'A4', '(E)': 'A5', '(F)': '' },
        { '(A)': 'B1', '(B)': '', '(C)': 'B3', '(D)': 'B4', '(E)': 'B5', '(F)': 'B6' },
      ],
      header: ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'],
      range: `'${worksheetTitle}'!A1:Z1000`,
      rawData: [['A1', 'A2', 'A3', 'A4', 'A5', ''], ['B1', '', 'B3', 'B4', 'B5', 'B6']],
    });
  });

  it('[4] appends data', async () => {
    await expect(gsheet.appendData(data.append, { worksheetTitle, minCol: 1 })).resolves.toBeUndefined();
    await expect(gsheet.getData({ minCol: 1, minRow: 1 })).resolves.toEqual({
      formatted: [
        { '(A)': 'A1', '(B)': 'A2', '(C)': 'A3', '(D)': 'A4', '(E)': 'A5', '(F)': '' },
        { '(A)': 'B1', '(B)': '', '(C)': 'B3', '(D)': 'B4', '(E)': 'B5', '(F)': 'B6' },
        { '(A)': 'C1', '(B)': 'C2', '(C)': 'C3', '(D)': '', '(E)': '', '(F)': '' },
        { '(A)': 'D1', '(B)': 'D2', '(C)': 'D3', '(D)': 'D4', '(E)': 'D5', '(F)': '' },
      ],
      header: ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'],
      range: `'${worksheetTitle}'!A1:Z1000`,
      rawData: [['A1', 'A2', 'A3', 'A4', 'A5', ''], ['B1', '', 'B3', 'B4', 'B5', 'B6'], ['C1', 'C2', 'C3', '', '', ''], ['D1', 'D2', 'D3', 'D4', 'D5', '']],
    });
  });

  it('[5] removes worksheet', async () => {
    await expect(gsheet.removeWorksheet(worksheetTitle)).resolves.toBeUndefined();
  });
});
